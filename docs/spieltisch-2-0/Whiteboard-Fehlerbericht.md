# Whiteboard am Spieltisch – Fehlerbericht

Stand 01.11.2026 · Branch `claude/whiteboard-2` von `origin/main` `c9e1d81` · nicht gepusht, nicht deployt.

Drei gemeldete Fehler des Projektinhabers. Die Ursachen wurden vor jeder Änderung am alten Stand untersucht: im Code und an einer isolierten Instanz (`scripts/test-local.mjs --ultio-pager`, Port 8897, nur synthetische Konten). Dazu liefen zwei Messskripte mit echten Browsern (Edge über Playwright), Ergebnisse unten.

Betroffene Stellen: `app/spielbereich/modules/board-editor.tsx` (Komponente `BoardEditor`), `app/spielbereich/modules/spieltisch/stage.tsx` (Abfrage und Bühnenbefehl `board`), `app/spielbereich/modules/spieltisch/stage-client.ts`, `app/api/live-table/route.ts` (Aktionen `draw`, `edit`, `remove`, `clear`).

## 1. Global löschen funktioniert nicht

**Befund:**
- **Auf dem Spieltisch gibt es keinen Knopf zum Leeren.**
  - Der Server kennt die Aktion `clear` (nur SL).
  - Aufgerufen wird sie nur im alten Whiteboard-Bereich (`live-table.tsx`, Knopf „Whiteboard leeren“). Der Spieltisch bindet nur den `BoardEditor` ein, und der hat keinen solchen Knopf.
- **Der einzige Lösch-Knopf (Papierkorb) löscht nur das ausgewählte Objekt.**
  - Ohne Auswahl ist er gesperrt. Ausgewählt wird nur mit dem Auswahlwerkzeug oder über die Liste unten.
  - Messung: Für die SL ohne Auswahl ist der Papierkorb gesperrt; Knöpfe mit „leeren“ oder „für alle“ gibt es nicht (`clear control: 0`).
- **Nach einem abgelehnten Strich ist zusätzlich alles gesperrt.**
  - Der Entwurf (`pending`) blockiert Werkzeuge, Papierkorb, Rückgängig und jedes weitere Zeichnen, bis man ihn verwirft (siehe Fehler 2).

## 2. Striche verschwinden nach einiger Zeit

Es gibt zwei Ursachen.

**Hauptursache: Das Whiteboard läuft voll, danach gehen neue Striche verloren.**
- **Wo die Striche liegen:**
  - Alle Striche liegen im selben D1-Datensatz wie die ganze Bühne (`room.stage`: Objekte, Dokumenttexte, Pager).
  - Der Server nimmt neue Striche nur an, solange dieser Datensatz kleiner als 180 000 Zeichen ist.
- **Warum er schnell voll ist:**
  - Ein Freihandstrich wurde mit bis zu 128 Punkten gespeichert, siehe Fehler 3.
  - Messung: Nach rund 130 Strichen war Schluss (`board full … status 409 … json bytes 179873`).
  - Mit langen Dokumenten auf der Bühne kommt das Ende entsprechend früher.
- **Was dann geschieht:**
  - Jeder weitere Strich wird abgelehnt.
  - Der Editor zeigt ihn als Entwurf und sperrt sich (`can draw again: false`).
  - Beim nächsten Laden, beim Leeren oder beim Verwerfen ist der Strich weg. Gespeichert wurde er nie.
  - Auf dem Spieltisch kann die SL das Board nicht leeren (Fehler 1). Der Zustand bleibt also bestehen.
  - Solange der Entwurf hängt, gilt der Editor als „in Bearbeitung“ (`boardDirty`). Die Bühne fragt dann gar nicht mehr ab: Pager, Szenen und fremde Striche kommen bei diesem Spieler nicht mehr an.

**Nebenursache: Veraltete Abfragen überschreiben kurz den neuen Stand.**
- **Ablauf:**
  - Die Bühne fragt alle 1,5 s ab (`refresh`). Eine Abfrage wird nur übersprungen, wenn beim *Start* gezeichnet wird.
  - Läuft eine Abfrage schon, während ein Strich gespeichert wird, kommt ihre Antwort nach dem neuen Stand an. Sie wird trotzdem übernommen (`accept`), ohne Prüfung der Reihenfolge.
  - Der Strich verschwindet dann bis zur nächsten Abfrage.
- **Dasselbe Muster ist bekannt:** Der Pager-Fehlerbericht beschreibt es als „älterer Stand, danach wieder der neue“.
- **Nachweis:** Im Messlauf nicht erzwungen; aus dem Code abgeleitet.

**Kein Befund:**
- Der Server schreibt den Datensatz immer nur gezielt (`json_set`, `json_insert`, `json_remove`) und prüft Kennung und Revision. Gleichzeitige Striche von A und B gingen nicht verloren (`parallel A+B: stored 2`, alle drei sehen dieselben 7 Objekte).

## 3. Bereits Gezeichnetes verändert sich von selbst

**Ursache: Der Stift dünnt den laufenden Strich immer wieder aus.**
- **Was der Code tut:**
  - Jede Mausbewegung fügt einen Punkt hinzu.
  - Bei 128 Punkten wird jeder zweite Punkt gelöscht (`points.filter((_,i)=>i%2===0)`), danach wird weiter angehängt.
- **Warum das den Anfang trifft:**
  - Der vordere Teil eines Strichs wird bei jedem weiteren Erreichen der Grenze erneut halbiert.
  - Nach drei Halbierungen hat der Anfang noch ein Achtel seiner Punkte, das Ende ist voll aufgelöst.
- **Was man sieht:**
  - Eine Kurve im vorderen Teil wird während des Zeichnens zu wenigen geraden Sehnen. Das passt genau zur Meldung „gerade, dann Kurve, dann gerade“.
  - Die Vorschau zeigt das live, gespeichert wird der vergröberte Strich.
- **Messung** mit 601 Mausbewegungen (gerade → Halbkreis → gerade):
  - Gespeichert wurden 89 Punkte.
  - Für den Halbkreis blieben **6 Punkte**.
  - Größte Abweichung vom gezeichneten Weg: 7,1 Einheiten (bei einer Fläche von 1000 × 600).
  - Unit-Test: `tests/board-sync.test.mjs`, Fall „old halving decimation deforms the early curve“.

**Begünstigende Ursache: Bestehende Objekte lassen sich zu leicht greifen.**
- **Trefferfläche:**
  - Jedes Objekt hat als Trefferfläche sein ganzes umschließendes Rechteck.
  - Das Auswahlwerkzeug ist voreingestellt.
- **Folgen:**
  - Wer in den Zeichenmodus wechselt und sofort zieht, verschiebt einen fremden Strich, sobald er irgendwo in dessen Rechteck beginnt.
  - Der Radierer löscht in diesem Rechteck ebenfalls.
- **Rechte:** Jeder Spieler durfte fremde Objekte verschieben und löschen. So verändern sich Striche anderer „von selbst“.

**Kein Befund:**
- Punkte werden auf dem Server nicht neu sortiert, nur gerundet.

## Behebung

Siehe `docs/spieltisch-2-0/Whiteboard-2.md`.
