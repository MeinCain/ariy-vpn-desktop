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

; Универсальный «убить процесс N раз с паузой» — без NSIS plugin'ов.
; Каждая попытка идемпотентна: если процесс уже не запущен, taskkill
; вернёт код 128 и тихо пройдёт. После 3 проходов через 800мс
; kernel гарантированно отпускает file-handle'ы залоченных бинарей
; (sing-box.exe, ariy-helper.exe), даже если main app только что
; их освободил и helper-сервис ещё дописывал WFP-журнал.
!macro KillProcTriple name
  nsExec::ExecToLog 'taskkill /F /T /IM "${name}"'
  Sleep 400
  nsExec::ExecToLog 'taskkill /F /T /IM "${name}"'
  Sleep 400
  nsExec::ExecToLog 'taskkill /F /T /IM "${name}"'
!macroend

!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Stopping Ariy VPN processes before install..."
  ; ── Шаг 1: главный exe + всё его дерево ────────────────────────────
  ; /T убивает рекурсивно — sing-box и mihomo стартуют как child
  ; (через tauri-plugin-shell sidecar), поэтому /T main'а ловит их
  ; одной командой. На случай race-condition'а — повторяем 3 раза.
  !insertmacro KillProcTriple "Ariy VPN.exe"

  ; ── Шаг 2: helper-сервис ───────────────────────────────────────────
  ; Helper зарегистрирован как Windows-service `AriyHelper` под SYSTEM.
  ; В per-user install у NSIS НЕТ admin-прав по умолчанию — `sc stop`
  ; silently fails и helper-процесс продолжает удерживать file-handle.
  ; Делаем оба обряда: SCM-stop (если admin) И taskkill (без admin).
  ; В современных Windows 10/11 c UAC default — taskkill /F user'а
  ; способен убить SYSTEM-процесс из той же user-session'и.
  nsExec::ExecToLog 'sc stop AriyHelper'
  Sleep 1200
  !insertmacro KillProcTriple "ariy-helper.exe"
  !insertmacro KillProcTriple "ariy-helper-x86_64-pc-windows-msvc.exe"

  ; ── Шаг 3: VPN-движки sing-box / mihomo (на случай orphan'ов) ──────
  ; Если /T главного exe их не зацепил (рейс с tauri-shell exit'ом),
  ; добиваем по имени.
  !insertmacro KillProcTriple "sing-box.exe"
  !insertmacro KillProcTriple "sing-box-x86_64-pc-windows-msvc.exe"
  !insertmacro KillProcTriple "mihomo.exe"
  !insertmacro KillProcTriple "mihomo-x86_64-pc-windows-msvc.exe"

  ; ── Шаг 4: ждём пока kernel закроет file-handle'ы ──────────────────
  ; sing-box при exit'е грейсфул-закрывает WinTUN, ariy-helper —
  ; WFP-engine. До 2с в худшем случае. Это намного дольше прежних 800мс
  ; — но даёт стабильность вместо «нажми Повтор».
  Sleep 2500
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Stopping Ariy VPN processes before uninstall..."
  !insertmacro KillProcTriple "Ariy VPN.exe"
  nsExec::ExecToLog 'sc stop AriyHelper'
  Sleep 1200
  !insertmacro KillProcTriple "ariy-helper.exe"
  !insertmacro KillProcTriple "ariy-helper-x86_64-pc-windows-msvc.exe"
  !insertmacro KillProcTriple "sing-box.exe"
  !insertmacro KillProcTriple "sing-box-x86_64-pc-windows-msvc.exe"
  !insertmacro KillProcTriple "mihomo.exe"
  !insertmacro KillProcTriple "mihomo-x86_64-pc-windows-msvc.exe"
  Sleep 2500
  ; После stop сервис всё ещё зарегистрирован в SCM. При полной
  ; деинсталляции удаляем чтобы не оставлять "висящую" запись.
  nsExec::ExecToLog 'sc delete AriyHelper'
!macroend
