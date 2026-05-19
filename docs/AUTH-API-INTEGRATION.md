# Интеграция с auth-api Ariy

Этот документ описывает что нужно добавить в `ariy-browser-proxy-deploy/auth-api/`
чтобы Ariy VPN Desktop полноценно работал с центральной auth-инфраструктурой.

Frontend (этот репозиторий) **уже готов** в v0.2.0-beta.1:
- `src/lib/ariy-api.ts` — HTTP клиент
- `src/stores/authStore.ts` — Zustand store для `sessionToken` + `user`
- `src/components/Welcome.tsx` — UI с email/password логином (default) и
  fallback на прямую sub-URL

## Что используется как есть

Endpoints которые **уже** реализованы в auth-api для расширения и работают
для десктопа без изменений:

| Endpoint | Метод | Назначение |
|---|---|---|
| `/v1/auth/email/login` | POST | Email/password логин. Body: `{email, password}`. Ответ: `{session_token, user}`. Rate-limit 30/min/IP. |
| `/v1/auth/logout` | POST | Best-effort инвалидация. Header: `Authorization: Bearer <session_token>`. |

## Что нужно добавить (новый endpoint)

### `GET /v1/sub/:session_token`

**Что делает:** для авторизованного юзера возвращает RAW Remnawave-подписку
которую десктопный sing-box/Mihomo может скачать и распарсить.

**Без этого endpoint'а:** после успешного email-логина клиент сохраняет
`buildSubUrl(token)` в `subscriptionStore.url`, делает invoke в Rust
`fetch_subscription`, Rust делает HTTP GET на этот URL — **404**. Клиент
показывает ошибку «не удалось скачать подписку».

**Логика:**
1. Парсим `session_token` из URL path
2. Резолвим в auth-api `authStore`: `session_token → user_id → user.sub_url` (raw Remnawave URL)
3. Если token истёк / невалиден → `401 invalid_session`
4. Делаем HTTP-fetch на `user.sub_url`:
   - `User-Agent: Happ/2.7.0` (или передаём UA клиента — десктоп шлёт `Ariy/<version>/windows`)
   - `x-hwid: sha256(user.sub_url)` (как сейчас в `/v1/session` flow для расширения)
5. Прокидываем response body **как есть**:
   - Body: base64-encoded list of vless:// URIs или sing-box JSON
     (Remnawave решает по UA)
6. Прокидываем стандартные subscription-заголовки:
   - `subscription-userinfo: upload=X;download=Y;total=Z;expire=T`
   - `profile-title: <название подписки>` (или из cabinet `/me`)
   - `profile-update-interval: 24`
   - `support-url: https://t.me/AriyVPN_Bot`
   - `profile-web-page-url: https://cabinet.example.com`
7. Cache по `user_id` с TTL 5 мин — чтобы не дрючить Remnawave при каждом
   автообновлении подписки (десктоп обновляет раз в N часов).

**Skeleton (auth-api/service/server.mjs):**

```javascript
app.get('/v1/sub/:token', async (req, res) => {
  const token = req.params.token;
  const user = authStore.getUserBySessionToken(token);
  if (!user) {
    return res.status(401).json({ error: 'invalid_session' });
  }

  // Optional cache
  const cached = subCache.get(user.id);
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) {
    res.set(cached.headers);
    return res.send(cached.body);
  }

  // Fetch from Remnawave
  const upstream = await fetch(user.sub_url, {
    headers: {
      'User-Agent': req.headers['user-agent'] || 'Happ/2.7.0',
      'x-hwid': sha256(user.sub_url).slice(0, 32),
    },
  });
  if (!upstream.ok) {
    return res.status(502).json({ error: 'upstream_error', status: upstream.status });
  }

  const body = await upstream.text();
  const headers = {
    'subscription-userinfo': upstream.headers.get('subscription-userinfo') || '',
    'profile-title': upstream.headers.get('profile-title') || `${user.email}`,
    'profile-update-interval': '24',
    'support-url': 'https://t.me/AriyVPN_Bot',
    'profile-web-page-url': 'https://cabinet.example.com',
    'content-type': upstream.headers.get('content-type') || 'text/plain',
  };
  subCache.set(user.id, { body, headers, at: Date.now() });
  res.set(headers).send(body);
});
```

## Что нужно сделать на стороне Telegram (v0.2.x)

Для Telegram deep-link логина (3-я кнопка в Welcome.tsx, сейчас pending):

1. `POST /v1/auth/telegram/request` (уже есть для расширения) — возвращает
   `{request_token, deep_link: "tg://resolve?domain=AriyVPN_Bot&start=webauth_<token>"}`
2. `POST /v1/auth/telegram/poll {request_token}` (уже есть) — клиент пуллит
   раз в 3 сек. Возвращает `{status: 'pending'}` или
   `{status: 'linked', session_token, user}`.

Десктоп frontend для этого ещё не написан, но архитектура та же: после
`status:'linked'` → `setSessionToken + buildSubUrl + fetchSubscription`.

## Тестирование

Когда `/v1/sub/:token` задеплоится:

1. `npm run tauri dev` (либо собранный installer)
2. Откроется Welcome → ввести email + password от реального аккаунта Ariy
3. Сразу после login клиент должен скачать подписку (Rust subscription.rs
   парсер) и показать main UI со списком серверов
4. Подключение к выбранному серверу должно работать через sing-box или Mihomo

## Релевантные файлы

- `src/lib/ariy-api.ts:88-110` — `buildSubUrl(sessionToken)` функция
- `src/components/Welcome.tsx:69-78` — wire-up после успешного логина
- `src/stores/authStore.ts` — persistence в `localStorage` под ключом `ariy.auth`
