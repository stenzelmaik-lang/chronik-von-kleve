# Command Center 2.0 – Phase 1, lokale Abnahme

## Ausgangspunkt und Fehler
Arbeitskopie: release-2026-10-02. Basis d140a93c5fef9c24aa37093e953462727f58d355, gleicher Quellbaum wie der letzte Release-Merge f3e9091557d257bf2709b3740af6ffe2bda713cd. Lokaler Branch codex/command-center-phase1.

Die normale Charakterliste verwendete dieselben SL-Leserechte wie die Kampagneninspektion. Außerdem lagen Vorbereitungseditoren und Live-Regie in derselben Sitzungskomponente. Damit waren persönliche Charakterauswahl, administrative Inspektion und Erzählbetrieb schwer unterscheidbar.

## Drei Nutzungskontexte
- /spielbereich: persönlicher Spielerbereich. Charakterliste, Detail, Dashboardauswahl und Inventar sind auf eigene Charaktere begrenzt. Ein fremder Charakterparameter verleiht keine Rechte. Persönliche Charakterprojektionen enthalten keine SL-Projektion.
- /spielbereich?bereich=sitzung: bestehende SL-Live-Sitzung; für Spieler weiterhin deren sichere Sitzungsansicht. Story- und Szenenvorbereitung werden lesbar angezeigt. Umfangreiche Vorbereitung erfolgt über den ausdrücklich verlinkten Workspace.
- /sl/command-center: serverseitig geschützter Vorbereitungsbereich mit kompakter Kopfzeile, unabhängiger Werkzeugnavigation und großer Arbeitsfläche. Kampagnen-SL/Owner dürfen die bestehenden Werkzeuge benutzen. Kampagneneditoren erhalten die vorhandene Ortsredaktion; keine Charakterinspektion. Plattformrechte allein ersetzen keine Kampagnenrolle.

Fremde Bögen erscheinen nur mit Kennzeichnung SL-Inspektion. API view=sl wird serverseitig geprüft; ein Spieler kann diesen Parameter nicht zur Rechteausweitung benutzen. Cache und Auswahlzustand unterscheiden die beiden Oberflächen. Ownership und Schreibberechtigungen werden nicht verändert.

## Wiederverwendung und Ortsdaten
Workspace, CharacterDetail, CommandWorkspace, CommandStory, StorySceneManager und LocationCMS werden wiederverwendet. Keine zweite Charakter-, Story- oder Ortsdatenbank. CommandPlace lädt den bestehenden Location-Hub und das Dossier über stabile IDs. Szenenreferenzen zeigen auf vorhandene Entity-Identitäten; sie kopieren keine Ortsakte. In den geprüften Command-Center-/Szenenmodulen wurde keine Kaserne-Sonderimplementierung gefunden. Electric Taberna und gespeicherte synthetische lokale Sitzungen bleiben erhalten.

## Implementiert
- Dedizierte Workspace-Route und Shell, persönlicher Bereich getrennt.
- Serverseitige persönliche Charakter-/Inventarauswahl und ausdrücklich berechtigte SL-Inspektion.
- Vorbereitungseditoren vom Live-Lesemodus getrennt; bestehende APIs, Verlauf und Freigaben erhalten.
- Bestehende Ortsredaktion im neuen Workspace, ursprünglicher CMS-Einstieg weitergeleitet.
- Werkzeuge Story/Szenen, Spieler/Charaktere und Orte funktionieren mit vorhandenen Modulen. Sitzung verweist gezielt auf den Live-Bereich.

## Nicht implementiert
Neue eigenständige Personen-, Medien- und Rätselmodule sind ausdrücklich als geplant gekennzeichnet. Kein neues Storymodell, Editor, Publikationssystem, Regelmodell oder Popout-System. Bestehende Fenster-/Layoutfunktion wurde nicht neu entwickelt und ist keine neue Mehrmonitor-Abnahme.

## Prüfungen
Automatisierte Fachtests, Integration, Rechte-/Privacy-/Concurrency-/Recovery-Regression sowie additive Migrations-/Rollbackproben laufen ausschließlich lokal isoliert. Produktionsressourcen wurden nicht verwendet. Genaue abschließende Ergebnisse und Browserbelege folgen im Prüfabschluss unten.

## Technische Schulden und nächste Phase
- CommandWorkspace und SceneEditor enthalten weiterhin umfangreiche bestehende Komponenten. Künftig Lebenszyklusaktionen und Vorbereitungseditor schrittweise trennen, ohne Datenmodell zu duplizieren.
- Die zentrale Referenzabfrage besitzt ein bestehendes Limit von 500; für größere Kampagnen wäre Pagination erforderlich.
- Legacy-PLACE-Identitäten ohne aktuellen location_nodes-Eintrag benötigen vor einer Übernahme einen gesonderten Abgleich. Keine automatische Datenmigration in Phase 1.
- Für spontane Orte zunächst bestehende Identität und ausdrücklich private, unbestätigte Ortsakte vorsehen; kanonische Übernahme bewusst bestätigen. Noch nicht implementiert.
- Empfehlung Phase 2 nach persönlicher Abnahme: kontextbezogene Verknüpfungen und schnellere Szenen-/Ortsnavigation; keine neuen Großmodule gleichzeitig beginnen.

Kein Push, Merge, Deployment und keine produktive Migration. Lokale Umsetzung ist zur persönlichen Abnahme vorbereitet, nicht live veröffentlicht.

## Prüfabschluss 03.10.2026
- Typecheck: bestanden, vollständiger Lauf ohne inkrementellen Cache.
- Lint: bestanden, keine Fehler und keine Warnungen.
- Build: bestanden. Bekannte Warnung für Client-Chunks über 500 kB bleibt; kein Buildfehler.
- Fach-/Regressionstests: 126 bestanden, 0 fehlgeschlagen.
- Vollständige Integration: 955 Prüfungen bestanden. Acht explizite Workspace-Sicherheitsprüfungen umfassen fremde persönliche Charakter-ID, Dashboard/Inventar, gefälschtes view=sl und direkten Spieleraufruf der Workspace-Route.
- Rollenfundament/Test-D1: 46 Checks; deterministischer Backfill und physischer Rollback ausschließlich isoliert. Atomarer Batch-Rollback zusätzlich bestanden. Keine Produktionsmigration ausgeführt.
- Browser: angemeldete synthetische SL und separat angemeldeter Spieler A tatsächlich geprüft. Spieler A sieht nur seine zwei eigenen Figuren, keinen SL-Einstieg; direkter /sl/command-center-Aufruf zeigt ausschließlich die Sperrseite. SL-Inspektion zeigt fremde Bögen gekennzeichnet. Persönlicher SL-Bereich zeigt ausschließlich eigenen Charakter; fremde URL-ID wird nicht übernommen.
- Live-Sitzung: ursprüngliche synthetische Sitzung, Storytexte, Szenenläufe, angehefteter Charakter und dokumentierte Ereignisse vorhanden. Story/Szenen im Live-Modus lesbar, Bearbeiten gesperrt. Ortsverknüpfung öffnet Electric Taberna aus dem zentralen Hub, Dossierlink verwendet place.electric-taberna. Ortsredaktion lädt dieselbe vorhandene Hierarchie.
- Browserkonsole während des geprüften Ablaufs: keine erfassten Warnungen oder Fehler.
- Laptop 1366×768 und Desktop 1920×1080: Workspace erreichbar, kein horizontaler Dokumentüberlauf. Kein neuer Mobilauftrag und keine Mehrmonitor-Abnahme behauptet.

Browsernachweise liegen daneben: workspace.png, sl-inspektion.png, ortsredaktion.png, persoenlicher-charakter.png, live-sitzung.png, spieler-a.png, spieler-sl-zugriff-gesperrt.png, laptop-1366.png, desktop-1920.png.

## Persönliche Abnahme
Laufende lokale Adresse: http://127.0.0.1:8798/sl/command-center . Im geöffneten Browser ist die synthetische Demo-Spielleitung angemeldet. Keine echten Kampagnenkonten und keine Produktionsdaten. Der Server verwendet den vorhandenen isolierten lokalen Demo-Bestand, ohne ihn neu zu initialisieren. Bei Neustart im genannten Repository mit dessen Node-Laufzeit scripts/test-local.mjs --command-center-2 ausführen; gespeicherte Demo-Daten bleiben erhalten.

Status: IMPLEMENTIERT UND LOKAL GEPRÜFT, persönliche Abnahme offen. NICHT veröffentlicht. Nach diesem Bericht keine Phase 2 begonnen.
