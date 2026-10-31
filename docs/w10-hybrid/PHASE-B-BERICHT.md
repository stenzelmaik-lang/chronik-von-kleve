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

## 6. Nachtrag: Korrekturen K3, K7 und K5 (31.10.2026)

Auf Grundlage der Projektinhaberentscheidungen (Details und Status im [Abgleich](PHASE-B-ENTSCHEIDUNGEN-ABGLEICH.md)):

- **K3:** Eine Schwierigkeit über 10 wird vor dem Würfeln abgelehnt und erklärt. Es gibt keine Kappung mehr, auch nicht im Phase-A-Kern. Die Phase-A-Tests D10/D11 sind entsprechend angepasst; Ziffer 4 der Codex-Übergabe zu `cap_at_10` ist damit überholt.
- **K7:** Die Route verlangt `sessionId`. Spieler sind an die ausgewählte, spielbereite Figur am laufenden Abend gebunden; die SL an die Spielercharaktere des Abends.
- **K5:** Der V20-Wundabzug aus der bestehenden Gesundheitsleiste gilt für gewöhnliche Proben und erscheint in der Herkunft. Ausnahmen bleiben bis zur Quellprüfung offen.

| Prüfung | Ergebnis |
| --- | --- |
| Standardlauf | **271/271 bestanden** |
| `test:w10-hybrid` | **70/70 bestanden** |
| Integration SL/A/B (9 Blöcke: Bindung, Pool, SG, Wunden, Rechte, SL, Manipulation, nur lesend, Live-Tisch) | **bestanden**, frische Instanz |
| Regression ULTIO-Pager und Zustandswerte auf derselben Instanz | bestanden |
| Typecheck, ESLint, lokaler Build | bestanden |

## 7. Nachtrag: K4 Spezialisierungen (31.10.2026)

- **Datenmodell:** Neues, optionales Bogenfeld `specialties` (`domain/character-specialties.ts`): `{ id: "spec_<uuid>", target: { kind: "attribute"|"ability", id: <stabile ID> }, name, scope?, active? }`. Die stabilen IDs liegen jetzt in `domain/trait-ids.ts`, das Bogenvalidierung und Würfel-Engine gemeinsam nutzen. Bestehende Bögen ohne das Feld bleiben unverändert; es gibt keine Migration und keine erfundenen Einträge.
- **Validierung:** Die Struktur prüft `validateExistingSheet` bei jeder Bearbeitung: eindeutige ID, gültiges Ziel, Name, keine fremden Felder, keine aktive Dublette. Neue oder geänderte aktive Einträge brauchen beim Speichern über `edit_sheet` mindestens 4 Punkte (V20 S. 96). Ältere Einträge blockieren keine anderen Änderungen, auch wenn der Wert später unter 4 fällt. Sie bleiben gespeichert, wirken dann aber nicht.
- **Schutz:** `specialties` gehört zu `characterSheetFields`. Bei bestätigten Bögen und Bögen in Prüfung kann der allgemeine Editor das Feld deshalb nicht ändern; der Integrationstest bestätigt das.
- **Oberfläche:** Bogeneditor im Bereich „Fähigkeiten“ mit Zuordnung (Attribut oder Fähigkeit), Name, Geltungsbereich, „Aktiv“ und Löschen. Liegt der Wert unter 4, zeigt der Editor einen Hinweis und sperrt das Speichern mit Begründung. Die Bogenansicht listet die Spezialisierungen auf und kennzeichnet deaktivierte sowie noch nicht wirksame Einträge.
- **Vorschau:** `selection.specialtyId` (Format `spec_…`). Der Server prüft Besitz, Ziel, Aktivität und Mindestwert. Passt etwas nicht, wird die Probe mit Begründung blockiert und nicht still ohne Spezialisierung gewertet. Die Vorschau listet passende Spezialisierungen mit `applicable` auf. Eine angewandte Spezialisierung bringt keinen zusätzlichen Würfel; im Kern zählt jede gewürfelte 10 doppelt, danach ziehen die Einsen nach V20 ab. Der Anspruch ist als „vom Spieler beansprucht“ oder „von der SL gesetzt“ markiert. **Die erzählerische Passung regelt die Entscheidung R4** (siehe Abgleich): Bei einer SL-Probenaufforderung entscheidet die SL, bei einem freien Wurf beansprucht der Spieler sichtbar; einen SL-Einspruch nach dem Wurf wertet dieselben Würfel ohne Doppelwertung neu aus und protokolliert ihn als Korrektur (Phase D).
- **Nicht umgesetzt:** Spezialisierungen im Erschaffungseditor für Engine-Entwürfe; Ziele vom Typ `customAbility` (folgt mit K6); Primärquellenprüfung, ob V20 mehrere Spezialisierungen je Eigenschaft erlaubt. Derzeit sind mehrere mit unterschiedlichen Namen zulässig, angewandt wird je Probe höchstens eine.

| Prüfung | Ergebnis |
| --- | --- |
| Standardlauf | **275/275 bestanden** |
| Integration SL/A/B, frische Instanz, jetzt 10 Blöcke einschließlich Spezialisierungen | bestanden |
| Regression ULTIO-Pager, Zustandswerte | bestanden |
| Browserregression `character-management-browser.mjs` (eigene `--charakter-3`-Instanz, Port 8846, Edge), einschließlich Editor bei 1440 und 375 px | bestanden |
| Manuelle Browserprüfung: SL fügt eine Spezialisierung hinzu; Hinweis und Sperre bei 3 Punkten, Speichern bei 4, Anzeige in der Bogenansicht, keine Konsolenfehler | bestanden |
| Typecheck, ESLint, lokaler Build | bestanden |

## 8. Nachtrag: K6 Eigene Fähigkeiten (31.10.2026)

- **Datenmodell:** Neue Einträge in `customAbilities` erhalten `{ id: "cab_<uuid>", name, value, category, active? }` (`domain/custom-abilities.ts`). Die Kategorie nutzt die Bezeichnungen, die der Bogen schon speichert: `Talent`, `Fertigkeit` oder `Kenntnis`. Sie ist für Einträge mit ID Pflicht und wird nie automatisch gesetzt.
- **Bestand:** Einträge ohne ID, auch historischer Freitext, bleiben genau so gespeichert, wie sie sind. Sie werden nicht umbenannt, bekommen keine nachträgliche ID und sind nicht würfelbar. Die Vorschau meldet ihre Anzahl (`customAbilitiesWithoutId`), der Editor kennzeichnet sie. Die Übernahme erfolgt erst nach Inventur und Freigabe (M6).
- **Schutz:** IDs sind eindeutig. Der Name eines aktiven Eintrags mit ID darf weder einer V20-Standardfähigkeit noch einem anderen Eintrag gleichen; Groß-/Kleinschreibung und Leerzeichen werden dabei nicht unterschieden. Ein deaktivierter Zwilling darf für die Historie bleiben. Gibt es Verstöße, ist keine einzige eigene Fähigkeit wählbar; der Server rät nicht. Spezialisierungen dürfen nicht auf entfernte eigene Fähigkeiten zeigen.
- **Umbenennen und Deaktivieren:** Beim Umbenennen ändert sich nur der Name, Auswahl und Spezialisierungen bleiben über die ID gebunden. `active: false` ersetzt das Löschen: Der Eintrag bleibt gespeichert, ist aber nicht würfelbar (`CUSTOM_ABILITY_INACTIVE`).
- **Würfeln:** Die Auswahl erfolgt über `abilityId: "custom:cab_…"`. Der gespeicherte Wert wird automatisch genutzt. Es gelten die V20-Gruppenregeln der Kategorie (Talent ohne Malus, Fertigkeit +1 SG, Kenntnis gesperrt) sowie Wundabzug, SG-Grenze und Spezialisierungen (Zieltyp `customAbility`).
- **Editor:** Neue Zeilen im Bogeneditor und im Bestandsformular bekommen eine ID. Im Bogeneditor gibt es dazu Kategorieauswahl und „Aktiv“; die Spezialisierungsauswahl bietet eigene Fähigkeiten an. Die Bogenansicht zeigt Spezialisierungen eigener Fähigkeiten mit Namen.
- **Abweichung vom Plan:** XP-Käufe adressieren eigene Fähigkeiten weiter über den Namen. Für Einträge mit ID ist das eindeutig, weil Namen nicht verwechselbar sein dürfen. Eine XP-Zuordnung über die ID braucht eine Schemaänderung der Engine-Route und folgt gesondert.
- **Grenze:** Der allgemeine Records-Editor (Entwürfe) ruft die Bogenvalidierung nicht auf. Eine dort gespeicherte, fehlerhafte Liste macht keine eigene Fähigkeit wählbar, verliert aber nichts.

| Prüfung | Ergebnis |
| --- | --- |
| Standardlauf | **279/279 bestanden** |
| Integration SL/A/B, frische Instanz, jetzt 11 Blöcke einschließlich eigener Fähigkeiten | bestanden |
| Regression ULTIO-Pager, Zustandswerte | bestanden |
| Browserregression `character-management-browser.mjs` (1440 und 375 px) | bestanden |
| Manuelle Browserprüfung des Editors: Kategorie, Aktiv, Sperre ohne Kategorie | bestanden |
| Typecheck, ESLint, lokaler Build | bestanden |

## 9. Nachtrag: K1 persönlicher Stress, Phase-B-Anteil (31.10.2026)

Grundlage sind die Entscheidungen R1 und R1b (siehe Abgleich).

- **Speicherort:** `personalStressUnits` (0–300) ist ein eigenes, serverseitig geführtes Feld im Charakterdatensatz (`domain/personal-stress.ts`). Es ist kein Bogenfeld, `edit_sheet` kann es also nicht ändern. Die Records-Route schützt es (`protectedKeys`), auch gegen die SL: Ändern darf es nur die künftige Mechanik in Phase C/D. Es liegt nicht im Settings-Dokument von Gruppenstress und Altwert; die Versionskonflikte aus der Risikoliste entstehen damit nicht.
- **Vorschau:** Unter `stress.personal` stehen Einheiten, volle Stresspunkte (bis 3), Fortschritt in Prozent und `recorded`. Ohne gespeicherten Wert gilt 0, `recorded: false`; geschrieben wird nichts. Ein ungültiger gespeicherter Wert wird mit `invalid` gemeldet, nicht repariert. `stress.legacyManual` zeigt den alten Tischwert (0–10) mit `effect: 'none'`, sichtbar nur für Besitzer und SL. `appliedToRoll: false`: Weder der neue Wert noch der Altwert verändern Pool oder SG.
- **Gruppenstress:** wird nicht gelesen oder geschrieben. Der Integrationstest prüft, dass Vorschauen ihn nicht ändern.
- **Nicht in Phase B:** automatische Änderungen durch Würfe, Minispiele und Rollenspielerfolge; Stressmodifikatoren und Stresswürfel (die Hausregelwerte bleiben bis zum Balancing vorläufig); der Schreibweg für ausdrücklich freigegebene Anfangswerte einzelner Figuren.
- **Folgepunkt bei Aktivierung:** Die SL kann den Altwert am Spieltisch heute noch manuell ändern. Mit der Aktivierung des Hybridsystems sollte diese Bedienung nur noch lesend als „Altwert“ erscheinen. Das betrifft die Spieltisch-Oberfläche und ist noch nicht umgesetzt.

| Prüfung | Ergebnis |
| --- | --- |
| Standardlauf | **282/282 bestanden** |
| Integration SL/A/B, frische Instanz, jetzt 12 Blöcke einschließlich Stress | bestanden |
| Regression ULTIO-Pager, Zustandswerte | bestanden |
| Typecheck, ESLint, lokaler Build | bestanden |

Der Integrationstest setzt die Auswahl von A und B und den Gesundheitszustand von B vorübergehend, ausschließlich in der lokalen synthetischen Instanz. Danach setzt er die Gesundheit von B wieder auf „Gesund“. Die Auswahl bleibt auf Regiecharakter A bzw. B stehen.
