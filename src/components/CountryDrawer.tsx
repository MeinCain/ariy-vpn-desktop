import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useVpnStore } from "../stores/vpnStore";
import { useSubscriptionStore } from "../stores/subscriptionStore";
import { flagSvgPath, stripFlagFromName } from "../lib/flags";
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

  return createPortal(
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
          {servers.map((entry, i) => {
            const ping = pings[i];
            const flagPath = flagSvgPath(entry.name);
            const cleanName = stripFlagFromName(entry.name);
            const isSelected = selectedIndex === i;
            const availClass = (() => {
              if (ping == null) return "avail-red";
              if (ping < 80) return "avail-green";
              if (ping < 200) return "avail-yellow";
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
    </div>,
    document.body
  );
}
