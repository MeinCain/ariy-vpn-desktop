import { openUrl } from "@tauri-apps/plugin-opener";
import { DASHBOARD_URL, SUPPORT_URL } from "./constants";

/** Открыть личный кабинет Ariy VPN.
 *
 *  Ariy: ВСЕГДА открываем `cabinet.example.com` — это наш каноничный
 *  кабинет, привязанный к Telegram-аккаунту и email. Заголовок
 *  `profile-web-page-url` от Remnawave-подписки игнорируется (он
 *  приходит как `sub.example.com` — это внутренний sub-домен, не кабинет
 *  пользователя). */
export function openDashboard() {
  void openUrl(DASHBOARD_URL);
}

/** Кнопка «личный кабинет» в Ariy показывается всегда — у нас единый
 *  для всех юзеров кабинет cabinet.example.com. Hook оставлен как
 *  совместимая no-op заглушка на случай если кто-то его ещё импортирует. */
export function useHasDashboardUrl(): boolean {
  return true;
}

/** Открыть страницу поддержки Ariy VPN — наш бот @example_support_bot
 *  (`SUPPORT_URL` в constants.ts). Заголовок `support-url` от Remnawave
 *  игнорируется — у Ariy единый канал поддержки. */
export function openSupport() {
  void openUrl(SUPPORT_URL);
}
