# Ariy VPN — Desktop

> **Be fast. Be stealthy. Be free.**
>
> VPN-клиент для Windows на основе sing-box и Mihomo. Один клик — и трафик идёт через выбранный сервер, без DPI, утечек и локального детекта.

[![release](https://img.shields.io/github/v/release/MeinCain/ariy-vpn-desktop?include_prereleases&label=release)](https://github.com/MeinCain/ariy-vpn-desktop/releases)
[![tauri](https://img.shields.io/badge/tauri-2-blue)](https://v2.tauri.app/)
[![sing-box](https://img.shields.io/badge/sing--box-1.13-brightgreen)](https://github.com/SagerNet/sing-box)
[![mihomo](https://img.shields.io/badge/mihomo-1.19-orange)](https://github.com/MetaCubeX/mihomo)
[![license: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## О проекте

Клиент для Windows сервиса [Ariy VPN](https://example.com/). Подписчикам — открыть [Releases](https://github.com/MeinCain/ariy-vpn-desktop/releases), скачать installer, запустить, войти через Telegram или email. Подписка подтянется автоматически.

Если вы не подписчик Ariy VPN, этот installer не подойдёт: он работает только с `api.example.com` и `cabinet.example.com`. Проект под MIT-лицензией — форкните репозиторий и соберите свой клиент под свой VPN-сервис (см. [«Как форкнуть»](#как-форкнуть)).

Форк проекта [Nemefisto](https://github.com/kanabicks/NemefistoAPP) от [kanabicks](https://github.com/kanabicks). Архитектура (Tauri 2 + sing-box/Mihomo + helper-сервис под SYSTEM, kill-switch на WFP, server-driven UX) взята оттуда. К ней подключена auth-инфраструктура Ariy VPN.

---

## Возможности

### Движки

Переключаются без переустановки в Settings → движок:

- **sing-box 1.13** (default) — старт ~1.4с, встроенный TUN через WinTUN с auto-route, anti-DPI. Поддерживает vless+REALITY/Vision, vmess, trojan, ss, hysteria2, TUIC, wireguard.
- **Mihomo (Clash Meta) 1.19** — для AnyTLS, Mieru, XHTTP transport, per-process routing через `PROCESS-NAME`.

### Авторизация

Три способа входа:

1. **Telegram deep-link** — кнопка «Войти через Telegram», подтверждение в боте, клиент получает `session_token` (sliding 30 дней).
2. **Email / password** — для пользователей без привязки к Telegram.
3. **Прямая ссылка подписки** — legacy-вариант.

После авторизации клиент берёт sub_url через `GET /v1/auth/me` и показывает список серверов.

### Режимы туннелирования

- **TUN** (default) — весь системный трафик через WinTUN-адаптер. Встроенный TUN у обоих движков, без сторонних tun2socks.
- **Системный прокси** — SOCKS5/HTTP inbound на loopback с рандомизированным портом в диапазоне `[30000, 60000)`.
- **LAN** — inbound доступен другим устройствам в локальной сети.

### Защита

- **Kill-switch** через Windows Filtering Platform (WFP) — фильтры на уровне ядра. DYNAMIC session: если процесс завершился, фильтры снимаются сами.
- **DNS leak protection** — блокировка `:53/UDP+TCP` кроме VPN-DNS.
- **Leak-тесты** WebRTC / DNS / IPv6 через Cloudflare cdn-trace + ipwho.is + DoH whoami.
- **Маскировка имени TUN** — `wlan99` / `Local Area Connection N` / `Ethernet N` (защита от детекта VPN по `GetAdaptersAddresses`).
- **SOCKS5 inbound auth** для TUN/LAN.
- **Auto-update подписан** ed25519 (Tauri signing) — обновления без переустановки.
- **Без телеметрии** — никаких аналитических метрик и crash-репортов.

### UI

- 🌐 RU/EN с авто-детектом языка
- 🎨 Brand-blue (Tailwind blue-500 `#3b82f6`)
- 🔌 System tray + Floating window
- 📡 Bandwidth-метр в реальном времени
- 🛜 SSID auto-mode — VPN включается в незнакомых Wi-Fi, отключается в доверенных
- 🪟 **Kill-on-close**: закрытие главного окна = полное отключение VPN и очистка WFP/TUN

---

## Системные требования

- **Windows 10** 1909+ или **Windows 11**
- **WebView2** (устанавливается автоматически)
- **Admin-права один раз** — на установку helper-сервиса (управление WinTUN и WFP). После установки helper работает как SYSTEM-служба, само приложение — под обычным пользователем.

---

## Установка (для подписчиков Ariy VPN)

Свежий installer: [Releases](https://github.com/MeinCain/ariy-vpn-desktop/releases). Скачайте `Ariy VPN_<version>_x64-setup.exe` и запустите.

> **SmartScreen «Unknown publisher»** — это нормально, EV code-signing сертификата пока нет. Нажмите «More info» → «Run anyway».

После установки обновления приходят автоматически через Tauri auto-updater (ed25519-подпись): проверка раз в 6 часов, при найденной версии модалка с release notes, installer ставится поверх в `passive` mode.

---

## Как форкнуть

Полный гайд: как форкнуть и собрать клиент под свой VPN-сервис. Замена 4 файлов под свои домены/имена + сборка installer'а.

### Шаг 1. Форк

```bash
gh repo fork MeinCain/ariy-vpn-desktop --clone --remote
cd ariy-vpn-desktop
```

Или через GitHub UI.

### Шаг 2. Свой auth-api

Откройте [src/lib/ariy-api.ts](src/lib/ariy-api.ts) и поменяйте константу:

```typescript
// Было:
const API_BASE = "https://api.example.com";
// Стало (под свой домен):
const API_BASE = "https://api.example.com";
```

Ваш auth-api должен реализовать те же endpoint'ы:

- `POST /v1/auth/email/login` — body `{email, password}` → `{session_token}`
- `POST /v1/auth/telegram/start` — body `{}` → `{state, login_url, expires_in}`
- `GET /v1/auth/telegram/poll?state=...` — HTTP 202 pending / 200+body done / 410 expired
- `GET /v1/auth/me` — header `Authorization: Bearer <token>` → `{telegram_id, email, sub_url}`
- `POST /v1/auth/logout` — header `Authorization: Bearer <token>`

Готовая реализация на Node.js + Express доступна как референс (поддержка Remnawave/Marzban-подписок).

### Шаг 3. Внешние ссылки

Откройте [src/lib/constants.ts](src/lib/constants.ts):

```typescript
export const DASHBOARD_URL = "https://cabinet.example.com";
export const SUPPORT_URL   = "https://t.me/your_support_bot";
export const GITHUB_URL    = "https://github.com/your-org/your-fork";
```

### Шаг 4. Уникальные идентификаторы

Чтобы форк не конфликтовал с Ariy VPN на одной машине, замените системные идентификаторы.

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
      "pubkey": "<свой minisign public key>"
    }
  }
}
```

**[src-tauri/src/bin/ariy_helper/wfp.rs](src-tauri/src/bin/ariy_helper/wfp.rs)** — сгенерируйте свой v4-uuid и впишите:

```rust
// Сгенерируйте v4-uuid (каждый форк должен иметь уникальный GUID):
//   powershell:  [guid]::NewGuid()
//   linux:       uuidgen -r
pub const ARIY_PROVIDER_GUID: GUID = GUID {
    data1: 0xb7c1_dc3c,
    data2: 0x26dc,
    data3: 0x4351,
    data4: [0xbb, 0x6f, 0xca, 0x2b, 0x9b, 0x7a, 0xf6, 0x45],
};
```

Аналогично `ARIY_SUBLAYER_GUID` ниже.

Глобальный поиск-замена в Rust-коде:

```bash
node -e "const fs=require('fs');const path=require('path');function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.rs')){let t=fs.readFileSync(p,'utf8');const orig=t;t=t.replace(/ariy-/g,'yourvpn-').replace(/AriyHelper/g,'YourVpnHelper').replace(/ariy_helper/g,'yourvpn_helper');if(t!==orig){fs.writeFileSync(p,t,'utf8');console.log('updated',p);}}}}walk('src-tauri/src');"
```

### Шаг 5. Signing keypair для auto-updater

```bash
npx -p @tauri-apps/cli@2 tauri signer generate -w your-updater.key -p '<strong-password>' --ci
```

Public key — в `tauri.conf.json` → `updater.pubkey`. **Private key храните в безопасном месте** — без него подпись обновлений не пройдёт sig-check на стороне клиентов.

### Шаг 6. Иконки

Положите свой логотип в `src-tauri/icons/source-logo.png` (квадратный PNG 1024×1024) и сгенерируйте все форматы:

```bash
npx -p @tauri-apps/cli@2 tauri icon src-tauri/icons/source-logo.png
```

Также 256×256 версию положите в `public/logo.png` (Welcome-экран и favicon).

### Шаг 7. Сборка installer'а

Требуется **Node.js 22+**, **Rust stable** и **MSVC Build Tools 2022** (C++ workload).

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content your-updater.key -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = '<your-password>'

npm ci
npm run tauri:bundle

# Готовый installer:
# src-tauri/target/release/bundle/nsis/Your VPN_X.Y.Z_x64-setup.exe
```

Первая сборка ~10-15 минут (cargo тянет ~300 crates). Последующие ~3 минуты.

### Шаг 8. Публикация через GitHub Releases

CI workflow в [.github/workflows/release.yml](.github/workflows/release.yml) автоматически собирает + подписывает + публикует при push'е тега `v*.*.*`. Secrets для CI:

- `TAURI_SIGNING_PRIVATE_KEY` — содержимое `your-updater.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — пароль ключа

Для auto-updater'а к каждому Release нужен файл `latest.json`:

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

Готовый скрипт генерации `latest.json` — [scripts/build-latest-json.mjs](scripts/build-latest-json.mjs).

---

## Архитектура

```
/
├── src/                   # React 19 + TypeScript + Tailwind v4 — UI
│   ├── components/        # Welcome, ServerSelector, SettingsPage, ...
│   ├── stores/            # Zustand: vpn / subscription / settings / auth
│   ├── lib/
│   │   ├── ariy-api.ts    # HTTP-клиент к api.example.com (замените под себя)
│   │   └── constants.ts   # DASHBOARD_URL / SUPPORT_URL / GITHUB_URL
│   └── locales/{ru,en}/   # i18n
├── src-tauri/             # Rust 2021 — backend
│   ├── src/
│   │   ├── bin/ariy_helper/  # SYSTEM-служба: WFP / TUN / sing-box / mihomo
│   │   ├── config/        # Парсинг подписок, sing-box-конфиги
│   │   ├── platform/      # Windows-специфичный код
│   │   └── ipc/           # Tauri commands
│   └── binaries/          # sing-box.exe, mihomo.exe, wintun.dll, geo*.dat
└── .github/workflows/     # Auto-build NSIS на push tag v*.*.*
```

**State-машина коннекта**: Idle → Warming → Ready → Connecting → Connected → Ready.

**Helper-служба** (`ariy-helper.exe`) запускается с правами SYSTEM через Windows Service Control Manager и общается с user-mode-клиентом через named pipe `\\.\pipe\ariy-helper`. Управляет WFP-фильтрами kill-switch, запускает sing-box/mihomo для встроенного TUN, чистит orphan-ресурсы.

**Deep-link scheme**: `ariy://` — клиент откликается на ссылки из бота (подключение / добавление подписки / переключение тоннеля). При форке используйте свой scheme (см. шаг 4).

---

## Лицензия

[MIT](LICENSE) — лицензия Nemefisto сохранена без изменений.

## Благодарности

- **[kanabicks/NemefistoAPP](https://github.com/kanabicks/NemefistoAPP)** — upstream-проект.
- [SagerNet/sing-box](https://github.com/SagerNet/sing-box) — основной движок.
- [MetaCubeX/mihomo](https://github.com/MetaCubeX/mihomo) — второй движок.
- [WireGuard wintun](https://www.wintun.net/) — драйвер TUN-адаптера.
- [Loyalsoldier/v2ray-rules-dat](https://github.com/Loyalsoldier/v2ray-rules-dat) — geosite / geoip.
- [Tauri](https://v2.tauri.app/) — фреймворк.
