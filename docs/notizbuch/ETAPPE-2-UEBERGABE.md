# Etappe 2 · Notizbuch · Übergabe

Stand 08.11.2026 · Claude Code (Opus 5.5) · lokal, nicht gepusht, nicht deployt

| | |
|---|---|
| Branch | `claude/notizbuch` |
| Basis | `claude/journal-ad-acta` @ `8d6b40c` (Etappe 1, vom Besitzer am 08.11. abgenommen). Abweichung vom Auftrag (Abzweig von `claude/journal-release`): Das Notizbuch braucht den Rückbau des Journals und die geretteten Datumshilfen. |
| Nebenbranch | `claude/testdaten-aufraeumen` @ `b25a58f` (von `claude/journal-release`): entfernt das unbenutzte `tests/fixtures/account-avatar.png` |

## Entscheidungen des Besitzers, die hier gelten

- **SL-Einsicht (08.11.):** Die SL kann Notizbuchseiten lesen, nie bearbeiten oder löschen. Das ersetzt die Vorgabe „die SL nie“ aus dem Auftrag. Datenschutzrelevantes bleibt gesperrt: Briefe, die ein Spieler aus dem Postfach übernommen hat, sieht die SL nicht, weil fremde Korrespondenz nach der bestehenden Regel privat ist.
- **Optik nach Referenzbild (08.11.):** Spiralbuch, cremefarbenes Papier, liniert statt kariert, Kopfzeilen für Thema und Datum, keine Haftnotizen. Das ersetzt die Vorgabe „Optik bleibt vorerst die vorhandene“. Haftnotizen bzw. Notizzettel werden später eigens gestaltet.
- **Info-Knöpfe:** Jeder überarbeitete Bereich erklärt kurz, was der Spieler dort tun kann. Umgesetzt für Notizbuch, Spielabendvorbereitung und Persönliches Archiv als wiederverwendbare Komponente `InfoButton`.
- **Benennung:** Der Eintrag `notizen` heißt jetzt „Notizbuch“, mit den Reitern „Notizbuch“ (Standard), „Spielabendvorbereitung“ und „Persönliches Archiv“.

## Änderungen

**Daten und Rechte** (keine Migration, kein Schema)
- Neue Route `GET/POST /api/notebook` (`app/api/notebook/route.ts`):
  - Eine Seite ist ein eigener Datensatz `records` mit `kind='notizen'`. Systemdatensätze sind ausgeschlossen (Spielraum, Briefe, Termine, Material, Darstellungs-Assets), archivierte Figurnotizen auch.
  - Spieler: lesen und schreiben nur eigene Seiten.
  - SL: `?member=<id>`, nur lesen, ohne übernommene Briefe.
  - Fremde Seiten und Systemzeilen antworten wie fehlende (404).
  - Die Sichtbarkeit lässt sich über das Notizbuch nicht ändern. Neue Seiten sind `private`.
- **Speichern** ändert nur `text`, `date`, `tags`, Titel und `autoTitle`. Alle anderen Felder bleiben, auch alte Journal-Felder und Felder späterer Versionen. Dafür lädt der Server den gespeicherten Body, die Projektion spielt keine Rolle.
- **Versionskonflikt** liefert 409. Der Entwurf bleibt, der Spieler wählt „Als neue Seite speichern“ oder „Gespeicherte Fassung laden“.
- **Löschen:** Einfache Seiten, Orts- und Briefnotizen werden hart gelöscht. Figurnotizen werden archiviert, wie in der Charakterverwaltung. Der Dialog sagt das jeweils ehrlich.
- **Ortsnotizen:** Beim Speichern im Notizbuch prüft der Server die Ortsfreigabe nicht erneut. Der Ortsbezug ändert sich nicht, und so bleibt die Notiz bearbeitbar, auch wenn der Ort inzwischen verborgen ist. Der bisherige Weg über `/api/records` prüft weiterhin.
- **Regeln** in `domain/notebook.ts`: Erkennung, Seitendatum (eigenes Datum, sonst Spieldatum, sonst Anlagetag), Titel aus der ersten Zeile, Schlagwörter (höchstens 20, je 40 Zeichen, ohne Doppel), Sortierung, Suche (ohne Akzente, alle Wörter), Entwurfsvergleich.

**Oberfläche**
- `app/spielbereich/modules/notebook/notebook.tsx`: **eine** Komponente mit zwei Layouts. „wide“ zeigt Liste und Seite nebeneinander. „narrow“ zeigt erst die Liste, dann die Seite.
  - Neue Seite mit einem Tipp, der Cursor steht im Text.
  - Thema freiwillig, Datum heute und änderbar, optionale Figur für neue Seiten.
  - Speichert automatisch 1,2 s nach dem Tippen und beim Schließen bzw. Verlassen (`keepalive`). Der Stand ist sichtbar: Gespeichert, Ungespeichert, Speichert …, Nicht gespeichert.
  - Formatierte (HTML-)Seiten werden mit `RichTextView` gelesen. Bearbeitet werden sie erst nach ausdrücklichem Klick, dann im vorhandenen `RichTextEditor`. HTML wird dabei in das typisierte Rich-Text-Format übersetzt, ohne Inhalt zu verlieren. Ohne Klick bleibt das Markup unverändert.
- Optik: `notebook.module.css`.
  - Die Seite liegt auf der Tischebene: Papier, Linien, eine selbst gezeichnete Spiralbindung als SVG im CSS, keine Fremdgrafik.
  - Die Liste daneben bleibt im dunklen Rahmen der App.
  - Farben stehen als lokale `--nb-*`-Tokens bereit, bis Etappe 3 sie benennt.
- **Spielerbereich:** `player-archive.tsx` mit den Reitern Notizbuch (Standard), Spielabendvorbereitung, Persönliches Archiv, je mit Info-Knopf. Die Vorbereitung für Spieler heißt „Deine Spielabendvorbereitung“ und hat einen erklärenden Satz. Kachel und Eintrag heißen „Notizbuch“. Im Postfach heißt der Knopf jetzt „Ins Notizbuch“.
- **Spieltisch:**
  - Neues Symbol „Notizbuch · dein eigenes Buch“ direkt unter „Notizzettel · liegen auf dem Tisch“. Es öffnet eine Schublade rechts, in der Breite verstellbar wie „Kontext“.
  - Der Hinweis im Notizzettel-Panel erklärt den Unterschied. Die Bedienhilfe nennt das Notizbuch.
  - SL: Spielerleiste → Teilnehmer → „Notizbuch (lesen)“.
- **Seite Sitzung:** Die „Private Schnellnotiz“ ist durch das Notizbuch ersetzt, `scene-quick-note.tsx` ist entfernt. Die Seite ist für Spieler weiterhin nicht erreichbar (siehe Bestandsaufnahme 1.2 b).
- Entwürfe liegen im vorhandenen `player-data-cache`, im Bereich der offenen Spielerseite (neu: `currentPlayerDataScope()`). Es gibt kein `localStorage`.
- **Notizzettel** auf der Bühne sind unverändert.

**Tests**
- Neu: `tests/notebook.test.mjs` (10 Tests, in `pnpm test` aufgenommen) und `tests/notebook-integration.mjs` (46 Prüfungen gegen eine lokale Instanz).
- Angepasst:
  - `tests/dashboard-ux.test.mjs`: Der Test der entfernten Schnellnotiz prüft jetzt das Notizbuch in der Sitzungsschublade.
  - `tests/table-materials-browser.mjs`: neuer Reiter- und Seitentitel. Diesen Browsertest habe ich nicht ausgeführt.

## Prüfungen (beobachtet)

| Prüfung | Ergebnis |
|---|---|
| `pnpm run typecheck` | ohne Fehler |
| `pnpm test` | **391/391** (vorher 381, +10 Notizbuch) |
| `node --experimental-strip-types --test tests/*.test.mjs` | **505/511**, dieselben 6 Altfälle wie auf dem Basisstand (4× NPC, 2 Ortsdossier-Dateien mit `ERR_MODULE_NOT_FOUND`) |
| ESLint auf allen 21 neuen und geänderten Dateien | ohne Fehler. Eine Warnung in `table-material-library.tsx` Z. 2 (unbenutzte Direktive) stand schon vorher dort |
| `pnpm run build` | erfolgreich |
| `pnpm run test:integration:run` | Exit 0 (2.151 + 46 Rollenprüfungen) |
| `tests/notebook-integration.mjs` gegen `scripts/test-local.mjs --command-center` | **46/46** |

Abgedeckt sind:
- ältere Journal-Einträge sichtbar, Spieldatum als Seitendatum;
- Speichern und Neuladen, unbekannte Felder bleiben, Konflikt 409 ändert nichts;
- Spieler B ohne Lesen, Schreiben oder Löschen, auch mit fremden IDs;
- SL liest, bearbeitet und löscht nicht, sieht keine übernommenen Briefe;
- ein echter Brief über „Ins Notizbuch“ landet als Seite;
- harte und weiche Löschung;
- nicht angemeldet 401, fremde Website 403.

| Browser (eingebaute Vorschau, Chromium, emuliert) | Ergebnis |
|---|---|
| 1280 px, Spielerbereich ohne laufende Sitzung | Neue Seite, Text tippen, automatisch gespeichert, Schlagwort gesetzt und als Filter verfügbar, Optik nach Referenz |
| Neustart der lokalen Instanz | Seite und Schlagwort sind danach noch da (Speichern und Neuladen) |
| 1280 px, Spieltisch (laufender Abend, `--ge-01`) | Symbol unter „Notizzettel“, Schublade rechts, **dieselbe Seite** geöffnet und ergänzt, „Gespeichert“ |
| 375 px, Spielerbereich und Spieltisch | Reiter, „Kurz erklärt“ (öffnet als Tafel von unten), Neue Seite, Liste. Am Tisch füllt die Schublade fast die Breite |
| Gegencheck | Im Spielerbereich findet die Suche nach „siegelring“ die am Tisch ergänzte Seite |
| Konsole | keine Fehler außer Verbindungsabbrüchen während des Server-Neustarts |

Die lokale Testdatenbank des Browsertests (`.local-test/ge-01`) habe ich danach gelöscht.

## Prüfgrenzen

- **Kein echtes Mobilgerät** und keine echte Bildschirmtastatur.
- **SL-Leseansicht:** Am Tisch nicht im Browser geöffnet, nur über die Route geprüft (Integrationstest).
- **Konflikt- und Fehlerdialog:** Nur über die Route geprüft, nicht im Browser ausgelöst.
- **Speichern beim Verlassen:** Der `keepalive`-Weg beim Schließen des Tabs ist nicht gezielt gemessen. Wechsel zwischen Ansichten und Schließen der Schublade sind abgedeckt.
- **Suche im Browser:** Gemessen in Node: 1.000 Seiten in etwa 10 ms. Grenze `SEARCH_PAGE_LIMIT` = 1.000. Die Route lädt höchstens 2.000 Zeilen.
- **Entwürfe** überleben kein Neuladen der Seite, weil `player-data-cache` nur im Arbeitsspeicher liegt (siehe Bestandsaufnahme). Gespeichertes bleibt natürlich.
- **Bei 375 px** zeigt der Spielerbereich Liste und Seite untereinander statt nacheinander. Das ist bedienbar, aber lang.
- **Kein Screenreader-Durchgang.**

## Offene Punkte

- **Testeinträge in der Live-App (nur gelesen, nichts geändert):** Keine KI-Testdaten gefunden. Diese vier Einträge haben Menschen angelegt:
  - 1 Ort „Test“, 1 Bereich „test“ und 1 Information „test“, alle von **Pano** am 03.11., ohne Unterbereiche;
  - 1 Brief mit dem Betreff „Test“ von **FranZilla** am 01.11.

  Löschen nur nach deiner Bestätigung. Vorschlag: die drei Orte über die Ortsverwaltung in den Papierkorb legen, den Brief lässt FranZilla selbst löschen.
- **Repo-Prüfskripte:** 28 Skripte unter `tests/` ruft keine CI auf (z. B. `tests/notebook-integration.mjs`, `live-stage-integration.mjs`). Das sind Rechte- und Datenschutzprüfungen gegen lokale Instanzen, keine Testdaten. Ich habe sie behalten.
- **Etappe 3:** Die Notizbuch-Tokens (`--nb-*`) ins `--cp-*`-System übernehmen. Die Leistensymbole bekommen in Etappe 4a sichtbare Beschriftungen.
- **E-Mail-Adressen im SL-Kampagnenexport** (Befund aus Etappe 0): weiter offen, braucht eine eigene Freigabe.

## Ausdrücklich nicht getan

Kein Push, kein Merge, kein Deployment, keine Migration, keine Änderung an Produktionsdaten (die Live-Datenbank habe ich nur lesend abgefragt), keine neue Abhängigkeit. Notizzettel, Ortsnotiz-Formular und Postfach-Logik sind unverändert.
