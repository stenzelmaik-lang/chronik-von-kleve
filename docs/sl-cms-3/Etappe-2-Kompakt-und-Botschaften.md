# SL-CMS 3.0 – Kompakte Führung und persönliche Botschaften

30.10.2026 · ausschließlich lokal · Folgeauftrag zur persönlichen UX-Prüfung.

## Umsetzung des aktuellen Durchgangs

- Szenen besitzen keine sichtbare Metadaten-/Favorit-/Anheften-Rubrik mehr. Bestehende Werte bleiben gespeichert. Die Spielabend-Icons aus dem vorherigen Stand bleiben erhalten.
- Titel und zentraler Hauptort sind nur im ersten Szenenschritt editierbar; spätere Schritte bearbeiten ausschließlich ihren jeweiligen Bereich.
- Die drei wiederholten Navigations-/Speicherzeilen sind durch eine kompakte Planungsleiste ersetzt: zurück zum Spielabend, Kontextüberschrift, Wechselmenü, Aktenaktionen und Speichern. Andere Abende/Szenen sowie Neuanlage sind weiter über „Wechseln“ erreichbar. Die bestehende ungespeicherte-Eingaben-/Versionssicherung bleibt aktiv.
- NPCs werden über einen kompakten, aufklappbaren Suchbereich mit Bild-/Namensschaltflächen ausgewählt. Gewählte NPCs bleiben erkennbar; mehrere Originalakten sind möglich. Es werden ausschließlich vorhandene Primärbilder verwendet.
- Vorhandene Hinweise und Handouts sind hinter einer eigenen aufklappbaren Auswahl mit Suche erreichbar. Die akzeptierte Materialtypenauswahl und ihre bestehenden Bausteine bleiben erhalten.
- Der Schritt heißt **Visionen & persönliche Botschaften**: Empfänger wählen, Text vorbereiten, optional Bilder/Dateien anhängen oder einen bestehenden Szenenbaustein bewusst übernehmen, Inhalt/Empfänger prüfen und dann „Privat zustellen“.

Die vorhandene Galerie ist funktional und liest `/api/files`. Ein leerer lokaler Bestand zeigt deshalb „Noch keine Bilder vorhanden“. Es werden keine produktiven Bilder importiert und keine Dateikopien angelegt.

## Bestehender Nachrichtenpfad statt zweitem System

Zustellung verwendet weiterhin `/api/messages`, das private Nachrichtenarchiv in `records` und den bestehenden persönlichen Posteingang. Ein neues, nur für aktive SL zulässiges Format ergänzt sichere Rich-Text-Inhalte und bis zu 20 private Dateireferenzen. Normale Spieler-Nachrichten und die bestehenden Versand-/Leserechte bleiben erhalten.

Speichern, Weiter, Szenenwechsel oder Auswahl eines Empfängers versenden nichts. Der Versand benötigt eine eigenständige Inhalts-/Empfängerprüfung und die ausdrückliche Schaltfläche. Eine erneute identische Anfrage verwendet dieselbe Befehlsidentität und dupliziert die Zustellung nicht. Fehler beim Speichern verhindern den Versand. Die Zustellung ist nach Erfolg im vorhandenen Senderarchiv nachprüfbar.

Ein Szenenbaustein übernimmt nur seinen vorbereiteten Text und eine zugeordnete Datei in die bearbeitbare Botschaft. Verknüpfte Originalakten werden nicht aufgelöst oder vollständig kopiert; insbesondere gibt es keine automatische Übernahme ihrer SL-Geheimnisse. Nach der Übernahme zeigt der Editor den aktuellen Text und die Vorschau zur Kontrolle.

Die Empfänger erhalten einen unveränderlichen Nachrichtentext-Snapshot. Weitere Szenenänderungen schreiben die gesendete Botschaft nicht um. Das gewöhnliche Veröffentlichen einer Szene bleibt von persönlichen Botschaften getrennt und liefert diese weiterhin nicht aus.

## Schutz und Speicherung

- Neue optionale Felder `visionRecipientIds` und `visionFileIds` liegen im bestehenden privaten Szenen-JSON, mit leeren Standardwerten für alte Dokumente. Kein Tabellenwechsel, keine Migration.
- Vorbereitungs-Empfänger werden serverseitig auf aktive Spieler derselben Kampagne geprüft. Beim Senden prüft der bestehende Nachrichtenpfad die Empfänger erneut.
- Rich-Text wird serverseitig mit der bestehenden sicheren HTML-Verarbeitung aufbereitet. Nur die ausgewählte Botschaft wird versendet; Geheimnisse, übrige Texte, NPC-Metadaten und andere Szeneninhalte bleiben draußen.
- Jede Datei muss beim Versand in derselben Kampagne für die SL zugänglich sein. Eingebettete Bilder werden genauso geprüft wie explizite Anhänge.
- Private Nachrichten erlauben dem jeweiligen Empfänger und Sender den authentifizierten Zugriff auf ihre ausdrücklich zugestellten Dateien. Das erzeugt keine Gruppenfreigabe und verändert weder Datei-Eigentümer noch Dateisichtbarkeit. Andere Spieler erhalten auch bei bekannter Datei-/Nachrichten-ID 404.
- Aktive Anmeldung und Kampagnenzugriff werden vor jedem Datei-/Nachrichtenzugriff geprüft; Dateien bleiben `private, no-store`.
- Generische Record-Schreib-/Freigabewege dürfen Nachrichten und ihre Anhänge weiterhin nicht fälschen oder neu freigeben. Das Nachrichtenarchiv bleibt erhalten; bestehender Dateiverwendungsschutz umfasst die gespeicherten Referenzen.

Der persönliche persistente lokale Teststand wurde vor dem Eingriff unter `.local-test/before-compact-personal-messages-20261030` gesichert. Alle schreibenden Prüfläufe verwenden ausschließlich getrennte synthetische Testdaten. Konten, Charaktere, Kampagnen- und produktive NPC-Daten wurden nicht verändert oder importiert.

## Prüfnachweise

- Typecheck, gezielter ESLint und Produktionsbuild bestanden.
- 145 Unit-/Regressionstests bestanden, einschließlich leerer Standardwerte für alte Szenen, Textlimits und Nachrichtenformatvalidierung.
- 1.780 isolierte HTTP-Integrationsprüfungen und 46 Rollen-/Backfill-/Rollback-Prüfungen bestanden.
- Der erweiterte Browserablauf prüft die kompakte Leiste, fehlende Szenen-Metadaten, Titel/Hauptort nur in Schritt 1, NPC-Schaltflächen, HTML, Galerie, Materialvorbereitung und getrennte Geheimnisse.
- Persönliche Zustellung im Browser: Spieler A erhält die formatierte Botschaft mit übernommenem Handouttext und privatem Bild im tatsächlichen Postfach. Spieler B erhält weder Nachricht noch Datei. Die übrigen Szenengeheimnisse fehlen. Vorbereitung allein stellt nichts zu.
- Weitere Prüfungen: Wiederaufnahme, Fehler-/Versionskonfliktschutz, genau 10.000 Zeichen speichern, 10.001 Zeichen abweisen, Tastatur, 1920/1440 px, 390 px Mobil und CSS125. CSS125 ist kein Nachweis eines nativen Browser-Zoomtests.
- Der bisherige vollständige SL-Browserablauf wird weiter mitgeführt: Spielabende/Szenen, Reihenfolge, Rücknavigation, HTML/Vollbild, Speichern/Neuladen, Mobil, Rechte und Löschen/Abbrechen.

Die Browserprüfungen wurden an die bewusst hinter „Wechseln“ verschobenen Auswahlen angepasst. Tests verwenden getrennte lokale Konten und keine realen Spielerzugänge. Die CI-Konfiguration führt dieselben Prüfpfade; ein entfernter CI-Lauf wird ohne Push nicht behauptet.

## Abnahmegrenze

Interaktive Abnahme weiter unter `http://localhost:8822/sl/command-center?bereich=sitzung` mit den bisherigen lokalen Spielabenden. Keine Veröffentlichung, kein Push/Merge und kein Live-Eingriff. Der neue Szenen-/Nachrichten-Parser gehört bei einer späteren Veröffentlichung zum gleichen Stand wie die Oberfläche; alte strikte Parser sind nicht als kompatibles Rollback geprüft. Persönliche UX-Abnahme bleibt erforderlich.
