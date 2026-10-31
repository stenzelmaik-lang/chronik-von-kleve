# Lokale Abnahme: Live-Regie im Zweitfenster.
# Eigener Port (8870) und eigener Testspeicher (.local-test/regie in diesem Worktree) mit ausschließlich
# synthetischen Konten. Der Abend startet automatisch. Keine Verbindung zu Produktion.
#   .\scripts\start-regie.ps1          # vorhandenen Build starten
#   .\scripts\start-regie.ps1 -Build   # vorher neu bauen (Server muss gestoppt sein)
#   .\scripts\start-regie.ps1 -Reset   # Testspeicher verwerfen und neu anlegen (Server muss gestoppt sein)
param([switch]$Build,[switch]$Reset)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if ($Reset -and (Test-Path '.local-test/regie')) { Remove-Item -Recurse -Force '.local-test/regie' }
if ($Build -or -not (Test-Path 'dist/server/wrangler.json')) { node scripts/run-framework.mjs build; if ($LASTEXITCODE) { exit $LASTEXITCODE } }
if (-not $env:CVK_TEST_PORT) { $env:CVK_TEST_PORT = '8870' }
$url = "http://127.0.0.1:$($env:CVK_TEST_PORT)"
Write-Host "Live-Regie: $url/anmelden"
Write-Host '  SL: command-gm@example.invalid  |  Spieler: command-a@ / command-b@example.invalid (Passwort in scripts/test-local.mjs)'
Write-Host "  Spieltisch: $url/spielbereich?bereich=sitzung  |  Regie: Button 'Regie im zweiten Fenster' oder $url/sl/regie"
node --experimental-strip-types scripts/test-local.mjs --regie
