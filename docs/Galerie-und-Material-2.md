# Galerie & Material 2 – Löschen, Bedienung, Spielerarchiv

Stand: 31.10.2026. Branch `claude/galerie-material-2`, Basis `origin/main` `0795040` (enthält den Codex-Release „Galerie und Materialvorbereitung“, PR #48/#49). Nur lokal; kein Push, kein Deployment, keine Migration.

## Ausgangsproblem „Löschen funktioniert nicht“

Ausgewertet wurde eine Kopie der Produktionssicherung, nur lesend und ohne Namen oder Inhalte auszugeben. Das Löschen war für **66 von 74 Dateien** gesperrt:

- **46** sind als NSC-Porträts in Gebrauch. Diese Sperre ist richtig.
- **6** waren *ausschließlich* durch das Änderungsprotokoll (`world_events`) blockiert. Jede gespeicherte Szene schreibt ihren kompletten Stand dorthin. Damit wurde jede Datei, die jemals in einer Szene vorkam, dauerhaft unlöschbar – auch wenn sie dort längst entfernt war.
- Die Galerie zeigte nie, **wo** eine Datei verwendet wird. Es kam nur eine allgemeine Fehlermeldung nach dem Klick.

## Änderungen

### Server
- `GET /api/files?usage=<id>` (neu, `server/file-usage.ts`): Listet die aktuellen Verwendungen einer Datei – Profilbild, veröffentlichte Fassung, Inventar, Einträge (NSC, Szene …) und Datensätze –, dazu die Zahl der Verlaufseinträge.
  - Titel werden nur genannt, wenn der Betrachter die Quelle lesen darf.
  - Abrufbar nur für Dateien, die man selbst verwalten darf.
- `DELETE /api/files`: Das Änderungsprotokoll sperrt nicht mehr. Alle anderen Schutzregeln bleiben unverändert: Profilbild, veröffentlichte Revisionen (FK), Inventar, aktuelle Einträge, aktuelle Datensätze und Spieltisch.
  - Die 409-Meldung nennt jetzt konkret, wo die Datei noch verwendet wird.
- `PATCH /api/files` (neu): Sichtbarkeit ändern.
  - Spieler: nur eigene Dateien, Privat oder Gruppe.
  - SL: zusätzlich SL-intern. Geteilte Dateien anderer darf die SL nicht privat stellen.
- Wiederherstellen älterer Fassungen von Szene, Story und Abendvorbereitung (`withoutDeletedFiles`): Verweise auf inzwischen gelöschte Dateien werden entfernt (Felder, Rich-Text- und HTML-Bilder). Die Wiederherstellung scheitert also nicht an einer fehlenden Datei. Alles andere bleibt wie gespeichert.

### Galerie (SL und Spieler)
- Ablagefläche mit Ziehen-und-Ablegen, mehrere Dateien gleichzeitig und Fortschrittsanzeige. Die Sichtbarkeit wird vorab gewählt.
- Filter nach Dateiart mit Zählern (Alle, Bilder, PDF, Audio, Video). Zusätzlich „Zeigen“: alle, nur meine, privat, SL-intern, Gruppe.
- Kacheln mit Bildzuschnitt, Sichtbarkeitsmarke und Datum. „Von dir“ kennzeichnet eigene Dateien.
- Datei-Dialog: große Vorschau (Bild, PDF, Audio, Video), Details, Sichtbarkeit ändern, **Verwendung** und Löschen mit Bestätigung.
  - Ist die Datei in Gebrauch, ist Löschen gesperrt und die Fundstellen werden genannt.
  - Ist sie nur im Verlauf vermerkt, steht ein Hinweis dabei.

### Material
- Materialtyp als Kachelauswahl mit Symbolen statt Auswahlliste.
- Handout: **Bildseiten zuerst**, der Text ist ein einklappbarer Bereich „Text des Handouts (optional)“. Das ist Codex-Vorschlag 1; Struktur und API sind unverändert.
- Materialkarten mit Vorschau bzw. Typsymbol und Status (Privat / Auf dem Tisch).
- Kompakte Ansicht in Regie und Tisch-Schuber: kurzer Kopf „Eigene Vorlagen · n“ mit „Neu“. Suche erst ab sechs Vorlagen, Empfängerwahl nur, wenn Vorlagen vorhanden sind. Das eigentliche Szenenmaterial rückt dadurch nach oben.
- Fehler behoben: Im Tisch-Schuber überdeckte das Vorschaubild eines Bildpakets die Buttons. Ursache war eine allgemeine Bildregel des Schubers.

### Spielerbereich
„Archiv & Vorbereitung“ hat jetzt drei Reiter: **Vorbereitung**, **Notizen** und **Meine Dateien**.
- Notizen als Kartenraster statt der alten Liste.
- Unter „Meine Dateien“ verwalten Spieler eigene Uploads, z. B. ungenutzte Dateien löschen oder freigeben. Vorher war das nur über Umwege möglich.

### Hinweise und Dopplungen
- Der Pager-Hinweis in der Regie nennt den aktuellen Weg: Material → Szenenbausteine → Szene → Pager-Nachricht. Das ist Codex-Vorschlag 2.
- Der Bausteineditor heißt überall „Szenenbausteine“; die alte Überschrift „Spielmaterial vorbereiten“ ist entfernt.

## Tests

- Typecheck, ESLint (app/server/domain) und Produktionsbuild sind grün. `pnpm test`: 223/223.
- Codex-Suiten gegen eine frische `--regie`-Instanz (Port 8882):
  - Material-API: 84 Prüfungen
  - Browser-Hauptabläufe: 12
  - Randfälle: 8
  - Pakete, Umzug, Entwürfe: 11
  - Alle grün.
- Testanpassungen:
  - Bisherige Tests verwenden die neuen Bedienelemente (Datei-Dialog, Typkacheln, „Szenenbausteine“). Zwei Tests nutzen jetzt wie die übrigen `CVK_PLAYWRIGHT_CHANNEL`.
  - Der bisherige Test „Bild aus wiederherstellbarem Verlauf bleibt geschützt“ ist ersetzt durch: „nur im Verlauf → löschbar; Wiederherstellen entfernt das fehlende Bild statt zu scheitern“.
  - Neu: Verwendung (aktuelle Nutzung vs. Verlauf), Spieler dürfen SL-Dateien weder prüfen noch umstellen, Sichtbarkeitswechsel.
- Integrationsregression `scripts/test-local.mjs`: 1.977 PASS, 0 FAIL, einschließlich der neuen Prüfungen für Galerie und Wiederherstellung.
- Browser von Hand: Galerie (1440 px), Löschen einer unbenutzten Datei, gesperrtes NSC-Porträt mit Fundstelle, Material-Editor, Spielerarchiv (1440 und 375 px, kein horizontaler Überlauf), Regie-Fenster und Tisch-Schuber.

## Offen / nicht Teil dieses Stands

- Codex-Vorschlag 3 (private Vorschaustufe für große Bilder) ist nur notiert. Erst Ladezeiten mit echtem Bestand messen.
- `tests/preparation-guide-browser.mjs` braucht eine eigene Instanz (Port 8820/8824). Angepasst wurde nur die Bereichsbezeichnung, ausgeführt wurde der Test nicht.
## Live-Release 31.10.2026

- Veröffentlicht auf Freigabe des Projektinhabers („Ja, live deployen“).
- **Stand und Version:**
  - Commit `2f28298`, aufbauend auf `origin/main` `0795040`.
  - Worker-Version `88d5f0a6-39ab-413c-b34a-a725803acf99`, Tag `galerie-material-2`, 100 % Verkehr.
  - Bindings und Laufzeit sind identisch mit der Vorversion: D1, R2, `AUTH_ACCESS_ENVIRONMENT=closed-alpha-production`, CPU 5000 ms, Kompatibilitätsdatum 2026-09-21.
- **Vorversion:** `188bf384-d465-41c7-9978-880daacff1e7` (Codex-Release Galerie/Material). Für ein Zurückschalten gelten Codex' Rückfallgrenzen weiter (siehe `releases/2026-10-31-galerie-material-claude-handover.md`).
- **Sicherung vorab:**
  - Export der 32 Tabellen (28.236 Zeilen), `integrity_check ok`.
  - Time-Travel-Lesezeichen `00000196-00000000-00005115-8ea89080ff8a9ef98e750b55b4591ff9`.
  - Ablage privat unter `.local-work/release-galerie-2/`.
- **Datenstand unmittelbar vor dem Deploy** (aus der Sicherung, nur lesend ausgewertet): 74 Dateien, davon waren 8 löschbar. 6 weitere waren nur durch das Protokoll gesperrt und sind jetzt löschbar. Die übrigen bleiben durch echte Verwendung geschützt, überwiegend NSC-Porträts.
- **Live-Prüfung ohne Anmeldung:**
  - `/anmelden` liefert 200.
  - Spielbereich, Galerie und Regie leiten mit 307 weiter.
  - `/api/files` (auch `?usage=`), `/api/table-materials`, Bühne und Datensätze liefern 401 mit `private, no-store`.
  - `PATCH /api/files` liefert ohne Anmeldung 401.
- **Rückfall:** keine Schemaänderung. Ein älterer Worker würde nach dem Löschen solcher Verlaufsdateien beim Wiederherstellen alter Fassungen wieder am fehlenden Bild scheitern; Fix-forward bevorzugen.

Nicht zurückgenommen: Die folgende Notiz zum Rückfall bleibt gültig.

- Rückfall: keine Schemaänderung. Ein älterer Worker würde nach dem Löschen solcher Verlaufsdateien beim Wiederherstellen alter Fassungen wieder am fehlenden Bild scheitern; Fix-forward bevorzugen.
