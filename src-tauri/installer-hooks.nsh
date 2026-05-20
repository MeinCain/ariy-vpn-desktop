; 0.3.1 / installer file-lock fix.
;
; При обновлении (через auto-updater или вручную скачанный installer)
; `ariy-helper.exe` залочен потому что зарегистрирован как
; Windows-service `AriyHelper` под SYSTEM. NSIS не может
; перезаписать файл запущенного процесса.
;
; Auto-updater сначала вызывает Tauri-команду `shutdown_helper` (см.
; src/lib/updater.ts), которая просит helper выйти грациозно через SCM
; SERVICE_CONTROL_STOP. После ~1.5с файл уже свободен, и эти хуки
; работают как defensive-резерв.
;
; Для **manual install** (юзер скачал installer и запустил вручную):
; - если запущен как админ → `sc stop` срабатывает, файл освобождается;
; - если без админа → `sc stop` тихо фейлится, и юзер увидит тот же
;   диалог "невозможно открыть файл" что раньше. Не регрессия, но
;   улучшение для самого частого пути (auto-update).

; Универсальный «убить процесс с подтверждением» — taskkill + ждём пока
; процесс реально исчезнет из таблицы (через PowerShell Get-Process)
; перед тем как идти дальше. В beta.13/.14 простой taskkill + Sleep
; недостаточно: антивирусы держат handle на скачанный exe ещё ~3-5с
; после exit'а процесса, и NSIS получал «Невозможно открыть файл».
;
; Этот macro блокирует поток установки максимум 8 секунд на процесс
; (в Sleep total), но это лучше чем диалог с «Прервать/Повтор/Пропуск».
!macro KillProcHard name
  nsExec::ExecToLog 'taskkill /F /T /IM "${name}"'
  Sleep 600
  nsExec::ExecToLog 'taskkill /F /T /IM "${name}"'
  Sleep 600
  ; Третий заход через WMI — иногда срабатывает там где taskkill не смог
  ; (например, процесс в state EXIT_PROCESS_DEBUG_EVENT).
  nsExec::ExecToLog 'wmic process where name="${name}" call terminate'
  Sleep 800
  ; PowerShell блокирующее ожидание до 5 секунд — гарантия что handle
  ; реально освобождён. Stop-Process -Force на случай если ещё жив.
  nsExec::ExecToLog 'powershell.exe -NoProfile -Command "$p=Get-Process -Name \"${name}\" -ErrorAction SilentlyContinue | Where-Object {$_.Name -eq \"${name}\".Replace(\".exe\",\"\")}; if($p){$p|Stop-Process -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 500}"'
!macroend

!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Stopping Ariy VPN processes before install..."
  ; ── Шаг 1: главный exe + всё его дерево ────────────────────────────
  ; /T убивает рекурсивно — sing-box и mihomo стартуют как child
  ; (через tauri-plugin-shell sidecar), поэтому /T main'а ловит их
  ; одной командой. На случай race-condition'а — повторяем 3 раза.
  !insertmacro KillProcHard "Ariy VPN.exe"

  ; ── Шаг 2: helper-сервис ───────────────────────────────────────────
  ; Helper зарегистрирован как Windows-service `AriyHelper` под SYSTEM.
  ; В per-user install у NSIS НЕТ admin-прав по умолчанию — `sc stop`
  ; silently fails и helper-процесс продолжает удерживать file-handle.
  ; Делаем оба обряда: SCM-stop (если admin) И taskkill (без admin).
  ; В современных Windows 10/11 c UAC default — taskkill /F user'а
  ; способен убить SYSTEM-процесс из той же user-session'и.
  nsExec::ExecToLog 'sc stop AriyHelper'
  Sleep 1200
  !insertmacro KillProcHard "ariy-helper.exe"
  !insertmacro KillProcHard "ariy-helper-x86_64-pc-windows-msvc.exe"

  ; ── Шаг 3: VPN-движки sing-box / mihomo (на случай orphan'ов) ──────
  ; Если /T главного exe их не зацепил (рейс с tauri-shell exit'ом),
  ; добиваем по имени.
  !insertmacro KillProcHard "sing-box.exe"
  !insertmacro KillProcHard "sing-box-x86_64-pc-windows-msvc.exe"
  !insertmacro KillProcHard "mihomo.exe"
  !insertmacro KillProcHard "mihomo-x86_64-pc-windows-msvc.exe"

  ; ── Шаг 4: ждём пока kernel закроет file-handle'ы ──────────────────
  ; sing-box при exit'е грейсфул-закрывает WinTUN, ariy-helper —
  ; WFP-engine. До 2с в худшем случае. Это намного дольше прежних 800мс
  ; — но даёт стабильность вместо «нажми Повтор».
  Sleep 2500
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Stopping Ariy VPN processes before uninstall..."
  !insertmacro KillProcHard "Ariy VPN.exe"
  nsExec::ExecToLog 'sc stop AriyHelper'
  Sleep 1200
  !insertmacro KillProcHard "ariy-helper.exe"
  !insertmacro KillProcHard "ariy-helper-x86_64-pc-windows-msvc.exe"
  !insertmacro KillProcHard "sing-box.exe"
  !insertmacro KillProcHard "sing-box-x86_64-pc-windows-msvc.exe"
  !insertmacro KillProcHard "mihomo.exe"
  !insertmacro KillProcHard "mihomo-x86_64-pc-windows-msvc.exe"
  Sleep 2500
  ; После stop сервис всё ещё зарегистрирован в SCM. При полной
  ; деинсталляции удаляем чтобы не оставлять "висящую" запись.
  nsExec::ExecToLog 'sc delete AriyHelper'
!macroend
