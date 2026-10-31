# ULTIO-Pager – Fehlerbericht nach der Live-Abnahme

Stand 31.10.2026 · Branch `claude/ultio-pager-fixes` von `origin/main` `671b0e4` (enthält `4f3964f`) · nicht gepusht, nicht deployt.

Drei Mängel aus der Live-Abnahme. Die Ursachen wurden vor jeder Änderung an einer isolierten Instanz (Port 8884, synthetische Konten) und am Gehäusebild selbst untersucht.

## 1. Kein Benachrichtigungston

**Befund** (Messung im Browser und an den Dateien):
- **Der Ton wird gestartet, ist aber kaum hörbar.**
  - `ping-normal.wav` und `alarm-urgent.wav` aus dem Paket liegen bei −21,3 dBFS Spitze und etwa −27 dBFS RMS.
  - Die Komponente spielt sie zusätzlich mit Lautstärke 0,6 (−4,4 dB), also mit rund −26 dBFS Spitze.
  - Neben Hintergrundmusik oder YouTube-Ambiente geht das unter.
  - Im Test meldet `play()` Erfolg, hörbar ist dabei fast nichts.
- **Autoplay-Sperre:**
  - Ohne vorherige Interaktion auf der Seite, also direkt nach dem Laden oder Neuladen, lehnt der Browser `HTMLAudioElement.play()` ab.
  - Der blockierte Ton wurde bisher unsichtbar zurückgestellt und erst beim nächsten Tipp nachgeholt, also verspätet und ohne Hinweis.
  - Auf iOS entsperrt das bisherige `load()` im Gesten-Handler das Element nicht; jeder spätere Ton bleibt blockiert.
- **Doppelter Ton bei Synchronisierung:**
  - Ein „neu“ erkennt die Komponente nur am Vergleich mit dem *letzten* Stand.
  - Liefert die Abfrage kurz einen älteren Stand und danach wieder den neuen, gilt dieselbe Nachricht erneut als neu und klingelt noch einmal.

## 2. Nachrichten bleiben ungelesen

**Befund:**
- **Der Lesestatus lag nur im Browser.**
  - „Geöffnet“ wurde ausschließlich in `localStorage` gespeichert (`chroniplay:pager:<runId>:<id>`).
  - Der Server kannte nur die Quittung (`acks`, zweites OK).
- **Folgen:**
  - Die SL sieht in Regie und Pager-Spiegel „Noch nicht gelesen“, obwohl der Spieler die Nachricht geöffnet und gelesen hat. Der Spiegel zählte „Gelesen“ aus den Quittungen.
  - Auf einem anderen Gerät, in einem anderen Browser oder nach dem Löschen der Website-Daten ist die Nachricht wieder ungelesen.
  - Ein verspäteter Stand konnte den lokalen Zustand nicht zurücksetzen. Ohne Serverstatus fehlte aber jede dauerhafte Quelle.

## 3. Tasten liegen nicht auf dem Gerät

**Befund:** Die Pixelmessung am Gehäusebild (1448 × 1086) zeigt, dass die Tastenkoordinaten aus dem Asset-Paket nicht zu den sichtbaren Tasten passen:

| Taste | Paket/CSS (Mitte x) | gemessen (Kappe x) | Abweichung |
|---|---|---|---|
| MENU | 265 (18,3 %) | 170–358 → 264 | −1 px |
| ▲ | 477 (33,0 %) | 396–580 → 488 | +11 px |
| ▼ | 702 (48,5 %) | 612–828 → 720 | +18 px |
| OK | 924 (63,8 %) | 858–1046 → 952 | +28 px |
| ↩ | 1147 (79,2 %) | 1084–1268 → 1176 | +29 px |

- **Senkrecht:** Die Kappen reichen von y 746 bis 888, die Mitte liegt bei 817 statt 805.
- **Waagerecht:** Der Fehler wächst nach rechts. OK und Zurück sitzen etwa 2 % der Gerätebreite links neben ihren Tasten, unten fehlt ein Streifen.
- **Größe:** Die Klickflächen waren 13,2 % × 14,6 % groß. Sie reichten in die Fugen zwischen den Tasten; Klicks dort lösten benachbarte Aktionen aus.
- **Skalierung:** Die Flächen sind prozentual, laufen beim Skalieren also nicht auseinander. Der Fehler steckt allein in den Ausgangswerten.

## Umsetzung

Die vorhandene Architektur bleibt: ein Pager, der Bühnenstand als Speicher, `POST /api/live-stage` als Weg. Es gibt keinen neuen Dienst und keine Datenbankmigration.

### 1. Ton (`app/spielbereich/modules/spieltisch/pager-sound.ts`)
- **Lautstärke:** Die Paket-Sounds laufen über Web Audio mit fester Verstärkung ×4 (+12 dB). Die Spitze liegt bei etwa −9 dBFS: deutlich hörbar, ohne Übersteuerung.
- **Freischalten:**
  - Der erste Tipp, Klick oder Tastendruck auf der Seite schaltet den Ton frei; auf iOS mit einem stillen Puffer.
  - Hat die Seite schon vor dem ersten Pager eine Interaktion erlebt (`navigator.userActivation.hasBeenActive`), wird beim Eintreffen direkt freigeschaltet.
- **Ton aktivieren:** Blockiert der Browser trotzdem, zeigt der Pager den Knopf **„Ton aktivieren“**. Er schaltet frei und bestätigt mit einem Ping. Ein blockierter Ton wird nicht später überraschend nachgespielt.
- **Wann es klingelt** (`pagerRing` in `domain/ultio-pager.ts`):
  - Nur für IDs, die diese Person noch nicht gesehen hat. Die Liste wird pro Abend gespeichert und wächst nur.
  - Kein Ton beim Neuladen, bei doppelten Ereignissen oder bei einem kurz veralteten Stand.
  - Mehrere neue Nachrichten in einer Synchronisierung ergeben einen Ton; ist eine dringende dabei, wird es der Alarm.
- **Keine Überlagerung** (`pagerRingSlot`): Ein Ping während eines laufenden Tons entfällt, ein Alarm folgt direkt danach. Der Rückstau beträgt höchstens 1 s.
- **Stumm:** Stumm bleibt pro Person gespeichert und hat Vorrang. Beim Einschalten wird zugleich freigeschaltet.

### 2. Lesestatus (Server)
- **Bühnenstand:** neues optionales Feld `pagers[].reads` = `[{id, at}]` und neuer Befehl `{action:'pagerRead', id}`.
  - Nur der eingeloggte Empfänger, nur für eine echte ID, sonst 404. Die SL kann nicht stellvertretend lesen.
  - Monoton: Wiederholte oder verspätete Befehle ändern nichts. Eine Quittierung zählt immer auch als gelesen.
- **Stand für Spieler:** `read` (eigene Lesebestätigung oder Quittierung). Die SL erhält `reads` und `acks`.
- **Client:**
  - Öffnen und Anzeigen der Meldung zählt sofort lokal als gelesen; Zähler und Badge aktualisieren sich ohne Wartezeit.
  - Danach geht `pagerRead` an den Server.
  - Fehlt dem Server eine Bestätigung (verlorene Anfrage, anderer Tab), sendet der Pager sie mit dem nächsten Stand erneut.
  - Lokaler Lesestatus und Serverstatus werden vereinigt; nichts wird zurückgesetzt.
- **Regie:** zeigt „Gelesen: … · Quittiert: …“. Der Pager-Spiegel zeigt „Gelesen n/m: … · quittiert k“.

### 3. Tasten (`ultio-pager.module.css`)
- **Neue Mitten:** 18,23 / 33,70 / 49,72 / 65,75 / 81,22 % in der Breite und 75,23 % in der Höhe.
- **Größe:** 12,2 % × 12,4 %, etwas innerhalb der Kappen. Die Fugen zwischen den Tasten, die Einfassung und das LCD lösen nichts aus.
- **Unverändert:** Der Fokusrahmen sitzt auf der Klickfläche, also jetzt genau auf der Kappe. Die Tastatur (Tab auf Tasten, ↑ ↓ Enter Esc M am Gerät) funktioniert wie bisher.

## Daten und Schema

- Keine D1-Migration.
- **Bühnenstand:** nur das optionale Feld `pagers[].reads`. Alte Stände bleiben gültig.
- **Rücksprung-Hinweis:** Ein älterer Build lehnt einen Stand mit `reads` als „nicht unterstützt“ ab. Vor einem Rücksprung die Pager zurückziehen oder den Abend neu starten. Das ist derselbe Hinweis wie bei früheren optionalen Feldern.
- **Neuer lokaler Schlüssel:** `chroniplay:pager-gehoert:<runId>:<id>` (bereits angezeigte IDs, nur für den Ton).

## Tests (31.10.2026, Edge headless über Playwright, isolierte Instanz Port 8884)

| Prüfung | Ergebnis |
|---|---|
| Unit gesamt (`package.json` test, inkl. neuer `tests/ultio-pager-fixes.test.mjs`) | 297/297 |
| Typecheck · Build | ohne Fehler |
| Lint | geänderte Dateien ohne Befund; die 12 Fehler in `prototypes/spieltisch-2` sind älter und unverändert |
| `tests/ultio-pager-fixes-integration.mjs` (SL, A, B: nur Empfänger, echte ID, 404, fremde nicht mitmarkiert, idempotent, verspätet, neue Sitzung) | bestanden |
| Pager-, Regie-, Regie-Nachbesserung-, Ambiente-, Spieltisch-Regie-, Medien-, Zustandswerte-, Zustandswerte-Runde-, Szenen-Whisper- und Material-Integration | alle bestanden |
| `tests/ultio-pager-fixes-browser.mjs` (Regie-Fenster + A + B; 1920, 1440, 125 %, 375 px mit Touch) | bestanden: Ton, Alarm, keine Wiederholung, stumm, gelesen sofort/dauerhaft/nur A, Tasten auf den Kappen, Fugen tot, Klick/Tipp, Tastatur, Fokusrahmen |
| `tests/ultio-pager-tisch-browser.mjs`, `ultio-pager-browser.mjs`, `regie-nachbesserung-browser.mjs`, `regie-zweitfenster-browser.mjs` | bestanden |

**Anpassungen an bestehenden Tests:**
- Die Ton-Sonde ist auf Web Audio umgestellt.
- „Blockierter Ton wird beim ersten Tipp nachgeholt“ ist ersetzt durch „Ton aktivieren“.
- `waitForFunction` fragt im Intervall ab statt per Animationsframe; Hintergrundseiten drosseln diesen.
- `regie-nachbesserung-browser`: Nach dem Öffnen durch A und B zeigt der Spiegel jetzt korrekt „Gelesen 2/2“, A's zweites OK „quittiert 1“.
- Die Portlisten erlauben zusätzlich 8884.

**Regressionsnachweis Tasten:** Mit den alten Koordinaten scheitert die neue Prüfung. Die Fugenpunkte zwischen ▼/OK (x 843) und OK/↩ (x 1065) lagen in den alten OK- bzw. Zurück-Flächen.

**Screenshots:** `.local-work/ux-check/ultio-pager-fixes/` (Desktop und 375 px, Spieler A mit Fokusrahmen, Regie).

## Hinweise

- **Lockfile:** `origin/main` hat ein Lockfile, das nicht zu `package.json` passt (z. B. `next` 16.3.4 im Lockfile, 16.3.6 im Manifest). Das bestand schon in `4f3964f`.
  - `pnpm install --frozen-lockfile` scheitert deshalb.
  - Lokal wurde ohne gefrorenes Lockfile installiert. Lockfile und `pnpm-workspace.yaml` wurden nicht verändert committet.
  - Das sollte vor dem nächsten CI-Lauf eigens bereinigt werden.
- **Nicht nachgespielt:** Ein zurückgezogener und mit derselben ID erneut ausgespielter Pager klingelt kein zweites Mal, weil die ID schon gesehen wurde. Er erscheint aber ungelesen.
- **Testinstanz:** `$env:CVK_TEST_PORT='8884'; .\scripts\start-ultio-pager.ps1` (Speicher `.local-test/ultio-pager` in diesem Worktree, nur synthetische Konten).

## Live-Release 31.10.2026

- Freigegeben durch den Projektinhaber („Ja, Pager zuerst“, nach Merge von PR #55 als `c2a3b9e`).
- Worker-Version `5954135a-b260-4471-b41c-d3306388ba45`, Tag `c2a3b9e-Pager-Fixes`, 100 % Verkehr. Bindings unverändert.
- Rückfallversion: `b0f73b8b-28c9-4ba6-bb11-5395fd8226c4` (W10 Phase B). Kompatibel: Der neue Lesestatus ist ein zusätzliches Feld im Bühnenstand, ältere Builds ignorieren ihn.
- Prüfung vorab am gemergten Stand: Typecheck, App-Lint, 297 Unit-Tests, Build, Pager- und Lesestatus-Integration, Pager-Browsertest (SL/A/B; 1920, 1440, 125 %, 375 px) grün.
- Sicherung vorab:
  - 32 Tabellen, 29.273 Zeilen, `integrity_check ok`.
  - Lesezeichen `0000019c-0000006e-00005115-08457a365910b4eb175161d20e403aed`.
  - Ablage: privat unter `.local-work/release-pager-fixes/`.
- Live-Prüfung ohne Anmeldung:
  - `/anmelden` antwortet mit 200.
  - Spielbereich, Command Center und Regie leiten mit 307 weiter.
  - Bühne, Spieltisch und Dateien antworten mit 401 und `private, no-store`.
  - Pager-Gehäuse und beide Töne antworten mit 200.
- Keine Daten- oder Schemaänderung.