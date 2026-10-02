@echo off
setlocal
set "CHRONIPLAY_CONCEPT_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%CHRONIPLAY_CONCEPT_NODE%" goto run
for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined CHRONIPLAY_CONCEPT_FALLBACK set "CHRONIPLAY_CONCEPT_FALLBACK=%%N"
if defined CHRONIPLAY_CONCEPT_FALLBACK set "CHRONIPLAY_CONCEPT_NODE=%CHRONIPLAY_CONCEPT_FALLBACK%"
if exist "%CHRONIPLAY_CONCEPT_NODE%" goto run
echo Die vorhandene Node-Laufzeit wurde nicht gefunden. Es wurde nichts installiert.
pause
exit /b 1
:run
echo Nur synthetischer lokaler Konzeptmodus. Keine D1/R2-Verbindung.
echo Danach http://127.0.0.1:8797/ im Browser oeffnen.
echo Dieses Fenster offen lassen. Mit Strg+C den Konzeptserver beenden.
"%CHRONIPLAY_CONCEPT_NODE%" "%~dp0serve-concept.mjs"
if errorlevel 1 pause
