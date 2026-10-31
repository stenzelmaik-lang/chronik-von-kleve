# Lokale Abnahme: Universelles Spielmaterial-, Asset- und Präsentationssystem 3.0.
# Eigener Port (8893) und eigener Testspeicher (.local-test/material-3 in diesem Worktree) mit ausschließlich
# synthetischen Konten und Bildern. Der Abend startet automatisch. Keine Verbindung zu Produktion.
#   .\scripts\start-material-3.ps1          # vorhandenen Build starten
#   .\scripts\start-material-3.ps1 -Build   # vorher neu bauen (Server muss gestoppt sein)
#   .\scripts\start-material-3.ps1 -Reset   # Testspeicher verwerfen und neu anlegen (Server muss gestoppt sein)
param([switch]$Build,[switch]$Reset)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if ($Reset -and (Test-Path '.local-test/material-3')) { Remove-Item -Recurse -Force '.local-test/material-3' }
if ($Build -or -not (Test-Path 'dist/server/wrangler.json')) { node scripts/run-framework.mjs build; if ($LASTEXITCODE) { exit $LASTEXITCODE } }
if (-not $env:CVK_TEST_PORT) { $env:CVK_TEST_PORT = '8893' }
$url = "http://127.0.0.1:$($env:CVK_TEST_PORT)"
Write-Host "Spielmaterial 3.0: $url/anmelden"
Write-Host '  SL: command-gm@example.invalid  |  Spieler: command-a@ / command-b@example.invalid (Passwort in scripts/test-local.mjs)'
Write-Host "  Vorbereiten: $url/sl/command-center?bereich=vorbereitung&material=szenen (Szene 01 – Kaserne, Szene 02 – Keller)"
Write-Host "  Ausspielen: $url/sl/regie  |  Am Tisch: $url/spielbereich?bereich=sitzung"
node --experimental-strip-types scripts/test-local.mjs --material-3
