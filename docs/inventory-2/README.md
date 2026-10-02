# ChroniPlay Inventory 2.0 — lokale Funktionsabnahme

Stand: 02.10.2026. Branch: `codex/inventory-2.0`.
Basis: `308ef929cd04bc19fd1855215d809bbfa993243b` aus dem geprüften GitHub-main.
Der genaue lokale Abschlusscommit steht in `outputs/inventory-2/release-state.json` und lässt sich mit `git rev-parse HEAD` prüfen.

**Lokal implementiert und getestet; persönliche Abnahme und Veröffentlichung stehen aus. Kein Push, Merge, Deployment oder produktiver Datenzugriff.**

## Persönlich ausprobieren

Die Anwendung läuft auf **http://127.0.0.1:8796**. Im Inventar ist bereits der synthetische Charakter **TEST – Nachtläufer A** ausgewählt.

| Rolle | Lokales Testkonto |
| --- | --- |
| Spieler / Eigentümer | `command-a@example.invalid` |
| Spielleitung | `command-gm@example.invalid` |
| Fremder Spieler ohne Zugriff | `command-b@example.invalid` |

Nur für diese isolierte Demo: Passwort `ChroniPlay-Demo-2036!`. Keine gemeinsamen Demo-Zugänge für Produktion.

1. Beim Spieler ein Körperfeld oder einen Gegenstand anklicken; Details und Bearbeitung öffnen.
2. Anlegen, Ablegen und Einlagern ausprobieren; vollständig neu laden und den gespeicherten Stand kontrollieren.
3. Einen eigenen Testgegenstand mit Menge, Beschreibung, Tags und Bild erstellen. Er erscheint im gewählten Bereich; Waffen und Rüstung besitzen ihre vorhandenen Profilfelder.
4. Archivieren und Wiederherstellen ausprobieren. Der Gegenstand behält seine Identität und Eigentumszuordnung.
5. Mit der SL in einer getrennten Browsersitzung unter Sitzung → Spieler einen Charakter auswählen und **Geteiltes Inventar öffnen** verwenden. PRIVATE-Gegenstände bleiben verborgen; die SL kann nur freigegebene Gegenstände ändern.

Für einen Neustart auf Windows `Start-Inventory-2.cmd` im Projektordner doppelklicken. Das Skript verwendet die von Codex bereitgestellte Node-Laufzeit, prüft Port 8796 und lokale Bindings, baut die Anwendung und startet ausschließlich lokale D1/R2. Es beendet keinen fremden Prozess. Mit Strg+C beenden. Der lokale Testbestand bleibt beim Neustart erhalten.

Arbeitskopie: `C:\Users\Stenz\Documents\Codex\cvk-phase-c-remote-test\.review-work\live-release-git`.
Demo-Daten: `.local-test/inventory-2`, ausschließlich synthetische Konten, Charaktere und Gegenstände. Die vollständige Regression verwendet einen anderen, frischen temporären Testbestand. Vorhandene lokale Entwicklungsdaten wurden nicht überschrieben.

## Bestand und tatsächlich behobene Probleme

- Bestehende ITEM-Entitäten, `records`, `character.owns`-Beziehungen und Trageprofile werden weiterverwendet. Keine zweite Inventardatenbank und keine neue Migration.
- Die große V1-Komponente wurde in Inventarablauf, Körperdarstellung, Kacheln, Detailansicht, Editor und Datenzugriff aufgeteilt. Charakterseite und SL-Spieltisch führen in dieselbe Oberfläche.
- Gleichzeitige Erstellungen/Änderungen konnten nicht zuverlässig über eine gemeinsame Inventarversion abgesichert werden. Jetzt schützt eine atomare D1-Transaktion Gegenstand, Trageprofil, Beziehung und Audit gemeinsam. Ein eindeutiger Vorgangsbezeichner verhindert, dass ein unterlegener Request die Version des Gewinners verwendet.
- Die SL verwendet das Trageprofil des tatsächlichen Eigentümers. PRIVATE-Gegenstände und ihre Details bleiben verborgen; die vollständige Kapazitätsprüfung erfolgt dennoch auf dem Server.
- Inventarbilder werden über den berechtigten Gegenstand ausgeliefert. Dadurch kann der Eigentümer auch ein von der SL hinterlegtes, passend freigegebenes Bild sehen, ohne Zugriff auf deren allgemeine private Dateibibliothek zu erhalten.
- Verknüpfte Bilder sind vor direktem Löschen geschützt. Die generische Records-API darf strukturierte ITEMs nicht außerhalb der Inventartransaktion überschreiben oder löschen; bestehende unstrukturierte Legacy-Inventartexte bleiben bearbeitbar.
- Auf kleinen Bildschirmen verdeckte zuvor die Navigation den Editor. Die Dialogebenen und der Speicherbereich wurden im tatsächlichen mobilen Browser korrigiert und geprüft.

## Umgesetzt

**IMPLEMENTIERT (lokal):** Körperausrüstung links, Rucksack rechts, Lager darunter; Navy-/Messinggestaltung, bestehende Typografie, Such- und Kategorienfilter, deutliche Kapazität, geschlechtsneutrale SVG-Figur, responsive Darstellung, reduzierte Animation bei entsprechender Systemeinstellung.

**IMPLEMENTIERT (lokal):** Anlegen, Bearbeiten, Ausrüsten, Ablegen, Einlagern, Archivieren und Wiederherstellen; Menge, Beschreibung, Status, Sichtbarkeit, Tags, Waffen-/Rüstungsprofile, geschützte Bilder. Aktionen sind mit Schaltflächen bedienbar; Drag-and-drop ist zusätzlich möglich.

**IMPLEMENTIERT (lokal):** Kleidung und Ausrüstung verändern schematische Ebenen der Figur an den tatsächlich belegten Körperpositionen. Keine fest eingebrannte Ausstattung; Gegenstandsbild und Körperbelegung bleiben getrennt.

**IMPLEMENTIERT (lokal):** Bestehende Profile `BODY_ONLY` 4, `BACKPACK_SMALL` 8, `BACKPACK_MEDIUM` 12 und `BACKPACK_LARGE` 20. Körper und Rucksack zählen gemeinsam, Lager/Archiv nicht. Die alten stabilen Profil-IDs bleiben erhalten.

**IMPLEMENTIERT (lokal):** Bestehende zehn Körperpositionen bleiben erhalten; zusätzlich Kopf, Augen, Oberkörper, Oberbekleidung, Handschuhe, Beine, Füße, Accessoire und Manteltasche innen. Neue Kategorien-/Positionsprüfungen werden serverseitig durchgesetzt. Alte Datensätze werden nicht pauschal neu geschrieben.

**IMPLEMENTIERT (lokal):** Gemeinsame reine Inventarregeln in `domain/inventory-rules.ts` für Anzeige und Serverprüfung. Vorhandene T/J/M/N-Verbergungswerte liefern Hinweise. Keine automatischen Maskeradeverletzungen, Charakterwertänderungen oder erfundenen Gewichtskapazitäten.

## Architektur und Sicherheit

- `domain/inventory.ts`: bestehende Identitäten/Typen, zusätzliche Positionen und berechtigter Projektionsvertrag.
- `domain/inventory-rules.ts`: Kapazität, Belegung, Positionskompatibilität, Verbergung und Statusableitung.
- `server/inventory.ts`: strikte Payload-Validierung, tatsächliche aktive Kampagnenrollen, Charakter-/Item-/Bildzugriff und sichere Projektion.
- `server/inventory-write.ts`: gemeinsame Carry- und Item-Version, atomarer D1-Batch, Eigentumserhaltung und Audit. Veraltete Anfragen: HTTP 409, keine unbemerkte Übernahme.
- `/api/inventory` und `/api/inventory/profile`: bestehende Endpunkte, zentrale Regeln und Versionsschutz. Trageprofilwechsel bleiben beim Eigentümer.
- `/api/inventory/media`: PNG/JPEG/WebP bis 10 MB, MIME-/Signaturprüfung, privater R2 und geschützte Auslieferung. Keine öffentlichen Objekt-URLs oder R2-Schlüssel im Bildpfad.
- `modules/inventory/`: kleine Komponenten und CSS-Modul. Bestehender Request-Cache; keine unnötige doppelte Erstabfrage.

Ein aktiver campaign_gm/campaign_owner erhält ausschließlich Zugriff auf geteilte Charaktere seiner Kampagne und freigegebene Items (`sl`/`group`). Ein allgemeines altes GM-Flag verleiht diesen Zugriff nicht. PRIVATE und GM_SECRET bleiben geschützt. Fremde Spieler, gesperrte Benutzer und fremde Kampagnen werden serverseitig abgewiesen.

Die SL sieht nur den freigegebenen Kapazitätsausschnitt. Blockiert ein privater Gegenstand eine Platzierung, erhält sie eine allgemeine Konfliktmeldung ohne dessen Identität oder Daten. Eigentum verbleibt beim Charakter.

Erweiterbare Grundlage für späteres Handeln: stabile ITEM-IDs, Charakterbeziehungen, Eigentümer, Revisionen und Änderungsverlauf. **Handel, Händler, Preise, Eigentumsübertragungen und Wirtschaft wurden nicht implementiert.**

## Tatsächliche Testbelege

| Prüfung | Ergebnis |
| --- | --- |
| Typecheck | bestanden, Exit 0 |
| Lint | bestanden, Exit 0 |
| Build | bestanden, Exit 0 |
| Fach-/Regressionstests | 108 bestanden, 0 fehlgeschlagen/übersprungen |
| Vollständige isolierte Integration | 744 Checks bestanden |
| Rollen-/Backfill-/Rollbackprüfungen | 46 Checks bestanden |
| Echter Desktopbrowser | Spieler A, tatsächliche SL und fremder Spieler B geprüft |
| Mobile 390 × 844 | Bearbeiten, Speichern, Neuladen; kein horizontaler Überlauf |

Negative Tests: fremde Identitäten/Kampagnen, gesperrte Rollen, private Items und Bilder, manipulierte Felder/Kategorien/Mengen/Positionen, volle Kapazität, Kollisionen, fremde File-IDs, unzulässiges Trageprofil, stale Item-/Carry-Versionen sowie generischer Records-Bypass.

Parallele Creates und Updates wurden mehrfach gegen dieselbe erwartete Version getestet: genau ein Erfolg, ein HTTP 409, keine verwaisten Items oder Beziehungen. Ein injizierter SQLite-Fehler rollt den gesamten D1-Batch zurück. Der bestehende Fehlervertrag liefert dabei HTTP 503; Carry-Version und Daten bleiben unverändert.

Bestehende Character-Engine-, Auth-, Nachrichten-, Orts-, Rollen- und Recovery-Regressionen liefen mit. Kein produktiver Recovery-Import und keine produktive Zählstandsänderung.

### Zusammenhängender echter Browserablauf

1. Mantel ablegen → vollständiger Reload → leerer Körperplatz → wieder anlegen → Reload.
2. Synthetische Kleidung mit Menge, Text, Tags und echtem Testbild über Dateiauswahl hochladen → speichern → Reload → geschütztes Bild geladen → am Körper anlegen.
3. Einlagern → archivieren → Archiv anzeigen → dieselbe ID wiederherstellen → bearbeiten. Warnung vor Verwerfen ungespeicherter Änderungen geprüft.
4. Spieler und SL öffnen gleichzeitig denselben Editor. SL speichert zuerst; Spieler erhält HTTP 409, sein Eingabetext bleibt stehen. Nach Neuladen ist der SL-Stand erhalten.
5. Waffe und Rüstung über die Oberfläche mit Testprofilen anlegen → speichern → Reload → Körperzuordnung und Hinweis auf offene Ausrüstung prüfen.
6. Volles 12er-Profil verhindert einen weiteren Rucksackgegenstand; Wechsel auf 20 speichert dauerhaft. Lagergegenstände belegen keine aktive Kapazität.
7. Spieler B versucht dieselbe Charakter-ID zu öffnen → serverseitig verweigert. SL sieht geteilte Testkleidung, aber weder private Schlüssel/Notizbuch noch privaten Kopfschutz.
8. Mobiler Editor speichert Menge 4, die nach vollständigem Reload erhalten bleibt. Zusätzlich tatsächliches Ziehen eines Gegenstands auf einen Körperplatz, Reload und anschließendes Zurücklegen geprüft.
9. Direkte Inventarverknüpfung vom Charakterbogen und über Sitzung → Spieler → Geteiltes Inventar öffnen im echten SL-Browser geprüft.

Nachweise unter `outputs/inventory-2/`: `typecheck.log`, `lint.log`, `build.log`, `unit-tests.log`, `integration-tests.log`, `local-database-proof.json`, `player-final-desktop.jpg`, `gm-desktop.jpg`, `concurrent-edit.jpg`, `foreign-player-blocked.jpg`, `mobile-editor.jpg`, `player-mobile.jpg`.
Die lokale Testkleidung ist weiterhin als TEST_DATA markiert und besitzt die ID `item.b5d7ab75-6d61-48e1-b5fd-c27c68ed1a0f`. Die Testgegenstände bleiben für persönliche QA erhalten.

## Grenzen / offene Punkte

- **TEILWEISE IMPLEMENTIERT:** visuelles Anziehen als schematische SVG-Ebenen; keine individuellen Kleidungsbilder auf einem 3D-Avatar, keine Rüstungsauswirkung auf Charakterwerte.
- **NICHT IMPLEMENTIERT:** Handel mit Spielern/NSCs/Händlern, Wirtschaft, neue Gewichtsregeln, öffentliche Veröffentlichung. Dafür ist separate Freigabe erforderlich.
- **PROBLEM / RISIKO:** Der bestehende Build meldet weiterhin Client-Chunks über 500 kB sowie nicht vollständig klassifizierbare Vinext-Routen. Build erfolgreich; kein neues Framework- oder Abhängigkeitenupgrade in diesem Auftrag.
- **PROBLEM / RISIKO:** Unlesbare strukturierte Legacy-Items werden nicht entfernt oder stillschweigend ignoriert. Schreibvorgänge stoppen kontrolliert mit Konflikt, bis der Altbestand gezielt geprüft wird.
- Beim Wechsel der Item-Sichtbarkeit muss eine bisher anders freigegebene Bildzuordnung neu gesetzt werden. Die Oberfläche erklärt das; die Originaldatei wird erhalten.
- Nicht zugeordnete Uploads verbleiben in der vorhandenen Dateiverwaltung. Kein unaufgeforderter automatischer Löschlauf.
- Persönliche Abnahme und jede spätere Live-Veröffentlichung stehen aus. Die lokale Anwendung ist das prüfbare Zwischenergebnis.

## Lokal erneut prüfen

`npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, `npm run test:integration` mit der bereitgestellten Node-Laufzeit. Tests verwenden lokale Ressourcen; der interaktive Demo-Start ist `node scripts/test-local.mjs --inventory` nach einem lokalen Build. Der Windows-Starter prüft die Bindings zusätzlich.

Geänderte Dateien: `CHANGED_FILES.txt`. Vollständiger Source-Stand und QA-Nachweise werden zusätzlich lokal unter `outputs/inventory-2/` gesichert. Keine Secrets, lokalen Datenbanken oder produktiven Zugangsdaten im Source-Paket.
