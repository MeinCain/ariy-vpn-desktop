import { create } from "zustand";
import {
  apiEmailLogin,
  apiLogout,
  telegramStart,
  telegramPoll,
  AriyApiError,
} from "../lib/ariy-api";

const LS_KEY = "ariy.auth";

type Persisted = {
  sessionToken: string | null;
};

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { sessionToken: null };
    const j = JSON.parse(raw);
    return { sessionToken: typeof j.sessionToken === "string" ? j.sessionToken : null };
  } catch { return { sessionToken: null }; }
}

function persist(s: Persisted) {
  try {
    if (!s.sessionToken) localStorage.removeItem(LS_KEY);
    else localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch { /* quota */ }
}

export type LoginResult = { ok: true } | { ok: false; code: string; message: string };

export type TgLoginState = {
  /** opaque handle от auth-api для polling'а. */
  state: string;
  /** URL который мы открыли в браузере / TG-приложении. */
  loginUrl: string;
  /** Unix-ms когда state истекает. */
  expiresAt: number;
};

export type AuthState = {
  sessionToken: string | null;
  busy: boolean;
  /** Активная TG-сессия (мы поднимаем polling каждые 3 сек). */
  tg: TgLoginState | null;

  loginEmail: (email: string, password: string) => Promise<LoginResult>;
  /** Старт TG flow + polling. */
  startTelegramLogin: () => Promise<LoginResult>;
  /** Отменить активный TG polling. */
  cancelTelegramLogin: () => void;
  /** Locally logout + best-effort server invalidation. */
  logout: () => Promise<void>;
};

const initial = loadPersisted();
let tgPollHandle: number | null = null;

function stopTgPoll() {
  if (tgPollHandle !== null) {
    clearInterval(tgPollHandle);
    tgPollHandle = null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  sessionToken: initial.sessionToken,
  busy: false,
  tg: null,

  async loginEmail(email, password) {
    console.log("[authStore] loginEmail start");
    if (get().busy) return { ok: false, code: "busy", message: "уже идёт логин" };
    set({ busy: true });
    try {
      const res = await apiEmailLogin(email.trim().toLowerCase(), password);
      if (res.ok) {
        persist({ sessionToken: res.sessionToken });
        set({ sessionToken: res.sessionToken, busy: false, tg: null });
        stopTgPoll();
        console.log("[authStore] loginEmail OK");
        return { ok: true };
      }
      set({ busy: false });
      console.warn("[authStore] loginEmail failed", res);
      return { ok: false, code: res.code, message: `HTTP ${res.httpStatus}: ${res.code}` };
    } catch (e) {
      set({ busy: false });
      console.error("[authStore] loginEmail exception", e);
      if (e instanceof AriyApiError) return { ok: false, code: e.code, message: e.message };
      return { ok: false, code: "network", message: (e as Error).message ?? "сеть недоступна" };
    }
  },

  async startTelegramLogin() {
    console.log("[authStore] startTelegramLogin");
    if (get().busy) return { ok: false, code: "busy", message: "уже идёт логин" };
    set({ busy: true });
    try {
      const resp = await telegramStart();
      const tg: TgLoginState = {
        state: resp.state,
        loginUrl: resp.login_url,
        expiresAt: Date.now() + resp.expires_in * 1000,
      };
      set({ tg, busy: false });

      stopTgPoll();
      tgPollHandle = window.setInterval(async () => {
        const current = get().tg;
        if (!current) { stopTgPoll(); return; }
        if (Date.now() > current.expiresAt) {
          stopTgPoll();
          set({ tg: null });
          return;
        }
        try {
          const pollResp = await telegramPoll(current.state);
          if (pollResp.status === "done") {
            persist({ sessionToken: pollResp.sessionToken });
            set({ sessionToken: pollResp.sessionToken, tg: null });
            stopTgPoll();
          } else if (pollResp.status === "expired" || pollResp.status === "error") {
            stopTgPoll();
            set({ tg: null });
          }
          // pending — продолжаем
        } catch { /* транзиент сети — попробуем на следующем тике */ }
      }, 3000);

      return { ok: true };
    } catch (e) {
      set({ busy: false });
      console.error("[authStore] startTelegramLogin exception", e);
      if (e instanceof AriyApiError) return { ok: false, code: e.code, message: e.message };
      return { ok: false, code: "network", message: (e as Error).message ?? "сеть недоступна" };
    }
  },

  cancelTelegramLogin() {
    stopTgPoll();
    set({ tg: null });
  },

  async logout() {
    const token = get().sessionToken;
    stopTgPoll();
    set({ sessionToken: null, tg: null });
    persist({ sessionToken: null });
    if (token) await apiLogout(token);
  },
}));
