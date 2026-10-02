@echo off
setlocal
cd /d "%~dp0"
set "CHRONIPLAY_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%CHRONIPLAY_NODE%" (
  echo Die mit Codex bereitgestellte Node-Laufzeit wurde nicht gefunden.
  echo Bitte ChroniPlay zuerst in Codex oeffnen.
  pause
  exit /b 1
)
set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
"%CHRONIPLAY_NODE%" scripts\start-local-inventory.mjs
pause
