/**
 * 14.A: обёртка над `@tauri-apps/plugin-updater` + `plugin-process`.
 *
 * Endpoint и pubkey прописаны в `tauri.conf.json` (тот же ключ что в CI
 * подписывает релизы). При вызове `check()` плагин сам ходит в endpoint,
 * парсит `latest.json` и проверяет ed25519-подпись `.sig` файлов NSIS-
 * installer'а. Если хоть что-то не сходится — `null` (или throw в случае
 * сетевой ошибки), мы это просто логируем без громких ошибок.
 */

import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { invoke } from "@tauri-apps/api/core";

export interface AvailableUpdate {
  /** Версия из manifest'а (например "0.1.4"). */
  version: string;
  /** Текущая версия приложения. */
  currentVersion: string;
  /** Release notes (из тела GitHub Release / поля `notes` manifest'а). */
  notes: string;
  /** ISO-дата релиза (если есть). */
  date: string | null;
  /** Внутренний хэндл плагина для последующего downloadAndInstall. */
  handle: Update;
}

/**
 * Проверка обновлений. Возвращает `null` если уже на последней версии
 * или произошла сетевая ошибка (мы не пугаем юзера notwerk-ошибками).
 */
export async function checkForUpdates(): Promise<AvailableUpdate | null> {
  try {
    const update = await check();
    if (!update) return null;
    return {
      version: update.version,
      currentVersion: update.currentVersion,
      notes: update.body ?? "",
      date: update.date ?? null,
      handle: update,
    };
  } catch (e) {
    // Не показываем юзеру каждый network-fail. Логируем для диагностики.
    console.warn("[updater] check failed:", e);
    return null;
  }
}

/**
 * Скачивает и устанавливает обновление. После успешной установки
 * автоматически перезапускает приложение через `plugin-process`.
 *
 * `onProgress` зовётся после каждого chunk'а с прогрессом 0..1
 * (downloaded / contentLength). NSIS у нас обычно ~44 МБ.
 */
export async function downloadAndInstall(
  update: AvailableUpdate,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  let downloaded = 0;
  let total = 0;

  // ── Шаг 1: download (без install). Файлы скачаны в Temp, ничего не
  //   тронуто в %LOCALAPPDATA%\Ariy VPN\. Можно спокойно дисконнектить.
  await update.handle.download((event) => {
    switch (event.event) {
      case "Started":
        total = event.data.contentLength ?? 0;
        onProgress?.(0);
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        if (total > 0) {
          onProgress?.(Math.min(1, downloaded / total));
        }
        break;
      case "Finished":
        onProgress?.(1);
        break;
    }
  });

  // ── Шаг 2: ДО запуска NSIS (которое начнёт перезаписывать файлы)
  //   грациозно стопим VPN и helper. Это критично — sing-box.exe и
  //   ariy-helper.exe держат open handle на свои бинарики до exit'а.
  //   В прежней реализации disconnect/shutdown вызывались ПОСЛЕ
  //   downloadAndInstall, что слишком поздно — installer уже падал
  //   на «Невозможно открыть файл».
  try { await invoke("disconnect"); }
  catch (e) { console.warn("[updater] disconnect failed:", e); }
  await new Promise((r) => setTimeout(r, 800));

  try { await invoke("shutdown_helper"); }
  catch (e) { console.warn("[updater] shutdown_helper failed:", e); }
  await new Promise((r) => setTimeout(r, 1500));

  // ── Шаг 3: дренаж IPC + install. install() запустит NSIS, который
  //   relaunch'ит app сам. До запуска NSIS даём фронту ~300мс чтобы
  //   in-flight secure_storage_set долетели до Rust (иначе URL подписки
  //   может теряться при relaunch'е).
  await new Promise((r) => setTimeout(r, 300));
  await update.handle.install();
  // installMode=passive — NSIS обычно сам relaunch'ит. relaunch ниже
  // как defensive fallback на случай если NSIS не успел.
  await relaunch();
}
