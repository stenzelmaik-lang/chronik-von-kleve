# Release 07.11.2026 · Abenteuerjournal AJ-01 (erste Version)

Freigabe des Projektinhabers: „okey erstmal live bringen als erste version akzeptiert“ und „Trotzdem deployen“; Live-Quellstand anschließend von Codex als `5e6ae31` bereitgestellt.

| | |
|---|---|
| Code | Branch `claude/journal-release`, Commit `ae55490` = Live-Quellstand `5e6ae31` (`codex/live-source-2026-11-07`) + Journal `606c69e` + Doku. **Nicht in `main`.** |
| Worker | `chronik-von-kleve`, Version **`9ecd595a-a629-46a7-97f4-fb292616fb77`**, Tag `ae55490-Abenteuerjournal`, 100 % seit 2026-11-07T19:16Z |
| Vorversion (Rückfall) | `ec57ff4e-1209-4c3d-8129-810298eb93f7`, Tag `Regie-Nachbesserung-20261107` |
| Konfiguration | wie Vorversion (D1 `chronik-von-kleve-db`, R2 `chronik-von-kleve-r2`, `AUTH_ACCESS_ENVIRONMENT=closed-alpha-production`, `GE01_ALPHA_CAMPAIGNS=chronik-von-kleve`), neu `AJ01_JOURNAL_CAMPAIGNS=chronik-von-kleve` |
| Datenbank | keine Migration; D1-Time-Travel-Lesezeichen vor dem Deploy `000001ed-000001d6-0000511c-15ea95719c9def459e2a530c73b2c11d` |
| Konflikte beim Zusammenführen | `app/api/character-companion/route.ts` (Präsentationsschema + Journal-Felder, beide übernommen), `package.json` (Testliste des Live-Stands + `tests/journal.test.mjs`, Skript `test:journal`) |

## Prüfungen auf `ae55490`
Typecheck ok · Lint der berührten Dateien ok · `pnpm test` 388/388 · Build ok · `test:integration:run` Exit 0 (2.151 Prüfungen + 46 D1-Rollenprüfungen) · `tests/journal-integration.mjs` 38/38 · Browser lokal: Buch erscheint am Tisch und schlägt auf · Dry-Run mit identischen Bindungen.

## Nach dem Deploy (ohne Anmeldung)
`chroniplay.cc/anmelden` 200; workers.dev leitet auf chroniplay.cc um; `/spielbereich` 307; `character-selection`, `records`, `character-detail`, `live-table`, `PATCH character-companion` 401; Journal-Bundle `workspace-BFMOO8nv.js` 200 mit Journal-Code.
**Nicht geprüft:** Funktionen mit Anmeldung auf Produktion (keine echten Zugangsdaten), echtes Mobilgerät.

## Rückfall
Journal aus ohne Codeänderung: Variable `AJ01_JOURNAL_CAMPAIGNS` leeren (neue Version). Code: `wrangler rollback ec57ff4e-1209-4c3d-8129-810298eb93f7 --name chronik-von-kleve` (kompatibel, keine Schemaänderung; gespeicherte Journal-Einträge bleiben als normale Charakternotizen).

## Offen
`main` enthält weder den Live-Quellstand noch das Journal; vor dem nächsten Deployment `claude/journal-release` nach `main` zusammenführen oder als Basis nehmen.
