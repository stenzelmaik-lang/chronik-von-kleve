# Erzählungsansicht am Spieltisch (UX-18 bis UX-21)

Stand 30.10.2026 · Branch `claude/erzaehlung-ux`, abgezweigt von `claude/release-charakter-postfach` (`6c50969`, entspricht Live-Version `c6b88d01`). Nur lokal committet. Es gab keinen Push, keine PR, kein Deployment und keine Migration. Server, API, Datenmodell und die HTML-Aufbereitung inklusive Sanitizing sind unverändert.

## Lokale Testinstanz

```powershell
.\scripts\start-erzaehlung.ps1          # vorhandenen Build starten
.\scripts\start-erzaehlung.ps1 -Build   # vorher neu bauen (Server muss gestoppt sein)
```

- Adresse: `http://127.0.0.1:8864/anmelden`, danach „Spielabend“ → Spieltisch. Der synthetische Abend startet beim ersten Start automatisch. Speicher: `.local-test/zustandswerte` in diesem Worktree.
- Konten: `command-gm@`, `command-a@` und `command-b@example.invalid` (Passwort in `scripts/test-local.mjs`).
- SL: „Szenen des Abends“ → Szene 01 → „Erzählung zeigen“. Die Kaserne-Szene enthält jetzt einen langen synthetischen Vorlesetext mit Überschriften, Zitat, Listen und Tabelle. Er endet mit „Ende des synthetischen Vorlesetextes …“.

## Vorher / Nachher

| Thema | Vorher | Nachher |
|---|---|---|
| Lesefläche | Höchstens 36 % der Bühnenhöhe, maximal 720 px breit | Kompakt bis Bühnenhöhe minus Kopf- und Fußbereich (bei 1080p etwa 790 px statt 350 px), bis 780 px breit. Kurze Texte bleiben klein. |
| Vergrößerung | Keine | Persönlicher **Lesemodus** (Symbol ⤢): mittig bis 1120 px breit, fast volle Höhe, Text auf 72 Zeichen pro Zeile begrenzt |
| Schriftgröße | Fest 15 px | Persönlich 85–150 % in fünf Stufen (−/+), auf 17 px (Lesemodus 19 px) aufgebaut |
| Scroll-Container | Die ganze Box scrollte. Der Sticky-Kopf lag unter 18 px Innenabstand, sodass Text oberhalb des Kopfes durchlief. | Nur der Textkörper scrollt. Kopf und Titel liegen fest darüber. Unten 28 px Abstand, `overscroll-behavior: contain`. |
| Überlagerungen | Das Etikett „Gemeinsame Bühne“ (Ebene 5) lag über der Kopfzeile der Erzählung | Die Erzählung beginnt unter dem Etikett und dem Kontext-Knopf. Die Zustandsanzeige und das Würfeldock bleiben frei. Im Lesemodus blendet die Bühne die eigene Zustandsanzeige aus, wie bereits bei offenen Panels. |
| Typografie | Allgemeine RichText-Ansicht | Nur für die Bühnenerzählung: Georgia mit 1,72 Zeilenhöhe, Überschriften in Messing mit Goldlinie, Kapitälchen für H3, Listen mit Markern, Zitat mit Goldkante, Tabellen mit Kopfton und Zebrastreifen |
| Persönliche Ansicht | Nur Einklappen für Spieler, nicht gespeichert | Schriftgröße, Lesemodus und Scrollposition je Freigabe in `localStorage` unter `chroniplay:erzaehlung:<Lauf>:<Person>`. Gespeichert werden höchstens 12 Positionen. |

Das Spieltisch-Layout, die Freigabelogik, „Für alle entfernen“ (SL) und „Erzählung nur für mich einklappen“ (Spieler) bleiben gleich. Neu ist nur die Komponente `app/spielbereich/modules/spieltisch/narration.tsx` mit `narration.module.css`. `stage.tsx` bindet sie ein und blendet die Zustandsanzeige im Lesemodus aus.

## Sicherheit und Isolation

- Die Erzählung zeigt weiterhin nur `snapshot.sceneInfo` an, also das, was der Server für diese Person freigegeben hat. SL-Geheimnisse erreichen Spielerclients nicht; der Test prüft das per API.
- Scrollen, Schriftgröße und Lesemodus senden nichts an den Server; der Test zeichnet dafür alle Nicht-GET-Anfragen auf. Eine Scrollbewegung ändert nie die Ansicht anderer.
- `RichTextView`, die `cvk-html-v1:`/`cvk-rich-v1:`-Verarbeitung und das Sanitizing sind unverändert.

## Tests

Instanz auf Port 8864 mit Edge (`CVK_PLAYWRIGHT_CHANNEL=msedge`, Playwright aus der Codex-Laufzeit über `CVK_PLAYWRIGHT_MODULE`).

| Prüfung | Ergebnis |
|---|---|
| `pnpm test` | 190/190 grün |
| `pnpm typecheck` | grün |
| `pnpm build` | grün |
| ESLint der geänderten Dateien | ohne Befund. `pnpm lint` meldet weiterhin nur die bekannten 12 Fehler in `prototypes/spieltisch-2`; die CI lintet deshalb nur eine Dateiliste. |
| `tests/spieltisch-regie-integration.mjs` | ALL PASS |
| `tests/live-stage.test.mjs` + `tests/spieltisch-medien-integration.mjs` | ALL PASS |
| **Neu:** `tests/erzaehlung-ux-browser.mjs` | ALL PASS für SL, Spieler A und Spieler B bei 1920×1080, 1440×900, echtem 125-%-Zoom (1536×864 bei Pixelverhältnis 1,25) und 375×812 (Handy) |
| `tests/spieltisch-regie-ux-browser.mjs` (vorhandener Test) | Die Phasen zur Erzählung (persönliches Einklappen, Entfernen für alle, erneutes Zeigen, Schließen-Knopf) und alle Drawer-Phasen sind grün. Danach scheitert der Test an der veralteten Beschriftung „Regie öffnen“ für Szene 02, die seit `aaacd3e` „Nur privat lesen“ heißt. Das ist bereits vorhanden und nicht Teil dieses Auftrags. |

Der neue Browsertest prüft je Rolle und Viewport:

- keinen horizontalen Überlauf
- die Erzählung innerhalb der Bühne, ohne Verdeckung durch Etikett, Kontext- oder Regie-Knopf, Zustandsanzeige oder Würfeldock
- dass der Kopf nie über dem Text liegt
- dass die letzte Zeile am Scrollende vollständig sichtbar ist
- dass Scrollen von A weder SL noch B bewegt
- dass Schriftgröße und Lesemodus nur bei A wirken
- dass alles nach einem Neuladen wiederhergestellt ist

Die Screenshots liegen lokal unter `.local-work/ux-check/erzaehlung/` (nicht versioniert).

```powershell
$env:CVK_TEST_URL='http://127.0.0.1:8864'; $env:CVK_PLAYWRIGHT_CHANNEL='msedge'
node tests/erzaehlung-ux-browser.mjs
```

## Offene Punkte

1. `tests/spieltisch-regie-ux-browser.mjs` an die Beschriftung „Nur privat lesen“ anpassen. Das ist ein eigenständiger, bereits bestehender Fehler.
2. Auf 375 px überlappen sich in der Kopfleiste die Teilnehmernamen mit dem Abendtitel. Das ist bereits vorhanden und nicht Teil der Erzählung.
3. Die Leseansicht der Spielleitung im Regie-Drawer und die ältere `scene-player-view` nutzen weiter die allgemeine RichText-Darstellung. Sie lassen sich bei Bedarf mit denselben Typografieregeln angleichen.
4. Die Scrollposition wird anteilig gespeichert. Ändert sich der Text einer laufenden Freigabe stark, springt die Position entsprechend mit.

## Live-Release 30.10.2026

- Auf Anweisung des Projektinhabers („live push bitte“) veröffentlicht. Stand `65a1468`, aufbauend auf dem Release `claude/release-charakter-postfach` (`6c50969`, PR #45).
- Worker `chronik-von-kleve`, Version `482ef8d5-7e05-4722-be09-4ee99ac7c669`, Tag `erzaehlung-ux`, 100 % Verkehr. Bindings unverändert.
- Rückfallversion: `c6b88d01-cb27-467e-8d0a-333503ade398`. Sie ist voll kompatibel, weil reine Oberflächenänderung ohne Daten- oder Schemaänderung. Die persönlichen Leseeinstellungen liegen nur im Browser.
- Time-Travel-Lesezeichen vor dem Deploy: `0000018c-00004c7c-00005114-3fbdebf8edb29002a6cf89900d75ff2a`.
- Prüfungen vor dem Deploy:
  - Typecheck, ESLint, `pnpm test` (190/190) und Build sind grün.
  - Regie-, Medien- und Zustandswerte-Integration mit SL, Spieler A und Spieler B sind grün.
  - Der Browsertest `tests/erzaehlung-ux-browser.mjs` ist bei 1920, 1440, 125 % und 375 px grün.
- Live-Prüfung ohne Anmeldung:
  - `/anmelden` antwortet mit 200; Spielbereich und SL leiten mit 307 weiter.
  - Bühne, Live-Tisch, Nachrichten und Datensätze antworten mit 401 und `private, no-store`.
