import { useTranslation } from "react-i18next";
import { useVpnStore } from "../stores/vpnStore";
import { useSubscriptionStore } from "../stores/subscriptionStore";
import { flagSvgPath, stripFlagFromName } from "../lib/flags";
import { localizeCountryName } from "../lib/countryNames";
import { SignalBars } from "./SignalBars";

/**
 * Большая plate-кнопка с флагом + страной + пингом + chevron'ом.
 * Заменяет SubscriptionMeta / ServerSelector pill на главном экране.
 * Если сервер не выбран → текст «Выбрать локацию», клик открывает
 * CountryDrawer. Если выбран → отображает текущий + клик также
 * открывает drawer для смены.
 */
export function CurrentServerWidget({ onPick }: { onPick: () => void }) {
  const { t, i18n } = useTranslation();
  const status = useVpnStore((s) => s.status);
  const selectedIndex = useVpnStore((s) => s.selectedIndex);
  const servers = useSubscriptionStore((s) => s.servers);
  const pings = useSubscriptionStore((s) => s.pings);

  const entry = selectedIndex !== null ? servers[selectedIndex] : null;
  const ping = selectedIndex !== null ? pings[selectedIndex] : undefined;
  const isBusy = status === "starting" || status === "stopping";
  const cleanName = entry
    ? localizeCountryName(stripFlagFromName(entry.name), i18n.language)
    : "";

  if (!entry) {
    return (
      <button
        type="button"
        className="current-server-widget is-empty"
        onClick={onPick}
        disabled={isBusy}
      >
        <span className="csw-empty">{t("currentServer.pickLocation")}</span>
        <ChevronDown />
      </button>
    );
  }

  const flagPath = flagSvgPath(entry.name);

  return (
    <button
      type="button"
      className={`current-server-widget${status === "running" ? " is-active" : ""}`}
      onClick={onPick}
      disabled={isBusy}
    >
      {flagPath ? (
        <img className="csw-flag" src={flagPath} alt="" width={24} height={18} />
      ) : (
        <span className="csw-flag-placeholder" aria-hidden>·</span>
      )}
      <span className="csw-name">{cleanName}</span>
      <SignalBars ms={ping} />
      <ChevronDown />
    </button>
  );
}

function ChevronDown() {
  return (
    <svg
      className="csw-chevron"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
