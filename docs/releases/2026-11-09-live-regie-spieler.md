# Release 09.11.2026 (abends): Live-Regie Spieler am Tisch, schlanke SL-Leiste, Zettel, Individuelle Angaben

Freigabe des Besitzers (09.11.): „Live bringen“.

| | |
|---|---|
| Live-Codecommit | `18e9f80` auf `claude/navigation` |
| Worker-Version | `8a700c17-7798-459f-9c8f-e6f9cebc2a32`, Tag `18e9f80-Live-Regie-Spieler` |
| Zeitpunkt | 2026-11-09T16:09:52Z |
| Vorversion | `a8ea89c1-9e59-4cfb-a333-4a624b31a50e` (Tag `77f3907-Regie-Zettel-Rueckblicke`), vor dem Deploy geprüft: keine fremde Version |
| Migration | keine (`individualInfo` existierte schon im Charakter-JSON) |
| D1-Lesezeichen vor dem Deploy | `000001f1-00004a57-0000511e-256c75591fa3365217f8649dafd11a63` |
| Konfiguration | unverändert |

## Inhalt
- Live-Regie-Fenster: Bereich 5 „Spieler am Tisch“ (Steuerung je Charakter, Inventar, Bogen, Verbindungen; Reiter Zustände), Tischblick wird 6; Anwesenheit „Am Tisch“ dauerhaft in der Seitenleiste; Schalter „SL-Charaktere am Tisch zeigen“ oben im Bereich.
- Spieltisch für die SL: linke Leiste ohne Szenen, Regie und Dokumente (gesteuert wird über das Regie-Fenster).
- Notizzettel: gespeichert nur Text mit Stift und Auge; Farbe, Löschen, Speichern nur beim Bearbeiten.
- SL-Inspektion: Verbindungsanfragen im Charakterprofil entscheiden.
- Charakterbereich: Reiter „Individuelle Angaben“ (Bogen-Rahmen, Editor mit Vorschau, nur Besitzer schreibt).

## Prüfungen
Typecheck sauber; ESLint 0 Fehler; `pnpm test` 413/413; Gesamtlauf 527/533 (6 bekannte Altfälle); Profil-Integration 51/51 lokal; Build grün; Probelauf. Nach dem Deploy: `/anmelden` 200, `/sl/regie` 307 ohne Anmeldung, `/api/character-gallery` 401; neue Texte ausgeliefert (Regie-Schalter direkt im Bundle geprüft). Veraltet: `tests/erzaehlung-ux-browser.mjs` und `tests/ge-02-browser.mjs` nutzen die entfernten SL-Leistenknöpfe (nicht in der CI).

## Rückweg
`wrangler rollback a8ea89c1-9e59-4cfb-a333-4a624b31a50e --name chronik-von-kleve`.
