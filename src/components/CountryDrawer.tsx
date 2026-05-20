import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useVpnStore } from "../stores/vpnStore";
import { useSubscriptionStore } from "../stores/subscriptionStore";
import { flagSvgPath, stripFlagFromName } from "../lib/flags";
import { sortIndicesByCanonical } from "../lib/canonicalOrder";
import { PingBadge } from "./PingBadge";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Список стран — раскрывается inline ПОД CurrentServerWidget'ом.
 *
 * Версии beta.13–17 использовали bottom-sheet overlay (через
 * createPortal или прямо в дереве). В production-сборке Tauri WebView2
 * это упрямо рендерило «пустую страницу» — overlay был, но contents
 * не показывались. Три захода с разными CSS-хаками (убрать blur,
 * z-index 9999, без портала) не помогли.
 *
 * Beta.18 — radical fix: дроп overlay полностью. Drawer-list теперь
 * inline expand'ит сразу под текущим server-pill'ом. Никаких fixed,
 * inset, animation, blur, portal — только обычный block-flow. Невозможно
 * не отрендерить.
 */
export function CountryDrawer({ open, onClose }: Props) {
  const { t } = useTranslation();
  const status = useVpnStore((s) => s.status);
  const selectedIndex = useVpnStore((s) => s.selectedIndex);
  const selectServer = useVpnStore((s) => s.selectServer);

  const servers = useSubscriptionStore((s) => s.servers);
  const pings = useSubscriptionStore((s) => s.pings);
  const pingsLoading = useSubscriptionStore((s) => s.pingsLoading);
  const pingAll = useSubscriptionStore((s) => s.pingAll);

  // Esc закрывает.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // При первом открытии — ping all, если пинги не собраны.
  useEffect(() => {
    if (open && pings.length === 0 && !pingsLoading) {
      void pingAll();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Canonical-sorted indices — порядок зафиксирован в lib/canonicalOrder.ts.
  const sortedIndices = useMemo(
    () => sortIndicesByCanonical(servers),
    [servers]
  );

  if (!open) return null;

  const isBusy = status === "starting" || status === "stopping";
  const availableCount = pings.filter((ms) => ms != null && ms >= 0).length;

  return (
    <div className="country-list" role="region" aria-label={t("countryDrawer.title")}>
      <div className="country-list-head">
        <h3 className="country-list-title">{t("countryDrawer.title")}</h3>
        <span className="country-list-meta">
          <span className="avail-dot avail-green" aria-hidden />
          {t("countryDrawer.count", {
            available: availableCount,
            total: servers.length,
          })}
        </span>
        <button
          type="button"
          className="country-list-close"
          onClick={onClose}
          aria-label={t("countryDrawer.close")}
          title={t("countryDrawer.close")}
        >
          ×
        </button>
      </div>
      <div className="country-list-items">
        {servers.length === 0 && (
          <div className="country-list-empty">{t("countryDrawer.empty")}</div>
        )}
        {sortedIndices.map((i) => {
          const entry = servers[i];
          if (!entry) return null;
          const ping = pings[i];
          const flagPath = flagSvgPath(entry.name);
          const cleanName = stripFlagFromName(entry.name);
          const isSelected = selectedIndex === i;
          // Пороги: <150 зелёный, <300 жёлтый, иначе красный/null.
          const availClass = (() => {
            if (ping == null) return "avail-red";
            if (ping < 150) return "avail-green";
            if (ping < 300) return "avail-yellow";
            return "avail-red";
          })();
          return (
            <button
              key={`${entry.name}-${i}`}
              type="button"
              className={`country-row${isSelected ? " is-selected" : ""}`}
              disabled={isBusy}
              onClick={() => {
                selectServer(i);
                onClose();
              }}
            >
              {flagPath ? (
                <img
                  className="country-row-flag"
                  src={flagPath}
                  alt=""
                  width={26}
                  height={20}
                />
              ) : (
                <span
                  className="country-row-flag country-row-flag-placeholder"
                  aria-hidden
                />
              )}
              <span className="country-row-name">{cleanName}</span>
              <PingBadge ms={ping} loading={pingsLoading} />
              <span className={`avail-dot ${availClass}`} aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}
