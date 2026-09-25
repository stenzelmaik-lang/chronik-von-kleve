# Testbericht – Pre-Alpha v0.1.037 Phase C

## Ergebnis

| Prüfung | Ergebnis | Nachweis / Grenze |
|---|---|---|
| Build | **BESTANDEN** | `node scripts/run-framework.mjs build`; alle App/API-Routen einschließlich `/api/cms/*` wurden erzeugt. Warnung: ein minifizierter Client-Chunk über 500 kB. |
| Typecheck | **BESTANDEN** | `tsc --noEmit --incremental false`. |
| Lint | **BESTANDEN** | ESLint über Workspace, `dist` und `.next` ausgeschlossen; keine verbleibenden Warnungen. |
| Drizzle-Abgleich | **BESTANDEN** | `drizzle-kit check`: „Everything's fine“. |
| Fachtests | **25 BESTANDEN** | Foundation, Recovery, Ortsprojektion, Geodaten, Player-Cache und generischer Kartenvertrag. |
| Integration | **383 BESTANDEN** | Miniflare mit eigener temporärer Test-D1 und Test-R2; kompletter bestehender API-/Character-/Inventory-/Recovery-Regressionstest plus Phase-C-CMS. |
| Rollen-/Backfill-/Rollbacktest | **46 BESTANDEN** | Separate frisch migrierte Test-D1; Mitgliedschaftskonflikt stoppt Backfill, erfolgreicher Backfill ist deterministisch/idempotent, Rollen bleiben kampagnengebunden, physische Rollback-Kopie erhält Alt-Daten. |
| D1-Batch-Atomarität | **BESTANDEN** | Absichtlich ungültige zweite Anweisung bricht Batch ab; erste Anweisung bleibt nicht gespeichert. |
| Migration 0004 | **TEST-D1 BESTANDEN** | Nur lokale, frische Test-D1; keine Produktivmigration. |
| Migration 0005 | **TEST-D1 BESTANDEN** | Nur lokale, frische Test-D1; Schema/Snapshot/Journal stimmen überein. |
| Browser/Desktop/Mobil mit echter Identität | **NOCH NICHT GEPRÜFT** | Phase C ist nicht deployed; keine Cloudflare-Authentifizierung und kein echter Player-Login. Build und HTTP-Integration sind kein Live-Browser- oder Identitätstest. |
| MAP-QA-01 bis MAP-QA-04 | **OFFEN** | Bleiben unabhängige Live-Kartenprüfungen aus v0.1.036. |

In Summe: 455 explizite automatisierte Prüfpunkte (25 Fachtests + 383 Integrationsprüfungen + 46 Rollen-/Rollbackprüfungen + 1 D1-Atomaritätsprobe). Der Integrationstest protokolliert eine erwartete 403-Antwort bei einem negativen Player-Migrationsversuch; sie ist ein bestandener Berechtigungstest, kein Testfehler.

## Security-Abdeckung

Die Integrationssuite prüft zwei getrennte synthetische Spieler, Spielleitung, Editor, blockierten Benutzer, fremde Kampagne, Public-, Gruppen- und persönliche Freigabe, Review-Gate, parallele Saves/Release-Versionen, Versionskonflikt 409, Widerruf/Sperre/Fallback, unbekannte Koordinaten, GM_SECRET-/Recovery-Sperren, private Test-R2-Medien, Player-Preview, direkte Datei-URL-Verweigerung, referenzierten Datei-Löschschutz und persönliche Bereichs-/Raumprojektion.

Die Testidentitäten stammen ausschließlich aus dem lokalen Miniflare-Harness. Authentifizierung wurde nicht gefälscht oder für Produktion umgangen.

## Datenintegrität und Betrieb

- Test-Worker bindet nur lokale Wrangler-D1-Datenbanken im zufälligen OS-Temp-Verzeichnis und flüchtiges R2 (`r2Persist:false`).
- Recovery-Regression liest/importiert die vorhandenen Fixtures ausschließlich in diese lokale Test-D1. Kein Produktions-Recovery-Import wurde ausgelöst.
- `WORKERS_CI` wurde nicht gesetzt; produktive Cloudflare-Bindings wurden nicht verwendet.
- Keine produktiven Daten, Migrationen, Backfills, Releases oder Dateien wurden geändert.
- Kein Deployment und kein Merge.

## Bekannte technische Warnung

Der Build meldet weiterhin mindestens einen minifizierten Client-Chunk über 500 kB. Das ist eine Bundle-Größenwarnung; Build und Runtime-Test sind erfolgreich. Es wurde keine riskante Aufteilung nur zum Entfernen der Warnung vorgenommen.
