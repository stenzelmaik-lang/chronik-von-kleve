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

## Behebung

Wird nach der Umsetzung ergänzt (Abschnitt „Umsetzung“ unten).
