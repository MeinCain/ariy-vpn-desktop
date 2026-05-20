import { useTranslation } from "react-i18next";
import { APP_VERSION } from "../lib/constants";
import { openDashboard, openSupport } from "../lib/openExternal";
import { useSubscriptionStore } from "../stores/subscriptionStore";

/**
 * Подвал — pill-блок «Кабинет · Поддержка · RU/EN-флаги», как в
 * Chrome-расширении Ariy VPN (юзер прислал референс-скриншот).
 *
 * Не отображается на Welcome-экране (servers пустой) — там своя
 * центральная форма «Войти через Telegram». Показывается только когда
 * у юзера уже есть подписка.
 */
export function Footer() {
  const { t, i18n } = useTranslation();
  const hasSubscription = useSubscriptionStore((s) => s.servers.length > 0);

  if (!hasSubscription) {
    // Минималистичный fallback для Welcome — только техно-строка снизу,
    // без pill'а.
    return (
      <footer className="footer footer-minimal">
        <span>{t("footer.left")}</span>
        <span>v.{APP_VERSION}</span>
      </footer>
    );
  }

  const lang = i18n.language.startsWith("ru") ? "ru" : "en";

  return (
    <footer className="footer-pill" role="contentinfo">
      <button
        type="button"
        className="footer-pill-btn"
        onClick={openDashboard}
        aria-label={t("header.dashboard")}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span>{t("header.dashboard")}</span>
      </button>
      <button
        type="button"
        className="footer-pill-btn"
        onClick={openSupport}
        aria-label={t("header.support")}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
        <span>{t("header.support")}</span>
      </button>
      <div className="footer-pill-langs" role="group" aria-label="Language">
        <button
          type="button"
          className={`footer-pill-flag${lang === "ru" ? " is-active" : ""}`}
          onClick={() => i18n.changeLanguage("ru")}
          aria-label="Русский"
          title="Русский"
        >
          <img src="/flags/ru.svg" alt="" width={20} height={14} />
        </button>
        <button
          type="button"
          className={`footer-pill-flag${lang === "en" ? " is-active" : ""}`}
          onClick={() => i18n.changeLanguage("en")}
          aria-label="English"
          title="English"
        >
          <img src="/flags/gb.svg" alt="" width={20} height={14} />
        </button>
      </div>
    </footer>
  );
}
