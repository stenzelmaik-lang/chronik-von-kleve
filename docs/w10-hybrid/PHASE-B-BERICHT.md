# W10-Hybrid – Phase B (Charakterintegration), lokaler Bericht

Stand: 31.10.2026. Branch `claude/w10-hybrid-phase-b`, nur lokal, kein Push, keine PR, kein Deployment.
Das Hybridprofil bleibt `1.0.0-draft` mit `productionEnabled: false`.

## 1. Ausgangsstand und Phase-A-Reproduktion

- Basis: aktuelles `origin/main` `02af145` (PR #50 Galerie/Material 2). PR #51 war beim Abzweigen noch nicht auf `main`.
- Phase A: Commit `a079b4a` aus `codex/w10-hybrid-phase-a` per Cherry-Pick übernommen (`0803d15`). Ohne Konflikte: Zwischen `0795040` und `02af145` hat `main` keine Würfel-, W10-, Charakter- oder Runtime-Datei und kein `package.json` geändert.
- Der Codex-Worktree wurde nicht verändert, nur gelesen bzw. per `git fetch` referenziert.
- Reproduktion des Standardlaufs auf der neuen Basis: **261/261 bestanden**, wie in der Übergabe.
- Unverändert: `/api/live-table`, 3D-Würfel, `use-shared-dice.ts`, `domain/w10.ts`-Vertrag einschließlich der Live-Grenze von 30 Würfeln.

## 2. Umfang Phase B

| Baustein | Datei | Inhalt |
| --- | --- | --- |
| Übersetzungsadapter | `domain/w10-selection.ts` | 9 Attribut- und 30 Fähigkeits-IDs (Spezifikation 3.2) → vorhandene deutsche Bogenschlüssel. Die Kategorie (Talent/Fertigkeit/Kenntnis) wird aus `abilityGroups` der Character Engine gelesen und nicht doppelt gepflegt. Gespeicherte Schlüssel werden nicht umbenannt. |
| Poolableitung | `domain/w10-selection.ts` → `deriveW10Preview` | Rein, ohne Zufall und ohne Schreibzugriff. Pool = Attribut (+ Fähigkeit) aus `records.body`. Die SG-Regeln laufen über `prepareDraftRoll` aus Phase A: ungelernte Fertigkeit +1, ungelernte Kenntnis gesperrt, SG-Überlauf nur mit ausdrücklicher Policy. |
| Vorschau mit Herkunft | dto. | `provenance[]` nennt für jeden Summanden und jeden SG-Modifikator Quelle und Betrag. `notApplied[]` listet jede bewusst nicht angewandte Regel mit Grund. Blockierte Vorschauen geben `code` und die bisherige Herkunft zurück. |
| Server/Rechte | `server/w10-preview.ts` | SL: jeder verwaltbare Kampagnencharakter (über `editableCharacter`). Spieler: nur ein eigener, aktiver Charakter (über `ownedActiveCharacter`). Fremde, geheime, archivierte und unbekannte Charaktere liefern einheitlich 404. Die Charakterversion stammt aus `records.version`. |
| Route | `app/api/w10-preview/route.ts` | `POST`, strenges Zod-Schema auf allen drei Ebenen. `pool`, `faces`, `stressUnits`, `hunger`, `willpower`, `allowed`, `specialtyApplies` und `characterVersion` vom Client werden mit 400 abgelehnt. Same-Origin-Prüfung und Login sind Pflicht. |
| Freigabegrenze | `server/w10-preview.ts` | Die Route antwortet nur, wenn `W10_HYBRID_PREVIEW=local-only` **und** `AUTH_ACCESS_ENVIRONMENT=local-test` gesetzt sind. Beides setzt ausschließlich `scripts/test-local.mjs --w10-hybrid`. Sonst gilt 404, auch für die SL. |
| Engine | `domain/character-engine.ts` | Nur `attributeGroups`/`abilityGroups` exportiert, keine Verhaltensänderung. Keine zweite Charakterhaltung. |

Bewusst **nicht** in Phase B: Würfeln, Ereignisse, Ressourcenbuchung, Rundensperre, Idempotenz (Phase D), Hunger-/Stresswürfel (Phase C) und eine UI. Die Vorschau ist als API abnehmbar; der Spieltisch bleibt unverändert, solange das Profil nicht freigegeben ist.

### Adapter: Abweichungen zur Spezifikation

Die Spezifikation schlägt „Nachforschung“ und „Recht“ vor. Der Bogen speichert dagegen **„Nachforschungen“** (`investigation`) und **„Gesetzeskenntnis“** (`law`). Der Adapter folgt dem Bogen, die Spezifikationswörter gelten nur als UI-Alias. Diebstahl (`larceny`) und Technologie (`technology`) sind wie gefordert vorhanden. `security` und `linguistics` sind unbekannte IDs (400).

## 3. Tests

| Prüfung | Ergebnis |
| --- | --- |
| Standardlauf (`pnpm test`), inklusive Phase A und neuer `tests/w10-selection.test.mjs` | **270/270 bestanden** (261 + 9) |
| `test:w10-hybrid` (Phase A, Phase B Unit, W10-Prototyp, Shared Dice, Vitals) | **69/69 bestanden** |
| Integration `tests/w10-hybrid-integration.mjs`, Instanz `--w10-hybrid`, SL/A/B | **alle 6 Blöcke bestanden** |
| Gegenprobe ohne Freigabebindung (`--ultio-pager`, Port 8879) | SL erhält **404** |
| Regression `tests/ultio-pager-integration.mjs` auf der W10-Instanz | bestanden |
| Typecheck, ESLint der geänderten Dateien, lokaler Produktionsbuild | bestanden |

Unit-Tests B01–B09: Adapter vollständig und eindeutig, keine Prototype-Keys. Pool und Herkunft. Reiner Attributwurf. Talent/Fertigkeit/Kenntnis. SG-Überlauf. Unvollständiger oder ungültiger Bogen blockiert, statt Werte zu erfinden. Unbekannte IDs. Keine Mutation und vollständige `notApplied`-Liste. Freigabegrenze nicht in der Wrangler-Konfiguration.

Integration:
1. A und B sehen jeweils den Pool ihres gespeicherten Bogens mit Herkunft. Der Server liefert die Charakterversion. Keine SL-Daten in der Antwort.
2. A → B und B → A: 404. Unbekannte ID: 404.
3. Die SL erhält für beide Charaktere identische Ergebnisse.
4. Manipulation: 9 freie Top-Level-Felder, `selection.pool`, `declared.pool` und `declared.specialtyApplies` liefern 400. Ungültige SG und unbekannte IDs: 400. Fremder Origin: 403. Ohne Login: 401.
5. Drei Vorschauen ändern `records.version` nicht.
6. `/api/live-table` antwortet weiter.

## 4. Lokale Testinstanz

```powershell
cd C:\Users\Stenz\Documents\ChroniPlay-Claude\cvk-w10
.\scripts\start-w10-hybrid.ps1          # Port 8878, Speicher .local-test/w10-hybrid
.\scripts\start-w10-hybrid.ps1 -Build   # vorher neu bauen
```

Konten: `command-gm@`, `command-a@` und `command-b@example.invalid`; das Passwort steht in `scripts/test-local.mjs`. Abnahme bei laufender Instanz:

```powershell
$env:CVK_TEST_URL='http://127.0.0.1:8878'; node --experimental-strip-types tests/w10-hybrid-integration.mjs
```

Ohne `npm` im PATH Node per PATH-Präfix nutzen (siehe Übergabe Phase A).

## 5. Offene Entscheidungen des Projektinhabers

> **Nachtrag 31.10.2026:** Der Projektinhaber hat alle sieben Punkte entschieden. Abgleich, Korrekturen K1–K7, Rückfragen und Migrationskonzepte stehen in [PHASE-B-ENTSCHEIDUNGEN-ABGLEICH.md](PHASE-B-ENTSCHEIDUNGEN-ABGLEICH.md). Die folgende Liste gibt den Stand von `d47ec09` wieder.

Keine stillen Migrationen. Bis zur Entscheidung steht jeder Punkt sichtbar in `notApplied`:

1. **Stress 0–10 → 0–300**: Der bestehende persönliche Stress bleibt unberührt und geht nicht in die Vorschau ein.
2. **Blut → Hunger**: Blutpunkte werden nicht umgedeutet; es gibt keine Hungerwürfel.
3. **SG-Kappung**: Standard ist `reject`. `cap_at_10` ist nur eine ausdrücklich gewählte, sichtbare technische Option und keine Regelfreigabe.
4. **Spezialisierungen**: Der Bogen hat dafür kein Feld; `specialtyApplies` ist immer `false`. Speicherort und Anwendungsprüfung sind zu entscheiden (Übergabe: Phase B/F).
5. **Wundabzüge** (Spezifikation 19.1 Nr. 8): nicht angewandt.
6. **Freie/eigene Fähigkeiten** (`customAbilities`): ohne Registry-ID und Kategorie nicht auswählbar.
7. **„Aktiver Charakter“** ist als eigener, nicht archivierter und nicht geheimer Charakter umgesetzt (`ownedActiveCharacter`). Ob nur der im Profil ausgewählte Charakter zählen soll, ist zu bestätigen.

Phase C/D wurde nicht begonnen.
