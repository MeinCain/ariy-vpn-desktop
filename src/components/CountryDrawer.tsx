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
 * Bottom-sheet drawer со списком серверов: иконка флага слева,
 * название по центру, ping-сигнал справа и цветная точка доступности
 * после него. Дизайн копирует Chrome-расширение Ariy VPN — юзер прислал
 * скриншоты как референс.
 *
 * Цвета точки доступности (`avail-dot`):
 *   - `green`   — пинг < 80мс (сервер быстрый)
 *   - `yellow`  — пинг 80-200мс или ещё измеряется (приемлемо)
 *   - `red`     — пинг ≥ 200мс или нет ответа (медленный/недоступен)
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

  // При первом открытии drawer'а — ping all, если пинги ещё не собраны.
  useEffect(() => {
    if (open && pings.length === 0 && !pingsLoading) {
      void pingAll();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const isBusy = status === "starting" || status === "stopping";
  const availableCount = pings.filter(
    (ms) => ms != null && ms >= 0
  ).length;
  // Canonical-sorted indices — порядок зафиксирован в lib/canonicalOrder.ts
  // и не зависит от пинга. Юзер прямо просил «больше не меняться».
  const sortedIndices = useMemo(
    () => sortIndicesByCanonical(servers),
    [servers]
  );

  // Без createPortal — в production-сборке Tauri WebView2 portal к
  // document.body иногда не монтируется (юзер видел «пустую страницу»
  // в beta.14/.15/.16). Рендерим overlay прямо в parent React-tree.
  return (
    <div
      className="country-drawer-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="country-drawer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="country-drawer-handle" aria-hidden />
        <div className="country-drawer-head">
          <h3 className="country-drawer-title">{t("countryDrawer.title")}</h3>
          <span className="country-drawer-meta">
            <span className="avail-dot avail-green" aria-hidden />
            {t("countryDrawer.count", {
              available: availableCount,
              total: servers.length,
            })}
          </span>
          <button
            type="button"
            className="country-drawer-close"
            onClick={onClose}
            aria-label={t("countryDrawer.close")}
          >
            ×
          </button>
        </div>
        <div className="country-drawer-list">
          {servers.length === 0 && (
            <div className="country-drawer-empty">{t("countryDrawer.empty")}</div>
          )}
          {sortedIndices.map((i) => {
            const entry = servers[i];
            if (!entry) return null;
            const ping = pings[i];
            const flagPath = flagSvgPath(entry.name);
            const cleanName = stripFlagFromName(entry.name);
            const isSelected = selectedIndex === i;
            // Пороги доступности (юзер v0.2.0-beta.13):
            //   <150 ms     → зелёная точка (быстро)
            //   150-300 ms  → жёлтая (заметная задержка)
            //   ≥300 ms / null → красная (медленно / нет ответа)
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
                  <span className="country-row-flag country-row-flag-placeholder" aria-hidden />
                )}
                <span className="country-row-name">{cleanName}</span>
                <PingBadge ms={ping} loading={pingsLoading} />
                <span className={`avail-dot ${availClass}`} aria-hidden />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
