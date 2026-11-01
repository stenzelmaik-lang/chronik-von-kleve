# Live-Befund 31.10.2026 – Behebung

Branch `claude/live-befund-fixes` auf `origin/main` `8656391`. Grundlage ist der Live-Test auf chroniplay.cc mit dem SL-Konto des Projektinhabers.

Live lief der neueste Code. Die Fehler zeigten sich erst mit echten, großen Bildern und im Alleinbetrieb als SL.

## Behoben

1. **Darstellung ließ sich nicht anlegen.** Die Bildauswahl ist ein `<dialog>` im Asset-Fenster. React reicht das `close`-Ereignis des inneren Dialogs an den äußeren weiter, deshalb schloss „Übernehmen“ auch das Asset-Fenster und verwarf den Entwurf.
   - Alle Material-Dialoge reagieren nur noch auf ihr eigenes Schließen (`ownClose` in `material/file-picker.tsx`). Betroffen sind Bildauswahl, Asset-Galerie und Material-Viewer.
   - Das Asset-Fenster steht jetzt mittig statt oben.
   - Die Bildauswahl im Asset-Editor zeigt jetzt auch „Diese Szene“ und „Darstellungs-Assets“.
2. **Bilder luden zäh.** Eine Bildauswahl lud 46 Originale (75 MB), und `no-store` erzwang jedes Mal alles neu.
   - `/api/files` antwortet mit `private, no-cache` und `ETag`. Der Server prüft die Berechtigung bei jeder Anfrage weiter, ein unverändertes Bild kostet aber nur noch eine 304-Antwort.
   - **Vorschaubilder:** `?size=thumb` liefert ein kleines WebP (höchstens 360 px), solange eines gespeichert ist. Sonst kommt das Original mit dem Header `X-CVK-Thumb: missing`.
     - Der Browser, der das Original gerade geladen hat, verkleinert es einmal und speichert die Vorschau (`POST /api/files?thumb=`). Das geht nur für Dateien, die die Person verwalten darf, und nur als echtes WebP bis 256 KB.
     - Das Vorschaubild liegt in R2 neben dem Original (`<key>.thumb`) und wird beim Löschen der Datei mit entfernt.
     - Es gibt keine Migration und keinen neuen Dienst. Bestehende Dateien bekommen ihre Vorschau beim ersten Ansehen.
   - `ThumbImage` (`modules/file-thumb.tsx`) wird in diesen Kacheln und Listen verwendet: Galerie, Dateiauswahl, Asset-Galerie, Materialvorlagen, Regie-Material, Bildauswahl und Szenenbausteine. Viewer und Vorschau laden weiter das Original.
3. **Pager: kein Ton, andere Optik für die SL.** Den Ton spielte nur der Pager des Empfängers; der SL-Spiegel war stumm, und die SL konnte sich nichts schicken.
   - In der Regie gibt es bei „Pager · spontan“ und bei jedem vorbereiteten Pager den Knopf **„An mich testen“**. Er zeigt den echten Spieler-Pager mit Ton, Tasten und Lesen, lokal und nur für die SL. Gesendet oder gespeichert wird nichts.
   - Der Pager-Spiegel hat einen eigenen Schalter **„Ton für mich“** (standardmäßig an). Beim Senden spielt er den Signalton, bei „dringend“ den Alarm.
   - Der Bereichs-Knopf „Pager“ in der Regie springt jetzt zuverlässig hin. Laufende Aktualisierungen hatten das weiche Scrollen abgebrochen.
4. **Dauerabfragen gebündelt.** Pro Browser waren es live rund 4–5 Anfragen pro Sekunde, jetzt rund eine.

   | Abfrage | vorher | jetzt |
   |---|---|---|
   | Spieltisch (`live-table`) | 350 ms | 1,2 s |
   | Bühne (`live-stage`) | 750 ms | 1,5 s |
   | Regie-Fenster | 0,9 s | 1,5 s |
   | Postfach | 2,5 s | 15 s |

   Eigene Aktionen aktualisieren weiterhin sofort.
5. **Bühnenbild nur aus der Szene** (Vorgabe des Projektinhabers). Die Regie bietet keine freie Galerie-Auswahl mehr, nur das Szenenbild.
   - Der Server lehnt `backdrop` mit einer Datei ab, die weder Szenenbild noch vorbereitetes Hintergrund-Material der laufenden Szene ist.
   - Bücher, Umschläge und Mappen sind Darstellungs-Assets eines Materials und kommen über „Auf den Tisch legen“ auf den Tisch.

## Tests

- **Neu:** `tests/live-befund-integration.mjs`. Es prüft:
  - ETag und 304-Antwort
  - Rückfall auf das Original, wenn die Vorschau fehlt, mit unveränderter Berechtigung (Spieler bekommen 404)
  - Vorschau speichern dürfen nur Verwaltende, und nur als WebP
  - Ablehnung fremder Bühnenbilder
- **Neu:** `tests/live-befund-browser.mjs`. Es prüft:
  - Asset anlegen über die Bildauswahl (das Fenster bleibt offen, der Entwurf bleibt erhalten, Speichern klappt)
  - nur Vorschaubild-Anfragen in den Listen
  - „An mich testen“ mit Ton, ohne dass etwas gesendet wird
  - Sprung zum Pager-Bereich
  - keine Galerie-Auswahl für das Bühnenbild
- **Angepasst:**
  - `material-3-integration.mjs`: Vor dem Hintergrund-Material läuft dessen Szene.
  - `story-preparation-integration.mjs` und `location-area-integration.mjs` akzeptieren `private, no-cache`.

**Ergebnisse:**
- Typecheck, App-Lint, 304 Unit-Tests und Build grün.
- Gegen `--material-3` grün: Live-Befund-Integration und -Browser, Material-3-Integration und -Browser.
- Gegen `--ultio-pager` grün:
  - Integration: Pager, Pager-Fixes, Regie-Zweitfenster, Regie-Nachbesserung, Spieltisch-Medien.
  - Browser: Pager, Pager am Tisch, Pager-Fixes, Regie-Zweitfenster, Regie-Nachbesserung.
- Gegen `--regie` grün: `table-materials-browser` (der erste Lauf brach beim Kaltstart mit einem Timeout ab) und `table-materials-edges-browser`.
- **Schon vorher rot, nicht Teil der CI:** `material-packets-browser.mjs` sucht den alten Bereich „Szenenbausteine“. Seit PR #56 heißt er „Weitere Szenenbausteine“, und Bilder und Handouts liegen im neuen Material-Editor. Der Test muss eigens an Spielmaterial 3.0 angepasst werden.

## Hinweise

- Ein Rückfall auf den Vorgänger-Build ist unkritisch. Gespeicherte Vorschaubilder sind zusätzliche R2-Objekte und werden dann einfach nicht genutzt.
- Browser ohne WebP-Kodierung (ältere Safari-Versionen) speichern keine Vorschau und zeigen weiter das Original.

## Live-Release 01.11.2026

- Freigegeben durch den Projektinhaber („Ja, mergen und live“). PR #59 ist als `5cc4c97` gemergt.
- CI: Typecheck, Lint, Tests und Build grün.
  - Der SL-Browserdurchlauf brach im ersten Lauf in `story-browser-smoke` mit einem Timeout ab, weil ein Element beim Klicken neu gezeichnet wurde.
  - Lokal gegen `--spieltisch-release` liefen `story-browser-smoke` und `preparation-guide-browser` grün, der Neustart in der CI ebenfalls.
- Worker-Version `91a7b6ce-06af-4d64-8701-7e5201273287`, Tag `5cc4c97-Live-Befund`, 100 % Verkehr. Bindings unverändert.
- Rückfallversion: `9f9dbbcc-2cfb-4616-86df-f978723a46fd` (Spielmaterial 3.0), voll kompatibel. Gespeicherte Vorschaubilder bleiben dann ungenutzt in R2 liegen.
- Sicherung vorab:
  - 32 Tabellen, 30.389 Zeilen, `integrity_check ok`.
  - Lesezeichen `000001a1-0000023e-00005116-6b5448afbb7c5372a8d74989f610c6dc`.
  - Ablage: privat unter `.local-work/release-live-befund/`.
- Live-Prüfung ohne Anmeldung:
  - `/anmelden` antwortet mit 200.
  - Spielbereich, Command Center und Regie leiten mit 307 weiter.
  - Dateien, Vorschaubild, Darstellungs-Assets und Bühne antworten mit 401.
  - Vorschaubild speichern ohne Anmeldung ergibt 401.
- Live-Prüfung mit dem SL-Konto:
  - Die Bildauswahl im Asset-Editor lädt 6 Vorschaubilder mit zusammen 134 KB. Vorher waren es 46 Originale mit 75 MB.
  - „Diese Szene“ zeigt 6 Dateien.
  - Nach „Übernehmen“ bleibt das Asset-Fenster offen, Name und Bild bleiben erhalten. Abgebrochen, nichts gespeichert.
  - In der Regie gibt es keine Galerie-Auswahl für das Bühnenbild mehr. Das Szenenbild ist aktiv.
  - „An mich testen“ zeigt den Spieler-Pager mit der Nachricht. Gesendet wird nichts.
  - Ohne echte Klick-Geste bietet der Pager „Ton aktivieren“ an. Danach sind die Töne geladen und der Bestätigungston spielt.