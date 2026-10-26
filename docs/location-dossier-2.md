# Ortsdossier 2.0

## Bedienung

Berechtigte Spielleiter wechseln im Ortsdossier zwischen **Spieleransicht** und **SL-Dossier**. Beide Modi verwenden denselben Hauptort und erhalten die ausgewählte Bereichsposition. In der Spieleransicht wird die tatsächliche serverseitige Spielerprojektion angefordert. Im SL-Dossier stehen ausschließlich interne Notizen, Quellen, private Bilder und die vorhandene Ortshierarchie.

Die Ortsverwaltung bietet für interne Notizen denselben visuellen Editor, HTML-Quelltext und die Vorschau wie für öffentliche Beschreibungen. **Kapitel hinzufügen** ergänzt auf ausdrückliche Aktion eine H2-Überschrift im bestehenden Notizfeld. Eine `Schnellübersicht` bleibt unmittelbar sichtbar; weitere H2-Kapitel werden einzeln aufklappbar. Bestehende Texte ohne H2 bleiben als ergänzende SL-Notizen vollständig lesbar. Es werden keine Angaben zu Personal, Zugängen oder Sicherheit erfunden.

Die sieben angebotenen Detailkapitel sind Architektur, Zugänge, Ausstattung, Personal, Sicherheit, verborgene Informationen und ergänzende Notizen. Sie sind Textgliederung, keine neuen Objekttypen. Räume, Bereiche und Erkenntnisse behalten ihre bestehenden IDs und Verknüpfungen.

Im Spieltisch öffnet **Ortswissen** eine lesende Seitenansicht. Sie startet nach Möglichkeit beim Ort der aktiven Szene. Hauptort sowie Bereich/Raum können ausgewählt werden; die Suche durchsucht interne Kapitel einschließlich der Räume dieses Hauptortes. Das Schließen per Schaltfläche oder Escape stellt den Fokus wieder her. Sitzung, Zeichenbrett, Eingaben und Spieltisch-URL bleiben bestehen.

## Datenerhalt und Zugriffsschutz

- Wiederverwendung von `location_nodes`, vorhandenen Revisionen und `gm_secret_json`; keine weitere Wissensdatenbank und keine Schemaänderung.
- Alttext wird beim Öffnen oder bloßen Fokuswechsel nicht umgeschrieben. Lange historische Texte werden nur für den Editor darstellbar aufbereitet und erst nach einer ausdrücklichen Änderung gespeichert. Das bestehende Inhaltslimit bleibt erhalten.
- HTML wird mit der vorhandenen typisierten Rich-Text-Pipeline bereinigt. Skripte, Ereignisattribute und nicht freigegebene Einbettungen werden nicht übernommen.
- Der neue `node`-Parameter von `/api/locations` ist serverseitig auf SL und die aktive Kampagne beschränkt. Spieler erhalten weder darüber noch über `view=sl` interne Daten. Private Medien bleiben geschützt.
- Das Spieltisch-Overlay verwendet dieselbe Ortsprojektion und hat keinen Schreibpfad. Es verändert keinen aktiven Sitzungsort.
- Keine Produktions-Testdaten, keine automatischen Inhaltsmigrationen und keine Änderung bestehender Bilder oder Freigaben.

## Verifikation

`tests/location-dossier.test.mjs` prüft Text-/HTML-Erhalt, Kapitel, Limits, Hierarchie, Suche und den Projektionsschutz. `tests/location-dossier-integration.mjs` ergänzt den bestehenden isolierten Integrationslauf um reale API-Schreib-/Leseabläufe, XSS-Bereinigung, Kampagnengrenzen, geschützte Medien und unveränderte Mitglieds-/Charakterdaten. Alle Migrationen des bestehenden Systems laufen dabei gegen lokale Testbestände.

Die lokale Browserreferenz ist Hauptbahnhof Kleve → Empfangshalle mit Dienstzimmer und einem weiteren gleichrangigen Bereich. Geprüft wurden öffentliche und interne Ansichten, Suche bis in den Raum, Kapitelsteuerung, HTML-Editor/Speichern, 140 Zeilen unveränderter Alttext, Tastatur/Fokus und 320/390/834 px sowie Desktop. Der synthetische Spieler erhielt keine SL-Inhalte. Physische Geräte und eine neue echte Spielerabnahme sind davon getrennt zu bewerten.

Für diese Umsetzung sind keine Migration, kein Import und keine zusätzlichen Dienste erforderlich.

## HTML- und Absatzkorrektur

Einige interne Texte enthielten innerhalb korrekt angelegter Kapitel HTML, das beim Einfügen als Klartext gespeichert worden war. Die SL-Lesedarstellung und der SL-Editor erkennen solche eindeutigen HTML-Fragmente nun mit einer gemeinsamen Kompatibilitätsfunktion und verarbeiten sie durch den vorhandenen sicheren Rich-Text-Parser. Bereits gespeicherte Werte werden beim Lesen nicht verändert. Erst eine ausdrückliche Bearbeitung speichert die aufbereitete Struktur im selben vertraulichen Feld. Normale Alttexte und unvollständige beziehungsweise nicht unterstützte Markierungen behalten ihre sichere Textdarstellung.

HTML-Einfügen im visuellen HTML-Editor nutzt ebenfalls den vorhandenen Sanitizer. Für die SL-Bearbeitung verwenden visueller Modus, Vorschau und Dossier dieselben Lesestile; Listen besitzen echte Aufzählungszeichen beziehungsweise Nummerierung. Browserzeilen aus Enter, leere Absätze und bewusste Zeilenumbrüche bleiben erhalten. Die visuelle HTML-Ausgabe fügt keine zusätzlichen Zwischenzeilen zwischen Blockelementen ein.

Die Regressionstests in `tests/location-dossier-html.test.mjs` decken zuvor wörtlich gespeicherte Tags, Quelltext, gefährliche Attribute, Absatz-/Zeilenwechsel und wiederholte Formatwechsel ab. Der API-Integrationstest prüft zusätzlich unveränderte Speicherung beim Lesen, ausdrückliches Speichern und erneutes Laden sowie die unveränderte Spielerprojektion. Spielerfreigaben und serverseitige SL-Berechtigungen werden durch diese Korrektur nicht verändert.
