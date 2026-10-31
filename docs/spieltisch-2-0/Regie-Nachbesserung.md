# Regie-Nachbesserung nach dem Live-Test (31.10.2026)

Branch `claude/regie-nachbesserung`, abgezweigt von `claude/release-regie-pager` (`0881837`, live als Worker-Version `732bc758`). Worktree `cvk-regie-fix`. Nur lokal committet, nicht gepusht und nicht deployt.

## 1. Regie-Knopf oben rechts entfernt, Szenenwahl führt ins Regie-Fenster

- Der Knopf „Regie“ oben rechts auf dem Spielfeld ist für die SL entfernt. Spieler behalten „Kontext“.
- **Was am Regie-Schuber hing:** Lesen der Szenentexte, Erzählung zeigen, Szene starten, Hintergrund wechseln, Material und Handouts auflegen bzw. freigeben, NPCs privat auflegen.
  - Das Regie-Fenster kann das alles schon.
  - Neu im Fenster ist „Nur SL auflegen“ für Handout-Akten und NPCs. Damit geht beim Wechsel nichts verloren.
- **„Szenen des Abends“:**
  - „Szene starten“ öffnet zuerst das Regie-Fenster auf dieser Szene, noch innerhalb des Klicks. So greift kein Pop-up-Blocker. Danach kommt die Szene auf den Tisch.
  - „Regie öffnen“ bzw. „Nur privat lesen“ öffnet bzw. fokussiert das Fenster auf dieser Szene.
  - Ein schon offenes Fenster wechselt über den gemeinsamen Fokusschlüssel die Szene und wird nicht neu geladen.
- **Rückfall:** Blockiert der Browser das Fenster, öffnet sich wie bisher der Schuber, und es erscheint ein Hinweis.
- Der Rail-Eintrag „Regie (privat)“ bleibt als Schnellblick am Tisch.

## 2. Dauerhaftes Bereichsmenü im Regie-Fenster

- Unter der Kopfzeile steht eine feste Leiste, die beim Scrollen sichtbar bleibt.
  - **Textbereiche:** Erzählung, Atmosphäre, Dialoge, Interaktion, Geheimnisse, Folgen, SL-Notizen.
  - **Weitere Bereiche:** Material, Ton & Musik, Effekte, NPCs, Pager, Tisch.
- Ein Textbereich ersetzt die Lesespalte direkt, ohne Aufklappen.
- Die übrigen Bereiche werden in ihrer Spalte geöffnet, in den Blick gescrollt und kurz markiert.
- Leere Textbereiche erscheinen gestrichelt („Nichts vorbereitet“).
- Mit Alt+1 bis Alt+9 springt man per Tastatur zu den ersten neun Bereichen.
- Der zuletzt angesehene Bereich bleibt nach dem Neuladen erhalten (`localStorage`, pro SL-Konto).
- Die vier Spalten-Überschriften bleiben bestehen.

## 3. Atmosphäre

- **Nebel bewegt sich jetzt sichtbar.** Drei Nebelbänke ziehen in 14 bis 27 Sekunden über rund 30 % der Breite und schwellen dabei an und ab. Vorher war es nur eine Verschiebung um ±8 % in 38 Sekunden, praktisch Stillstand.
- **Neue Effekte:**
  - Gewitter: Schlagregen, dunkler Himmel und zwei kurze Blitze alle 11 Sekunden, weit unter 3 Blitzen pro Sekunde.
  - Schnee
  - Funken & Glut
  - Dunkelheit: Vignette, die die Tischmitte lesbar lässt
  - Flackerlicht: weiches, unregelmäßiges Abdunkeln ohne harte Blitze
- **Übergänge:** Neue Effekte blenden in 1,8 Sekunden ein, beendete in 2,2 Sekunden aus.
  - Im Regie-Fenster gibt es die Option „Überblenden: Wahl ersetzt laufende Effekte“. Dann wechselt die Atmosphäre in einem einzigen Bühnenbefehl, und alt und neu überblenden sich.
  - „Alle beenden“ blendet alles aus.
- **`prefers-reduced-motion` sowie die eigene Einstellung „Bewegung reduzieren“:** stehende Bilder, keine Blitze, kein Flackern. Die Ein- und Ausblendung bleibt.
- **Leistung:** Animiert werden nur `transform` und `opacity`. Unschärfe liegt statisch auf eigenen Ebenen; Regen ist unverändert. Es gibt kein Canvas und kein JavaScript pro Frame.

## 4. Pager-Fehler

**Ursachen:**

1. Die SL hat am eigenen Spieltisch getestet. Dort wird bewusst kein Spieler-Pager gezeigt (`!a.gm`), also sah die SL nichts.
2. **Echter Fehler bei Spielern:** Ist eine Medien- oder Leseansicht offen, ist das ein modaler Dialog. Er liegt im Top-Layer über dem Pager und macht den Rest der Seite inert. Der Pager kam also an, war aber verdeckt und nicht bedienbar. Am Live-Tisch ist „Groß einspielen“ häufig geöffnet.
   - Nachgestellt mit Absender „Schäfer“, Titel „Wichtig“, Text „Ruf mich an“ an „Alle“. A und B hatten den Pager im DOM, aber unter der Medienansicht.

**Geprüft und in Ordnung:**

- Polling alle 750 ms
- Snapshot `pagers` mit Empfänger `null`, also „alle“
- Prüfung auf den richtigen Run
- Deduplizierung über die ID
- Quittung

**Behebung:**

- Trifft bei einem Spieler ein neuer Pager ein, schließt der Tisch dessen persönliche Lese- oder Medienansicht. Die Medienansicht bleibt über „Aktuelle Medien öffnen“ wieder erreichbar.
- Dabei gab es eine Wettlaufsituation: Der Medien-Effekt öffnete den Dialog im selben Commit sofort wieder. Das Schließen läuft deshalb nach dem Commit.

**Pager-Spiegel für die SL am Spieltisch:**

- Er klappt bei jeder neuen Sendung kurz auf und faltet sich nach 12 Sekunden zu „Pager · n“ zusammen.
- Er zeigt Zeit, Empfänger und Lesestand, z. B. „Gelesen 1/2: Demo Spieler A“.
- Nachrichten an alle zeigt er mit Text.
- Bei gezielten Nachrichten erscheint nur „Gezielte Nachricht · Inhalt nur in der Regie“. Der Tisch kann auf einem geteilten Bildschirm laufen.
- Der Spiegel quittiert nichts. Spielerrechte und Spieler-Snapshots bleiben unverändert.

**Regressionstest:** Browsertest `tests/regie-nachbesserung-browser.mjs` (siehe unten).

## 5. Musik von YouTube

- **Vorbereiten:** im Command Center unter Szene › Atmosphäre › „Musik von YouTube“.
  - Bis zu 8 Stücke.
  - Den Link prüft die Funktion `youtubeVideoId`: watch, youtu.be, embed, shorts, live, music, m., nocookie oder eine nackte ID.
  - Gespeichert werden nur Titel und Video-ID.
- **Abspielen in der Regie** (Spalte „Ton & Video“, Block „Musik von YouTube“):
  - Vorbereitete Stücke starten „für alle“, oder ein freier Link wird eingegeben.
  - Daneben gibt es „Neu starten“ und „YouTube stoppen“.
  - Der Bühnenstand trägt `youtube: {videoId, title, key}`. Ein neuer `key` bedeutet einen Neustart für alle.
- **Am Tisch, einschließlich der SL:**
  - Ohne persönliche Einwilligung lädt nichts von YouTube: kein Skript, kein iframe, kein Vorschaubild.
  - Ein Hinweis nennt YouTube bzw. Google und die Übertragung der IP-Adresse.
  - „YouTube laden & abspielen“ wahlweise mit „Für diesen Browser merken“; widerrufbar über „Einwilligung widerrufen“.
  - Danach läuft die offizielle IFrame-Player-API mit `host: https://www.youtube-nocookie.com`, Schleife, `playsinline` und `origin`.
  - Lautstärke, Stumm und Pause regelt jeder für sich.
  - „Player für mich schließen“ hält nur die eigene Wiedergabe an, bis zum nächsten Start durch die SL.
  - Kein Autoplay-Zwang: Startet der Browser nicht, gibt es einen Abspiel-Knopf.
- Der Player bleibt sichtbar (200 px hoch), wie es die Einbettungsregeln von YouTube verlangen. Es wird nichts heruntergeladen oder umgewandelt.
- **CSP und Header:**
  - Für Seiten gibt es derzeit keine CSP. Nur Datei- und Medienrouten setzen `default-src 'none'; sandbox`.
  - Die Einbettung funktioniert daher ohne Änderung. Die standardmäßige Referrer-Policy des Browsers sendet den Origin, was YouTube erwartet.
  - Kommt später eine Seiten-CSP, braucht sie `script-src https://www.youtube.com https://s.ytimg.com` und `frame-src https://www.youtube-nocookie.com`.
- Die Datenschutzseite ist noch ein Platzhalter. Der YouTube-Hinweis gehört vor dem echten Einsatz in die Datenschutzerklärung (Aufgabe des Projektinhabers).

## 6. Notiz: „Weiteres Material der Kampagne“ und „weitere“ (nicht umgesetzt)

- **Was dort landet:** Der Katalog umfasst alle Dateien der Kampagne, die der SL gehören oder für Gruppe/SL sichtbar sind, als Bild, PDF, Audio oder Video.
  - Sortiert ist nach Namen, begrenzt auf 300.
  - Darin landen auch Charakterporträts, Avatare, Kartenbilder, von Spielern hochgeladene Gruppendateien und Szenenbilder anderer Szenen.
  - Ohne Typ, Herkunft oder Szenenbezug wirkt das chaotisch.
- In der Regie werden davon nur 40 Einträge gezeigt. Dass es mehr gibt, ist nicht erkennbar.
- **„Für alle“ legt mit einem Klick sofort für die ganze Runde auf**, ohne Vorschau und ohne Empfängerwahl. Das ist ein Risiko für versehentliche Freigaben.
- Der Bühnenhintergrund unter „Anderes Bild wählen“ greift auf denselben ungefilterten Bildkatalog zurück.
- Die Rail-Bereiche „Figuren“ und „Dokumente“ zeigen alle NPC- und Handout-Akten der Kampagne.
- **Datenleck: keines gefunden.**
  - Katalog, Szenenliste und Regie-Kontext gibt es nur für die SL (`a.gm && includeCatalog`, Regie-Route `gmOnly`).
  - Spieler-Snapshots tragen keinen Katalog und keine Texte aus dem Regie-Kontext. Die Integrationstests prüfen das mit dem Marker `SL_PRIVATE_SECRET`.
  - Bühnen-Assets liefert der Server nur für freigegebene Objekte.
- **Vorschlag für später:**
  - Katalog nach Typ und Herkunft gliedern (Szene, Kampagne, Charaktere ausgeschlossen).
  - Vorschau vor der Freigabe.
  - Empfängerwahl wie bei den Szenenmaterialien.

## Daten und Schema

- **Keine D1-Migration.** Alle neuen Felder sind optional in den strikten Zod-Parsern.
  - **Bühnenstand:** `youtube` (nullable, optional); Effekte erweitert um `storm`, `snow`, `embers`, `darkness`, `flicker`.
  - **Neuer Bühnenbefehl `youtube`:** nur SL, serverseitig geprüft.
  - **Szenendokument:** `youtube[]` (optional; `{id, title, videoId}`).
- Ältere Stände und Szenen bleiben unverändert gültig; das ist per Unit-Test geprüft.
- **Rückfall auf `732bc758`:** Die alte Version parst strikt.
  - Ein Abend mit neuen Effekten oder YouTube-Musik kann dann mit 409 antworten. Vorher Effekte und YouTube stoppen oder den Abend beenden.
  - Szenen mit vorbereiteter YouTube-Musik lassen sich in der alten Version nicht laden oder speichern. Die Stücke vorher entfernen oder Fix-forward.
- Produktive Daten wurden nicht angefasst.

## Tests (alle gegen die isolierte Instanz `--ultio-pager`, Port 8881)

- `pnpm test`: 210/210, darunter neu `tests/regie-nachbesserung.test.mjs` mit Effekten, YouTube-Link-Prüfung, Rechten und Rückwärtskompatibilität.
- Typecheck grün. ESLint ohne Fehler außerhalb von `prototypes/`; die 12 Fehler dort sind älter und unverändert. Produktionsbuild grün.
- **Integration mit SL, A und B:**
  - neu `tests/regie-nachbesserung-integration.mjs`
  - `ultio-pager-integration`
  - `regie-zweitfenster-integration`
  - `zustandswerte-integration`
  - `spieltisch-regie-integration`
  - `spieltisch-medien-integration`
  - Alle grün.
- **Browser (Edge/Playwright):**
  - Neu `tests/regie-nachbesserung-browser.mjs` mit Regie-Fenster und Spieltisch bei 1920, 1440 und 125 % sowie Spieler bei 375 px. Er prüft:
    - Szenenwahl öffnet das Fenster
    - Bereichsmenü und Wiederherstellen nach dem Neuladen
    - Pager an alle über einer offenen Medienansicht bei A und B
    - SL-Spiegel mit Lesestand; gezielter Text bleibt verborgen
    - Nebel bewegt sich; neue Effekte; Überblenden
    - reduzierte Bewegung
    - YouTube-Hinweis ohne jede Anfrage an YouTube vor der Einwilligung
  - `ultio-pager-browser`, `regie-zweitfenster-browser` und `erzaehlung-ux-browser` sind grün.
- **Angepasste Tests:**
  - `ultio-pager-browser`: Die SL bekommt weiterhin kein Pager-Gerät; der neue „Pager-Spiegel“ ist ausgenommen.
  - Port 8881 ist in den Allowlists ergänzt.
  - `spieltisch-regie-ux-browser`: Die Szenenwahl öffnet jetzt das Fenster, danach wird der Schuber geprüft. Dieser Test gehört zur älteren Fixture (Port 8830/8834) und wurde hier nicht ausgeführt.
- Nicht automatisiert: das tatsächliche Abspielen eines YouTube-Videos (externer Dienst). Bitte einmal von Hand mit einem eigenen Link prüfen.

## Lokale Testinstanz

```powershell
cd C:\Users\Stenz\Documents\ChroniPlay-Claude\cvk-regie-fix
$env:PATH = "C:\Users\Stenz\AppData\Local\OpenAI\Codex\runtimes\cua_node\5c41f77a7900391c\bin;" + $env:PATH
.\scripts\start-regie-nachbesserung.ps1          # http://127.0.0.1:8881 (-Build zum Neubauen, -Reset für frischen Speicher)
```

- **Anmelden:** SL `command-gm@example.invalid`, Spieler `command-a@` bzw. `command-b@example.invalid`. Das Passwort steht in `scripts/test-local.mjs`.
- **Seiten:** Spieltisch `/spielbereich?bereich=sitzung`, Regie `/sl/regie`, Vorbereitung `/sl/command-center`.
- **Tests:**
  - `$env:CVK_TEST_URL='http://127.0.0.1:8881'`
  - `node --experimental-strip-types tests/regie-nachbesserung-integration.mjs`
  - `node tests/regie-nachbesserung-browser.mjs`, dazu `CVK_PLAYWRIGHT_MODULE` und `CVK_PLAYWRIGHT_CHANNEL=msedge` setzen
