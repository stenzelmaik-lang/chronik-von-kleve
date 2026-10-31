# Universelles Spielmaterial-, Asset- und Präsentationssystem 3.0

Stand: 31.10.2026 · Branch `claude/material-system-3` von `origin/main` 671b0e4 · nur lokale Commits.
Kein Push, kein PR, kein Merge, kein Deployment. **Keine D1-Migration.**

## Kurzfassung

Das System erweitert das Bestehende, statt es zu ersetzen:
- Spielmaterial bleibt ein Szenenbaustein. Dazu kommt ein optionaler `material`-Block in `scene.document.elements[]`.
- Dateien bleiben in der vorhandenen Medienverwaltung (`/api/files`).
- Ausgespielt wird über die vorhandenen Bühnenbefehle (`add`, `visibility`, `remove`, `backdrop`).
- Es gibt keine zweite Medienverwaltung, keine neue Szenen-Engine und keinen neuen Spieltisch.

Das Anselmus-Paket ist nur ein Fixture. Im Code gibt es keine Sonderlogik dafür.

## Architektur (logisch getrennt)

| Ebene | Wo | Inhalt |
|---|---|---|
| Materialdefinition | `domain/material-system.ts`, `elements[].material` | Art (8 Arten), SL-Notiz, Anzeigeform |
| Medienreferenzen | `material.files[]` | geordnete Liste `{id, fileId, title}`. `element.fileId` spiegelt die erste Datei für ältere Builds. |
| Darstellungszustand | Darstellungs-Asset (`records`, `kind='notizen'`, `visibility='sl'`, `context='display-asset'`) | ein vorhandenes Bild je Zustand (`closed` Pflicht, `open` optional, weitere) |
| Effektzustand | `material.effect` | Öffnen, Schließen, Geschwindigkeit, Effektton, Verhalten nach dem Schließen |
| Freigabezustand | Bühnenobjekt `visibility` und `recipients` (unverändert) | SL, alle oder ausgewählte Spieler |
| Bühnenzustand | Bühnenobjekt mit optionalem `material` (`domain/live-stage.ts`) | Art, Anzeigeform, wirksamer Effekt, Zustandsbilder als Datei-IDs |
| Viewer-Zustand | nur im Browser (`material/viewer-state.ts`) | Seite, Zoom, Lautstärke, „schon geöffnet“, Effektton an/aus – je Person |

Gemeinsame Komponenten liegen unter `app/spielbereich/modules/material/`:

| Komponente | Datei |
|---|---|
| Materialkarte und Editor | `workbench.tsx` |
| Dateiauswahl und Mehrfach-Upload | `file-picker.tsx` |
| Asset-Galerie und Asset-Editor | `asset-gallery.tsx` |
| Viewer mit Effekten (Tisch, Regie, „Privat testen“) | `presenter.tsx` |
| Bühnenintegration | `stage-material.tsx` |
| Freigabe in Regie und Zweitfenster | `regie-materials.tsx` |

Den vorhandenen Kassettenplayer und Röhrenbildschirm (`media-objects.tsx`) nutzen Audio und Video weiter. Sie können jetzt ein Geräte- oder Rahmen-Asset als Hintergrund tragen.

### Server

- `server/display-assets.ts` und `app/api/display-assets/route.ts`:
  - Liste, Speichern und Löschen der Darstellungs-Assets; nur für die SL.
  - Verwendungsabfrage über `?usage=`.
  - Löschen eines verwendeten Assets wird mit 409 abgelehnt.
  - `validateSceneMaterials` prüft beim Speichern der Szene:
    - lesbare Dateien und passender Dateityp
    - mehrere Seiten nur als Bilder
    - Effektton muss Audio sein
    - Audio und Video mit höchstens einer Datei
- `server/material-stage.ts`:
  - baut das Bühnenobjekt (`scene-material:<Szene>:<Element>`)
  - baut die Regie-Liste
  - kopiert die SL-Notiz und den SL-Einsatztext nie ins Bühnenobjekt. Spieler erhalten nur Seitentitel, Datei-IDs und den Spielertext von Brief und Akte.
- `stageAsset` liefert Zustandsbilder (`&state=closed|open|…`) und den Effektton (`&sound=1`) nur über ein für die Person sichtbares Bühnenobjekt aus.
- Der Szenenhintergrund bleibt eine eigene Ebene. Neu ist der optionale Übergang `transition` (`fade`, `instant`, `slow`). Wetter und Licht bleiben unberührt.
- Die Verwendungsprüfung der Dateien greift automatisch:
  - Szenen liegen in `entities.gm_body`.
  - Asset-Definitionen liegen in `records.body`.
  - Eine Datei, die ein Asset oder Material nutzt, lässt sich nicht löschen (409).

## Oberfläche

### Material → Szenenbausteine („Interaktionen & Spielmaterial“)

- **Übersicht:**
  - Kompakte Karten mit Vorschau (Darstellung oder erstes Bild), Titel, Art, Dateianzahl, Anzeigeform, Effekt und Status. Status ist „Bereit · nicht veröffentlicht“, „Datei fehlt“, „Darstellung fehlt“ oder „Effekt-Ersatz aktiv“.
  - Suche, Filter nach Art, Sortierung (Szene, Titel, Art).
  - „Material hinzufügen“ beginnt mit der Wahl der Art.
- **Aktionen:** „Bearbeiten“ und „Privat testen“ direkt auf der Karte. Duplizieren, Verschieben und „Aus Szene entfernen“ (mit Bestätigung, löscht keine Originale) liegen im Kontextmenü.
- **Editor:** Inhalt → Gestaltung → Verhalten & Effekte → Vorschau → Speichern.
  - Typabhängige Optionen erscheinen nur dort, wo sie passen. Pager haben weder Gestaltung noch Effekte, Audio und Video keine Anzeigeform.
  - Der Speicherstatus ist immer sichtbar. **Speichern veröffentlicht nie.**
- **Dateien:**
  - Mehrfachauswahl, mehrfacher Upload mit Abbrechen und Status je Datei.
  - Reihenfolge ändern, benennen, ersetzen, „Verknüpfung entfernen“.
  - Hinweis, wenn eine private Datei enthalten ist.
- **Dateiauswahl:**
  - Getrennte Reiter: Diese Szene, Kampagne, Eigene Dateien, Darstellungs-Assets.
  - Herkunft und Zugriff stehen an jeder Datei.
  - Bei großen Listen werden 48 Dateien angezeigt, weitere auf Klick.
  - „Aus Auswahl entfernen“ (Chip) und „Original löschen …“ sind getrennt. Löschen zeigt erst die Verwendungen, ist bei Verwendung gesperrt und braucht eine Bestätigung.
- **Asset-Galerie:**
  - Suche, Filter (passend zur Materialart oder alle), neue Darstellung, Auswahl, „Bearbeiten / Ersetzen“ (gilt global, mit Hinweis auf die Anzahl der Verwendungen).
  - Löschen nur, wenn das Asset unbenutzt ist.
  - „Zuordnung entfernen“.
- Die übrigen Bausteine (Hinweis, Probe, Rätsel, Dialog, Verweise …) stehen weiter darunter im bisherigen Editor („Weitere Szenenbausteine“).
- Szenenschritt 4 bleibt der Einsatzplan. Er verlinkt direkt auf das Material dieser Szene (`?bereich=vorbereitung&material=szenen&szene=…`).

### Regie im Zweitfenster und Regie am Tisch

- Der neue Block „Szenenmaterial“ zeigt jedes Material als ein Objekt mit echter Darstellung und Effekt.
- **Aktionen:**
  - Privat ansehen: öffnet nur lokal und veröffentlicht nie.
  - Auf den Tisch legen: nur SL.
  - Freigeben: alle oder ausgewählte Spieler, je Material eigene Auswahl.
  - Zurückziehen.
  - Vom Tisch nehmen.
  - Beim Szenenhintergrund: „Als Hintergrund zeigen“.
- Fehlende Dateien oder Assets und ein aktiver Effekt-Ersatz werden genannt.
- Ältere Einzelmedien ohne `material`-Block stehen unverändert in den bisherigen Blöcken. Ein Material erscheint nie doppelt.

### Spieltisch

- Ein Material liegt als ein Objekt auf dem Tisch, mit seiner geschlossenen Darstellung (oder einer einfachen gezeichneten Darstellung).
- Ein Klick öffnet den persönlichen Viewer mit Effekt.
- **Anzeigeformen:** Einzelansicht, Stapel, Mappe/Buch, Doppelseite, Ausgelegt. Zoom und Seite gelten je Person.
- Nachbarseiten werden vorgeladen, große Medien erst beim Anzeigen.
- `prefers-reduced-motion` schaltet alle Animationen ab.
- Der Effektton spielt nur nach dem eigenen Klick und lässt sich je Person abschalten.
- Wird ein Material zurückgezogen oder vom Tisch genommen, schließt sich die offene Ansicht.
- Ein eintreffender Pager schließt die Ansicht ebenfalls (wie bei den anderen Dialogen).

## Effekte

Sofort, Einblenden, Aufklappen, Aufschlagen, Entsiegeln, Herausgleiten, Auffächern, Umblättern, Auslegen, Schließeffekt.

Einige Effekte brauchen Zustandsbilder oder mehrere Inhalte:
- Aufklappen und Entsiegeln brauchen `closed` und `open`.
- Aufschlagen und Herausgleiten brauchen `closed`.
- Auffächern, Umblättern und Auslegen brauchen mindestens zwei Inhalte.

Fehlt etwas, sagt der Editor das und bietet den Ersatz an („Ersatz übernehmen“). Server und Viewer berechnen den wirksamen Effekt gleich (`effectiveEffect`). Das Bühnenobjekt merkt sich den ursprünglich gewünschten Effekt in `requested`.

## Lokale Testinstanz

```bash
node --experimental-strip-types scripts/test-local.mjs --material-3
```

Alternativ `.\scripts\start-material-3.ps1 [-Build] [-Reset]`.

- **Adresse:** http://127.0.0.1:8893.
- **Testspeicher:** `.local-test/material-3`.
- **Konten:** `command-gm`, `command-a` und `command-b@example.invalid`; das Passwort steht in `scripts/test-local.mjs`.
- Der Abend startet automatisch.

Die Fixtures (`tests/fixtures/material-3.mjs`) bestehen nur aus synthetischen Bildern:
- **Assets:** Messingrahmen, Paketumschlag (zu/offen), Geheimakte-Mappe (zu/offen), Röhrenradio (zu/offen), Fernsehgehäuse, Nachthimmel.
- **Szene 01 (Kaserne):**
  - Einzelbild mit Rahmen
  - Anselmus-Paket (6 Fotos, Umschlag, Entsiegeln, Effektton, Stapel)
  - Brief mit demselben Umschlag
  - Audio mit Radio
  - Video mit Gehäuse
  - Pager nur an Spieler A
  - Hintergrund
  - Material mit fehlendem Asset
  - dazu die alten Einzelmedien
- **Szene 02 (Keller):** Geheimakte (3 Blätter, Mappe, Aufschlagen, Doppelseite, langsam).
- 80 zusätzliche Archivbilder für die große Dateiliste.

## Tests

| Test | Ergebnis |
|---|---|
| `pnpm test` (Unit, inkl. neu `tests/material-system.test.mjs`, 7 Fälle) | 297/297 grün |
| Typecheck (`tsc --noEmit`) | grün |
| Lint (ohne `prototypes/`) | 0 Fehler, 7 bekannte Warnungen in älteren Tests |
| Build | grün |
| neu `tests/material-3-integration.mjs` (SL, Spieler A und B über die echte API) | 17 Blöcke grün |
| neu `tests/material-3-browser.mjs` (Edge, Desktop 1440 und Handy 375 mit Touch; Spieler B mit reduzierter Bewegung) | 7 Blöcke je Viewport grün |
| Regression gegen dieselbe Instanz: `spieltisch-medien-`, `regie-zweitfenster-`, `ultio-pager-`, `regie-nachbesserung-` und `spieltisch-regie-integration` | alle grün |

Die Browser-Tests der anderen Etappen prüfen fest ihre eigenen Ports und liefen hier nicht.

Abdeckung der Abnahmefälle:

| # | Fall | Integration | Browser |
|---|---|---|---|
| 1 | Einzelbild mit frei gewähltem Rahmen | ✔ | ✔ privat öffnen/schließen |
| 2 | Anselmus-Paket: 6 Bilder in fester Reihenfolge, Umschlag, Effekt, unabhängiges Blättern | ✔ | ✔ A auf Bild 3, B auf Bild 1 |
| 3 | Geheimakte in anderer Szene, anderes Asset und anderer Effekt, ohne Sondercode | ✔ | – |
| 4 | Audio mit eigener Darstellung und eigenem Effekt | ✔ | ✔ |
| 5 | Video mit Bildschirmrahmen, Öffnen und Schließen | ✔ | ✔ |
| 6 | Pager gezielt an einen Spieler | ✔ | – (unverändert, eigene Pager-Tests) |
| 7 | Dasselbe Umschlag-Asset in zwei Materialien, keine Dateikopie | ✔ | – |
| 8 | SL, A und B sehen nur ihre Freigaben, auch über die Asset-Route | ✔ | ✔ |
| 9 | Alte Einzelbilder, Handouts, Szenen und Bühnenobjekte | ✔ und Regressionssuiten | – |
| 10 | Einheitliche Oberfläche, große Dateiliste, fehlende Assets, Validierung | ✔ | ✔ Karten, Suche, Filter, keine horizontale Scrollleiste |

Screenshots liegen lokal in `.local-work/ux-check/material-3/` (nicht versioniert).

## Rückwärtskompatibilität und Rollback

- Alle neuen Felder sind optional: `elements[].material`, Bühnenobjekt `material`, `backdrop.transition`.
- Ältere Szenen und Bühnenstände bleiben gültig.
- Ein Rollback auf einen älteren Build scheitert bei Szenen, die `material` nutzen. Die strikten Schemas lehnen das Feld ab: Die Szene ist dann nicht speicherbar bzw. lesbar.
- Für einen Rollback daher vorher die Materialien entfernen, oder einen Build mit diesem Branch behalten. Das gilt wie bei den Pager-Bausteinen.
- Darstellungs-Assets sind normale `records` und stören ältere Builds nicht. Das Dashboard blendet sie aus.

## Offene Einschränkungen

1. **Assets gelten pro Kampagne.**
   - Grund: Dateien und Datensätze sind kampagnengebunden.
   - Kampagnenübergreifende Wiederverwendung bräuchte eine neue Tabelle oder Migration. Das ist nach den harten Regeln nur mit fachlicher Freigabe des Projektinhabers möglich.
2. **Effekte sind CSS-Animationen auf den Zustandsbildern.**
   - Mit Nur-„geschlossen“-Assets wird bei Aufklappen und Entsiegeln automatisch eingeblendet.
   - Zusätzliche Zustände (über `closed` und `open` hinaus) werden gespeichert und angezeigt, aber noch von keinem Effekt animiert.
3. **Audio und Video nehmen je eine Datei.** Mehrere Dateien (Playlist) sind nicht vorgesehen.
4. **Mehrere Seiten müssen Bilder sein.** Ein PDF ist eine Einzeldatei und nutzt den vorhandenen PDF-Viewer.
5. **Die Regie zeigt Materialien nur im neuen Block, wenn sie einen `material`-Block haben.**
   - Ältere Einzelmedien bleiben in den bisherigen Blöcken, bis sie im Editor einmal bearbeitet und gespeichert werden. Dann werden sie automatisch übernommen.
6. **Das Fixture-Video ist nur eine WebM-Signatur.** Es besteht die Upload-Prüfung, ist aber nicht abspielbar. Der Rahmen und das Öffnen und Schließen sind trotzdem prüfbar.
7. **Viewer-Zustand und Effektton-Einstellung liegen im `localStorage` des Browsers.** Auf einem anderen Gerät beginnt man wieder bei Seite 1.
8. **Zustandsbilder und Seiten werden wie bisher mit `no-store` ausgeliefert.** Das Vorladen der Nachbarseiten wirkt deshalb nur, solange der Browser die Bilder im Speicher hält. Eine Cache-Lockerung wurde bewusst nicht vorgenommen (Rechtewechsel sollen sofort greifen).
9. **„Verdächtige private Dateien“:**
   - Sichtbar gemacht wird das durch die Herkunft an jeder Datei und den Hinweis im Editor.
   - Es gibt keinen automatischen Bericht und kein automatisches Löschen.
   - Spieler sehen fremde private Dateien weiterhin nicht (`/api/files` filtert serverseitig).
10. **„Duplizieren“ dupliziert innerhalb der Szene.** Kopieren in eine andere Szene ist nicht umgesetzt.
11. **Kein Live-Deployment, kein Push, kein PR.** Merge-Konfliktpotenzial: `stage.tsx`, `regie-window.tsx`, `regie.tsx`, `media-objects.tsx`, `domain/live-stage.ts`, `domain/story-scene.ts`, `server/live-stage.ts`, `server/story-scenes.ts`, `preparation-materials.tsx`, `material-preparation.tsx`, `scripts/test-local.mjs`, `package.json`.

## Live-Release 31.10.2026

- Freigegeben durch den Projektinhaber („Ja, mergen und live“). PR #56 ist als `3fa5e6e` gemergt und enthält den Pager-Fix aus PR #55.
- Worker-Version `9f9dbbcc-2cfb-4616-86df-f978723a46fd`, Tag `3fa5e6e-Spielmaterial-3`, 100 % Verkehr. Bindings unverändert.
- Rückfallversion: `5954135a-b260-4471-b41c-d3306388ba45` (Pager-Fix).
  - **Einschränkung:** Sobald eine Szene einen `material`-Block nutzt, lehnt der ältere Build sie ab (siehe „Rückwärtskompatibilität und Rollback“). Vor einem Rückfall die Materialien dieser Szenen entfernen.
  - Darstellungs-Assets stören den älteren Build nicht.
- CI auf PR #56 grün: Typecheck, Lint, Tests, Build und SL-Browserdurchlauf.
- Lokal am identischen Stand `fd68afb` geprüft:
  - Typecheck, App-Lint, 304 Unit-Tests und Build grün.
  - Material-3-Integration und Material-3-Browsertest (Desktop und 375 px) grün.
- Sicherung vorab:
  - 32 Tabellen, 29.354 Zeilen, `integrity_check ok`.
  - Lesezeichen `0000019c-000013e5-00005115-2d5164fc99dda21d2da9112a978b9780`.
  - Ablage: privat unter `.local-work/release-material-3/`.
- Live-Prüfung ohne Anmeldung:
  - `/anmelden` antwortet mit 200.
  - Spielbereich, Command Center und Regie leiten mit 307 weiter.
  - Bühne, Bühnen-Asset, Dateien, Darstellungs-Assets und Spieltisch antworten mit 401 und `private, no-store`.
  - Die Pager-Dateien antworten mit 200.
- Keine Schemaänderung, keine Datenmigration.