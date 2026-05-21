import { useTranslation } from "react-i18next";
import { useSubscriptionStore } from "../stores/subscriptionStore";
import { useAuthStore } from "../stores/authStore";

/**
 * Компактная плашка ВВЕРХУ приложения с информацией о подписке:
 *
 *   [user_<telegram_id> / email]                                          [×]
 *   Тариф: VIP · Трафик: ∞ · Осталось: 349 дней
 *
 * Дизайн соответствует Chrome-расширению Ariy VPN — юзер просил перенести
 * эту инфо-плашку из main-grid в шапку. На месте, где раньше была
 * subscription-карточка, теперь живёт current-server widget.
 *
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
  const authEmail = useAuthStore((s) => s.email);
  const authTelegramId = useAuthStore((s) => s.telegramId);
  const authPlan = useAuthStore((s) => s.plan);

  // Title для левой части: предпочитаем telegram-id (имя аккаунта в
  // привычном для Ariy формате `user_<id>`). Email идёт вторым приоритетом
  // — некоторые юзеры жаловались, что не хотят видеть свой email в шапке
  // десктоп-клиента. Дальше — meta.title и host URL как fallback'и.
  const displayTitle = (() => {
    if (authTelegramId) return `user_${authTelegramId}`;
    if (authEmail) return authEmail;
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

  const fmt = (b: number): string => {
    if (!Number.isFinite(b) || b <= 0) return "0 B";
    const TB = 1024 ** 4, GB = 1024 ** 3, MB = 1024 ** 2, KB = 1024;
    if (b >= TB) return (b / TB).toFixed(2) + " TB";
    if (b >= GB) return (b / GB).toFixed(2) + " GB";
    if (b >= MB) return (b / MB).toFixed(1) + " MB";
    if (b >= KB) return (b / KB).toFixed(1) + " KB";
    return Math.round(b) + " B";
  };

  // Тариф из cabinet через authStore.plan. Если cabinet вернул null —
  // блок «Тариф:» скрывается целиком, чтобы не показывать «Ariy VPN 24/7»
  // (это название сервиса в meta.title, а не тариф).
  const tariff = authPlan?.trim() || null;

  const expiryText = (() => {
    if (!expireAt) return null;
    const now = Date.now() / 1000;
    const diff = expireAt - now;
    if (diff <= 0) return null;
    const days = Math.ceil(diff / 86400);
    if (days <= 30) return t("subStrip.expiry", { days });
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

  const onClose = () => {
    if (sessionToken) {
      void logout();
    } else if (subscriptions.length > 0) {
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
          {tariff && (
            <>
              <span className="sub-strip-tariff">
                {t("subStrip.tariff", { name: tariff })}
              </span>
              <span className="sep">·</span>
            </>
          )}
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
