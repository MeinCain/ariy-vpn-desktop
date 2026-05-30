//! Защищённое хранилище секретов (этап 6.A + beta.48 DPAPI-backup).
//!
//! Два уровня хранения:
//!
//!   1. **Windows Credential Manager** через `keyring-rs`. Primary. Каждое
//!      значение хранится как отдельный credential `nemefisto.<key>`.
//!
//!   2. **DPAPI-зашифрованный файл** `%APPDATA%\AriyVPN\auth-backup.dat`.
//!      Backup. Содержит JSON-карту всех ключей. Зашифрован per-user через
//!      `CryptProtectData` (Windows native). Файл вне install-папки —
//!      переживает любой uninstall/reinstall.
//!
//! На `set()` пишем в оба. На `get()` сначала CM, если пусто — backup-файл
//! и self-heal'имся обратно в CM. На `delete()` чистим оба.
//!
//! beta.48: backup-файл добавлен после инцидента 30 мая 2026 когда у юзера
//! `cmdkey /list:nemefisto.*` вернул `* NONE *` после серии update'ов
//! (.43→.44→...→.47). Точный момент стирания неизвестен — теперь нам
//! всё равно: если CM пуст, читаем backup и восстанавливаемся.
//!
//! Хранится:
//! - `subscription_url` — URL подписки (содержит токен/HWID часто);
//! - `subscription_url:<uuid>` — per-id для multi-sub (0.3.0);
//! - `hwid_override` — кастомный HWID;
//! - `ariy.auth.session_token` — TG/email-сессия.
//!
//! На macOS / Linux: только keyring (Keychain / Secret Service). Backup-
//! файл условный — DPAPI Windows-only.

use anyhow::{bail, Context, Result};
use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

const SERVICE_PREFIX: &str = "nemefisto";
const USERNAME: &str = "default";

/// Создать `Entry` для ключа.
fn entry(key: &str) -> Result<Entry> {
    let service = format!("{SERVICE_PREFIX}.{key}");
    Entry::new(&service, USERNAME)
        .with_context(|| format!("не удалось создать keyring entry для {key}"))
}

// ─── Backup-файл (DPAPI) ──────────────────────────────────────────────

#[derive(Debug, Default, Serialize, Deserialize)]
struct Backup {
    /// Map key → value. Тот же набор ключей что в Credential Manager.
    entries: HashMap<String, String>,
}

/// `%APPDATA%\AriyVPN\auth-backup.dat` — путь к backup-файлу.
///
/// Папка `AriyVPN` (без пробела) специально отличается от Tauri-managed
/// `Ariy VPN` (с пробелом) — Tauri uninstall в теории мог бы зачистить
/// «свою» папку, а наш backup в другом месте.
fn backup_path() -> Option<PathBuf> {
    let appdata = std::env::var("APPDATA").ok()?;
    Some(PathBuf::from(appdata).join("AriyVPN").join("auth-backup.dat"))
}

/// In-memory mutex чтобы set/get не гонялись при concurrent IPC-вызовах
/// с фронта (subscriptionStore делает несколько keyringSet быстро подряд).
static BACKUP_LOCK: Mutex<()> = Mutex::new(());

#[cfg(windows)]
fn dpapi_protect(plain: &[u8]) -> Result<Vec<u8>> {
    use windows_sys::Win32::Security::Cryptography::{CryptProtectData, CRYPT_INTEGER_BLOB};
    use windows_sys::Win32::Foundation::LocalFree;
    unsafe {
        let mut in_blob = CRYPT_INTEGER_BLOB {
            cbData: plain.len() as u32,
            pbData: plain.as_ptr() as *mut u8,
        };
        let mut out_blob = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: std::ptr::null_mut(),
        };
        let ok = CryptProtectData(
            &mut in_blob,
            std::ptr::null(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            0,
            &mut out_blob,
        );
        if ok == 0 {
            bail!("CryptProtectData failed");
        }
        let result =
            std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize).to_vec();
        LocalFree(out_blob.pbData as _);
        Ok(result)
    }
}

#[cfg(windows)]
fn dpapi_unprotect(encrypted: &[u8]) -> Result<Vec<u8>> {
    use windows_sys::Win32::Security::Cryptography::{CryptUnprotectData, CRYPT_INTEGER_BLOB};
    use windows_sys::Win32::Foundation::LocalFree;
    unsafe {
        let mut in_blob = CRYPT_INTEGER_BLOB {
            cbData: encrypted.len() as u32,
            pbData: encrypted.as_ptr() as *mut u8,
        };
        let mut out_blob = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: std::ptr::null_mut(),
        };
        let ok = CryptUnprotectData(
            &mut in_blob,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            0,
            &mut out_blob,
        );
        if ok == 0 {
            bail!("CryptUnprotectData failed (вероятно файл повреждён или от другого юзера)");
        }
        let result =
            std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize).to_vec();
        LocalFree(out_blob.pbData as _);
        Ok(result)
    }
}

#[cfg(not(windows))]
fn dpapi_protect(_plain: &[u8]) -> Result<Vec<u8>> {
    bail!("DPAPI доступен только на Windows")
}

#[cfg(not(windows))]
fn dpapi_unprotect(_encrypted: &[u8]) -> Result<Vec<u8>> {
    bail!("DPAPI доступен только на Windows")
}

fn read_backup() -> Result<Backup> {
    let path = backup_path().context("APPDATA не определён")?;
    if !path.exists() {
        return Ok(Backup::default());
    }
    let encrypted = std::fs::read(&path).with_context(|| format!("чтение {}", path.display()))?;
    let plain = dpapi_unprotect(&encrypted).context("DPAPI расшифровка")?;
    let backup: Backup = serde_json::from_slice(&plain).context("парсинг backup-JSON")?;
    Ok(backup)
}

fn write_backup(backup: &Backup) -> Result<()> {
    let path = backup_path().context("APPDATA не определён")?;
    let parent = path.parent().context("нет parent dir")?;
    std::fs::create_dir_all(parent)
        .with_context(|| format!("create_dir_all {}", parent.display()))?;
    let plain = serde_json::to_vec(backup).context("сериализация backup")?;
    let encrypted = dpapi_protect(&plain).context("DPAPI шифрование")?;
    // Атомарная запись: tmp + rename
    let tmp = path.with_extension("dat.tmp");
    std::fs::write(&tmp, &encrypted)
        .with_context(|| format!("запись {}", tmp.display()))?;
    std::fs::rename(&tmp, &path)
        .with_context(|| format!("rename → {}", path.display()))?;
    Ok(())
}

fn backup_set(key: &str, value: &str) -> Result<()> {
    let _guard = BACKUP_LOCK.lock().map_err(|e| anyhow::anyhow!("lock: {e}"))?;
    let mut backup = read_backup().unwrap_or_default();
    backup.entries.insert(key.to_string(), value.to_string());
    write_backup(&backup)
}

fn backup_get(key: &str) -> Result<Option<String>> {
    let _guard = BACKUP_LOCK.lock().map_err(|e| anyhow::anyhow!("lock: {e}"))?;
    let backup = read_backup().unwrap_or_default();
    Ok(backup.entries.get(key).cloned())
}

fn backup_delete(key: &str) -> Result<()> {
    let _guard = BACKUP_LOCK.lock().map_err(|e| anyhow::anyhow!("lock: {e}"))?;
    let mut backup = read_backup().unwrap_or_default();
    if backup.entries.remove(key).is_some() {
        write_backup(&backup)?;
    }
    Ok(())
}

// ─── Public API (Credential Manager + Backup) ─────────────────────────

/// Прочитать значение по ключу.
///
/// Стратегия:
///   1. Try Credential Manager.
///   2. Если CM пуст — try backup-файл.
///   3. Если найдено в backup — restore в CM (self-healing) и возвращаем.
///
/// `None` только если значение не существует в обоих хранилищах.
pub fn get(key: &str) -> Result<Option<String>> {
    let e = entry(key)?;
    match e.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => {
            // CM пуст — пробуем backup-файл.
            match backup_get(key) {
                Ok(Some(value)) => {
                    eprintln!(
                        "[secure_storage] {key} восстановлен из backup-файла, пишу обратно в CM"
                    );
                    if let Err(set_err) = e.set_password(&value) {
                        eprintln!("[secure_storage] self-heal CM-write failed: {set_err}");
                    }
                    Ok(Some(value))
                }
                Ok(None) => Ok(None),
                Err(backup_err) => {
                    eprintln!("[secure_storage] backup read для {key} упал: {backup_err}");
                    Ok(None)
                }
            }
        }
        Err(err) => Err(anyhow::anyhow!("keyring get({key}): {err}")),
    }
}

/// Записать значение. Перезаписывает существующее.
///
/// **beta.53 регрессия + .54 фикс:** раньше код был
/// ```rust,ignore
/// e.set_password(value)?;        // если CM падает — Err
/// backup_set(key, value);        // никогда не вызывается
/// ```
/// — у одного юзера 30 мая 2026 CM-set возвращал ошибку (причина
/// неясна — Windows Credential Manager недоступен / заблокирован /
/// keyring-rs не может писать), и **backup-файл при этом тоже не
/// создавался**. После каждого «логина» юзер видел Welcome заново.
///
/// Теперь оба хранилища пишутся **независимо**: если CM падает —
/// продолжаем писать в backup. Возвращаем Err только если оба фейлят.
/// На любой error логируем причину в stderr (видно через
/// `Get-WinEvent` или просто запустив app из cmd с обёрткой 2>err.log).
pub fn set(key: &str, value: &str) -> Result<()> {
    let e = entry(key)?;
    let cm_err: Option<String> = match e.set_password(value) {
        Ok(()) => None,
        Err(err) => {
            let msg = format!("{err}");
            eprintln!("[secure_storage] CM-set для {key} упал: {msg}");
            Some(msg)
        }
    };
    let backup_err: Option<String> = match backup_set(key, value) {
        Ok(()) => None,
        Err(err) => {
            let msg = format!("{err}");
            eprintln!("[secure_storage] backup-set для {key} упал: {msg}");
            Some(msg)
        }
    };
    match (cm_err, backup_err) {
        (None, _) => Ok(()),         // CM сработал — backup опционален
        (Some(_), None) => Ok(()),   // backup сработал — CM опционален, OK
        (Some(cm), Some(bk)) => {
            // Оба упали — это реальная проблема, юзер потеряет credential.
            bail!("оба хранилища упали: CM={cm}; backup={bk}");
        }
    }
}

/// Удалить значение из обоих хранилищ.
pub fn delete(key: &str) -> Result<()> {
    let e = entry(key)?;
    let cm_result = match e.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(anyhow::anyhow!("keyring delete({key}): {err}")),
    };
    if let Err(backup_err) = backup_delete(key) {
        eprintln!("[secure_storage] backup delete для {key} упал: {backup_err}");
    }
    cm_result
}
