import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useVpnStore } from "../stores/vpnStore";
import { useSubscriptionStore } from "../stores/subscriptionStore";
import { flagSvgPath, stripFlagFromName } from "../lib/flags";
import { localizeCountryName } from "../lib/countryNames";
import { sortIndicesByCanonical } from "../lib/canonicalOrder";
import { SignalBars } from "./SignalBars";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Bottom-sheet шторка со списком стран. Реализована через
 * `position: absolute` внутри `.frame` (НЕ fixed, НЕ portal) — это
 * единственный надёжный способ для Tauri WebView2 в production-сборке,
 * проверенный в beta.24 после серии провалов с fixed+portal+blur.
 *
 * Когда open=true — рендерится absolute-overlay поверх всего main-grid'а,
 * с drawer-блоком в нижней части окна. Handle сверху, head с заголовком
 * и счётчиком, scrollable-список стран ниже.
 */
export function CountryDrawer({ open, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const status = useVpnStore((s) => s.status);
  const selectedIndex = useVpnStore((s) => s.selectedIndex);
  const selectServer = useVpnStore((s) => s.selectServer);

  const servers = useSubscriptionStore((s) => s.servers);
  const pings = useSubscriptionStore((s) => s.pings);
  const pingsLoading = useSubscriptionStore((s) => s.pingsLoading);
  const pingAll = useSubscriptionStore((s) => s.pingAll);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open && pings.length === 0 && !pingsLoading) {
      void pingAll();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedIndices = useMemo(
    () => sortIndicesByCanonical(servers),
    [servers]
  );

  if (!open) return null;

  const isBusy = status === "starting" || status === "stopping";
  const availableCount = pings.filter((ms) => ms != null && ms >= 0).length;

  return (
    <div
      className="country-sheet-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="country-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="country-sheet-handle" aria-hidden />
        <div className="country-sheet-head">
          <h3 className="country-sheet-title">{t("countryDrawer.title")}</h3>
          <span className="country-sheet-meta">
            <span className="country-sheet-meta-dot" aria-hidden />
            {t("countryDrawer.count", {
              available: availableCount,
              total: servers.length,
            })}
          </span>
          <button
            type="button"
            className="country-sheet-close"
            onClick={onClose}
            aria-label={t("countryDrawer.close")}
            title={t("countryDrawer.close")}
          >
            ×
          </button>
        </div>
        <div className="country-sheet-list">
          {servers.length === 0 && (
            <div className="country-sheet-empty">{t("countryDrawer.empty")}</div>
          )}
          {sortedIndices.map((i) => {
            const entry = servers[i];
            if (!entry) return null;
            const ping = pings[i];
            const flagPath = flagSvgPath(entry.name);
            const cleanName = localizeCountryName(
              stripFlagFromName(entry.name),
              i18n.language
            );
            const isSelected = selectedIndex === i;
            return (
              <button
                key={`${entry.name}-${i}`}
                type="button"
                className={`country-sheet-row${isSelected ? " is-selected" : ""}`}
                disabled={isBusy}
                onClick={() => {
                  selectServer(i);
                  onClose();
                }}
              >
                {flagPath ? (
                  <img
                    className="country-sheet-flag"
                    src={flagPath}
                    alt=""
                    width={26}
                    height={20}
                  />
                ) : (
                  <span
                    className="country-sheet-flag country-sheet-flag-placeholder"
                    aria-hidden
                  />
                )}
                <span className="country-sheet-name">{cleanName}</span>
                <SignalBars ms={ping} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
