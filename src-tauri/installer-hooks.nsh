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

!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Stopping Ariy VPN processes before install..."
  ; 1. Прежде всего убиваем сам main app — если юзер не закрыл прежнюю
  ;    копию Ariy VPN перед запуском installer'а, sing-box.exe был залочен
  ;    Tauri-job-object'ом и NSIS не смог бы перезаписать файлы в
  ;    `%LOCALAPPDATA%\Ariy VPN\`. /T убивает и дочерние процессы.
  nsExec::ExecToLog 'taskkill /F /T /IM "Ariy VPN.exe"'
  ; 2. Helper-сервис: останавливаем через SCM (требует админа), потом
  ;    taskkill как страховка. Без админа sc stop silently fails — но в
  ;    NSIS installer обычно elevation уже было.
  nsExec::ExecToLog 'sc stop AriyHelper'
  Sleep 1500
  ; 3. Имена процессов: пробуем оба варианта — без target-triple суффикса
  ;    (это финальные имена в production install) и с суффиксом (это имена
  ;    в dev-сборке Tauri-sidecar). На проде второй вариант — no-op.
  nsExec::ExecToLog 'taskkill /F /T /IM ariy-helper.exe'
  nsExec::ExecToLog 'taskkill /F /T /IM ariy-helper-x86_64-pc-windows-msvc.exe'
  nsExec::ExecToLog 'taskkill /F /T /IM sing-box.exe'
  nsExec::ExecToLog 'taskkill /F /T /IM sing-box-x86_64-pc-windows-msvc.exe'
  nsExec::ExecToLog 'taskkill /F /T /IM mihomo.exe'
  nsExec::ExecToLog 'taskkill /F /T /IM mihomo-x86_64-pc-windows-msvc.exe'
  ; Маленькая пауза — kernel освобождает file-handles после exit.
  Sleep 800
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Stopping Ariy VPN processes before uninstall..."
  nsExec::ExecToLog 'taskkill /F /T /IM "Ariy VPN.exe"'
  nsExec::ExecToLog 'sc stop AriyHelper'
  Sleep 1500
  nsExec::ExecToLog 'taskkill /F /T /IM ariy-helper.exe'
  nsExec::ExecToLog 'taskkill /F /T /IM ariy-helper-x86_64-pc-windows-msvc.exe'
  nsExec::ExecToLog 'taskkill /F /T /IM sing-box.exe'
  nsExec::ExecToLog 'taskkill /F /T /IM sing-box-x86_64-pc-windows-msvc.exe'
  nsExec::ExecToLog 'taskkill /F /T /IM mihomo.exe'
  nsExec::ExecToLog 'taskkill /F /T /IM mihomo-x86_64-pc-windows-msvc.exe'
  Sleep 800
  ; После stop сервис всё ещё зарегистрирован в SCM. При полной
  ; деинсталляции удаляем чтобы не оставлять "висящую" запись.
  nsExec::ExecToLog 'sc delete AriyHelper'
!macroend
