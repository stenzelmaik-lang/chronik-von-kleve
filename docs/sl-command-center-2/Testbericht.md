# Command Center 2.0 – Testbericht

02.10.2026; erster funktionaler Ausschnitt. Keine produktive Migration und kein Import synthetischer Daten.

## Automatisiert bestanden

| Prüfung | Ergebnis |
| --- | --- |
| Typecheck | bestanden |
| vollständiger Lint | bestanden |
| lokaler Build | bestanden |
| Fach- und Regressionstests | 115 / 115 |
| isolierte Integration | 834 Prüfungen bestanden |
| Rollen-, Backfill- und Rollback-Proben | 46 Prüfungen bestanden |

Die Integration verwendet ausschließlich isolierte lokale D1/R2-Ressourcen mit der Migrationskette 0000–0007. Geprüft wurden insbesondere SL/Spieler/Editor/Plattformrolle, fremde Kampagnen, pending/blocked, geschützte Charakterreferenzen, Recovery-Sperren, GM_SECRET trotz Wissenserteilung, getrennte Anordnungen, Versionskonflikte, idempotente Erstellung, atomare Historie und private Sitzungsmomente. Die bestehende Charakter-, Inventar-, Auth-, Orts- und Recovery-Regression bleibt enthalten.

Ein zusätzlicher Sitzungstest weist nach: Szenenänderung Version N→N+1; Notiz mit Version N erhält 409; Szene und alte Notiz bleiben erhalten; nach bewusstem Vergleich gespeicherte Notiz erhält die neue Szene; Spieler bekommen die private Notiz nicht.

Bekannte Build-Warnungen bleiben dokumentiert: Client-Chunks über 500 kB, Plugin-Zeitwarnung des Bundlers und unvollständige statische vinext-Routenklassifizierung. Kein Buildfehler. Kein pauschales Abschalten dieser Warnungen.

## Echte lokale Browserprüfung

Normale Anmeldung als synthetische SL sowie zwei getrennte synthetische Spieler; keine gefälschten Auth-Header.

- Plottext im Rich-Text-Editor gespeichert; vollständiges Neuladen erhält Inhalt.
- Auswahlwechsel und zwei angeheftete Charaktere verändern den roten Faden nicht.
- Spaltenbreite per Tastatur von 58 auf 63 verändert und nach Neuladen erhalten; zweites Fenster behält seine eigene Anordnung.
- Initiale Auswahl und spätere Fokuswechsel zwischen zwei Fenstern synchronisiert; fixierte Akten bleiben unverändert.
- Persönlicher Brief gezielt an Spieler A geschickt: im realen Posteingang A vorhanden, bei Spieler B nicht vorhanden.
- XP-Vergabe an B über bestehende Engine: 15→17; tatsächlicher Spielerbogen zeigt nach Neuladen 17.
- Eingereichten Charakter A über bestehenden Prüfungsdialog bestätigt.
- Vertrauliche SL-Charakternotiz bei B gespeichert; Spieler-DOM enthält weder diese Notiz noch private Plottexte.
- Spieler A und B verändern gleichzeitig ihre jeweiligen Blutwerte 8→9; beide behalten nach Neuladen ihren eigenen Wert.
- Tatsächlichen Sitzungsmoment gespeichert und nach Neuladen wiedergefunden. Vorbereitete Möglichkeit bleibt offen.
- Electric Taberna über bestehendes Ortsmodell geöffnet und bewusst als Schauplatz gesetzt.
- Neue Bestätigung direkt in der Anwendung: Abbrechen erhält einen ungesendeten Brief; Bestätigen schließt die Fläche. Kein blockierender JavaScript-confirm-Dialog im neuen Regieweg.
- Notiz während paralleler Szenenänderung offen gehalten: tatsächlicher 409, Eingabe erhalten, explizite Bestätigung, danach neue Szene und Notiz gemeinsam nach Neuladen erhalten.
- Charakter-Schnellaktion öffnet genau das eine bestehende Brieffenster mit passendem Empfänger; kein zweites Versandformular.

Die Browserprüfung hat echte Fehler gefunden und korrigiert: kollabierte Arbeitsflächenhöhe, doppeltes Briefformular, blockierende Bestätigung und veraltete Sitzungsnotizen mit unzureichendem clientseitigem Versionsbezug.

Der Gruppenblick ist eine serverseitige Vorschau, kein unabhängiger Spielerlogin. Die oben genannten A/B-Prüfungen wurden mit getrennten tatsächlichen Anmeldungen durchgeführt. Live-Nachweise werden separat dokumentiert; lokale Tests allein sind kein Deploymentnachweis.
