import { create } from "zustand";
import {
  apiEmailLogin,
  apiLogout,
  apiFetchAuthMe,
  telegramStart,
  telegramPoll,
  AriyApiError,
} from "../lib/ariy-api";

const LS_KEY = "ariy.auth";
const KEYRING_KEY = "ariy.auth.session_token";

type Persisted = {
  sessionToken: string | null;
};

function loadPersisted(): Persisted {
  // beta.25: дублирующее хранилище в Windows Credential Manager через
  // tauri-cmd secure_storage. localStorage WebView2 живёт в
  // %LOCALAPPDATA%\com.ariyvpn.desktop\EBWebView\, и в редких случаях
  // (cleaner-утилиты, переустановка NSIS поверх с другим путём) папка
  // могла исчезнуть. Keyring более надёжен для главных credentials.
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { sessionToken: null };
    const j = JSON.parse(raw);
    return { sessionToken: typeof j.sessionToken === "string" ? j.sessionToken : null };
  } catch { return { sessionToken: null }; }
}

function persist(s: Persisted) {
  // localStorage — primary (быстро, sync). Keyring — secondary (async,
  // защита от reset'а localStorage).
  try {
    if (!s.sessionToken) localStorage.removeItem(LS_KEY);
    else localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch { /* quota */ }
  // Best-effort backup в keyring (fire-and-forget).
  import("@tauri-apps/api/core").then(({ invoke }) => {
    if (s.sessionToken) {
      void invoke("secure_storage_set", { key: KEYRING_KEY, value: s.sessionToken }).catch(() => {});
    } else {
      void invoke("secure_storage_delete", { key: KEYRING_KEY }).catch(() => {});
    }
  }).catch(() => {});
}

/** Recovery из keyring если localStorage пуст (после reset'а WebView2-папки).
 *  Вызывается из App.tsx на mount'е сразу после loadPersisted. */
export async function recoverSessionFromKeyring(): Promise<void> {
  // Если уже есть в state — не трогаем.
  if (useAuthStore.getState().sessionToken) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const token = await invoke<string | null>("secure_storage_get", { key: KEYRING_KEY });
    if (token && typeof token === "string" && token.length > 0) {
      useAuthStore.setState({ sessionToken: token });
      persist({ sessionToken: token }); // обратно в localStorage чтобы synced
      console.log("[auth] session_token recovered from keyring");
    }
  } catch (e) {
    console.warn("[auth] keyring recovery failed:", e);
  }
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

  // Данные юзера из /v1/auth/me (best-effort, могут быть null если бэк
  // unreachable или сессия экспайрилась).
  plan: string | null;
  email: string | null;
  telegramId: number | null;

  loginEmail: (email: string, password: string) => Promise<LoginResult>;
  /** Старт TG flow + polling. */
  startTelegramLogin: () => Promise<LoginResult>;
  /** Отменить активный TG polling. */
  cancelTelegramLogin: () => void;
  /** Locally logout + best-effort server invalidation. */
  logout: () => Promise<void>;
  /** Подтянуть plan / email / telegram_id с auth-api. Идемпотентен —
   *  безопасно дёргать после каждого login'а и при mount'е приложения. */
  loadMe: () => Promise<void>;
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
  plan: null,
  email: null,
  telegramId: null,

  async loadMe() {
    const token = get().sessionToken;
    if (!token) return;
    const me = await apiFetchAuthMe(token);
    if (!me) return;
    set({
      plan: me.plan,
      email: me.email,
      telegramId: me.telegram_id,
    });
  },

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
      // beta.27: ПЕРЕД запросом TG login пробуем поднять trial-proxy.
      // Если у юзера Telegram заблокирован провайдером — login URL
      // (`t.me/...`) не откроется. Trial-proxy через нашу дефолтную ноду
      // (Финляндия) дает временный VPN-туннель на 10 минут. После
      // успешного login → trial автоматически отключается.
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const { apiFetchTrialProxy } = await import("../lib/ariy-api");
        const trial = await apiFetchTrialProxy();
        if (trial) {
          await invoke("connect_trial_proxy", {
            host: trial.host,
            port: trial.port,
            user: trial.user,
            pass: trial.pass,
          });
          console.log("[authStore] trial-proxy активирован для TG-login");
        }
      } catch (e) {
        // Trial-proxy не критичен — если не получилось, идём дальше.
        // Юзер с работающим Telegram пройдёт login без проблем.
        console.warn("[authStore] trial-proxy preflight failed:", e);
      }

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
          void teardownTrialProxy();
          return;
        }
        try {
          const pollResp = await telegramPoll(current.state);
          if (pollResp.status === "done") {
            persist({ sessionToken: pollResp.sessionToken });
            set({ sessionToken: pollResp.sessionToken, tg: null });
            stopTgPoll();
            // После успешного login → trial больше не нужен, гасим его
            // и чистим system-proxy. Дальше юзер подключится к своей
            // подписке через нормальный flow.
            void teardownTrialProxy();
          } else if (pollResp.status === "expired" || pollResp.status === "error") {
            stopTgPoll();
            set({ tg: null });
            void teardownTrialProxy();
          }
          // pending — продолжаем
        } catch { /* транзиент сети — попробуем на следующем тике */ }
      }, 3000);

      return { ok: true };
    } catch (e) {
      set({ busy: false });
      console.error("[authStore] startTelegramLogin exception", e);
      // На ошибке тоже чистим trial — мы могли его уже поднять до
      // упавшего telegramStart.
      void teardownTrialProxy();
      if (e instanceof AriyApiError) return { ok: false, code: e.code, message: e.message };
      return { ok: false, code: "network", message: (e as Error).message ?? "сеть недоступна" };
    }
  },

  cancelTelegramLogin() {
    stopTgPoll();
    set({ tg: null });
    void teardownTrialProxy();
  },

  async logout() {
    const token = get().sessionToken;
    stopTgPoll();
    set({ sessionToken: null, tg: null, plan: null, email: null, telegramId: null });
    persist({ sessionToken: null });
    void teardownTrialProxy();
    if (token) await apiLogout(token);
  },
}));

async function teardownTrialProxy() {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("disconnect_trial_proxy");
  } catch (e) {
    console.warn("[authStore] teardownTrialProxy failed:", e);
  }
}
