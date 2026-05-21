import { useTranslation } from "react-i18next";
import { useVpnStore } from "../stores/vpnStore";
import { PRESET_BUTTON_STYLE } from "../stores/settingsStore";
import { useEffectiveSettings } from "../lib/hooks/useEffectiveSettings";
import { POWER_LABEL_CLS } from "../lib/constants";
import { PowerIcon } from "./icons";
import { ConnectionTimer } from "./ConnectionTimer";

/**
 * Центральный блок: круглая power-кнопка, status-pill сверху,
 * подпись и текущий режим под кнопкой.
 */
export function PowerStack({ canConnect }: { canConnect: boolean }) {
  const { t } = useTranslation();
  const status = useVpnStore((s) => s.status);
  const socksUsername = useVpnStore((s) => s.socksUsername);
  const socksPassword = useVpnStore((s) => s.socksPassword);
  const connect = useVpnStore((s) => s.connect);
  const disconnect = useVpnStore((s) => s.disconnect);
  const { buttonStyle, preset } = useEffectiveSettings();
  const effectiveButtonStyle =
    preset === "none" ? buttonStyle : PRESET_BUTTON_STYLE[preset];

  const isBusy = status === "starting" || status === "stopping";
  const isRunning = status === "running";

  const onClick = () => {
    if (isBusy) return;
    if (isRunning) void disconnect();
    else void connect();
  };

  return (
    <div className="power-stack">
      {/* Старый STATUS_PILL_CLS-pill сверху убран — он дублировал текст
          под кнопкой и засорял интерфейс. Сейчас одна строка «Статус:
          <colored-state>» прямо под кнопкой. */}
      <button
        type="button"
        className={`power-btn power-btn-${effectiveButtonStyle} no-label${isRunning ? " is-running" : ""}`}
        disabled={isRunning ? isBusy : !canConnect}
        onClick={onClick}
        aria-label={isRunning ? t("power.disconnect") : t("power.connect")}
        title={isRunning ? t("power.disconnect") : t("power.connect")}
      >
        <PowerIcon />
      </button>

      <div style={{ textAlign: "center" }}>
        <div className="status-line">
          <span className="status-line-label">{t("statusLineLabel", "Статус:")}</span>{" "}
          <span className={`status-line-state is-${status} ${POWER_LABEL_CLS[status]}`}>
            {t(`status.label.${status}`)}
          </span>
        </div>
        {/* Таймер 00:00:00 — отсчитывает с момента подключения, иначе
            показывает «00:00:00» как placeholder (как в Chrome-расширении). */}
        <ConnectionTimer />
        {isRunning && socksUsername && socksPassword && (
          <LanCredentials user={socksUsername} pass={socksPassword} />
        )}
      </div>
    </div>
  );
}

/** Маленькая плашка с SOCKS5-кредами для LAN-режима + кнопка копирования. */
function LanCredentials({ user, pass }: { user: string; pass: string }) {
  const { t } = useTranslation();
  return (
    <div className="lan-creds" style={{ marginTop: 8 }}>
      <div className="lan-creds-label">{t("power.lanCredsLabel")}</div>
      <button
        type="button"
        className="lan-creds-row"
        onClick={() => {
          void navigator.clipboard.writeText(`${user}:${pass}`);
        }}
        title={t("power.lanCredsCopyTitle")}
      >
        <span className="lan-creds-user">{user}</span>
        <span className="lan-creds-sep">:</span>
        <span className="lan-creds-pass">{pass}</span>
        <span className="lan-creds-copy">⎘</span>
      </button>
    </div>
  );
}
