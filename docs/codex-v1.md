# Codex v1 — historischer Ein-Dokument-Prototyp

Dieser Bericht dokumentiert das erste Muster. Für die anschließende Erweiterung auf alle 15 Quellen gilt [codex-all.md](codex-all.md); die unten genannten Grenzen und Messwerte sind keine aktuelle Gesamtabnahme.

## Grenze und Basis

Branch: codex/m1-kernmodell. Ausgangscommit: ee41185fe24e4a6fcba2822d01621d6605003f67.
Kein Deployment, kein Remote-D1-Aufruf, keine produktive Migration und keine bestehenden Spieler-, NPC-, Charakter- oder Kampagnendaten geändert.
Nur die 15 Metadatensätze aus dem freigegebenen Drive-Ordner und ein vollständiges eigenes Dokument werden im isolierten lokalen Testbestand angelegt. Import und Demo-Seeding sind kein App-Startverhalten.

Quellarchiv: https://drive.google.com/drive/folders/1cgtpctqT575xwwaRgXb3syfBvMZwlnXV
Vollständige Inventarmetadaten: tests/fixtures/codex-inventory.json (15 Einträge, 10 PDF, 5 native Google Docs).
Editionen nach belegbarer Dateibenennung: 3 V20, 6 V5, 2 Chronik-Dokumente, 4 ungeklärt. Ungeklärte Editionen werden nicht geraten.

## Schlanke Architektur

- Ein Buch ist eine bestehende RULE-Entity mit documentKind=codex_book.
- Kapitel sind bestehende entity_content_blocks, kind=codex_chapter, mit stabilen Kapitel-/Abschnitts-IDs, Quellpositionen und strukturierten Texten/Tabellen.
- Migration 0012_codex_reader_index.sql ergänzt nur die abgeleitete Tabelle codex_sections sowie einen FTS5-Index und drei Synchronisationstrigger. Bestehende Tabellen und Zeilen werden nicht umgeschrieben.
- Journal und Drizzle-Snapshot 0012 sind integriert. Der Snapshot beschreibt die normale Tabelle; die virtuelle FTS-Tabelle und ihre Trigger werden ausdrücklich in SQL und Tests geführt.
- Kapitel und TOC werden getrennt angefragt. TOC und Suchabfrage lesen nur die benötigten Metadaten, nicht komplette Kapitelkörper. Es findet kein PDF-Download und kein Drive-Zugriff beim Lesen oder Suchen statt.
- GET /api/codex liefert Bibliothek, TOC, genau ein Kapitel oder maximal 30 indizierte Fundstellen. Suchbegriffe werden als gebundene, gequotete Token verarbeitet.
- Die bestehende Spielwelt-Navigation und die Konten-/Kampagnenprüfung werden weiterverwendet. Der Legacy-Records-Pfad für andere Bereiche bleibt erhalten.

## Rechte und Originalschutz

Jeder Aufruf prüft aktive Kampagnenmitgliedschaft, die bestehende Entity-Projektion, die Rechtefreigabe und die Sichtbarkeit des Kapitels. Verlags-/ungeklärte Inhalte bleiben auch für die SL gesperrt. Ihre Deckblätter enthalten ausschließlich Metadaten.
Die generische Content-Block-API liefert Codex-Kapitel nicht aus und kann sie nicht ändern oder löschen. So kann sie weder Rechtefreigabe noch Suchindexpflege umgehen.
Eine spätere Live-Freigabe setzt einen tatsächlich privaten R2-Speicher ohne öffentliche Bucket-Domain voraus. Die produktive Bucket-Konfiguration wurde hier nicht verändert und nicht als live-abgenommen bewertet; sämtliche Originalschutztests betreffen die isolierte lokale Simulation und die serverseitigen App-Routen.
Antworten sind private, no-store. Es gibt keine neue öffentliche Datei-Route, keinen Download-Knopf und keine Original-URL. Buch-IDs sind opake Ableitungen, keine Drive-IDs.
Das komplette native Google-Docs-API-Original wird ausschließlich als privater JSON-Snapshot unter codex-originals/<SHA-256>.json in der lokalen R2-Simulation archiviert; es erhält keinen files-Eintrag. Der Originaltyp ist ein natives Google Doc, keine PDF-Datei.
Eine berechtigte Person kann angezeigten Text dennoch kopieren oder fotografieren. Absoluter Kopierschutz wird nicht behauptet.

## Ein vollständig verarbeitetes Muster

Stress-Regel – Spielerhandout; Drive-ID 1IzxykSEhrxuoCQ9oyUHndjCyW8HFWrlyGLmbkp_KNHM; Quellstand 2025-07-20T11:10:55.808Z.
SHA-256 des vollständigen nativen API-Snapshots:
fc1324b01868c2c889ecfa5ca39ab817f1c63b68bdca3bf9804c1bd5c44c5d64.

6 Kapitel einschließlich Einführung, 34 Inhaltsbereiche, eine Tabelle mit 13 Zeilen und 2 Spalten. Zeichenbereiche und Tab t.0 bleiben exakt nachvollziehbar; native Docs haben hier keine feste PDF-Seitenzählung.
Absätze, manuelle Zeilenumbrüche und Fett-/Kursivschrift werden dargestellt. Tabellenzellen und Reihenfolge bleiben unverändert; Tabellen erhalten Kopfzeilen und einen tastaturbedienbaren horizontalen Scrollbereich. Die Tabellen-Zellenformatierung ist vereinfacht, keine pixelgenaue Google-Docs-Reproduktion.
Die ungewöhnlichen Fortsetzungszeilen, der ausgelagerte Markdown-Rest nach der Tabelle und die widersprüchlichen Beispielzähler stammen bereits aus der Quelle. Keine stille Korrektur, keine Übernahme in die Character Engine und keine Vermischung mit V20-/V5-Verlagsregeln.

## Reproduzierbare lokale Prüfung

Voraussetzung: vollständiger native get_document-Snapshot des genau ausgewählten Docs als .local-work/codex-v1/source.json. Dieser Originaltext ist bewusst nicht versioniert und nicht Teil öffentlicher Build-Assets.

1. node scripts/run-framework.mjs build
2. node scripts/test-local.mjs --codex
3. http://127.0.0.1:8804/anmelden
4. Ausschließlich lokale Testkonten: command-gm@example.invalid / command-a@example.invalid; vorhandenes Demo-Passwort ChroniPlay-Demo-2036!
5. node scripts/codex-acceptance.mjs

Die Vorschau ist isoliert und flüchtig. Nach einem Neustart sind eine neue Anmeldung und ggf. das Wiederöffnen der Leseposition nötig. Die Leseposition speichert nur IDs und Scrollposition, keine Regeltexte, und ist nach Konto/Kampagne/Rolle getrennt.

Tests:
- node --experimental-strip-types --test tests/codex.test.mjs
- vorhandene vollständige Unit-/Regressionssuite, Typecheck, Lint und Build
- node scripts/test-local.mjs (alle Migrationen einschließlich 0012; bestehende Bereiche und Codex-HTTP-Schutz)
- node scripts/codex-acceptance.mjs (vollständiger ausgewählter Quelltext, Tabellenvergleich, Originalschutz und lokale API-Laufzeiten)

## Bewusste Restgrenzen

Keine weiteren Dokumenttexte importiert. PDF-Extraktion, PDF-Seitenzuordnung, OCR und komplexe Layouts sind für die zehn PDFs noch nicht implementiert oder abgenommen. Die übrigen nativen Docs sind ebenfalls noch nicht für Inhaltsübernahme freigegeben.
Für die Verlagsbücher fehlen entsprechende Nutzungs-/Online-Veröffentlichungsrechte. Frei verfügbare Dateien oder eine Backer's Copy ersetzen keine entsprechende Freigabe. Bei abgeleiteten Zusammenfassungen, Charaktererschaffungsregeln und dem V20-SL-Dokument sind Herkunft, Edition und zulässiger Inhaltsumfang zu klären.
Das Erfahrungs-/Belohnungsdokument enthält Tabellen und SL-bezogene Beispiele; diese sind nicht automatisch Spielerinhalte. Die beiden unklar benannten PDFs benötigen eine Editions-/Duplikatprüfung. Der V20-Charakterbogen benötigt eine gesonderte Formular-/Layoutbehandlung.
Gemessene Laufzeiten gelten nur für den lokalen kleinen Prototyp, nicht für die spätere vollständige PDF-Bibliothek oder einen Produktions-SLA.

## Abnahme 2026-10-09

183/183 Unit-/Regressionsprüfungen, 1205 Integrationchecks und 46 Rollenprüfungen bestanden. Alle journalisierten Migrationen wurden auf frischem lokalem D1 angewendet; Typecheck und Build bestanden. Lint: keine Fehler, fünf unveränderte bestehende Warnungen; bestehende Bundlegrößenwarnung bleibt außerhalb dieses Auftrags.
75 zusätzliche Prüfungen des vollständigen Stress-Handouts bestanden, einschließlich Vergleich aller aufbereiteten Quellbereiche, Tabellenzellen, privater Antworten und verweigertem Originalzugriff. Auch direkte Quell-, Arbeits- und Testdateipfade liefern 404.
Lokale API-Messung über mehrere Läufe: Kapitel ca. 13–22 ms, 737–3076 Bytes pro Kapitel; Suche Median ca. 15 ms, zwölf Anfragen, zusätzlich 250 ms Eingabeentprellung. Diese Angaben sind API-Zeiten, keine gemessenen Browser-LCP-Werte.
Browser: eigenständige synthetische SL-/Spielerrollen, Desktop, 375×812 und 768×1024 geprüft. Kein seitlicher Seitenüberlauf, Tabellen lokal horizontal scrollbar. Enter-Bedienung von Buch/Kapitel/Suchtreffer, Absatzfokus nach React-Commit, Wiederöffnung einer Fundstelle nach Neuladen, Editionsfilter, Rückkehr zur Bibliothek und Wiederaufnahme der Leseposition bestanden. Im Spieler-Reader keine Bearbeitungsfelder. Verlagsbuchöffnung bleibt auf Metadatenhinweis beschränkt.
Codex v1 – Grundsystem abnahmebereit: JA, für den beauftragten lokalen Ein-Dokument-Prototyp. Keine Live-Freigabe und keine Freigabe der übrigen Buchinhalte.

Die Drive-Skill-Vorgaben haben die explizite Inventarisierung und Quellprovenienz bestimmt; die Workers-Sicherheitsvorgaben haben die Prüfung pro Anfrage, fehlende öffentliche Original-Route und das private Cache-Verhalten bestimmt.
