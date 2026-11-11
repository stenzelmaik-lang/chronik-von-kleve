# Alpha 2.0 – EP-Basis, Sammelabrechnung und Abrechnungsbeleg (Phase 1) – Übergabe

Stand: 10.11.2026 · Aufträge: GitHub #74 (Gesamtauftrag), #75 (EP-Vergabe, Sammelabrechnung, MVP)

- **Branch:** `claude/alpha2-ep-basis`
- **Basis-Commit:** `main` @ `78ace4922f73000073dce3aa9a8eb09c520dd6e3`
- **Umfang:** nur Server, Domäne, Datenbankschema und Tests. Keine Oberfläche.
- **Nicht getan:** kein Merge nach `main`, kein Deployment, keine Migration der produktiven Datenbank.

## Kurzfassung

Belohnungs-EP werden weiterhin ausschließlich im bestehenden Charakter-Ledger (`records.body.xpLedger`) gebucht. Neu ist:

1. Jede Belohnung trägt ihre Herkunft und eine daraus abgeleitete, feste Buchungs-ID. Dieselbe Herkunft wird je Charakter genau einmal gutgeschrieben.
2. Die Spielleitung kann einzelne Belohnungen und eine Sammelabrechnung für mehrere Charaktere buchen.
3. Jeder tatsächlich gespielte Abend erhält eine eigene dauerhafte ID.
4. Die Sammelabrechnung schreibt einen dauerhaften Beleg, der auf die Ledger-Einträge verweist.

Es gibt keine zweite EP-Buchhaltung: Die neuen Tabellen enthalten keine Salden, nur den Nachweis.

## Architektur

| Schicht | Datei | Aufgabe |
|---|---|---|
| Domäne | `domain/xp-rewards.ts` | Belohnungsquellen, Betragsgrenzen, feste Buchungs-ID, `bookXpReward` (rein, ohne Datenbank) |
| Domäne | `domain/character-management.ts` | Ledger-Eintrag um optionales Feld `source` erweitert; alte Einträge unverändert |
| Server | `server/character-engine-store.ts` | Schreibvorgang mit Versionsvergleich und Audit-Ereignis, aus `saveEngine` ausgelagert (gleiches SQL) |
| Server | `server/xp-reward-service.ts` | `bookCharacterXpReward` (interner Buchungsdienst), `bookSessionXpReward` (Einzelvergabe der SL) |
| Server | `server/played-sessions.ts` | `registerPlayedSession`, `playedSession` |
| Server | `server/xp-settlement-service.ts` | `bookSessionSettlement`, `readSessionSettlement` |
| Server | `server/xp-reward-errors.ts` | gemeinsame Fehlerklasse und ID-Prüfung |
| Route | `app/api/character-engine/route.ts` | drei neue Aktionen und ein Lesezugriff, siehe unten |

### Belohnungsquellen und Buchungs-ID

| Quelle | Betrag je Buchung | Bezug (`scopeId`) | Über die Route vergebbar |
|---|---|---|---|
| `session` | 1–5 | Spielabend-ID | ja |
| `story` | 1–3 | ID des Handlungsstrangs (Entität vom Typ `storyline`) | ja |
| `mvp` | 1–2 | Spielabend-ID | ja |
| `sl_exception` | 1–1000 (Altgrenze von `xp_grant`) | Spielabend-ID | ja |
| `engagement` | genau 1 je Meilenstein 1 oder 2 | Intervall-ID | nein, nur intern |

Buchungs-ID: `reward:<quelle>:<kampagne>:<bezug>` und bei Engagement zusätzlich `:m<meilenstein>`. Der Client kann keine Buchungs-ID vorgeben; `operationId`, `entryId` und `version` werden bei den neuen Aktionen abgewiesen.

Verhalten bei Wiederholung:

- gleiche Herkunft, gleicher Betrag: nichts wird geschrieben, Antwort mit `duplicate: true`;
- gleiche Herkunft, anderer Betrag: Konflikt (409), nichts ändert sich;
- gegengebuchte (stornierte) Belohnung: wird nicht neu angelegt, Antwort mit `reversed: true`;
- Versionskonflikt: der Dienst lädt neu und entscheidet erneut (bis zu 8 Versuche).

### Engagement (Phase 3, #76)

`bookCharacterXpReward` ist der interne Dienst ohne HTTP-Bezug. Die automatische Engagement-Vergabe soll ihn aus Servercode aufrufen und darf keine eigene Route erhalten, die ein Spieler auslösen kann. `tests/xp-reward-service.test.mjs` prüft, dass keine Datei unter `app/` den internen Dienst aufruft und die Route keine Engagement-Quelle kennt. Offen ist, welche Akteur-ID die automatische Vergabe ins Audit schreibt.

### Gespielter Abend

Ein gespielter Abend ist eine Zeile in `played_sessions`. Die Spielleitung registriert ihn aus einem Sitzungseintrag (`records`, `kind='sitzungen'`), der in diesem Moment den Status „Abgeschlossen“ hat, zusammen mit dem Spieltag.

- Der Sitzungseintrag wird nur gelesen, nie geschrieben.
- Derselbe Sitzungseintrag kann für mehrere Abende stehen (je Spieltag eine eigene ID).
- Dieselbe Kombination aus Sitzungseintrag und Spieltag liefert bei Wiederholung die vorhandene ID.
- Optional verknüpft `appointmentId` den Abend mit einem verbindlich festgelegten Termin (`kind='termine'`). Ein Termin gehört zu höchstens einem Abend. Ein Termin allein ist kein gespielter Abend.
- Nach der Registrierung hängt der Abend nicht mehr am Sitzungseintrag: Statusänderung oder Löschung des Eintrags ändern nichts.

### Sammelabrechnung und Beleg

Ablauf von `bookSessionSettlement`:

1. Der ganze Aufruf wird geprüft und bei einem Strukturfehler mit 400 abgelehnt, bevor etwas geschrieben wird (doppelte Charaktere, doppelte Quelle je Charakter, Beträge, Begründung, unbekannte Quelle, Anwesenheitsregel).
2. Spielabend und Handlungsstränge werden geprüft (404).
3. Der Beleg des Abends wird angelegt oder weiterverwendet; Teilnehmer, Anwesenheit und geplante Vergaben werden als `pending` gespeichert. Gebuchte Zeilen bleiben unberührt.
4. Jede Vergabe läuft einzeln über `bookCharacterXpReward`. Die Belegzeile wird danach `booked` (mit Ledger-Buchungs-ID und Buchungszeit) oder `failed` (mit Fehlercode).
5. Der Belegstatus wird über alle Zeilen des Abends neu bestimmt, die Revision erhöht.

Regeln:

- Abwesende Figuren erhalten hier nur `sl_exception`. `session`, `story` und `mvp` werden für Abwesende abgelehnt. Story-EP für Abwesende sind eine Auslegung dieses Schritts und fachlich noch nicht bestätigt.
- Die Anwesenheit einer Figur lässt sich nicht mehr umstellen, sobald für sie eine Zeile gebucht ist (409).
- Es gibt keine Transaktion über mehrere Charaktere. Die Konsistenz entsteht aus den festen Buchungs-IDs: Derselbe Aufruf kann unverändert erneut gesendet werden.
- Kann der Beleg nicht angelegt werden, wird nichts gebucht.

## API-Aktionen

Alle Aktionen liegen in `POST /api/character-engine` und sind nur für die Spielleitung. Nicht angemeldet: 401. Spieler: 403. Die bestehende Aktion `xp_grant` ist unverändert.

### `played_session_register`

```json
{ "action": "played_session_register", "sessionRecordId": "<Sitzungseintrag>", "playedOn": "2026-11-07", "appointmentId": "<Termin, optional>" }
```

Antwort 200: `{ "session": { "id", "campaignId", "sessionRecordId", "appointmentId", "playedOn", "title", "registeredBy", "registeredAt" }, "created": true|false }`

Fehler: 400 (Format, Spieltag in der Zukunft), 404 (kein Sitzungseintrag oder Termin dieser Chronik), 409 (Sitzung nicht abgeschlossen, Termin nicht festgelegt oder bereits vergeben, Abend bereits mit anderem Termin registriert).

### `xp_reward`

```json
{ "action": "xp_reward", "id": "<Charakter>", "type": "session|story|mvp|sl_exception", "sessionId": "<Spielabend-ID>", "storyId": "<nur bei story>", "amount": 3, "reason": "…" }
```

Antwort 200: die bestehende Charakter-Projektion plus `reward: { id, amount, duplicate, reversed }`. Schreibt keine Belegzeile.

### `xp_settlement`

```json
{ "action": "xp_settlement", "sessionId": "<Spielabend-ID>", "entries": [
  { "characterId": "…", "attended": true, "rewards": [
    { "type": "session", "amount": 3, "reason": "…" },
    { "type": "story", "storyId": "…", "amount": 2, "reason": "…" } ] },
  { "characterId": "…", "attended": false, "rewards": [] } ] }
```

Grenzen: 1–50 Charaktere, höchstens 10 Vergaben je Charakter.

Antwort:

- `status`: `complete`, `partial` oder `failed`; `complete: true|false`. **Nur `complete` darf als Erfolg angezeigt werden.**
- HTTP 200 bei `complete`, HTTP 207 bei `partial` und `failed`.
- `totals`: `{ booked, alreadyBooked, failed }`.
- `characters[]`: `status` (`booked`, `already_booked`, `failed`, `none`) und je Vergabe `status`, `entryId`, `reversed` beziehungsweise `code` und `error`.
- `receipt`: `{ id, status, revision }` – Zustand des Belegs über alle Aufrufe.

### Beleg lesen

`GET /api/character-engine?settlement=<Spielabend-ID>` → `{ "settlement": null | { id, status, revision, createdBy, createdAt, updatedBy, updatedAt, session, participants[] } }`. Jede Vergabe enthält `type`, `scopeId`, `amount`, `reason`, `status`, `ledgerEntryId`, `errorCode`, `awardedBy`, `bookedAt`.

## Datenbankmigration `0013_alpha2_xp_settlement`

Die Migration legt nur neue Tabellen, Indizes und Trigger an. Sie ändert keine bestehende Tabelle und keine bestehenden Daten.

| Tabelle | Spalten | Eindeutigkeit |
|---|---|---|
| `played_sessions` | `id`, `campaign_id`, `session_record_id`, `appointment_id`, `played_on`, `title`, `registered_by`, `registered_at` | (`campaign_id`, `session_record_id`, `played_on`); (`campaign_id`, `appointment_id`) wenn gesetzt |
| `xp_settlements` | `id`, `campaign_id`, `played_session_id`, `status`, `revision`, `created_by`, `created_at`, `updated_by`, `updated_at` | (`campaign_id`, `played_session_id`) |
| `xp_settlement_participants` | `settlement_id`, `character_id`, `attended`, `recorded_by`, `recorded_at` | Primärschlüssel (`settlement_id`, `character_id`) |
| `xp_settlement_rewards` | `settlement_id`, `character_id`, `reward_type`, `scope_id`, `amount`, `reason`, `status`, `ledger_entry_id`, `error_code`, `awarded_by`, `updated_at`, `booked_at` | Primärschlüssel (`settlement_id`, `character_id`, `reward_type`, `scope_id`) |

Fremdschlüssel: `xp_settlements` → `played_sessions`, `xp_settlement_participants` → `xp_settlements`, `xp_settlement_rewards` → `xp_settlement_participants`. Bewusst **kein** Fremdschlüssel auf `records`, damit Abend und Beleg eine Änderung oder Löschung des Sitzungseintrags überstehen.

Trigger (von Hand an die erzeugte Datei angehängt, da drizzle-kit keine Trigger erzeugt; sie stehen deshalb nicht in `drizzle/meta/0013_snapshot.json`):

- `played_sessions_immutable`: jede Änderung eines registrierten Abends wird abgebrochen.
- `xp_settlement_rewards_booked_update`: eine gebuchte Belegzeile kann nicht geändert werden.
- `xp_settlement_rewards_booked_delete`: eine gebuchte Belegzeile kann nicht gelöscht werden.

Erzeugt mit `drizzle-kit generate --name alpha2_xp_settlement`; der Lauf zeigte keine Abweichung zu bestehenden Tabellen. Bestehende Migrationen sind unverändert.

## Hinweise zur späteren Produktivmigration

Nur mit gesonderter, ausdrücklicher Freigabe des Besitzers.

1. **Reihenfolge:** zuerst die Migration, dann der Code. Der neue Code braucht die Tabellen für `played_session_register`, `xp_settlement` und das Lesen des Belegs. `xp_reward` braucht `played_sessions`. Die bestehenden Aktionen einschließlich `xp_grant` laufen auch ohne die Tabellen.
2. **Vorher:** Sicherung der produktiven D1 nach dem bestehenden Runbook (`docs/closed-alpha-release-runbook.md`). Live-Stand prüfen: Der produktive Commit muss in `main` enthalten sein, bevor von `main` aus deployt wird.
3. **Prüfen, dass nur `0013` aussteht:** Die Migration ist rein additiv. Vor dem Anwenden den Migrationsstand der Produktion mit `drizzle/meta/_journal.json` abgleichen.
4. **Nachher prüfen:** die vier Tabellen und drei Trigger existieren; `PRAGMA foreign_key_check` ist leer; bestehende Zeilenzahlen in `records` und `world_events` sind unverändert.
5. **Rückweg:** Solange nichts registriert oder abgerechnet wurde, lassen sich Trigger und Tabellen ohne Datenverlust wieder entfernen (Reihenfolge: Trigger, `xp_settlement_rewards`, `xp_settlement_participants`, `xp_settlements`, `played_sessions`). Sobald Belege existieren, würde das Entfernen den Nachweis löschen; die EP im Ledger blieben erhalten.
6. **Abfragegrenze:** Eine Abrechnung führt je Vergabe mehrere D1-Abfragen aus (ungefähr vier bis fünf) plus etwa sechs je Aufruf. Die für das Konto geltende Grenze der Abfragen pro Aufruf ist vor dem Einsatz mit realistischer Rundengröße zu prüfen. Wird sie erreicht, bleibt der Aufruf unvollständig und kann unverändert erneut gesendet werden.
7. **Release-Nachweis:** Live-Codecommit, Worker-Version, Deployment-ID, Zeitpunkt und der Vermerk, dass Migration `0013` lief.

## Ausgeführte Prüfungen

Umgebung: Windows 11, Node 24.22.1 (Codex-Laufzeit), Abhängigkeiten über eine Verzeichnisverknüpfung auf `node_modules` des Hauptordners. `package.json` nennt dieselben Abhängigkeiten; `pnpm-lock.yaml` des Hauptordners ist älter. Die Testbefehle wurden direkt mit `node` aufgerufen, nicht über `pnpm`.

| Prüfung | Beobachtetes Ergebnis |
|---|---|
| Testdateien aus `pnpm test` | 472 von 472 bestanden |
| `node --experimental-strip-types --test tests/*.test.mjs` (90 Dateien) | 586 von 592 bestanden |
| `tsc --noEmit --incremental false` | ohne Fehler |
| ESLint auf den geänderten und neuen Dateien | ohne Befund |
| Build (`scripts/run-framework.mjs build`) | erfolgreich |
| Integrationssuite (`scripts/test-local.mjs`, isolierte lokale D1) | 2229 bestanden, 0 fehlgeschlagen, davon 78 Prüfungen zu Spielabend, Einzelvergabe und Abrechnung |

Neue Testdateien: `tests/xp-rewards.test.mjs`, `tests/xp-reward-service.test.mjs`, `tests/xp-settlement.test.mjs`, `tests/xp-settlement-receipt.test.mjs`, `tests/played-sessions.test.mjs`, Fixture `tests/fixtures/xp-reward-db.mjs`. Die Diensttests laufen gegen echtes SQLite (`node:sqlite`) mit der echten Migrationsdatei. Erweitert: `tests/character-management-integration.mjs`. Alle neuen `*.test.mjs` sind in `pnpm test` aufgenommen.

### Befunde außerhalb dieses Auftrags

- **Sechs fehlschlagende Tests** in `tests/location-dossier.test.mjs`, `tests/location-area-rich-text.test.mjs` und den NPC-Detail-Tests. Sie schlagen auf unverändertem `main` genauso fehl und stehen nicht in `pnpm test`. Die Module wurden nicht angefasst.
- **Instabile Integrationssuite:** Der lokale Testserver verliert gelegentlich die Verbindung (`fetch failed` beziehungsweise `ECONNRESET`), an wechselnden Stellen. Beobachtet: `main` Lauf 1 Abbruch nach 1216 Prüfungen, `main` Lauf 2 vollständig (2151 bestanden); Branch nach Schritt 2 Abbruch nach 1620 Prüfungen beim Profilbild-Upload, nach Schritt 3 vollständig (2206), nach Schritt 4 vollständig (2229). Die Ursache ist nicht gefunden. Ein einzelner Abbruch ist deshalb kein Beleg für einen Fehler, ein einzelner Durchlauf kein Beleg für Stabilität.

### Prüfgrenzen

- Keine Prüfung gegen die produktive Umgebung, keine Prüfung der D1-Abfragegrenze.
- Keine Browser- oder Mobilprüfung; dieser Stand hat keine Oberfläche.
- Kein Lauf mit frisch installierten Abhängigkeiten (`pnpm install --frozen-lockfile`).
- Die CI wurde für diesen Branch nicht beobachtet.

## Offene Risiken und offene Entscheidungen

- **Einzelvergabe ohne Beleg:** `xp_reward` bucht ins Ledger, schreibt aber keine Belegzeile. Eine spätere Abrechnung desselben Abends übernimmt die Buchung mit ihrer echten Buchungszeit.
- **Storno im Beleg nicht markiert:** Eine gegengebuchte Vergabe bleibt im Beleg `booked`. Das Storno steht im Ledger und im Ergebnis der Abrechnung (`reversed`), nicht beim Lesen des Belegs.
- **Registrierung braucht den Status „Abgeschlossen“:** Wird der eine wiederverwendete Sitzungseintrag für den nächsten Abend wieder geöffnet, muss der Abend davor schon registriert sein.
- **Fehlregistrierung:** Ein registrierter Abend lässt sich nicht ändern und nur löschen, solange kein Beleg daran hängt. Eine Aktion dafür gibt es nicht.
- **Teilnahme und Abwesenheit:** Story-EP für Abwesende sind gesperrt (Auslegung, nicht bestätigt). Die Obergrenze der SL-Sondervergabe ist der Altwert 1000.
- **Noch offen aus #74/#75:** MVP-Abstimmung (Stimmabgabe, Gleichstand, 1 oder 2 EP, Verhältnis zur 5-EP-Grenze), die Oberfläche der Sitzungsabrechnung im Command Center, die Spieleranzeige.
- **Nicht begonnen:** #76 (Bildschirmzeit, Engagement) und #77 (Gefallen und Schulden).

## Nächste sinnvolle Schritte

1. Unabhängiges Review dieses Branches (Codex).
2. Fachliche Entscheidungen zu MVP und zu Story-EP für Abwesende.
3. Oberfläche der Sitzungsabrechnung im bestehenden Command Center auf Basis von `played_session_register`, `xp_settlement` und dem Beleg.
