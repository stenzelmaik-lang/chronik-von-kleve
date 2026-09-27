# Lokaler Testlauf mit Cloudflare-Testressourcen

Diese getrennte Testkonfiguration ist ausschließlich für lokalen Vite-Betrieb bestimmt. Sie schaltet weder die Cloudflare-Preview-Einstellungen um noch verändert sie die bestehenden Produktionsbindungen.

## Fest erlaubte Ressourcen

- D1 `chronik-von-kleve-phase-c-db` — `93863382-2046-4efc-a5b7-7eb1306955f9`
- R2 `chronik-von-kleve-phase-c-r2`
- Cloudflare-Account `688c841e3110458e2e64b001c3291920`
- Vite-Server nur lokal an `127.0.0.1:5181`

Der Resolver enthält ausschließlich diese festen Namen und IDs. Er bricht ab, wenn das explizite lokale Opt-in fehlt oder ein Workers-Build, CI- oder Produktionskontext erkannt wird. Es gibt keine Eingabe für Produktionsressourcen. Der separate Wrangler-Preflight enthält nur die Test-D1 und den Test-R2. Vor dem App-Start verweigert das Skript außerdem `.dev.vars`-/`.env`-Dateien und Prozessumgebungs-Injektion. Der Vite-Prozess erbt nur eine kleine Betriebssystem-Umgebung und ausdrücklich keine Cloudflare-Zugangsdaten. Das folgt Cloudflares Empfehlung, lokale Secrets getrennt von produktiven Werten zu halten.

## Ausführung

In einer normalen PowerShell im Wurzelordner dieser Arbeitskopie, nach Installation der Projektabhängigkeiten und interaktiver Wrangler-Anmeldung:

```powershell
& 'C:\Users\Stenz\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'scripts\run-cloudflare-remote-test.mjs' --verify-targets-only
```

Dieser Schritt fragt nur die exakte D1-ID und die R2-Bucket-Identität ab. Er startet keine Anwendung und führt keine SQL-Schreiboperation aus. Ein normaler Lauf führt vor dem App-Start denselben Identitätscheck aus und verlangt zusätzlich den vollständigen Quellstand bis Migration 0006 sowie eine Test-D1, deren Schema und Wrangler-Migrationsledger diese 0006 ausweisen. Neben den Bestands-/Phase-C-Tabellen müssen die fünf Auth-Tabellen `auth_users`, `auth_identities`, `auth_sessions`, `auth_member_links` und `auth_rate_limits` vorhanden sein. Fehlende Quellen, Tabellen oder Migrationsnachweise stoppen den Runner ohne Migration.

Erst nachdem die vollständige Release-Kandidatenquelle einschließlich Migration 0006 integriert und die gesonderten Testmigrationen genehmigt und ausgeführt wurden, kann der lokale Server gestartet werden:

```powershell
& 'C:\Users\Stenz\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'scripts\run-cloudflare-remote-test.mjs'
```

Der Runner zeigt vorher Account, Datenbank-ID und Bucket an. Er startet nur nach Eingabe der vollständigen Testbestätigung. Die lokale Anwendung kann danach tatsächliche Änderungen in den beiden bestätigten Cloudflare-Testressourcen speichern. Port 5181 wird strikt geprüft; ist er belegt, stoppt der Runner und beendet keinen fremden Prozess. `Ctrl+C` stoppt nur den von ihm gestarteten Vite-Server.

## Grenzen und aktueller Stand

- Der Runner führt keine Migration, Backfill-, Deployment-, Push- oder Produktionsoperation aus.
- Die aktuelle Test-D1 enthielt bei der letzten lesenden Prüfung nur `_cf_KV`; deshalb würde der normale Start derzeit wegen fehlender Basistabellen stoppen.
- Ein Wrangler-Login ist ein separates, interaktives Konto-Setup. Der Runner erzeugt oder speichert keine Zugangsdaten. In einer nicht interaktiven Umgebung ohne Wrangler-Anmeldung verweigert er den Start.
- Die aktuelle Arbeitskopie enthält `.dev.vars`; deshalb stoppt ein normaler Lauf nach der reinen Ressourcen-Identitätsprüfung vor Schemaabfrage und App-Start. Die Datei wurde nicht geöffnet oder verändert. Für spätere Browser-Tests muss eine separat geprüfte test-only Secret-Konfiguration bereitgestellt werden.
- Der tatsächliche `--verify-targets-only`-Versuch in dieser Ausführungsumgebung scheiterte vor Cloudflare-Antwort mangels Wrangler-Anmeldung bzw. `CLOUDFLARE_API_TOKEN`; daher ist die D1-ID/R2-Identität nicht durch diesen Runner-Lauf bestätigt. Frühere Audit-Bestätigung stammte aus einem separaten Cloudflare-API-Lesezugriff.
- `remote: true` bedeutet, dass Worker-Code lokal läuft, Binding-Schreibzugriffe aber wirklich die angegebenen Remote-Testressourcen verändern.
