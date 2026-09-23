# Migrationsbericht

**IMPLEMENTIERT** – V12-Baseline unverändert in `data/location-migrations/electric-taberna-v12.json` abgelegt. Die produktive Übernahme wurde am 15.09.2026 von der GM-Identität ausgeführt.

Vor der Übernahme existierten keine `location_nodes` für `place.electric-taberna`. Nachher: 18 Knoten, 17 Hierarchiebeziehungen, 4 Actions und 8 initiale Gruppen-Discovery-Grants. Stable ID und Legacy-ID wurden nicht ersetzt. Bestehende Records, Dateien, Knowledge-Grants, Events und Recovery-Daten wurden nicht gelöscht.

Der zweite Aufruf meldete idempotent `already-migrated`. Ein produktiver Recovery-Import wurde nicht durchgeführt.

