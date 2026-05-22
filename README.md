# Ariy VPN — Desktop

> **Be fast. Be stealthy. Be free.**
>
> Божественный VPN-клиент для Windows на сакральной связке sing-box и Mihomo.
> Один клик — и трафик возносится в эфир, минуя DPI, утечки и локальный детект.

[![release](https://img.shields.io/github/v/release/MeinCain/ariy-vpn-desktop?include_prereleases&label=release)](https://github.com/MeinCain/ariy-vpn-desktop/releases)
[![tauri](https://img.shields.io/badge/tauri-2-blue)](https://v2.tauri.app/)
[![sing-box](https://img.shields.io/badge/sing--box-1.13-brightgreen)](https://github.com/SagerNet/sing-box)
[![mihomo](https://img.shields.io/badge/mihomo-1.19-orange)](https://github.com/MetaCubeX/mihomo)
[![license: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## Откровение: что это и зачем я это сделал

Я собрал **священный десктопный клиент сервиса [Ariy VPN](https://example.com/)**
под Windows. Если вы — подписчик нашего сервиса, снизойдите на страницу
[Releases](https://github.com/MeinCain/ariy-vpn-desktop/releases), заберите
свежий installer, запустите, войдите через Telegram или email — подписка
сама явится во всей славе. Никаких ссылок копировать не надо.

Если вы **не наш подписчик** — мой installer не подойдёт: я сакрально
привязал его к `api.example.com` (обряд аутентификации) и
`cabinet.example.com` (личный храм пользователя). Но проект под MIT —
вы можете форкнуть исходники и собрать **свой божественный клиент** для
своего VPN-сервиса (см. раздел
[«Как воздвигнуть свой собственный храм»](#как-воздвигнуть-свой-собственный-храм)
ниже).

Я форкнул замечательный клиент
[Nemefisto](https://github.com/kanabicks/NemefistoAPP) от
[kanabicks](https://github.com/kanabicks). Архитектура (Tauri 2 +
sing-box/Mihomo + helper-сервис под SYSTEM, kill-switch на WFP,
server-driven UX) — его благословение. Я низко кланяюсь автору и
обвенчал его благодать с auth-инфраструктурой моего Ariy VPN.

---

## Дары и чудеса (что умеет)

### Движки сокрытия

**Переключаются без переустановки**, выбор в Settings → движок:

- **sing-box 1.13** (default) — мгновенное пробуждение (~1.4с), built-in
  TUN через WinTUN с auto-route, нативный обряд anti-DPI. Принимает
  следующие подношения: vless+REALITY/Vision, vmess, trojan, ss,
  hysteria2, TUIC, wireguard.
- **Mihomo (Clash Meta) 1.19** — призывается для AnyTLS, Mieru, XHTTP
  transport, per-process routing через нативный `PROCESS-NAME` matcher.

### Обряды посвящения (авторизация Ariy)

Три святых пути войти в свет:

1. **Telegram deep-link** — кнопка «Войти через Telegram», открывается
   бот, ты подтверждаешь там своё имя, клиент принимает `session_token`
   (срок благодати — 30 дней скользящего sliding).
2. **Email / password** — для тех, чьё имя не записано в Telegram.
3. **Прямая ссылка подписки** — древний legacy-путь, оставлен из
   уважения к предкам.

После любого из этих обрядов клиент сам берёт sub_url через
`GET /v1/auth/me` и являет тебе список серверов.

### Режимы перенесения трафика

- **TUN** (default) — весь системный трафик возносится через
  WinTUN-адаптер. Built-in TUN у обоих движков, никаких сторонних
  tun2socks-посредников.
- **Системный прокси** — быстрый обряд, один SOCKS5/HTTP inbound на
  loopback с **рандомизированным портом** в священном диапазоне
  `[30000, 60000)`.
- **LAN** — inbound доступен прочим устройствам в твоей вай-фай пастве.

### Святые щиты (защита и приватность)

- **Kill-switch** через Windows Filtering Platform (WFP) — фильтры на
  уровне ядра, недоступные смертным процессам. DYNAMIC session: если
  процесс отошёл в иной мир, фильтры снимаются сами.
- **DNS leak protection** — запечатывание всех `:53/UDP+TCP` тропок
  кроме сакральной VPN-DNS.
- **WebRTC / DNS / IPv6 leak-test** через Cloudflare cdn-trace + ipwho.is
  + DoH whoami — троекратное освидетельствование.
- **Маскировка имени TUN** — `wlan99` / `Local Area Connection N` /
  `Ethernet N` (защита от детекта VPN по `GetAdaptersAddresses`, чтобы
  ничьё око не углядело сокровенного).
- **SOCKS5 inbound auth** для TUN/LAN — никто не пройдёт без слова.
- **Auto-update подписан** ed25519 (Tauri signing) — обновления
  приходят без переустановки, благословлённые криптографией.
- **Ноль телеметрии** — никаких аналитических метрик, никаких
  crash-репортов «домой». Логи остаются у тебя, ибо твоё — это твоё.

### Облик и убранство (UI)

- 🌐 RU/EN с авто-детектом наречия
- 🎨 Brand-blue (Tailwind blue-500 `#3b82f6`) — синь под фирстиль example.com
- 🔌 System tray + Floating window — клиент являет себя двумя ликами
- 📡 Bandwidth-метр в реальном времени — пульс возносимого трафика
- 🛜 SSID auto-mode — VPN призывается в чужих Wi-Fi, отступает в доверенных
- 🪟 **Kill-on-close**: X на главном окне = полный исход с отключением
  VPN и очисткой WFP/TUN. Никаких неприкаянных orphan-душ.

---

## Что требуется от паломника (системные требования)

- **Windows 10** 1909+ или **Windows 11**
- **WebView2** (приходит автоматически)
- **Admin-права один раз** — на установку helper-сервиса (управление
  WinTUN и WFP). Дальше helper служит как SYSTEM, app — как обычный
  смертный пользователь.

---

## Как принять дар (для подписчиков Ariy VPN)

Свежий installer:
[Releases](https://github.com/MeinCain/ariy-vpn-desktop/releases).
Скачай `Ariy VPN_<version>_x64-setup.exe`, запусти.

> **SmartScreen вопиёт «Unknown publisher»** — это нормально, мы пока
> без EV code-signing сертификата (сей дорогостоящий обряд ещё не
> совершён). Жми «More info» → «Run anyway» и иди дальше.

После установки обновления нисходят автоматически через Tauri
auto-updater (ed25519-подпись, защита от MITM-демонов): проверка раз в
6 часов, при найденной новой версии — модалка «снизошло обновление
v X.Y.Z [release notes →]», installer ставится поверх в `passive` mode
без участия юзера. Воистину, ничто не отвлечёт тебя от созерцания.

---

## Как воздвигнуть свой собственный храм

Полный гайд: как форкнуть и собрать клиент **для своего** VPN-сервиса.
Заменяешь 4 файла под свои домены/имена, собираешь installer — готово,
у тебя свой божественный клиент.

### Шаг 1. Сотвори форк

```bash
gh repo fork MeinCain/ariy-vpn-desktop --clone --remote
cd ariy-vpn-desktop
```

Или через GitHub UI: кнопка «Fork» → клонируй.

### Шаг 2. Перенаправь обряды на свой auth-api

Открой [src/lib/ariy-api.ts](src/lib/ariy-api.ts) и поменяй константу:

```typescript
// Было:
const API_BASE = "https://api.example.com";
// Стало (под твой домен):
const API_BASE = "https://api.example.com";
```

Твой auth-api должен реализовать те же сакральные endpoint'ы:
- `POST /v1/auth/email/login` — body `{email, password}` → `{session_token}`
- `POST /v1/auth/telegram/start` — body `{}` → `{state, login_url, expires_in}`
- `GET /v1/auth/telegram/poll?state=...` — HTTP 202 pending / 200+body done / 410 expired
- `GET /v1/auth/me` — header `Authorization: Bearer <token>` → `{telegram_id, email, sub_url}`
- `POST /v1/auth/logout` — header `Authorization: Bearer <token>`

Готовая реализация в Node.js + Express ждёт тебя в нашем deploy-репо как
референс (там же helper для Remnawave/Marzban-подписок).

### Шаг 3. Подмени внешние знамения

Открой [src/lib/constants.ts](src/lib/constants.ts):

```typescript
export const DASHBOARD_URL = "https://cabinet.example.com";       // твой храм пользователя
export const SUPPORT_URL   = "https://t.me/your_support_bot";     // твой ангел поддержки
export const GITHUB_URL    = "https://github.com/your-org/your-fork";
```

### Шаг 4. Дай форку своё имя (изоляция системных идентификаторов)

Чтобы твой форк **не схлестнулся** с Ariy VPN (если оба обитают на
одной машине), перепиши уникальные системные идентификаторы — у каждого
форка должно быть своё имя в пантеоне:

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
      "pubkey": "<твой minisign публичный ключ>"
    }
  }
}
```

**[src-tauri/src/bin/ariy_helper/wfp.rs](src-tauri/src/bin/ariy_helper/wfp.rs)** — сгенерируй свой v4-uuid и впиши:
```rust
// Сгенерируй свежий v4-uuid (каждый храм имеет уникальный знак):
//   powershell:  [guid]::NewGuid()
//   linux:       uuidgen -r
pub const ARIY_PROVIDER_GUID: GUID = GUID {
    data1: 0xb7c1_dc3c,  // <- замени на свои hex-числа
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

### Шаг 5. Сотвори собственный signing keypair для auto-updater'а

```bash
npx -p @tauri-apps/cli@2 tauri signer generate -w your-updater.key -p '<strong-password>' --ci
```

Public key вставь в `tauri.conf.json` → `updater.pubkey`.
**Private key храни в священном месте** — без него обновления у твоих
адептов не пройдут sig-check, и они останутся в неведении.

### Шаг 6. Замени иконы

Положи свой логотип в `src-tauri/icons/source-logo.png` (квадратный PNG,
рекомендуем 1024×1024) и сгенерируй все Tauri-форматы:

```bash
npx -p @tauri-apps/cli@2 tauri icon src-tauri/icons/source-logo.png
```

Также положи 256×256 версию в `public/logo.png` — она является адепту
на Welcome-экране и в favicon.

### Шаг 7. Сотвори installer

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

Первая сборка займёт ~10-15 минут (cargo призывает ~300 crates со всех
концов света). Последующие — ~3 минуты, ибо ничто уже не ново под луной.

### Шаг 8. Откровение миру (публикация через GitHub Releases)

CI workflow в [.github/workflows/release.yml](.github/workflows/release.yml)
автоматически собирает + подписывает + является миру при push'е тега
`v*.*.*`. Secrets для CI:

- `TAURI_SIGNING_PRIVATE_KEY` — содержимое `your-updater.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — пароль ключа

Для auto-updater'а к каждому Release нужно приложить файл `latest.json`
— это завет о том, что версия снизошла:

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

## Внутреннее устройство храма (архитектура)

```
/
├── src/                   # React 19 + TypeScript + Tailwind v4 — лик клиента
│   ├── components/        # Welcome, ServerSelector, SettingsPage, ...
│   ├── stores/            # Zustand: vpn / subscription / settings / auth
│   ├── lib/
│   │   ├── ariy-api.ts    # HTTP-обряд с api.example.com (замени под себя)
│   │   └── constants.ts   # DASHBOARD_URL / SUPPORT_URL / GITHUB_URL
│   └── locales/{ru,en}/   # i18n-наречия
├── src-tauri/             # Rust 2021 — алтарь
│   ├── src/
│   │   ├── bin/ariy_helper/  # SYSTEM-служитель: WFP / TUN / sing-box / mihomo
│   │   ├── config/        # Парсинг подписок, sing-box-конфиги
│   │   ├── platform/      # Windows-специфичный код
│   │   └── ipc/           # Tauri commands
│   └── binaries/          # sing-box.exe, mihomo.exe, wintun.dll, geo*.dat
└── .github/workflows/     # Auto-build NSIS на push tag v*.*.*
```

**State-машина коннекта (путь души)**: Idle → Warming → Ready →
Connecting → Connected → Ready.

**Helper-служитель** (`ariy-helper.exe`) восходит с правами SYSTEM
через Windows Service Control Manager и беседует с user-mode-клиентом
через named pipe `\\.\pipe\ariy-helper`. Заведует WFP-фильтрами
kill-switch, призывает sing-box/mihomo для built-in TUN, выметает
orphan-сущности из храма.

**Deep-link scheme**: `ariy://` — клиент откликается на зов бота
(подключение / добавление подписки / переключение тоннеля). При форке
помолись по своему scheme'у (см. шаг 4).

---

## Лицензия

[MIT](LICENSE) — оригинальный завет от Nemefisto сохранён нетронутым.

## Поклоны и благодарности

- **[kanabicks/NemefistoAPP](https://github.com/kanabicks/NemefistoAPP)** —
  upstream-проект, на котором покоится сей храм. Низкий поклон автору.
- [SagerNet/sing-box](https://github.com/SagerNet/sing-box) — основной движок сокрытия
- [MetaCubeX/mihomo](https://github.com/MetaCubeX/mihomo) — второй движок-собрат
- [WireGuard wintun](https://www.wintun.net/) — драйвер TUN-адаптера, эфирный мост
- [Loyalsoldier/v2ray-rules-dat](https://github.com/Loyalsoldier/v2ray-rules-dat) — geosite / geoip, карта мира
- [Tauri](https://v2.tauri.app/) — фреймворк, скрепляющий все слои в единый храм
