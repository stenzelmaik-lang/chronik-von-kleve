# Spieltisch 2.0 / W10 v1.2 – Integration und Release-Gate

Stand: 28.10.2026. **Kontrollierter Hauptseiten-Release ausdrücklich freigegeben.** Nach Mitteilung, dass der Echtkonto-Vorabtest weiterhin nicht möglich ist, hat die Projektleitung die isolierte Alpha-Veröffentlichung ausdrücklich abgelehnt und angewiesen: „nein haupt seite umstellen“, anschließend „also wenn technisch soweit okey ist live pushen“. Damit wird dieser Reihenfolgepunkt geändert. Der fehlende reale SL-/Spieler-Abnahmenachweis bleibt offen; lokale synthetische Prüfungen werden nicht als Echtkonto-Test ausgegeben. Keine Produktionsmigration und keine Übernahme von Prüfkonten oder Testdaten.

## Gesicherter Ausgangsstand

- Branch: `codex/spieltisch-2-prototyp`, eigener Worktree `work/spieltisch-2-prototyp`.
- Abgenommener Prototyp vollständig versioniert: `43e4d0e753d8f368e208423aa2f2ce64befc5525`.
- Integrationsbasis und weiterhin produktiver Stand: `d33f4162a7d0d1a1544cbded2c2e2c6b348d6c1b`.
- Frisch abgerufener GitHub-main: `855ec4cbafdee46e4ffef2d13c81a306b7ca04e1`. Die fünf bereits produktiven Ortsdossier-Commits bis `d33f416` fehlen dort noch. Der Feature-Branch erhält sie unverändert; es erfolgt kein Reset oder Überschreiben von main.
- Originaler lokaler Bühnenstand unverändert: SHA-256 `d600320be77877ce727bfeccc6f34862accf89354e044623f413d191beee553c`.
- Private Sicherungen und Nachweise liegen unter `.local-work/spieltisch-2/` und sind von Git ausgeschlossen. Der andere Checkout `cvk-m1-kernmodell` wurde nicht verändert.

## Integration

`LiveSession` öffnet den integrierten Spieltisch beim Sitzungsstart. Die Bühne verwendet die vorhandenen Auth-Sitzungen, Kampagnenrollen und `readLiveRoom`-Teilnehmerprüfung. URL-Parameter können keine SL- oder Spielerrolle bestimmen. Beim Wechsel des angemeldeten Kontos beziehungsweise seiner Rolle wird die persönliche Ansicht neu geladen.

Die vorhandene Live-Tabelle bleibt verbindlich. Freigegebene Szenen und Medien, Empfänger, Ereignis-IDs, Whiteboard-Elemente und gemeinsame Würfe nutzen weiter die bestehenden Records und Live-Endpunkte. Bühnenobjekte und Sticky Notes ergänzen ausschließlich den geschützten Spielraum-JSON-Stand mit Versionsprüfung. **Keine neue SQL-Migration, keine neue Tabelle und keine Datenübernahme.**

NPCs und Handouts bleiben Referenzen auf vorhandene M1-Originale; Dateien bleiben im vorhandenen geschützten Dateiservice. Auflegen ist zunächst SL-intern. Veröffentlichungen gelten für die Runde oder ausdrücklich ausgewählte Teilnehmer. Der geschützte Asset-Endpunkt prüft Sitzung und Empfänger erneut; eine Bühnenfreigabe erweitert keine allgemeinen NPC-, Akten- oder Dateirechte. Entity-Version und ein Fingerabdruck des tatsächlich aufgelegten Inhalts verhindern, dass spätere interne Änderungen einschließlich Legacy-Fallbacks stillschweigend mitveröffentlicht werden. Bei geändertem Original ist erneutes Auflegen/Freigeben erforderlich.

Private Zettel werden ausschließlich dem Ersteller und berechtigten SL ausgeliefert. Nur der Ersteller bearbeitet, verschiebt, löscht oder veröffentlicht einen Zettel. Szenenwechsel erhalten Zettel und Objekte. Das vorhandene Whiteboard ist auch außerhalb des eigenen Zeichenmodus sichtbar; seine Werkzeuge erscheinen nur im Zeichenmodus. Dokumentlesen und Zoom bleiben persönlich. Uploads verwenden den bestehenden privaten Datei-Endpunkt.

W10-Werte entstehen einmalig auf dem Server über die unverzerrte bestehende Zufallsquelle. Teilnehmer erhalten dieselbe Wurf-ID, Reihenfolge, Werte, V20-Auswertung und Bewegungsseeds. Schließen betrifft entweder nur den eigenen Tab oder ausdrücklich den ausgewählten Wurf für alle; letzteres ist SL-geschützt. Ergebnisprotokolle werden nicht gelöscht. Die Journalgrenze wird auch im atomaren INSERT geprüft. Darstellung und Physik werden gemeinsam mit dem gesicherten Prototyp verwendet; es gibt keine zweite Würfelengine.

## Geänderte Bereiche

- `domain/live-stage.ts`, `server/live-stage.ts`, `/api/live-stage` und `/api/live-stage/asset`: validierte Bühnenzustände, Eigentum, Veröffentlichung, Originalbezug und private Auslieferung.
- `server/live-game.ts`, `server/live-commands.ts`, `domain/live-game.ts`, bestehender Medien-Endpunkt: optionale Bühnenzustände, gemeinsame W10-Metadaten, SL-Schließen und geschützte Szenenbilder.
- `app/spielbereich/modules/spieltisch/`, `live-session.tsx`: abgenommene Bühne mit echten Daten und bestehenden Editoren/Readern; keine Demo-Rollenauswahl.
- Prototyp-Physikmodule verweisen auf die gemeinsame Implementierung. Die gesicherte Ausgangsfassung bleibt im vorherigen Commit erhalten.
- `package.json`, beide Lockfiles: ausschließlich Three `0.186.1` und Rapier `0.21.0` ergänzt; keine Versionsänderung bereits vorhandener Pakete.
- `vite.config.ts`: explizites `ASSETS`-Binding für autorisierte bestehende Bildreferenzen. Produktive D1-/R2-Ziele werden dadurch nicht geändert.
- `tests/live-stage*`, Integrationsrunner und lokaler Prüfstart: isolierte Prüfkonten und eigene lokale Ressourcen; kein Import dieser Fixtures in die Anwendung.

## Prüfstand und Nachweise

Alle Nachweise sind privat unter `.local-work/spieltisch-2/` abgelegt. Produktionsdaten werden nicht für synthetische Schreibtests verwendet.

| Prüfung | Ergebnis / Grenze |
|---|---|
| Unit-/Regressionstests einschließlich W10 und Prototyp | 322 bestanden, 0 Fehler |
| Vollständiger HTTP-Integrationslauf mit abschließender Fingerabdruckprüfung | 1.575 bestanden, 0 Fehler |
| Rollenfundament / Rückrollproben | 46 bestanden; zusätzlich atomarer D1-Batch-Rollback geprüft |
| Typecheck und gezieltes ESLint | Protokolle `integration-typecheck.log`, `integration-lint.log` |
| Produktionsbuild | `integration-build.log`; Build für die bestehende Worker-Laufzeit |
| Deployment-Dry-Run | Paketierung erfolgreich mit lokalen Test-Bindings; kein Nachweis eines Produktionsdeployments |
| Browser: regulärer Login, getrennte SL-/Spielersitzung | Synthetische Prüfkonten mit echten Auth-Cookies; getrennte Cookie-Ursprünge `127.0.0.1` und `localhost` |
| Browser: Szene / NPC / Dokument | Szenenbild und formatierte Erzählung synchron; private Figur zunächst nicht beim Spieler; Freigabe und gemeinsame Positionsänderung; geschütztes Handout und persönlicher Zoom auf 120 % |
| Browser: Sticky Notes | Spieler erstellt privaten Zettel; SL liest ihn, hat jedoch keine fremde Bearbeitungsaktion |
| Browser: Whiteboard | Text über vorhandenen Editor erstellt; SL sieht ihn ohne eigenen Zeichenmodus; Tastatur und Rückgängig geprüft |
| Browser: gemeinsamer 3D-Wurf | SL und Spieler: ID `11418937-65a0-4adb-9f57-ac044a9157f1`, Werte `3,10,1,4,1,10,6,9,4,1`, gleiche Endwerte, 1 Nettoerfolg, kein Fallback. Spieler 1920×1080, SL 1280×720; Schließen erreichbar, kein horizontaler Überlauf. Objektwerkzeuge verdecken die Wurfauswertung nicht |
| Browser: Schließen / Reconnect | Persönliches Schließen lässt SL-Wurf offen; Reload bleibt persönlich geschlossen; SL-Schließen entfernt den ausgewählten Wurf für alle |
| Pano und echter Spieler / Internet-Preview / Live-Smoke | **Nicht geprüft. Release-Gate offen.** Keine synthetischen Konten als reale Nutzerabnahme ausgegeben |

Abschließender Browsernachweis auf dem finalen Code: Wurf-ID `d8e54baa-cea7-4788-80ee-ce01079bc03d`, SL und Spieler identisch `7,6,8,3,10,10,2,5,6,9`, 7 Nettoerfolge, jeweils `settled`, kein Fallback und keine Spieler-Konsolenfehler. Private Screenshots: `.local-work/spieltisch-2/evidence/integration-20261028/spieler-final.jpg` und `sl-final.jpg`. Temporäre Viewport-Überschreibung zurückgesetzt.

## Produktionsschutz und Sicherung

Die Cloudflare-Abfrage vom 28.10.2026 bestätigt unverändert Version `73335003-447d-45dd-95a7-3b12c1924dcb`, 100 % Traffic, Deployment-ID `0f66601d-e0ff-4416-9b4b-cf64f5e23f9c`, Commit `d33f416`.

Produktion bindet D1 `a4bc79e6-3f33-4b03-b240-9c341bd1d4d7` und R2 `chronik-von-kleve-r2`. Die vorhandenen Phase-C-Ressourcen `93863382-2046-4efc-a5b7-7eb1306955f9` / `chronik-von-kleve-phase-c-r2` sind davon getrennt. Es wurde keine Cloudflare-Preview veröffentlicht oder mit echten Konten geprüft. Der vorhandene Build-Trigger berücksichtigt ausschließlich `main`; kein Push dieses Feature-Branches ist eine Freigabe für einen produktiven Build.

Die lokale Anwendung auf Port **8820** verwendet eigene lokale Test-D1/Test-R2. Port 8816 und sein privater Spielstand bleiben geschützt. Keine produktiven Bindings in lokalen Schreibtests.

Die private Produktionssicherung vom **27.10.2026** unter `.local-work/spieltisch-2/release-20261027/` wurde wiederhergestellt: alle 32 regulären Tabellen, Originalschema, FTS-Rebuild aus 3.520 Codex-Abschnitten, `integrity_check=ok`, keine Fremdschlüsselverletzungen, FTS-Integritätsprüfung bestanden. Ein vollständiger D1-Standarddump scheitert an der vorhandenen FTS5-Tabelle; verwendet wurde das bereits dokumentierte gemeinsame Exportverfahren für reguläre Tabellen plus Originalschema und Index-Rebuild. Keine produktive FTS-Tabelle wurde verändert oder entfernt.

- Datendump SHA-256: `4e9d5aeba97646470c99b03963f03b475fcd6d47b3ab2ea650055fa47ccefe35`.
- Originalschema SHA-256: `dad3aaf8aa8f32c7183462c70df04bf134243095c8b0f39ff4199f4930e994b2`.
- Time-Travel-Bookmark und Wiederherstellungsprotokoll bleiben privat.
- Diese Vorbereitungssicherung ersetzt kein frisches Backup unmittelbar vor einem späteren Cutover. Zwischenzeitliche legitime Schreibvorgänge müssen erhalten bleiben.

## Fortsetzung erst nach geschlossenem Gate

Die folgende ursprüngliche Reihenfolge ist durch die oben dokumentierte direkte Hauptseiten-Freigabe ausschließlich beim Echtkonto-Vorabtest geändert. Alle technischen Sicherheits-, Backup- und Datenprüfungen bleiben verbindlich.

1. Reale SL-/Spielerprüfung offen dokumentieren und nach Veröffentlichung durch die Kontoinhaber nachholen. Kein Passwortaustausch, keine Übernahme fremder Konten.
2. Exakten PR-HEAD und aktuellen main prüfen, erforderliche Checks abschließen und erst dann den PR integrieren.
3. Unmittelbar vor Veröffentlichung neue geprüfte Bestandssicherung und aktuellen Rollback-Stand erfassen. Keine Migration für diese Integration ausführen.
4. Produktionsbuild mit dem vorhandenen Produktionsprofil erzeugen; Zielworker, DB-ID, Bucket, Auth-Umgebung und `ASSETS` am erzeugten Deployment prüfen. Niemals die lokale Testkonfiguration deployen.
5. Exakten geprüften Commit veröffentlichen und Hauptfunktionen mit echten Konten prüfen. Keine Fixtures, Demo-Konten, lokalen Spielstände oder synthetischen Inhalte mitveröffentlichen.
6. Bei Problemen Zugriff sichern, Daten erhalten und bevorzugt kompatibel vorwärts korrigieren. Kein B0-Restore als Bereinigung und kein blindes Worker-/Datenbank-Rollback nach neuen Spieleraktionen. Ein Code-Rollback benötigt einen Nachweis, dass neue private Bühnen- und Ereignisdaten weiterhin geschützt bleiben.

## Frisches Release-Backup vom 28.10.2026

Private Sicherung `.local-work/spieltisch-2/release-20261028/`: alle 32 regulären Tabellen, vollständiges Originalschema mit 124 Objekten, Time-Travel-Bookmark im Exportbeleg. Isolierte Wiederherstellung bestanden: `integrity_check=ok`, keine Fremdschlüsselverletzungen, 3.520 FTS-Abschnitte vollständig wiederaufgebaut und FTS-Integritätsprüfung bestanden. Geschützte Tabellen sind zusätzlich mit privaten Fingerabdrücken dokumentiert.

- Datendump SHA-256: `d8f3ed8d2df276cde33c5bd63004dc67cdacddc883da4c00ed53b43d94b32ea8`.
- Vollständiges Originalschema SHA-256: `47c1169027b99d83ded85ebb9ee0e2f795af251a605305a8544ae7f116dc7fc6`.
- Der lokale D1-CLI-Export scheiterte an der CLI-Authentifizierung; der autorisierte Cloudflare-Connector hat den Export erfolgreich erstellt. Die Worker-CLI-Anmeldung wurde separat lesend erfolgreich geprüft. Kein Datenbank-Restore in Produktion.

Der tatsächliche Veröffentlichungsnachweis wird nach Deployment separat ergänzt. Bis dahin ist dies eine Release-Vorbereitung und keine Behauptung einer erfolgten Veröffentlichung.
