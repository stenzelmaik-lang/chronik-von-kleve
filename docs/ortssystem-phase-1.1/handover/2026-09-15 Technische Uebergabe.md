# Chronik von Kleve – Ortssystem Phase 1.1

Stand: 15.09.2026  
Commit: `298f31c7741a838fb33721662057b3ebc5163e21`  
Sites-Version: 14  
Deployment: `appgdep_6aa87770d6ec8191be6c0560b8ea3721`  
Live: https://chronik-von-kleve.panoram.chatgpt.site

## Status

**IMPLEMENTIERT** – Electric Taberna wird über `location_nodes`, `location_actions`, `entities`, `knowledge` und `world_events` geladen. Die dauerhafte ID `place.electric-taberna`, drei Bereiche und elf Räume bleiben erhalten.

**IMPLEMENTIERT** – GM- und Spielerprojektion sind serverseitig getrennt. GM sieht die vollständige Struktur. Spieler erhalten nur freigegebene Inhalte; geheime Raumtitel, Legacy-/Provenienzfelder und SL-Fraktionsdaten werden nicht ausgeliefert.

**IMPLEMENTIERT** – Discovery je Gruppe oder Spieler mit Revision und erwarteter Versionsnummer. World-State und Marker werden je Ortsknoten mit Revision gespeichert. Änderungen erzeugen append-only `world_events` mit vorherigem Zustand, neuem Zustand, Ziel und Grund.

**IMPLEMENTIERT** – Prepared Actions werden persistent in `location_actions` geführt. Auslösungen sind idempotent und werden als Ereignis protokolliert.

**IMPLEMENTIERT** – Ortsnotizen können stabile Location-/Area-/Room-Ziele referenzieren; der Server prüft die Sichtbarkeit des Ziels.

**TEILWEISE IMPLEMENTIERT** – Der einmalige GM-Übernahmepfad ist produktiv vorhanden und wurde ausgeführt. Vollständiges CMS-Authoring, Offline-Kopie, Backup-/Restore-UI, Rich Text und individuelle Spielerfreigabe-UI bleiben spätere Arbeiten.

**NICHT IMPLEMENTIERT** – Weitere Orte, Mehrkampagnen-UI, Sprint 3, Recovery-Import, neue Authentifizierung und Design-Redesign.

**PROBLEM / RISIKO** – Der Sites-Packager benötigt in dieser Windows-Umgebung `bash`/WSL. Der verifizierte Worker-Build wurde deshalb mit dem identischen vorbereiteten Build-Inhalt und `tar.exe` gepackt; Sites hat das Archiv akzeptiert und Version 14 erfolgreich veröffentlicht.

## Produktiver Datenstand

Die Migration wurde nach Veröffentlichung einmalig als angemeldete Spielleitung über `/api/locations/migrate` ausgelöst. Sie ist idempotent; ein erneuter Aufruf verändert nichts. Produktiv stehen 18 Ortsknoten (1 Ort, 3 Bereiche, 11 Räume, 3 Informationen), 4 Prepared Actions und die dazugehörigen Hierarchiebeziehungen bereit. Der bestehende Recovery-Stand bleibt unverändert bei 10/649 Quellen und 161/2005 Claims. Es wurde kein weiterer Recovery-Import durchgeführt.

## Daten- und Sicherheitsgrenzen

Die Struktur nutzt stabile Entity-IDs; Reihenfolge dient nur der Darstellung. `location_nodes` speichert Zustand, Marker, Sichtbarkeitsziel, Attribute und Revision. `knowledge` trennt epistemischen Zustand und `discovery_state`. `world_events` bewahrt den Verlauf. `records` bleibt Eigentümer der Notizen. Die API verweigert anonyme Zugriffe, SL-Anfragen durch Spieler, Spieleraktionen und nicht freigegebene Ortsziele.

