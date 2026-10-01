@echo off
setlocal
cd /d "%~dp0"
set "CHRONIPLAY_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%CHRONIPLAY_NODE%" goto run
set "CHRONIPLAY_NODE="
for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined CHRONIPLAY_NODE set "CHRONIPLAY_NODE=%%N"
if defined CHRONIPLAY_NODE goto run
echo Node.js fehlt. Benoetigt wird die vorhandene Codex-Laufzeit oder Node.js ab 22.13.
pause
exit /b 1
:run
"%CHRONIPLAY_NODE%" scripts/start-local-access.mjs
if errorlevel 1 pause
