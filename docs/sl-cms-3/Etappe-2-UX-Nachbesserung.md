# SL-CMS 3.0 – UX-Nachbesserung der geführten Vorbereitung

30.10.2026 · Branch `codex/sl-cms-3` · ausschließlich lokal.

## Verbindlicher Durchgang und Umsetzung

Der aktuelle persönliche Durchgang ersetzt die früher freigegebene direkte Szenenschrittauswahl. Die bisherige Hauptnavigation und Spielabendübersicht bleiben erhalten.

- **Grunddaten:** Titel und Kurzüberblick. Terminplanung findet im Kalender statt. Vorhandene Terminwerte werden weder geleert noch umgeschrieben. Favorit und Anheften sind als beschriftete, tastaturbedienbare Icons in Liste und Lesübersicht verfügbar, nicht als Fragen während der Anlage. Sie verwenden den bestehenden versionierten Schreibpfad.
- **Szenenführung:** acht Bereiche nacheinander, ohne Schalterleiste oben. Zurück, Weiter und Überspringen speichern vor dem Wechsel. Fokus und Scrollposition führen zum neuen Abschnitt. Direkte bestehende Schrittlinks bleiben wiederaufnehmbar.
- **Zentraler Schauplatz:** ausschließlich Hauptorte; Bereiche und Räume sind keine neu auswählbaren zentralen Schauplätze. Eine bestehende Unterort-Zuordnung bleibt als bisherige Zuordnung sichtbar und erhalten, bis die SL bewusst einen Hauptort auswählt. Unterorte und Räume können weiterhin als Materialverweis vorbereitet werden.
- **Texteditor:** kompakte Visuell-/HTML-/Vorschau-Bedienung, Info-Icon mit HTML-Erklärung und Beispiel, Fokusmodus, optionale weitere Formatierung. Keine offen stehende Linkeingabe oder Dateinamen-Auswahlliste im Vorbereitungstext. Andere Nutzer des gemeinsamen Editors behalten ihre bisherige Bedienung durch eine explizite Option nur für die Vorbereitung.
- **Bildgalerie:** vorhandene geschützte Bilder mit Miniaturen und Suche, bedienbar auch per Tastatur. Einfügen in visuellen Text oder HTML-Quelltext; für Bildmaterial dieselbe Galerie. Nur die vorhandenen Dateireferenzen und autorisierten Dateiendpunkte werden verwendet; kein Upload und keine neue Dateikopie.
- **Textumfang:** alle acht Szenentexte und Materialtexte erlauben 10.000 sichtbare Zeichen, auch serverseitig. HTML-Eingabegrenze 65.000 Zeichen. Das bestehende Speicher- und Sanitizing-Verfahren bleibt bestehen; ungültige Eingaben oder Versionskonflikte halten den Entwurf offen.
- **NPCs und Dialoge:** mehrere Original-NPCs auswählen, nach Namen suchen, vorhandenes Primär-/Ganzkörperbild anzeigen. Kein Ersatz durch das Sekundärbild, keine Kopie der NPC-Akte, keine neuen NPC-Pflichtfelder. Fehlende vorhandene Referenzen werden nicht still entfernt. Dialoge nutzen den gleichen HTML-Editor mit 10.000 Zeichen.
- **Interaktionen und Spielmaterial:** eigene verständliche Vorbereitung mit erklärter Typauswahl, Titel, Inhalt und optionaler Originalakte bzw. Datei. Handouts direkt anlegen; weitere vorhandene Typen gruppiert nach Zeigen/Übergeben, Entdecken/Handeln, Begegnungen/Regie und Verweisen. Bausteine lassen sich ordnen, bearbeiten und entfernen, ohne die referenzierten Akten oder Dateien zu löschen. Bestehende 15 Elementtypen und deren IDs bleiben erhalten. Kein zweites Materialmodell.
- **Geheimnisse und Visionen:** separate Schritte. Geheimnisse beschreiben SL-Hintergründe; Visionen bereiten spätere Spielerinformationen vor. Das neue optionale JSON-Feld `visions` liegt im selben privaten Szenendokument. Alte Dokumente ohne Feld lesen sich mit leerem Wert. Vorhandene Geheimnisse werden nicht aufgeteilt oder automatisch migriert. Visionen werden durch Speichern oder die normale Szenenveröffentlichung nicht automatisch ausgeliefert.
- **Folgen/Proben und SL-Notizen:** dieselbe überarbeitete Textbedienung, bestehende mögliche Abzweigungen erhalten. Die fachliche Überarbeitung der Proben bleibt ausdrücklich später; keine automatische Würfel- oder Folgenlogik.

Die bisherige unspezifische Rubrik „Zusätzliche Szenenelemente und Verknüpfungen“ ist ersetzt. Eine optionale übergreifende Storyzuordnung bleibt im Erzählungsschritt erklärt verfügbar. Bestehende Unter-Szenen können weiter angelegt werden.

## Schutz und Kompatibilität

Keine neue Tabelle und keine Migration. Kein Push, Merge oder Deployment; Spieltisch und produktive Daten unberührt. Der persistente persönliche Teststand wurde vor der Aktualisierung unter `.local-test/before-guide-ux-revision-20261030` gesichert. Browser-Schreibprüfungen verwenden nur die getrennte synthetische Instanz 8824.

Das größere Textlimit gilt auch für bereits bestehende Veröffentlichungs-Snapshots. Die Spielerprojektion wurde nicht erweitert: sie liefert weiterhin nur bewusst veröffentlichte Erzählung und freigegebene Referenzen; Geheimnisse, Visionen, Dialogentwürfe, Materialien und SL-Notizen bleiben privat. In Visionen eingebettete Dateien unterliegen derselben Kampagnen-/Dateiberechtigungsprüfung.

Bei einer späteren Veröffentlichung müssen Schema-Parser und Oberfläche zusammen veröffentlicht werden: ein alter strikter Parser kennt `visions` nicht und das alte Limit ist kleiner. Ein blindes Zurückschalten auf einen älteren Server nach neuen Inhalten ist deshalb nicht als kompatibles Rollback nachgewiesen. Es werden hier weder Inhalte gekürzt noch alte Werte umgeschrieben.

## Prüfnachweise

- Typecheck und ESLint der betroffenen Komponenten, Serverpfade, Domänen und Tests bestanden.
- 143 Unit-/Regressionstests bestanden.
- Produktionsbuild bestanden.
- 1.763 vollständige isolierte HTTP-Integrationsprüfungen sowie 46 Rollen-/Backfill-/Rollback-Prüfungen bestanden.
- Bestehender vollständiger SL-Browserablauf bestanden: Spielabend, Kaserne/Taberna, Reihenfolge, Rücknavigation, HTML, Vollbild, Speichern/Neuladen, Mobil, Spielerabweisung und Löschen/Abbrechen.
- Erweiterter geführter Browserablauf: Grunddaten ohne Termin/Organisation; acht sequenzielle Szenenschritte ohne Tabs; Hauptortfilter; Info-Hilfe; Galerie per Tastatur; zwei NPCs mit Primärbild; Handout und Bildbaustein speichern; Visionen/Geheimnisse getrennt; Favorit über Lesübersicht ohne Änderung der Notizen, des Termins oder Status; Neuladen; genau 10.000 Zeichen als HTML erfolgreich gespeichert, 10.001 Zeichen ohne Eingabeverlust abgewiesen; Versionskonflikt; gesperrter Spielerzugriff auf Vorbereitung und interne Bilddatei.
- Desktop 1920/1440 px, 390 px Mobil und CSS125 ohne horizontalen Überlauf geprüft. CSS125 ersetzt keinen nativen Browser-Zoomtest.

Die CI-Konfiguration umfasst die neuen Komponenten und denselben erweiterten Browserablauf. Ein entfernter CI-Lauf wird mangels Push nicht behauptet.

## Zur persönlichen Abnahme

Interaktive lokale Anwendung: `http://localhost:8822/sl/command-center?bereich=sitzung`.

Die ursprünglichen lokalen Spielabende, Szenen, IDs und Inhalte bleiben erhalten. Keine technische Prüfung ersetzt die persönliche UX-Abnahme. Danach Stopp; keine weitere Etappe begonnen.
