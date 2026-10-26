# Ortsdossier – Erweiterung der bestehenden Wissensverwaltung

Ausgangspunkt: `855ec4cbafdee46e4ffef2d13c81a306b7ca04e1`, 26.10.2026. Verbindliche Referenz: Hauptbahnhof Kleve → Bahnhofsvorplatz / Empfangshalle. Entwicklung und Schreibtests verwenden isolierte Bestände.

## Abgleich vor der Umsetzung

| Anforderung | Bestand | Vorgehen |
| --- | --- | --- |
| Dauerhaftes Ortswissen getrennt von Handlungen | Vorhanden | Ortsmodelle, Entities und getrennte Szenenverwaltung erhalten; keine neue Spieltischintegration. |
| Hauptort → Bereich → Raum | Vorhanden / anpassen | Stabile IDs, Anlage und Bearbeitung behalten; Verschieben, Archiv/Papierkorb und aufklappbaren Baum ergänzen. |
| Unabhängige SL-Kapitel | Fehlt | Bestehende M1-Content-Blöcke verwenden, pro Kapitel eigener Editor, Version, Reihenfolge und Verlauf. |
| Umfangreiche HTML-Texte | Anpassbar | Vorhandenen sicheren Rich-Text-Parser/Editor erweitern, mindestens 20.000 Zeichen je Kapitel, keine gemeinsame 5.000-Zeichen-Grenze. |
| Tabellen / aufklappbare Textabschnitte | Teilweise vorhanden | Tabellenkopf, Bearbeitungswerkzeuge und sichere Details-Struktur ergänzen. |
| Spielerportfolio für Bereiche und Räume | Anpassbar | Bestehende Leseseite, Bilddarstellung und Hierarchie erweitern. |
| Mehrere Medien je Eintrag | Fehlt | Private Dateien wiederverwenden und über M1-Blöcke referenzieren; pro Medium Metadaten, Freigabe und Reihenfolge. |
| Dauerhafte Entdeckung | Vorhanden / anpassen | Knowledge und Revisionen erhalten; redaktionelle Veröffentlichung von Entdeckung trennen, Wissen bei Textänderung erhalten. |
| Einzelne Erkenntnisse | Anpassbar | Bestehenden Informationstyp auch Bereichen/Räumen zuordnen; HTML und Medien über dieselben Pfade. |
| SL-Steuerung / Status / Protokoll | Teilweise vorhanden | Vorhandene Release-Historie und explizite Bestätigungen um eindeutige Entdeckungssteuerung erweitern. |
| Spieler-/SL-Vorschau | Vorhanden | Tatsächliche Spielerprojektion weiterverwenden, Vorschau veröffentlicht nichts. |
| Navigation / Verbindungen / Suche | Anpassbar | Bestehendes Relationssystem verwenden; rollenabhängige Suche über den Ortsbestand. |
| Karten | Grundlagen vorhanden | Geografie, bekannte Marker und Dossiernavigation erhalten; unbekannte Orte bleiben verborgen. |
| Verlauf / Wiederherstellung / Export | Teilweise vorhanden | Bestehende Revisionen und World-Events verwenden; geschützten Orts-Export ergänzen. |
| Zugriffsschutz | Vorhanden / erweitern | Neue SL-Kapitel und private Medien in allen generischen und dedizierten Zugriffspfaden schützen. |

## Daten- und Kompatibilitätsregeln

Keine zweite Ortsdatenbank. `entities`, `location_nodes`, `knowledge`, bestehende Revisionen/Release-Historien, M1-Content-Blöcke, Dateien und World-Events bleiben die Quellen. Neue Kapitel und Medien erhalten reservierte Blockarten und bleiben in generischen Spielerabfragen gesperrt. Veröffentlichte Medien werden ausschließlich über einen eigenen serverseitig geprüften Pfad projiziert.

Die bisherige `gm_secret_json.text`-Notiz bleibt unverändert lesbar. Die Übernahme in unabhängig gespeicherte Kapitel ist eine ausdrückliche SL-Aktion mit Versionsschutz und Protokoll. Ein Übernahmemarker verhindert eine doppelte aktive Kapitelstruktur. Es gibt keine automatische Produktionsmigration und keinen Import realer Ortsdaten.

Archivieren und Entfernen sind nachvollziehbar und wiederherstellbar. Strukturänderungen behalten IDs, Texte, Dateien, Beziehungen und Entdeckungen; unerlaubte Eltern, Kampagnengrenzen und Konflikte werden serverseitig abgelehnt. Redaktionelle Bearbeitung darf vorhandenes Spielerwissen nicht zurücksetzen.

## Prüfgrenze

Alle Schreibabläufe werden lokal mit synthetischen Konten und Orten geprüft. Nachweise für Umsetzung, Limits, Zugriffsschutz und verbliebene Grenzen werden nach den Prüfungen ergänzt. Eine bereits bestehende Freigabe zum Veröffentlichen ersetzt keine technische Prüfung neuer Schreibpfade.

## Umgesetzte Datenpfade und Bedienung

- **Struktur:** Bestehende IDs und `location_nodes` bleiben erhalten. Hauptort → Bereich → Raum; Erkenntnisse dürfen zusätzlich an Bereichen/Räumen hängen. Der Baum ist aufklappbar und zeigt den aktuellen Gruppenstand. Umbenennen verändert den internen Baumnamen; veröffentlichte Revisionstitel ändern sich erst durch eine neue Veröffentlichung. Verschieben nimmt den Teilbaum mit, behält Wissen/Dateien/Revisionen und lehnt Zyklen, fremde Kampagnen, ungeeignete Eltern und veraltete Stände ab.
- **SL-Kapitel:** `location_sl_chapter` in den bestehenden M1-Blöcken, grundsätzlich `sl_secret`. Eigenständige ID, Titel, Position, aktiver/archivierter/entfernter Zustand und Versionsnummer. 25.000 sichtbare Zeichen je Kapitel; strukturelle Obergrenzen schützen den Parser. Schnellübersicht bleibt geöffnet. Die Liste enthält zunächst nur Metadaten und Übersicht; weitere Texte werden beim Öffnen nachgeladen. Suche berücksichtigt sichtbaren Text statt interner JSON-Schlüssel.
- **Alttexte:** Keine automatische Umstellung. „Vorhandenen Vermerk übernehmen“ legt aus den vorhandenen Kapiteln individuelle Blöcke an und protokolliert die Quellrevision. Der unveränderte Originalvermerk bleibt gespeichert. Ein Übernahmemarker verhindert doppelte aktive Kapitel. Ein veralteter Browser darf anschließend nicht den bisherigen Sammeltext überschreiben.
- **HTML:** Gemeinsamer typisierter Sanitizer/Renderer und bestehender visueller/Quelltext-/Vorschau-Editor. Kontrollierte Klassen, Überschriften, Listen, Absätze, Zitate, Hinweise, Trenner und Links bleiben erhalten. Tabellen mit Kopfzeile und Werkzeugen für Zeilen/Spalten; eingefügte Tabellen werden auf 30 Zeilen und 10 Spalten begrenzt. Verschachtelte aufklappbare Abschnitte sind auf vier Ebenen begrenzt. Öffentliche Hauptbeschreibungen/Bereichs-/Raum-/Erkenntnistexte unterstützen ebenfalls 25.000 Zeichen; die kurze Hauptort-Einleitung bleibt kompakt.
- **Medien:** `location_media` referenziert vorhandene private `files`-IDs. Bilder, PDF und DOCX bis 25 MB; Titel, Beschreibung, Typ, Position, Titelbild und einzelne Freigabe. Wiederverwendung kopiert keine Dateibytes. Ein Titelbild je Eintrag wird atomar gewählt und versioniert. SL-Grundrisse dürfen nicht für Spieler freigegeben werden. Archiv/Papierkorb entfernt die Zuordnung aus dem Reader, nicht die historischen Bytes.
- **Lesen:** Bildergalerie mit Tastatur-schließbarem Dialog, Zoom und nativer Verschiebung der vergrößerten Ansicht. PDF nutzt den vorhandenen seitenweisen PDF-Renderer. DOCX kann nach serverseitiger Prüfung als geschützte Datei in einem Textprogramm geöffnet werden; es gibt keinen neuen DOCX-Online-Editor. Bereichs- und Raumtexte sowie Erkenntnisse verwenden denselben sicheren HTML-Renderer. Öffentliche Navigationskennungen geben keine internen Bereichs-/Raum-/Legacy-IDs preis.
- **Freigabe und Entdeckung:** Neue redaktionelle Freigaben senden `grantDiscovery:false`. Bisherige API-Aufrufer behalten ihren kompatiblen Standard. Spielerwissen wird gesondert, zielgruppenbezogen und versioniert gespeichert. Normale Entdeckung steigt nur an. Eine administrative Korrektur verlangt eine explizite Bestätigung und einen Grund; sie wird protokolliert. Die Lesesicht prüft weiter Veröffentlichung, Zielgruppe, Sperren, Entdeckung und Lebenszyklus. Ein unbekannter Elternort darf nur als anonymisierter Navigationspfad erscheinen; eine ausdrückliche Sperre gilt weiterhin für seinen Teilbaum.
- **Vorschau:** Verwendet die tatsächliche serverseitige Gruppen-/Spielerprojektion. Personenbezogene Vorschau und ihre Medien sind an das gewählte aktive Spielmitglied gebunden. Öffnen einer Vorschau erzeugt keine Knowledge-Freigabe.
- **Verknüpfungen und Suche:** Vorhandene `relationships` für dauerhafte Orts-/NSC-Bezüge; keine Kopien und keine neue Beziehungsdatenbank. Ziele werden durch ihre tatsächliche Leserprojektion geprüft. Strukturrelationen werden nicht als frei löschbare redaktionelle Links angeboten. Suche innerhalb eines Ortes oder über den Bestand liefert nur erlaubte Fundstellen; SL-Suche berücksichtigt individuelle Kapitel sowie noch nicht übernommene Altvermerke.
- **Verlauf und Export:** Unveränderliche Snapshots in vorhandenen World-Events; frühere Kapitelversionen werden als neue Version wiederhergestellt. Frühere öffentliche Revisionen werden als unveröffentlichter neuer Entwurf wiederhergestellt. Archiv und Papierkorb sind wiederherstellbar; endgültige physische Löschung wird bewusst nicht angeboten. Geschützter JSON-Export enthält Struktur, Inhalte, Revisionen, Freigaben, Wissen, Beziehungen und Medienreferenzen. Er ersetzt kein Backup der privaten Dateibytes. Strukturänderungen sind pro Vorgang auf 250 Einträge begrenzt; bei größeren Bäumen sind kleinere Teilbäume zu bearbeiten.

## Schnittstellen und Schutzgrenzen

`/api/cms/location-content`, `location-files`, `location-structure`, `location-export`: aktive Kampagnen-SL/Owner; Schreibzugriffe mit Herkunftsprüfung und Versionsschutz. Reservierte Ortsblöcke lassen sich nicht durch die generische M1-Block-API umbenennen, löschen oder veröffentlichen.

`/api/locations/media`, `connections`, `search`: authentifiziert, kampagnenbezogen und über erlaubte Projektionen gefiltert. Medien verwenden private R2-Objekte, keine öffentlichen Objekt-URLs. Antworten sind `private, no-store`; Medien zusätzlich `nosniff`, Same-Origin und restriktive CSP. Bereichsfreigabe öffnet weder Geschwister noch unbekannte Räume oder interne Pläne.

Keine Schema-Migration nötig: Die Erweiterung nutzt ausschließlich bereits vorhandene Tabellen und fügt keine Objekttypen hinzu. Keine Produktionsmigration, keine Übernahme realer Ortsdaten und keine neue Spieltisch-/Szenen-/Würfelintegration.

## Nachweis und Abnahmegrenze

Ausgangspunkt ist der bereits veröffentlichte Stand `855ec4cbafdee46e4ffef2d13c81a306b7ca04e1`. Dieser Auftrag wurde lokal umgesetzt; daraus folgt kein neues Live-Deployment.

- Unit-/Schemaprüfungen: 273 bestanden.
- Vollständige isolierte Integration: 1.543 Prüfungen bestanden, darin 80 neue Ortsdossier-Prüfungen einschließlich individueller Spieler-Vorschau und geschützter persönlicher Medien. Zusätzlich 46 Rollen-/Migrationsprüfungen und atomarer D1-Batch-Rollback bestanden.
- TypeScript, ESLint, vollständiger Build und Diff-Prüfung bestanden. Integration verwendet sämtliche Migrationen aus dem vorhandenen Drizzle-Journal; keine neue Migration erforderlich.
- Browser: Lokale Anmeldung als synthetischer SL, Ortsbaum, Empfangshalle, SL-Auswahl und formatierte bestehende Kapitel geöffnet. Danach wurde die Browsersteuerung wegen nicht sicher zuordenbarer Browseradresse unter Windows beendet. Die vollständige visuelle, mobile und Tastatur-Abnahme ist deshalb **offen**. HTTP-Rollenprüfungen ersetzen diesen offenen Browsernachweis nicht.
- Reale Produktions-, Spieler-, Charakter- und Kampagnendaten wurden nicht verändert. Schreibprüfungen verwenden frische, isolierte lokale D1-/R2-Bestände und synthetische Konten/Objekte.

**Gesamtabnahme / Live-Freigabe: noch nicht erklärt.** Offene Browserprüfungen dürfen nicht als bestanden dokumentiert werden.
