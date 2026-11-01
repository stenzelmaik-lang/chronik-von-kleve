# GE-01C – UX-Korrektur, Versionsabgleich, Vorbereitung Live-Alpha

**Stand:** 1. November 2026 · **Status:** lokal, zur Abnahme durch die Projektleitung. Kein Push, kein Merge, kein Deployment, keine Migration, keine produktiven Daten.

| | |
|---|---|
| Branch | `claude/ge-01c-ux` (Worktree `C:\Users\Stenz\Documents\ChroniPlay-Claude\cvk-ge01c`) |
| Basis | GE-01B `38e8c7519a524cada33e57e406999b01c0af9903` (Codex-Branch `codex/ge-01b-live-regie-ux`, lokal importiert als `codex-import/ge-01b`) |
| Getesteter Code-Commit | `cf2c45fb0af5d39b5df50ee534373f01d4b5af75` |
| Build | `BUILD_ID 5756d686-6474-49b5-9401-13c0c235d065`, ausgelieferter Chunk `workspace-B_zN9zcx.js`, MD5 `9fe5046c48b974cf0787a5c6fc4f72b6` (Server und `dist` identisch) |
| Lokale Instanz | `http://127.0.0.1:8898/anmelden`, `scripts/test-local.mjs --ge-01` mit `CVK_TEST_PORT=8898`, eigener synthetischer Speicher `.local-test/ge-01` im Worktree |
| Konten | `command-gm@example.invalid` (SL), `command-a@…`, `command-b@…` (Spieler), synthetisches Demo-Passwort wie in `tests/ge-01-integration.mjs` |
| Live-Alpha | Konzept in [GE-01C-LIVE-ALPHA-KONZEPT.md](GE-01C-LIVE-ALPHA-KONZEPT.md) |

## 1. Versionsabgleich (vor jeder Änderung)

| Frage | Befund |
|---|---|
| Prozess auf Port 8895 | PID 3768, `node scripts/test-local.mjs --ge-01`, gestartet am 1.11. um 16:37:30 aus einer Codex-PowerShell |
| Worktree und Commit | `…\Codex\2026-10-31\chroniplay-w10-hybrid-phase-c0-verbindliches\work\ge-01-character-dice`, Branch `codex/ge-01b-live-regie-ux` @ `38e8c75`, Worktree sauber |
| Ausgelieferter Build | `dist` von 16:37:15 (`BUILD_ID a727f2ab-…`). Alle 20 Quelldateien des GE-01B-Diffs sind älter als der Build, der Commit folgte um 16:39 ohne weitere Änderung. Der ausgelieferte Chunk `workspace-BaHjWGTF.js` ist per MD5 identisch mit `dist` |
| Screenshots GE-01B | Entstanden um 16:38 mit `work/ge01b_browser_review.py` gegen genau diese Instanz. Sie stimmen mit dem Build überein |
| Veraltete Bundles, Cache, andere UI-Version | **Keine.** Die beanstandeten Eindrücke sind echte UX-Fehler des Stands 38e8c75 |

Die Abweichungen stammen aus zwei Quellen:
- **Testdaten mit Kennungen:** Das Prüfskript benannte Proben `GE-01B … <uuid-Präfix>`. Dazu kam ein dauerhafter Speicher mit 18 Würfen aus wiederholten Läufen.
- **Lebenszyklusfehler im Code:** Jeder gespeicherte, nicht von der SL „für alle“ geschlossene Wurf galt clientseitig als „offen“. Daraus entstand nach jedem Laden eine Warteschlange („Neuer Wurf … anzeigen (15)“, „Offener Wurf …“). Der Probenhinweis kannte nur die jeweils neueste Probe, und Debugtexte erschienen in der Würfelansicht.

## 2. Änderungen

**Begriffe.** In der normalen Oberfläche stehen jetzt Charakterprobe, Neue Probe, Probe ausstehend, Würfeln, Ergebnis ansehen, Wurf abgeschlossen und Würfelprotokoll. Entfernt sind „GE-01 · lokaler Prototyp“, „Probenanforderung“, „Bogen-Version“, „Bleibt bis zur manuellen Aktion offen“, „Sitzungsprotokoll“ und „Offener Wurf“. Auch die Servermeldung ohne „GE-01“ ist umformuliert. IDs, `checkRef`, Regel- und Bogenversion bleiben in den Ereignissen unverändert.

**Lebenszyklus** (`domain/live-checks.ts`, `dice-inbox.mjs`)
- Ein gespeicherter Wurf ist endgültig. Ob eine Ansicht offen ist, entscheidet nur der jeweilige Client.
- Beim Laden oder nach einem Reconnect gelten alle vorhandenen Würfe als bekannt. Nur eine im selben Tab noch geöffnete Ansicht kehrt zurück, ohne Animation.
- Hinweise erscheinen nur für Würfe, die während der Sitzung neu eintreffen. Nach Ansehen oder Schließen verschwinden sie.
- Eine Probe ist pro Ziel „ausstehend“, bis ein Wurf mit ihrer `requestId` existiert. SL und Spieler leiten das aus denselben Serverdaten ab und sind damit synchron.
- Ein neuer Probenhinweis erscheint einmal pro Probe. Nach dem Lesen bleibt nur die Marke „Probe ausstehend“ am eigenen Namen.
- Beim Wiederöffnen aus dem Protokoll wird nie neu gewürfelt.

**SL-Regie**
- Neuer Bereich **„Proben“** direkt nach „Interaktion“, im Zweitfenster und in der Tisch-Regie. Er trägt eine Zählmarke für noch ausstehende Würfe.
- Der Bereich enthält „Neue Probe“ und die Liste „Laufende Proben“ mit Status pro Person und Figur sowie „Ergebnis · ansehen“.
- Vorbereitete Szenenproben (Szenenbaustein `check`) erscheinen als Chips. Ein Klick übernimmt Titel, Attribut, Fähigkeit und SG aus dem Wortlaut, etwa „Geschick + Taschendiebstahl (7)“. Danach wählt die SL nur noch, wer würfelt. Erkannt wird nur eindeutig Geschriebenes; die SL bestätigt mit „Probe ausgeben“.
- „Wer würfelt?“ wird als Chips gewählt: „Ganze Runde“ oder einzelne Spieler mit Figurname.
- Der SL-Hinweis ist privat und standardmäßig eingeklappt.
- Fehler aus GE-01B behoben: Die Spielleitung zählte in der Tisch-Regie als Zielperson („0 von 3“).
- Die Serverautorisierung (`requestCheck` nur SL, `rollCheck` nur adressierte Spieler mit eigener aktiver Figur) ist unverändert.

**Spieler**
- Die Probe liegt im **eigenen Charakterbogen am oberen Spieltischrand**: eigener Name → Charakterbogen, dieselbe Schublade und derselbe `CharacterReadOnly` wie bisher. Es gibt keine zweite Bogenverwaltung.
- Zugang über die Marke „Probe ausstehend“ unter dem eigenen Namen oder über „Würfeln“ im Hinweis.
- Ein kompakter Streifen zeigt den Status, die Schritte „Attribut“ und „Fähigkeit“ als Häkchen, den Serverpool („3 W10 · SG 8“ mit Herkunft der Werte) und genau eine Aktion.
- Werte werden im Bogen angetippt. Die SL-Vorgabe leuchtet, die bestätigte Wahl ist gefüllt. Nach dem Wurf ist die Auswahl gesperrt. Spezialisierungen erscheinen nur, wenn sie anwendbar sind.
- Den Pool berechnet `/api/w10-preview`. Der Client sendet beim Würfeln nur die Auswahl, keinen Pool, keine Würfel und keine Schwierigkeit.
- Die Würfelschublade enthält nur noch einen Verweis auf die Probe, den freien Wurf und das **Würfelprotokoll**.

**Darstellung**
- Die Würfelansicht zeigt „Titel · Person“, „3 W10 SG 8“ und darunter „Fehlschlag · 0 Erfolge“, ohne Hilfetexte.
- Die 3D-Würfelanimation (`dice-webgl.mjs`) ist unverändert.
- Bei einer gezielt geöffneten Probe klappt die Leiste des eigenen Namens nach dem Wurf weg, damit das Ergebnis frei bleibt.

**Testdaten:** Die synthetische Kaserne hat zwei vorbereitete Proben, passend zur vorhandenen Tabelle: „Dienstbuch durchsuchen“ und „Schlüsselbund stehlen“. Andere Demos mit diesem Fixture zeigen damit zwei zusätzliche Interaktionsnotizen.

## 3. Prüfungen (beobachtete Ergebnisse)

| Prüfung | Ergebnis |
|---|---|
| TypeScript `tsc --noEmit` | 0 Fehler |
| ESLint, geänderte und neue Dateien | 0 Fehler, 0 Warnungen |
| Produktionsbuild (lokal) | bestanden |
| `tests/ge-01c-check-lifecycle.test.mjs` (neu) | 7/7 |
| Alle `tests/*.test.mjs` + `prototypes/spieltisch-2/*.test.mjs` | 517/518. Einziger Fehlschlag: `npc-data.test.mjs` „NPC workspace uses read panel …“. Er schlägt auf der Basis 38e8c75 identisch fehl und gehört **nicht zu `pnpm test`**. Befund, nicht geändert |
| `tests/ge-01-integration.mjs` gegen 8898 | PASS: nur SL gibt aus, privater Hinweis, Zielgruppe, Serverpool, V20, Replay, Doppelschutz, untrainierte Fertigkeit +1 SG |
| `tests/ge-01c-browser.mjs` (neu, Edge headless, SL + A + B parallel) | 10/10 PASS, keine Seitenfehler |

Der Browserlauf bestätigt:
- Vorbereitete Probe mit einem Klick ausgegeben (Geschick + Diebstahl, SG 7).
- Zählmarke 1 in der Regie, Hinweis nur bei A, keine IDs auf A's Tisch.
- A bestätigt beide Vorgaben im eigenen Bogen. Der angezeigte Pool von 3 W10 ist gleich dem Serverpool, SG 8 wegen untrainierter Fertigkeit.
- Genau ein Wurf gespeichert. Die Würfelwerte der Anzeige sind gleich den gespeicherten. Die Regie springt ohne Neuladen auf „Wurf abgeschlossen“.
- Nach Schließen und Neuladen bei A und B: kein Altergebnis, kein „Neuer Wurf“, kein Probenhinweis.
- Replay aus dem Würfelprotokoll zeigt dieselben Würfel und erzeugt keinen neuen Wurf.
- Spontane Probe aus der Tisch-Regie an die ganze Runde: B wählt frei Geschick + Handgemenge, die Regie zeigt live „1 von 2 gewürfelt“.
- Mobil 390 × 844: Probe im Bogen bedienbar, kein horizontaler Überlauf.
- Kenntnis ohne Wert wird vom Server mit V20-Begründung gesperrt, „Würfeln“ bleibt inaktiv.
- B sieht weder A's gezielten Wurf noch den privaten SL-Hinweis.
- Handrechnung des letzten Laufs: 3 W10 gegen SG 8 mit 1, 5, 6 ergibt keinen Erfolg bei einer Eins, also **Patzer**, wie angezeigt.

Screenshots aus dem getesteten Build (`docs/qa/ge-01c/`):
[01 Regie Proben](../qa/ge-01c/01-regie-proben-vorbereitet.jpg) · [02 ausgegeben](../qa/ge-01c/02-regie-probe-ausgegeben.jpg) · [03 Spieler neue Probe](../qa/ge-01c/03-spieler-neue-probe.jpg) · [04 Bogen, Auswahl, Pool](../qa/ge-01c/04-spieler-bogen-auswahl-pool.jpg) · [05 Wurf](../qa/ge-01c/05-spieler-wurf-ergebnis.jpg) · [06 Regie nach Wurf](../qa/ge-01c/06-regie-wurf-abgeschlossen.jpg) · [07 nach Reload ruhig](../qa/ge-01c/07-spieler-nach-reload-ruhig.jpg) · [08 Würfelprotokoll](../qa/ge-01c/08-wuerfelprotokoll.jpg) · [09 B freie Wahl](../qa/ge-01c/09-spieler-b-freie-wahl.jpg) · [10 Tisch-Regie 1 von 2](../qa/ge-01c/10-tischregie-teilweise-gewuerfelt.jpg) · [11 mobil](../qa/ge-01c/11-mobil-probe-im-bogen.jpg) · [12 V20-Sperre](../qa/ge-01c/12-v20-sperre-kenntnis-ohne-wert.jpg)

## 4. Abnahmekriterien

| # | Kriterium | Nachweis |
|---|---|---|
| 1 | Build eindeutig identifiziert, Screenshots passen | Commit, BUILD_ID und Chunk-MD5 oben. Screenshots aus diesem Lauf |
| 2 | Probe aus der Live-Regie leicht auffindbar | Eigener Bereich „Proben“ mit Zählmarke (01, 02, 10) |
| 3 | Bogen an der vorgesehenen Stelle | Eigener Name oben → Charakterbogen (03, 04, 11) |
| 4 | Spieler wählt bzw. bestätigt erkennbar selbst | Leuchtende Vorgabe, gefüllte Wahl, Häkchen-Schritte (04, 09) |
| 5 | Pool serverseitig korrekt | Browser: Anzeige gleich `/api/w10-preview`. Integration: Wurf gleich Preview, V20-Handrechnung |
| 6 | Einzelner aktiver Wurf korrekt angezeigt | 05; ein Wurf pro Probe und Figur (Integration) |
| 7 | Geschlossene Ansichten ohne falsche Hinweise | 07; Unit-Test „loading or reconnecting …“ |
| 8 | Technische Kennungen dominieren nicht | Quelltextprüfung im Unit-Test, Browserprüfung auf A's Tisch |
| 9 | Rechte und Replay vollständig | Integration und Browser „rights“ und „replay“ |
| 10 | Live-Alpha fachlich beurteilbar | Konzept mit Stufen, Schalter und Rückfall |

## 5. Prüfgrenzen und offene Punkte

1. **Gesperrte Probe zeigt noch „Pool wird berechnet“** neben der V20-Begründung (Bild 12). Rein textlich, Würfeln ist korrekt gesperrt. Kleine Folgekorrektur.
2. **Bild 06** zeigt das Formular, die Statusliste liegt darunter im selben Bereich. Der Status ist in Bild 10 belegt.
3. **Mobil:** Die bestehende Aktionsleiste am eigenen Namen überlappt den Kopf der Bogenschublade (Bild 11, Bestandsverhalten der Teilnehmerleiste). Keine Prüfung auf echtem Gerät.
4. **Lesestatus der Hinweise** liegt pro Tab im `sessionStorage`. In einem neuen Gerät oder Tab erscheint der Hinweis für eine noch ausstehende Probe einmal erneut. Das ist inhaltlich richtig, weil die Probe aussteht.
5. **Weitere Co-SL:** Die Stage beschriftet nur den eigenen Eintrag als „Spielleitung“. Eine zweite SL am Tisch würde in der SL-Ansicht als Ziel gelistet; der Server lehnt ihren Wurf ab.
6. Spieler erhalten in `checks[].recipients` weiterhin die IDs der übrigen Adressaten, ohne Namen oder Werte (Bestand GE-01). Für die Alpha entfernen, siehe Konzept.
7. Keine Messung von Animationsflüssigkeit oder Gerätelast. Die 3D-Strecke ist unverändert.
8. Lokale Hilfsmittel, nicht im Commit:
   - `node_modules` ist eine Junction auf die identische Installation des GE-01B-Worktrees.
   - Eintrag `ge-01c` in `chronik-von-kleve\.claude\launch.json`.
   - Alte synthetische Speicher liegen als `.local-test/ge-01-old-*` im Worktree.

**Ausdrücklich nicht getan:** kein Push, kein PR, kein Merge, kein Deployment, keine Migration, keine Remote-D1-Befehle, keine Hunger-, Stress- oder Maskeradeaktivierung. Die Codex-Instanz auf 8895 und ihr Worktree blieben unverändert.
