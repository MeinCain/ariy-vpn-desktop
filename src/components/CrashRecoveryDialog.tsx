import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * Crash recovery — теперь auto-silent (beta.25).
 *
 * Раньше при обнаружении orphan-ресурсов от прошлой сессии (proxy_orphan,
 * tun_orphan, wfp-filters остатки) показывали юзеру модальный диалог
 * «Починить всё / Восстановить прокси / Оставить». Юзер прямо жаловался:
 * «зачем при входе постоянно запрашивает что-то починить? Пусть это
 * делается автоматически».
 *
 * Решение: вместо диалога — при mount'е тихо вызвать `recover_network`
 * (kill_switch_force_cleanup + orphan_cleanup + force_clear_system_proxy).
 * `discard_proxy_backup` если был backup — потому что мы только что
 * сделали полный cleanup, оригинальное состояние реестра уже не
 * восстановишь без потерь, лучше чисто.
 *
 * Компонент по-прежнему возвращает null — никакого UI. Оставлен в
 * App.tsx render-tree чтобы useEffect срабатывал при mount'е.
 */
type RecoveryState = {
  was_crashed: boolean;
  proxy_orphan: boolean;
  proxy_backup_present: boolean;
  tun_orphan: boolean;
  orphan_wfp_filters: boolean;
};

export function CrashRecoveryDialog() {
  useEffect(() => {
    void (async () => {
      try {
        const s = await invoke<RecoveryState>("get_recovery_state");
        if (!s.was_crashed) return;
        // Silent auto-fix — никакого dialog'а юзеру.
        try { await invoke("recover_network"); } catch (e) {
          console.warn("[crash-recovery] recover_network failed:", e);
        }
        if (s.proxy_backup_present) {
          try { await invoke("discard_proxy_backup"); } catch {}
        }
      } catch {
        // get_recovery_state мог упасть — не критично, пусть ничего не делает.
      }
    })();
  }, []);

  return null;
}
