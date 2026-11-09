# Release 09.11.2026 (Nachmittag): Gesamtstand nach fremder Überschreibung

Freigabe des Besitzers (09.11.): „alles, was du heute gemacht hast und gestern, zusammen mergen wieder und alles wieder hochbringen“.

## Befund vorher
- 10:32 UTC: `77e37548` (4c, Tag `79e256a-Zuflucht-Navigation`) live.
- **10:42 UTC: fremde Version `d88fd748`** hochgeladen, gleiches Cloudflare-Konto, Quelle „version_upload“, **ohne Tag und Nachricht**, nur mit `AUTH_ACCESS_ENVIRONMENT` (es fehlten `GE01_ALPHA_CAMPAIGNS` und `AJ01_JOURNAL_CAMPAIGNS`).
- Inhalt per Fingerabdruck der ausgelieferten Client-Bundles: Stand des Vormittags-Releases (Notizbuch, Design, Charakterprofil, Editor) **ohne 4c** („Spielerzentrale“, „Chronik erkunden“ vorhanden; „Die Welt“, „Zur Zuflucht“ fehlten). Kein passender Build-Ordner auf diesem Rechner, kein neuer Branch auf GitHub. Herkunft ungeklärt.

## Zusammengeführt
`claude/navigation` enthielt bereits `claude/journal-release`, `journal-ad-acta`, `notizbuch`, `designgrundlage`, `anwenden-designgrundlage` und `main`. Dazu gemergt (nur Doku/Fixture, kein Code): `origin/codex/live-source-2026-11-07` (README), `claude/notizbuch-bestandsaufnahme` (Bestandsaufnahme), `claude/testdaten-aufraeumen` (unbenutzte Testdatei entfernt).

| | |
|---|---|
| Live-Codecommit | `48b094a` auf `claude/navigation` |
| Worker-Version | `754ca503-e1be-4cfc-bc7c-7ee390aed9c9`, Tag `48b094a-Gesamtstand` |
| Zeitpunkt | 2026-11-09T13:45:57Z |
| Ersetzt | `d88fd748-f9dc-4bea-8fc6-271af3bb9738` (fremd) |
| Migration | keine |
| D1-Lesezeichen vor dem Deploy | `000001f1-0000052c-0000511e-242eb4e8b55fd7d1d01c26e2da2ce1c4` |
| Konfiguration | wiederhergestellt: D1 `chronik-von-kleve-db`, R2 `chronik-von-kleve-r2`, `AUTH_ACCESS_ENVIRONMENT=closed-alpha-production`, `GE01_ALPHA_CAMPAIGNS=chronik-von-kleve`, `AJ01_JOURNAL_CAMPAIGNS=chronik-von-kleve`, `limits.cpu_ms=5000` |

## Prüfungen
Typecheck sauber; `pnpm test` 411/411; Gesamtlauf 525/531 (6 bekannte Altfälle); Build grün; Probelauf mit Produktionsbindungen. Nach dem Deploy: `/anmelden` 200, `/spielbereich` 307, geschützte Routen 401. Fingerabdruck live: „Zur Zuflucht“, „Die Welt“, „So sieht es aus“, „Eigene Textfarbe“, „Porträt und Referenzbilder“, „Erfahrung & Entwicklung“ vorhanden; „Spielerzentrale“, „Chronik erkunden“ nicht mehr.

## Rückweg
`wrangler rollback 77e37548-eaf2-4701-b60d-4d63c61c44a9 --name chronik-von-kleve` (4c ohne die Nachträge). Nicht auf `d88fd748` zurück (fehlende Variablen).

## Offen
Wer `d88fd748` hochgeladen hat, ist ungeklärt. Vor jedem weiteren Deploy die Live-Version prüfen (`wrangler deployments list`). Andere Werkzeuge (Codex, ChatGPT-Hosting) sollten vom Live-Stand `main` ausgehen.
