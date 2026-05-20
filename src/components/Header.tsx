import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { openSupport } from "../lib/openExternal";
import { useSubscriptionStore } from "../stores/subscriptionStore";
import { DASHBOARD_URL } from "../lib/constants";
import { SettingsIcon, SupportIcon } from "./icons";

/**
 * Шапка приложения: лого + ряд icon-кнопок справа:
 * [+ добавить sub] [🎁 подарок] [👤 кабинет] [✈ поддержка] [⚙ настройки].
 * UTC-часы и blink-точка убраны — юзер просил «убрать Active вверху».
 */
export function Header({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t } = useTranslation();
  const hasAnySubscription = useSubscriptionStore(
    (s) => s.subscriptions.length > 0 || s.url.trim() !== ""
  );

  const onGift = () => {
    void openUrl(DASHBOARD_URL.replace(/\/+$/, "") + "/gift");
  };

  return (
    <header className="header">
      <button
        type="button"
        className="header-logo"
        onClick={() => void openUrl("https://example.com")}
        aria-label="Ariy VPN"
      >
        <img src="/logo.png" alt="" />
        <span>ariy vpn</span>
      </button>
      <div className="header-right">
        {hasAnySubscription && (
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("ariy:open-add-subscription")
              );
            }}
            aria-label={t("header.addSubscription")}
            title={t("header.addSubscription")}
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        )}
        {hasAnySubscription && (
          <button
            type="button"
            className="icon-btn icon-btn-gift"
            onClick={onGift}
            aria-label={t("subStrip.giftAria")}
            title={t("subStrip.giftAria")}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 12 20 22 4 22 4 12" />
              <rect x="2" y="7" width="20" height="5" />
              <line x1="12" y1="22" x2="12" y2="7" />
              <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
              <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
            </svg>
          </button>
        )}
        <button
          type="button"
          className="icon-btn"
          onClick={openSupport}
          aria-label={t("header.support")}
          title={t("header.support")}
        >
          <SupportIcon />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onOpenSettings}
          aria-label={t("header.settings")}
          title={t("header.settings")}
        >
          <SettingsIcon />
        </button>
      </div>
    </header>
  );
}
