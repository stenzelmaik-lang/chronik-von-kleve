# Notizbuch · Etappe 0 · Bestandsaufnahme

Stand 08.11.2026 · Claude Code (Opus 5.5) · nur lesend, kein Code geändert

| | |
|---|---|
| Branch | `claude/notizbuch-bestandsaufnahme` (lokal, nicht gepusht) |
| Basis | `claude/journal-release` @ `5f4bf8a` (Live-Quellstand laut Release-Bericht; `main` liegt bei `acbc62d`) |
| Gelesen | `docs/alpha-2/AJ-01-ABENTEUERJOURNAL-UEBERGABE.md`, `docs/releases/2026-11-07-abenteuerjournal.md`, `docs/PROJECT_STATUS.md` und der unten zitierte Code |
| Geändert | nur diese Datei |

Jede Aussage nennt die Fundstelle. Wo der Code etwas nicht belegt (Produktionsdaten, Bildschirmfotos), steht das ausdrücklich da.

---

## 1. Wege, auf denen Notizen entstehen und gelesen werden

### 1.0 Gemeinsame Ablage

Alle Notizwege außer dem Notizzettel landen in **einer Tabelle**: `records` mit `kind='notizen'`. Beim Einfügen legt ein Trigger eine zugehörige Zeile in `entities` an (Typ `NOTE`, `drizzle/0001_purple_blockbuster.sql:78`). `entities.legacy_record_id` verweist mit `ON DELETE cascade` auf `records.id` (`drizzle/0001_purple_blockbuster.sql:22`).

`kind='notizen'` ist kein reiner Notizbereich. Dieselbe Art nutzen auch Systemdatensätze, unterschieden nur über `body.context`:

| `body.context` | Zweck | Fundstelle |
|---|---|---|
| `live-table`, `live-table-signal`, `live-table-event` | Spielraum, Signale, Würfe, Proben | `server/live-commands.ts:34`, `server/live-checks.ts:95` |
| `sl-message` | Postfach-Briefe | `app/api/messages/route.ts:13` |
| `appointment-vote` | Terminantworten | `app/api/appointments/route.ts:37` |
| `table-material` | vorbereitetes Spielmaterial | `server/table-materials.ts:17` |
| `display-asset` | Darstellungs-Assets der SL, `visibility='sl'` | `server/display-assets.ts:11`, `domain/material-system.ts:54` |
| `character-companion` | Figurnotizen und Journal-Einträge | `app/api/character-companion/route.ts:268` |
| ohne `context` | Archivnotizen, Schnellnotiz, Ortsnotiz, Postfach-Kopie | siehe unten |

**Lesen über `GET /api/records?kind=notizen`** (`app/api/records/route.ts:82–133`):
- blendet `table-material`, `sl-message`, `appointment-vote` und die drei `live-table*`-Kontexte aus (Z. 105),
- liefert jede Zeile, die `canRead` erlaubt: eigene (`owner_id`), `visibility='group'` von allen, `visibility='sl'` nur für SL (`server/access.ts:121–132`),
- projiziert den Body über `projectEntity`/`playerContent` (`server/entities.ts:75–90`, `102–150`). Dabei fallen Schlüssel wie `secret`, `slText`, `gm_body` heraus (Regex in Z. 78),
- sortiert nach `updated_at DESC`.

**Schreiben über `POST /api/records`** (`app/api/records/route.ts:134–262`):
- Der Body wird mit `.passthrough()` geprüft (Z. 61). Unbekannte Felder bleiben also beim Speichern erhalten, **sofern der Client sie mitschickt**.
- Ein Update braucht `version`. Bei Abweichung kommt 409 (Z. 233–251).
- Eine Notiz mit `body.locationId` wird bei **jedem** Speichern erneut auf Sichtbarkeit des Orts geprüft. Ist der Ort nicht mehr freigegeben, kommt 403 (Z. 221–226).

**Löschen über `DELETE /api/records`** (`app/api/records/route.ts:271–312`): **hart**. `DELETE FROM records WHERE id=? AND version=?` (Z. 298). Die `entities`-Zeile fällt per Kaskade weg. Der Trigger `records_audit_delete` schreibt nur `legacy.deleted` mit leerem Payload nach `world_events` (`drizzle/0001_purple_blockbuster.sql:104`). Der Inhalt ist danach nicht wiederherstellbar. Der vorhandene Dialog sagt das zutreffend: „wird dauerhaft gelöscht“ (`app/spielbereich/workspace.tsx`, AlertDialog).

**Entwurfsspeicher `player-data-cache`** (`app/spielbereich/modules/player-data-cache.ts`): ein `Map` im Arbeitsspeicher des Tabs. Er wird bei Wechsel des Datenbereichs geleert (`activatePlayerDataScope`) und bei `pagehide` gelöscht (`workspace.tsx`, `clearPlayerDataScope`). **Ein Entwurf überlebt also weder Neuladen noch Schließen des Tabs.** Für Etappe 2 ist das wichtig, siehe Abschnitt 5.

### 1.1 Übersicht der sechs Wege

| Weg | Ablage | Wer liest | Bindung | Textformat | Löschen |
|---|---|---|---|---|---|
| Spielerbereich „Archiv & Vorbereitung“ → Reiter Notizen | `records/notizen`, `body.text`, `body.summary`, optional `body.date` | Besitzer; bei gewählter Sichtbarkeit „Ich & Spielleitung“ auch SL, bei „Gesamte Spielgruppe“ alle | Spieler | Klartext (Textarea) | hart |
| Sitzung → „Private Schnellnotiz“ | `records/notizen`, `visibility='private'`, `body.text` | Besitzer | Spieler | Klartext | (kein eigenes Löschen) |
| Ortsdossier → „Deine Erkenntnisse“ | `records/notizen`, `private`, `body.locationId/targetId/noteType` | Besitzer | Spieler + Ort | Klartext, max. 2.500 Zeichen (Client) | über Archivliste, hart |
| Postfach → „In meine Notizen“ | `records/notizen`, `private`, `body.sourceMessageId`, `source:'Postfach'`, `date`, Anhänge | Besitzer | Spieler + Brief | Klartext (`plain(body)`) | über Archivliste, hart |
| Journal / Charakterverwaltung (`/api/character-companion`) | `records/notizen`, `context:'character-companion'`, `characterId`, optional `journalKind`, `playDate` | Besitzer; je nach Sichtbarkeit SL/Gruppe | Spieler + Figur | **HTML** (Rich Text, max. 30.000 Zeichen) | **weich** (`archived:true`) |
| Notizzettel auf der Bühne | **nicht** in eigener Zeile, sondern als Objekt in `body.stage.objects[]` des Spielraum-Datensatzes | Besitzer **und jede SL**; bei Freigabe die Gruppe | Spieler + Sitzung | Klartext, max. 3.000 Zeichen | im Spielraum |

### 1.2 Einzelbelege

**a) Spielerbereich, „Archiv & Vorbereitung“, Reiter Notizen**
- Eintrag `notizen` heißt „Archiv & Vorbereitung“ (`app/spielbereich/modules/navigation.ts:140–146`).
- Daten: `useWorkspaceData('notizen')` → `GET /api/records?kind=notizen` (`app/spielbereich/modules/use-workspace-data.ts:29–40`). Alle Zeilen gehen ungefiltert als `notes` an `PlayerArchive` (`workspace.tsx:457`).
- `PlayerArchive` startet **immer auf dem Reiter „Vorbereitung“**: `useState<Tab>('vorbereitung')` (`player-archive.tsx:17`). Das erklärt den leeren Einstieg auf dem Screenshot vom 08.11.
- Die Liste zeigt Titel und `body.summary`, sonst „Notiz öffnen“ (`player-archive.tsx:26`). Die Zahl am Reiter ist `notes.length` (Z. 28).
- Öffnen und Anlegen gehen in den allgemeinen `RecordEditor` (`record-editor.tsx`): Titel ist Pflicht (`required`), Felder „Datum (optional)“ = `body.date`, „Kurzbeschreibung“ = `body.summary`, „Lesetext“ = `body.text` als **Textarea**. HTML aus Journal-Einträgen erscheint dort roh als Markup.
- **Sichtbarkeit ist frei wählbar**: „Nur ich“, „Ich & Spielleitung“, „Gesamte Spielgruppe“ (`record-editor.tsx:119–133`, `shared.tsx:10–14`). Notizen sind also heute **nicht zwingend privat**.
- Der Editor arbeitet mit dem projizierten Body und setzt Felder per Spread (`patchBody`, Z. 43–45). Unbekannte Felder aus der Projektion bleiben erhalten. Felder, die `playerContent` vorher entfernt hat (z. B. ein Schlüssel `secret`), gehen beim Speichern verloren.

**b) Seite „Sitzung“, Werkzeugschublade „Private Schnellnotiz“**
- `SceneQuickNote` speichert per `POST /api/records` mit `visibility:'private'`, `body:{text}` (`scene-quick-note.tsx:16`). Entwurf im `player-data-cache` unter `/ui/private-scene-note-draft` (Z. 8–11).
- Eingebunden nur in `PlayerSession` (`command-player-session.tsx:47–52`).
- **Für Spieler nicht erreichbar.** Bereich `sitzung` rendert `CommandCenter` (`workspace.tsx:461`), und `CommandCenter` rendert für Spieler `LiveSession` (`command-center.tsx:9`), nicht `PlayerSession`. `PlayerSession` kommt nur noch in der SL-Vorschau „Veröffentlichte Gruppenansicht“ vor (`command-workspace.tsx:174`), und dort mit `preview`. Die Schublade steht hinter `!preview` (`command-player-session.tsx:47`). Die Schnellnotiz ist damit toter Code. Der Ersatz in Etappe 2 nimmt Spielern nichts weg.

**c) Ortsdossier, Feld „Deine Notizen“**
- Die Beschriftung im Code lautet „Deine Erkenntnisse“ mit Kennzeichnung „privat“ und Auswahl „Art der Notiz“ (Notiz, Verdacht, Erkenntnis, Erinnerung, Theorie) (`world-experience.tsx:632`).
- Speichern: Titel `Notiz zu <Ort>`, `visibility:'private'`, Body `{text, summary:'Mit <Ort> verknüpft', locationId, targetId, noteType, pinned:false}` (`world-experience.tsx:358–377`).
- Lesen: dieselbe Route `GET /api/records?kind=notizen`, gefiltert auf `body.locationId === location.id`, höchstens drei angezeigt (`world-experience.tsx:242`, `632`).

**d) Postfach, Aktion „In meine Notizen“**
- Knopf in `message-center.tsx:111`, Aufruf `PATCH /api/messages {action:'to-notes'}` (Z. 78).
- Server: `copyToNotes` legt je Brief und Person höchstens eine Notiz an (`app/api/messages/route.ts:122–134`). Body `{text: plain(...), summary:'Brief von … · Datum', date, source:'Postfach', sourceMessageId, attachmentIds, attachments}`. Kein `gm_body`, keine fremden Kopien.
- Anhänge zeigt der `RecordEditor` im Abschnitt „Anhänge aus dem Postfach“ (`record-editor.tsx:160–165`).

**e) Journal (`/api/character-companion`, `note.*`)**
- `note.create` schreibt `{characterId, text, context:'character-companion', journalKind?, playDate?, archived:false, testData}` (`app/api/character-companion/route.ts:244–281`). Nur der Besitzer der Figur (Z. 251).
- `note.update` lädt den **gespeicherten** Body und überschreibt nur `text`, `journalKind`, `playDate`, `archived`. Alle anderen Felder bleiben (Z. 283–317).
- `note.archive` setzt `archived:true`, `archivedAt`. Das ist eine **weiche** Löschung (Z. 319–336).
- Sichtbarkeit wählbar, Standard `private` (Z. 20, 55).
- Text ist Rich-Text-HTML (`isRichTextWithinLimit(data.text,30000)`, Z. 194).
- Denselben Weg nutzt auch die **Charakterverwaltung** („Persönliches Dokument“, `character-detail.tsx:339–356`, `768`). Das ist ein siebter Schreibort, der im Auftrag nicht aufgeführt ist.
- Lesen in der Figurprojektion: `projectNotes` filtert `canRead` und blendet `archived` aus (`server/character-projection.ts:133–158`). Mit `?journal=1` kommen eigene ungebundene private Notizen hinzu (`projectUnboundNotes`, Z. 165–177).

**f) Notizzettel auf der Spieltisch-Bühne**
- Objektart `note` mit `visibility: 'private'|'group'`, `ownerId`, `content` (max. 3.000) (`domain/live-stage.ts:10`). Höchstens 30 eigene je Sitzung, neu immer `private` (Z. 203–205).
- Abgelegt im Spielraum-Datensatz unter `body.stage` (`server/live-stage.ts:179`, `184`). Gebunden an die Sitzung, nicht an `records/notizen`.
- Sichtbarkeit: `stageVisible` gibt **jeder SL alle Zettel**, Spielern eigene und freigegebene (`domain/live-stage.ts:97`).
- Hinweistext im Panel: „Neue Zettel sind privat: du & SL.“, Listenkennung „Privat · SL-Einsicht“ (`stage.tsx:242`). Das Wort „Privat“ meint hier also „du und SL“. Im Notizbuch heißt „privat“ dagegen „nur du“. Die Beschriftung in Etappe 2 muss diesen Unterschied auflösen.

---

## 2. Offene Frage: Was erscheint heute in der Notizenliste des Spielerbereichs?

Die Liste ist die ungefilterte Antwort von `GET /api/records?kind=notizen` aus Sicht eines Spielers (Abschnitt 1.0). Daraus folgt am Code:

| Herkunft | In der Liste? | Beleg |
|---|---|---|
| Journal-Einträge und Charakterverwaltungs-Notizen (`character-companion`) | **ja**, auch **archivierte** (die Route kennt kein `archived`-Filter) | `records/route.ts:104–128` ohne Filter auf `archived` oder `characterId` |
| Private Schnellnotizen | ja (für Spieler heute aber nicht mehr anlegbar, siehe 1.2 b) | ohne `context` |
| Ortsnotizen | ja | ohne `context` |
| Postfach-Kopien | ja | ohne `context` |
| Fremde Notizen mit `visibility='group'` | **ja**, mit Titel und Text, nur lesend | `canRead` → `visibility==='group'` |
| Systemdatensätze (Spielraum, Briefe, Termine, Material) | nein | Filter Z. 105 |
| Eigene Darstellungs-Assets (nur bei SL-Konten, `display-asset`) | **ja**, im Spielerbereich der SL | Kontext fehlt im Filter Z. 105; Besitzer liest eigene `sl`-Zeile |

**Die 11 Notizen des Besitzers** kann ich nicht am Code nachzählen. Dafür bräuchte ich Produktionsdaten, und Abfragen auf Produktion sind ausgeschlossen. Sicher ist nur: Die Zahl am Reiter ist die Länge dieser Liste, also alle Herkünfte oben zusammen, archivierte Figurnotizen und fremde Gruppennotizen eingeschlossen.

---

## 3. Menüinventar

### 3.1 Spielerbereich (`app/spielbereich`)

**Befund vorab:** Die Liste `sections` in `navigation.ts` ist **heute kein sichtbares Menü**. Die Felder `group`, `mainNav` und die Liste `navGroups` werden nirgends gelesen (Suche nach `mainNav|navGroups` ausserhalb von `navigation.ts`: kein Treffer). `sections` wird nur für Titel und Beschreibung des aktiven Bereichs (`workspace.tsx:139`) und für die Erkennung von SPIELWELT-Bereichen (`shell.tsx:15`) genutzt.

Zählung der Liste `sections` (`navigation.ts:35–184`), 22 Einträge:

| Gruppe | Einträge (Kennung · Beschriftung) | Anzahl |
|---|---|---|
| SPIELTISCH | dashboard · Übersicht, charaktere · Charaktere*, inventar · Inventar*, sitzung · Sitzung*, wuerfel · Würfel* | 5 |
| SPIELWELT | chronik · Chronik, schauplaetze · Schauplätze, weltkarte · Weltkarte, nscs · Persönlichkeiten, archiv · **Archiv**, regelwerk · Codex Noctis, haendler · Händler, neuigkeiten · Neuigkeiten | 8 |
| DEINE SPUREN | termine · Termine, notizen · **Archiv & Vorbereitung**, gefallen · Gefallen, wirtschaft · Wirtschaft, galerie · **Bilder & Dateien** | 5 |
| SPIELLEITUNG | cms · Chronik-CMS (nur SL), ortscms · Ortsverwaltung (nur CMS-Zugang) | 2 |
| ohne Gruppe | vorbereitung · Materialvorbereitung (nur SL), rueckblick · Spielabend-Rückblick* | 2 |

\* `mainNav:false`. Für Spieler bleiben 18 Einträge in drei Gruppen, dazu 2 für SL/CMS und 2 ohne Gruppe. Das bestätigt die Zahl im Auftrag (Etappe 0 nennt drei Gruppen, 4c vier; die vierte, SPIELLEITUNG, ist nur für SL/CMS).

**Was ein Spieler tatsächlich anklicken kann:**

| Ort | Ziele | Fundstelle |
|---|---|---|
| Kopfleiste | Zur Spielerzentrale (nur außerhalb der Übersicht), Kampagnen (`/kampagne`), Chronik erkunden (→ schauplaetze), Command Center (SL), Ortsredaktion (Redakteur), Kontomenü: Profil & Einstellungen, Abmelden | `shell.tsx:20–28` |
| Spielwelt-Leiste (nur in SPIELWELT-Bereichen) | Orte, Chronik, Persönlichkeiten, Codex Noctis | `shell.tsx:30` |
| Übersicht | Spieltisch betreten (→ sitzung), Kalender/Abstimmung (→ termine), Entwicklung ansehen (→ charaktere), Zusammenfassung lesen (→ rueckblick), Kacheln „Meine Vorbereitung“: Charakter, Inventar, Postfach, **Archiv & Vorbereitung** | `dashboard.tsx:170–191` |
| Fußleiste | Meine Daten sichern (`/api/export`) | `shell.tsx:32` |

**Nur über `?bereich=` oder Links in Inhalten erreichbar:** weltkarte, archiv, haendler, neuigkeiten, gefallen (ein Link), wirtschaft, galerie, wuerfel. Zählung der `bereich=`/`navigate(...)`-Ziele im Code: sitzung 12+1, charaktere 6+2, schauplaetze 5+1, inventar 3+1, termine 3, je 1 für vorbereitung, rueckblick, nscs, notizen, gefallen. Für archiv, haendler, neuigkeiten, wirtschaft, galerie, weltkarte, wuerfel fand ich keinen Link.

**Doppelte Begriffe und Ziele:**
- **„Archiv“** (Kennung `archiv`, `kind='archiv'` = Handouts der SL) gegen **„Archiv & Vorbereitung“** (Kennung `notizen`, eigene Notizen + Material + Dateien). Zwei verschiedene Ziele mit demselben Wort.
- **Reiter „Meine Dateien“** in `notizen` (`player-archive.tsx:13`, `MediaLibrary` mit eigenem `/api/files`) gegen **Eintrag „Bilder & Dateien“** (`galerie`, ebenfalls `MediaLibrary` mit `/api/files`, `workspace.tsx:452–453`). Dieselbe Komponente, dieselbe Quelle, zwei Orte.
- **„Chronik“**: Bereich `chronik` (Ereignisse der Domäne) gegen „Chronik erkunden“ in der Kopfleiste (führt zu Schauplätzen) gegen „Chronik von Kleve“ (Kampagnenname). Das Journal kannte zusätzlich ein Register „Chronik“.
- **„Meine Notizen“** als Linktext in `command-player-session.tsx:53` und im Postfach-Hinweis (`message-center.tsx:78`) gegen Eintragsname „Archiv & Vorbereitung“.
- **„Persönliches Archiv & Vorbereitung“** als Seitentitel im Reiter Vorbereitung (`table-material-library.tsx:49`).

### 3.2 Spieltisch, linke Leiste „Spieltisch-Werkzeuge“ (`stage.tsx:205`)

| Ziel (Panel) | SL | Spieler |
|---|---|---|
| Szenen des Abends (`scenes`) | ja | – |
| Regie (privat) (`regie`) | ja | – |
| Dokumente (`documents`) | ja | ja |
| Mein Zustand (`vitals`) | – | ja |
| Eingesteckt (`pocket`) | – | ja |
| Gemeinsam zeichnen (Umschalter, kein Panel) | ja | ja |
| Notizzettel (`sticky`) | ja | ja |
| Bedienhilfe (`help`) | ja | ja |

Beschriftung nur als Tooltip (`Icon`, `stage.tsx:49`), Symbole aus `lucide-react`.

**Weitere Einstiege auf der Bühne:** „Kontext öffnen“ (`context`, Z. 219), HUD „Spielaktionen“ mit „Würfel öffnen“ (`dice`), „Weltkarte öffnen“ (`map`), Rundenanzeige „Runde · n Figuren“ (öffnet `vitals`) (Z. 222, `vitals.tsx:127`). Panel `place` nur aus der Weltkarte, `npcs` hat keinen Einstieg in `stage.tsx`.

### 3.3 Spielerleiste oben mit Ingame-Menü (`participants.tsx`, `participant-content.tsx`)

Je Teilnehmer: Profil, Charakterbogen, Inventar, Nachrichten (`participants.tsx:12`). Beim eigenen Namen zusätzlich „Eigene Werte steuern“ (`OwnValues`). Inhalte: `participant-content.tsx:22–63` (Nachrichten = eingebettetes Postfach, Bogen = `CharacterReadOnly`).

**Ziele, die an mehreren Stellen des Tischs liegen:**
- **Zustand / Vitalwerte:** Leiste links „Mein Zustand“, HUD „Runde · n Figuren“ und „Eigene Werte steuern“ in der Spielerleiste.
- **Inventar / Besitz:** Spielerleiste „Inventar“ (Figurinventar) gegen Leiste links „Eingesteckt“ (eingestecktes Tischmaterial). Das sind verschiedene Dinge mit ähnlicher Bedeutung und beide Male mit Rucksack-Symbol (`Backpack`).
- **Charakterbogen:** Spielerleiste „Charakterbogen“ und auf diesem Stand zusätzlich der Bogen im Journal (`stage.tsx:252`, entfällt mit Etappe 1).
- **Nachrichten:** Spielerleiste „Nachrichten“ und das Postfach des Spielerbereichs (gleiche Komponente).

---

## 4. Design-Tokens: benutzt gegen definiert

Zählung mit einem Skript über alle versionierten Dateien in `app/` und `components/` (65 CSS-Dateien, 334 TS/TSX-Dateien). 3- und 4-stellige Hex-Werte sind auf 6 Stellen normalisiert, ein Alphakanal ist abgeschnitten. Der Bereich ist damit weiter gefasst als im Auftrag („Spielbereich, Profil und globals.css“). Deshalb weichen die Zahlen ab.

### 4.1 Was `app/globals.css` definiert

- 72 Variablen. Das sind fast nur shadcn-Standards: `--background #101418`, `--foreground #ece5d8`, `--secondary/--muted/--accent #1a2026`, `--border #30383d`, `--radius 0.625rem` (Z. 41–72) und die `--color-*`/`--radius-*`-Ableitungen (Z. 76–110).
- **Unverändert aus der Vorlage** wirken `--destructive #e7000b`, `--ring #a1a1a1`, `--chart-1…5` (`#f54900 #009689 #104e64 #ffb900 #fe9a00`). Das sind Werte der Tailwind-Farbskala.
- Ein zweiter Block (Z. 118 ff.) setzt helle/dunkle Alternativen mit `--card: #ece5d8` bei `--card-foreground: #ededed`. Das ergibt hellen Text auf hellem Grund. Ob dieser Block greift, habe ich nicht im Browser geprüft.
- Schrift: `--font-sans: Arial, Helvetica, sans-serif` (Z. 111). Kein `@font-face`, kein Schrift-Import in `app/layout.tsx` (nur `./globals.css`). Im Repo fand ich kein `@font-face`.
- Keine `--cp-*`-Tokens.

### 4.2 Was tatsächlich benutzt wird

| Merkmal | Zählung |
|---|---|
| Hex-Farben in CSS | **4.759 Vorkommen, 2.149 verschiedene Werte**, in allen 65 Dateien |
| Hex-Farben in TS/TSX | 47 Vorkommen, 31 verschiedene, 10 Dateien |
| `rgb()`/`rgba()` in CSS | 637 Vorkommen, 421 verschiedene |
| Häufigste Hex-Werte | `#d6b36f` 218, `#000000` 208, `#c9a266` 97, `#c5a46a` 95, `#cda66b` 89, `#ffffff` 89, `#eee8dc` 65, `#ece5d8` 47, `#34393b` 46, `#d2b47b` 42 |
| Gold gesamt (CSS + TS/TSX) | `#d6b36f` **223**, `#cda66b` **89**. Dazu mindestens sechs nahe Goldtöne (`#c9a266`, `#c5a46a`, `#d2b47b`, `#b9985b`, `#e4c589`, `#d3b47c`) |
| `var(--…)`-Aufrufe | 816 Aufrufe auf 137 Variablen. Die meisten sind modul-eigene Namensräume (`--line` 106, `--gold` 56, `--muted` 48, `--serif` 41, `--cc-brass` 36, `--studio-*`, `--world-*`, `--hub-*`, `--dossier-*`). Insgesamt werden 171 Variablen definiert, davon 72 in `globals.css` |
| Benutzt, aber nirgends definiert | `--font-cormorant` 4× in 2 Dateien (`material-library.module.css`, `material/workbench.module.css`), `--font-geist-sans` 1× (`profil/account.module.css`), `--font-ui` 7× (`material/ultio-audio.module.css`). Die Fallbacks greifen (Georgia bzw. Arial) |
| Schriftfamilien | `Georgia` 331×, `Arial` 76×, `Helvetica` 12×. In `font:`-Kurzschreibweisen: Georgia 299, sonstige Serif 135, `inherit` 49, Monospace 21. `font-family`-Deklarationen: 45, davon 24× `Georgia,serif` |
| Schriftgrößen | 1.380 Deklarationen, **105 verschiedene Werte**. Am häufigsten 12px 340, 11px 190, 13px 181, 10px 139, 14px 134, 9px 57, 8px 14 |
| `border-radius` | 849 Deklarationen, **58 verschiedene Werte**. 5px 141, 6px 120, 8px 106, 4px 100, 50% 98, 7px 41, 999px 40 (Pill), 12px 34. Das Token `--radius` wird 8× benutzt |
| Abstände | `gap`: 1.671 Deklarationen, 121 Werte (8px 261, 6px 194, 12px 169, 10px 156). `padding`: 1.460 Deklarationen, 467 verschiedene Werte. Es gibt keine Abstandsskala |
| Dekor | Verläufe 368×, `box-shadow` 213×, `backdrop-filter` 27×, `blur(` 53× |
| Symbole | 124 Dateien importieren `lucide-react` |

### 4.3 Abgleich mit dem Befund aus Etappe 3

- **Journal-Braun bestätigt:** `#6e4d33` 10×, `#1a0d07` 6× (`journal/journal.module.css`), `#3b2408` 6× (`journal/journal-controls.module.css`). Alles liegt in Dateien, die Etappe 1 entfernt.
- **Notizzettel-Gelb:** Der Code setzt einen Verlauf `#efe3b8 → #e6d8a9 → #e2d19d` (`stage.module.css:12`). `#EADDAF` aus dem Screenshot steht so nicht im Code. Es ist ein gerenderter Mischwert.
- **Flächenfarben:** Die Screenshot-Werte `#15252A`, `#0E1A28`, `#0D1420` kommen als Literal nicht vor. Sie entstehen vermutlich aus Halbtransparenz über dem Hintergrund (Annahme, nicht gemessen). `#10191d` steht 24× in 9 Dateien. Marineblau steckt u. a. in `profil/account.module.css` (`#09131f`, `#183144`). Eine Zählung „Tealgrau gegen Marineblau“ je Fläche braucht Messung im Browser. Das gehört in Etappe 3.

---

## 5. Folgerungen für Etappe 2 (Abweichungen von der Vorgabe, zur Entscheidung)

Die Vorgabe lautet: Seiten bleiben `records` mit `kind='notizen'` und `visibility='private'`, keine Migration, keine Schemaänderung. **Das trägt.** Die Ablage ist vorhanden, und Titel, `date`, `text` und frei erweiterbare Body-Felder (passthrough) genügen, auch für Schlagwörter (z. B. `body.tags`). Diese Punkte verlangen aber eine Entscheidung oder ausdrückliche Behandlung:

1. **SL-Kampagnenexport enthält private Spielernotizen.** `GET /api/export?scope=campaign` (Knopf „Kampagne sichern“, `sl-workspace-shell.tsx:21`) exportiert alle `records` der Kampagne. Ausgenommen sind nur fremde Briefe und fremdes Material (`server/campaign-export.ts:25`). Private Notizen der Spieler sind also heute im SL-Export lesbar. Das widerspricht dem Grundsatz „die SL nie, auch nicht über Kampagnenexport“. Abhilfe heißt Änderung an Rechten bzw. Exportumfang, und die schließt der Auftrag eigentlich aus. **Der Besitzer muss entscheiden, ob Etappe 2 den Export um fremde private `notizen` kürzt.** Vorschlag: ja, analog zu `table-material`, mit Test. Ohne Entscheidung bleibt der Export unverändert, und die Übergabe nennt das als offenen Befund.
2. **Notizen sind heute nicht nur privat.** Sichtbarkeit „Ich & Spielleitung“ bzw. „Gesamte Spielgruppe“ ist im `RecordEditor` und in der Charakterverwaltung wählbar. Vorschlag: Das Notizbuch zeigt alle **eigenen** Notizen mit `owner_id = ich`. Eine nicht private Seite trägt sichtbar „SL liest mit“ bzw. „Gruppe liest mit“. Neue Seiten sind immer privat, und das Notizbuch ändert die Sichtbarkeit nicht. Fremde Gruppennotizen erscheinen nicht.
3. **Systemkontexte ausfiltern.** Neben den sechs heute gefilterten Kontexten gehört auch `display-asset` heraus, sonst sehen SL-Konten ihre Darstellungs-Assets als Seiten.
4. **Archivierte Figurnotizen** (`archived:true`) erscheinen heute in der Liste. Vorschlag: im Notizbuch ausblenden, wie die Figurprojektion es tut.
5. **Zwei Schreibwege für dieselbe Zeile.** Figurnotizen (`context:'character-companion'`) bearbeitet heute `/api/character-companion`. Dort bleibt der gespeicherte Body erhalten, gelöscht wird weich. Einfache Notizen bearbeitet `/api/records`, dort entscheidet der Client-Body, gelöscht wird hart. Das Notizbuch muss pro Seite den passenden Weg wählen oder `/api/records` sicher machen. Sonst gehen beim Speichern über die Projektion Felder verloren (siehe 1.2 a, `playerContent`). Pflichttest „unbekannte Felder bleiben erhalten“ für beide Wege.
6. **Löschen:** Einfache Notizen werden hart gelöscht, Figurnotizen weich (archiviert). Der Dialog muss das je Seite ehrlich sagen.
7. **HTML erhalten:** Figurnotizen sind HTML, alle anderen Klartext. Der heutige `RecordEditor` zeigt HTML als Rohtext und würde es beim Bearbeiten als Klartext zurückschreiben. Das Notizbuch muss HTML mit `RichTextView` lesen und mit dem vorhandenen `RichTextEditor` bearbeiten. Klartext darf nicht ungewollt zu HTML werden.
8. **Ortsnotizen** prüfen bei jedem Speichern die Freigabe des Orts. Ist der Ort nicht mehr sichtbar, scheitert das Speichern mit 403. Das Notizbuch muss den Entwurf dann behalten und den Grund nüchtern nennen.
9. **Datum:** Vorhanden sind `body.date` (Archiv, Postfach) und `body.playDate` (Journal). Vorschlag: Das Seitendatum ist `playDate`, sonst `date`, sonst `created_at` als Anzeige. Geschrieben wird `date`. Ein vorhandenes `playDate` bleibt unangetastet.
10. **Titelpflicht:** `POST /api/records` verlangt einen Titel (`min(1)`, Z. 66). Für „Titel optional, sonst erste Zeile“ muss der Client die erste Zeile als Titel setzen. Das braucht keine Serveränderung.
11. **Entwürfe:** `player-data-cache` lebt nur im Arbeitsspeicher und wird bei `pagehide` geleert. „Beim Schließen speichern“ und „Entwurf bleibt bei Netzfehler“ gehen damit nur innerhalb der offenen Seite. Für Entwürfe über Neuladen hinweg bräuchte es `localStorage`, und das wäre eine Abweichung von der Vorgabe. Vorschlag: Vorgabe einhalten, beim Schließen per `keepalive`-Anfrage speichern, Grenze in der Übergabe nennen.
12. **Spielerbereich:** Der Eintrag `notizen` öffnet heute auf „Vorbereitung“ (`player-archive.tsx:17`). Der Umbau auf „Notizbuch“ als ersten Reiter betrifft nur diese Komponente, Beschriftung und Kachel (`dashboard.tsx:191`). Die Kennung `notizen` bleibt.

---

## 6. Prüfungen

| Prüfung | Ergebnis |
|---|---|
| `git switch -c claude/notizbuch-bestandsaufnahme claude/journal-release` | Basis `5f4bf8a` bestätigt, Arbeitsbaum sauber |
| `git diff --stat 5e6ae31 claude/journal-release` | 26 Dateien, 2.265 Einfügungen, 15 Löschungen. Entspricht der Liste in Etappe 1 |
| Tags `archiv/*` | keine vorhanden; `f57d990` und `5e6ae31` existieren als Commits |
| Tokenzählung | Skript außerhalb des Repos (Scratchpad), Ergebnis in Abschnitt 4 |
| Testdateien | 76 Dateien `tests/*.test.mjs`, davon 49 in `package.json` referenziert (Zählung per `ls` bzw. `grep`) |
| `pnpm run typecheck`, `lint`, `test`, voller Testlauf | **nicht ausgeführt.** Etappe 0 ändert keinen Code. In dieser Umgebung liegen `node`/`pnpm` nicht im `PATH`, und im Worktree sind keine Abhängigkeiten installiert. Der Basislauf folgt zu Beginn von Etappe 1 |

## 7. Prüfgrenzen

- Keine Produktionsdaten gelesen. Die 11 Notizen des Besitzers sind nicht nachgezählt.
- Keine Browserprüfung. Aussagen zur Sichtbarkeit von Menüs stammen aus dem Code, nicht aus der laufenden App.
- Die Farbwerte der Screenshots konnte ich nicht nachmessen (keine Screenshots im Repo). Deshalb Zählung im Quelltext, keine gerenderten Farben.
- Die Erreichbarkeit „nur per URL“ (3.1) beruht auf Suche nach Links und `navigate(...)`. Dynamisch zusammengesetzte Links können fehlen.

## 8. Ausdrücklich nicht getan

Kein Code geändert. Kein Push, kein Tag, kein Deployment, keine Datenbankabfrage auf Produktion, keine Datenänderung. Das V20-Referenzblatt (Drive-Ordner des Besitzers, „ohne Werte“) habe ich nicht geöffnet. Es wird erst für Etappe 4b gebraucht und kommt nicht ins Repo.
