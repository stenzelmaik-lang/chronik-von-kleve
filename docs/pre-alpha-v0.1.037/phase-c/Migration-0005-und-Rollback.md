# Migration 0005 – Testnachweis und Rollback

## Änderung

Die Migration `drizzle/0005_phase_c_editorial_revisions.sql` ergänzt:

- `entity_revisions`: unveränderliche Revisionsidentität und zielgebundene Draft-/Review-Daten mit Expected-Version und strict JSON-/Geodaten-Checks.
- `entity_revision_events`: append-only Ereignisse, Expected-/Result-Versionen sowie eindeutige Revision-Versionen.
- `entity_revision_media`: Datei-Referenzen zu Revision, Kampagne, Zielgruppe und Zweck.
- `entity_revision_releases`: append-only Publish-, Revoke- und Block-Ereignisse mit fortlaufender Zielversion.
- Trigger zum Erzwingen von Draft-Start, Entity-/Kampagnenbindung, Statusübergängen, Versionssprung, Review-Snapshot-Schutz, Event-/Release-Konsistenz, Medienbindung und Unveränderlichkeit historischer Referenzen.
- Einen eindeutigen Index auf `files(campaign_id,id)`, damit Medien-FKs kampagnengebunden bleiben.

Die bestehenden Tabellen `entities`, `location_nodes`, `files`, Character-/Inventory-Tabellen und Recovery-Daten werden durch SQL-DML nicht verändert. Migration 0004 wird nicht verändert.

## Prüfung

- Migrationen 0000–0005 erfolgreich auf einer neu erzeugten temporären lokalen Test-D1 angewendet.
- Phase-B-Rollenmigration 0004 und Backfill-/Rollback-Proben liefen zusätzlich auf einer separaten frischen Test-D1.
- Miniflare-Test-R2 ist `r2Persist:false`; kein Cloudflare-Produktions-Binding wurde angesprochen.
- `drizzle-kit check`: bestanden; Schema, Migration-Journal und Snapshot sind konsistent.
- D1-Batch-Rollback: eine gültige erste Schreibanweisung plus eine ungültige zweite Anweisung schlägt fehl; die erste Schreibanweisung ist danach nicht vorhanden.
- Migrations-Rollback-/Datenbewahrungsprobe erfolgte auf einer physischen Kopie der Test-D1; Legacy-Tabellen, Foreign Keys und bestehende Orts-/Recovery-Zeilen blieben erhalten.

## Produktiver Status

**Nicht ausgeführt.** Es gab keine produktive Migration, keinen produktiven Backfill und keine produktive Datenänderung.

## Rollback-Plan für eine spätere Freigabe

Vor einer späteren produktiven Migration zuerst Backup und Readiness-Preflight prüfen, dann Migration 0005 in einem genehmigten Wartungsfenster anwenden. Ein Rollback darf erst beginnen, wenn die neue App-Version keine Phase-C-Tabellen mehr liest und es keine benötigten Phase-C-Revisionen/Freigaben gibt. Dann die Phase-C-Trigger, Phase-C-Indizes, den Index `idx_files_campaign_id` und die vier Phase-C-Tabellen in Abhängigkeitsreihenfolge entfernen. Keine älteren Produktionszeilen aus `entities`, `location_nodes`, `files`, Characters, Inventory oder Recovery löschen oder verändern.

Ein automatisches Produktions-Down-Migrationsskript ist absichtlich nicht enthalten: es würde Phase-C-Drafts, Freigabehistorie und Medienreferenzen unwiederbringlich entfernen. Falls produktive Phase-C-Daten existieren, ist ein anwendungsspezifischer, geprüfter Export/Backup vor dem Zurücksetzen zwingend. Der hier dokumentierte Rollbackversuch beweist nur das Verhalten einer isolierten Testkopie.
