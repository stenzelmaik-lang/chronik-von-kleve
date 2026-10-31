# Lokale Abnahme der Erzählungsansicht am Spieltisch (UX-18 bis UX-21).
# Eigener Port (8864) und eigener Testspeicher (.local-test/zustandswerte in diesem Worktree)
# mit ausschließlich synthetischen Konten. Der Abend startet automatisch; die Kaserne-Szene
# enthält einen langen synthetischen Vorlesetext. Keine Verbindung zu Produktion.
#   .\scripts\start-erzaehlung.ps1          # vorhandenen Build starten
#   .\scripts\start-erzaehlung.ps1 -Build   # vorher neu bauen (Server muss gestoppt sein)
param([switch]$Build)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if ($Build -or -not (Test-Path 'dist/server/wrangler.json')) { node scripts/run-framework.mjs build; if ($LASTEXITCODE) { exit $LASTEXITCODE } }
$env:CVK_TEST_PORT = '8864'
Write-Host 'Erzählung am Spieltisch: http://127.0.0.1:8864/anmelden (SL: command-gm, Spieler: command-a / command-b)'
node --experimental-strip-types scripts/test-local.mjs --zustandswerte
