# W10-Hybrid Phase B – Produktionsrelease 31.10.2026

Veröffentlicht auf ausdrückliche Freigabe des Projektinhabers („Freigabe für das Produktionsdeployment von W10 Hybrid Phase B“). Phase C und D sind **nicht** freigegeben und nicht aktiviert.

## Stand und Version

| | |
| --- | --- |
| Code | `main` `671b0e4` (Merge PR #53); inhaltlich identisch mit dem geprüften PR-Stand `8b1a48d` |
| Worker | `chronik-von-kleve`, Version **`b0f73b8b-28c9-4ba6-bb11-5395fd8226c4`**, Tag `671b0e4-W10-Phase-B`, 100 % Verkehr seit 2026-10-31T20:29Z |
| Vorversion (Rückfall) | `46c3b57d-7abd-4f86-913c-4655966f539b`, Tag `6ed3896-Visionen-Briefe` (Stand `6ed3896`) |
| Weg | bestehender manueller Prozess: Build aus `main`, Produktionskonfiguration aus den Werten der aktiven Version abgeleitet (`make-config.mjs`), `wrangler deploy --tag --message`. Kein automatisches Deployment; der Merge selbst hat keine Version erzeugt (vor dem Deploy war weiterhin `46c3b57d` aktiv). |
| Konfiguration | unverändert gegenüber der Vorversion: D1 `chronik-von-kleve-db` (`a4bc79e6…`), R2 `chronik-von-kleve-r2`, Assets, `AUTH_ACCESS_ENVIRONMENT=closed-alpha-production`, Kompatibilität `2026-09-21` mit `nodejs_compat`, CPU 5000 ms, `workers_dev` an, `preview_urls` aus. **Keine** Bindung `W10_HYBRID_PREVIEW`. |
| Datenbank | **keine Migration** (keine Änderungen an `drizzle/`, Schema oder Wrangler-Konfiguration zwischen `6ed3896` und `671b0e4`). M2 und M6 nicht ausgeführt. |

## Prüfungen vor dem Deploy (auf `671b0e4`)

| Prüfung | Ergebnis |
| --- | --- |
| Typecheck | bestanden |
| Standardlauf (`npm test`) | 290/290 bestanden |
| Vollständige HTTP-Integration (`test:integration:run`, wie der Workflow auf `main`) | 1.930 Prüfungen + 46 D1-Rollenprüfungen bestanden, Exit 0 |
| Produktionsbuild | bestanden |
| GitHub-Checks | Der Workflow `story-editor-checks.yml` hätte auf dem Push nach `main` laufen sollen. Sein Ergebnis konnte ich nicht lesen (keine GitHub-CLI, privates Repository); dieselben Schritte habe ich deshalb lokal ausgeführt (siehe oben). |

## Sicherung vor dem Deploy

- D1-Time-Travel-Lesezeichen: `0000019b-00001236-00005115-e4a2f13b038aaeee652db7704e03f987`
- D1-Export der 32 Anwendungstabellen (wie bei den Vorreleases; die FTS-Tabelle `codex_fts` ist nicht exportierbar und lässt sich aus `codex_sections` neu aufbauen): 29.072 Zeilen, SHA-256 `ad2cc4475b8feb3dbe26b1f47417f5053c49593f9b6e49fbd5c3e972c8966bee`. Lokal in SQLite wiederhergestellt: `integrity_check ok`. `foreign_key_check` meldet die bekannte, vorbestehende Schema-Eigenheit „foreign key mismatch“ bei `entities(campaign_id,id)`.
- Ablage privat (nicht im Repository): `.local-work/release-w10-phase-b/` im Release-Worktree `cvk-w10-release`.

## Prüfung nach dem Deploy (ohne Anmeldung, ohne Schreibzugriffe)

Auf `https://chroniplay.cc` und `https://chronik-von-kleve.stenzel-maik.workers.dev` mit identischen Ergebnissen:

- `/anmelden` liefert 200. Spielbereich, Command Center (Charaktere) und Regie leiten mit 307 weiter.
- `/api/character-engine`, `/api/records`, `/api/live-table`, `/api/messages`, `/api/character-selection` liefern 401 mit `private, no-store`.
- **Hybrid-Würfelvorschau deaktiviert:** `POST /api/w10-preview` liefert anonym **404**. Wäre die Route aktiv, käme wie in der lokalen Testinstanz 401.
- Der neue Client-Stand wird ausgeliefert: Das Bundle mit dem Hinweis „Vorbereitung für das Hybrid-Würfelsystem …“ und das Pager-/Spieltisch-Bundle liefern 200.

**Nicht geprüft durch Claude Code:** Funktionen, die eine Anmeldung brauchen (Charakterbogen, Spezialisierungen, eigene Fähigkeiten, ULTIO-Pager, Spieltisch). Mit echten Zugangsdaten meldet sich Claude Code nicht an. Lokal wurden sie mit dem identischen Code geprüft (Integration SL/A/B, Browsertest der Charakterverwaltung, Pager- und Zustandswerte-Integration).

### Kurzprüfung mit Anmeldung (Projektinhaber)

1. SL-Konto → Command Center → Spieler & Charaktere → ein Charakter → „Bogen ansehen“: Der Bogen lädt, Werte unverändert.
2. Verwaltung → „Bogen bearbeiten“ → Bereich „Fähigkeiten“: Bei „Spezialisierungen“ und „Zusätzliche Fähigkeiten“ steht der Hinweis „Vorbereitung für das Hybrid-Würfelsystem …“. **Abbrechen, nicht speichern**, sofern keine echte Änderung gewollt ist.
3. Spieltisch/Regie: Abend öffnen, ULTIO-Pager und Würfel wie gewohnt nutzbar.
4. Bei Auffälligkeiten: Rückfall wie unten.

## Rückfall

- **Code:** `wrangler rollback 46c3b57d-7abd-4f86-913c-4655966f539b --name chronik-von-kleve`. Keine Schemaänderung, deshalb voll kompatibel.
- **Daten:** Neue Bogenfelder (`specialties`, `id`/`category`/`active` bei eigenen Fähigkeiten) bleiben nach einem Rückfall gespeichert. Die Vorversion zeigt sie nicht an und behält sie beim Speichern über den Bogeneditor (`edit_sheet`). Die allgemeine Records-Route der Vorversion würde dagegen `id` und `active` eigener Fähigkeiten entfernen bzw. bestätigte Bögen mit solchen Einträgen nicht speichern (Befund F1 aus `PR-53-PRUEFUNG.md`). **Bei einem Rückfall daher Fix-forward bevorzugen.**
- **Datenbank-Wiederherstellung** nur im Notfall und nach Rücksprache: Time-Travel-Lesezeichen oben oder Export. Beides setzt alle Änderungen seit 20:29Z zurück.

## Weiterhin nicht freigegeben

Phase C/D (Stress- und Hungerwirkung, echte Hybrid-Würfe, Ressourcenbuchung), Aktivierung der Würfelvorschau, Migrationen M2 (Blut → Hunger) und M6 (eigene Fähigkeiten ohne ID), NSC-Würfelweg.
