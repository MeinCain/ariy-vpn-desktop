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

## Что это

**Ariy VPN Desktop** — нативный Windows-клиент для VPN-подписок Ariy.
Работает напрямую с VLESS+Reality (без HTTPS-прокси-обёртки, которая
нужна нашему Chrome-расширению), поддерживает kill-switch на уровне
ядра Windows, защиту от DNS/WebRTC/IPv6 утечек и authentication через
Telegram, email или ссылку подписки.

> Этот проект — **форк замечательного клиента
> [Nemefisto](https://github.com/kanabicks/NemefistoAPP)** от
> [kanabicks](https://github.com/kanabicks). Архитектура (Tauri 2 +
> sing-box/Mihomo + helper-сервис под SYSTEM) — его заслуга, низкий
> поклон. Мы добавили интеграцию с собственной auth-инфраструктурой
> Ariy (Telegram deep-link, email/password, sub-URL) и переделали UI
> под наш бренд. Оригинальный Nemefisto — отличная универсальная
> платформа, и его исходники остаются доступны по ссылке выше.

---

## Скачать

Свежий релиз — на странице
[Releases](https://github.com/MeinCain/ariy-vpn-desktop/releases).
Скачай `Ariy VPN_<version>_x64-setup.exe`, запусти, дальше installer
сделает всё сам.

> **SmartScreen ругается «Unknown publisher»** — это нормально, мы
> пока без EV code-signing сертификата. Жми «More info» → «Run
> anyway». Установленный клиент сам обновляется на следующие версии
> через Tauri auto-updater (ed25519-подпись, защита от MITM).

После первой установки **обновления приходят автоматически**: проверка
раз в 6 часов, при найденной новой версии — модалка
«доступна v X.Y.Z [release notes →]».

---

## Что умеет

### VPN-движки

**Можно переключаться без переустановки**, выбор в Settings → движок:

- **sing-box 1.13** (default) — быстрый старт (~1.4с), built-in TUN
  через WinTUN с auto-route, нативный anti-DPI (`tls.fragment` +
  DoH-bootstrap server-resolve). Поддерживает: vless+REALITY/Vision,
  vmess, trojan, ss, hysteria2, TUIC, wireguard.
- **Mihomo (Clash Meta) 1.19** — нужен для AnyTLS, Mieru, XHTTP
  transport, и per-process routing через нативный `PROCESS-NAME` matcher.

### Авторизация (фишка Ariy)

Три способа войти, как и в нашем Chrome-расширении:

1. **Telegram deep-link** — кнопка «Войти через Telegram», открывается
   `t.me/AriyVPN_Bot`, юзер подтверждает в боте, клиент получает
   `session_token` (TTL 30 дней, sliding).
2. **Email / password** — для тех у кого нет Telegram, или для CI.
3. **Sub-URL** — legacy, если у тебя есть прямая подписка.

После логина клиент автоматически получает текущий список нод и
обновляет его раз в день. Все эндпоинты на `api.example.com`.

### Режимы подключения

- **Системный прокси** — быстрый старт, один SOCKS5/HTTP inbound
  на loopback с **рандомизированным портом** в `[30000, 60000)`
  (защита от локального детекта VPN сторонними процессами).
- **TUN** — весь системный трафик через WinTUN-адаптер. Built-in TUN
  у обоих движков (нет сторонних tun2socks).
- **LAN** — inbound доступен другим устройствам в Wi-Fi сети
  (с автогенерируемым SOCKS5 user/pass).

### Защита и приватность

- **Kill-switch** через Windows Filtering Platform (WFP) — фильтры
  на уровне ядра. DYNAMIC session: если процесс упал, фильтры
  снимаются автоматически.
- **DNS leak protection** — блок всего `:53/UDP+TCP` кроме VPN-DNS.
- **WebRTC / DNS / IPv6 leak-test** через Cloudflare cdn-trace +
  ipwho.is + DoH whoami — авто после connect или вручную.
- **Маскировка имени TUN** — `wlan99` / `Local Area Connection N` /
  `Ethernet N` (защита от детекта VPN по `GetAdaptersAddresses`).
- **SOCKS5 inbound auth** для TUN/LAN-режимов.
- **Auto-update подписан** ed25519 (Tauri signing).
- **Ноль телеметрии** — никаких аналитических метрик, никаких
  crash-репортов «домой». Логи остаются на твоей машине.

### Anti-DPI

- TCP-фрагментация TLS ClientHello (`tls.fragment`)
- UDP шумовые пакеты
- Server-address-resolve через DoH (минуя системный DNS)
- Hysteria2 obfs salamander

### UI / UX

- 🌐 **Двуязычный интерфейс** (RU / EN) с авто-детектом по
  `navigator.language` или вручную в Settings.
- 🎨 **5 тем** (dark / light / midnight / sunset / sand) + **5
  пресетов** (fluent / cupertino / vice / arcade / glacier).
- 🖼 **3D-фон** (4 сцены: crystal / tunnel / globe / particles).
- 🎯 **Drag-and-drop URL подписки** в окно.
- ⌨ **Глобальные горячие клавиши** (`Ctrl+Shift+V` toggle).
- 🪟 **Floating window** — мини-окошко поверх всего со status-dot
  и live-скоростью ↑/↓.
- 🔌 **System tray** с быстрым connect/disconnect.
- 📡 **Bandwidth-метр** в реальном времени.
- 🛜 **SSID auto-mode** — VPN автоматически отключается в доверенных
  Wi-Fi (домашний роутер) и включается в чужих.

---

## Системные требования

- **Windows 10** 1909+ или **Windows 11**
- **WebView2** (ставится автоматически если нет)
- **Admin-права один раз** для установки helper-сервиса (управление
  WinTUN и WFP). После установки helper работает как SYSTEM-service,
  app сам — как обычный пользователь.

---

## Сборка из исходников

```powershell
# Требуется Node.js 22+ и Rust stable.
git clone https://github.com/MeinCain/ariy-vpn-desktop.git
cd ariy-vpn-desktop
npm ci
npm run tauri:bundle
# Готовый installer: src-tauri/target/release/bundle/nsis/
```

Для разработки:

```powershell
npm run tauri dev
```

Helper-binary собирается автоматически через
`scripts/build-helper.mjs` (npm-pre-script `predev`).

---

## Архитектура

```
/
├── src/                   # React 19 + TypeScript + Tailwind v4
│   ├── components/        # Welcome, ServerSelector, SettingsPage, ...
│   ├── stores/            # Zustand: vpn / subscription / settings / toast / update
│   ├── lib/               # Утилиты, deep-links, leak-test, updater
│   ├── locales/{ru,en}/   # i18n переводы (react-i18next)
│   └── i18n.ts
├── src-tauri/             # Rust 2021
│   ├── src/
│   │   ├── vpn/           # State machine, sing-box, mihomo, leak-test
│   │   ├── config/        # Парсинг подписок, sing-box-конфиги, geofiles
│   │   ├── platform/      # Windows-специфичный код
│   │   ├── ipc/           # Tauri commands
│   │   └── bin/ariy_helper/  # SYSTEM-service: WFP / TUN / mihomo / sing-box
│   └── binaries/          # sing-box.exe, mihomo.exe, wintun.dll, geo*.dat
└── .github/workflows/     # Auto-build NSIS на push tag v*.*.*
```

**State machine коннекта**: Idle → Warming → Ready → Connecting →
Connected → Ready (после disconnect никогда не возвращаемся в Idle).

**Helper-сервис** (`ariy-helper.exe`) запускается с правами
SYSTEM через Windows Service Control Manager и общается с user-mode
приложением через named pipe `\\.\pipe\ariy-helper`. Управляет
WFP-фильтрами kill-switch, спавнит sing-box/mihomo для built-in TUN,
чистит orphan-ресурсы.

**Deep-link scheme**: `ariy://` — клиент реагирует на ссылки от
бота, открывающие подключение / добавление подписки / переключение
тоннеля. Полный список схем — в `Settings → URL-схемы`.

---

## Релизный workflow

Релизы выпускаются автоматически через GitHub Actions при push'е тега
`v*.*.*` в `main`. Релизные заметки на русском пишет автор PR'а —
без шаблонов, своими словами что сделано / что не вошло.

```powershell
# Bump версии в трёх файлах синхронно: package.json, Cargo.toml, tauri.conf.json
git tag v0.X.Y -m "v0.X.Y — описание"
git push origin main --follow-tags
# CI собирает, подписывает signing-key'ём из secrets, публикует.
# Юзеры получают auto-update в течение 6 часов.
```

---

## Roadmap

### Сделано
- ✅ Полный ребрендинг от Nemefisto → Ariy VPN
- ✅ Свой minisign signing-keypair для auto-updater
- ✅ Свой deep-link scheme `ariy://`
- ✅ Иконки Ariy (синяя «A» с орбитой) на все Tauri-форматы

### В работе
- ⏳ Интеграция с auth-api Ariy (Telegram deep-link, email, sub_url)
- ⏳ Тестовая сборка + smoke-test

### Запланировано
- 📌 Полная локализация под бренд (часть UI-текстов наследует upstream)
- 📌 Beta-канал релизов
- 📌 EV code signing — убирает SmartScreen warning
- 📌 macOS / Linux порты

---

## Лицензия

[MIT](LICENSE) — оригинальная лицензия от Nemefisto сохранена.
Делайте что хотите, включая форк и дистрибуцию.

## Благодарности

- **[kanabicks/NemefistoAPP](https://github.com/kanabicks/NemefistoAPP)** —
  upstream-проект, на котором всё стоит. Архитектура, kill-switch
  на WFP, sing-box+Mihomo two-engine pattern, server-driven UX через
  HTTP-заголовки подписки — всё его. Низкий поклон автору.
- [SagerNet/sing-box](https://github.com/SagerNet/sing-box) — основной VPN-движок
- [MetaCubeX/mihomo](https://github.com/MetaCubeX/mihomo) — второй движок (AnyTLS, Mieru)
- [WireGuard wintun](https://www.wintun.net/) — driver для TUN-адаптера
- [Loyalsoldier/v2ray-rules-dat](https://github.com/Loyalsoldier/v2ray-rules-dat) — geosite / geoip
- [Tauri](https://v2.tauri.app/) — фреймворк app
