# Geänderte Dateien

- `db/schema.ts` – persistente Ortsknoten, Actions, Discovery-Version.
- `drizzle/0003_careful_leech.sql`, `drizzle/meta/0003_snapshot.json`, `drizzle/meta/_journal.json` – additive Migration.
- `data/location-migrations/electric-taberna-v12.json` – unveränderte V12-Baseline.
- `server/location-repository.ts` – DB-Lesepfad, Projektion, Migrationsdaten und Ortsreferenzprüfung.
- `app/api/locations/route.ts` – persistierter generischer GET-Projektionspfad.
- `app/api/locations/migrate/route.ts` – GM-geschützter idempotenter Baseline-Transfer.
- `app/api/locations/state/route.ts` – revisionsgeschützte World-State-/Marker- und Discovery-Schreiboperation.
- `app/api/locations/actions/route.ts` – persistenter, idempotenter Action-Trigger.
- `app/api/records/route.ts` – serverseitige Ortszielprüfung für Notizen.
- `server/campaign-export.ts` – Export der Ortsdaten.
- `domain/location-model.ts` – Projektion akzeptiert persistiertes Modell; V12-Fixture bleibt nur Migrationsquelle.
- `app/spielbereich/modules/location-dossier.tsx` – GM-Übernahmeknopf und persistierter Datenpfad.
- `scripts/test-local.mjs`, `tests/integration.mjs`, `scripts/capture-location-screenshots.mjs` – Migration-/Persistenz-/Projektionstests.
- `docs/ortssystem-phase-1.1/` – Architektur- und Übergabedokumentation.

