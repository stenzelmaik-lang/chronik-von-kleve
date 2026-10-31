# Live-Release 31.10.2026 – Regie im Zweitfenster, ULTIO-Pager, getrennte Zustandsanzeige

Der Projektinhaber hat die Veröffentlichung angewiesen („wenn Regie fertig ist mit Pager live pushen“ / „alles fertig, du kannst“). Es gab keinen Merge nach `main` und keine Datenbankmigration.

## Inhalt

Branch `claude/release-regie-pager`, Merge-Commit `0339df3`:

| Teil | Branch / Commit | Bericht |
| --- | --- | --- |
| Regie als eigenes Fenster (`/sl/regie`): Textspalte, Material, Medien, Effekte (Regen, Nebel), Hintergrundmusik, NPC | `claude/regie-zweitfenster` `d65b560` | Bericht im Branch unter `docs/spieltisch-2-0/` |
| ULTIO-Pager R-03 v2: Vorbereitung im Command Center, Ausspielen und spontanes Senden in der Regie, freigestellter Pager auf dem Spieltisch | `claude/ultio-pager` `15e7d3c` | Bericht im Branch unter `docs/spieltisch-2-0/` |
| Zustandswerte getrennt nach Körper und Druck | `claude/spieltisch-zustandswerte` `f1d8e65` | `docs/spieltisch-2-0/Zustandswerte-am-Spieltisch.md` |
| Erzählung UX-18 bis UX-21 (bereits live) | `claude/erzaehlung-ux` `b36fd7d` (PR #46) | `docs/spieltisch-2-0/Erzaehlung-UX-18-bis-21.md` |

Der Konflikt in `stage.tsx` ist aufgelöst. Das HUD enthält den Spieler-Pager und die neue `VitalsHud`, die im Lesemodus der Erzählung weiterhin ausgeblendet bleibt.

## Prüfungen vor dem Deploy

- Typecheck, ESLint und Produktionsbuild sind grün.
- Unit-Tests: `pnpm test` 206/206, `live-stage` und `character-vitals` 15/15.
- Integrationsregression `scripts/test-local.mjs`: 1.968 PASS, 0 FAIL.
- Integrationstests gegen die isolierte Instanz `--ultio-pager` mit SL, Spieler A und Spieler B, alle grün: Pager, Regie-Zweitfenster, Zustandswerte, Spieltisch-Regie und Medien.
- Browser (Edge/Playwright), alle grün:
  - Pager bei 1920, 1440, 125 % und 375 px mit Touch-Zonen.
  - Regie-Zweitfenster mit Pager an A, Regen und Nebel, reduzierter Bewegung, Musik, Erzählung an B und 375 px.
  - Erzählung UX bei allen vier Größen.
- Kompatibilität: Alle 3 Live-Charaktere aus der Sicherung werden fehlerfrei gelesen. Neue Felder im Bühnenstand sind optional, ältere Stände bleiben gültig.

## Deploy

- Worker `chronik-von-kleve`, Version `732bc758-f191-4576-b9b3-d8a1a46b31b8`, Tag `regie-pager`, 100 % Verkehr. Bindings unverändert.
- Rückfallversion: `482ef8d5-7e05-4722-be09-4ee99ac7c669` (Erzählung UX).
- Sicherung vorab:
  - Export der 32 Anwendungstabellen (26.566 Zeilen), lokal geprüft, `integrity_check ok`.
  - Time-Travel-Lesezeichen `00000193-00009247-00005115-370b90496f378603916a088e2f079cc1`.
  - Die Dateien liegen privat unter `.local-work/release-regie-pager/`, nicht im Git.
- Live-Prüfung ohne Anmeldung:
  - `/anmelden` liefert 200.
  - Spielbereich, SL und `/sl/regie` leiten mit 307 weiter.
  - Bühne (auch `regie=`), Live-Tisch, Nachrichten und Datensätze liefern 401 mit `private, no-store`.
  - Das Pager-Gehäuse `/spieltisch/pager/ultio-shell.webp` liefert 200.

## Rückfall

Es gibt keine Schemaänderung. Pager-Nachrichten, Effekte und Musik liegen als optionale Felder im Bühnenstand.

**Nach einem Rollback** auf `482ef8d5`: Die alte Version parst strikt. Ein laufender Abend, der schon Pager, Effekte oder Musik enthält, kann dann mit 409 antworten. Daher Fix-forward bevorzugen oder den Abend vor dem Rollback beenden.

## Offen

- Merges nach `main` durch den Projektinhaber: PR #45, #46 sowie die Branches dieses Releases.
- Persönliche Abnahme von Regie und Pager mit echten Szenen.
- Die ULTIO-Bildmarke ist ein Designentwurf. Sie wird ersetzt, falls es eine kanonische Vorlage gibt.
