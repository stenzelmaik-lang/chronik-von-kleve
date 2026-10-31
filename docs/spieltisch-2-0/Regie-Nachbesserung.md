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

## 7. Zustandswerte für die Runde (Nachtrag, gleicher Branch)

Neue Rückmeldung: Die SL steuert Zustände auch im Regie-Fenster. Spieler steuern ihre eigenen Werte, und alle sehen Blut, Willenskraft und Schaden der Runde.

- **Zwei neue Rundeneinstellungen** im Tischstand (`settings`-JSON, optional, keine Migration):
  - `roundView`: „Für alle sichtbar“ (Standard) oder „Nur eigene und freigegebene Figuren“.
  - `damageBy`: „Spieler trägt eigenen Schaden selbst ein“ (Standard) oder „Nur die SL“. Die SL kann immer korrigieren.
  - Umschaltbar im Zustandsfenster am Tisch (SL, „Steuerung & Freigaben“) und im Regie-Fenster.
  - **Bewusste Änderung am Live-Verhalten:** Ohne gespeicherte Einstellung gelten beide Standards sofort. Spieler sehen also Blut, Willenskraft und Schaden der anderen und können eigenen Schaden eintragen.
- **Server:**
  - Der Snapshot trägt neu `round`: pro Figur nur Name, Besitzer, Blut, Willenskraft und Gesundheit (Spur, Stufe, Status, Abzug). Generation, Blut pro Runde und persönlicher Stress fehlen.
  - Der vollständige Zustandsbogen (`characters`) bleibt eigen bzw. freigegeben.
  - Bei „Nur eigene“ sendet der Server fremde Figuren gar nicht.
  - Das Schadensrecht prüft `mayOperate`.
  - **Fremdsteuerung:**
    - Eine sichtbare fremde Figur antwortet mit 403.
    - Eine unsichtbare fremde Figur antwortet weiterhin mit 404.
    - Vorher war es immer 404, auch bei freigegebenen Figuren.
- **Live-Übersicht unten links** (in die bestehende `VitalsHud` eingebaut, kein zweites Panel):
  - Spieler sehen unter ihrem eigenen Block „Am Tisch“ die anderen Figuren mit Anwesenheitspunkt, Schadenskästchen, Blut und Willenskraft.
  - Die SL sieht wie bisher die Runde, jetzt ergänzt um Willenskraft und Anwesenheit.
  - Die Schadensstufe erscheint als Text, sobald jemand verletzt ist.
  - **Neuer Schaden:** Die Zeile blinkt bei allen rot und ruckelt kurz („Schaden!“). Bei reduzierter Bewegung färbt sie sich nur ein.
  - Auf dem Handy zeigt die Zeile Blut, Willenskraft und die Stufe.
- **Spieler-Menü in der Kopfleiste:** Ein Klick auf den eigenen Eintrag zeigt neben Profil, Bogen, Inventar, Nachrichten und AFK ein Dropdown „Wert ändern …“ mit Ausführen-Knopf.
  - Angeboten wird nur, was die Runde erlaubt: Willenskraft einsetzen, 1 Blut ausgeben, ggf. Blut trinken bzw. Normalschaden heilen, Schaden 1 Wucht/Tödlich/Schwer.
  - Der Server prüft jede Buchung.
- **Mobil:** Auf Handys lagen in der Kopfleiste alle Teilnehmer übereinander und über Logo und Abendtitel; das ist ein älterer Fehler. Jetzt stehen dort nur Avatare nebeneinander, der Name steckt im Bedienlabel. Abendtitel und „SPIELTISCH“ sind auf dem Handy ausgeblendet.
- **Platz für die Erzählung:** Der Block unten links meldet seine Höhe (`--vitals-reserve`). Die freigegebene Erzählung hält dann ihren unteren Rand darüber, statt fest 230 px freizulassen.
- **Regie-Fenster:** Neuer Bereich „Zustände“ im Menü, Block „Zustände der Runde“ oben in der Spalte „Spielfeld & Effekte“.
  - Pro Figur: Anwesenheit, Schadensspur, Blut ±, Willenskraft ±, Schaden +/ +X +* und Heilen, persönlicher Stress ±.
  - Für die Runde: Gruppenstress ±, Maskerade ± (nur wenn für die SL sichtbar), „Neue Nacht“ mit Rückfrage, die beiden Rundeneinstellungen.
  - Alles läuft über die vorhandenen `/api/live-vitals`-Befehle.
- **Tests:**
  - Unit: drei neue Fälle in `tests/regie-nachbesserung.test.mjs` (Standards, alte Stände, Schadensrecht).
  - Integration: neu `tests/zustandswerte-runde-integration.mjs` mit SL, A und B: Sichtbarkeit, nur die drei Werte, eigene Steuerung, Fremdsteuerung 403, Einstellungen nur SL, Schadensmodus, Live-Aktualisierung, „nicht sichtbar heißt nicht gesendet“.
  - Browser: neu `tests/zustandswerte-runde-browser.mjs` bei 1920, 1440, 125 % und 375 px: Übersicht unten links, Dropdown, Schadens-Effekt bei SL und B, Korrektur im Regie-Fenster, Handybreite.
  - **Angepasst:** `tests/zustandswerte-integration.mjs` prüft jetzt ausdrücklich die restriktiven Einstellungen. Eine freigegebene fremde Figur antwortet dort mit 403 statt 404.
- **Offen bzw. bewusst nicht gemacht:**
  - Spieler können Schaden nur in Einheiten von 1 Stufe eintragen. Mehrere Stufen trägt man mehrfach ein; im Zustandsfenster des Tisches geht es auch mit Stufenzahl.
  - Spieler können eigenen Schaden nicht selbst heilen, außer mit „Normalschaden mit Blut heilen“ im Profil „Erweitert“. Fehleinträge korrigiert die SL.
  - Die Übersicht zeigt höchstens 5 andere Figuren (SL: 6), dann „+n weitere“.
  - Ist eine Figur verletzt, wird der Block unten links eine Zeile höher. Bei sehr großen Runden und gleichzeitig freigegebener Erzählung kann er deren unteren Rand berühren.
  - Ein Verlauf der Spieler-Buchungen im Regie-Fenster fehlt. Am Tisch zeigt die SL ihn wie bisher unter „Verlauf“.

## Daten und Schema

- **Keine D1-Migration.** Alle neuen Felder sind optional in den strikten Zod-Parsern.
  - **Bühnenstand:** `youtube` (nullable, optional); Effekte erweitert um `storm`, `snow`, `embers`, `darkness`, `flicker`.
  - **Neuer Bühnenbefehl `youtube`:** nur SL, serverseitig geprüft.
  - **Szenendokument:** `youtube[]` (optional; `{id, title, videoId}`).
  - **Tischstand der Zustandswerte** (`settings`-Schlüssel `table-vitals:<Kampagne>`): `roundView`, `damageBy` (optional).
- Ältere Stände und Szenen bleiben unverändert gültig; das ist per Unit-Test geprüft.
- **Rückfall auf `732bc758`:** Die alte Version parst strikt.
  - Ein Abend mit neuen Effekten oder YouTube-Musik kann dann mit 409 antworten. Vorher Effekte und YouTube stoppen oder den Abend beenden.
  - Szenen mit vorbereiteter YouTube-Musik lassen sich in der alten Version nicht laden oder speichern. Die Stücke vorher entfernen oder Fix-forward.
  - Ein Tischstand mit `roundView`/`damageBy` macht die Zustandswerte in der alten Version unlesbar (409). Vor einem Rollback die Einstellungen nicht ändern bzw. den Eintrag bereinigen.
- Produktive Daten wurden nicht angefasst.

## Tests (alle gegen die isolierte Instanz `--ultio-pager`, Port 8881)

- `pnpm test`: 213/213, darunter neu `tests/regie-nachbesserung.test.mjs` mit Effekten, YouTube-Link-Prüfung, Rechten und Rückwärtskompatibilität.
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
- Hinweis: Der erste Browserlauf direkt nach einem Kaltstart der Instanz lief zweimal beim Erzählungstest in einen Timeout. Ein Folgetest scheiterte dann am liegengebliebenen Zustand. Wiederholt waren alle Läufe grün.
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
