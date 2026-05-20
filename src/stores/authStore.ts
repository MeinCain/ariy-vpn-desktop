import { create } from "zustand";
import {
  loginEmail,
  logout as apiLogout,
  telegramRequest,
  telegramPoll,
  AriyApiError,
  type AriyUser,
} from "../lib/ariy-api";

const LS_KEY = "ariy.auth";

type Persisted = {
  sessionToken: string | null;
  user: AriyUser | null;
};

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { sessionToken: null, user: null };
    const j = JSON.parse(raw);
    return {
      sessionToken: typeof j.sessionToken === "string" ? j.sessionToken : null,
      user: j.user ?? null,
    };
  } catch {
    return { sessionToken: null, user: null };
  }
}

function persist(s: Persisted) {
  try {
    if (!s.sessionToken) localStorage.removeItem(LS_KEY);
    else localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch { /* quota */ }
}

export type LoginResult = { ok: true } | { ok: false; code: string; message: string };

export type TgLoginState = {
  /** request_token от auth-api для polling'а. */
  requestToken: string;
  /** Deep-link который мы открыли в браузере / на телефоне. */
  deepLink: string;
  /** Unix-ms когда request_token истекает (юзер видит «попробуйте снова»). */
  expiresAt: number;
};

export type AuthState = {
  sessionToken: string | null;
  user: AriyUser | null;
  /** Идёт ли активный login-запрос (email или TG). */
  busy: boolean;
  /** Активная TG-сессия (мы поднимаем polling каждые 3 сек). */
  tg: TgLoginState | null;

  loginEmail: (email: string, password: string) => Promise<LoginResult>;
  /** Стартует TG flow: получает deep-link, поднимает polling. UI должен открыть deep-link. */
  startTelegramLogin: () => Promise<LoginResult>;
  /** Отменить активный TG polling (юзер закрыл модалку). */
  cancelTelegramLogin: () => void;
  /** Локальный logout + best-effort server invalidation. */
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
  user: initial.user,
  busy: false,
  tg: null,

  async loginEmail(email, password) {
    if (get().busy) return { ok: false, code: "busy", message: "уже идёт логин" };
    set({ busy: true });
    try {
      const resp = await loginEmail(email.trim().toLowerCase(), password);
      const next = { sessionToken: resp.session_token, user: resp.user };
      persist(next);
      set({ ...next, busy: false, tg: null });
      stopTgPoll();
      return { ok: true };
    } catch (e) {
      set({ busy: false });
      if (e instanceof AriyApiError) return { ok: false, code: e.code, message: e.message };
      return { ok: false, code: "network", message: (e as Error).message ?? "сеть недоступна" };
    }
  },

  async startTelegramLogin() {
    if (get().busy) return { ok: false, code: "busy", message: "уже идёт логин" };
    set({ busy: true });
    try {
      const resp = await telegramRequest();
      const tg: TgLoginState = {
        requestToken: resp.request_token,
        deepLink: resp.deep_link,
        expiresAt: Date.now() + (resp.expires_in ?? 300) * 1000,
      };
      set({ tg, busy: false });

      // Polling каждые 3 сек, останавливаемся при linked/expired или отмене.
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
          const pollResp = await telegramPoll(current.requestToken);
          if (pollResp.status === "linked") {
            const next = { sessionToken: pollResp.session_token, user: pollResp.user };
            persist(next);
            set({ ...next, tg: null });
            stopTgPoll();
          } else if (pollResp.status === "expired") {
            stopTgPoll();
            set({ tg: null });
          }
          // pending — продолжаем
        } catch {
          // Сеть может моргнуть — игнорируем, на следующем тике попробуем
        }
      }, 3000);

      return { ok: true };
    } catch (e) {
      set({ busy: false });
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
    set({ sessionToken: null, user: null, tg: null });
    persist({ sessionToken: null, user: null });
    if (token) await apiLogout(token);
  },
}));
