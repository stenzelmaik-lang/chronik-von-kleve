# Übergabe an Claude Code – Galerie und Materialvorbereitung

Stand: 31.10.2026. Veröffentlichung vom Projektinhaber ausdrücklich beauftragt.

## Tatsächlicher Release

| Nachweis | Stand |
| --- | --- |
| Live | https://chroniplay.cc |
| Galerie für SL | https://chroniplay.cc/sl/command-center?bereich=galerie |
| Material für SL | https://chroniplay.cc/sl/command-center?bereich=vorbereitung |
| Repository | `stenzelmaik-lang/chronik-von-kleve` |
| Grundlage | PR #47, `69951209bec58ceb03bf2b0bbf5439bf5426eae2` |
| Entwicklungsbranch | `codex/galerie-vorbereitung` |
| Implementierungscommit | `47c0aee27641d01657d2a900d76f0f3dcc7b39b5` |
| Integriert | [PR #48](https://github.com/stenzelmaik-lang/chronik-von-kleve/pull/48) |
| **Live-Codecommit** | **`5567fbf72f3b3557cffa0697a2abd3a8ee567fcf`** |
| Worker | `chronik-von-kleve` |
| Worker-Version | `188bf384-d465-41c7-9978-880daacff1e7` |
| Deployment-ID | `8cc077d4-bf58-4abe-8348-742b72168904` |
| Veröffentlicht | 31.10.2026, 12:40:08 MEZ / 11:40:08 UTC, 100 % Traffic |
| Bisherige Version | `bbc9f701-7c9d-4e51-8880-9144da81e6ab` |
| Datenbankmigration | **Keine** |

Der Merge-Commit hat denselben vollständigen Dateibaum wie der geprüfte Implementierungscommit. Der Produktionsbuild und Dry-Run wurden aus diesem Baum erstellt. Der nachfolgende Dokumentationsstand ist kein weiterer Anwendungsrelease.

## Was übernommen wurde

- Eigenständige SL-Galerie: Suche, Typfilter, Sortierung nach Name/Datum/Größe, Vorschau, vorhandene Sichtbarkeit und kontrolliertes Löschen. Referenzierte Originale, historische Verwendungen und Profilbilder bleiben geschützt. Keine Zwangslöschung fremder privater Spielerdateien.
- Materialvorbereitung mit **Materialvorlagen & Handout-Pakete** und **Szenenbausteine**. Die bisherigen Bausteine aus Szenenschritt 4 werden am neuen Einstieg im selben Szenendokument bearbeitet. IDs, Inhalte und Versionsprüfung bleiben erhalten.
- In der Szenenbearbeitung bleibt **Interaktion & Einsatzplan** als erklärender Text: was, warum, wann und wo eingesetzt werden soll. Keine automatische Übernahme oder Duplizierung von Material.
- Das persönliche Archiv enthält jetzt die eigene Vorbereitung; bisherige Archivnotizen bleiben erhalten. Spieler können eigene Vorlagen vorbereiten, gezielt auflegen und über den vorhandenen Nachrichtenentwurf versenden.
- Ein Handout kann bis zu **20 Bildseiten** enthalten. Mehrfachauswahl, stabile Seiten-IDs, Reihenfolge ändern, Seiten entfernen und Vor-/Zurückblättern im Tisch-Reader sind umgesetzt. Ein Paket ist ein Bühnenobjekt, keine Ansammlung einzelner Bildobjekte.
- Vorlagen bleiben privat. Auf dem Tisch entsteht eine freigegebene Arbeitsfassung; Textdokumente können dort vom Autor oder der SL ausgefüllt werden. Das verändert die Vorlage nicht. Konflikte bewahren den lokalen Entwurf.
- Material wird ausdrücklich für die ganze Runde oder ausgewählte Teilnehmer freigegeben. Zurückziehen schließt offene Reader und sperrt ihre Asset-Endpunkte. Originaldatei-URLs werden dadurch nicht öffentlich.
- Persönliches Material bleibt bei Szenenwechseln bestehen; szenengebundenes Bühnenmaterial folgt weiterhin der bestehenden Szenenlogik.

## Bestehende Technik weiterverwenden

Kein neues Datenmodell und keine neue Whiteboard-, Nachrichten- oder Veröffentlichungsengine:

- Vorlagen: vorhandene `records`, `kind=notizen`, `context=table-material`; bestehende Begleit-Entities bleiben Teil dieses Systems.
- Tisch: bestehende `/api/live-stage`-Bühne, `sourceKind=record`, serverseitige Inhalts- und Empfängerprüfung. Arbeitsfassungen haben eine eigene `documentRevision`, damit fremde Tischbewegungen keine falschen Textkonflikte erzeugen.
- Mehrseitige Handouts: vorhandener Handouttyp mit optionalem `pages[]`. Die geschützte Asset-Route liefert nur die jeweils angeforderte Seite an berechtigte Empfänger.
- Dateien: bestehende `/api/files`-Verwaltung, R2, Sichtbarkeit und Referenzschutz. 10-MB-Grenze pro Datei erhalten.
- Nicht gespeicherte Entwürfe: eigener Nutzer-/Kampagnenkontext im Arbeitsspeicher; bleiben bei interner Navigation erhalten. Kein zweiter dauerhafter Notizspeicher. Browser-Neuladen schließt diese Zusage nicht ein; die Seite warnt vor ungespeicherten Änderungen.
- Eigene private Vorlagen werden auch über generische Entity-Abfragen und Kampagnenexport nicht fremden Spielern oder der SL offengelegt. Das persönliche Exportrecht des Autors bleibt erhalten. Bestehende Sticky-Note-Rechte wurden nicht umgebaut.

## Einstiegspunkte im Code

| Aufgabe | Dateien |
| --- | --- |
| Vorlagen und Autorisierung | `domain/table-material.ts`, `server/table-materials.ts`, `app/api/table-materials/route.ts` |
| Materialoberfläche und Seiteneditor | `app/spielbereich/modules/table-material-library.tsx`, `handout-pages.tsx`, `material-library.module.css` |
| Galerie | `app/spielbereich/modules/media-library.tsx`, `app/api/files/route.ts` |
| Szenenbausteine und Einsatzplan | `app/spielbereich/modules/material-preparation.tsx`, `story-workspace.tsx`, `domain/preparation-guide.ts` |
| Tisch, Reader und geschützte Seiten | `domain/live-stage.ts`, `server/live-stage.ts`, `app/api/live-stage/asset/route.ts`, `app/spielbereich/modules/spieltisch/stage.tsx`, `regie.tsx`, `regie-window.tsx` |
| Entwurferhalt | `app/spielbereich/modules/use-preparation-draft.ts` |
| Private Projektionen | `server/entities.ts`, `server/campaign-export.ts`, `app/api/records/route.ts` |
| Übersicht aller Änderungen | PR #48; 38 Dateien, 862 Ergänzungen, 166 Entfernungen |

Der Funktionsbericht mit Grenzen und lokaler Abnahme steht in [Galerie-und-persoenliche-Vorbereitung.md](../Galerie-und-persoenliche-Vorbereitung.md).

## Erneut bestandene Prüfungen vor Veröffentlichung

| Prüfung | Ergebnis |
| --- | --- |
| Standard-Unit-/Regressionstests | 223/223 |
| Zusätzliche Bühnentests | 5/5 |
| Vollständige isolierte HTTP-/D1-Regression | 1.921 bestanden |
| Rollen-/D1-Backfill-/Rollback-Prüfungen | 46 bestanden |
| Material-API, Eigentümer, Empfänger, Export, Arbeitsfassung, Dateischutz | 84 bestanden |
| Browser-Hauptabläufe | 12 bestanden |
| Browser-Randfälle | 8 bestanden |
| Mehrseitenpakete, Materialumzug, Entwurferhalt | 11 bestanden |
| Typecheck, ESLint der betroffenen Dateien, Build, Produktions-Dry-Run | bestanden |

Browserprüfungen umfassen Desktop, 390-px-Mobilansicht, getrennte SL-/Spieleransichten, Sieben-Seiten-Paket, Reihenfolge, alle Seiten vor/zurück, Empfängerschutz, Textkonflikte, Rücknahme und erhaltene Entwürfe. Nur lokale synthetische Konten und Dateien wurden dafür verwendet.

Die bereits separat bestandenen 15 Lifecycle-/Profilbildprüfungen sind im Funktionsbericht dokumentiert; sie wurden für diesen unveränderten Release nicht erneut ausgeführt. Kein Testskript wurde auf die Produktionsdatenbank gerichtet.

### Live-Nachweis und Grenzen

- Cloudflare bestätigt neue Version und 100 % Traffic. D1/R2, Kompatibilitätsdatum `2026-09-21`, CPU-Grenze 5000 ms und `AUTH_ACCESS_ENVIRONMENT=closed-alpha-production` sind unverändert.
- Versionsvorschauen bleiben deaktiviert. Auto-Builds bleiben durch den vorhandenen vollständigen Pfadausschluss pausiert. Keine produktive Preview eingerichtet.
- R2: keine öffentliche Custom-Domain, verwaltete `r2.dev`-Freigabe deaktiviert.
- 27 Live-Prüfungen auf Hauptdomain und bestehender Worker-Domain bestanden: Anmeldung 200, geschützte Seiten 307, APIs 401 mit `private, no-store`; gefälschte Identitätsheader verschaffen keinen Zugang.
- In Panos vorhandener angemeldeter SL-Ansicht: neue Navigation, Galerie mit bestehenden Dateien, Materialvorbereitung, Szenenauswahl und vorhandener Kaserne-Handoutbaustein geladen. Die bestehende Live-Regie lädt ebenfalls den neuen Materialbereich und den bisherigen Bühnenstand.
- Keine gespeicherten Inhalte durch diese Browserprüfung geändert; kein Material veröffentlicht, keine Dateien hochgeladen, keine Charakterwerte bearbeitet, keine synthetischen Live-Testdaten erzeugt. Eine vorhandene Löschschutzmeldung wurde nur gelesen.
- Kein neuer Live-Ende-zu-Ende-Test mit einem selbst angemeldeten Spieler durchgeführt. Die vollständigen Spieler-/Empfänger-Schreibabläufe wurden isoliert geprüft. Das ist keine Behauptung einer persönlichen Spielerabnahme.
- Die kontrollierte Live-Materialansicht zeigte keine erfassten Browser-JavaScriptfehler.

## Sicherung und nachgewiesener Bestandserhalt

Private Belege liegen ausschließlich im ausführenden Worktree:

`C:\Users\Stenz\Documents\Codex\2026-10-03\02-entwicklung-code-du-bist-der\work\galerie-vorbereitung\.local-work\release-material\`

- `B0/`: frischer Produktions-Export aller 32 regulären Anwendungstabellen, vollständiges Originalschema, Time-Travel-Bookmark und lokal wiederhergestellte SQLite-Kopie.
- B0-Bookmark: `00000193-0001d9e3-00005115-50e8a93b866a864d1b9489047276196a`.
- B0-SQL-SHA256: `85a2d714bd07ffa5120a706932cd75d5959c12ecd3fd6f5f8799c03fe2a6e4bd`.
- `B1/`: analoger Produktionsabzug nach Veröffentlichung. Beide Wiederherstellungen: `integrity_check=ok`, keine Fremdschlüsselfehler, FTS-Rebuild und FTS-Integritätsprüfung erfolgreich, je 3.520 Suchabschnitte.
- `data-comparison.json`: keine unerwarteten Änderungen. Anwendungsschema identisch. Konten, Rollen, Charaktere, Kampagnen, Entity-Inhalte, Beziehungen, Dateien und Freigaben erhalten.
- Zeilen insgesamt: 28.220 → 28.228. Ausschließlich laufende Aktivität: zwei aktualisierte `auth_sessions.last_seen_at`, ein bestehender Live-Tisch-Peer-Heartbeat und acht zugehörige angehängte Auditereignisse. Keine Tabelle verlor Zeilen.
- `source-47c0aee.bundle`: zusätzliche private Git-Sicherung des Implementierungsstands.
- Weitere Nachweise: `unit.log`, `stage-unit.log`, `full-integration.log`, `material-api.log`, `browser*.log`, `dry-run.log`, `deploy.log`, `live-anonymous-smoke.json`, `live-material.jpg`.

SQL-Kopien, wiederhergestellte Datenbanken, Browserdaten und private Originaldateien gehören nicht ins Git und wurden nicht hochgeladen. Produktions-R2 wurde durch den Release nicht verändert.

## Rückfallgrenze – verbindlich beachten

**Keine Migration bedeutet hier nicht, dass alter Code neue Bühnenstände lesen kann.** Der bisherige Worker parst diese Daten strikt und versteht neue `record`-/Seiten-/Dokumentfelder nicht.

Nach ersten neuen Materialschreibvorgängen **kein blindes Rollback** auf `bbc9f701…` und **kein vollständiges B0-Restore**. Beides kann neue Arbeit unlesbar machen beziehungsweise legitime neue Daten zurücksetzen. Fix-forward bevorzugen. Ein Rückschalten setzt eine ausdrücklich nachgewiesene Kompatibilität des aktuellen gespeicherten Stands voraus. Vor jedem solchen Eingriff erneut sichern; Originalvorlagen und Spielerdaten nicht zur Rollback-Bereinigung löschen.

## Gezielte Verbesserungsvorschläge für die nächste Aufgabe

Diese Punkte sind **nicht Teil des veröffentlichten Changes** und keine Aufforderung zu einem Neuaufbau:

1. **Handouteditor – Bildseiten zuerst (P3):** Die Bildseitenverwaltung steht noch unter dem optionalen großen Texteditor. Bei Bildpaketen muss man unnötig scrollen. In `table-material-library.tsx` die Seitenverwaltung vor den optionalen Begleittext setzen oder den Begleittext einklappbar machen. Vorlagenstruktur und API unverändert lassen. Abnahme: sieben Bilder hochladen, Reihenfolge ändern, speichern und mobil blättern; Textdokumente weiterhin unverändert nutzbar.
2. **Hilfetexte auf den neuen Material-Einstieg abstimmen (P3):** In der bestehenden Live-Regie nennt der Pager-Hinweis noch „Command Center → Spielmaterial vorbereiten“. Jetzt lautet der konkrete Einstieg „Material → Szenenbausteine → Szene auswählen → Pager-Nachricht“. Nur diesen Weg und gegebenenfalls gleichartige alte Hinweise korrigieren; keine zweite Vorbereitung einführen.
3. **Galerie-Vorschauen bei größerem Bestand gezielt messen:** Die Kacheln nutzen bereits Lazy Loading, laden Vorschauen aber über den geschützten Originaldatei-Endpunkt. Bei den vorhandenen großen Bildern kann eine spätere, private Vorschaustufe sinnvoll sein. Erst tatsächliche Netzlast und Ladezeiten messen; keinen öffentlichen Cache und keine Umgehung der Datei-/Empfängerrechte einführen. Es wurde kein aktueller Performanceblocker festgestellt.

Für Weiterarbeit zunächst aktuellen `origin/main` holen, fremde Arbeitsstände erhalten und einen eigenen Branch verwenden. Private lokale Testserver und geteilte `node_modules` nicht pauschal beenden oder verändern. Kein echter Anselm-/Legacy-Import wurde im Rahmen dieses Releases durchgeführt.
