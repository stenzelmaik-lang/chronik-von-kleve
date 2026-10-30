# Spieltisch 2.0 – Etappe 1: Live-Regie und privater Regieschuber

Stand 30.10.2026 · Branch `claude/spieltisch-2-0-local` auf Basis `origin/main` `e3cce12` (SL-CMS 3.0) · ausschließlich lokal. Kein Push, kein Deployment, keine Migration.

## Reproduzierte Fehler und Ursachen

| Nr. | Beobachtung | Tatsächliche Ursache | Behebung |
| --- | --- | --- | --- |
| Szenenauswahl / F-04 / F-08 | „Neue Szene“, „Technische Prüfung …“ erscheinen alphabetisch in der Live-Szenenliste | `stageSnapshot` lieferte **alle** nicht archivierten Kampagnenszenen, ohne Bezug zum gestarteten Spielabend | Neue reine Funktion `liveSceneChoice` (nutzt das vorhandene `orderedSessionScenes`): Szenen des Abends in geplanter Reihenfolge, alle übrigen getrennt als „Weitere Szenen · Improvisation“. Nichts wird gelöscht oder umgeschrieben. |
| F-11 | „Privat ansehen“ legt die SL-Vorschau als Karte **auf die gemeinsame Bühne** | Vorschau-State wurde im Bühnenlayer gerendert | Vorschau entfernt; privater Regieschuber rechts. Auf der Bühne liegt nur Freigegebenes. |
| F-10 / F-12 | Nur Erzählung erreichbar, kein Wechsel zwischen Bereichen | Live-Tisch kannte nur `narration`; restliche sieben Bereiche fehlten | Regieschuber mit acht Bereichen (Erzählung … SL-Notizen, Material). Inhalt hängt ausschließlich an Szenen-ID + Bereich; geladene Szenen werden zwischengespeichert. |
| F-09 / F-15 | HTML/Tabellen sehen im Tisch anders aus als in der Editor-Vorschau | Editor-Vorschau nutzt `RichTextView readable flowing`, Live-Flächen nicht → keine Überschriften-, Absatz- und Tabellenstile | Live-Bühne, Lesefassung, Live-Szene und Spieler-Szenenansicht rendern einheitlich mit `readable flowing`. |

Nicht reproduziert (synthetische Daten): F-13 (unverständliche Fragmente). Dafür braucht es einen Blick auf den echten Bühnenstand; nicht blind geändert.

## Änderungen

- `server/live-stage.ts`: Szenen-Scope je Spielabend; neuer SL-Endpunkt `GET /api/live-stage?sessionId=…&regie=<sceneId>` (`gmOnly`, nur bei laufendem Abend) mit Szenentexten, NPC-Akten (Originalporträt über vorhandenen Asset-Pfad), Handouts und Szenenmedien. Kein neues Datenmodell.
- `domain/session-overview.ts`: `liveSceneChoice`.
- `app/spielbereich/modules/spieltisch/regie.tsx` (+CSS): privater Schuber. Lesen veröffentlicht nichts; Freigaben nur über beschriftete Aktionen („Erzählung zeigen · ganze Runde“, „Zeigen · …“, „Privat auf Bühne legen“) mit bestehender Zielgruppenauswahl.
- `stage.tsx`: Rail „Szenen des Abends“ + „Regie (privat)“, Bühnen-Default mit Atmosphäre statt leerer Fläche, Regie-Fokus je Lauf in `localStorage` (überlebt Neuladen, wird nie geteilt).
- `live-session.tsx`: atmosphärische Wartefläche für Spieler vor Spielstart.
- Wiederverwendet: bestehende Freigabepfade `showScene`/`showMedia` (`/api/live-table`), Bühnenobjekte `add`/`visibility`, Whiteboard (`BoardEditor`), Würfel, Teilnehmerleiste, Medien-/Dateiberechtigungen.

## Tests

- `pnpm test`: 146/146 (inkl. neuem Test für `liveSceneChoice`). Typecheck und ESLint der betroffenen Dateien grün. Produktionsbuild grün.
- `tests/spieltisch-regie-integration.mjs` gegen laufende isolierte Instanz mit drei getrennten Sitzungen (SL, Spieler A, Spieler B): Szenen-Scope, Regie nur für SL (Spieler 403/404 ohne Inhalt), Spieler-Snapshot ohne Katalog und ohne private Texte, gezielte Freigabe nur für A (B: 404 auch beim Direktabruf), Gruppenfreigabe nach Neuladen erhalten.
- Browser (SL und Spieler A, 1440×900): Tests 1–10 des Auftrags durchlaufen.

## Bekannte Einschränkungen

- Medienansicht öffnet sich nach Neuladen erneut automatisch (lokaler „geschlossen“-Zustand; vorbestehendes Verhalten).
- Freigegebene Bilder füllen die Bühne als Hintergrund; Bildkarte/Polaroid folgt in Priorität D.
- Regieschuber ist Lesen + Freigeben; Bearbeiten bleibt bewusst in der SL-Vorbereitung.
- Nachrichten-Dock unten und Probe anfordern sind noch nicht im Tisch.
- Tests ausschließlich mit synthetischen Daten. Persönliche Abnahme mit Originalmaterial steht aus.

## Ausprobieren

`Start-Spieltisch-2.cmd` (oder `pnpm demo:spieltisch`) → `http://127.0.0.1:8830/anmelden`. Synthetische Konten `command-gm@`, `command-a@`, `command-b@example.invalid` (Passwort im Fixture `scripts/test-local.mjs`). Daten liegen in `.local-test/spieltisch-2`; Ordner löschen setzt die Demo zurück.
