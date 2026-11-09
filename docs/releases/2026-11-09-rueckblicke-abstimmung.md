# Release 09.11.2026 (spätabends): Rückblicke und Kalender-Abstimmung

Freigabe des Besitzers (09.11.): „Live bringen“.

| | |
|---|---|
| Live-Codecommit | `2dd4ce6` auf `claude/navigation` |
| Worker-Version | `2d6a0829-93e5-4ec8-8723-b54fd65fce94`, Tag `2dd4ce6-Rueckblicke-Abstimmung` |
| Zeitpunkt | 2026-11-09T20:14:38Z |
| Vorversion | `8a700c17-7798-459f-9c8f-e6f9cebc2a32` (Tag `18e9f80-Live-Regie-Spieler`), vor dem Deploy geprüft: keine fremde Version |
| Migration | keine |
| D1-Lesezeichen vor dem Deploy | `000001f2-000009fc-0000511e-1411768313b8d975ff79a2cf45330b96` |

## Inhalt
- Zuflucht: Block „Letzter Rückblick“ mit dem neuesten freigegebenen Rückblick (Dashboard-API liest jetzt auch Chronik-Einträge, nur Spieleransicht); Kalenderblock wird bei offener Terminabstimmung zur Abstimmung (direkt antworten, SL legt fest) und danach wieder zum Kalender.
- Rückblicke-Seite: Karten mit Anriss, gerahmte Leseansicht; alte Spielabende nur mit eigener Zusammenfassung.
- Kommandozentrale: Rückblick-Pult mit Übersicht und „Zurück zur Übersicht“; „Neuer Rückblick“ startet leer (Fehler behoben: Editor behielt den alten Text).

## Prüfungen
`pnpm test` 413/413; Gesamtlauf 527/533 (6 bekannte Altfälle); ESLint 0 Fehler; Build grün; lokal Abstimmung (SL anlegen, Spieler antworten, SL festlegen) und Rückblick-Pult/Karten/Leseansicht angesehen. Nach dem Deploy: `/anmelden` 200, `/api/dashboard` und `/api/appointments` 401; neue Texte ausgeliefert; in der angemeldeten Live-Ansicht des Besitzers zeigt die Zuflucht den echten Rückblick (nur gelesen).

## Rückweg
`wrangler rollback 8a700c17-7798-459f-9c8f-e6f9cebc2a32 --name chronik-von-kleve`.
