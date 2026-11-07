# AJ-01 · Abenteuerjournal am Spieltisch – Übergabe (lokaler Stand)

Stand 07.11.2026 · Claude Code (Opus 5.5) · **nicht committet, nicht gepusht, nicht deployt**

- Worktree: `.claude/worktrees/chroniplay-abenteuerjournal-23ec22`, Branch `claude/chroniplay-abenteuerjournal-23ec22`
- Basis-Commit: `acbc62d` (zum Arbeitsbeginn identisch mit `origin/main`)
- Auftrag: „ChroniPlay Alpha 2.0 · Abenteuerjournal am Spieltisch“ (07.11.2026), erweitert durch die Vorgabe des Besitzers im Verlauf: Das Buch ist **kein Fenster**, sondern ein freistehendes, verschiebbares 3D-Objekt auf dem Spielfeld, Optik nach dem Referenzblatt „Journal-Modul · Asset-Paket“ mit Lesezeichen.

## Was gebaut ist

**Buch als Objekt auf dem Tisch** (`app/spielbereich/modules/spieltisch/journal/`)

| Zustand | Verhalten |
|---|---|
| Weggepackt | Buchrücken (Leder, Bünde, Messingkappen, Goldtitel) schaut am rechten Tischrand hervor („Abenteuerjournal hervorholen“). Ein Punkt markiert einen offenen Entwurf. |
| Zugeklappt | Kleines 3D-Buch liegt auf dem Tisch, frei verschiebbar (ziehen; mit Tastatur Pfeiltasten auf dem Buch bzw. Alt+Pfeiltasten). Klick/Enter schlägt auf. Medaillons auf dem Riemen: Aufschlagen, Wegpacken. |
| Aufgeschlagen | Buch in Lesegröße auf dem Tisch, verschiebbar, ohne Fensterrahmen und **ohne Menü über dem Buch**. Bedienung nur am Buch (siehe Bediensystem). |
| Groß | Füllt die Bildfläche über der abgedunkelten Bühne zum bequemen Lesen. Escape: groß → Tisch → zugeklappt. |

**Optik v3 (Runde 3, nach Referenzfoto des Besitzers)**: dunkles, abgegriffenes Braunleder mit Kupferschimmer und hellerem Kantenabrieb, blindgeprägtes gotisches Ornament (eigener Entwurf) im Doppelrahmen ohne Gold, hellbraune Sattelnaht, vier gerundete Bünde, gehämmerte Messingecken mit je drei Nieten nur an der Vorderkante, Wickelriemen mit D-Ring-Schnalle, Schlaufe und spitzem Riemenende mit Niete. Alle Farben aus einer Familie: Register und Bänder in gedeckten Ledertönen, Messing gealtert, CSS-Buch, Buchrücken am Rand und Handy in Braun. Bedienung in 3D aus demselben Messing: zugeklappt öffnet die Schnalle, das Riemenende packt weg; aufgeschlagen liegt der gelöste Riemen links neben dem Buch und trägt drei gravierte Conchos (Groß/Zurück, Zuklappen, Wegpacken). Klickflächen darüber sind unsichtbar und zeigen bei Hover/Fokus eine warme Leuchtkante und das Lederschild.

**Bediensystem am Buch** (Runde 2 nach Vorgabe des Besitzers: keine Menüs oberhalb des Buchs, alles im Buch verankert, hochwertig)

| Teil des Buchs | Funktion |
|---|---|
| Gelöster Wickelriemen links mit drei gravierten Messing-Conchos (3D; Lederschild mit Namen bei Hover/Fokus) | Groß lesen / Zurück auf den Tisch · Zuklappen · Wegpacken |
| Zugeklappt: D-Ring-Schnalle und Riemenende (3D) | Aufschlagen · Wegpacken |
| Lederregister rechts (Registerfarbe, Symbol, Name) | Bereiche: Chronik, Charakterbogen (später Inventar, Briefe, Handouts, Galerie) |
| Seidenbänder unten links, je Register eins in Registerfarbe | zeigen nur den Bereich an und springen dorthin |
| Seidenbänder unten rechts, vom Spieler eingelegt (bis zu 4, eigene Farbe und Emblem) | merken Seite und gegebenenfalls den geöffneten Eintrag; Klick springt hin, Messingknopf nimmt heraus; helle Schlaufe legt ein neues ein |
| Eselsohren an den äußeren unteren Seitenecken | Blättern (zusätzlich Pfeiltasten; auf dem Handy Wischen) |
| Seitenzahlen und Kolumnentitel unten auf dem Papier | Position im Buch |
| Rotes Wachssiegel | Speichern eines Eintrags |
| Feder-Schreibleiste (Zwischenüberschrift, Fett, Kursiv, Unterstrichen, Aufzählung) | ersetzt die dunkle H2/H3/B/I/U/Farbe-Leiste; aktive Formate gold unterstrichen |

Bänder, Eselsohren und Siegel sind HTML/CSS über der 3D-Szene; Riemen, Conchos, Schnalle, Register und Buch sind 3D. Ohne WebGL und auf dem Handy übernehmen CSS-Medaillons in gealtertem Messing dieselben Aufgaben. Auf dem Handy wird der Riemen zum Kopfband mit „Zum Tisch“ und „Wegpacken“.

- Tischroute, Sitzung, Polling, Anwesenheit, Audio, Zustellungen und Proben laufen unverändert weiter; nachgewiesen ohne Neuladen über einen Seitenmarker in allen Zustandswechseln.
- 3D (Three.js 0.186.1, vorhanden): Deckel öffnet am Rücken, Blätter wenden sich, schnelle Eingaben laufen über ein gemeinsames Ziel (ein Schwung statt vieler Einzelblätter). Leder mit Goldprägung, Kompassrose, Messingecken mit Nieten, Bünde, Riemen mit Schnalle, gealtertes Papier mit Rahmen und Eckornamenten, Goldschnitt, Lederregister, Verschlussriemen als Medaillon-Träger. Alle Materialien werden zur Laufzeit prozedural gezeichnet: keine Bilddateien, keine Fremdgrafik. **Studienmaterial unter dem AJ-04-Qualitätsstopp**.
- Shader werden asynchron vorkompiliert (`compileAsync`), damit der laufende Tisch beim Hervorholen nicht einfriert.
- Ohne WebGL oder bei reduzierter Bewegung: dasselbe Buch und Bediensystem als CSS-Buch (Ledereinband, Riemen mit Medaillons, Register, Bänder), voll bedienbar. Der frühere Schalter „Flach“ entfällt.
- Schmale Displays (≤ 720 px): aufgeschlagen füllt das Buch den Bildschirm, eine Seite zur Zeit, Register oben, Lesezeichen unten, Schließen-Knopf immer sichtbar. Die Höhe folgt `visualViewport`, damit die Bildschirmtastatur Entwurf und Rückweg nicht verdeckt.
- Texte, Werte und Bedienung sind eine scharfe HTML-Ebene; Punkte und Kästchen haben Zahlenwerte für Screenreader; Statusmeldungen über `role=status`.

**Chronikregister:** „Meine Notizen“ und „Chronik“ (datiert, nach Spieldatum sortiert). Anlegen, öffnen, ändern während der Sitzung. Speicherstatus sichtbar (Leer / Ungespeichert / Wird gespeichert / Gespeichert / Nicht gespeichert). Bei Konflikt (409) oder Netzfehler bleibt der Entwurf; Konflikt bietet „Als neuen Eintrag speichern“ oder „Gespeicherte Fassung laden“. Ein Entwurf trägt seine Figur; Speichern geht immer an diese Figur, mit Hinweis, falls inzwischen eine andere Figur aktiv ist. Ungebundene eigene Notizen erscheinen nur lesend unter „Notizen ohne Figur“.

**Charakterbogen:** nach der deutschen V20-Papiervorlage nachgebaut (eigener Zierrahmen, dreispaltige Gruppen, Punktereihen, Kästchen), kleines Porträt, eigene Seite für die Hintergrundgeschichte. Quelle ist ausschließlich die persönliche Projektion (`/api/character-detail` ohne `view=sl`); aktuelle Blut-, Willenskraft- und Schadenswerte kommen aus dem Tisch-Snapshot (`vitals`) und laden bei neuer Charakterversion nach. Fehlende Werte „–“, echte Nullen sichtbar, mehr als fünf Punkte, Spezialisierungen, freie und zusätzlich gespeicherte Fähigkeiten. Eine offene Probe erscheint als Zettel mit „Zum Würfeln“.

## Daten und Server (klein, abwärtskompatibel, kein neues Schema)

- `PATCH /api/character-companion`: `note.create`/`note.update` akzeptieren optional `journalKind` (`note`|`chronicle`) und `playDate` (ISO-Datum, echte Monatslängen). Ein Chronikeintrag braucht ein Spieldatum. Fehlen die Felder bei `note.update` (ältere Formulare), bleiben gespeicherte Werte erhalten. Kein Migrationsbedarf, keine Umwandlung bestehender Notizen.
- Projektion: Notizen tragen `journalKind` (Standard `note`) und `playDate`. Mit `?journal=1` (nur Besitzer, nie bei `view=sl`) kommen eigene private ungebundene Notizen dazu (System-Kontexte ausgeschlossen).
- Schalter: `journalEnabled` im Spieler-Snapshot von `/api/live-stage`, nur wenn `AJ01_JOURNAL=local-only` **und** `AUTH_ACCESS_ENVIRONMENT=local-test`, oder die Kampagne in `AJ01_JOURNAL_CAMPAIGNS` steht (kein Wildcard). Standard: aus. SL sieht ihn nie. Ausschalten blendet nur das Buch aus; Einträge bleiben in der Charakterverwaltung (dort jetzt mit „Chronikeintrag · Spieldatum“).
- Charakterverwaltung zeigt Chronikeinträge mit Spieldatum an.

## Prüfungen (beobachtet)

| Prüfung | Ergebnis |
|---|---|
| `pnpm run typecheck` | ohne Fehler |
| ESLint auf allen geänderten/neuen Dateien | ohne Befund |
| `pnpm run lint` (gesamt) | 12 Fehler, alle in nicht angefassten Dateien (u. a. `prototypes/spieltisch-2/*`) – vorbestehend |
| `pnpm test` | 359/359 bestanden |
| `node --experimental-strip-types --test tests/*.test.mjs` (74 Dateien) | 510/514; die 4 Fehlschläge (`npc-data`, `npc-dossier`) treten identisch auf dem unveränderten Basisstand `acbc62d` auf – vorbestehend, nicht in `pnpm test`, nicht angefasst |
| `tests/journal.test.mjs` | 12/12 (Typmerkmal, Spieldatum, Sortierung, Entwurf→Anfrage, Blättern, Zustände, Escape, Ablageort, Bereichs- und eigene Lesezeichen inkl. Grenze/Farben/Bereinigung, Schalter, Bogenwerte) |
| `pnpm run build` | erfolgreich |
| `tests/journal-integration.mjs` gegen `--journal` (Port 8897) | 38/38: Speichern/Neuladen, Konflikt, alte Formulare, zwei eigene Figuren getrennt, Spieler B und SL ohne Zugriff auch mit fremden IDs, anonym 401, Schalter nur Spieler, Blutausgabe am Tisch = Bogenquelle, Sonderfälle der zweiten Figur |
| Browser Runde 2 | Kein Menü über dem Buch; Medaillons offen/zu/groß, Register, Bereichsbänder, eigenes Lesezeichen einlegen → woanders hin → zurück in denselben Eintrag → herausnehmen, Federleiste (Fett aktiv angezeigt), Siegeln speichert, Großansicht, zugeklappt mit Riemen-Medaillons, CSS-Buch ohne WebGL, Handy 375×812 mit Kopfband |
| Browser (eingebaute Vorschau, Chromium, 1600×900 emuliert) | Hervorholen, Aufklappen, Verschieben offen/zu, Zuklappen, Klick öffnet, Groß, Escape-Stufen, Wegpacken (WebGL freigegeben, Fokus zurück), Register, Lesezeichen, schnelles Blättern, Live-Schaden im offenen Bogen, Eintrag anlegen/speichern, Entwurf über Darstellungswechsel, Betrieb ohne WebGL (simuliert), Leseansicht |
| Handy-Emulation 375×812 | eine Seite, Register, Lesezeichen, Schließen sichtbar |

## Prüfgrenzen und offene Punkte

- Runde 3 (Optik v3) wurde gebaut, `pnpm test` 359/359 und Journal-Tests 12/12 liefen erneut; der Integrationstest wurde nicht wiederholt, weil der Besitzer parallel in derselben Testinstanz arbeitete (Servercode unverändert, letzter Lauf 38/38). Sichtprüfung im Browser für geöffnet und zugeklappt; Handy und CSS-Buch nach der Farbumstellung nicht erneut fotografiert.

- **Kein echtes Handy getestet** (Auftrag fordert Gerät, Browser, Ergebnis). Bildschirmtastatur nur über `visualViewport`-Code, nicht real geprüft.
- Animationsdauer und Bildrate nicht gemessen: die eingebaute Vorschau war ausgeblendet, dabei pausiert der Browser die Animationsframes.
- Kein Screenreader-Durchgang.
- Optik: prozedurale Studienmaterialien. Finale Grafik (AJ-04) und eventuelle Bild-Assets brauchen Freigabe; Originalgrafiken des Papierbogens wurden nicht verwendet.
- Visionen/Zustellungen liegen unter der Großansicht (Bühnenebene); der Tisch empfängt sie weiter.
- Der gemeinsame Rich-Text-Editor hat zwei neue optionale Eigenschaften (`toolbar`, `quietFooter`); alle anderen Editoren bleiben unverändert.
- Eigene Lesezeichen und die Lage des Buchs liegen pro Browser (localStorage), nicht serverseitig.
- Inventar, Briefe, Handouts, Galerie als eigene Register folgen; die Registerliste in `domain/journal.ts` ist darauf ausgelegt.

## Lokal starten

```text
pnpm run build
node --experimental-strip-types scripts/test-local.mjs --journal      # Port 8897, Speicher .local-test/journal
CVK_TEST_URL=http://127.0.0.1:8897 node --experimental-strip-types tests/journal-integration.mjs
```

Synthetische Konten wie in den übrigen lokalen Demos (`command-a@example.invalid` = Spieler A mit zwei eigenen Figuren).

## Ausdrücklich nicht getan

Kein Commit, kein Push, kein Merge, kein Deployment, keine Remote-Datenbank, keine Migration, keine Änderung echter Daten.
