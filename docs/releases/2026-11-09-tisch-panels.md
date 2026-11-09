# Release 09.11.2026 (abends): Tisch-Panels getrennt, SL-Charaktere ausgeblendet

Freigabe des Besitzers (09.11.): „Live bringen“.

| | |
|---|---|
| Live-Codecommit | `94b36ec` auf `claude/navigation` |
| Worker-Version | `651e7b64-0e9f-4f3d-aeb2-edfc3be70b0f`, Tag `94b36ec-Tisch-Panels` |
| Zeitpunkt | 2026-11-09T14:58:54Z |
| Vorversion | `71f87d7f-bf2e-4388-af95-2f8589cdf5d7` (Tag `672a060-Charakter-Galerie`), vor dem Deploy geprüft: keine fremde Version |
| Migration | keine (neue Einstellung `hideGmCharacters` im Tischstand-JSON, optional; ohne Wert gilt „ausgeblendet“) |
| D1-Lesezeichen vor dem Deploy | `000001f1-000027ed-0000511e-f21b6aae653f1252486d6d44d57ccee3` |
| Konfiguration | unverändert |

## Inhalt
Am Spieltisch öffnet der Knopf links „Mein Charakter“ (Blut, Willenskraft, Gesundheit, Schaden, Heilung) und der Knopf rechts „Druck“ (persönlicher Stress, Gruppenstress, Maskerade; für die SL Werkzeuge, Steuerung & Freigaben, Verlauf). Die SL sieht links nur einen eigenen Charakter. SL-Charaktere sind am Tisch standardmäßig für alle ausgeblendet; einblendbar unter „Druck“ → „Steuerung & Freigaben“.

## Prüfungen
Typecheck sauber; ESLint 0 Fehler; `pnpm test` 412/412 (neu `tests/table-vitals-gm-characters.test.mjs`); Gesamtlauf 526/532 (6 bekannte Altfälle); Build grün; Probelauf. Nach dem Deploy: `/anmelden` 200, `/spielbereich` 307, `/api/character-gallery` 401; Fingerabdruck mit allen neuen Texten. Nicht geprüft: Ausblenden eines echten SL-Charakters aus Spielersicht (Testinstanz ohne SL-Charakter).

## Rückweg
`wrangler rollback 71f87d7f-bf2e-4388-af95-2f8589cdf5d7 --name chronik-von-kleve`. Die Vorversion ignoriert die neue Einstellung und zeigt SL-Charaktere wieder.
