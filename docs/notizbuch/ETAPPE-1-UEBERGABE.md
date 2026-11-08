# Etappe 1 · Abenteuerjournal ad acta · Übergabe

Stand 08.11.2026 · Claude Code (Opus 5.5) · lokal, nicht gepusht, nicht deployt

| | |
|---|---|
| Branch | `claude/journal-ad-acta` |
| Basis | `claude/journal-release` @ `5f4bf8a` |
| Code-Commit | `c3fb272` |
| Vorlauf | Etappe 0 liegt auf `claude/notizbuch-bestandsaufnahme` (`docs/notizbuch/BESTANDSAUFNAHME.md`, mit den Entscheidungen des Besitzers in Abschnitt 5a). Der Besitzer hat am 08.11. zum Weitermachen aufgefordert. |

## Änderungen

1. **Archiv-Tag** `archiv/abenteuerjournal-aj01` (annotiert) auf `f57d990`. Nur lokal angelegt.
2. **Kurzdokument** [docs/archiv/ABENTEUERJOURNAL-AD-ACTA.md](../archiv/ABENTEUERJOURNAL-AD-ACTA.md): was es war, warum es geht, wo der Stand liegt, was wiederverwendbar ist.
3. **Rückbau:**
   - Gelöscht: `app/spielbereich/modules/spieltisch/journal/` (9 Dateien), `domain/journal.ts`, `tests/journal.test.mjs`, `tests/journal-integration.mjs`, `tests/fixtures/journal-demo.mjs`.
   - Auf den Live-Quellstand `5e6ae31` zurückgesetzt: `stage.tsx`, `types.ts`, `server/live-stage.ts`, `server/character-projection.ts`, `app/api/character-companion/route.ts`, `app/api/character-detail/route.ts`, `character.tsx`, `character-detail.tsx`, `rich-text.tsx`, `package.json`, `scripts/test-local.mjs`.
   - Das ist zulässig, weil zwischen `5e6ae31` und `5f4bf8a` nur Journal-Commits liegen (`606c69e`, `ae55490`, `336070f`, `f57d990`, `5f4bf8a`). Ich habe zudem jeden Datei-Diff gelesen: Er enthielt nur Journal-Teile.
   - Die Dokumente (AJ-01-Übergabe, Release-Bericht) bleiben.
4. **Daten bleiben:** Es gibt keine Migration und keine Datenänderung. Der Server liest und speichert Notizen wieder wie vor dem Journal:
   - `note.update` lädt den gespeicherten Body und überschreibt nur `text` und `archived`. Dadurch bleiben `journalKind`, `playDate` und unbekannte Felder erhalten.
   - Neue Werte für `journalKind` oder `playDate` nimmt die Route nicht mehr an.
5. **Gerettete Hilfen** (nur was Etappe 2 und 4b brauchen):
   - `domain/calendar-date.ts`: `validCalendarDate`, `formatCalendarDate`, früher `validPlayDate`/`formatPlayDate`.
   - `domain/sheet-values.ts`: `sheetNumber`, `dotSlots`, `dotLabel`.
   - Tests in `tests/calendar-date.test.mjs` und `tests/sheet-values.test.mjs`, beide in `pnpm test` aufgenommen.
6. **Neuer Integrationstest** `tests/journal-retirement-integration.mjs` (23 Prüfungen):
   - Ein Eintrag in der alten Journalform bleibt lesbar, auch als HTML.
   - `journalKind`, `playDate` und ein unbekanntes Feld überstehen das Speichern über `/api/character-companion` und über `/api/records`.
   - Eine veraltete Version liefert 409 und ändert nichts.
   - Spieler B und SL lesen den Eintrag nicht und ändern ihn nicht, auch mit fremden IDs.
   - Der Tisch-Snapshot enthält keinen Journal-Schalter.
   - Nicht angemeldet liefern alle berührten Routen 401.

## Abnahmekriterium „keine Buch-Dateien mehr“

`git diff --stat 5e6ae31 HEAD` nach dem Rückbau:

```
 docs/alpha-2/AJ-01-ABENTEUERJOURNAL-UEBERGABE.md | 108 +++
 docs/archiv/ABENTEUERJOURNAL-AD-ACTA.md          |  (neu)
 docs/notizbuch/ETAPPE-1-UEBERGABE.md             |  (neu)
 docs/releases/2026-11-07-abenteuerjournal.md     |  28 +++
 domain/calendar-date.ts                          |  23 +
 domain/sheet-values.ts                           |  19 +
 package.json                                     |   2 +-   (nur Testliste: zwei neue Testdateien)
 tests/calendar-date.test.mjs                     |  16 +
 tests/journal-retirement-integration.mjs         |  76 +
 tests/sheet-values.test.mjs                      |  27 +
```

Das sind nur Dokumente, das Archivdokument, die geretteten Hilfen und Tests. `DiceJournal`, `dice-inbox.mjs`, die CSS-Klasse in `table-tools.module.css` und das Drizzle-Journal sind unberührt.

## Prüfungen (beobachtet)

Umgebung: Node 24.22.1 und pnpm 11.25.0 aus der lokalen Codex-Laufzeit, weil `node`/`pnpm` nicht im `PATH` liegen. Abhängigkeiten mit `pnpm install --frozen-lockfile`. Die Lockfiles sind unverändert.

| Prüfung | vor dem Rückbau (`5f4bf8a`) | nach dem Rückbau |
|---|---|---|
| `pnpm run typecheck` | ohne Fehler | ohne Fehler |
| `pnpm test` | 388/388 | **381/381** (−12 Journal-Tests, +5 neue) |
| `node --experimental-strip-types --test tests/*.test.mjs` | 502/508 | **495/501**, dieselben 6 Fehlschläge |
| `pnpm run lint` (gesamt) | 12 Fehler, 20 Warnungen, alle in nicht angefassten Dateien (u. a. `prototypes/spieltisch-2/*`) | unverändert vorbestehend, ich habe nichts daran geändert |
| ESLint auf allen neuen und geänderten Dateien (15 Dateien) | – | **ohne Befund** |
| `pnpm run build` | – | erfolgreich |
| `pnpm run test:integration:run` | – | Exit 0, 2.151 Prüfungen und 46 Rollenprüfungen (wie im Release-Bericht) |
| `tests/journal-retirement-integration.mjs` gegen `scripts/test-local.mjs --command-center` (Port 8899) | – | **23/23** |

**Befunde außerhalb von `pnpm test`, nicht angefasst:**
- 4 Fehlschläge in `npc-data` und `npc-dossier`, bekannt aus der AJ-01-Übergabe.
- **Neu gegenüber der AJ-01-Übergabe:** `tests/location-area-rich-text.test.mjs` und `tests/location-dossier.test.mjs` brechen beim Laden ab: `ERR_MODULE_NOT_FOUND` für `domain/location-types` (Import ohne Dateiendung in `domain/location-cms.ts`). Das tritt identisch auf dem unveränderten Basisstand `5f4bf8a` auf. Vermutlich liegt es an Node 24 und strip-types (die AJ-01-Übergabe lief mit einer anderen Node-Version). Das ist eine Annahme, nicht geprüft.

## Prüfgrenzen

- Keine Browserprüfung des Tischs nach dem Rückbau. Belegt sind Typecheck, Build, Integrationsprüfung und das Fehlen aller Journal-Bezüge im Code (Suche nach `domain/journal`, `spieltisch/journal`, `journalEnabled`, `JournalBook`, `AJ01_JOURNAL` außerhalb von `docs/`: kein Treffer).
- Kein echtes Mobilgerät.
- Produktion nicht geprüft und nicht verändert.

## Offene Punkte

- **Produktion:** Das Buch ist live (Worker `240e208e`) aktiv. Abschalten geht ohne Code über das Leeren von `AJ01_JOURNAL_CAMPAIGNS` oder mit dem Release dieses Branches. Beides braucht die ausdrückliche Freigabe des Besitzers (offene Entscheidung 2).
- **Push des Tags** `archiv/abenteuerjournal-aj01` und des Branches nach Freigabe.
- `main` enthält weder den Live-Stand noch diesen Rückbau. Vor dem nächsten Deployment muss geklärt werden, auf welcher Basis es läuft.
- Die beiden Ortsdossier-Testdateien brauchen einen eigenen kleinen Auftrag (Importendung).

## Ausdrücklich nicht getan

Kein Push, kein Tag-Push, kein Merge, kein Deployment, keine Änderung an Produktionsvariablen, keine Migration, keine Datenänderung, keine neue Abhängigkeit. Die Branches `claude/chroniplay-abenteuerjournal-23ec22` und `claude/journal-release` sind unverändert.
