$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$taskNode = Get-Command node.exe -ErrorAction SilentlyContinue
if ($taskNode) { $taskNodePath = $taskNode.Source }
else { $taskNodePath = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $taskNodePath)) { throw 'Die vorhandene Node-Laufzeit wurde nicht gefunden. Bitte Codex oeffnen; keine systemweite Installation erforderlich.' }
$taskPort = Get-NetTCPConnection -LocalPort 8798 -State Listen -ErrorAction SilentlyContinue
if ($taskPort) { Write-Host 'Command Center laeuft bereits auf http://127.0.0.1:8798/spielbereich?bereich=sitzung'; exit 0 }
$env:WORKERS_CI = '0'
$env:WRANGLER_SEND_METRICS = 'false'
& $taskNodePath scripts/run-framework.mjs build
if ($LASTEXITCODE -ne 0) { throw 'Build fehlgeschlagen. Es wurde kein Server gestartet.' }
Write-Host 'Nur isolierte lokale Testdaten. SL: command-gm@example.invalid; Passwort: ChroniPlay-Demo-2036!'
Write-Host 'Im Browser oeffnen: http://127.0.0.1:8798/anmelden'
& $taskNodePath scripts/test-local.mjs --command-center-2
