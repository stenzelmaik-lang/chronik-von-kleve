# Release 09.11.2026 (spätabends): Chronik-Zeitstrahl, Rückblicke & Chronik

Freigabe des Besitzers (09.11.): „Live bringen“.

| | |
|---|---|
| Live-Codecommit | `5be63de` auf `claude/navigation` |
| Worker-Version | `55f051ca-202d-4e41-a76d-1654d04fc244`, Tag `5be63de-Chronik-Zeitstrahl` |
| Zeitpunkt | 2026-11-09T20:26:46Z |
| Vorversion | `2d6a0829-93e5-4ec8-8723-b54fd65fce94` (Tag `2dd4ce6-Rueckblicke-Abstimmung`), vor dem Deploy geprüft: keine fremde Version |
| Migration | keine (Chronik-Einträge: `body.type` „rueckblick“ oder „ereignis“, ältere Einträge ohne Typ bleiben gültig) |
| D1-Lesezeichen vor dem Deploy | `000001f2-00000c3c-0000511e-b4a426a59bf2616784551f4262e8fd1a` |

## Inhalt
- Chronik: Zeitstrahl mit Jahresmarken, lesbarem Datum, Kennzeichnung „Rückblick“, ruhigem Anriss und formatiertem Lesetext (Fehler behoben: roher gespeicherter Text wurde angezeigt).
- Kommandozentrale „Rückblicke & Chronik“: zwei Arten (Rückblick: Zuflucht, Rückblicke, Chronik; Chronik-Eintrag: nur Zeitstrahl), Filter in der Übersicht, ältere Einträge behalten ihre Zusatzfelder.
- Zuflucht: ruhiger Rückblick-Anriss (nur Fließtext, drei Zeilen), eine Linkzeile.

## Prüfungen
`pnpm test` 413/413; Gesamtlauf 527/533 (6 bekannte Altfälle); ESLint 0 Fehler; Build grün; lokal Zuflucht, Chronik und Pult angesehen. Nach dem Deploy: `/anmelden` 200, `/api/dashboard` 401; neue Texte ausgeliefert; in der angemeldeten Live-Ansicht zeigt die Chronik den echten Rückblick lesbar (nur gelesen).

## Rückweg
`wrangler rollback 2d6a0829-93e5-4ec8-8723-b54fd65fce94 --name chronik-von-kleve`.
