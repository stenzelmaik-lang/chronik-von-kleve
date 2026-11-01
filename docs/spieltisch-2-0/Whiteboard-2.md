# Whiteboard 2.0 – Gemeinsame Skizze am Spieltisch

Stand 01.11.2026 · Branch `claude/whiteboard-2` von `origin/main` `c9e1d81` · nicht gepusht, kein PR, nicht deployt, keine Migration.

Die Ursachen der drei gemeldeten Fehler stehen in `Whiteboard-Fehlerbericht.md`.

## Was sich für die Runde ändert

**Zeichnen**
- Am Spieltisch links „Gemeinsam zeichnen“ öffnet die Skizze.
- Werkzeugspalte links:
  - Auswahl (V)
  - Stift (P)
  - Pfeil oder Linie (A)
  - Form: Rechteck oder Kreis (R)
  - Notiz (T)
  - Radierer (E)
  - Rückgängig/Wiederholen (Strg+Z, Strg+Umschalt+Z)
- Leiste unten:
  - sechs ruhige Farben: Gold, Blutrot, Knochenweiß, Türkis, Asche, Violett
  - drei Strichstärken
  - beim Pfeil die Wahl Pfeil oder Linie, bei der Form Rechteck oder Kreis
- Kopf oben:
  - „Meine löschen“: löscht alle eigenen Striche für alle
  - nur SL: „Sperren“/„Freigeben“ und „Für alle löschen“ (mit Bestätigung)
  - Schließen (auch mit Esc)
- **Auf dem Handy** liegen Werkzeuge und Farben unten, der Kopf zeigt nur Symbole.
- **Ausgeblendet im Zeichenmodus:** der Würfelknopf, „Kontext“ und das Bühnenschild. Nach dem Schließen sind sie wieder da.

**Auf dem Bühnenbild**
- Die Skizze liegt deckungsgleich über dem Bühnenbild, im selben Zuschnitt wie das Bild (`object-fit: cover`).
- Ein Pfeil auf eine Tür zeigt deshalb auf jedem Bildschirm auf dieselbe Tür.
- Ohne Bühnenbild füllt die Skizze die Bühne.
- Notizen bleiben auf jedem Bildschirm aufrecht und unverzerrt.
- Die Strichstärke wächst mit der Bildhöhe.
- Auf schmalen Bildschirmen ist wie beim Bild selbst ein Teil abgeschnitten.

**Rechte**
- Spieler verschieben, ändern und löschen nur ihre eigenen Objekte. Fremde Striche lassen sich mit ihren Werkzeugen nicht greifen.
- Die SL darf alles ändern, auch bei gesperrter Skizze. Ist die Skizze gesperrt, können Spieler nur noch zusehen und sehen den Hinweis „Von der SL gesperrt“.

**Entfernt**
- Persönliches Zoomen und Verschieben der Fläche: Die Skizze würde sich sonst vom Bühnenbild lösen.
- Objektliste als Auswahlfeld.
- Freier Farbwähler.
- Text-Dialog: Notizen werden jetzt direkt an der Stelle geschrieben.

## Technik

- **Stift**
  - Punkte werden nach Abstand gesammelt, einschließlich der zusammengefassten Zeigerereignisse des Browsers.
  - Schon gezeichnete Punkte werden nie verändert.
  - Erst beim Loslassen wird der Strich vereinfacht (Ramer–Douglas–Peucker, Toleranz 0,75 Einheiten) und, wenn nötig, in Teilstriche zu je höchstens 128 Punkten zerlegt.
  - Die Teilstriche schließen lückenlos aneinander und gelten als ein Rückgängig-Schritt.
  - Dargestellt wird der Strich als geglättete Kurve.
  - Gemessen weicht der gespeicherte Strich höchstens 0,56–0,71 Einheiten vom gezeichneten Weg ab (vorher 7,1).
  - Code: `domain/board-editor.ts` (`addStrokePoint`, `finishStroke`, `strokePath`).
- **Synchronisation**
  - Eigene Änderungen werden sofort angezeigt und der Reihe nach gesendet (`BoardOp`).
  - Sichtbar ist der Serverstand plus die eigenen Änderungen, die der Server noch nicht zeigt (`mergeBoard`).
  - Abgelehnte neue Striche bleiben sichtbar, mit „Erneut senden“ und „Verwerfen“. Abgelehnte Verschiebungen und Löschungen fallen auf den Serverstand zurück.
  - Weitergezeichnet werden kann immer.
- **Abfragen am Tisch** (`stage.tsx`)
  - Eine Abfrage, die schon lief, als ein neuerer Stand ankam, wird verworfen (Zähler `accepted`).
  - Skizzen-Befehle laufen neben den anderen Tischbefehlen: Sie warten nicht auf deren Sperre `saving` und setzen `busy` nicht.
  - Das Abfragen wird nicht mehr angehalten, solange gezeichnet wird. Vorher stand bei einem hängenden Entwurf die ganze Bühne still.
- **Server** (`app/api/live-table/route.ts`)
  - `edit` und `remove`: Spieler ändern nur eigene Objekte (403), auch in der SQL-Bedingung geprüft.
  - `clearMine`: löscht alle eigenen Objekte, fremde bleiben in ihrer Reihenfolge.
  - `lock` (nur SL): setzt das Feld `boardLocked` im Raum-Datensatz. Gesperrt antworten `draw`, `edit`, `remove` und `clearMine` für Spieler mit 423.
  - Eigene Grenze für die Skizze: 400 Objekte und 160 000 Zeichen nur für `elements`. Die Bühne im selben Datensatz zählt nicht mehr mit.
  - Ist die Skizze voll, kommt die klare Meldung „Die Skizze ist voll …“.
- **Datenmodell**
  - Neu sind das optionale Feld `width` (1–12) je Strich und `room.boardLocked`. Beides steckt im bestehenden JSON, eine D1-Migration ist nicht nötig.
  - Alte Striche ohne `width` werden mittelstark gezeichnet.
  - Ein älterer Build ignoriert beide Felder: Ein Rücksprung verliert also nur die Sperre und die Strichstärke.

## Prüfungen (beobachtet am 01.11.2026)

Isolierte Instanz: `$env:CVK_TEST_PORT='8897'; node --experimental-strip-types scripts/test-local.mjs --ultio-pager`. Nur synthetische Konten; keine Verbindung zu Produktion.

- `node --experimental-strip-types tests/whiteboard-integration.mjs` mit SL, Spieler A und Spieler B, alle Prüfungen bestanden:
  - **Fehler 1:** Die SL leert die Skizze für alle; Spieler bekommen 403, ein veralteter Stand 409.
  - „Meine löschen“ trifft nur eigene Objekte.
  - **Fehler 3:** Ein Strich gerade–Kurve–gerade wird unverändert gespeichert und ausgeliefert und bleibt über Abfragen gleich.
  - Rechte und Sperre.
  - **Fehler 2:**
    - 12 parallele Striche von A und B kommen bei allen an.
    - Eine volle Skizze meldet sich klar, Gespeichertes bleibt.
    - Die Bühne nimmt weiter Befehle an.
    - „Meine löschen“ schafft wieder Platz.
- `node tests/whiteboard-browser.mjs` (Edge über Playwright: SL 1440 px, A 1920 px, B 375 px Touch-Handy), alle Prüfungen bestanden:
  - Eine Kurve bleibt in A's Browser über 5 Abfragen (6,5 s) zeichengleich.
  - Sie kommt unverändert bei SL und B an.
  - 6 Striche aus zwei Browsern bleiben bei allen.
  - Radierer und „Meine löschen“ funktionieren, die Markierungen der SL bleiben.
  - Sperren und Freigeben funktionieren.
  - „Für alle löschen“ mit Bestätigung und Abbrechen funktioniert.
  - Die Handy-Leiste liegt im Bildschirm.
  - Keine Seitenfehler.
- **Screenshots** in `.local-work/ux-check/whiteboard-2/` (nicht im Repo):
  - `desktop-sl-1440.png`, `desktop-a-1920.png`, `handy-b-375.png`
  - `desktop-a-gesperrt.png`, `desktop-sl-bestaetigung.png`, `handy-b-leer.png`
- **Unit-Tests:**
  - `tests/board-sync.test.mjs` (neu, weist auch die alte Halbierung als Ursache nach) und `tests/board-editor.test.mjs` (angepasst). Beide sind jetzt in `pnpm test` aufgenommen.
  - Alle 67 Dateien `tests/*.test.mjs`: 465 von 466 bestanden. Fehlgeschlagen ist `tests/npc-data.test.mjs` („NPC workspace uses read panel …“). Er prüft nur `app/spielbereich/workspace.tsx` und `use-workspace-data.ts`; beide wurden hier nicht geändert. Der Fehler besteht also schon auf `main`, der Test steht nicht in `pnpm test`.
- **Typecheck und Lint** (`app server domain tests scripts`): ohne Befund.
- **CI-Integration** (`scripts/test-local.mjs` ohne Schalter, Port 8898, enthält `tests/live-game-integration.mjs`): 1932 Prüfungen bestanden, dazu 46 Rollen-Prüfungen. Einschließlich der angepassten Rechteprüfungen.

## Bewusst geänderte bestehende Prüfung

In `tests/live-game-integration.mjs` erwartete die Prüfung, dass Spieler B Objekte von A verschieben und löschen darf. Das widerspricht der neuen Rechteregel. Geändert:
- Erwartet wird jetzt 403 für B.
- Verschieben, Löschen und Textbearbeitung prüft A an eigenen Objekten.
- Der Gleichzeitigkeitstest läuft mit zwei Änderungen von A.

## Grenzen und offene Punkte

- Nicht auf einem echten Handy oder Tablet geprüft, nur in der Edge-Emulation mit Maus-Zeigerereignissen.
- **Handy:** Die Werkzeugleiste scrollt waagerecht. Rückgängig und Wiederholen liegen rechts außerhalb und sind erst nach Wischen sichtbar.
- **Bühnenbildwechsel:** Die Skizze bleibt stehen; die SL leert sie bei Bedarf. Eine Skizze je Szene gibt es nicht.
- **Alter Whiteboard-Bereich:** `live-table.tsx` bindet den `BoardEditor` in der Panel-Variante ein. Er wurde mitgebaut, aber nicht eigens im Browser geprüft.
- Kein Push, kein PR, kein Deployment.
