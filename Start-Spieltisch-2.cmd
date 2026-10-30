@echo off
setlocal
cd /d "%~dp0"
rem Isolated local Spieltisch 2.0 demo: synthetic data only, port 8830, store .local-test\spieltisch-2.
set "CHRONIPLAY_NODE="
for %%N in ("C:\Users\Stenz\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "C:\Users\Stenz\AppData\Local\OpenAI\Codex\runtimes\cua_node\5c41f77a7900391c\bin\node.exe") do if not defined CHRONIPLAY_NODE if exist %%N set "CHRONIPLAY_NODE=%%~N"
if not defined CHRONIPLAY_NODE where node >nul 2>nul && set "CHRONIPLAY_NODE=node"
if not defined CHRONIPLAY_NODE (
  echo Lokale Node-Laufzeit nicht gefunden.
  pause
  exit /b 1
)
if not exist "dist\server\wrangler.json" (
  "%CHRONIPLAY_NODE%" scripts/run-framework.mjs build
  if errorlevel 1 exit /b 1
)
echo Spieltisch 2.0 (lokal, synthetisch): http://127.0.0.1:8830/anmelden
"%CHRONIPLAY_NODE%" --experimental-strip-types scripts/test-local.mjs --spieltisch-2
pause
