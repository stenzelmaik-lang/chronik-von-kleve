param([switch]$Build)
# Isolierte lokale Testinstanz fuer das Postfach (Archiv, Papierkorb, Anhaenge, Uebernahme in Notizen).
# Nur synthetische Konten und Daten unter .local-test/nachrichten. Keine produktiven Daten.
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$codexNode = 'C:\Users\Stenz\AppData\Local\OpenAI\Codex\runtimes\cua_node\5c41f77a7900391c\bin'
if (Test-Path -LiteralPath $codexNode) { $env:Path = $codexNode + ';' + $env:Path }
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) { throw 'Node wurde nicht gefunden.' }
if (Get-NetTCPConnection -LocalPort 8850 -State Listen -ErrorAction SilentlyContinue) { Write-Host 'Postfach-Testinstanz laeuft bereits: http://127.0.0.1:8850/anmelden'; exit 0 }
$env:WORKERS_CI = '0'
$env:WRANGLER_SEND_METRICS = 'false'
if ($Build -or -not (Test-Path -LiteralPath 'dist/server/wrangler.json')) {
  node scripts/run-framework.mjs build
  if ($LASTEXITCODE -ne 0) { throw 'Build fehlgeschlagen. Es wurde kein Server gestartet.' }
}
Write-Host 'Nur isolierte lokale Testdaten. Konten: command-gm@example.invalid, command-a@example.invalid, command-b@example.invalid'
Write-Host 'Passwort: siehe Repo-Fixture in scripts/test-local.mjs'
Write-Host 'Im Browser oeffnen: http://127.0.0.1:8850/anmelden'
node scripts/test-local.mjs --nachrichten
