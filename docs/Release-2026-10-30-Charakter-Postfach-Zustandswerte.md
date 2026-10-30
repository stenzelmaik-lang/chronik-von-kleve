# Live-Release 30.10.2026 – Charakterverwaltung 3, Postfach 2.0, Zustandswerte am Spieltisch

Auf ausdrückliche Anweisung des Projektinhabers („wenn alles fertig ist live pushen“) veröffentlicht. Kein Merge nach `main`, keine Datenbankmigration.

## Inhalt

Branch `claude/release-charakter-postfach`, Commit `3ba4948` (Merge-Commit ohne eigene fachliche Änderungen):

| Teil | Branch / Commit | Bericht |
| --- | --- | --- |
| Charakterverwaltung 3 (Codex `cd25b96` + Überarbeitung) | `claude/charakterverwaltung-3` `a7f1653` | `docs/Spieler-und-Charakterverwaltung-3*.md` |
| Postfach 2.0 (Archiv, Papierkorb, Anhänge, Übernahme in Notizen) | `claude/nachrichten-archiv` `0c04824` | `docs/Postfach-2.0-Archiv-Anhaenge-Notizen.md` |
| Zustandswerte am Spieltisch (Blut, Willenskraft, Gesundheit, Stress, Maskerade) | `claude/spieltisch-zustandswerte` `443cbc2` | siehe Bericht im Branch |
| Spieltisch-Medien (bereits live) | `claude/spieltisch-medien` `6d0aba8` (PR #44) | `docs/spieltisch-2-0/Etappe-2-Medien.md` |

Merge-Konflikte in `package.json`, `scripts/test-local.mjs` und `message-center.tsx` wurden zusammengeführt. Das Verfassen-Ereignis akzeptiert weiterhin mehrere Empfänger (für „Nachricht an die Runde“) und nutzt die neue Entwurfslogik.

## Prüfungen vor dem Deploy

- Typecheck, ESLint und Produktionsbuild sind grün.
- `pnpm test` 190/190, dazu `live-stage` und `character-vitals` 14/14.
- Integrationsregression `scripts/test-local.mjs`: 1.968 PASS, 0 FAIL (einschließlich Charakterverwaltung, Postfach und 46 Rollenprüfungen).
- Gegen die isolierte Instanz `--zustandswerte` laufen Zustandswerte-, Regie- und Medien-Integration mit SL, Spieler A und Spieler B grün.
- Im Browser geprüft: Spielerprofil, Charakterakten und „Persönliche Nachricht“ bzw. „Nachricht an die Runde“ mit vorausgewählten Empfängern.
- Kompatibilität: Die Charakterfunktionen der Release-Version lesen alle 3 vorhandenen Live-Charaktere aus der Sicherung fehlerfrei; nur gelesen, keine Daten ausgegeben.

## Deploy

- Worker `chronik-von-kleve`, Version `c6b88d01-cb27-467e-8d0a-333503ade398`, Tag `charakter-postfach-zustand`, 100 % Verkehr.
- Bindings unverändert: D1 `chronik-von-kleve-db`, R2 `chronik-von-kleve-r2`, `AUTH_ACCESS_ENVIRONMENT=closed-alpha-production`, CPU 5000 ms, `workers_dev` an, `preview_urls` aus.
- Rückfallversion: `80c77f40-fed2-4a1a-8ae4-b011dd327795` (Szenenstart & Hintergrund).
- Sicherung vorab: Export der 32 Anwendungstabellen (23.173 Zeilen), lokal in SQLite wiederhergestellt, `integrity_check ok`. Time-Travel-Lesezeichen: `0000018c-00000c4e-00005114-d30f40e7b40fcde6cc805aaa39cd6a94`. Die Dateien liegen privat unter `.local-work/release-charakter/` (nicht im Git).
- Live-Prüfung ohne Anmeldung: `/anmelden` 200, Spielbereich und SL 307. Nachrichten, Charakter-Engine, Bühne, Datensätze und Mitglieder antworten 401 mit `private, no-store`. workers.dev 200.

## Rückfall

Keine Schemaänderung. Neue Daten liegen nur als zusätzliche JSON-Felder vor (Charakter-Ledger und -Freigaben, Postfach-Ordner, Zustandswerte).

**Vor einem Rollback zu prüfen:** Der Rückfall auf `80c77f40` ist möglich. Die alte Version ignoriert bzw. verliert dabei aber Funktionen für Datensätze, die schon mit neuen Feldern gespeichert wurden. Fix-forward ist deshalb vorzuziehen.

## Offen

- Merge nach `main` (PR #44 und die drei Branches) durch den Projektinhaber.
- Persönliche Abnahme.
- Offene Regelfragen:
  - XP-Sonderfälle der Charakterverwaltung;
  - Rituale als SL-Entscheidung;
  - sechs einstellbare Regelpunkte bei den Zustandswerten.
