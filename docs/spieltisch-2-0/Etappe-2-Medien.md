# Spieltisch 2.0 – Etappe 2: Szenenbilder, Spielmaterial und immersive Medien

Stand 30.10.2026 · Branch `claude/spieltisch-medien` auf Basis `origin/main` `0b5c427` (enthält PR #40–#42 inkl. Codex-Nachbesserungen) · ausschließlich lokal getestet. Kein Merge, kein Deployment, keine Datenbankmigration.

## Workflow

Szene vorbereiten → **Atmosphäre: Szenenbild / Bühnenhintergrund** wählen oder hochladen → **Interaktionen & Spielmaterial:** Foto, Handout, Audio, Video mit Vorschau und Upload → Spielabend starten → Regie: **„Szene auf den Tisch bringen“** (Hintergrund für alle, Material der Vorszene abgeräumt) → **Material:** je Medium „Vorschau (nur SL)“, „Auf den Tisch · Zielgruppe“, „Vom Tisch nehmen“.

| Etappe | Umsetzung | Wiederverwendet |
| --- | --- | --- |
| A Szenenbild | `SceneBackdropPicker` (Galerie, Upload, Vorschau, Entfernen); Live-`backdrop` im Bühnenstand, Bild nur über `/api/live-stage/asset?objectId=backdrop` | `ProtectedImageGallery`, `/api/files`, Bühnen-Asset-Route |
| B Spielmaterial | Schnellbuttons Foto/Handout/Audio/Video, Karten mit Vorschaubild/Typ, Upload je Baustein, Hörprobe/Videovorschau, Status „vorbereitet, nicht veröffentlicht“ | bestehende `elements` (15 Typen), `PreparationMaterials` |
| C Polaroids | Bildkarte mit Rahmen, stabiler leichter Drehung, persönlicher Vergrößerung | Bühnenobjekt `document`/`file`, Leseansicht, Freigabe/Entfernen |
| D Audio | Kassettenrekorder: Abspielen, Pause, Neustart, eigene Lautstärke, Stumm, Fortschritt; kein Autoplay, Hinweis bei Blockade | Range-fähige Asset-Route |
| E Video/Handout | Röhrenbildschirm mit nativer Wiedergabe und Vergrößerung; PDF als Papier mit Lesefassung | `LivePdf`, Leseansicht |
| F Regie | Materialgruppen, Tischstatus je Medium, private Vorschau, Szenenaktivierung | Zielgruppenwahl, `add`/`visibility`/`remove` |

Zustände: *vorbereitet* (Szenendokument) → *privat in der Regie* (nur SL-Endpunkt) → *auf dem Tisch nur SL* / *für Zielgruppe* (Bühnenobjekt `visibility`/`recipients`) → *entfernt* (Objekt gelöscht, Asset-Abruf 404). Persönliches Schließen ändert nur die eigene Ansicht; „Vom Tisch nehmen“ ändert den gemeinsamen Stand.

## Schemaerweiterung (nur JSON, keine Tabelle, keine Migration)

1. `SceneDocument.backdropFileId` (optional, Standard `''`) im privaten Szenendokument. Alte Dokumente lesen sich unverändert.
2. Bühnenstand `stage`: optional `backdrop {fileId,title,sceneId}` und `sceneId`; Bühnenobjekte optional `media` (`image|audio|video|pdf`). Gespeicherte Stände ohne diese Felder bleiben gültig (Test).
3. Bühnenbefehle `backdrop`, `activateScene`; `add` optional mit `title`, `visible`, `recipients` (Empfänger serverseitig gegen die Runde geprüft).

**Rückfall:** Der alte Server parst strikt. Ein Rollback des Workers nach Nutzung des Szenenbildes lässt betroffene Szenen mit 409 „nicht unterstützter Stand“ lesen bzw. laufende Bühnen mit 409 antworten. Daten bleiben erhalten. Empfohlen: Fix-forward; alternativ vor Rollback laufenden Abend beenden und `backdropFileId` per kontrolliertem JSON-Update entfernen. Wie bei `visions` (SL-CMS 3) müssen Parser und Oberfläche gemeinsam veröffentlicht werden.

**Verhaltensänderung:** Die Bühne nutzt nicht mehr das erste Bildelement einer veröffentlichten Erzählung oder ein „Groß gezeigtes“ Medium als Vollbildhintergrund. Hintergrund ist ausschließlich das ausdrücklich gesetzte Szenenbild. „Groß zeigen“ bleibt als gemeinsame Medienansicht erhalten.

## Tests

- Typecheck, ESLint (betroffene Dateien), Produktionsbuild grün; `pnpm test` 146/146; `tests/live-stage.test.mjs` 5/5 inkl. neuem Medientest.
- `tests/spieltisch-medien-integration.mjs` (SL, Spieler A, Spieler B; echte Dateiabrufe): Spieler dürfen Hintergrund/Szene/Material nicht setzen (403); Hintergrund für A und B ladbar, Reset → 404; Polaroid nur für A, B weder im Stand noch per Objekt-ID oder Originaldatei; Entfernen wirkt für alle; Audio/Video per Range (206), PDF 200; Szenenwechsel räumt Material, alte Objekte 404, Hintergrund gewechselt; Neuladen stellt Stand her.
- `tests/spieltisch-regie-integration.mjs` (inkl. Codex-Erweiterungen) weiterhin grün.
- Browser: Szenenbild-Upload und Speichern im Editor, Video-Upload (WebM per Canvas aufgenommen), Szenenaktivierung, Polaroid/Kassette/Bildschirm/PDF beim SL; Spieler A: Polaroid vergrößern/schließen (bleibt liegen), Kassette abspielen/pausieren/Lautstärke/stumm, Video abspielen/vergrößern, Whiteboard ohne Nebenwirkung.

## Grenzen / offen

- Audio-Darstellung synchron, Ton nicht zeitgleich (bewusst).
- Externe Videoquellen (Links) nicht umgesetzt; nur hochgeladene Dateien.
- Bilder werden in Originalgröße geladen (lazy); serverseitige Vorschaubilder fehlen.
- Drag-and-drop im Editor nicht umgesetzt (Reihenfolge per Pfeilen wie bisher).
- Persönliche Abnahme mit Originalmaterial und Review durch Codex stehen aus.

## Ausprobieren

`Start-Spieltisch-2.cmd` → `http://127.0.0.1:8830/anmelden` (synthetische Konten wie Etappe 1). Bei bestehendem altem Testspeicher `.local-test/spieltisch-2` vorher löschen, damit die neuen Mediendaten angelegt werden.
