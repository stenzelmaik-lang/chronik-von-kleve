# GE-02 – Release-Abschluss: Charakterproben für eine geschützte Live-Alpha

**Stand:** 1. November 2026 · **Status:** Release-Kandidat, lokal geprüft, **wartet auf die Release-Entscheidung der Projektleitung**. Kein Push, kein Merge, kein Deployment, keine Migration, keine Produktivdaten berührt.

## 1. Release-Kandidat

| | |
|---|---|
| Release-Commit | **`bc181365901ea0531f73334bdd8d893a43ffc65f`** auf `claude/ge-01c-ux` (Worktree `C:\Users\Stenz\Documents\ChroniPlay-Claude\cvk-ge01c`). Danach folgt nur der Doku-Commit dieses Berichts |
| Getesteter Build | lokal aus `bc18136`, `BUILD_ID 699f0b1c-abdf-41a6-a726-dec41cdd075c`; ausgelieferter Chunk `ultio-pager-CcO61g5w.js` (enthält Schalter und Proben-UI), MD5 `24d7b3076156f91fe0963637b631d111`, von Server und `dist` identisch |
| Basis | `origin/main` = `0f4f3fe` (PR #68), am 1.11. per `git fetch` abgeglichen. `0f4f3fe` ist Vorfahre des Branches, ein Merge ist **konfliktfrei (Fast-Forward)**. 17 Commits seit `main`, darunter GE-01 und GE-01B aus Codex |
| Live heute | Worker `2371bc92-e0a5-459a-90f2-e7d5cd4ab995`, Code `c768189` (Whiteboard 2.0). `0f4f3fe` unterscheidet sich davon nur durch Doku. Dokumentierte Rückfallversion vor Whiteboard 2: `190dac20-…` |
| Datenbank | **keine Migration**, kein Schema- oder `drizzle/`-Eintrag geändert |

## 2. Eingefrorener Funktionsumfang

- Vorbereitete Proben aus der Szenenvorbereitung, mit Ein-Klick-Ausgabe bei hinterlegten Figuren
- Spontane Proben aus der Live-Regie (mindestens Figur und SG)
- Aktive Wahl oder Bestätigung der Eigenschaften durch den Spieler im eigenen Bogen
- Serverseitige V20-Berechnung über den bestehenden Regelkern
- Gemeinsame Three.js-/Rapier-Darstellung
- Ergebnis und vorbereitete Folgen für die SL
- Geschützte Speicherung und Replay

Es kamen keine neuen Funktionen hinzu.

## 3. Abschlussarbeiten in diesem Auftrag

**GE-01C-Restmängel**
- Gesperrte Probe: Statt „Pool wird berechnet“ steht jetzt „kein Wurf möglich“ (Bild 12).
- Mehr-SL:
  - Der Server erkennt Kampagnen-SL über die Mitgliedschaftsrolle. Nur SL-Ansichten erhalten die Markierung `gm`, die Rolle selbst wird aus der Teilnehmerliste entfernt.
  - Eine zweite SL ist nie Ziel einer Probe, weder in der Oberfläche noch serverseitig in Zielgruppe oder Zielfigur.
- Mobil: Die Bogenschublade beginnt unter der umbrechenden Aktionsleiste und rechts der Werkzeugleiste. Es gibt keine Überlagerung mehr, und die Animation ist angepasst (Bild 11).
- Vertrauliche Daten, alles serverseitig:
  - Spieler erhalten keine anderen Adressaten.
  - Spieler erhalten keine Zielfiguren, Vorbereitungsherkunft, Folgen oder SL-Hinweise.
  - Spieler erhalten keine Szenen-IDs und keine Mitgliedschaftsrollen.

**Vorschau ohne Draft-Route**
- Die Poolvorschau für Live-Proben läuft über die neue, rein lesende Aktion `previewCheck` auf dem geschalteten Live-Pfad.
- Sie gilt nur für eine ausgegebene, aktive und an diesen Spieler adressierte Probe; die SL-Vorgabe ist bindend.
- Die W10-Draft-Route `/api/w10-preview` bleibt unverändert lokal (Test B09).

**Geschützte Aktivierung (Feature-Schalter)**, Abschnitt 5.

**Rückfallhilfe**, Abschnitt 7: `scripts/ge02-rollback-scene-checks.mjs`.

**CI-Abdeckung**
- `pnpm test` enthält jetzt die GE-01C- und GE-02-Unit-Tests (337 Tests).
- Die ESLint-Liste der CI umfasst die neuen Regel- und Serverdateien.

## 4. Pflichtprüfungen (beobachtet am Release-Kandidaten)

| Prüfung | Ergebnis |
|---|---|
| TypeScript `tsc --noEmit` | 0 Fehler |
| Produktionsbuild (lokal) | bestanden |
| `pnpm test`-Satz (CI) | **337/337** |
| Alle `tests/*.test.mjs` + Prototyp | **526/527**. Einziger Fehlschlag ist der Altfehler `npc-data.test.mjs`: nicht in `pnpm test`, auf der Basis 38e8c75 identisch, nicht verändert |
| W10-Regeltests (`test:w10-hybrid`-Satz) | **82/82**. Bestehende V20-Regeln und Modifikatoren unverändert, B09 (Draft-Route lokal) grün |
| CI-ESLint-Liste inkl. neuer Dateien | 0 Befunde |
| Volles Repository-ESLint | 12 Fehler, 18 Warnungen. Das ist exakt die dokumentierte Altlast; keine davon in geänderten Dateien |
| `tests/ge-01-integration.mjs` | PASS: Rechte, private Hinweise, Zielgruppe, Serverpool, V20, Replay ohne Neuwurf, **Doppelwurfschutz** |
| `tests/ge-02-integration.mjs` | PASS. Abgedeckt: Zielfiguren mit Figurenbindung; Zielgruppe und Figuren schließen sich aus; nur SL gibt aus; Folgen und IDs nicht bei Spielern; `previewCheck` nur für Adressierte (A 404, SL 403, Vorgabe bindend, aus → 409); gleicher Pool für Vorschau, vorbereitet und spontan; keine Rollen, Markierungen oder Szenen-IDs bei Spielern; **Schalter** nur SL, nur laufender Abend, aus ohne neue Proben, Würfe und Vorschau, **gespeicherte Würfe vor, während und nach dem Ausschalten byte-gleich** |
| `tests/w10-hybrid-integration.mjs` | PASS (Phase B unverändert: Stress nur Anzeige, ohne Wirkung) |
| `tests/ge-02-browser.mjs` (Edge, SL + Spieler A + B parallel + mobil) | **12/12 Phasen**, keine Seitenfehler |

Der Browserlauf prüft im Einzelnen:
- Die SL hinterlegt in der Szenenvorbereitung Figur A und speichert. Die Regie gibt mit **einem Klick** aus. Der Schalter ist sichtbar und an.
- A bestätigt im eigenen Bogen; Serverpool und Anzeige stimmen überein. Es entsteht genau ein Wurf, und die vorbereitete Folge erscheint in der Regie.
- Nach Reload gibt es keine Althinweise. Replay zeigt dieselben Würfel ohne Neuwurf.
- Eine spontane Probe an die ganze Runde ergibt „1 von 2“. Eine spontane Probe mit nur Figur B und SG 5 erreicht B.
- Mobil 390 × 844 ohne Überlauf.
- Die V20-Sperre für eine Kenntnis ohne Wert greift.
- Rechte: B sieht A's Wurf nicht, Folgen bleiben privat.

Handrechnung des letzten Laufs: 3 W10 (Geschick 3 + Diebstahl 0) gegen SG 8 (7 +1 ungelernt) mit 9, 8, 3 ergibt 2 Erfolge und keine Eins, also **Erfolg, 2**, wie angezeigt.

Screenshots aus dem Release-Build: [`docs/qa/ge-02-release/`](../qa/ge-02-release/) (00 Szenenvorbereitung bis 12 V20-Sperre; 01 zeigt den Schalter).

## 5. Nachweis der Feature-Schalter

Die Logik steckt in `checksAvailable` und `checksActive` in `domain/live-checks.ts` und wirkt serverseitig an allen Eintrittspunkten:
- Befehle `requestCheck`, `rollCheck`, `previewCheck`, `setChecks`
- Stage-Projektion
- Regie-Oberfläche

| Ebene | Wirkung |
|---|---|
| **A – Allowlist** `GE01_ALPHA_CAMPAIGNS` (Worker-Variable, Komma-Liste) | Nur ausdrücklich genannte Kampagnen-IDs; `*` wird ignoriert. **Ohne Variable ist alles aus**: Befehle 404, keine Proben-UI, kein Schalter |
| **B – SL-Schalter** pro Spielabend (Regie → Proben → „Charakterproben an diesem Abend“) | Gespeichert als `room.checks={runId,on}`, ohne Migration. Wirkt nur für den laufenden Abend. Ein **neuer Abend startet immer aus** |
| Lokale Testinstanz (`GE01_CHECKS=local-only` + `AUTH_ACCESS_ENVIRONMENT=local-test`) | Standardmäßig an, per SL-Schalter abschaltbar. Das lokale Flag allein öffnet nie die Produktion (Unit-Test) |

Aus heißt:
- Offene Proben verschwinden.
- Neue Proben, Würfe und Vorschauen werden mit 409 abgelehnt.
- **Gespeicherte Würfe bleiben unverändert im Würfelprotokoll**, im Integrationstest byte-gleich geprüft.
- Der freie V20-Wurf funktioniert unabhängig davon weiter.

## 6. Freigabeplan (Vorschlag)

1. **Freigabe** durch die Projektleitung: PR von `claude/ge-01c-ux` nach `main`. Die CI muss grün sein („Project CI and W10 checks“).
2. **Sicherung** der Produktions-D1 vor dem Deployment, wie beim Whiteboard-Release: Export und `integrity_check`.
3. **Deployment ohne `GE01_ALPHA_CAMPAIGNS`.** Die Proben sind damit überall aus. Smoke-Test:
   - `/anmelden` antwortet mit 200.
   - Spieltisch, freier Wurf und Regie funktionieren.
   - `requestCheck` antwortet mit 404.
4. **Optional, empfohlen:** Allowlist zuerst nur mit einer synthetischen Testkampagne. Darin läuft der Ablauf aus Abschnitt 4 mit SL- und Spielerkonten (Desktop und echtes Telefon).
5. **Alpha:** Die Kampagnen-ID der ausgewählten echten Runde wird in `GE01_ALPHA_CAMPAIGNS` eingetragen; das erzeugt eine neue Worker-Version ohne Codeänderung. Die SL schaltet die Proben nur am vereinbarten Abend ein.
6. **Release-Nachweis** in `docs/`: Live-Commit, Worker-Version, Deployment-ID, Zeitpunkt, keine Migration.

**Testablauf am Alpha-Abend** (Kurzfassung):
1. SL schaltet ein.
2. Vorbereitete Probe mit einem Klick ausgeben.
3. Spieler öffnet den Bogen oben, bestätigt und würfelt.
4. SL sieht Ergebnis und Folge.
5. Spontane Probe mit Figur + SG ausgeben.
6. Reload ohne Althinweise prüfen.
7. Am Ende ausschalten und prüfen, dass das Würfelprotokoll vollständig bleibt.

## 7. Datenrisiken und Rückfallplan

| Risiko | Bewertung und Maßnahme |
|---|---|
| Neue JSON-Felder | `room.checks`, Probenereignisse mit `targetCharacterIds`, `consequences` und `preparedId`, Szenenbaustein `check`. Alles liegt im vorhandenen JSON, ohne Migration |
| **Rollback des Workers auf eine Version vor GE-02** | Ältere Builds parsen Szenen **strikt**. Ist eine Szene mit strukturierter Probe (`check`) gespeichert, antwortet der alte Build für diese Szene **und für die Szenenliste der Kampagne** mit 409. Die Daten bleiben erhalten, sind dort aber nicht nutzbar. **Maßnahme:** vor einem Worker-Rollback `scripts/ge02-rollback-scene-checks.mjs` ausführen. Es liest einen D1-JSON-Export und **erzeugt nur SQL**: versionsgesicherte Updates, die Werte und Folgen verlustfrei als Freitext in den Baustein schreiben. Getestet in `tests/ge-02-rollback.test.mjs`. Die Ausführung auf Produktion braucht eine eigene Freigabe |
| Die Szenenvorbereitung zeigt die neuen Probenfelder **auch ohne Allowlist** | Die SL kann strukturierte Proben speichern, bevor die Alpha läuft. Das schadet nichts, verschärft aber das Rollback-Risiko oben. **Empfehlung:** strukturierte Probenfelder erst nach der Smoke-Phase nutzen |
| Für alle sichtbar, unabhängig vom Schalter | Ruhigere Würfelansicht; nach Reload keine alten offenen Würfe mehr als Hinweis (stehen weiter im Würfelprotokoll); mobile Schubladenposition |
| Würfel und Ergebnisse | Werden nie umgeschrieben. Der Regelkern ist unverändert. Nicht freigegebene Modifikatoren (Hunger, Stress, Gruppenstress, Maskerade, Szenenbedingung, Willenskraft) sperren den Wurf, statt still mitzuwirken |

**Rückfall in drei Stufen**
1. **Sofort, am Abend:** SL schaltet die Proben aus; die Runde würfelt frei weiter.
2. **Betrieb:** `GE01_ALPHA_CAMPAIGNS` leeren. Das erzeugt eine neue Worker-Version mit identischem Code und schaltet die Proben für alle aus.
3. **Notfall bei Fehlern außerhalb der Proben:** zuerst prüfen, ob Szenen strukturierte Proben enthalten. Falls ja, Rückfallskript mit Freigabe anwenden. Danach `wrangler rollback` auf `2371bc92`. Ohne Migration gibt es keinen Datenrückbau.

## 8. Verbleibende Einschränkungen

1. Keine Prüfung auf einem **echten Mobilgerät**; mobil geprüft wurde nur per Browser-Emulation 390 × 844.
2. **Keine Cloudflare-Laufzeitprüfung** dieses Stands. Geprüft wurde lokal mit wrangler, D1 und R2 lokal. Abhilfe ist Schritt 4 des Freigabeplans.
3. Der Lesestatus von Probenhinweisen gilt pro Tab (`sessionStorage`). Auf einem neuen Gerät erscheint ein Hinweis für eine noch offene Probe einmal erneut.
4. Die mobile Aktionsleiste zeigt beim Öffnen per Tastaturfokus kurz den Tooltip „Menü nach oben schließen“. Das ist Bestandsverhalten.
5. Altfehler außerhalb des Auftrags: `npc-data.test.mjs` und 12 ESLint-Fehler in unveränderten Dateien.
6. Die Kampagnen-ID der Alpha-Runde liegt nicht vor und wird bei der Freigabe benannt. Produktionsdaten wurden nicht gelesen.

## 9. Aussage zur Verantwortbarkeit

**Eine geschützte Live-Alpha ist verantwortbar**, wenn vier Bedingungen erfüllt sind:
1. Deployment zunächst **ohne Allowlist**, mit Smoke-Test.
2. Sicherung vorab.
3. Freischaltung nur für **eine** benannte Runde, durch die SL **pro Abend**.
4. Strukturierte Probenfelder erst nach der Smoke-Phase nutzen, oder das Rückfallskript bereithalten.

Begründung:
- Die Rechte werden serverseitig durchgesetzt; der Pool kommt ausschließlich vom Server.
- Doppelwurf- und Replay-Schutz sind belegt.
- Nicht freigegebene Regeln sind gesperrt.
- Das Ausschalten beschädigt keine gespeicherten Ergebnisse.
- Es gibt keine Migration.

Nicht verantwortbar wäre es, die Allowlist ohne vorherigen Smoke-Test zu setzen oder einen Worker-Rollback ohne Szenenprüfung auszuführen.

**Ausdrücklich nicht getan:** kein Push, kein PR, kein Merge, kein Deployment, keine Variable in Cloudflare gesetzt, keine Migration, keine Remote-D1-Befehle, keine neuen Funktionen und keine neue Game-Engine-Phase. Gelesen wurde nur `origin/main` per `git fetch`.

## 9. Release-Nachweis: Schritte 1–3 des Freigabeplans (1. November 2026)

- **Freigabe:** Die Projektleitung hat die kontrollierte Veröffentlichung gestartet. PR #69 ist als `4195929` gemergt.
- **CI grün:** „Project CI and W10 checks“ (Frozen install, types, lint, tests, build sowie der Windows-Würfeltest) und „Command Center – Story Editor checks“ (Typecheck, Lint, Tests, Build sowie der SL-Browserdurchlauf). „Workers Builds“ ist wie immer rot, weil die Cloudflare-Vorschau pausiert ist.
- **Sicherung vor dem Deployment:**
  - 32 Tabellen, 34.830 Zeilen, `integrity_check ok`.
  - Lesezeichen `000001a2-00010ad5-00005116-d8158c8559cf6f583a5d00ad6f2003ee`.
  - Ablage: privat unter `.local-work/release-ge02/`.
- **Deployment ohne `GE01_ALPHA_CAMPAIGNS`:**
  - Worker `875bb0e3-9e64-4ca6-8e3c-a77fd3f0614c`, Tag `4195929-GE02-aus`.
  - Die Variablen bestehen nur aus `AUTH_ACCESS_ENVIRONMENT=closed-alpha-production`; Bindings unverändert.
  - Keine Migration.
- **Rückfallversion:** `2371bc92-e0a5-459a-90f2-e7d5cd4ab995` (Whiteboard 2.0). Vorher die Rollback-Hinweise in Abschnitt 7 beachten.
- **Smoke-Test ohne Anmeldung:**
  - `/anmelden` antwortet mit 200.
  - Spielbereich, Command Center und Regie leiten mit 307 weiter.
  - Bühne, Spieltisch, Dateien und Inventar-Material antworten mit 401.
- **Smoke-Test mit dem SL-Konto am laufenden Abend:**
  - Der Snapshot meldet `checksEnabled: false`.
  - `requestCheck` antwortet mit **404**.
  - Am Tisch gibt es keine Proben-Oberfläche; der freie Würfelknopf ist vorhanden.
  - Die Regie ist „Live verbunden“, ohne Proben-Schalter.
  - Keine Fehlermeldungen.
- **Offen** (Schritte 4–6 des Freigabeplans):
  - Testkampagne oder echte Runde in `GE01_ALPHA_CAMPAIGNS` eintragen; das erzeugt eine neue Worker-Version ohne Codeänderung.
  - Den Ablauf mit SL- und Spielerkonten prüfen, auch auf einem echten Telefon.
  - Dann die Alpha am vereinbarten Abend einschalten.

## 10. Alpha-Freischaltung „Chronik von Kleve“ (1. November 2026)

- **Freigabe:** Die Projektleitung hat die Runde „Chronik von Kleve“ ausgewählt (Kampagnen-ID `chronik-von-kleve`). Schritt 4, eine synthetische Testkampagne in Produktion, wurde damit bewusst übersprungen.
- **Worker:** Neue Version `89105921-459d-477d-b5bc-9cac5ee2d7c3`, Tag `4195929-GE02-Alpha-CvK`. Code identisch mit `875bb0e3`, nur die Variable `GE01_ALPHA_CAMPAIGNS=chronik-von-kleve` ist hinzugekommen. Bindings unverändert.
- **Live geprüft mit dem SL-Konto am laufenden Abend:**
  - Der Snapshot meldet `checksSwitch: {on:false}` und `checksEnabled: false`.
  - In der Regie unter „Proben“ steht „Charakterproben an diesem Abend – Ausgeschaltet. Die Runde würfelt wie gewohnt frei.“
  - Es gibt keine offenen Proben. Der Schalter wurde **nicht** eingeschaltet.
- **Abschalten, gestaffelt:**
  1. Am Abend den SL-Schalter auf „Aus“ stellen.
  2. Für den Betrieb die Version `875bb0e3` (gleicher Code, ohne Alpha-Liste) wiederherstellen oder ohne Variable neu ausrollen.
  3. Im Notfall die Schritte aus Abschnitt 7.
- **Offen:** Prüfung auf einem echten Telefon und der erste Alpha-Abend nach dem Ablauf in Abschnitt 6.