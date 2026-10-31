# Lokale Abnahme: ULTIO Pager R-03 (vorbereiten im Command Center, ausspielen in der Regie, empfangen am Spieltisch).
# Eigener Port (8874) und eigener Testspeicher (.local-test/ultio-pager in diesem Worktree) mit ausschließlich
# synthetischen Konten. Der Abend startet automatisch; die Kaserne-Szene enthält zwei vorbereitete Pager. Keine Verbindung zu Produktion.
#   .\scripts\start-ultio-pager.ps1          # vorhandenen Build starten
#   .\scripts\start-ultio-pager.ps1 -Build   # vorher neu bauen (Server muss gestoppt sein)
#   .\scripts\start-ultio-pager.ps1 -Reset   # Testspeicher verwerfen und neu anlegen (Server muss gestoppt sein)
param([switch]$Build,[switch]$Reset)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if ($Reset -and (Test-Path '.local-test/ultio-pager')) { Remove-Item -Recurse -Force '.local-test/ultio-pager' }
if ($Build -or -not (Test-Path 'dist/server/wrangler.json')) { node scripts/run-framework.mjs build; if ($LASTEXITCODE) { exit $LASTEXITCODE } }
if (-not $env:CVK_TEST_PORT) { $env:CVK_TEST_PORT = '8874' }
$url = "http://127.0.0.1:$($env:CVK_TEST_PORT)"
Write-Host "ULTIO-Pager: $url/anmelden"
Write-Host '  SL: command-gm@example.invalid  |  Spieler: command-a@ / command-b@example.invalid (Passwort in scripts/test-local.mjs)'
Write-Host "  Vorbereiten: $url/sl/command-center (Szene 'Kaserne' > Interaktionen > Spielmaterial > Pager-Nachricht)"
Write-Host "  Ausspielen: $url/sl/regie  |  Empfangen: $url/spielbereich?bereich=sitzung (als Spieler)"
node --experimental-strip-types scripts/test-local.mjs --ultio-pager
