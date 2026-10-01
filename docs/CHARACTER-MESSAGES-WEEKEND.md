# ChroniPlay – Charakterbereich und private SL-Briefe

Stand: 30.09.2026. **Lokale Testversion zur persönlichen Abnahme; keine Live-Veröffentlichung.**

## Quellstand und Grenzen

- Arbeitskopie: `C:\Users\Stenz\Documents\Codex\cvk-phase-c-remote-test\.review-work\live-release-git`
- Branch: `codex/character-messages-weekend`
- Getesteter Source-Commit: `90d7e3d054ea1716bbb6da3b0c274848e9ebf767`
- Ausgangsstand: `24f5b22282f01d1767c204d10e19d6e36491c5bf`. Der im Auftrag genannte `bbf296995114101d236ae336ffe000bccda27825` ist dessen Vorfahr. Bereits integriertes Command Center wurde erhalten.
- Dieser Bericht wird anschließend separat lokal gesichert. Kein Push, Merge oder Deployment. Keine produktiven Daten- oder Schemaänderungen; keine neue Migration, Anmeldung, Bibliothek oder kostenpflichtige Infrastruktur.
- Lokale D1-/R2-Daten unter `.local-test/character-weekend` sind synthetisch und Git-ignoriert. Die Anwendung hört ausschließlich auf `127.0.0.1:8794`. Andere Entwicklungsserver bleiben erhalten.

## IMPLEMENTIERT – lokal

**Charaktererschaffung:** vier Schritte, sichtbare kostenlose Attribut-/Tugendpunkte, Nosferatu-Erscheinungsbild 0, automatische Clan-Disziplinen mit zunächst 0 Punkten. Prioritäten und verbleibende Budgets sind sichtbar. Zusätzliche Punkte werden über dieselbe zentrale Engine als Freebies berechnet; Rücknahme erstattet die Kosten. Fähigkeiten über 3 gehören zur Freebie-Phase. Ein unvollständiger Entwurf bleibt speicherbar; die Prüfung verlangt eine vollständige, gültige Grundverteilung. Clanwechsel mit bereits verteilten Disziplinpunkten warnt vor Verlust und lässt sich abbrechen.

**Ableitung und Speicherung:** Menschlichkeit und permanente Willenskraft werden aus den ursprünglichen Tugenden abgeleitet. Mit Freebies gekaufte Tugenden erhöhen diese Ausgangswerte nicht erneut. Fehlende kostenlose Startpunkte werden bei neuen Engine-Entwürfen auch ohne Öffnen sämtlicher Dialogschritte serverseitig ergänzt. Bestehende Legacy- und bestätigte Bögen werden dadurch nicht automatisch umgerechnet. Neue Charaktere werden erst nach aktualisierter Liste ausgewählt; Auswahl und Werte überstehen vollständiges Neuladen.

**Entwicklung:** eigener Tab mit Status, verfügbarem/erhaltenem/ausgegebenem XP und Verlauf. Spieler sehen Kosten vor der verbindlichen Steigerung. XP-Abzug, Eigenschaftsänderung und Audit sind versionsgeschützt und atomar. Die Bestätigung hält einen Erschaffungssnapshot fest, damit spätere XP-Käufe nicht erneut als Freebies ausgelegt werden. Bestätigte permanente Werte sind gegen direkte Editor- und API-Manipulation geschützt; Laufzeitwerte bleiben separat bedienbar.

**SL:** dieselbe Entwicklungskomponente im Charakterbereich und bestehenden Command Center. Einreichen, Bestätigen, begründetes Zurückgeben, XP-Vergabe, Anträge genehmigen/ablehnen, dokumentierte redaktionelle Korrekturen von Konzept/Wesen/Verhalten/Erzeuger und vertrauliche SL-Notizen. Spieler können sich keine Genehmigungen oder bestätigten Kosten selbst geben. Eine genehmigte clansfremde Disziplin wird mit 0 Punkten ergänzt und anschließend über die Erschaffung gekauft.

**Spielerunterlagen:** vorhandener formatierter Story-Editor mit Überschriften und Textformatierung, privates Porträt und getrennte Bildergalerie über bestehenden geschützten Dateispeicher. Blut, temporäre Willenskraft und Gesundheit werden dauerhaft gespeichert. Gesundheitsreset fragt ausdrücklich nach und verändert ausschließlich die Verletzung; XP und andere Laufzeitwerte bleiben erhalten.

**Private Briefe:** SL kann Titel/Text an einen oder mehrere aktive Kampagnenmitglieder senden. Pro Empfänger wird ein privater Datensatz im bestehenden Records-System gespeichert. Versand ist idempotent; konkurrierende unterschiedliche Inhalte mit gleicher Versandkennung erzeugen einen Konflikt statt zusätzlicher Empfänger. Persönliches Archiv, Lesemarkierung, Absenderarchiv und Pagination sind vorhanden. Badge wird in sichtbaren Tabs alle 2,5 Sekunden und bei Fokus aktualisiert; Offline-Empfänger sehen die Briefe nach Anmeldung. Es handelt sich um Polling, nicht um eine WebSocket-Zustellung.

**Gestaltung:** Navy/Schwarz, Elfenbein, Messingakzente und Serifentypografie. V20-Gliederung bleibt erkennbar. Tabs trennen Bogen, Geschichte/Bilder, Entwicklung und berechtigte SL-Prüfung; zusätzliche Aktionen und Verläufe sind einklappbar. Desktop und 390 × 844 geprüft; keine horizontale Überbreite in den geprüften Mobilansichten. Reduzierte Bewegung wird berücksichtigt.

## Tatsächlicher Browsernachweis

Alle folgenden Abläufe wurden mit normaler Auth-2.0-Anmeldung in der echten lokalen Anwendung ausgeführt, nicht nur als Komponententest:

| Ablauf | Ergebnis |
| --- | --- |
| Spieler B erstellt einen vollständigen Nosferatu in vier Schritten, speichert und lädt neu | Bestanden; kostenlose Basispunkte und Erscheinungsbild 0, drei Clan-Disziplinen, Budgets und abgeleitete Werte erhalten |
| Freebie-Käufe bei Geschick, Ausdruck und Gewissen, jeweils Rücknahme | Bestanden; 5/2/2 Punkte, korrekte Erstattung; Gewissen-Kauf erhöht Menschlichkeit/Willenskraft nicht erneut |
| Clanwechsel nach Disziplinverteilung abbrechen | Bestanden; bestehende Auswahl und Punkte bleiben erhalten |
| Spieler reicht Bogen ein; SL bestätigt über Command Center | Bestanden; Prüfstatus und Sperre permanenter Werte sichtbar |
| Spieler A bearbeitet Konzept, formatierte Geschichte und lädt ein synthetisches Porträt hoch | Bestanden; Speicherung und vollständiges Neuladen, zusätzlich Serverneustart mit erhaltener lokaler D1/R2 |
| SL bestätigt A und vergibt 30 XP; A kauft Geschick 3 → 4 für 12 XP | Bestanden; nach Reload Geschick 4, 18 verfügbare XP, 30 erhalten, 12 ausgegeben |
| Blut 8 → 7, temporäre Willenskraft 2 → 1, Gesundheit Gesund → Verletzt | Bestanden; Reload erhält alle Änderungen; Reset beseitigt nur Verletzung; anschließend Blut 8/WP 2/Gesund wiederhergestellt |
| A beantragt Verhalten = Visionär; SL lehnt begründet ab | Bestanden; Entscheidung nach Reload sichtbar, bestätigtes Verhalten Einzelgänger unverändert |
| Neuer unvollständiger Entwurf nur mit Name/Clan speichern | Bestanden; automatisch ausgewählt, nach Reload kostenlose Startwerte und Auswahl erhalten |
| SL sendet privaten Brief über echte Oberfläche an A, während A abgemeldet ist | Bestanden; nach Login Badge, öffnen, Lesemarkierung und später erneut lesen |
| Zweiter Brief an angemeldeten A | Bestanden; Badge ohne Reload. Dieser zusätzliche Versand erfolgte über den normalen authentifizierten API-Pfad; erster Versand und Empfang über die Oberfläche |
| Spieler B meldet sich an | Kein Zugriff auf A-Charakter oder A-Briefe; leeres eigenes Nachrichtenarchiv. Direkte negative API-Prüfungen unten |
| Desktop/Mobil, letzte Browserkonsole | Bestanden; abschließend keine erfassten Warnungen/Fehler im geöffneten Testtab |

Verwendete Porträtdatei: vorhandenes `chroniplay-main-logo.png`, ausdrücklich ein synthetisches Testbild, kein neuer kanonischer Charakter.

### Erhaltene Abnahmedaten

- A: `bf77e33f-cb6c-4cc3-bd41-9bf2956c5bed` – `SYNTHETISCH – Character Engine A`, bestätigt, 18 freie XP.
- B: `5a321ce4-eb6f-4079-ac8b-f33302721510` – `SYNTHETISCH – Vollständige Browsererschaffung B`, bestätigt.
- Neuer Minimalentwurf A: `2ee53d6e-949a-44eb-b256-8193c9ec0e68` – `SYNTHETISCH – Auswahl nach Speichern`.
- Ältere synthetische Vergleichsentwürfe bleiben erhalten. Keine automatische nachträgliche Migration.
- Geschütztes A-Porträt: Datei `d17f420e-dda7-4740-ae38-04336cef4d74`.
- A-Briefe: `QA – Brief nur an Spieler A` und `QA – Zustellung in laufender Sitzung`.

## Sicherheits- und Regressionsergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| Typecheck: `node node_modules/typescript/bin/tsc --noEmit --incremental false` | Bestanden, Exit 0 |
| Lint: `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next` | Bestanden, Exit 0 |
| Build: `node scripts/run-framework.mjs build` | Bestanden, Exit 0 |
| Fachtests: `node --experimental-strip-types --test tests/*.test.mjs` | 80 bestanden, 0 fehlgeschlagen |
| Integration: `node scripts/test-local.mjs` | 619 Checks bestanden, ausschließlich frische isolierte lokale Test-D1/R2 |
| Rollenfundament/Backfill/Rollback | 46 Checks bestanden; 4 deterministische Backfill-Zeilen, nur isolierter Testbestand |
| Atomare D1-Batch-Rollback-Probe | Bestanden |
| `git diff --check` | Bestanden |

Die 619 Checks enthalten bestehende Auth-, Character-, Inventory-, Location-/CMS-, Recovery- und Command-Center-Regression sowie die neuen Wochenendprüfungen. Zusätzlich geprüft: anonyme/gesperrte/fremde Kampagnenzugriffe, fremder Charakter/Datei/Nachricht, unberechtigte XP-Vergabe/Genehmigung, gefälschte Ledger-/Status-/Snapshot-/Kostenwerte, gleichzeitige XP-Käufe (ein Erfolg, ein HTTP 409), fehlerhafte Freebie-Payloads, Nachrichten-Mehrfachversand und Pagination. Persönliche Grants umgehen weder Character-Ownership noch Briefempfängerrechte. SL-Notizen gelangen nicht in die Spielerprojektion. Generische Records-Mutation und Benutzerexport öffnen keine fremde private Korrespondenz.

Lokale vollständige Logs: `.local-test/weekend-build.log`, `.local-test/weekend-rules.log`, `.local-test/weekend-regression.log`; bewusst nicht mit Laufzeitdaten ins Git aufgenommen.

**Buildhinweise:** bekannte Client-Chunk-Warnung über 500 kB; Plugin-Timing-Hinweis; vinext markiert `/anmelden` und `/profil` mangels statischer Klassifikation als `Unknown`. Der Build endet erfolgreich; Anmeldung wurde im Browser geprüft. Keine neue Chunk-Optimierung außerhalb dieses Sprints.

## TEILWEISE IMPLEMENTIERT / OFFEN

- **V20-Katalog:** Suchauswahl und kurze Hilfen nutzen den vorhandenen belegten Katalog, eigene Vorzüge/Schwächen benötigen SL-Kostenfreigabe. Die vollständige Vorzüge-/Schwächenliste des gesamten Grundregelwerks ist hier nicht nachgewiesen und wird nicht als vollständig gemeldet.
- **Storybilder:** privates Porträt und separate Galerie sind vorhanden. Direkt im Fließtext eingebettete Bildblöcke sind noch nicht umgesetzt.
- **SL-Korrekturen:** redaktionelle Identitätsfelder sind abgedeckt. Eine allgemeine mechanische Korrektur- und Ausnahmeoberfläche für Stufe 6–7 oder besondere Regelprofile ist nicht enthalten.
- **Sonderfälle:** erste XP-Punkte einer noch unbekannten Disziplin und Hintergrund-XP bleiben bei fehlendem freigegebenem Preis gesperrt. Ein historischer bestätigter Engine-Bogen ohne Erschaffungssnapshot braucht bewusste Prüfung statt automatischer Übernahme.
- **Blutwerte:** Kapazität/Blut pro Runde verwenden vorhandene Charakterfelder; eine neue automatische Generationsberechnung ist nicht Teil dieser Umsetzung.
- Persönliche Funktionsabnahme und spätere gesondert freigegebene Live-Veröffentlichung sind offen. Dieser Bericht bestätigt ausschließlich die lokalen Ergebnisse.

## Selbst ausprobieren

Die Anwendung läuft: **http://127.0.0.1:8794/spielbereich?bereich=charaktere**.

Lokale synthetische Konten, keine Produktionszugänge:

| Rolle | E-Mail | Passwort |
| --- | --- | --- |
| Spieler A | `command-a@example.invalid` | `ChroniPlay-Demo-2036!` |
| Spieler B | `command-b@example.invalid` | `ChroniPlay-Demo-2036!` |
| SL | `command-gm@example.invalid` | `ChroniPlay-Demo-2036!` |

1. Als A den QA-Charakter öffnen. Bogen/Laufzeitwerte, Geschichte & Bilder und Entwicklung ausprobieren. Eine neue XP-Steigerung verändert nur den synthetischen Testbogen.
2. Am Briefsymbol den ungelesenen Brief öffnen und später im Archiv wieder aufrufen.
3. Einen neuen Charakter erstellen: kostenlose Punkte, Clan-Disziplinen, Budgets, automatischen Freebie-Abzug und Speichern/Reload prüfen.
4. Abmelden und als SL anmelden. Im Spieltisch den Spieler wählen; Charakter → Prüfung & Freigaben aufklappen, XP vergeben oder einen Antrag bearbeiten. Über Nachrichten einen Brief an einen/mehrere Testspieler schreiben.
5. Als B kontrollieren, dass A-Charakter und A-Briefe nicht verfügbar sind.

Falls der Server später beendet wurde: `Start-Character-Weekend.cmd` in dieser Arbeitskopie doppelklicken und das Fenster geöffnet lassen. Die Startdatei verwendet den vorhandenen gebündelten Node-Runtime; kein PowerShell-Ausführungsrichtlinienwechsel nötig. Ist Port 8794 belegt, bleibt der vorhandene Prozess erhalten. Markierter synthetischer Datenbestand wird wiederverwendet, nicht neu gesät. Bei geändertem Migrationsfingerabdruck oder unmarkierten vorhandenen Daten bricht der Start ab und erhält die Daten.

## Geänderte Dateien / echte Screenshots

Die vollständige Liste steht in [WEEKEND-CHANGED-FILES.txt](WEEKEND-CHANGED-FILES.txt). Kernänderungen:

- `domain/character-engine.ts`, `domain/clan-config.ts`: gemeinsame Erschaffungs-/Entwicklungsregeln.
- `server/character-engine-service.ts`, `app/api/character-engine/route.ts`, `app/api/records/route.ts`: Projektion, persistente Befehle, Versionsschutz und Manipulationsabwehr.
- `app/api/character-companion/route.ts`, `server/character-projection.ts`: vorhandene Story-/Bild- und Character-Berechtigungen.
- `app/api/messages/route.ts`, `server/entities.ts`, `server/campaign-export.ts`: privater Nachrichtenweg und durchgängige Empfängergrenzen.
- `app/spielbereich/modules/{character-creation-fields,character-detail,character-progression,record-editor,message-center,shell,command-character,command-center}.tsx`, `character-studio.module.css`, `message-center.module.css`, `app/spielbereich/{page,workspace}.tsx`: gemeinsame Spieler-/SL-Oberflächen.
- `scripts/test-local.mjs`, `Start-Character-Weekend.cmd`, `tests/{character-weekend.test,weekend-integration,integration}.mjs`, `tests/fixtures/engine-character.mjs`: reproduzierbare lokale Testressourcen und Regression.

Echte Screenshots in `docs/qa/weekend/`: [Bogen](qa/weekend/player-desktop-sheet.jpg), [Entwicklung](qa/weekend/player-desktop-development.jpg), [SL-Prüfung](qa/weekend/sl-character-review.jpg), [Command Center](qa/weekend/sl-command-character.jpg), [privater Brief](qa/weekend/player-message.jpg), [Mobil Bogen](qa/weekend/player-mobile.jpg), [Mobil Entwicklung](qa/weekend/player-mobile-development.jpg), [Mobil Brief](qa/weekend/player-mobile-message.jpg).

**STOPP nach Sicherung. Keine weiteren Module oder Veröffentlichung ohne neue Freigabe.**
