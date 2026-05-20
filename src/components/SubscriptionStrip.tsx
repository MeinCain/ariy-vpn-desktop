import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useSubscriptionStore } from "../stores/subscriptionStore";
import { useAuthStore } from "../stores/authStore";
import { DASHBOARD_URL } from "../lib/constants";

/**
 * Компактная плашка ВВЕРХУ приложения с информацией о подписке:
 *
 *   [юзер / email]                                              [🎁]  [×]
 *   Тариф: VIP · Трафик: ∞ · Осталось: 349 дней
 *
 * Дизайн соответствует Chrome-расширению Ariy VPN — юзер просил перенести
 * эту инфо-плашку из main-grid в шапку. На месте, где раньше была
 * subscription-карточка, теперь живёт current-server widget.
 *
 * 🎁 открывает /gift раздел кабинета.
 * × — logout: чистит session_token, sub_url, отключает VPN — возвращает
 * пользователя на Welcome-экран.
 */
export function SubscriptionStrip() {
  const { t, i18n } = useTranslation();
  const meta = useSubscriptionStore((s) => s.meta);
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);
  const legacyUrl = useSubscriptionStore((s) => s.url);
  const deleteSubscription = useSubscriptionStore((s) => s.deleteSubscription);
  const removeSubscription = useSubscriptionStore((s) => s.removeSubscription);
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const logout = useAuthStore((s) => s.logout);

  // Title для левой части: meta.title (приходит из подписки Remnawave —
  // обычно `user_<telegram_id>` или email), fallback на host из sub-URL.
  const displayTitle = (() => {
    if (meta?.title) return meta.title;
    try {
      const url = legacyUrl || subscriptions[0]?.url;
      if (url) return new URL(url).host;
    } catch {}
    return "Ariy VPN";
  })();

  const used = meta?.used ?? 0;
  const total = meta?.total ?? 0;
  const expireAt = meta?.expireAt ?? null;
  const hasUnlim = total === 0 && used === 0;

  // formatBytes — простой компактный вид.
  const fmt = (b: number): string => {
    if (!Number.isFinite(b) || b <= 0) return "0 B";
    const TB = 1024 ** 4, GB = 1024 ** 3, MB = 1024 ** 2, KB = 1024;
    if (b >= TB) return (b / TB).toFixed(2) + " TB";
    if (b >= GB) return (b / GB).toFixed(2) + " GB";
    if (b >= MB) return (b / MB).toFixed(1) + " MB";
    if (b >= KB) return (b / KB).toFixed(1) + " KB";
    return Math.round(b) + " B";
  };

  // Тариф: тут пока используем meta.title — на бэке Remnawave plan-name
  // не всегда отдельно. Если title содержит «VIP/Premium/...» в имени —
  // берём; иначе fallback на title целиком. Юзер увидит что есть.
  const tariff = meta?.title?.replace(/^user_\d+\s*/i, "").trim() || "Standard";

  const expiryText = (() => {
    if (!expireAt) return null;
    const now = Date.now() / 1000;
    const diff = expireAt - now;
    if (diff <= 0) return null;
    const days = Math.ceil(diff / 86400);
    if (days <= 30) return t("subStrip.expiry", { days });
    // > 30 дней — показываем явную дату с годом, чтобы не было «осталось
    // 349 дней» без понимания года (это вторая основная жалоба юзера).
    const date = new Date(expireAt * 1000);
    const dateStr = new Intl.DateTimeFormat(i18n.language, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
    return t("subStrip.expiryDate", { date: dateStr });
  })();

  const trafficText = total > 0
    ? t("subStrip.trafficOf", { used: fmt(used), total: fmt(total) })
    : hasUnlim
    ? t("subStrip.trafficUnlim")
    : t("subStrip.traffic", { used: fmt(used) });

  const onGift = () => {
    void openUrl(DASHBOARD_URL.replace(/\/+$/, "") + "/gift");
  };

  const onClose = () => {
    // Если юзер залогинен через TG/email — это logout: dropping
    // session_token чтобы вернуться на Welcome. Если single-sub legacy —
    // delete subscription. Multi-sub — remove primary.
    if (sessionToken) {
      void logout();
    } else if (subscriptions.length > 0) {
      // Удаляем primary (первую) — её ID известен в store.
      const primaryId = useSubscriptionStore.getState().primaryId;
      if (primaryId) void removeSubscription(primaryId);
    } else {
      void deleteSubscription();
    }
  };

  return (
    <div className="sub-strip" role="region">
      <div className="sub-strip-text">
        <div className="sub-strip-title">{displayTitle}</div>
        <div className="sub-strip-stats">
          <span>{t("subStrip.tariff", { name: tariff })}</span>
          <span className="sep">·</span>
          <span>{trafficText}</span>
          {expiryText && (
            <>
              <span className="sep">·</span>
              <span>{expiryText}</span>
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        className="sub-strip-gift"
        onClick={onGift}
        aria-label={t("subStrip.giftAria")}
        title={t("subStrip.giftAria")}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 12 20 22 4 22 4 12" />
          <rect x="2" y="7" width="20" height="5" />
          <line x1="12" y1="22" x2="12" y2="7" />
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
        </svg>
      </button>
      <button
        type="button"
        className="sub-strip-close"
        onClick={onClose}
        aria-label={t("subStrip.logoutAria")}
        title={t("subStrip.logoutAria")}
      >
        ×
      </button>
    </div>
  );
}
