/**
 * Клиент к Ariy auth-api (`api.example.com`).
 *
 * Сегодня этот же API обслуживает Chrome-расширение:
 *   - `POST /v1/auth/email/login` — email/password логин (v4.16.0)
 *   - `POST /v1/auth/telegram/{request,poll}` — deep-link логин (v4.14.0)
 *   - `POST /v1/session {sub_url, hwid}` — legacy путь для расширения
 *   - `POST /v1/auth/logout` — инвалидация сессии
 *
 * **Endpoint которого пока нет, нужно добавить в auth-api:**
 *   - `GET /v1/sub/<session_token>` — отдаёт raw Remnawave-подписку
 *     (base64-encoded list of vless:// URIs или sing-box JSON). После
 *     добавления десктоп просто складывает этот URL в
 *     `subscriptionStore.url`, и existing Rust subscription.rs парсер
 *     работает as-is. См. план в TODO-комментарии ниже.
 */

const API_BASE = "https://api.example.com";

export class AriyApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "AriyApiError";
  }
}

/** Краткий профиль авторизованного юзера (как приходит из auth-api). */
export type AriyUser = {
  id: number;
  email?: string | null;
  telegram_id?: number | null;
  /** Имя/название отображаемое в sub-strip плашке (subscription title). */
  title?: string | null;
};

export type LoginEmailResponse = {
  session_token: string;
  /** TTL в секундах. Сейчас 30 дней sliding. */
  expires_in?: number;
  user: AriyUser;
};

/**
 * Логин по email/password. Mirror у cabinet endpoint
 * `POST /api/cabinet/auth/email/login`.
 *
 * При успехе — клиент сохраняет `session_token` (см. [[authStore]]) и
 * передаёт его в `Authorization: Bearer …` для последующих запросов.
 *
 * Возможные ошибки от сервера:
 *   - 401 invalid_credentials — неверный email или password
 *   - 400 bad_input — невалидный формат email/password
 *   - 429 rate_limited — слишком частые попытки (sliding 30/min/IP)
 *   - 5xx — backend / cabinet недоступен
 */
export async function loginEmail(
  email: string,
  password: string,
): Promise<LoginEmailResponse> {
  const r = await fetch(`${API_BASE}/v1/auth/email/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const txt = await r.text();
  let json: any = null;
  try { json = txt ? JSON.parse(txt) : null; } catch { /* leave null */ }
  if (!r.ok) {
    const code = json?.error || json?.code || "http_error";
    const msg = json?.message || `${r.status} ${r.statusText}`;
    throw new AriyApiError(r.status, code, msg);
  }
  if (!json?.session_token) {
    throw new AriyApiError(r.status, "bad_response", "auth-api вернул ответ без session_token");
  }
  return json as LoginEmailResponse;
}

/** Дёргает auth-api logout endpoint (best-effort — игнорирует сетевые ошибки). */
export async function logout(sessionToken: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/v1/auth/logout`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${sessionToken}` },
    });
  } catch {
    // server-side инвалидация — best effort, локальный logout всё равно
    // проходит даже если сервер недоступен.
  }
}

/**
 * Сконструировать URL подписки для нашего auth-api.
 *
 * **TODO (backend, отдельной сессией):** добавить в `auth-api` endpoint
 *
 *     GET /v1/sub/:session_token
 *
 * который:
 *   1. Резолвит session_token → user → user.sub_url (raw Remnawave).
 *   2. Делает HTTP-fetch на raw Remnawave sub_url с UA `Happ/2.7.0` и
 *      `x-hwid=sha256(sub_url)`.
 *   3. Возвращает body Remnawave подписки как есть (base64-encoded list
 *      или sing-box JSON, в зависимости от `User-Agent` запроса).
 *   4. Прокидывает стандартные subscription-заголовки (`subscription-userinfo`,
 *      `profile-title`, `profile-update-interval`, и т.п.) от Remnawave.
 *
 * Когда endpoint появится — десктоп просто сложит этот URL в
 * `subscriptionStore.url`, и existing Rust subscription.rs парсер сразу
 * работает: фетчит, парсит, конвертирует xray→sing-box если нужно.
 */
export function buildSubUrl(sessionToken: string): string {
  return `${API_BASE}/v1/sub/${encodeURIComponent(sessionToken)}`;
}
