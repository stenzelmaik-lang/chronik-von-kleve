# Material am Tisch, Öffnen, Effekt-Vorschau und Einstecken

Branch `claude/material-tisch-inventar` auf `origin/main` `0fbfe8d`. Grundlage sind die Wünsche des Projektinhabers beim gemeinsamen Durchsehen des Anselmus-Pakets am 01.11.2026.

## 1. Objekt auf dem Tisch

- **Ohne Leiste und Rahmen:** Die Griffleiste über jedem Objekt (Titel, Auge, Griff) entfällt. Auf dem Tisch liegt nur noch das Objekt.
- **Feld wie das Bild:** Ein Material bekommt beim ersten Anzeigen das Seitenverhältnis seines Bildes. Auswahlrahmen, Griffe und Tooltip sitzen dadurch am Objekt selbst.
- **Verschieben:** Gedrückt halten und ziehen. Erst nach 5 Pixeln Bewegung zählt es als Ziehen, ein kurzer Klick bleibt ein Klick.
- **Nur die SL ordnet an:** Spieler verschieben, vergrößern und drehen nichts. Ausnahme sind ihre Notizzettel und Objekte, die sie selbst ausgelegt haben.
  - Die persönliche Anordnung für Spieler entfällt.
  - Der Server lehnte fremde Objekte schon vorher ab (403).
- **SL-Bedienung:**
  - Der erste Klick wählt aus und zeigt einen gestrichelten Rahmen mit Größen-Griff unten rechts und Dreh-Griff oben rechts. Der zweite Klick öffnet.
  - Spieler öffnen mit dem ersten Klick.
  - Tastatur: Pfeile verschieben, `+`/`−` ändern die Größe, `[`/`]` drehen.
- **Drehung:** Sie ist im Bühnenzustand als `rect.r` gespeichert, höchstens ±40°. Alle sehen sie gleich.
- **Auswahl-Leiste unten:** Nur noch für die SL bzw. den Besitzer, mit „Wieder nur SL / Für Zielgruppe zeigen“ und „Von Bühne nehmen“. Die Pfeil- und Plus/Minus-Knöpfe entfallen, weil die Griffe sie ersetzen.
- **Titel und Text:** Erscheinen als Tooltip beim Darüberfahren statt als Beschriftung unter dem Objekt.

## 2. Öffnen

- **Kein Fenster mehr:** Kein Rahmen und keine Kopfleiste. Der Tisch wird abgedunkelt.
  - Titel und Werkzeuge (Zoom, Effektton, Schließen) schweben dezent oben.
  - Der Text des Materials liegt hinter einem Info-Knopf als Tooltip, nicht mehr als weißer Kasten.
- **Direkt öffnen:** Der Klick auf dem Tisch öffnet bereits. Das geschlossene Objekt erscheint in der Mitte und öffnet sich von selbst; der Zwischenschritt „Öffnen“ entfällt.
- **An derselben Stelle:** Deckblatt und Seiten liegen am selben Platz, die Mappe verwandelt sich dort in die Seiten. Die Kurven sind weicher und überlappen zeitlich, damit nichts mehr ruckelt.
- **Seiten:** Ohne weißen Hintergrund, mit Schatten. Geblättert wird über Pfeile am Rand, Pfeiltasten oder Wischen; ein Seitenzähler steht unten.
- **Schließen:** Klick daneben, Escape oder ✕, jeweils mit Schließeffekt.

## 3. Bearbeiten: Verhalten & Effekte

- **Mini-Vorschau:** Jede Effekt-Karte zeigt die echte Darstellung (geschlossen, geöffnet, erste Seite) und spielt den Effekt beim Darüberfahren ab. Fehlen Zustandsbilder, zeigt sie den Ersatzeffekt.
- **Live-Vorschau daneben:** Sie spielt den gewählten Effekt in Schleife ab, mit Geschwindigkeit und Schließen. „Groß testen“ öffnet den echten Viewer.
- **Leichtgewichtig:** Die Vorschauen nutzen die gespeicherten Vorschaubilder (`?size=thumb`).
- **Neu:** Schalter „Spieler dürfen es einstecken“, standardmäßig an.

## 4. Einstecken ins Inventar

- **Einstecken:**
  - Spieler sehen beim Darüberfahren über ein freigegebenes Material „Einstecken“, ebenso im geöffneten Viewer.
  - Das Material verlässt den Tisch für alle.
  - Die Runde sieht kurz „<Charakter> hat „<Titel>“ eingesteckt.“
- **Im Inventar:**
  - Es wird ein normaler Inventar-Gegenstand: Kategorie Dokument, Tag `Spielmaterial`, Sichtbarkeit SL. Er liegt im Rucksack oder, wenn der voll ist, im Lager.
  - Am Gegenstand liegt ein Schnappschuss des Tischobjekts (`body.tableObject`): Dateien, Darstellungszustände, Effekt, Text.
  - Es gibt keine neue Tabelle und keine Migration.
- **Tasche am Tisch:** Neu in der Leiste der Spieler ist „Eingesteckt“. Dort lässt sich das Material privat ansehen oder wieder **auf den Tisch legen**. Dann liegt es für die ganze Runde dort, gehört dem Spieler (er darf es anordnen) und verlässt das Inventar.
- **Nur einmal:**
  - Solange jemand es trägt, kann die SL dasselbe vorbereitete Material nicht noch einmal auflegen (409).
  - Die Regie zeigt „Im Inventar von …“ und bietet **Zurückholen** an.
  - Ein Szenenwechsel räumt nur das Material der Szene ab. Was Spieler aus ihrem Inventar ausgelegt haben, bleibt liegen.
- **Dateizugriff:** `GET /api/inventory/material` liefert die Liste. Mit `?itemId=…&state=|page=|sound=` liefert es die Datei.
  - Berechtigt ist, wer den Gegenstand besitzt, oder die SL.
  - Andere Spieler bekommen 404.
- **Befehle:** `take`, `play`, `reclaim` im Bühnenbefehl. Jeder Schritt macht seinen Inventar-Teil rückgängig, wenn der Tisch nicht gespeichert werden konnte.

## Rückfall

Neue optionale Felder sind `rect.r`, `notice`, `material.takeable` im Bühnenzustand und `takeable` in Szenen.
- Ältere Builds lehnen sie ab, sobald sie gespeichert wurden. Vor einem Rückfall müssen der laufende Abend neu gestartet und gedrehte Objekte zurückgesetzt werden.
- Eingesteckte Gegenstände bleiben als Inventar-Gegenstände lesbar; ältere Builds ignorieren den Schnappschuss.

## Tests

- **Neu:** `tests/material-tisch-integration.mjs`, gegen `--material-3` grün:
  - Nur die SL ordnet an und dreht; die Drehung ist begrenzt.
  - Einstecken: Das Objekt verlässt den Tisch, die Meldung erscheint, alle sechs Seiten wandern mit, B hat keinen Zugriff.
  - Einzigartigkeit (409) und Halter in der Regie.
  - Wieder auslegen durch den Besitzer; der Besitzer ordnet an, B nicht; B steckt es ein; die SL holt es zurück und legt neu auf.
- **Angepasst:**
  - `material-3-browser.mjs`: kein „Öffnen“-Schritt, Zähler „Bild 1 / 6“, Brieftext im Tooltip.
  - `table-materials-browser.mjs`: Tastatur-Verschieben am Objekt statt an der Griffleiste.
- **Grün:**
  - Typecheck, Lint, 304 Unit-Tests, Build.
  - Material-3-Integration und -Browser (Desktop und 375 px), Live-Befund-Integration und -Browser.
  - Gegen `--regie`: `table-materials-browser` und `table-materials-edges-browser`.
  - Gegen `--ultio-pager`: Pager- und Regie-Integration und -Browser, Spieltisch-Medien.
  - CI-Durchlauf `story-browser-smoke` und `preparation-guide-browser`.
