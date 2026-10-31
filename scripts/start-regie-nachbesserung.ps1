# Lokale Abnahme: Regie-Nachbesserung (Regie-Fenster mit Bereichsmenü, Pager-Empfang und SL-Spiegel,
# neue Atmosphäre-Effekte mit Überblenden, YouTube-Musik mit Einwilligung).
# Eigener Port (8881) und der synthetische Testspeicher .local-test/ultio-pager in diesem Worktree; nur synthetische Konten.
# Der Abend startet automatisch. Keine Verbindung zu Produktion.
#   .\scripts\start-regie-nachbesserung.ps1          # vorhandenen Build starten
#   .\scripts\start-regie-nachbesserung.ps1 -Build   # vorher neu bauen (Server muss gestoppt sein)
#   .\scripts\start-regie-nachbesserung.ps1 -Reset   # Testspeicher verwerfen und neu anlegen (Server muss gestoppt sein)
param([switch]$Build,[switch]$Reset)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if ($Reset -and (Test-Path '.local-test/ultio-pager')) { Remove-Item -Recurse -Force '.local-test/ultio-pager' }
if ($Build -or -not (Test-Path 'dist/server/wrangler.json')) { node scripts/run-framework.mjs build; if ($LASTEXITCODE) { exit $LASTEXITCODE } }
if (-not $env:CVK_TEST_PORT) { $env:CVK_TEST_PORT = '8881' }
$url = "http://127.0.0.1:$($env:CVK_TEST_PORT)"
Write-Host "Regie-Nachbesserung: $url/anmelden"
Write-Host '  SL: command-gm@example.invalid  |  Spieler: command-a@ / command-b@example.invalid (Passwort in scripts/test-local.mjs)'
Write-Host "  Spieltisch: $url/spielbereich?bereich=sitzung  |  Regie-Fenster: $url/sl/regie"
Write-Host "  YouTube in Szenen vorbereiten: $url/sl/command-center (Szene > Atmosphäre > Musik von YouTube)"
node --experimental-strip-types scripts/test-local.mjs --ultio-pager
