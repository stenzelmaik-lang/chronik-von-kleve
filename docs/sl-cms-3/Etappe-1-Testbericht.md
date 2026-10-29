# SL-CMS 3.0 – Etappe 1

29.10.2026 · lokal implementiert · zur persönlichen Sichtprüfung bereit.

## Umsetzung

- Einstieg mit Spielabendliste; vorhandene Abende öffnen eine Lesübersicht. Bearbeitung der Spielabendmetadaten ist eine ausdrückliche Aktion. Neue Abende starten zur Eingabe im vorhandenen Editor.
- Übersicht mit Titel, bestehendem Status, Termin, geplanten Szenen, Schauplatz, vorhandenen Textbereichen, NPCs und Materialreferenzen. Auch Bilder im bestehenden Rich-Text-Dokument werden als Originaldatei-Verweise berücksichtigt.
- Versioniert gespeicherte Reihenfolge über das vorhandene `sceneIds`-Array, einschließlich stabiler Ergänzung älterer szenenseitiger Zuordnungen. Kein schreibender Backfill beim Lesen.
- Rücknavigation zum aufrufenden Spielabend, Auswahl einer weiteren Szene, neue Szene im Kontext desselben Abends. Der Aufrufkontext ist Bestandteil der URL und überlebt Neuladen und Browser-Zurück/Vor.
- Der Browsercheck fand einen Sprung zur Spielerzentrale bei Browser-Zurück. Behoben durch Beibehalten des bestehenden `bereich=sitzung`-Navigationskontexts.
- Vorhandene Editoren, Speicherpfade, Historie, Archivierung und Löschung weiterverwendet. Übersichtsmetadaten entstehen im bestehenden SL-Katalog hinter dessen Authentifizierungs- und Kampagnenschutz.
- Keine Tabellenmigration, kein zweites Szenenmodell, keine Änderung von Spielerfreigaben oder Live-Regie.

## Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| Typecheck | bestanden |
| ESLint der geänderten Anwendungs- und Testdateien | bestanden |
| Unit-/Regressionstests | 141 bestanden |
| Produktionsbuild | bestanden |
| Isolierte HTTP-Integration | 1.762 Prüfungen bestanden |
| Rollen-/Backfill-/Rollback-Proben der vorhandenen Integrationssuite | 46 bestanden |
| Browserablauf mit getrennten synthetischen SL-/Spieler-Anmeldungen | bestanden |
| Desktop 1920, Fensterbreite 1440, Mobil 390 px | bestanden; Screenshots anbei |
| CSS-Skalierung 125 % | bestanden, ohne horizontalen Überlauf |
| Nativer Browserzoom 125 % | noch nicht geprüft; nicht mit CSS-Skalierung gleichgesetzt |
| Mechanischer Designcheck | keine Befunde |

Die Browserprüfung umfasst Anlegen, HTML-Quelltext/Vorschau, Fokusmodus, Speichern/Neuladen, Übersicht ohne Formular, per Tastatur gespeicherte Reihenfolge, Browser-Zurück/Vor, NPC-Nennung in der Übersicht, dieselbe Originalszene in zwei Spielabenden und Rückkehr zum jeweils aufrufenden Abend. Ferner Entfernen beider Zuordnungsformen, Erhalt der Originalszene, mobile Navigation sowie bestehende Löschen-/Abbrechen-Aktionen.

Spieler und anonyme Zugriffe erhalten keine private Vorbereitung; der Spieler-Endpunkt liefert keine unveröffentlichten Szenen. Die Rollenprüfung verwendet eigenständige Testanmeldungen und keine SL-Gruppenvorschau.

Die HTTP-Integration lief nach der ersten Implementierung; die abschließende Erweiterung für eingebettete Bildreferenzen wurde zusätzlich durch Unit-Test, Typecheck, Build und erneuten Browserlauf geprüft. Alle Schreibtests betrafen ausschließlich isolierte synthetische lokale Daten.

## Lokale Sichtprüfung und Grenzen

Die neue Testinstanz nutzt Port **8822**. Bestehende lokale Instanzen auf 8820 und 8821 wurden nicht beendet oder verändert. Der Teststarter unterstützt einen optionalen, validierten lokalen Port, damit diese Prüfungen keine laufende Arbeit unterbrechen.

- URL: `http://127.0.0.1:8822/sl/command-center`
- Ausschließlich synthetisches SL-Testkonto: `command-gm@example.invalid`
- Lokales Testpasswort: `ChroniPlay-Demo-2036!` – kein Produktionskonto.
- Bilder: `qa/overview-desktop.png`, `qa/overview-css125.png`, `qa/overview-mobile.png`.
- Die Testdaten auf Port 8822 bleiben nur für diese laufende lokale Instanz bestehen. Es wurden keine Originaldaten aus der Kaserne oder Kontodaten aus Produktion übernommen.

Etappen 2–5 bleiben offen. Material-Schnellvorschau und geführte Überarbeitung des Szeneneditors werden nicht als fertig erklärt. Persönliche UX-Abnahme und echter Browserzoom sind offen. Bekannte Buildhinweise zu großen bestehenden Client-Chunks und statischer Routenklassifikation bestehen weiter.

Kein Push, Merge, Deployment oder Eingriff in Produktion. Nach Etappe 1 Stopp zur persönlichen Sichtprüfung.
