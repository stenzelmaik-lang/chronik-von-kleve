# Codex v1: alle 15 Quellen, ausschließlich lokal

Die Erweiterung verwendet weiterhin RULE-Entities, `entity_content_blocks` und den abgeleiteten FTS5-Index aus Migration 0012. Keine zusätzliche Migration, kein paralleles Buchmodell, kein Deployment. Originale und aufbereitete Inhalte liegen ausschließlich in ignoriertem lokalem Arbeitsbestand beziehungsweise frischem synthetischem Test-D1/R2. Keine realen Spieler-/NPC-/Kampagnendaten werden importiert oder bearbeitet.

## Gemeinsamer Import und Reader

- 10 originale PDFs (2866 Seiten) und 5 native Google Docs. Zusätzlich lokale PDF-Exporte der Google Docs (45 Seiten), nicht fünf weitere Bücher.
- Native Docs: vollständiger API-Snapshot mit Revision, Tabbaum und Quellindizes. Text, Reihenfolge und Tabellenzellen bleiben unverändert; Fett/Kursiv und Quelltrenner werden dargestellt. Eigene tatsächliche Überschriften bestimmen Kapitel; ohne Überschriften wird keine Gliederung erfunden.
- Google-Docs-Grafiken, Seitenfuß, Tabellenformatierung und ursprüngliches Layout bleiben vollständig in ergänzenden Originalansicht-Kapiteln erhalten. Die HTML-Textansicht allein ist keine pixelgenaue Reproduktion.
- PDF: jede Originalseite wird offline gerendert, separat gehasht und als geschütztes JPEG gespeichert. Die Originalseiten sind die verbindliche Darstellung für Tabellen, mehrspaltigen Text, Kästen, Grafiken und Formularseiten; keine künstliche HTML-Tabellenrekonstruktion.
- PDF-Lesezeichen bleiben vollständig mit Originaltitel, Quellreihenfolge und Seitenziel erhalten, auch Rückverweise auf frühere Seiten. Zwei PDFs ohne Lesezeichen besitzen ein gedrucktes Inhaltsverzeichnis: dessen vorhandene Einträge werden gegen eindeutige Druckseitenstempel geprüft übernommen (V20-Regelwerk 12 Einträge, V5-Companion 11). Ohne belegte Gliederung werden ausdrücklich Seitenbereiche angezeigt, keine erfundenen Kapitelüberschriften. Oversize-Kapitel werden nur an Quellabschnittsgrenzen in Teile geteilt; keine Kürzung. Eine einzelne nicht teilbare Oversize-Sektion stoppt den Import.
- PDF-Textschicht dient unverändert dem vorbereiteten Suchindex. Bildbasierte Seiten haben eine separate, ausdrücklich ungeprüfte OCR-Suchhilfe; diese überschreibt niemals Originaltexte. OCR kann falsch erkennen oder Text übersehen. Der Import ist keine Behauptung einer vollständig manuell geprüften Transkription.
- Reader lädt TOC, einzelne Kapitelteile (maximal 60000 JSON-Zeichen vor Speicherung) und Originalseiten separat und bedarfsgerecht. Kein PDF-Download und keine Drive-Abfrage zur Laufzeit. Mobile Vergrößerung scrollt ausschließlich im Seitenbereich.
- Suchergebnisse enthalten Edition, Werk, Kapitel/Teil und native Zeichen- beziehungsweise PDF-Seitenfundstelle. OCR-Treffer sind ausdrücklich markiert. Keine KI-Suche und keine generierten Regelantworten.

## Schutz und Bereitstellungsrechte

Ein ungeklärtes Werk kann nur im ausdrücklich isolierten lokalen Testmodus von aktiver Kampagnen-SL technisch geprüft werden. Dafür sind **beide** Bedingungen notwendig: bestehende serverseitige Test-Bindung `AUTH_ACCESS_ENVIRONMENT=local-test` und Loopback-Request. URL-Parameter oder gefälschte SL-Flags reichen nicht. In Produktion bleibt dieser Prüfweg gesperrt.

Spieler erhalten ausschließlich ausdrücklich freigegebene eigene Inhalte. Kapitel, Seitenbilder und Suchausschnitte ungeklärter Verlagswerke bleiben serverseitig gesperrt. Die Spieleransicht kann deren Bibliotheksmetadaten zeigen, keine vollständigen Inhalte. Keine automatische Inhaltsfreigabe für Hausregeln mit SL-Beispielen.

Die Aussage „nicht öffentlich zugänglich“ allein dokumentiert keine Lizenz zur vollständigen Online-Bereitstellung. Die Verlags-/abgeleiteten Werke bleiben `pending`, bis der erlaubte Umfang nachvollziehbar geklärt ist. Der lokale technische Test vergibt keine Nutzungsrechte.

Originale erhalten keinen `files`-Eintrag und keine öffentliche Originalroute. Die Seitenbild-API prüft dieselben Buch-, Kampagnen-, Rollen-, Rechte- und Kapitelgrenzen wie der Reader und streamt nur die berechtigte einzelne Seite aus R2. Keine Bildoptimierung über einen öffentlichen Proxy. Alle Antworten sind `private, no-store`; Entzug wirkt beim nächsten Request. Die generische Content-Block-API kann den Schutz nicht umgehen.

Ein späterer Produktivbetrieb setzt separat geprüfte private R2-Konfiguration voraus. Diese wurde nicht geändert oder als live abgenommen behauptet. Anzeigen kann Kopieren/Abfotografieren nicht absolut verhindern.

## Reproduzierbare lokale Vorbereitung

1. Originale nach Metadatenprüfung über Drive-Connector herunterladen; native Docs vollständig über `get_document` lesen. Keine Originaltexte oder Auth-URLs versionieren. Private Ablage: `.local-work/codex-all/sources/<sourceId>.pdf|json`; native PDF-Exporte: `<sourceId>-facsimile.pdf`.
2. Offline `scripts/codex-pdf.py --sources .local-work/codex-all/sources --output .local-work/codex-all/prepared` mit Python/PyMuPDF 1.28.2 ausführen.
3. Optional `scripts/codex-ocr.py --root .local-work/codex-all`, mit lokalem Tesseract-Sprachbestand `eng/deu` in `tessdata`. Keine externen OCR-Dienste; Ergebnis ausdrücklich ungeprüft.
4. `node scripts/run-framework.mjs build`.
5. `node scripts/test-local.mjs --codex-all`: alle journalisierten Migrationen auf **frischem** Test-D1, synthetische Demo-Konten, anschließend validierter Import. Ziel ausschließlich `127.0.0.1:8804`.
6. `node scripts/codex-all-acceptance.mjs`: alle Kapitel gegen vorbereitete Quellen, Bildhashes, Suche jedes Werks, Rollen-/Originalschutz und Laufzeiten.

Import prüft sämtliche Originalidentitäten, PDF-Größen, SHA-256, Seitenbestand, Text-/Bildhashes und doppelte Buch-IDs vor dem ersten D1-Schreibvorgang. Bereits bestehende Bücher werden nicht überschrieben. Bounded Batches und `readerReady=false` bis zum jeweiligen vollständigen Buchabschluss verhindern Leserzugriff auf abgebrochene Buchimporte. Abschließend werden Fremdschlüssel und Erhalt bestehender fachfremder Tabellen/Entities geprüft.

PyMuPDF ist ausschließlich ein externer Offline-Verarbeitungsschritt, keine Worker-/Browser-Abhängigkeit. Die AGPL-/kommerzielle Lizenz des Werkzeugs ist bei späterer Verteilung oder einem neuen Verarbeitungsdienst separat zu beachten. Sprachmodelle für OCR sind kein Nachweis der Textrichtigkeit. Große Quellarchive/Originalbilder werden nicht in den Client-Build aufgenommen.

## Noch separat zu beurteilen

- Vollständige manuelle OCR-/Lesereihenfolgenprüfung; insbesondere illustrierte V5-Vorspannseiten und grafische Deckblätter.
- Der einseitige Charakterbogen braucht kein künstliches semantisches Kapitelverzeichnis; die zusätzliche 3-seitige Originalansicht des V20-SL-Google-Docs besitzt keine eigene Kapitelgliederung. Die übrigen PDF-Buchquellen navigieren über eingebettete oder gedruckte Inhaltsverzeichnisse.
- Vier bislang ungeklärte Editionsmetadaten werden nicht stillschweigend geraten. Dubletten dürfen nicht automatisch zusammengeführt werden; die zehn PDF-Dateihashes sind verschieden.
- Bereitstellungsrechte für Verlagswerke und abgeleitete Zusammenfassungen; ein Login allein ersetzt keine Klärung.
- Lokal gemessene API-Zeiten sind keine Produktions-SLA oder Browser-LCP auf langsamen Mobilnetzen.

Abnahme und Messwerte stehen im aktuellen lokalen Abnahmebericht; kein Push, Commit oder produktiver Import wurde beauftragt.
