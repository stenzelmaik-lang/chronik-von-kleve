# Spieltisch 2.1b – Spielerzentrale

Stand: 28.10.2026. Auftrag: persönlich freigegebene Konzeptanordnung auf die vorhandene Übersicht übertragen und nach Prüfung im bestehenden Alpha-Verfahren veröffentlichen.

## Ausgangsstand und Umfang

Sauberer Ausgangsstand `a95bc700151f7edf76baa66c8a46d904c73bb9ae`, eigener Branch `codex/spieltisch-2-1b`. 2.1a wurde vom Projektleiter nach dem letzten Release persönlich bestätigt: 125 % Zoom, Zentrierung und Live-Charakteransicht funktionieren. Der spätere gestalterische Umbau des Charakterbogens gehört nicht zu 2.1b.

Die bestehende Übersicht bleibt der einzige Einstieg. Oben 70/30 Charakter und nächster Abend, darunter drei Informationsbereiche, anschließend vier Vorbereitungszugänge. Dunkle Petrol-/Navy-Flächen, warme Goldakzente und vorhandene Typografie bleiben erhalten. Die alte Schnellaktionsleiste und das aufklappbare „Journal & mehr“ entfallen.

## Vorhandene Systeme und Daten

- `/api/dashboard`: eigene Charakterauswahl, vorhandene Character-Engine-XP, nächste freigegebene Termine und letzter vergangener freigegebener Sitzungseintrag. Keine neuen XP-Regeln.
- Porträt: bestehender Medienprojektor `projectMedia` aus der Charakteransicht, einschließlich Dateiberechtigungen. Keine Kopie des Bildes und kein neuer Uploadweg. Fehlendes oder nicht ladbares Bild erhält einen neutralen Ersatz.
- `/api/messages`: eigener Ungelesen-Zähler und jüngster Nachrichtentitel. Keine fremden Gespräche, keine Nachrichtentexte im neuen kompakten Überblick. Die vorhandene Postfachkomponente wird geöffnet; kein zweites Nachrichtensystem.
- Termine und offene Abstimmungen öffnen den bestehenden Kalender. Bei fehlendem Termin wird kein Datum und keine Teilnahme erfunden.
- „Spieltisch betreten“ öffnet unverändert `sitzung` und damit den vorhandenen integrierten Spieltisch.
- Charakter und Inventar bleiben über „Meine Vorbereitung“ erreichbar. „Persönliches Archiv“ führt zu den vorhandenen eigenen Notizen. Ein vollständiges persönliches Dokumentenarchiv ist damit ausdrücklich noch nicht umgesetzt.
- Wirtschaft, Gefallen, Galerie und weitere bestehende Bereiche sind über die kompakte Auswahl „Weitere Bereiche“ erreichbar; ihre Daten und Funktionen bleiben erhalten.
- Hauptmenüpunkte Sitzung, Würfel, Charakter und Inventar werden nicht mehr als reguläre Hauptnavigation angezeigt. Die bestehenden IDs, URLs und internen Zugriffe bleiben gültig. Vorbereitungsbereiche besitzen „Zur Übersicht“.

Keine neuen Abhängigkeiten, Objekttypen, Migrationen oder produktiven Testdaten. Keine Änderungen an Spieltisch-/Whiteboard-/W10-Engines oder Character-Engine-Regeln.

## Prüfungen

| Prüfung | Ergebnis / Beleg |
| --- | --- |
| Alle Unit-/Regressionstests | 281 bestanden, `21b-all-unit.log` |
| Vollständige HTTP-Integration mit allen Migrationen | 1.631 Prüfungen bestanden, `21b-integration.log` |
| Rollen-/Rückrollprüfungen der lokalen Testdatenbank | 46 bestanden, gleiches Log |
| Typecheck, gezieltes ESLint, Produktionsbuild, Deploymentprobe | bestanden |
| UI-Detektor | keine Befunde; Sichtprüfung zusätzlich durchgeführt |
| Getrennt authentifizierte lokale SL-/Spieler-A-/Spieler-B-Ansichten | bestanden, keine Rollen-Simulation im UI |
| Layout | 1920×1080, 1440×900, 1536×864, 1152×720 und 390×844; kein horizontaler Überlauf |
| Anordnung | 70/30 gemessen; drei Informationsbereiche nebeneinander auf Desktop, vier Vorbereitungszugänge |
| Navigation | Charakter, Inventar, Notizen, Kalender, Postfach, Rückwege, bestehende Spieltisch-/Würfel-Direktzugriffe bestanden |
| Fehlerzustände | fehlende Daten, Ladefehler/Wiederholen und nicht ladbares Porträt bestanden |
| Tastatur | sichtbarer Fokus und Reihenfolge, Postfach per Escape schließen bestanden |
| Browser | separater isolierter Edge 156.0.4314.50; keine JavaScript-Seitenfehler |

Private Browserbelege und Screenshots: `.local-work/spieltisch-2/evidence/2-1b/`. Lokaler Median aus fünf authentifizierten Dashboard-Abrufen: etwa 22 ms; keine Aussage über produktive Feldperformance.

Die kleineren Desktop-Flächen entsprechen der nutzbaren Fläche bei 125 % Zoom. Dies ist **kein neuer Nachweis nativen Browserzooms**. Die In-App-Browsersteuerung meldete `browser.user is unavailable`; deshalb wurde der separate lokale Edge-Testbrowser verwendet. Die neue Live-Ansicht mit echtem Charakter und nativer Zoom bleiben Bestandteil der persönlichen Alpha-UX-Abnahme. Echte Charakter-/Kontodaten wurden nicht als Testdaten übernommen; Produktions-Schreibtests sind nicht vorgesehen.

## Freigabevorbereitung

Ziel ist ausschließlich der bestehende Worker `chronik-von-kleve` auf `chroniplay.cc`, Konto `688c841e3110458e2e64b001c3291920`. D1 `a4bc79e6-3f33-4b03-b240-9c341bd1d4d7`, R2 `chronik-von-kleve-r2`, `closed-alpha-production` und deaktivierte Versionsvorschauen werden erhalten. Vorherige Worker-Version: `f17b7ff4-33e1-4cae-9868-76133997a887` (Anwendungscode `1f971925…`).

Frisches privates Backup unter `.local-work/spieltisch-2/release-21b/`: alle 32 Anwendungstabellen, vollständig in Teilabfragen erfasstes Originalschema mit 156 Objekten, lokal wiederhergestellt. Integrität OK, null Fremdschlüsselverletzungen, 3.520 FTS-Einträge aus Originalabschnitten rekonstruiert und geprüft. Prüfung `2026-10-28T11:58:11Z`.

- SQL-SHA-256: `f3cfe1be396b8270b53fe3f12b8f4670a829e1dbf739d94fab804abb54aa1852`.
- Schema-SHA-256: `3ba5d77c5c2d347f093748c09ef10eed94b4d2023a30035d354bb578cac72d39`.

Veröffentlichung über überprüfbaren PR und den geprüften lokalen Produktionsbuild; kein pauschaler CI-Erfolg behauptet. Nach Veröffentlichung: Version/Anbindungen bestätigen, öffentliche Zugangssperren prüfen und Bestandsvergleich durchführen. Bei Problemen Daten erhalten und Code-Fix oder kompatiblen Code-Rollback prüfen; kein blindes Zurückspielen des Backups.

**Danach STOPP zur persönlichen UX-Sichtprüfung. Kein weiterer Funktionsbereich.**

## Tatsächlicher Alpha-Release

- Live: <https://chroniplay.cc/spielbereich?bereich=dashboard>.
- Implementierung über <https://github.com/stenzelmaik-lang/chronik-von-kleve/pull/29> integriert.
- Live-Commit: `1087998210c1af789d5a561bcb4fc3e93c58a470`; Quellbaum vor dem Deploy identisch zum geprüften Branch-Commit `43a9b1eaa28b73ec1adc0f246a2db37ec1136f65`.
- Worker-Version: `bb692e18-96ee-4e27-a2d2-6db9de0dc266`, Deployment `69a01f40-8b38-455e-aa94-60b9f4c47361`, 100 % Verkehr seit `2026-10-28T12:02:36.008066Z` (13:02 Uhr Berlin).
- Bestehende D1-/R2-Anbindungen, geschlossenes Alpha-Zugangsprofil und deaktivierte Versionsvorschauen nach dem Deploy bestätigt. Keine Migration.
- 16 öffentliche Live-Prüfungen auf Hauptdomain und workers.dev bestanden: Anmeldung 200, Übersicht ohne Anmeldung 307 zur Anmeldung, Dashboard/Charakter-ID-Abfrage/Postfach/Termine/Teilnehmer-/Bühnen-API ohne Anmeldung 401 mit `private, no-store`. Der Hash des live ausgelieferten Stylesheets stimmt mit dem geprüften Build überein.
- Vergleich aller 32 Anwendungstabellen mit dem Backup: 31 vollständig identisch. Alle 20 bestehenden Anmeldesitzungen erhalten; in genau einer Sitzung ausschließlich `last_seen_at` vorgerückt, entsprechend dem vorhandenen Authentifizierungsverhalten. Keine Konto-, Charakter-, Rollen-, Kampagnen- oder Inhaltsänderungen.
- 28 zusätzliche gezielte Abschlussprüfungen bestanden. Die endgültige kompakte mobile Navigationszeile und fünf Browsergrößen nach dem letzten CSS-Fix erneut geprüft.
- Privater Nachweis: `.local-work/spieltisch-2/release-21b/live-smoke.json`, `data-comparison.json` und `data-comparison-session-classification.json`. Keine privaten Sicherungen, Sitzungsdaten oder Testkonten in Git beziehungsweise Produktion übernommen.

**Alpha veröffentlicht: JA. Zur persönlichen UX-Sichtprüfung bereit: JA.** Native 125-%-Zoomprüfung dieser neuen Übersicht und die neue Live-Darstellung mit echtem Charakter bleiben persönlich zu prüfen. Das vollständige persönliche Dokumentenarchiv bleibt außerhalb dieser Etappe; der vorhandene Notiz-Zugang funktioniert. Kein weiterer Funktionsbereich begonnen.
