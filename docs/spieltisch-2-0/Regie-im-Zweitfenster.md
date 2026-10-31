# Live-Regie im Zweitfenster

Stand: 31.10.2026 · Branch `claude/regie-zweitfenster` (Basis `claude/erzaehlung-ux`, `b36fd7d`) · nur lokal, kein Push, kein Deployment.

## Was die SL bekommt

- **Ein Klick am Spieltisch:** Der Knopf „Regie im zweiten Fenster“ oben rechts öffnet die Regie in einem eigenen Tab. Dieser lässt sich auf den zweiten Bildschirm ziehen.
  - Der Tab wird gemerkt. Ein zweiter Klick holt ihn nach vorn und öffnet keinen weiteren, auch nach einem Neuladen des Spieltischs.
  - Der Schuber „Regie (privat)“ bleibt als Rückfall für einen einzelnen Bildschirm erhalten.
- **Route:** `/sl/regie` ist nur für die SL zugänglich. Der Server prüft die Rolle; Spieler erhalten nur „Nur für die Spielleitung“ und keine Szenendaten. Die Regie sucht sich den laufenden Abend selbst.
- **Live-Abgleich:** Beide Fenster lesen denselben Bühnenstand.
  - Das sichtbare Fenster fragt etwa jede Sekunde nach, ein Fenster im Hintergrund alle vier Sekunden, bei Fokus sofort.
  - Die gewählte Szene teilen Regie-Tab und Schuber über denselben lokalen Schlüssel. Der Schuber folgt der Szenenwahl im Regie-Tab.
- **Layout ab 1600 px, vier Spalten mit eigenem Scrollbereich:**
  1. **Material:** Bilder und Polaroids, PDFs und Handout-Akten sowie weiteres Kampagnenmaterial. Jedes Stück hat eine eigene Empfängerwahl (alle oder einzelne Spieler).
  2. **Texte zum Vorlesen:** Erzählung mit eigener Freigabe- und Rückzugsleiste, Atmosphäre, Dialoge, Interaktionen und Notizen, Geheimnisse, Folgen, SL-Notizen. Die Textgröße ist persönlich und wird gemerkt.
  3. **Ton & Video:** Kassetten und Röhrenbildschirm ausspielen, Video groß einspielen, Hintergrundmusik wählen, neu starten oder stoppen.
  4. **Spielfeld & Effekte:** Regen und Nebel, Hintergrund wechseln, NPCs der Szene („Auftreten lassen“ und „Abtreten“, SL-Wissen aufklappbar), Pager, Übersicht „Auf dem Tisch“.
- **Andere Bildschirmbreiten:**
  - 1100–1599 px: drei Spalten, Ton und Spielfeld liegen übereinander.
  - Unter 1100 px: zwei Spalten.
  - Unter 760 px: eine Spalte, die Seite scrollt.

## Keine zweite Engine

- Die Regie ist nur eine weitere Ansicht. Alle Aktionen laufen über die bestehenden Befehle von `/api/live-stage` und `/api/live-table`.
- Der Sendeweg wurde dazu aus `stage.tsx` nach `stage-client.ts` herausgezogen und wird von Spieltisch und Regie gemeinsam benutzt.
- Arbeiten zwei SL-Fenster gleichzeitig, lehnt der Server eine veraltete Version mit 409 ab und übernimmt sie nicht. Die Regie sendet den Befehl dann einmal auf dem frischen Stand erneut.

## Neue optionale Felder im Bühnenstand (`domain/live-stage.ts`)

| Feld | Inhalt | Wer sieht es |
|---|---|---|
| `effects` | `['rain','fog']` | ganze Runde |
| `music` | `{fileId,title,key}`; ein neuer `key` je Start | ganze Runde; Spieler erhalten nur Titel und Schlüssel, Datei über `asset?objectId=music` |
| `pagers` | höchstens 30, `{id,text≤280,at,recipients}` | Empfänger (`null` = alle); die SL sieht alles; Spieler erhalten **keine** Empfängerliste |

- **Neue Befehle (nur SL):** `effects`, `music` (nur Audiodateien, `null` stoppt), `pager` und `pagerWithdraw`.
- **Prüfung der Pager-Empfänger:** Der Server lässt nur Teilnehmende der Runde zu. Eine leere Auswahl wird abgelehnt und gilt nicht als „alle“.
- **Keine Schemamigration:** Alte Stände ohne die neuen Felder bleiben gültig, der strikte Parser lehnt Unbekanntes weiter ab.
- **Hinweis zum Rücksprung:** Ein älterer Build würde einen Stand mit den neuen Feldern als „nicht unterstützt“ ablehnen. Vor einem Rücksprung also Musik stoppen und Effekte und Pager leeren, oder den Abend neu starten.
- **Szenenwechsel:** Musik und Wetter bleiben bewusst erhalten, weil sie ausdrückliche SL-Entscheidungen sind. Nur das Tischmaterial wird abgeräumt.

## Spielerseite

- **Pager:** Die Nachricht schwebt unten rechts auf den Tisch, das Gerät wippt leicht, die Knöpfe bleiben ruhig.
  - Die neueste ungelesene Nachricht liegt oben, ein Zähler zeigt „n weitere“.
  - Der Status „Gelesen“ ist persönlich und gilt nur in diesem Browser (lokaler Speicher je Abend und Person).
  - Zieht die SL einen Pager zurück, verschwindet er bei allen.
  - Auf dem gemeinsamen SL-Spieltisch werden Pager nie gezeigt, damit ein Beamer- oder Tischbild nichts verrät.
- **Regen und Nebel:** Die Ebene liegt über dem Hintergrund und unter allen Objekten und Texten.
  - Bei `prefers-reduced-motion` oder der ChroniPlay-Einstellung „Bewegung reduzieren“ steht das Bild still.
- **Musik:** Kleine Leiste oben links mit Pause, Stumm und eigener Lautstärke; die Lautstärke wird gemerkt.
  - Blockiert der Browser den automatischen Start, erscheint „Musik abspielen“. Nichts wird erzwungen.

## Pager-Grafik austauschen

- Platzhalter: `public/spieltisch/pager-platzhalter.svg`.
- Die Stelle im Code ist `PAGER_ASSET` in `app/spielbereich/modules/spieltisch/atmosphere.tsx`:
  - `src`: Pfad zum gelieferten Asset, z. B. `/spieltisch/pager.png` unter `public/spieltisch/`.
  - `ratio`: Breite geteilt durch Höhe des Bildes.
  - `screen`: Lage des Displays in Prozent des Bildes (`left`, `top`, `width`, `height`). Dort steht der Nachrichtentext.
- Am besten liefert ihr das Asset mit transparentem Hintergrund, z. B. als PNG oder WebP, etwa 640 × 400 px.

## Testinstanz

```powershell
.\scripts\start-regie.ps1          # http://127.0.0.1:8870, Speicher .local-test/regie, Abend startet sofort
.\scripts\start-regie.ps1 -Build   # vorher bauen (Server gestoppt)
.\scripts\start-regie.ps1 -Reset   # Testspeicher frisch anlegen (Server gestoppt)
```

- Nur synthetische Konten: `command-gm@`, `command-a@` und `command-b@example.invalid`. Das Passwort steht in `scripts/test-local.mjs`.
- Zusätzlich zur Kaserne-Szene gibt es ein synthetisches Musikstück „Regennacht – Hintergrundmusik.wav“.

## Prüfungen (31.10.2026, Edge headless über Playwright)

| Prüfung | Ergebnis |
|---|---|
| `pnpm test` (inkl. neuer `tests/regie-zweitfenster.test.mjs`) | 196/196 |
| Typecheck | ohne Fehler |
| Lint | keine Fehler in geänderten Dateien; die 12 Fehler im unveränderten `prototypes/spieltisch-2` bestanden schon vorher |
| Build | erfolgreich |
| `tests/regie-zweitfenster-integration.mjs` (SL, A, B) | alle bestanden |
| `tests/spieltisch-regie-integration.mjs`, `spieltisch-medien-integration.mjs`, `zustandswerte-integration.mjs` | alle bestanden |
| `tests/regie-zweitfenster-browser.mjs` (1920, 1440, 125 % Zoom; Spieler mit 375 px) | alle bestanden |
| `tests/erzaehlung-ux-browser.mjs` | bestanden (erlaubte Ports um 8870 erweitert) |

- **Ein Ausreißer:** Im ersten Gesamtlauf schlug `tests/erzaehlung-ux-browser.mjs` einmal ohne Meldung fehl, direkt nach den Integrationssuiten. In zwei weiteren Läufen, darunter direkt nach der Medien-Suite, war er grün. Die Ursache ist nicht geklärt.
- **Was die Integration abdeckt:**
  - Die Route `/sl/regie` und der Regie-Kontext sind nur für die SL. Spieler erhalten 403 bzw. die Ablehnungsseite, beides ohne SL-Geheimnis.
  - Spieler können weder Pager senden noch Effekte oder Musik setzen (403).
  - Ein Pager nur für A erscheint bei B nicht und taucht dort nicht einmal im Rohstand auf. Fremde oder leere Empfänger und Texte über 280 Zeichen werden abgelehnt. Zurückziehen wirkt sofort.
  - Effekte gelten für alle und bleiben nach einem Neuladen. Unbekannte Effekte werden abgelehnt.
  - Musik akzeptiert nur Audiodateien. Spieler laden sie nur über den Bühnen-Asset-Weg, das Original bleibt privat (404). Neustart und Stopp funktionieren.
  - Ein NPC, der nur für B auftritt, ist für A weder sichtbar noch per Bild-URL abrufbar.
  - Ein veralteter Zweitfenster-Befehl wird abgelehnt und überschreibt nichts.
  - Spielerstände enthalten keine SL-Texte.
- **Was der Browsertest abdeckt:**
  - Die Regie öffnet sich per Knopf und der gemerkte Tab wird wiederverwendet.
  - Alle vier Bereiche sind sichtbar. Es gibt kein horizontales Scrollen, und auf großen Bildschirmen scrollt nur innerhalb der Spalten.
  - Der Pager erreicht nur A; „Gelesen“ bleibt nach einem Neuladen erhalten.
  - Regen und Nebel erscheinen bei allen; mit reduzierter Bewegung gibt es keine Animation.
  - Die Musiklautstärke ist pro Person getrennt.
  - Die Erzählung lässt sich aus der Textspalte nur für B freigeben und wieder zurückziehen.
  - Der Schuber folgt der Szenenwahl im Regie-Tab.
  - Bei 375 px passen Pager und Musikleiste in die Breite.
- Screenshots liegen lokal unter `.local-work/ux-check/regie/`.

## Offen bzw. bewusst nicht enthalten

- Die Kaserne-Testszene hat kein Video. Der Videoweg nutzt dieselben Befehle wie Audio (Röhrenbildschirm bzw. „Groß einspielen“) und ist daher nur indirekt geprüft.
- Pager haben keinen Ton und keine Vibration, weil Browser das ohne Interaktion ohnehin oft blockieren.
- Effekte und Musik wirken auf die ganze Runde. Zielgruppen gibt es nur für Pager, Material, NPCs und die Erzählung.
- Die Topbar des Spieltischs ist bei 375 px schon vorher eng; daran wurde nichts geändert.
