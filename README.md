# Ariy VPN — Desktop

> **Be fast. Be stealthy. Be free.**
>
> Десктопный VPN-клиент для Windows на базе sing-box и Mihomo.
> Подключение в один клик, защита от DPI, утечек и локального детекта.

[![release](https://img.shields.io/github/v/release/MeinCain/ariy-vpn-desktop?include_prereleases&label=release)](https://github.com/MeinCain/ariy-vpn-desktop/releases)
[![tauri](https://img.shields.io/badge/tauri-2-blue)](https://v2.tauri.app/)
[![sing-box](https://img.shields.io/badge/sing--box-1.13-brightgreen)](https://github.com/SagerNet/sing-box)
[![mihomo](https://img.shields.io/badge/mihomo-1.19-orange)](https://github.com/MetaCubeX/mihomo)
[![license: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## Что это и для кого

Это **приватный клиент сервиса [Ariy VPN](https://example.com/)** для
Windows. Если вы наш подписчик — скачайте свежий installer на странице
[Releases](https://github.com/MeinCain/ariy-vpn-desktop/releases),
запустите, войдите по Telegram или email — ваша подписка подтянется
автоматически. Никаких ссылок копировать не надо.

Если вы **не наш подписчик** — этот installer вам не подойдёт: он
жёстко зашит на `api.example.com` (auth) и `cabinet.example.com`
(личный кабинет). Но проект **MIT-лицензированный** — вы можете
форкнуть и собрать **свой** клиент для вашего VPN-сервиса (см.
раздел [«Как сделать такой же для себя»](#как-сделать-такой-же-для-себя)
ниже).

Это **божественный форк** замечательного клиента
[Nemefisto](https://github.com/kanabicks/NemefistoAPP) от
[kanabicks](https://github.com/kanabicks). Архитектура (Tauri 2 +
sing-box/Mihomo + helper-сервис под SYSTEM, kill-switch на WFP,
server-driven UX) — его. Низкий поклон автору. Мы взяли это
благословение и интегрировали с auth-инфраструктурой Ariy VPN.

---

## Что умеет

### VPN-движки

**Можно переключаться без переустановки**, выбор в Settings → движок:

- **sing-box 1.13** (default) — быстрый старт (~1.4с), built-in TUN
  через WinTUN с auto-route, нативный anti-DPI. Поддерживает:
  vless+REALITY/Vision, vmess, trojan, ss, hysteria2, TUIC, wireguard.
- **Mihomo (Clash Meta) 1.19** — нужен для AnyTLS, Mieru, XHTTP
  transport, per-process routing через нативный `PROCESS-NAME` matcher.

### Авторизация (фишка Ariy)

Три способа войти:

1. **Telegram deep-link** — кнопка «Войти через Telegram», открывается
   бот, юзер подтверждает в боте, клиент получает `session_token` (TTL 30
   дней sliding).
2. **Email / password** — для тех у кого нет Telegram, или для CI.
3. **Прямая ссылка подписки** — legacy fallback.

После любого из этих способов клиент автоматически получает sub_url
через `GET /v1/auth/me` и подгружает список серверов.

### Режимы подключения

- **TUN** (default) — весь системный трафик через WinTUN-адаптер.
  Built-in TUN у обоих движков (нет сторонних tun2socks).
- **Системный прокси** — быстрый старт, один SOCKS5/HTTP inbound
  на loopback с **рандомизированным портом** в `[30000, 60000)`.
- **LAN** — inbound доступен другим устройствам в Wi-Fi сети.

### Защита и приватность

- **Kill-switch** через Windows Filtering Platform (WFP) — фильтры
  на уровне ядра. DYNAMIC session: если процесс упал, фильтры
  снимаются автоматически.
- **DNS leak protection** — блок всего `:53/UDP+TCP` кроме VPN-DNS.
- **WebRTC / DNS / IPv6 leak-test** через Cloudflare cdn-trace +
  ipwho.is + DoH whoami.
- **Маскировка имени TUN** — `wlan99` / `Local Area Connection N` /
  `Ethernet N` (защита от детекта VPN по `GetAdaptersAddresses`).
- **SOCKS5 inbound auth** для TUN/LAN-режимов.
- **Auto-update подписан** ed25519 (Tauri signing) — обновления
  приходят без переустановки.
- **Ноль телеметрии** — никаких аналитических метрик, никаких
  crash-репортов «домой». Логи остаются на машине.

### UI

- 🌐 RU/EN с авто-детектом
- 🎨 Brand-blue (Tailwind blue-500 `#3b82f6`) под фирстиль example.com
- 🔌 System tray + Floating window
- 📡 Bandwidth-метр в реальном времени
- 🛜 SSID auto-mode — VPN включается в чужих Wi-Fi, отключается в доверенных
- 🪟 **Kill-on-close**: X на главном окне = полный выход с отключением
  VPN и очисткой WFP/TUN. Никаких orphan'ов.

---

## Системные требования

- **Windows 10** 1909+ или **Windows 11**
- **WebView2** (ставится автоматически)
- **Admin-права один раз** для установки helper-сервиса (управление
  WinTUN и WFP). Дальше helper работает как SYSTEM-service, app — как
  обычный пользователь.

---

## Скачать (для подписчиков Ariy VPN)

Свежий installer:
[Releases](https://github.com/MeinCain/ariy-vpn-desktop/releases).
Скачай `Ariy VPN_<version>_x64-setup.exe`, запусти.

> **SmartScreen ругается «Unknown publisher»** — это нормально, мы
> пока без EV code-signing сертификата. Жми «More info» → «Run anyway».

После установки обновления приходят автоматически через Tauri
auto-updater (ed25519-подпись, защита от MITM): проверка раз в 6
часов, при найденной новой версии — модалка «доступна v X.Y.Z
[release notes →]», installer ставится поверх в `passive` mode без
участия юзера.

---

## Как сделать такой же для себя

Полный гайд для своего VPN-сервиса. Заменяете 4 файла под свои домены/имена,
собираете installer — готово.

### Шаг 1. Форкните репо

```bash
gh repo fork MeinCain/ariy-vpn-desktop --clone --remote
cd ariy-vpn-desktop
```

Или через GitHub UI: кнопка «Fork» → клонируйте.

### Шаг 2. Подмените backend-endpoint'ы под свой auth-api

Откройте [src/lib/ariy-api.ts](src/lib/ariy-api.ts) и поменяйте константу:

```typescript
// Было:
const API_BASE = "https://api.example.com";
// Стало (под ваш домен):
const API_BASE = "https://api.example.com";
```

Ваш auth-api должен реализовать те же endpoint'ы:
- `POST /v1/auth/email/login` — body `{email, password}` → `{session_token}`
- `POST /v1/auth/telegram/start` — body `{}` → `{state, login_url, expires_in}`
- `GET /v1/auth/telegram/poll?state=...` — HTTP 202 pending / 200+body done / 410 expired
- `GET /v1/auth/me` — header `Authorization: Bearer <token>` → `{telegram_id, email, sub_url}`
- `POST /v1/auth/logout` — header `Authorization: Bearer <token>`

Готовая реализация в Node.js + Express лежит в нашем deploy-репо как
референс (там же helper для Remnawave/Marzban-подписок).

### Шаг 3. Подмените внешние ссылки

Откройте [src/lib/constants.ts](src/lib/constants.ts):

```typescript
export const DASHBOARD_URL = "https://cabinet.example.com";       // ваш кабинет
export const SUPPORT_URL   = "https://t.me/your_support_bot";     // ваш бот поддержки
export const GITHUB_URL    = "https://github.com/your-org/your-fork";
```

### Шаг 4. Переименуйте идентификаторы под свой бренд

Чтобы ваш форк **не конфликтовал** с Ariy VPN (если оба установлены
на одной машине), поменяйте уникальные системные идентификаторы:

**[src-tauri/tauri.conf.json](src-tauri/tauri.conf.json):**
```json
{
  "productName": "Your VPN",
  "identifier": "com.example.desktop",
  "plugins": {
    "deep-link": {
      "desktop": { "schemes": ["yourvpn"] }
    },
    "updater": {
      "endpoints": [
        "https://github.com/your-org/your-fork/releases/latest/download/latest.json"
      ],
      "pubkey": "<ваш minisign публичный ключ>"
    }
  }
}
```

**[src-tauri/src/bin/ariy_helper/wfp.rs](src-tauri/src/bin/ariy_helper/wfp.rs)** — сгенерируйте свой v4-uuid и подставьте:
```rust
// Сгенерируйте свежий v4-uuid:
//   powershell:  [guid]::NewGuid()
//   linux:       uuidgen -r
pub const ARIY_PROVIDER_GUID: GUID = GUID {
    data1: 0xb7c1_dc3c,  // <- замените на свои hex-числа
    data2: 0x26dc,
    data3: 0x4351,
    data4: [0xbb, 0x6f, 0xca, 0x2b, 0x9b, 0x7a, 0xf6, 0x45],
};
```

Аналогично `ARIY_SUBLAYER_GUID` ниже.

**Глобальный поиск-замена** в Rust-коде:

```bash
# В Windows PowerShell:
node -e "const fs=require('fs');const path=require('path');function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.rs')){let t=fs.readFileSync(p,'utf8');const orig=t;t=t.replace(/ariy-/g,'yourvpn-').replace(/AriyHelper/g,'YourVpnHelper').replace(/ariy_helper/g,'yourvpn_helper');if(t!==orig){fs.writeFileSync(p,t,'utf8');console.log('updated',p);}}}}walk('src-tauri/src');"
```

### Шаг 5. Сгенерируйте свой signing keypair для auto-updater'а

```bash
npx -p @tauri-apps/cli@2 tauri signer generate -w your-updater.key -p '<strong-password>' --ci
```

Public key вставьте в `tauri.conf.json` → `updater.pubkey`.
**Private key храните в безопасном месте** — без него обновления у
юзеров не пройдут sig-check.

### Шаг 6. Замените иконки

Положите свой логотип в `src-tauri/icons/source-logo.png` (квадратный
PNG, рекомендуем 1024×1024) и сгенерируйте все Tauri-форматы:

```bash
npx -p @tauri-apps/cli@2 tauri icon src-tauri/icons/source-logo.png
```

Также положите 256×256 версию в `public/logo.png` (она используется
в Welcome-экране и favicon).

### Шаг 7. Соберите installer

Требуется **Node.js 22+**, **Rust stable** и **MSVC Build Tools 2022**
(C++ workload).

```powershell
# Установите signing key через env
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content your-updater.key -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = '<your-password>'

npm ci
npm run tauri:bundle

# Готовый installer:
# src-tauri/target/release/bundle/nsis/Your VPN_X.Y.Z_x64-setup.exe
```

Первая сборка займёт ~10-15 минут (cargo скачает ~300 crates).
Последующие — ~3 минуты.

### Шаг 8. Публикация через GitHub Releases

CI workflow в [.github/workflows/release.yml](.github/workflows/release.yml)
автоматически собирает + подписывает + публикует при push'е тега `v*.*.*`.
Secrets для CI:

- `TAURI_SIGNING_PRIVATE_KEY` — содержимое `your-updater.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — пароль ключа

Для auto-updater'а к каждому Release нужно приложить файл `latest.json`:

```json
{
  "version": "X.Y.Z",
  "notes": "release notes",
  "pub_date": "2026-05-20T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<содержимое .sig файла>",
      "url": "https://github.com/your-org/your-fork/releases/download/vX.Y.Z/Your_VPN_X.Y.Z_x64-setup.exe"
    }
  }
}
```

Готовый скрипт генерации `latest.json` см. в
[scripts/build-latest-json.mjs](scripts/build-latest-json.mjs).

---

## Архитектура

```
/
├── src/                   # React 19 + TypeScript + Tailwind v4
│   ├── components/        # Welcome, ServerSelector, SettingsPage, ...
│   ├── stores/            # Zustand: vpn / subscription / settings / auth
│   ├── lib/
│   │   ├── ariy-api.ts    # HTTP клиент к api.example.com (замените под себя)
│   │   └── constants.ts   # DASHBOARD_URL / SUPPORT_URL / GITHUB_URL
│   └── locales/{ru,en}/   # i18n переводы
├── src-tauri/             # Rust 2021
│   ├── src/
│   │   ├── bin/ariy_helper/  # SYSTEM-service: WFP / TUN / sing-box / mihomo
│   │   ├── config/        # Парсинг подписок, sing-box-конфиги
│   │   ├── platform/      # Windows-специфичный код
│   │   └── ipc/           # Tauri commands
│   └── binaries/          # sing-box.exe, mihomo.exe, wintun.dll, geo*.dat
└── .github/workflows/     # Auto-build NSIS на push tag v*.*.*
```

**State machine коннекта**: Idle → Warming → Ready → Connecting →
Connected → Ready.

**Helper-сервис** (`ariy-helper.exe`) запускается с правами SYSTEM
через Windows Service Control Manager и общается с user-mode
приложением через named pipe `\\.\pipe\ariy-helper`. Управляет
WFP-фильтрами kill-switch, спавнит sing-box/mihomo для built-in TUN,
чистит orphan-ресурсы.

**Deep-link scheme**: `ariy://` — клиент реагирует на ссылки от бота
(подключение / добавление подписки / переключение тоннеля). При форке
поменяйте на свой scheme (см. шаг 4).

---

## Лицензия

[MIT](LICENSE) — оригинальная лицензия от Nemefisto сохранена.

## Благодарности

- **[kanabicks/NemefistoAPP](https://github.com/kanabicks/NemefistoAPP)** —
  upstream-проект, на котором всё стоит. Низкий поклон автору.
- [SagerNet/sing-box](https://github.com/SagerNet/sing-box) — основной VPN-движок
- [MetaCubeX/mihomo](https://github.com/MetaCubeX/mihomo) — второй движок
- [WireGuard wintun](https://www.wintun.net/) — driver для TUN-адаптера
- [Loyalsoldier/v2ray-rules-dat](https://github.com/Loyalsoldier/v2ray-rules-dat) — geosite / geoip
- [Tauri](https://v2.tauri.app/) — фреймворк app
