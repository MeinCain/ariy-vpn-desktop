/**
 * Клиент к Ariy auth-api (`api.example.com`).
 *
 * Endpoint'ы и flow — **точно повторяют** наше Chrome-расширение
 * (`vpn-extension/src/auth-api.js`). Контракт уже работает в продакшене,
 * не выдумываем.
 *
 * Использует `@tauri-apps/plugin-http` чтобы обойти CORS-preflight
 * WebView2 (origin `tauri://localhost`).
 */

import { fetch } from "@tauri-apps/plugin-http";

const API_BASE = "https://api.example.com";
const LOGIN_TIMEOUT_MS = 8000;

export class AriyApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "AriyApiError";
  }
}

// ── Telegram deep-link login ──────────────────────────────────────────

export type TelegramStartResponse = {
  /** Opaque handle для последующего pollLogin'а. */
  state: string;
  /** `https://t.me/AriyVPN_Bot?start=webauth_<token>` — открываем в браузере / TG. */
  login_url: string;
  /** Time-to-live в секундах. Обычно 300. */
  expires_in: number;
};

/** Старт TG login flow. POST /v1/auth/telegram/start body {}. */
export async function telegramStart(): Promise<TelegramStartResponse> {
  console.log("[ariy-api] telegram/start ->");
  let r: Response;
  try {
    r = await fetch(`${API_BASE}/v1/auth/telegram/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: "{}",
      connectTimeout: LOGIN_TIMEOUT_MS,
    });
  } catch (e) {
    console.error("[ariy-api] telegram/start network error", e);
    throw new AriyApiError(0, "network", `Сеть недоступна: ${(e as Error).message ?? e}`);
  }
  console.log("[ariy-api] telegram/start <- HTTP", r.status);
  if (r.status === 429) throw new AriyApiError(429, "rate_limited", "Слишком много попыток входа. Попробуйте через минуту.");
  if (!r.ok) throw new AriyApiError(r.status, "http_error", `Сервер ответил HTTP ${r.status}`);
  let body: any = null;
  try { body = await r.json(); } catch { /* leave null */ }
  if (!body?.state || !body?.login_url) {
    throw new AriyApiError(r.status, "bad_response", "Неожиданный ответ от /v1/auth/telegram/start");
  }
  return {
    state: body.state,
    login_url: body.login_url,
    expires_in: Number(body.expires_in) || 300,
  };
}

export type TelegramPollResponse =
  | { status: "pending"; rateLimited?: boolean }
  | { status: "done"; sessionToken: string }
  | { status: "expired" }
  | { status: "error"; code: string; httpStatus: number };

/** Polling статуса TG-auth. GET /v1/auth/telegram/poll?state=<state>. */
export async function telegramPoll(state: string): Promise<TelegramPollResponse> {
  let r: Response;
  try {
    r = await fetch(`${API_BASE}/v1/auth/telegram/poll?state=${encodeURIComponent(state)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      connectTimeout: LOGIN_TIMEOUT_MS,
    });
  } catch (e) {
    // Transient — caller решает retry'ить ли.
    throw new AriyApiError(0, "network", (e as Error).message ?? "network error");
  }
  if (r.status === 202) return { status: "pending" };
  if (r.status === 410) return { status: "expired" };
  if (r.status === 429) return { status: "pending", rateLimited: true };
  let body: any = null;
  try { body = await r.json(); } catch { /* leave null */ }
  if (r.status === 200 && body?.session_token) {
    return { status: "done", sessionToken: body.session_token };
  }
  return { status: "error", code: body?.error ?? "unknown", httpStatus: r.status };
}

// ── Email / password login (single-shot) ─────────────────────────────

export type EmailLoginResult =
  | { ok: true; sessionToken: string }
  | { ok: false; code: string; httpStatus: number; rateLimited?: boolean };

/** POST /v1/auth/email/login {email, password}. */
export async function apiEmailLogin(email: string, password: string): Promise<EmailLoginResult> {
  console.log("[ariy-api] email/login ->", email);
  let r: Response;
  try {
    r = await fetch(`${API_BASE}/v1/auth/email/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password }),
      connectTimeout: LOGIN_TIMEOUT_MS,
    });
  } catch (e) {
    console.error("[ariy-api] email/login network error", e);
    throw new AriyApiError(0, "network", `Сеть недоступна: ${(e as Error).message ?? e}`);
  }
  console.log("[ariy-api] email/login <- HTTP", r.status);
  let body: any = null;
  try { body = await r.json(); } catch { /* leave null */ }
  if (r.status === 200 && body?.session_token) {
    return { ok: true, sessionToken: body.session_token };
  }
  return {
    ok: false,
    httpStatus: r.status,
    code: body?.error ?? "unknown",
    rateLimited: r.status === 429,
  };
}

// ── Logout ───────────────────────────────────────────────────────────

export async function apiLogout(sessionToken: string): Promise<void> {
  if (!sessionToken) return;
  try {
    await fetch(`${API_BASE}/v1/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sessionToken}` },
      connectTimeout: LOGIN_TIMEOUT_MS,
    });
  } catch { /* best-effort */ }
}

// ── /v1/auth/me — whoami ─────────────────────────────────────────────

export type AriyMe = {
  telegram_id: number | null;
  email: string | null;
  subscription_active: boolean;
};

/**
 * Получить sub_url юзера через `/v1/auth/me`. Auth-api уже хранит
 * `session.subscriptionUrl` (заполняется при login через TG/email).
 * После лёгкого расширения response `/v1/auth/me` (добавили поле
 * `sub_url`) клиент тащит его одним запросом и автоподставляет в
 * subscriptionStore. Никаких новых endpoint'ов выдумывать не надо.
 *
 * Возвращает строку sub_url или null если что-то пошло не так.
 */
export async function apiFetchSubUrl(sessionToken: string): Promise<string | null> {
  const me = await apiFetchAuthMe(sessionToken);
  return me?.sub_url ?? null;
}

export type AriyAuthMe = {
  telegram_id: number | null;
  email: string | null;
  subscription_active: boolean;
  sub_url: string | null;
  /** Plan / тариф name из cabinet, например "VIP". May be null. */
  plan: string | null;
};

/** Полный `/v1/auth/me` response. Нужен для подтягивания тарифа +
 *  sub_url одним запросом. */
export async function apiFetchAuthMe(sessionToken: string): Promise<AriyAuthMe | null> {
  if (!sessionToken) return null;
  console.log("[ariy-api] auth/me ->");
  let r: Response;
  try {
    r = await fetch(`${API_BASE}/v1/auth/me`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${sessionToken}` },
      connectTimeout: LOGIN_TIMEOUT_MS,
    });
  } catch (e) {
    console.error("[ariy-api] auth/me network error", e);
    return null;
  }
  console.log("[ariy-api] auth/me <- HTTP", r.status);
  if (!r.ok) return null;
  try {
    const body: any = await r.json();
    if (!body?.ok) return null;
    return {
      telegram_id: body.telegram_id ?? null,
      email: body.email ?? null,
      subscription_active: !!body.subscription_active,
      sub_url: typeof body.sub_url === "string" ? body.sub_url : null,
      plan: typeof body.plan === "string" && body.plan.trim() ? body.plan.trim() : null,
    };
  } catch { return null; }
}

export async function apiMe(sessionToken: string): Promise<AriyMe | null> {
  if (!sessionToken) return null;
  let r: Response;
  try {
    r = await fetch(`${API_BASE}/v1/auth/me`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${sessionToken}` },
      connectTimeout: LOGIN_TIMEOUT_MS,
    });
  } catch { return null; }
  if (r.status === 401) return null;
  if (!r.ok) return null;
  try {
    const body: any = await r.json();
    if (!body?.ok) return null;
    return {
      telegram_id: body.telegram_id ?? null,
      email: body.email ?? null,
      subscription_active: !!body.subscription_active,
    };
  } catch { return null; }
}


// ── Trial proxy для Telegram-login без подписки ─────────────────────
// Endpoint выдаёт 10-минутные HMAC creds на дефолтную ноду. Юзер
// активирует system-proxy с этими creds, открывает Telegram (даже
// если он заблокирован), проходит OAuth → получает session_token →
// trial-mode выключается, переходим на постоянную подписку.

export type TrialProxyResponse = {
  host: string;
  port: number;
  user: string;
  pass: string;
  expires_in: number;
};

export async function apiFetchTrialProxy(): Promise<TrialProxyResponse | null> {
  let r: Response;
  try {
    r = await fetch(`${API_BASE}/v1/auth/trial-proxy`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      connectTimeout: LOGIN_TIMEOUT_MS,
    });
  } catch (e) {
    console.warn('[ariy-api] trial-proxy failed:', e);
    return null;
  }
  if (!r.ok) {
    console.warn('[ariy-api] trial-proxy non-ok status:', r.status);
    return null;
  }
  try {
    const body: any = await r.json();
    if (!body || !body.host) return null;
    return {
      host: body.host,
      port: body.port,
      user: body.user,
      pass: body.pass,
      expires_in: body.expires_in,
    };
  } catch { return null; }
}
