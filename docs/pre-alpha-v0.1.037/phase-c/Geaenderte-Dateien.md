# Geänderte Dateien – lokaler Phase-C-Review-Kandidat

Der konsolidierte lokale Arbeitsstand liegt im E1-Checkout auf Branch `codex/phase-c-etappe-1-ortverwaltung`, Git-HEAD `c822c0d7a079807a7123dc3d9bddd099b1cdb77c`. Der Arbeitsbaum enthält Phase-C-Änderungen und den unten ergänzten Auth-2.0-Delta; es wurde kein Commit, Push, PR-Update oder Deployment ausgeführt. Die Liste unten dokumentiert die Phase-C-Basisdateien; die Auth-Ergänzungen stehen am Dateiende.

## Phase-C-Dateien (31)

### APIs und Oberfläche
- app/api/cms/drafts/route.ts
- app/api/cms/locations/route.ts
- app/api/cms/media/route.ts
- app/api/cms/preview/route.ts
- app/api/cms/releases/route.ts
- app/api/cms/transitions/route.ts
- app/api/files/route.ts
- app/spielbereich/modules/location-cms.tsx
- app/spielbereich/modules/navigation.ts
- app/spielbereich/modules/shell.tsx
- app/spielbereich/modules/use-navigation.ts
- app/spielbereich/workspace.tsx

### Modell, Migration und Dienste
- db/schema.ts
- domain/location-cms.ts
- domain/location-types.ts
- drizzle/0005_phase_c_editorial_revisions.sql
- drizzle/meta/0005_snapshot.json
- drizzle/meta/_journal.json
- server/location-cms-service.ts
- server/location-revision-projector.ts
- server/location-repository.ts

### Testharness und Tests
- scripts/test-local.mjs
- tests/integration.mjs
- tests/role-foundation-local.mjs

### Übergabedokumente
- docs/pre-alpha-v0.1.037/phase-c/Technical-Handover.md
- docs/pre-alpha-v0.1.037/phase-c/Migration-0005-und-Rollback.md
- docs/pre-alpha-v0.1.037/phase-c/Berechtigungen-und-Medien.md
- docs/pre-alpha-v0.1.037/phase-c/Identity-Cloudflare-Auth-Gate.md
- docs/pre-alpha-v0.1.037/phase-c/Testbericht.md
- docs/pre-alpha-v0.1.037/phase-c/Geaenderte-Dateien.md
- docs/pre-alpha-v0.1.037/phase-c/Source-Bundle-README.md

## Neu im lokalen Abschlusskandidaten (6)
- package.json
- package-lock.json
- vite.config.ts
- scripts/cloudflare-preview-config.mjs
- tests/cloudflare-preview-config.test.mjs
- CLOUDFLARE_PR_PREVIEW_ISOLATION_REVIEW.md

Diese Ergänzungen aktualisieren Cloudflare Vite Plugin auf 1.58.0, Wrangler auf 4.137.0 und Workers Types auf 5.20260925.2, ergänzen die fail-closed Preview-Bindings und dokumentieren/testen sie.

## Gegenüber dem vorherigen Drive-Source-ZIP aktualisierte Dateien
- app/api/cms/media/route.ts
- app/api/cms/preview/route.ts
- app/spielbereich/modules/location-cms.tsx
- scripts/test-local.mjs
- server/location-cms-service.ts
- tests/integration.mjs
- docs/pre-alpha-v0.1.037/phase-c/Technical-Handover.md
- docs/pre-alpha-v0.1.037/phase-c/Berechtigungen-und-Medien.md
- docs/pre-alpha-v0.1.037/phase-c/Testbericht.md
- docs/pre-alpha-v0.1.037/phase-c/Geaenderte-Dateien.md

Keine Änderung an Migration 0004, Produktions-D1/R2, Ortsdaten, Electric-Taberna-ID, Recovery oder kanonischen Inhalten. Die Auth-Integration ist nur lokal und synthetisch; kein Push, Merge oder Deployment.
# Ergänzung: lokale Auth-2.0-Integration, 26.09.2026

Die folgenden zusätzlichen Dateien gehören zum konsolidierten lokalen Stand. Sie sind nicht gepusht oder deployed:

- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/register/route.ts`
- `app/api/auth/session/route.ts`
- `app/anmelden/auth-form.tsx`
- `app/anmelden/page.tsx`
- `app/profil/logout-button.tsx`
- `app/profil/page.tsx`
- `app/page.tsx`
- `app/spielbereich/page.tsx`
- `app/chatgpt-auth.ts` (entfernt; keine unbestätigten OAI-Header mehr als Identität)
- `server/platform-auth.ts`
- `server/password-hash.ts`
- `server/database.ts`
- `server/access.ts`
- `db/schema.ts`
- `drizzle/0006_auth_platform.sql`
- `drizzle/meta/0006_snapshot.json`
- `drizzle/meta/_journal.json`
- `scripts/test-local.mjs`
- `tests/integration.mjs`
- `tests/password-hash.test.mjs`
- `package.json` / `package-lock.json` (Miniflare als direkte Dev-Abhängigkeit `5.20260921.0-alpha`)
- `docs/pre-alpha-v0.1.037/phase-c/Identity-Cloudflare-Auth-Gate.md`
- `docs/pre-alpha-v0.1.037/phase-c/Testbericht.md`
- `docs/pre-alpha-v0.1.037/phase-c/Technical-Handover.md`
- `docs/pre-alpha-v0.1.037/phase-c/Geaenderte-Dateien.md`
