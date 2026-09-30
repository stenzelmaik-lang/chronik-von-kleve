@echo off
setlocal
cd /d "%~dp0"
set "CP_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%CP_NODE%" set "CP_NODE=node"
"%CP_NODE%" -e "const s=require('node:net').createConnection(8794,'127.0.0.1');s.once('connect',()=>{console.error('Port 8794 ist bereits belegt. Die laufende Anwendung bleibt erhalten.');s.destroy();process.exit(1)});s.once('error',()=>process.exit(0));s.setTimeout(1000,()=>process.exit(1));"
if errorlevel 1 goto stopped
if not exist "node_modules\miniflare" (
  echo Projektabhaengigkeiten fehlen. Bitte die bestehende lokale Arbeitskopie verwenden.
  goto stopped
)
echo ChroniPlay - ausschliesslich lokale synthetische Testdaten.
"%CP_NODE%" scripts/run-framework.mjs build
if errorlevel 1 goto stopped
echo Oeffne http://127.0.0.1:8794/anmelden
echo Dieses Fenster offen lassen. Beenden mit Strg+C.
"%CP_NODE%" scripts/test-local.mjs --weekend
:stopped
pause
