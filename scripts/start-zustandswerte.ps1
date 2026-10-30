# Lokale Abnahme Zustandswerte am Spieltisch (Blut, Willenskraft, Gesundheit, Gruppenstress, Maskerade).
# Eigener Port (8852) und eigener Testspeicher (.local-test/zustandswerte) mit
# ausschließlich synthetischen Konten. Keine Verbindung zu Produktion.
#   .\scripts\start-zustandswerte.ps1          # vorhandenen Build starten
#   .\scripts\start-zustandswerte.ps1 -Build   # vorher neu bauen (Server muss gestoppt sein)
param([switch]$Build)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if ($Build -or -not (Test-Path 'dist/server/wrangler.json')) { node scripts/run-framework.mjs build; if ($LASTEXITCODE) { exit $LASTEXITCODE } }
$env:CVK_TEST_PORT = '8852'
Write-Host 'Zustandswerte am Spieltisch: http://127.0.0.1:8852/anmelden (SL: command-gm, Spieler: command-a / command-b)'
node --experimental-strip-types scripts/test-local.mjs --zustandswerte
