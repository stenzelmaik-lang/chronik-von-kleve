# Release 09.11.2026 (abends): Regie, Notizzettel, Rückblicke, Verbindungen, Kommandozentrale

Freigabe des Besitzers (09.11.): „Live bringen“.

| | |
|---|---|
| Live-Codecommit | `77f3907` auf `claude/navigation` |
| Worker-Version | `a8ea89c1-9e59-4cfb-a333-4a624b31a50e`, Tag `77f3907-Regie-Zettel-Rueckblicke` |
| Zeitpunkt | 2026-11-09T15:42:48Z |
| Vorversion | `651e7b64-0e9f-4f3d-aeb2-edfc3be70b0f` (Tag `94b36ec-Tisch-Panels`), vor dem Deploy geprüft: keine fremde Version |
| Migration | keine (neue Felder optional: Zettelfarbe im Bühnen-JSON, `connectionRequests` im Charakter-JSON; Rückblicke sind Chronik-Einträge, Verbindungen nutzen die bestehende Tabelle `relationships`) |
| D1-Lesezeichen vor dem Deploy | `000001f1-00003803-0000511e-903d2ff524cfe89a878ab6b4517fb757` |
| Konfiguration | unverändert |

## Inhalt
- Regie am Tisch: Reiter „Spieler am Tisch“ zwischen Interaktionen und Proben, je Charakter volle SL-Steuerung (Blut, Willenskraft, Schaden, Heilung, persönlicher Stress, Zurücksetzen, Freigabe) sowie Inventar, Charakterbogen und Verbindungen.
- Notizzettel als abgerissene Sticky Notes in sechs Farben; Farbe ändert nur, wer den Zettel geschrieben hat.
- Kommandozentrale „Rückblicke“: SL schreibt Rückblicke (Chronik-Eintrag Typ „rueckblick“), Entwurf nur SL, Freigabe für die Runde; Spieler lesen freigegebene Rückblicke unter „Rückblicke“.
- Bekannte Verbindungen: Spieler fragen im Charakterprofil an; die SL entscheidet in der Regie, verbindet direkt oder entfernt Verbindungen.
- Kommandozentrale: Kopfzeile mit „Zum Spieltisch“ (live/nicht live), „Zur Zuflucht“, „Kampagne sichern“; Kachel Live-Spieltisch entfernt.

## Prüfungen
Typecheck sauber; ESLint 0 Fehler; `pnpm test` 413/413; Gesamtlauf 527/533 (6 bekannte Altfälle); Profil-Integration 48/48 lokal (u. a. Verbindungsrechte, Rückblick-Entwurf unsichtbar, Spieler können keine Rückblicke schreiben); Build grün; Probelauf. Nach dem Deploy: `/anmelden` 200, `/spielbereich` 307, `/api/character-gallery` und `/api/relationships` 401; Fingerabdruck mit allen neuen Texten.

## Rückweg
`wrangler rollback 651e7b64-0e9f-4f3d-aeb2-edfc3be70b0f --name chronik-von-kleve`. Angelegte Rückblicke bleiben als Chronik-Einträge sichtbar, Zettelfarben und Anfragen werden von der Vorversion ignoriert.
