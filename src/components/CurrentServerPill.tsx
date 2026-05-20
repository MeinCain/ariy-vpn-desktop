import { useTranslation } from "react-i18next";
import { useVpnStore } from "../stores/vpnStore";
import { useSubscriptionStore } from "../stores/subscriptionStore";
import { PingBadge } from "./PingBadge";

/**
 * Плашка «какой сервер сейчас выбран/подключён». Всегда видна когда
 * пользователь уже выбрал сервер из подписки (selectedIndex !== null) —
 * не зависит от того, лежит ли наш UI в legacy-single-sub или
 * multi-subscription режиме. Не кликабельна: смена сервера делается
 * либо через ServerSelector (single-sub), либо через раскрытую
 * subscription-карточку (multi-sub) — здесь только индикация «сейчас
 * подключено к X».
 */
export function CurrentServerPill() {
  const { t } = useTranslation();
  const status = useVpnStore((s) => s.status);
  const selectedIndex = useVpnStore((s) => s.selectedIndex);
  const servers = useSubscriptionStore((s) => s.servers);
  const pings = useSubscriptionStore((s) => s.pings);
  const pingsLoading = useSubscriptionStore((s) => s.pingsLoading);

  if (selectedIndex === null || !servers[selectedIndex]) return null;
  const entry = servers[selectedIndex];
  const ping = pings[selectedIndex];
  const isRunning = status === "running";

  return (
    <div
      className={`current-server-pill${isRunning ? " is-active" : ""}`}
      role="status"
      aria-label={t("currentServer.aria", { name: entry.name })}
    >
      <span className="current-server-pill-name">{entry.name}</span>
      <PingBadge ms={ping} loading={pingsLoading} />
    </div>
  );
}
