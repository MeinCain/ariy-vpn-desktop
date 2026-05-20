import { useTranslation } from "react-i18next";
import { useSubscriptionStore } from "../stores/subscriptionStore";
import { useAuthStore } from "../stores/authStore";

/**
 * Компактная одна строка под power-кнопкой (между tagline и текущим
 * сервером):
 *
 *   Тариф: VIP · Трафик: ∞ · Осталось: 349 дн.
 *
 * Никаких title-юзера, кнопок-подарка и close-крестиков — это всё ушло в
 * Header. Здесь только сухая информация о подписке.
 */
export function CompactSubInfo() {
  const { t, i18n } = useTranslation();
  const meta = useSubscriptionStore((s) => s.meta);
  const plan = useAuthStore((s) => s.plan);

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

  // Тариф: authStore.plan (приходит из /v1/auth/me → cabinet). Если null —
  // не показываем плашку «Тариф: —», вместо неё пусто.
  const tariffLabel = plan;

  const trafficText = total > 0
    ? `${fmt(used)} / ${fmt(total)}`
    : hasUnlim
    ? "∞"
    : fmt(used);

  const expiryText = (() => {
    if (!expireAt) return null;
    const now = Date.now() / 1000;
    const diff = expireAt - now;
    if (diff <= 0) return null;
    const days = Math.ceil(diff / 86400);
    if (days <= 30) return t("compactSub.daysLeft", { days });
    const date = new Date(expireAt * 1000);
    const dateStr = new Intl.DateTimeFormat(i18n.language, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
    return t("compactSub.untilDate", { date: dateStr });
  })();

  // Если ни plan, ни трафика, ни срока нет (например подписка ещё не
  // загружена) — ничего не рендерим, чтоб не было пустой плашки.
  if (!tariffLabel && !meta) return null;

  return (
    <div className="compact-sub-info" role="status">
      {tariffLabel && (
        <>
          <span className="csi-label">{t("compactSub.tariff")}</span>
          <span className="csi-value">{tariffLabel}</span>
        </>
      )}
      {meta && (
        <>
          {tariffLabel && <span className="csi-sep">·</span>}
          <span className="csi-label">{t("compactSub.traffic")}</span>
          <span className="csi-value">{trafficText}</span>
          {expiryText && (
            <>
              <span className="csi-sep">·</span>
              <span className="csi-value">{expiryText}</span>
            </>
          )}
        </>
      )}
    </div>
  );
}
