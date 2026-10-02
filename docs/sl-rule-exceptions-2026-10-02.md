# SL-Regelausnahmen – 2026-10-02

Lokale Korrektur auf codex/story-scene-manager-foundation, Ausgangscommit 5330fe3.

## Funktion

Charakter → SL-Prüfung → SL-Regelausnahme & Punkte eintragen.
Die zuständige aktive Kampagnen-SL kann Nosferatu-Erscheinungsbild oder eine
clansfremde Disziplin für einen Engine-Erschaffungsentwurf genehmigen und den
gewünschten Wert eintragen. Anträge erlauben dieselbe Entscheidung mit Wert und
Höchststufe. Gründe, Entscheider, Zeit und Versionswechsel werden gespeichert.

Kein kostenloses Zusatzbudget: normale Erschaffung/Freebies bleiben verbindlich.
Nosferatu behalten den Grundwert 0. Die Ausnahme gilt nur für den Charakter,
nicht den gesamten Clan. Persönliche Höchstwerte werden auch bei späteren
XP-Käufen überprüft. Bestehende historische Freigaben werden nicht umgedeutet.

## Sicherheitsgrenzen

Nur aktive zuständige Kampagnen-SL; Besitzer können keine Freigaben erzeugen.
Generische Record-Schreibvorgänge dürfen ruleExceptions weder erzeugen noch
ändern – auch nicht als SL. Änderungen benötigen den protokollierten Engine-Pfad.
Veraltete Versionen: 409; atomare Speicherung und Audit über bestehendes D1-Batch.
Eingereichte Bögen zuerst zur Überarbeitung zurückgeben. Bestätigte und Legacy-
Bögen werden nicht automatisch geöffnet oder in eine neue Erschaffung überführt.
Diese Korrektur gewährt keine kostenlosen permanenten SL-Steigerungen an bereits
bestätigten Charakteren und keine Ausnahmen über Stufe 5.

## Prüfung

Build, Typecheck, vollständiges Lint: bestanden.
126 Fach-/Regressionstests; 947 isolierte Integrationstests;
zusätzlich atomarer Batch-Rollback und 46 Rollen-/Migrationsprüfungen bestanden.
Bekannte Warnung: Client-Chunk über 500 kB. Keine neue Migration.

Negative Nachweise: Spieler-Selbstfreigabe, gefälschte Record-Freigaben, Wert über
Maximum, überschrittenes Freebie-Budget und parallele Änderungen mit einer Version.

Echter lokaler Browser: synthetischer TEST_DATA-Nosferatu über normalen Dialog
angelegt; Erscheinungsbild 3 und Auspex 1 über SL-Ausnahme gespeichert;
vollständiger Reload zeigt weiterhin beide Werte. Testcharakter bleibt lokal als
QA-Muster erhalten: 544d5e73-067c-4fad-9d47-2b76cf50ac96.
Antragsentscheidung mit konkretem Wert zusätzlich in isolierten API-Tests geprüft.

Nachweise: outputs/story-scene-20261002/exception-*.log und sl-exception-browser.png.
Lokale Anwendung: http://127.0.0.1:8798/spielbereich?bereich=charaktere

Keine Änderung an Bommel oder anderen produktiven Charakteren. Kein Merge,
Deployment oder produktiver Datenbankzugriff. Ein Git-Push ist keine Live-Installation.
