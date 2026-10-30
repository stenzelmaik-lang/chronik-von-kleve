# Lokale Abnahme Spieler- und Charakterverwaltung 3.0.
# Eigener Port (8846) und eigener Testspeicher (.local-test/charakter-3) mit
# ausschließlich synthetischen Konten. Keine Verbindung zu Produktion.
#   .\scripts\start-charakter-3.ps1          # vorhandenen Build starten
#   .\scripts\start-charakter-3.ps1 -Build   # vorher neu bauen (Server muss gestoppt sein)
param([switch]$Build)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if ($Build -or -not (Test-Path 'dist/server/wrangler.json')) { node scripts/run-framework.mjs build; if ($LASTEXITCODE) { exit $LASTEXITCODE } }
$env:CVK_TEST_PORT = '8846'
Write-Host 'Spieler- und Charakterverwaltung 3.0: http://127.0.0.1:8846/sl/command-center?bereich=charaktere'
node --experimental-strip-types scripts/test-local.mjs --charakter-3
