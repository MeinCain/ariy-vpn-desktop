import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useUpdateStore } from "../stores/updateStore";
import { useSettingsStore } from "../stores/settingsStore";
import { downloadAndInstall } from "../lib/updater";
import { showToast } from "../stores/toastStore";

// Модалка предложения обновления. Сознательно минимальный UI:
// только «текущая → новая версия», ничего из release notes / CHANGELOG /
// installation boilerplate. tauri-action генерит шумный `notes` в
// latest.json (auto-CHANGELOG из git log + installation template), а
// auth-api proxy дополнительно стрипает его в пустую строку — но мы и
// здесь не рендерим этот блок, чтобы fallback на github endpoint тоже
// не показывал юзеру технический шум.

export function UpdateModal() {
  const { t } = useTranslation();
  const state = useUpdateStore((s) => s.state);
  const setState = useUpdateStore((s) => s.setState);
  const dismissedSet = useSettingsStore((s) => s.set);
  const dismissedList = useSettingsStore((s) => s.dismissedUpdateVersions);
  const [progress, setProgress] = useState(0);

  if (state.kind !== "available" && state.kind !== "downloading") {
    return null;
  }

  const update = state.update;
  const isDownloading = state.kind === "downloading";

  const onDismiss = () => {
    if (isDownloading) return;
    if (!dismissedList.includes(update.version)) {
      dismissedSet("dismissedUpdateVersions", [
        ...dismissedList,
        update.version,
      ]);
    }
    setState({ kind: "idle" });
  };

  const onInstall = async () => {
    setState({ kind: "downloading", update, progress: 0 });
    try {
      await downloadAndInstall(update, (fraction) => {
        setProgress(fraction);
        setState({ kind: "downloading", update, progress: fraction });
      });
      // relaunch() в downloadAndInstall — сюда обычно не доходим,
      // app уже перезапустился. На случай fallback'а:
      setState({ kind: "installed" });
    } catch (e) {
      showToast({
        kind: "error",
        title: t("modal.update.updateFailedTitle"),
        message: String(e),
      });
      setState({ kind: "idle" });
    }
  };

  return (
    <div className="recovery-overlay" role="dialog" aria-modal="true">
      <div className="recovery-dialog" style={{ maxWidth: 460 }}>
        <div className="recovery-title">
          {t("modal.update.availableTitle", { version: update.version })}
        </div>
        <div className="recovery-text">
          {t("modal.update.currentVersion")}{" "}
          <span style={{ color: "var(--fg)" }}>{update.currentVersion}</span>
        </div>
        {isDownloading ? (
          <div style={{ marginTop: 16 }}>
            <div
              className="recovery-text"
              style={{ marginBottom: 6, fontSize: 12 }}
            >
              {t("modal.update.downloading", {
                percent: Math.round(progress * 100),
              })}
            </div>
            <div
              style={{
                height: 6,
                background: "var(--bg-soft, rgba(255,255,255,0.06))",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progress * 100}%`,
                  height: "100%",
                  background: "var(--accent, #5cc6c6)",
                  transition: "width 120ms linear",
                }}
              />
            </div>
          </div>
        ) : null}
        <div className="recovery-actions" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn-ghost"
            onClick={onDismiss}
            disabled={isDownloading}
          >
            {t("modal.update.later")}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onInstall}
            disabled={isDownloading}
          >
            {isDownloading ? "…" : t("modal.update.installAndRestart")}
          </button>
        </div>
      </div>
    </div>
  );
}
