# Datenmodell und Migrationen

## Migration

**IMPLEMENTIERT** – `drizzle/0003_careful_leech.sql` fügt additiv `location_nodes` und `location_actions` hinzu und erweitert `knowledge` um `discovery_state` und `version`. Bestehende Tabellen und Recovery-Migrationen bleiben unverändert.

**IMPLEMENTIERT** – `data/location-migrations/electric-taberna-v12.json` bewahrt den akzeptierten Version-12-Musterstand als unveränderte Referenz. Der GM-Endpunkt `/api/locations/migrate` übernimmt ihn einmalig und idempotent, ohne GET-Seiteneffekte.

**IMPLEMENTIERT** – Vorhandene `world_events` für bereits ausgelöste Actions werden bei der Übernahme berücksichtigt. Stable IDs und Legacy-Provenienz bleiben getrennt.

**PROBLEM / RISIKO** – Die Übernahme ist bewusst ein geschützter Anwendungsschritt statt eines Seed-Datensatzes in der Schema-Migration. Dadurch bleiben Drizzle-Migrationen schema-only und die Baseline kann vor dem Schreiben geprüft werden.

## Architektur

`entities` liefert Identität und Kampagne. `location_nodes` ist die strukturierte Orts-Erweiterung für Ort, Bereich, Raum und Information. `relationships` bildet `location.contains` ab. `knowledge` speichert gruppen- und spielerbezogene Discovery. `location_actions` speichert Definition, Ziel und Status. `world_events` ist append-only. `records` bleibt für Notizen zuständig. `server/location-repository.ts` ist der einzige Lesepfad für persistierte Ortsprojektionen.

Offline-Synchronisation, Revisionsexport und Restore sind vorbereitet, aber nicht Teil dieses Sprints.

