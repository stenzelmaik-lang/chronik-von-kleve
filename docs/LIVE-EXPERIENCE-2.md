# Live Experience 2.0 – lokaler Abnahmestand

Stand: 01.10.2026. Branch: `codex/live-experience-2`.
Basis: `21583e4bf30315be0200c763e935e9a81dcb49ce`.
Der abschließende lokale Commit wird im Abschlussbericht genannt.

**IMPLEMENTIERT UND LOKAL GETESTET. Persönliche Abnahme und Veröffentlichung stehen aus.**
Kein Push, Merge, Deployment oder produktiver Datenbankzugriff. Keine neue Migration.

## Tatsächliche Änderungen

- Kompakter Charakterkopf mit unverändert verfügbaren Identitätsdaten unter „Identität & Hintergrund“. Schneller Wechsel des aktiven Charakters; seltene Aktionen eingeklappt.
- Blut, temporäre Willenskraft, Gesundheit einschließlich bestätigtem Reset und freie XP direkt in einer gemeinsamen, beim Scrollen haftenden Leiste. Permanente Willenskraft, Blut pro Runde und Gesamt-XP bleiben sichtbar. Bestehende Runtime-API, Berechtigungen und Revisionen bleiben maßgeblich.
- Gleichzeitige lokale Doppelklicks werden während einer Runtime-Speicherung gesperrt. Ein HTTP-409-Konflikt lädt den Serverstand und erklärt ausdrücklich, dass die verworfene Änderung nicht gespeichert wurde.
- Erschaffung zeigt die aktuell fehlenden regulären Punkte, feste Basispunkte, verbleibende Freebies und Kauf-/Rücknahmekosten vor der Auswahl. Gesperrte Clan-, Nosferatu-, Ausnahme- und Budgetoptionen nennen ihren Grund. Unvollständige Entwürfe bleiben speicherbar; Einreichen ist erst nach der zentralen Prüfung möglich.
- Neues `domain/character-guidance.ts` stellt ausschließlich Ergebnisse der bestehenden Engine dar. **`domain/character-engine.ts` und der Regelkatalog sind unverändert.** Keine zweite Preis- oder Budgetlogik.
- SL-Regie zeigt ausstehende Prüfungen und Anträge mit direktem Charakterzugriff. Auswahl eines einzelnen berechtigten Charakters statt gleichzeitiger Darstellung aller Bögen.
- SL-Aktionen: Prüfen, XP vergeben, vertrauliche Notiz und persönlicher Brief. Briefempfänger wird mit dem autorisierten Charakterbesitzer vorausgewählt; Versand benutzt das bestehende Nachrichtensystem. Seltene Korrekturen und Protokolle bleiben eingeklappt.
- Tatsächlicher Datenflussfehler behoben: Die Aufmerksamkeitsliste las bisher den veralteten Entity-Inhalt. Engine-Kommandos verändern `records`. Der Endpunkt verwendet jetzt die aktuellen autorisierten Records und liefert nur ID, Titel, Besitzer-ID, Status, Antragsanzahl und Version. Private fremde, geheime und Recovery-Charaktere bleiben ausgeschlossen.
- Das bestehende serverseitige Charakterdossier liefert zusätzlich den Engine-Status; die Bearbeitungssperre folgt diesem aktuellen Stand statt einer alten lokalen Listenfassung.
- Sichtbare Charakteransicht und SL-Liste gleichen ihren autorisierten Stand alle zehn Sekunden und bei Fensterrückkehr ab. Keine WebSocket-Echtzeitbehauptung. Laufende Texteingaben und lokale Schreibvorgänge im Dossier haben Vorrang; bestehende Versionsprüfungen bleiben wirksam.
- Navy/Messing, kompakte Abstände, Tastaturfokus und kleine Darstellungskomponenten. Erschaffungs-, Brief- und Charakterbestätigungsdialoge liegen über der festen Navigation.
- Plattformadministration, Authentifizierung, Inventar, Ortsverwaltung und bestehende Datenmodelle bleiben unverändert.

## Zusammenhängender Browser-Spielabendtest

Getestet mit normaler Auth-2.0-Anmeldung, nicht mit gefälschten Identitätsheadern. Ausschließlich lokale synthetische D1-/R2-Daten.

| Prüfung | Tatsächlich beobachtetes Ergebnis |
|---|---|
| Drei getrennte Sitzungen | SL und Spieler A über zwei Browser auf `127.0.0.1:8794`, Spieler B in einem getrennten Cookie-Kontext auf `localhost:8794`; alle regulär angemeldet. |
| Charakterwechsel | Spieler A wechselt zwischen bestätigtem Testbogen und privatem Entwurf; Spieler B wählt seinen eigenen Bogen; SL öffnet den konkreten Charakter aus Auswahl und Warteschlange. |
| Erschaffungshinweise | Körperliche 7 Zusatzpunkte verteilt; weiterer Punkt kostet vorab 5 Freebies. Aufmerksamkeit 4 kostet 2 Freebies. Anzeige 15 → 10 → 8; Rücknahme stellt 15 wieder her. Zu teure Auswahl und Nosferatu-Erscheinungsbild sind gesperrt und begründet. |
| Entwurf speichern | Nach Rücknahme der Testkäufe bleibt der unvollständige private Entwurf speicherbar. Vollständiges Neuladen erhält ihn; genaue Restpunkte werden angezeigt, „Zur SL-Prüfung einreichen“ bleibt begründet gesperrt. |
| Charakterprüfung | Vollständiger synthetischer Bogen von A im Browser eingereicht, erscheint bei der SL, über bestehenden Bestätigungsdialog bestätigt; Warteschlange danach leer. |
| Neuer Antrag | Spieler A beantragt eine redaktionelle Änderung. SL-Liste zeigt ohne manuelles Neuladen einen Antrag. SL lehnt ihn begründet ab; vorhandener Text bleibt erhalten, Entscheidung und erledigte Warteschlange sichtbar. |
| XP | SL schreibt zunächst 5, anschließend 3 synthetische XP mit Begründung gut. 8 verfügbare XP erscheinen automatisch in der geöffneten Spieleransicht. Für eine 12-XP-Steigerung wurden bei 5 verfügbaren XP exakt 7 fehlende XP und ein gesperrter Kauf angezeigt. |
| SL-Notiz | Vertraulicher synthetischer Text gespeichert und nach Neuladen wieder angezeigt. Spielerprojektionen enthalten ihn nicht; dies wird zusätzlich in Integrationstests geprüft. |
| Persönlicher Brief | Direkt aus dem SL-Charakterkontext an A adressiert, normal versendet, bei A empfangen und gelesen; im unabhängigen Posteingang von B nicht vorhanden. |
| Gleichzeitig spielen | A und B ändern parallel Blut; anschließend A Gesundheit und B temporäre Willenskraft. Beide Speicherungen erfolgreich und nach vollständigem Neuladen erhalten. Temporäre Testwerte anschließend auf den Ausgangsstand zurückgesetzt. |
| Konflikte | Automatisierter Test mit gleicher Revision am selben Charakter: genau ein Erfolg und ein HTTP 409. Unabhängige Aktionen zweier Spieler erfolgreich. |
| Desktop / Mobil | Echter lokaler Browser; schmale Ansicht mit 390 × 844 Browser-Viewport. Kein horizontaler Überlauf. Mobile Werte-Leiste bleibt beim Scrollen bei 68 px unter dem 62-px-Kopf sichtbar. Erschaffungsdialog scrollbar, Speichern erreichbar. Dies ist kein Test auf einem physischen Smartphone. |
| Browserkonsole | In den drei verwendeten Tabs keine erfassten Fehler bei der abschließenden Kontrolle. |

Vorbereitung des vollständigen Testbogens erfolgte über den normalen autorisierten Records-Create-Pfad. Einreichen, Bestätigen, XP, Antrag, Notiz, Brief und Runtime-Änderungen wurden anschließend tatsächlich in den Browseroberflächen ausgeführt.

Erhaltener QA-Bogen: `21a47495-c90b-4d15-91d6-d712c6a6e99e`,
„SYNTHETISCH – Live Experience Prüfcharakter“, Besitzer Demo Spieler A,
Sichtbarkeit `sl`, `TEST_DATA`, bestätigt, 8 synthetische XP, Blut 8/13,
temporäre Willenskraft 2/3, Gesundheit Gesund.
Er bleibt ausschließlich im lokalen Testbestand für weitere persönliche Abnahme.
Es wurden keine bestehenden Charaktere gelöscht und keine Legacy-Werte in die Engine übernommen.

## Automatisierte Nachweise

| Prüfung | Ergebnis des endgültigen Quellstands |
|---|---|
| Typecheck | BESTANDEN, Exit 0 |
| Lint | BESTANDEN, Exit 0, keine Meldungen |
| Build | BESTANDEN, Exit 0 |
| Fach- und Regressionstests | 91/91 bestanden, darunter 11 neue Live-UX-Fachtests |
| Integration | 632 Prüfungen bestanden, frische isolierte lokale Test-D1/R2 |
| Atomarer D1-Batch-Rollback | BESTANDEN |
| Rollen / Backfill / Rollback | 46 Prüfungen bestanden; ausschließlich Test-D1 |

Regression umfasst bestehende Charakter-/Runtime-/XP-/Privacy-, Nachrichten-, Rollen-, Orts-/Projection-, Inventar- und Recovery-Prüfungen. SQL-Proben laufen ausschließlich im bereits vorhandenen isolierten Testverfahren; keine produktive Migration und keine neue Schemadatei.

Vorhandene Buildwarnungen: Client-Chunks größer als 500 kB; vinext kann einige Routen durch statische Analyse nicht klassifizieren. Beide sind dokumentierte Warnungen, keine fehlgeschlagenen Prüfungen.

Reproduzierbar aus dieser Arbeitskopie mit dem vorhandenen Node-Runtime:
`tsc --noEmit --incremental false`, `eslint . --ignore-pattern dist --ignore-pattern .next`,
`node --experimental-strip-types --test tests/*.test.mjs`,
`node scripts/run-framework.mjs build`, `node scripts/test-local.mjs`.
Die konkreten lokalen Logs liegen in `.local-test/live-experience-{typecheck,lint,build,unit,integration}.log` und werden nicht in Git aufgenommen.

## Selbst ausprobieren

Arbeitskopie:
`C:\Users\Stenz\Documents\Codex\cvk-phase-c-remote-test\.review-work\live-release-git`.

Die Anwendung läuft unter `http://127.0.0.1:8794/spielbereich?bereich=charaktere`.
SL-Regie: `http://127.0.0.1:8794/spielbereich?bereich=sitzung`.
Zum späteren Start `Start-Character-Weekend.cmd` doppelklicken, Fenster offen lassen.
Der vorhandene Starter verwendet den gebündelten Node und prüft Port 8794; ein schon laufender Server wird nicht beendet. Der markierte lokale Testbestand bleibt bei Neustart erhalten.

Nur für diesen synthetischen lokalen Bestand:

- SL: `command-gm@example.invalid`
- Spieler: `command-a@example.invalid` / `command-b@example.invalid`
- Demo-Passwort für alle drei: `ChroniPlay-Demo-2036!`

Zwei Browser beziehungsweise getrennte Profile für SL/Spieler verwenden; ansonsten teilt sich die Anmeldung dieselbe Sitzung. Diese Testkonten sind keine Produktionskonten.

## Geänderte Dateien

- `app/api/command-center/route.ts`
- `server/character-engine-service.ts`
- `server/character-projection.ts`
- `domain/character-guidance.ts` (neu)
- `domain/character-live.ts` (neu)
- `app/spielbereich/modules/character-creation-guidance.tsx` (neu)
- `app/spielbereich/modules/character-live-vitals.tsx` (neu)
- `app/spielbereich/modules/character-management.tsx` (neu)
- `app/spielbereich/modules/character-review-queue.tsx` (neu)
- `app/spielbereich/modules/character-creation-fields.tsx`
- `app/spielbereich/modules/character-detail.tsx`
- `app/spielbereich/modules/character-progression.tsx`
- `app/spielbereich/modules/character-studio.module.css`
- `app/spielbereich/modules/command-center.tsx`
- `app/spielbereich/modules/command-center.module.css`
- `app/spielbereich/modules/command-character.tsx`
- `app/spielbereich/modules/message-center.module.css`
- `tests/character-live.test.mjs` (neu)
- `tests/weekend-integration.mjs`
- dieser Bericht und echte Browserbilder unter `docs/qa/live-experience-2/`

## Browserbilder und verbleibende Abnahme

- `qa/live-experience-2/player-desktop.jpg`: endgültiger kompakter Bogen, Laufzeitwerte, 8 XP.
- `qa/live-experience-2/player-mobile.jpg` und `player-mobile-sticky.jpg`: mobiler Bogen und haftende Werte-Leiste.
- `qa/live-experience-2/creation-guidance.jpg` und `creation-mobile.jpg`: konkrete Restpunkte, Entwurfsstatus und mobile Bedienung.
- `qa/live-experience-2/sl-direct-actions.jpg`: vier direkte SL-Aktionen, erhaltene private Notiz.
- `qa/live-experience-2/sl-request-queue.jpg`: Antrag während des Browser-Spielabendtests, vor der anschließenden Ablehnung und letzten Text-/Darstellungsbereinigung.
- `qa/live-experience-2/player-a-letter.jpg` und `player-b-no-letter.jpg`: zugestellter Brief bei A, unabhängiger leerer Posteingang von B. Letzteres wurde während des Funktionstests vor der abschließenden Dialog-Stapelkorrektur aufgenommen.

**OFFEN:** persönliche Funktionsabnahme, danach gesonderte Release-Freigabe. Kein Live-Test dieser Änderungen auf chroniplay.cc, weil Veröffentlichung ausdrücklich nicht beauftragt ist. Kein Inventarausbau, keine weiteren Großmodule und keine Regelkatalog-Überarbeitung begonnen.

Nach diesem lokalen Abnahmestand STOPP.
