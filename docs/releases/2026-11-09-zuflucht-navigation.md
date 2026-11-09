# Release 09.11.2026: Zuflucht und Navigation (Etappe 4c)

Freigabe des Besitzers (09.11.): „Ja, live bringen“ nach Fassung 3 der Zieltabelle.

| | |
|---|---|
| Live-Codecommit | `79e256a` auf `claude/navigation` (enthält `main` a898355) |
| Worker-Version | `77e37548-eaf2-4701-b60d-4d63c61c44a9`, Tag `79e256a-Zuflucht-Navigation` |
| Zeitpunkt | 2026-11-09T10:32:52Z |
| Vorversion | `c7cb9a93-5dd7-4d97-8073-0ea5f991f967` (Tag `5ce9dc1-Notizbuch-Design-Profil`) |
| Migration | keine |
| D1-Lesezeichen vor dem Deploy | `000001f0-000026f2-0000511e-b5533193198577e2d7255c2410417330` |
| Konfiguration | unverändert zur Vorversion (D1 `chronik-von-kleve-db`, R2 `chronik-von-kleve-r2`, drei Variablen, `limits.cpu_ms=5000`) |

## Inhalt
Kopfleiste mit Zuflucht, Spieltisch (live/nicht live), Dropdowns „Die Welt“ und „Command Center“ (nur SL); Startseite „Zuflucht“ mit Galerie-Vorschau, „Alle Rückblicke“ und sieben Kacheln; Spieltisch verlassen führt zur Zuflucht; Spielergalerie mit neuer Route `GET /api/character-gallery`; Rückblicke-Liste. Kein Seitenmenü.

## Prüfungen vor dem Deploy
Typecheck sauber; `pnpm test` 411/411; Gesamtlauf 525/531 (6 bekannte Altfälle); ESLint 0 Fehler in geänderten Dateien; Profil-Integration 29/29 lokal inkl. Galerie-Rechte; Build grün; Probelauf mit Produktionsbindungen.

## Nach dem Deploy (ohne Anmeldung)
`/anmelden` 200, `/spielbereich` 307, `/api/character-gallery` (Liste und Bild) 401, `/api/character-detail` 401. Neue Bundles („Zur Zuflucht“, Command-Center-Dropdown) werden von chroniplay.cc ausgeliefert. Nicht geprüft: angemeldete Live-Begehung (macht der Besitzer), echtes Mobilgerät.

## Rückweg
`wrangler rollback c7cb9a93-5dd7-4d97-8073-0ea5f991f967 --name chronik-von-kleve` (keine Schemaänderung, keine Datenänderung durch 4c).
