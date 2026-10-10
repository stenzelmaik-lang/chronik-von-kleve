# Codex v1 – Spielerfreigabe in der geschlossenen Pre-Alpha

## Verbindliche Betreiberentscheidung

Referenz: `codex-pre-alpha-player-access-2026-10-10`.

Die Projektleitung hat in diesem Entwicklungsauftrag ausdrücklich entschieden, alle 15 vorhandenen Quellen der festgelegten Sammlung für die von Pano zugelassene geschlossene Spielrunde technisch bereitzustellen. Die rechtliche Nutzung ist noch ungeklärt. **Diese Entscheidung ist kein Lizenznachweis.** Technische Tests, Buchmetadaten und Oberfläche dürfen sie nicht als bestätigte Nutzungsrechte ausgeben.

Der Auftrag ersetzt die vorherige SL-only-Zielsetzung und die zuvor gewünschte individuelle Google-Drive-Prüfung. Es wird keine zusätzliche Google-Anmeldung eingerichtet. Panos Drive bleibt die verwaltete Quelle; vorhandene private, unverändert aufbereitete Kapitel, Originalseiten und Suchindex bleiben die Laufzeitbasis des bestehenden Readers. Keine öffentliche Drive-Freigabe wird zum Zugangsschutz erklärt; bestehende Drive-Berechtigungen werden nicht verändert.

## Technische Trennung

- `rights`, `rightsEvidence` und `rightsConfirmedAt` bleiben unverändert. Ungeklärte Werke behalten `rights=pending`.
- Nur ausdrücklich vorbereitete Codex-Bücher erhalten `playerAccessBasis=operator_pre_alpha` und die oben festgelegte `playerAccessDecision`; Zeitpunkt der Aufnahme wird dokumentiert.
- Diese Grundlage ermöglicht eine Spielerfreigabe, schaltet aber allein kein Buch frei: `readerReady`, `playerReleased`, Kampagnen-/Entity-Sichtbarkeit und Kapitel-Sichtbarkeit müssen ebenfalls passen.
- Alte Bücher ohne dokumentierte Entscheidung behalten die bisherigen Freigabebedingungen. Kein globaler Bypass und keine automatische Freigabe anderer Quellen.
- Die Freigabe-API akzeptiert weiterhin ausschließlich Buch-ID und Freigabe-Bool, keine Lizenz-/Entscheidungsfelder. Nur ein aktiver Kampagnen-SL/Owner darf sie verwenden.
- Bestehende ChroniPlay-Authentifizierung und aktive Kampagnenmitgliedschaft bleiben erforderlich. Unangemeldete, gesperrte, ausstehende oder kampagnenfremde Nutzer erhalten keine Buchinhalte.

## Sofortiger Widerruf

Pano öffnet den bestehenden Bereich **Buchfreigaben für Spieler** und wählt beim betroffenen Werk **Freigabe entziehen**. Danach lehnt der Server neue TOC-/Kapitel-/Originalseitenanfragen ab; neue Suchanfragen enthalten keine Fundstellen dieses Buchs. Keine R2-Löschung, kein Neuaufbau des Readers und keine Datenbank-Rücksetzung erforderlich. SL kann das Werk zur Prüfung weiterhin lesen.

Bereits angezeigte, im Browser vorhandene oder abfotografierte Inhalte lassen sich nicht rückwirkend zurückholen. Private `no-store`-Antworten und serverseitige Prüfung verhindern eine neue unautorisierte Auslieferung, nicht das Kopieren bereits gelesener Inhalte.

## Lokale Prüfung und spätere Release-Vorbereitung

- `node scripts/test-local.mjs --codex-players`: frische ausschließlich lokale D1/R2-Testressourcen, vorhandene synthetische Testrollen, eigener Port 8805. Keine echten Spielerzugänge verwenden.
- `node scripts/codex-all-acceptance.mjs --players-pre-alpha`: vorhandene Vollquellenprüfung nun im tatsächlichen Spielerzugriff; Kapitel, Originalseiten, Herkunft, Suchfundstellen und private Pfade prüfen.
- `node scripts/codex-release-package.mjs --players-pre-alpha`: neues privates Paket unter `.local-work/codex-player-release-20261010`; altes SL-only-Paket bleibt erhalten. Der Generator liest die gesicherte Produktionskopie ausschließlich read-only und hat keine Netzwerkbindung.
- Das Stage-Paket enthält alle 15 neuen Bücher zunächst mit `readerReady=false` und `playerReleased=false`. Erst getrennte, geprüfte Aktivierung setzt beide Werte und protokolliert Pano als Freigabeakteur. Neue Kapitel sind entsprechend der ausdrücklichen Freigabeentscheidung vorbereitet.
- `node scripts/codex-copy-package-check.mjs --players-pre-alpha`: lokaler Import auf neuer Produktionskopie, alle Kapitel/Originalseiten als Spieler lesen, alle 15 Widerrufe und Wiederfreigaben prüfen, bestehende Fachzeilen vergleichen.

Keine zusätzliche Schemaänderung: bestehendes Entity-JSON genügt, Migration 0012 bleibt unverändert. Keine Konten-, Rollen-, NPC-, Charakter- oder Kampagnenübernahme. Keine produktive Migration, kein Upload, kein Deployment und kein automatischer Spielerzugriff durch diesen Entwicklungsauftrag.

Der bisherige SL-only-Cutover darf nicht unverändert für diesen Stand verwendet werden. Eine spätere Veröffentlichung benötigt den neuen abgenommenen Commit, frisches Produktionsbackup/Preflight und das neue getrennte Spieler-Aktivierungspaket. Kein blinder B0-Restore nach Anmeldungen oder neuen Spielvorgängen.

## Abnahmenachweis vom 10.10.2026

- 192/192 Unit-/Regressionstests bestanden; vollständige HTTP-Integration inklusive Rollenprüfungen bestanden. TypeScript, Prüfung der geänderten Laufzeitdateien und isolierter Produktionsbuild bestanden.
- Das neue Stage-/Aktivierungspaket wurde auf einer separaten Kopie der gesicherten Produktionsdatenbank importiert: 15 Bücher, 1.213 Kapitel, 2.911 Originalseiten. Alle Seiten gegen die privaten Bild-Hashes und alle Kapitel gegen gespeicherte Quellabschnitte geprüft. Bestehende Zeilen in 31 Tabellen unverändert; Fremdschlüsselprüfung ohne Befund, SQLite-Integrität `ok`.
- Jedes der 15 Bücher einzeln entzogen und wieder freigegeben. Entzug blockiert TOC, Kapitel, Originalseite vor Speicherzugriff und Suchtreffer. Spieler können nicht selbst freigeben; gesperrte, ausstehende und kampagnenfremde Rollen bleiben ausgeschlossen.
- Lokaler HTTP-Spielerlauf: 5.230 Prüfungen bestanden; vollständige Kapitelübernahme und anklickbare Suchfundstellen für jedes der 15 Werke. Bibliothek 7.763 Bytes/22 ms, Kapitelmediane je Werk 13–17 ms, größtes Kapitel 60.899 Bytes, Suchmedian 19 ms/P95 20 ms. Dies sind lokale Messwerte, keine Produktions-Latenzgarantie. Originalseiten werden separat und bedarfsgerecht geladen, keine vollständigen PDFs beim Öffnen.
- Desktop-/Mobil-Browserprüfung mit ausschließlich synthetischem Spieler: 15 lesbare Deckblätter, großes V20-Werk, Originalseite, Suchtreffer per Enter, Quellenkennzeichnung, Rückkehr zur Bibliothek und Fortsetzen an derselben Fundstelle. Bei Mobilbreite 390 px kein horizontaler Seitenüberlauf, Originalbild erfolgreich geladen. Keine Buchfreigabe-Aktionen oder Download-Links für Spieler. Kein Redesign.
- Der direkte große Miniflare-Importlauf dieser Windows-Testumgebung brach mit `EADDRINUSE` ab. Er wird nicht als bestanden ausgegeben. Die HTTP-/Browserabnahme erfolgte anschließend auf einer neuen, konsistent gesicherten Kopie der bereits vollständig importierten synthetischen SL-Fixture mit der neuen expliziten Spielerentscheidung; die ursprüngliche Vorschau blieb unverändert. Der unabhängig geprüfte vollständige Paketimport auf der Produktionskopie ist davon getrennt.
- Die bisherigen Quellenbeschränkungen bleiben sichtbar: ungeprüfte OCR-Suchhilfen, originale Seiten als verbindliche Ansicht und vier Werke mit weiterhin offener Editionszuordnung. Es wurden weder Regeltexte verbessert noch Editionszuordnungen erfunden.
- Private Nachweise und Spielerpaket: `.local-work/codex-player-release-20261010/`. Kein Upload, kein Push, keine produktive Migration und kein Deployment. Migration 0012 ist unverändert; der bestehende Kopiennachweis bleibt gültig.

**Spieler-Reader technisch zur Abnahme bereit: JA.** Dies ist weder eine Live-Freigabe noch eine Lizenzbestätigung.
