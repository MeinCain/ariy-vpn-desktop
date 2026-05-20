/**
 * Клиент к Ariy auth-api (`api.example.com`).
 *
 * Использует `@tauri-apps/plugin-http` вместо native window.fetch —
 * это HTTP-запрос из Rust, минуя CORS-проверки WebView2. Иначе
 * `tauri://localhost` origin падает с `TypeError: Failed to fetch` если
 * бэк не отдаёт `Access-Control-Allow-Origin` для нашего origin.
 *
 * Endpoints (mirror Chrome-расширения):
 *   POST /v1/auth/email/login           — login по email/password
 *   POST /v1/auth/telegram/request      — старт TG deep-link flow
 *   POST /v1/auth/telegram/poll         — polling статуса TG-auth
 *   POST /v1/auth/logout                — инвалидация сессии
 *
 * **Новый endpoint которого пока нет, нужно добавить в auth-api:**
 *   GET  /v1/sub/<session_token>        — raw Remnawave subscription
 *   (см. docs/AUTH-API-INTEGRATION.md)
 */

import { fetch } from "@tauri-apps/plugin-http";

const API_BASE = "https://api.example.com";

export class AriyApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "AriyApiError";
  }
}

export type AriyUser = {
  id: number;
  email?: string | null;
  telegram_id?: number | null;
  title?: string | null;
};

export type LoginEmailResponse = {
  session_token: string;
  expires_in?: number;
  user: AriyUser;
};

async function postJson(path: string, body: unknown): Promise<any> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    connectTimeout: 10_000,
  });
  const txt = await r.text();
  let json: any = null;
  try { json = txt ? JSON.parse(txt) : null; } catch { /* leave null */ }
  if (!r.ok) {
    const code = json?.error || json?.code || "http_error";
    const msg = json?.message || `${r.status} ${r.statusText}`;
    throw new AriyApiError(r.status, code, msg);
  }
  return json;
}

/** Логин по email/password. */
export async function loginEmail(email: string, password: string): Promise<LoginEmailResponse> {
  const json = await postJson("/v1/auth/email/login", { email, password });
  if (!json?.session_token) {
    throw new AriyApiError(0, "bad_response", "auth-api вернул ответ без session_token");
  }
  return json as LoginEmailResponse;
}

/** Telegram deep-link flow — старт. Возвращает токен запроса + URL для открытия в боте. */
export type TelegramRequestResponse = {
  request_token: string;
  /** `https://t.me/AriyVPN_Bot?start=webauth_<token>` или `tg://...` */
  deep_link: string;
  /** Время жизни request_token в секундах (обычно 5 минут). */
  expires_in?: number;
};
export async function telegramRequest(): Promise<TelegramRequestResponse> {
  const json = await postJson("/v1/auth/telegram/request", {});
  if (!json?.request_token || !json?.deep_link) {
    throw new AriyApiError(0, "bad_response", "telegram/request вернул некорректный ответ");
  }
  return json as TelegramRequestResponse;
}

/** Polling статуса TG-auth. Возвращает либо `pending`, либо `linked` с session_token. */
export type TelegramPollResponse =
  | { status: "pending" }
  | { status: "linked"; session_token: string; user: AriyUser }
  | { status: "expired" };
export async function telegramPoll(requestToken: string): Promise<TelegramPollResponse> {
  return await postJson("/v1/auth/telegram/poll", { request_token: requestToken });
}

/** Best-effort logout. */
export async function logout(sessionToken: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/v1/auth/logout`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${sessionToken}` },
      connectTimeout: 10_000,
    });
  } catch { /* ignore */ }
}

/**
 * Сконструировать URL подписки. Backend endpoint `GET /v1/sub/:token`
 * пока не задеплоен — см. docs/AUTH-API-INTEGRATION.md.
 */
export function buildSubUrl(sessionToken: string): string {
  return `${API_BASE}/v1/sub/${encodeURIComponent(sessionToken)}`;
}
