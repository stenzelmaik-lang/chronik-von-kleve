# Geänderte Dateien – Phase C

## Anwendung und Berechtigungen

- `app/api/cms/drafts/route.ts` – Drafts lesen/anlegen/speichern mit strikter Validierung.
- `app/api/cms/locations/route.ts` – bestehende Orte und Teilknoten auswählen; Geheimnisse redigieren.
- `app/api/cms/media/route.ts` – private R2-Medien hochladen und zielgebunden ausliefern.
- `app/api/cms/preview/route.ts` – Zielgruppen-Vorschau über die sichere Player-Projektion.
- `app/api/cms/releases/route.ts` – Freigabestand und gezielte Veröffentlichungsübergänge.
- `app/api/cms/transitions/route.ts` – Draft einreichen, genehmigen oder ablehnen.
- `app/api/files/route.ts` – Referenzschutz für Editorial-Dateien im bestehenden Löschpfad.
- `app/spielbereich/modules/location-cms.tsx` – benutzbarer Electric-Taberna-Ortseditor und Geodaten-/Medienfluss.
- `app/spielbereich/modules/navigation.ts` – konditioneller Navigationspunkt für kampagnenberechtigte CMS-Rollen.
- `app/spielbereich/modules/shell.tsx` – CMS-Rollen in der bestehenden Shell verdrahten.
- `app/spielbereich/modules/use-navigation.ts` – bestehende Navigationslogik unterstützt den CMS-Pfad.
- `app/spielbereich/workspace.tsx` – bindet Orts-CMS in den bestehenden Arbeitsbereich ein.

## Modell, Migration und Dienste

- `db/schema.ts` – Drizzle-Abbildung für vier Revision-/Release-Tabellen und Datei-FK.
- `domain/location-cms.ts` – strikte Zod-Payload-, Zielgruppen- und Geodaten-Schemas.
- `domain/location-types.ts` – optionaler Geodaten-Referenzwert.
- `drizzle/0005_phase_c_editorial_revisions.sql` – additive Migration 0005 und Workflow-Trigger.
- `drizzle/meta/0005_snapshot.json`, `drizzle/meta/_journal.json` – synchronisierte Migration-Metadaten.
- `server/location-cms-service.ts` – Rollen-, Draft-, Review-, Release-, CAS- und D1-Batch-Fachlogik.
- `server/location-revision-projector.ts` – gemeinsamer sicherer Release-/Preview-Projektor.
- `server/location-repository.ts` – verbindet Detail und World Hub mit derselben Projektion.

## Tests

- `scripts/test-local.mjs` – frische lokale Test-D1/Test-R2-Umgebung, Migration 0005, atomare Batchprobe und separate Rolle-/Backfill-Test-D1.
- `tests/integration.mjs` – CMS-, Player-Projektions-, Media-ACL-, Release-/Concurrency- und Recovery-Regressionsfälle.
- `tests/role-foundation-local.mjs` – isolierter Phase-B-Rollen-/Backfill-/Rollbacktest kompatibel mit dem getrennten Phase-C-Testlauf.

## Handover

Die sieben Dateien in `docs/pre-alpha-v0.1.037/phase-c/` dokumentieren technischen Stand, Migration/Rollback, Rollen/Medien, Identitäts-Gate, Testergebnisse, Delta-Bundle-Inhalt und diese Dateiliste. Sie enthalten keine Secrets und keine produktiven Datensätze.

## Bewusst unverändert

- `vite.config.ts` und die Cloudflare D1-/R2-Bindings.
- `location_nodes`-Daten, Electric Taberna-ID und Produktionsinhalt.
- Migration 0004 im Quellstand und sämtliche produktiven Daten.
- Recovery-Daten und Recovery-Importzähler.
- Karten-QA-01 bis QA-04; kein Karten-Redesign.
- Authentifizierung, Registrierung und echte Plattformadministrator-Zuweisung.
