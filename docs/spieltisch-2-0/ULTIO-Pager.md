# ULTIO Pager R-03 – Integration

Stand 31.10.2026 · Branch `claude/ultio-pager` (von `claude/regie-zweitfenster`, `d65b560`) · nicht gepusht, nicht deployt.

Grundlage ist das Asset-Paket „ChroniPlay ULTIO Pager v2“ mit `CLAUDE_CODE_UEBERGABE.md`, `README.md` und `ASSET-MAP.md`. Umgesetzt mit den vorhandenen Datenstrukturen: Szenenmaterial (`elements`), Bühnenstand im Live-Raum und Pager-Vertrag aus `d65b560`. Es gibt keine neue Echtzeit-Infrastruktur und keine Schemamigration.

## Ablauf

1. **Vorbereiten (Command Center):** Szene → Interaktionen → „Spielmaterial vorbereiten“ → Knopf **„Pager-Nachricht“**. Felder: Titel/Betreff (≤ 80), Absender im Spiel, Pager-Text (≤ 280), Priorität (Normal/Dringend), vorgesehene Empfänger (ganze Runde oder einzelne Spieler) und eine SL-Notiz „Einsatz – wann ausspielen?“.
2. **Ausspielen (Regie-Fenster):** Block **„Pager · vorbereitet“** listet die Pager der Szene als LCD-Vorschau.
   - Die vorgesehenen Empfänger sind vorausgewählt und lassen sich ändern. Wer nicht am Abend teilnimmt, wird markiert und herausgefiltert.
   - Nach dem Senden zeigt die Karte „Gesendet … an …“ und „Gelesen: …“.
   - „Zurückziehen“ macht die Nachricht wieder ausspielbar.
3. **Spontan (Regie-Fenster):** Block **„Pager · spontan“** mit Absender, Titel, Nachricht, Dringend und Empfängern (eine Person, mehrere oder alle). Das Sendeprotokoll zeigt alle Pager mit Herkunft und Quittungen.
4. **Empfangen (Spieltisch, nur Spieler):**
   - Der Pager liegt freigestellt auf dem Tisch: nur das Gehäuse mit Schatten, leicht gedreht, ohne Panel oder Rahmen.
   - Bei einer neuen Nachricht schwebt er herein. Zugeklappt liegt er als kleines Gerät mit Badge für ungeöffnete Meldungen in der Ecke.
   - Ton an/Stumm und Zuklappen sitzen als zwei kleine Chips über dem Gerät.

## Gerät

- **Gehäuse:** `public/spieltisch/pager/ultio-shell.webp`, 1448 × 1086, 171 KB, transparent, als Bildebene. Das LCD ist echtes HTML darüber, das Seitenverhältnis ist fest. Keine Meldung ist ins Bild eingebrannt.
- **LCD-Fläche neu vermessen:** x 233–1206, y 314–650. Die Paketwerte (bis 1176/633) ließen rechts einen Streifen des leeren LCDs stehen.
- **Tasten:** Fünf transparente Klickflächen über MENU, ▲, ▼, OK und ↩, mit den Koordinaten aus `pager.css [data-shell="ultio"]`. Ein Klick auf Gehäuse oder LCD löst nichts aus.
- **Tastatur:** Bei fokussiertem Gerät ↑/↓, Enter, Esc und M.
- **Bedienung:**
  - MENU wechselt zwischen Start, Eingang und Status.
  - Im Eingang öffnet OK die gewählte Meldung, die damit als geöffnet gilt. Ein zweites OK quittiert beim Server.
  - ▲/▼ wählen bzw. scrollen. ↩ geht zurück und klappt auf der Startseite zu.
- **LCD-Farben:** `green`, `amber`, `ice`, `red`. Eine dringende Meldung erscheint rot.
- **Eigene Ansichten:** `registerPagerDisplay(name, {render, menu})` in `ultio-pager.tsx`; `menu: true` nimmt die Ansicht in den MENU-Zyklus auf.
- **Ton:**
  - `ping-normal.wav` bzw. `alarm-urgent.wav` erklingen nur bei neu eintreffenden IDs und nur, wenn der Pager nicht stumm ist. Nichts wird erzwungen: Blockiert der Browser, bleibt es still.
  - Stumm wird pro Person im Browser gespeichert.
  - Nach einem Neuladen klingelt nichts erneut.
- **Bewegung:** Bei `prefers-reduced-motion` gibt es keinen Einflug und kein Vibrieren.
- **Handy (375 px):** Das ganze Gerät ist rechts neben der Werkzeugleiste sichtbar, oberhalb der Zustandsanzeige.
- **Code:** Die Gerätelogik liegt ohne DOM in `domain/ultio-pager.ts` (Tasten, Deduplizierung, Ankünfte), die Darstellung in `app/spielbereich/modules/spieltisch/ultio-pager.tsx` und `.module.css`. Der alte Platzhalter (`PagerInbox`, `pager-platzhalter.svg`) ist entfernt.
- **Nicht übernommen:** `shell-ultio-reference.png`, die Demo-Seiten, `main.js` mit der SL-Testkonsole, die PNG-Shell (die WebP genügt), Icons sowie Raster und Scanlines (beide als CSS nachgebaut). Aus dem Paket wurde kein Skript ausgeführt.

## Sicherheit (serverseitig)

- Senden, Zurückziehen und Vorbereiten darf nur die SL (403). Der Regie-Kontext mit den vorbereiteten Pagern ist ebenfalls nur für die SL.
- Ungesendete vorbereitete Texte erscheinen in keinem Spielerstand.
- Spieler erhalten nur an sie adressierte Pager, ohne Empfängerliste, Herkunft oder fremde Quittungen.
  - Spieler B bekommt einen Pager für A weder im Stand noch über die Asset-Route (404).
  - B kann ihn auch nicht quittieren (404).
- Quittieren kann nur der eingeloggte Empfänger, und nur für eine echte ID. Eine Quittung wird einmal gespeichert; die SL kann nicht stellvertretend quittieren.
- **Deduplizierung:**
  - Eine vorbereitete Nachricht wird mit ihrer Element-UUID gesendet. Dieselbe ID kommt nur einmal an (409), und `origin:'vorbereitet'` ohne ID wird abgelehnt (400).
  - Spontanentwürfe tragen eine feste UUID, die erst nach Erfolg wechselt. Ein Doppelklick oder eine Wiederholung sendet also nichts doppelt.
  - Der Client führt Nachrichten über die ID zusammen.
- Empfänger beim Vorbereiten müssen aktive Spieler der Kampagne sein (400). Beim Senden prüft der Server erneut, ob sie am Abend teilnehmen.

## Daten- und Schemaauswirkungen

- **Keine D1-Migration.**
- **Szenendokument:** neuer Elementtyp `pager` und optionales Feld `elements[].pager` = `{sender, text, priority, recipientIds}`. Alte Szenen bleiben gültig. Ein Pager-Element ohne Daten gilt als leerer Entwurf.
- **Bühnenstand:** unverändert, es gilt der Vertrag aus `d65b560`.
- **Rücksprung-Hinweis:** Ein älterer Build lehnt eine Szene mit einem Pager-Baustein beim Lesen bzw. Speichern ab, weil Elementtyp und Feld dort unbekannt sind.
  - Vor einem Rücksprung die Pager-Bausteine aus den Szenen entfernen.
  - Für den Bühnenstand gilt der Hinweis aus „Regie im Zweitfenster“ (Pager leeren).
- **Lokaler Browserspeicher:** `chroniplay:pager:<runId>:<id>` (geöffnete IDs) und `chroniplay:pager-ton:<id>` (stumm).

## Testinstanz

```powershell
.\scripts\start-ultio-pager.ps1          # http://127.0.0.1:8874, Speicher .local-test/ultio-pager, Abend startet sofort
.\scripts\start-ultio-pager.ps1 -Build   # vorher bauen (Server gestoppt)
.\scripts\start-ultio-pager.ps1 -Reset   # Testspeicher neu anlegen (Server gestoppt)
```

- Es gibt nur synthetische Konten: `command-gm@`, `command-a@` und `command-b@example.invalid`.
- Die Kaserne-Szene enthält zwei vorbereitete Pager: „SÜDTOR“ (dringend, für A) und „LAGE“ (für alle).

## Prüfungen (31.10.2026, Edge headless über Playwright, Instanz 8874)

| Prüfung | Ergebnis |
|---|---|
| `pnpm test` (inkl. neuer `tests/ultio-pager.test.mjs`) | 205/205 |
| Typecheck · Build | ohne Fehler |
| Lint | geänderte Dateien ohne Befund; die 12 Fehler in `prototypes/spieltisch-2` sind älter und unverändert |
| `tests/ultio-pager-integration.mjs` (SL, A, B) | alle bestanden: Vorbereitung, Ausspielen, spontan, Zielgruppen, 403/404, Deduplizierung, Quittung, Neuladen, Zurückziehen |
| Regie-, Medien-, Zustandswerte- und Spieltisch-Regie-Integration | alle bestanden |
| `tests/ultio-pager-browser.mjs` (Regie + Spieltisch bei 1920, 1440, 125 %; Spieler bei 375 px mit Touch) | alle bestanden: Tasten, Klick daneben ohne Wirkung, Tastatur, Auf- und Zuklappen, Stumm, Badge, reduzierte Bewegung, Neuladen, freigestelltes Gerät |
| `tests/regie-zweitfenster-browser.mjs` (auf den neuen Pager angepasst, Port 8874 erlaubt) | bestanden |
| `tests/erzaehlung-ux-browser.mjs` (Port 8874 erlaubt) | bestanden |

## Grenzen

- Bei 375 px ist das LCD klein (etwa 7–9 px Schrift). Längere Texte scrollt man mit ▼.
- Während die SL eine große gemeinsame Medienansicht zeigt, liegt diese modal über dem Tisch. Den Pager bedient man erst nach dem Schließen.
- Die ULTIO-Wortmarke im Gehäuse ist der Designentwurf aus dem Paket. Eine kanonische Marke ließe sich durch Austausch der WebP übernehmen, ohne Codeänderung.
