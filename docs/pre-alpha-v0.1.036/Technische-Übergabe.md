# Chronik von Kleve – Pre-Alpha v0.1.036
## Technische Übergabe: dynamisches Orts- und Geodatensystem

### IMPLEMENTIERT

Electric Taberna bleibt Referenzort mit der stabilen ID `place.electric-taberna`. Die aktive Spielwelt liest nun generische persistierte Ortswurzeln statt einer fest eingebauten Electric-Taberna-Antwort.

- `GET /api/locations` liefert ohne `place` den sicheren Orts-Hub; mit einer stabilen `place`-ID liefert es die berechtigte Detailprojektion.
- Der Hub lädt Ortsknoten, Aktionen und Wissensfreigaben in begrenzten Batches. Es gibt keine Einzelabfrage pro Ort, keine öffentlich zurückgegebene Gesamtzahl unbekannter Orte und keine Abhängigkeit der Laufzeitprojektion von der Electric-Taberna-Fixture.
- Ortskacheln, Suche, Vorschau und Marker leiten sich im Client aus derselben freigegebenen Ortsmenge ab. Player-Kacheln, Suchtreffer, Marker und DOM enthalten weder `hidden`- noch `rumored`-Orte. Der Server entfernt weiterhin `GM_SECRET`-Knoten und deren Nachfahren.
- Ortsseiten verwenden dieselbe stabile ID wie Hub und Marker. Der bestehende Cinematic Hero, bekannte Bereiche, Hinweise, Bilder, persönliche Notizen und Overlays bleiben im bisherigen Spielwelt-Design. Leere oder nicht freigegebene Sektionen werden nicht ergänzt.
- Ortsnotizen speichern `locationId` und `targetId` der geöffneten stabilen Orts-ID. Der Server prüft beide Verweise gegen die Berechtigung des Schreibers.
- Aktions- und World-State-Endpunkte nehmen generische Orts-IDs an, bleiben SL-geschützt und behalten die bestehenden Revisions- und Discovery-Regeln.
- MapLibre/OpenFreeMap bleibt die Kartenengine. Marker werden aus den pro Ort projizierten Geodaten erstellt; Auswahl, Fokus, Suche und Ortsseite bleiben über die stabile ID gekoppelt.
- Die inaktive alte Electric-Taberna-Ortsseite und der inaktive Prototyp mit der Testposition wurden entfernt. Die Electric-Taberna-Fixture und ihr einmaliger Migrationsendpunkt bleiben nur als bestehende Referenz-/Migrationsquelle erhalten.

### GEODATEN UND MIGRATION GATE

**Keine Datenbankschemaänderung und keine Migration erforderlich.** Die bestehende Tabelle `location_nodes` enthält bereits `attributes TEXT NOT NULL DEFAULT '{}'`; das Geodatenobjekt wird dort als JSON-Erweiterung im Ortswurzelknoten gespeichert.

Unterstützt werden `unknown`, `exact` und `approximate`. Eine bekannte Position benötigt eine erlaubte Sichtbarkeit (`public`, `group`, `player` oder `gm`), ein Koordinatenpaar in der Reihenfolge `[Längengrad, Breitengrad]` sowie eine Herkunft (`source`, `reviewedAt`, optional `reference`). Für `approximate` ist zusätzlich eine begrenzte positive `accuracyMeters`-Angabe erforderlich. Ungültige, zusätzliche oder unvollständige Felder sowie Werte außerhalb von Längengrad -180…180 und Breitengrad -90…90 werden als `unknown` projiziert und erzeugen keinen Marker.

Spieler erhalten Koordinaten nur, wenn der Ort mindestens `known` ist und die öffentliche, Gruppen- oder passende persönliche Freigabe vorliegt. Persönliche Freigaben gelten nicht für Gruppen- oder andere Spielersichten. `gm`-Positionen und gespeicherte Quellenreferenzen werden nie an Player projiziert. Bei einer ungefähren Position müssen die gespeicherten Koordinaten selbst bereits der bewusst vergröberte Punkt sein; geheime exakte Koordinaten dürfen nicht im selben Player-Datensatz stehen.

Electric Taberna besitzt in der bestehenden Fixture keine bestätigte Geoposition. Die frühere Testposition wurde weder als kanonisch übernommen noch in die Migrationsdaten geschrieben. Der Ort erhält daher seine Kachel und Detailseite, aber keinen erfundenen Kartenmarker. Es wurden keine Adressen oder Lore ergänzt.

### TEILWEISE IMPLEMENTIERT

Der Lese- und Projektionspfad unterstützt beliebig viele persistierte Ortswurzeln. Ein allgemeiner SL-Autorisierungsbildschirm oder API-Endpunkt zum Anlegen vollständiger `location_nodes`-Bäume und zum Erfassen/Prüfen ihrer Geodaten ist noch nicht vorhanden und wurde in diesem Auftrag nicht ergänzt. Der zweite Ort wurde ausschließlich in einer isolierten lokalen Test-Datenbank angelegt, um die generische Anzeige ohne React- oder API-Sonderfall nachzuweisen.

Die lokale Browserumgebung konnte das externe OpenFreeMap-Karten-Style nicht laden. Die Aufnahmen zeigen deshalb die vorhandene schematische Fallback-Karte und nicht Live-OSM-Kacheln. Der Fallback hält Hub und Ortskacheln benutzbar; Live-Kartenkacheln sind in dieser Umgebung nicht visuell bestätigt.

### NICHT IMPLEMENTIERT

Keine zusätzlichen kanonischen Orte, Geodaten, Adressen, Lore, Gameplay-Systeme, Importer, Geocoder, Orts-CMS oder weiteren Weltmodule. Es gab keine Änderung an Character, Inventory, Recovery, Authentifizierung oder Kampagnenmodell.

### ARCHITEKTUR UND DATENFLUSS

1. Die Locations-API authentifiziert die Person und validiert Ansicht, Ziel und optionale Orts-ID.
2. Der Hub liest Ortswurzeln aus `location_nodes` und lädt ihre Knoten, Aktionen und gültigen Wissensfreigaben batchweise.
3. `server/location-repository.ts` baut die Domain-Projektion auf, wendet bestehende Discovery- und `GM_SECRET`-Grenzen an und nutzt die vorhandenen Player-/SL-Projektoren.
4. `server/location-geography.ts` validiert gespeicherte Geodaten strikt und gibt Koordinaten erst nach Discovery- und ACL-Prüfung frei.
5. `visibleWorldPlaces` ist die gemeinsame Client-Menge für Player-Kacheln, Suche, Vorschau und Marker. Detailabrufe und Notizen beziehen sich auf dieselbe stabile Orts-ID.

`app/spielbereich/modules/location-dossier.tsx` war eine ungenutzte Electric-Taberna-spezifische Ansicht; Workspace und Routen importierten sie nicht. Die aktive Ansicht ist `WorldExperience`. `server/location-map-prototype.ts` war ein ungenutzter Testmarkerpfad. Die verbleibende Electric-Taberna-spezifische Fixture dient ausschließlich der erhaltenen Referenz und einmaligen Migration.

### GEÄNDERTE DATEIEN

- `app/api/locations/actions/route.ts` – generische stabile IDs, bestehende SL-Berechtigung.
- `app/api/locations/route.ts` – Hub, generische Detailabfrage und geschützte Markerprojektion.
- `app/api/locations/state/route.ts` – generische IDs bei bestehenden serverseitigen State-/Discovery-Regeln.
- `app/spielbereich/modules/world-experience.tsx` – gemeinsame sichere Menge für Kacheln, Suche, Vorschau und Marker; generische Detailnavigation.
- `app/spielbereich/modules/world-experience.module.css` – responsive Karten-/Kachel-Anpassungen und Statusabstand im Fallback.
- `app/spielbereich/modules/world-map-contract.ts` – generische Orts- und Markerverträge.
- `app/spielbereich/modules/world-maplibre.tsx` – Marker je stabiler Orts-ID; MapLibre und Startausschnitt erhalten.
- `app/spielbereich/modules/location-dossier.tsx` – ungenutzte Electric-Taberna-Ansicht entfernt.
- `domain/location-model.ts` – generische öffentliche Zielschlüssel und Projection-Text; Referenz-Fixture bleibt erhalten.
- `domain/location-types.ts` – Typen für genaue, ungefähre und unbekannte Positionen.
- `server/location-geography.ts` – strikte Geodatenvalidierung und ACL-Projektion.
- `server/location-map-prototype.ts` – inaktiver Electric-Taberna-Testmarker entfernt.
- `server/location-repository.ts` – batchweiser generischer Orts-Hub, sichere Projektion und ortsgebundene Notizprüfung.
- `scripts/capture-location-screenshots.mjs` – isolierte synthetische Testdaten und Desktop-/Mobilprüfung.
- `scripts/test-local.mjs` – optionale Screenshot-Prüfung nach den lokalen Integrationen.
- `tests/integration.mjs` – synthetischer zweiter Ort, abweichende Kachel/Detail/Marker/Notiz und Zugriffssperren.
- `tests/world-map.test.mjs` – Geodaten, Herkunft, ACL, Sichtbarkeit, gemeinsame Ortsmenge und Marker.
- `tsconfig.json` – ignorierte Browser-Testprofile im Ordner `work/` aus der TypeScript-Eingabemenge ausschließen.
- `docs/pre-alpha-v0.1.036/Technische-Übergabe.md` und `docs/pre-alpha-v0.1.036/screenshots/` – Handover und visuelle Nachweise.

### PRODUKTION, MIGRATION UND RECOVERY

- **Migration:** keine erstellt und keine ausgeführt.
- **Produktive D1-/R2-Schreibvorgänge:** keine. Integration und Browseraufnahmen nutzten ausschließlich eine neue isolierte lokale D1-Testdatenbank.
- **Electric Taberna:** keine Migration, kein Rollback und keine produktive Änderung durch diesen Auftrag.
- **Synthetischer Ort/Testposition:** ausschließlich temporäre lokale QA-Daten, nicht in Produktion importiert.
- **Recovery:** keine Daten, Quellen, Claims, Entities oder Imports geändert; die bestehende Recovery-Suite lief nur als Regression.
- **Kanon/Lore:** nichts hinzugefügt.

### TESTERGEBNISSE

| Prüfung | Ergebnis |
|---|---|
| Foundation-, Recovery-, Location-, Cache- und Map-Fachtests | 23 bestanden, 0 fehlgeschlagen |
| Isolierte Integrationssuite | 308 bestanden; alle Schreibvorgänge nur in lokaler Test-D1 |
| Typecheck | bestanden (`tsc --noEmit --incremental false`) |
| Lint | bestanden, keine Warnungen |
| Produktionsbuild | bestanden; vorhandene Chunk-Warnung über 500 kB bleibt bestehen |
| Desktop | Screenshot 1440 × 1100, kein horizontaler Überlauf, keine verborgenen Inhalte im Player-DOM |
| Mobil | Screenshot 390 × 900, kein horizontaler Überlauf, keine verborgenen Inhalte im Player-DOM |
| Ortsdetail | Electric Taberna und synthetischer zweiter Ort über generische ID aufgenommen |
| Externer Kartenstil | OpenFreeMap im lokalen Browser nicht geladen; Live-Kacheln daher nicht als visuell bestätigt ausgewiesen |
| Migration/Produktivimport | nicht durchgeführt |

Aufnahmen: `screenshots/world-hub-desktop.png`, `screenshots/world-hub-mobile.png`, `screenshots/electric-taberna-player.png` und `screenshots/synthetic-place-player.png`. Die Testdaten sind ausdrücklich synthetisch; ein unfreigegebener Ort, Geheimraum, geheime Koordinate oder eine Anzahl unbekannter Orte wurde bei den Player-Aufnahmen nicht gefunden.

### PROBLEME / RISIKEN

- Die Verfügbarkeit des externen OpenFreeMap-Styles ist nicht durch die lokale Testumgebung garantiert; bei Ausfall greift die schematische Darstellung.
- Ein allgemeiner SL-Erstellungs-/Bearbeitungsweg für neue Ortsbäume samt Prüfung und Pflege von Geodaten bleibt ein offener Folgepunkt. v0.1.036 enthält ausschließlich die generische Player-Lese- und Projektionsarchitektur.
- Der Build erzeugt eine Chunk-Warnung über 500 kB, läuft aber erfolgreich durch. Kein Bundling-Umbau in diesem Auftrag.
- Keine NSCs, Händler, Archiv-, Chronikbuch-, Regelwerk- oder sonstigen Weltmodule begonnen.

### RELEASE-IDENTIFIKATOREN

Der exakte Commit wird vor Erstellung des Source-ZIP festgeschrieben. Sites vergibt Versions- und Deployment-IDs erst nach dem Speichern und Veröffentlichen dieses Commits. Commit, Version und terminaler Deploymentstatus sind deshalb im Release-Handover-Sidecar nach Veröffentlichung festgehalten.
