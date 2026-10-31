# Lokale Abnahme: W10-Hybrid Phase B (serverseitige Würfelvorschau aus dem Charakterbogen).
# Eigener Port (8878) und eigener Testspeicher (.local-test/w10-hybrid in diesem Worktree) mit ausschließlich
# synthetischen Konten (SL, Spieler A, Spieler B). Nur diese Instanz setzt W10_HYBRID_PREVIEW=local-only;
# ohne diese Bindung antwortet /api/w10-preview mit 404. Keine Verbindung zu Produktion, kein Würfeln, keine Buchung.
#   .\scripts\start-w10-hybrid.ps1          # vorhandenen Build starten
#   .\scripts\start-w10-hybrid.ps1 -Build   # vorher neu bauen (Server muss gestoppt sein)
#   .\scripts\start-w10-hybrid.ps1 -Reset   # Testspeicher verwerfen und neu anlegen (Server muss gestoppt sein)
param([switch]$Build,[switch]$Reset)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if ($Reset -and (Test-Path '.local-test/w10-hybrid')) { Remove-Item -Recurse -Force '.local-test/w10-hybrid' }
if ($Build -or -not (Test-Path 'dist/server/wrangler.json')) { node scripts/run-framework.mjs build; if ($LASTEXITCODE) { exit $LASTEXITCODE } }
if (-not $env:CVK_TEST_PORT) { $env:CVK_TEST_PORT = '8878' }
$url = "http://127.0.0.1:$($env:CVK_TEST_PORT)"
Write-Host "W10-Hybrid Phase B: $url/anmelden"
Write-Host '  SL: command-gm@example.invalid  |  Spieler: command-a@ / command-b@example.invalid (Passwort in scripts/test-local.mjs)'
Write-Host "  Vorschau: POST $url/api/w10-preview  {characterId, selection:{attributeId, abilityId?}, declared:{baseDifficulty}}"
Write-Host ("  Abnahme:  `$env:CVK_TEST_URL = '$url'; node --experimental-strip-types tests/w10-hybrid-integration.mjs")
node --experimental-strip-types scripts/test-local.mjs --w10-hybrid
