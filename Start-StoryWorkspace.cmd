@echo off
setlocal
cd /d "%~dp0"
set "CHRONIPLAY_NODE=C:\Users\Stenz\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%CHRONIPLAY_NODE%" (
  echo Lokale Node-Laufzeit nicht gefunden. Bitte Codex zur Reparatur oeffnen.
  pause
  exit /b 1
)
if not exist "dist\server\wrangler.json" (
  "%CHRONIPLAY_NODE%" scripts/run-framework.mjs build
  if errorlevel 1 exit /b 1
)
echo Story-Arbeitsbereich: http://127.0.0.1:8802/sl/command-center
"%CHRONIPLAY_NODE%" scripts/test-local.mjs --story-workspace
pause
