import { create } from "zustand";
import { loginEmail, logout as apiLogout, type AriyUser, AriyApiError } from "../lib/ariy-api";

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
  } catch { /* ignore quota errors */ }
}

export type LoginResult = { ok: true } | { ok: false; code: string; message: string };

export type AuthState = {
  sessionToken: string | null;
  user: AriyUser | null;
  /** Идёт ли активный запрос логина (для disabled-state кнопки в UI). */
  busy: boolean;

  /** Залогиниться через email/password. Возвращает результат — UI решает
   *  показать ошибку или перейти дальше. */
  loginEmail: (email: string, password: string) => Promise<LoginResult>;
  /** Локальный logout + best-effort server invalidation. */
  logout: () => Promise<void>;
};

const initial = loadPersisted();

export const useAuthStore = create<AuthState>((set, get) => ({
  sessionToken: initial.sessionToken,
  user: initial.user,
  busy: false,

  async loginEmail(email, password) {
    if (get().busy) return { ok: false, code: "busy", message: "уже идёт логин" };
    set({ busy: true });
    try {
      const resp = await loginEmail(email.trim().toLowerCase(), password);
      const next = { sessionToken: resp.session_token, user: resp.user };
      persist(next);
      set({ ...next, busy: false });
      return { ok: true };
    } catch (e) {
      set({ busy: false });
      if (e instanceof AriyApiError) {
        return { ok: false, code: e.code, message: e.message };
      }
      return { ok: false, code: "network", message: (e as Error).message ?? "сеть недоступна" };
    }
  },

  async logout() {
    const token = get().sessionToken;
    set({ sessionToken: null, user: null });
    persist({ sessionToken: null, user: null });
    if (token) await apiLogout(token);
  },
}));
