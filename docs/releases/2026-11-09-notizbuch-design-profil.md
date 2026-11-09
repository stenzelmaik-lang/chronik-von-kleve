# Release 09.11.2026: Notizbuch, Designgrundlage, V20-Bogen, Charakterprofil

Freigabe des Besitzers (09.11.): „wenn du das alles fertig hast, kannst du es bitte einmal live schieben mit allem, was wir … seit gestern alles mit hast“.

| | |
|---|---|
| Live-Codecommit | `5ce9dc1` auf `claude/anwenden-designgrundlage` (enthält `claude/journal-release` 5f4bf8a/f57d990 und `origin/main` acbc62d) |
| Worker-Version | `c7cb9a93-5dd7-4d97-8073-0ea5f991f967`, Tag `5ce9dc1-Notizbuch-Design-Profil` |
| Zeitpunkt | 2026-11-09T09:35:42Z |
| Vorversion | `240e208e-a57f-4f46-9d07-1992ecca6373` (Tag `f57d990-Journal-SL`) |
| Migration | keine (seit der Vorversion keine neuen Dateien in `drizzle/`) |
| D1-Lesezeichen vor dem Deploy | `000001f0-00000a00-0000511e-2bfebac6d9cf321249d6c7d6a2f5d402` |
| Konfiguration | wie Vorversion: D1 `chronik-von-kleve-db`, R2 `chronik-von-kleve-r2`, `AUTH_ACCESS_ENVIRONMENT=closed-alpha-production`, `GE01_ALPHA_CAMPAIGNS=chronik-von-kleve`, `AJ01_JOURNAL_CAMPAIGNS=chronik-von-kleve` (ohne Wirkung, Journal ist entfernt), `limits.cpu_ms=5000` |

## Inhalt
Etappen 1–4b des Auftrags „Journal ad acta, Notizbuch, Optik“: Journal AJ-01 entfernt (Einträge bleiben Charakternotizen), privates Notizbuch, Designgrundlage (Spectral/Plex, Tealgrau), V20-Bogenansicht, Charakterbereich neu (Menüleiste, Clan-Banner, Reiter), Charakterprofil als ein System mit Freigabe je Block und einer Bilderliste, erweiterter Texteditor (Absatzformate, Durchstreichen, Ausrichtung, Farbrad), Galerie im Teilnehmermenü am Spieltisch, keine Charakterwahl und keine Schnellbuchung mehr im Teilnehmermenü.

## Prüfungen vor dem Deploy
Typecheck sauber; `pnpm test` 408/408; Gesamtlauf `tests/*.test.mjs` 522/528 (6 bekannte Altfälle: 4 NPC, 2 Ortsdossier ERR_MODULE_NOT_FOUND); ESLint ohne Fehler in den seit der Vorversion geänderten Dateien (Gesamtlint hat Altfehler u. a. in `prototypes/`); Profil-Integration 24/24 lokal; Build grün; `wrangler deploy --dry-run` mit den Produktionsbindungen.

## Nach dem Deploy (ohne Anmeldung)
`/anmelden` 200, `/spielbereich` 307, `/api/character-companion`, `/api/character-detail`, `/api/live-participants` je 401. Neue Client-Bundles (Charakterprofil-Bilderliste, Farbrad) werden von chroniplay.cc ausgeliefert. Nicht geprüft: angemeldete Live-Begehung (macht der Besitzer), echtes Mobilgerät.

## Rückweg
`wrangler rollback 240e208e-a57f-4f46-9d07-1992ecca6373 --name chronik-von-kleve` (keine Schemaänderung). Hinweis: Neu gespeicherte Profile, Bilderlisten und Texte bleiben in den Daten. Die Vorversion kennt freie Farben, Durchstreichen und die neuen Absatzklassen nicht; solche Texte zeigt sie möglicherweise nicht formatiert an (nicht geprüft).

## Offen
`main` enthält den Live-Stand noch nicht. Veraltet: `tests/zustandswerte-runde-browser.mjs` nutzt die entfernte Schnellbuchung „Eigene Werte steuern“.
