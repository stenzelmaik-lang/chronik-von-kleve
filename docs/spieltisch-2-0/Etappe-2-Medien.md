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

## Nachbesserung nach erster Live-Sichtung

- **Szene starten:** Hauptaktion in „Szenen des Abends“. Bringt die Szene auf den Tisch (Szenenbild automatisch für alle, Material der Vorszene abgeräumt) und öffnet ihre Regie. „Erzählung zeigen“ startet eine noch nicht laufende Szene ebenfalls automatisch. „Nur privat lesen“ öffnet die Regie ohne Tischänderung.
- **Hintergrund live austauschbar:** Regie › Material zeigt den aktuellen Hintergrund, die Bilder der Szene und auf Wunsch alle Kampagnenbilder mit Suche; jederzeit wechseln oder „Standardbühne“. Die vorbereitete Szene bleibt unverändert. Kurzweg „Hintergrund wechseln“ in der Statuszeile.
- **Animierter Wechsel:** weiche Überblendung (neues Bild blendet mit leichtem Zoom ein, altes aus); bei reduzierter Bewegung sofortiger Wechsel.
- **Fehler behoben:** Der Bildschlüssel enthielt die Bühnenversion, dadurch wurde der Hintergrund bei jeder Objektbewegung neu geladen. Jetzt hängt er nur am Bild.

## Live-Release 30.10.2026

- Auf ausdrückliche Anweisung des Projektinhabers veröffentlicht, **vor** Codex-Review und vor Merge von PR #44 (Merge in dieser Sitzung blockiert). Veröffentlichter Stand: Branch-Commit `e865f91` (Code identisch zu `main` + PR #44; `main` enthält zusätzlich nur Doku-Commits).
- Worker `chronik-von-kleve`, Version `7971d484-27db-4a38-848d-7fd99db30c42`, Tag `spieltisch-medien`, 100 % Verkehr seit 2026-10-30T12:31Z. Bindings unverändert: D1 `chronik-von-kleve-db` (`a4bc79e6…`), R2 `chronik-von-kleve-r2`, `AUTH_ACCESS_ENVIRONMENT=closed-alpha-production`, CPU 5000 ms, `workers_dev` an, `preview_urls` explizit aus.
- Rückfallversion: `2ed5e1e7-3550-4936-8cfe-ed6e3b489a0a` (Regie-UX, `0b5c427`). Hinweise zum Rückfall siehe oben (Fix-forward bevorzugt).
- Sicherung vorab: D1-Export der 32 Anwendungstabellen (22.142 Zeilen; FTS-Index `codex_fts` nicht exportierbar, aus `codex_sections` rekonstruierbar), lokal in SQLite wiederhergestellt, `integrity_check ok`, Zeilenzahlen gleich bis auf 28 nach dem Export neu protokollierte `world_events`. Zusätzlich D1-Time-Travel-Lesezeichen `00000189-0000a5d8-00005114-11f229bb4e6f51bd44b9d33e9f6934b1`. Private Dateien unter `.local-work/release-medien/` (nicht im Git).
- Bekannte Schema-Eigenheit (vorbestehend): `PRAGMA foreign_key_check` meldet „foreign key mismatch“ für zusammengesetzte Verweise auf `entities(campaign_id,id)` ohne passenden eindeutigen Index.
- Live-Prüfung ohne Anmeldung, ohne Schreibzugriffe: `/anmelden` 200; Spielbereich und SL-Zentrale 307; `/api/live-stage` (inkl. `regie`), `/api/live-stage/asset?objectId=backdrop`, Szenen, Dateien, Live-Tisch jeweils 401 mit `private, no-store`; workers.dev 200; ausgeliefertes Stylesheet enthält die neuen Regeln.
- CI zum Zeitpunkt des Deploys: Typecheck/Lint/Tests/Build grün; SL-Browserdurchlauf war mit `c4ae552` an einem Überlauf durch das versteckte Upload-Feld gescheitert, korrigiert in `e865f91` (lokal geprüft 1920/1440/125 %/375 px); erneuter CI-Lauf beim Deploy noch offen. „Workers Builds“ rot wie bei früheren PRs (Auto-Build pausiert).
- Offen: Merge von PR #44 durch den Projektinhaber, Codex-Review, persönliche Abnahme mit Originalmaterial.

## Ausprobieren

`Start-Spieltisch-2.cmd` → `http://127.0.0.1:8830/anmelden` (synthetische Konten wie Etappe 1). Bei bestehendem altem Testspeicher `.local-test/spieltisch-2` vorher löschen, damit die neuen Mediendaten angelegt werden.
