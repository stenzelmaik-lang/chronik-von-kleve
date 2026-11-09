# 4c · Zieltabelle Navigation im Spielerbereich

Stand 09.11.2026 · Vorschlag zur Abnahme. **Umgebaut wird erst nach deiner Abnahme.** Grundlage: Bestandsaufnahme (Etappe 0, Abschnitt 3), `app/spielbereich/modules/navigation.ts`, `shell.tsx`, `workspace.tsx`, das abgenommene Glossar (`docs/design/GLOSSAR.md`) und deine Entscheidungen seit dem 08.11.

## 1. Das Problem heute

- **Es gibt kein sichtbares Hauptmenü.** `navigation.ts` kennt 22 Bereiche in Gruppen, gelesen wird davon nur Titel und Beschreibung des offenen Bereichs.
- **Acht Bereiche erreicht man nur über einen direkten Link** (`?bereich=…`): Weltkarte, Archiv, Händler, Neuigkeiten, Gefallen, Wirtschaft, Bilder & Dateien, Würfel.
- **Doppelte Wörter und Ziele:**
  - „Archiv“ (Handouts der SL) und „Persönliches Archiv“ (eigene Dateien) tragen dasselbe Wort.
  - „Bilder & Dateien“ und der Reiter „Persönliches Archiv“ im Notizbuch zeigen dieselbe Dateiliste.
  - „Chronik“ steht für drei Dinge: den Bereich, den Kopfknopf „Chronik erkunden“ (führt zu Orten) und den Kampagnennamen.
- **Würfel** gibt es als eigenen Bereich und am Spieltisch.

## 2. Vorschlag: ein Menü, vier Gruppen (plus Spielleitung)

**Form:** Am Rechner eine schmale Menüleiste links mit Symbol und Namen, Gruppen als kleine Überschriften. Auf dem Handy dieselbe Liste hinter einem Menüknopf oben links. Die Kopfleiste bleibt schlank.

| Gruppe | Bereich (neuer Name) | Kennung | Heute | Änderung |
|---|---|---|---|---|
| **Mein Abend** | Spielerzentrale | `dashboard` | „Übersicht“, nur über Logo/Kopfknopf | umbenannt (Glossar), im Menü |
| | Spieltisch | `sitzung` | „Sitzung“, nur über Knopf „Spieltisch betreten“ | umbenannt (Glossar), im Menü |
| | Termine | `termine` | im Code, nicht im Menü | im Menü |
| | Rückblicke | `rueckblick` | „Spielabend-Rückblick“, nur aus der Spielerzentrale | im Menü, zeigt die freigegebenen Rückblicke |
| **Mein Charakter** | Charakter | `charaktere` | „Charaktere“, über Kacheln | im Menü |
| | Inventar | `inventar` | über Kacheln und Reiterzeile | im Menü |
| | Gefallen | `gefallen` | nur ein Link | im Menü |
| | Wirtschaft | `wirtschaft` | nur direkter Link | im Menü |
| **Meine Seiten** | Notizbuch | `notizen` | Kachel; Reiter Notizbuch, Spielabendvorbereitung, Persönliches Archiv | im Menü, Reiter bleiben |
| | Postfach | (Fenster) | nur Kachel | im Menü, öffnet das Postfach |
| | Galerie | `galerie` | „Bilder & Dateien“ = Dateiliste | **neu belegt:** die Spielergalerie (siehe Entscheidung 3) |
| **Die Welt** | Chronik | `chronik` | im Menü der Spielwelt-Leiste | bleibt, nur noch Ereignisse der Domäne |
| | Orte | `schauplaetze` | „Schauplätze“, Kopfknopf „Chronik erkunden“ | umbenannt (Glossar); Weltkarte als Ansicht darin (Entscheidung 2) |
| | Persönlichkeiten | `nscs` | Spielwelt-Leiste | bleibt |
| | Überlieferungen | `archiv` | „Archiv“, nur direkter Link | umbenannt (Glossar), im Menü |
| | Codex Noctis | `regelwerk` | Spielwelt-Leiste | bleibt |
| | Neuigkeiten | `neuigkeiten` | nur direkter Link | im Menü |
| | Händler | `haendler` | nur direkter Link | im Menü |
| **Spielleitung** (nur SL) | Command Center | `/sl/command-center` | Kopfknopf | im Menü und Kopfknopf |
| | Materialvorbereitung | `vorbereitung` | nicht im Menü | im Menü |
| | Chronik-CMS | `cms` | Gruppe vorhanden, nicht sichtbar | im Menü |
| | Ortsverwaltung | `ortscms` | Kopfknopf „Ortsredaktion“ | im Menü (nur mit CMS-Zugang), ein Name: „Ortsverwaltung“ |

**Entfällt aus dem Menü:** Würfel (`wuerfel`), siehe Entscheidung 4. „Bilder & Dateien“ als Name verschwindet; die Dateien leben im Persönlichen Archiv.

**Kennungen bleiben gleich** (`?bereich=…`), damit bestehende Links, Lesezeichen und Verweise in Texten weiter funktionieren.

## 3. Kopfleiste danach

| Heute | Danach |
|---|---|
| Zur Spielerzentrale (außerhalb der Übersicht) | entfällt, das Menü hat die Spielerzentrale |
| Kampagnen | bleibt |
| Chronik erkunden (→ Orte) | entfällt, „Die Welt“ steht im Menü |
| Command Center (SL) | bleibt |
| Ortsredaktion (Redakteur) | entfällt, steht im Menü als Ortsverwaltung |
| Kontomenü: Profil & Einstellungen, Abmelden | bleibt |
| Spielwelt-Leiste (Orte, Chronik, Persönlichkeiten, Codex Noctis) | entfällt, ersetzt durch die Gruppe „Die Welt“ |
| Fußleiste „Meine Daten sichern“ | bleibt |

## 4. Deine Entscheidungen

1. **Gruppen und Namen** wie in Abschnitt 2? (Mein Abend · Mein Charakter · Meine Seiten · Die Welt · Spielleitung)
2. **Weltkarte:** als Kartenansicht im Bereich „Orte“ (Umschalter Liste/Karte) statt als eigener Menüpunkt? Mein Vorschlag: ja.
3. **Galerie:** „Bilder & Dateien“ geht im Persönlichen Archiv auf; der Name „Galerie“ wird frei für die geplante **Spielergalerie** (die freigegebenen Charakterbilder der Runde, gespeist aus „Porträt & Referenzen“). Bis die Spielergalerie gebaut ist, zeigt der Menüpunkt die freigegebenen Bilder der Runde an, sonst nichts. Mein Vorschlag: ja.
4. **Würfel:** eigener Bereich raus aus dem Menü, gewürfelt wird am Spieltisch? Mein Vorschlag: ja (der Bereich bleibt per Link erreichbar, bis du ihn ganz streichst).
5. **Bereiche im Aufbau** (Händler, Neuigkeiten, Wirtschaft): im Menü zeigen mit dem Hinweis „im Aufbau“, oder ausblenden, bis sie Inhalt haben? Mein Vorschlag: zeigen mit Hinweis, weil sie bleiben sollen.
6. **Gefallen und Wirtschaft unter „Mein Charakter“** statt unter „Meine Seiten“? Mein Vorschlag: ja, beides hängt am Charakter.

## 5. Was 4c nicht macht

- Keine neuen Funktionen in Händler, Neuigkeiten, Wirtschaft oder der Spielergalerie über die Anzeige hinaus.
- Keine Änderung am Spieltisch (das war 4a) und am Charakterbogen (4b).
- Keine Datenänderung, keine Migration. Nur Menü, Kopfleiste, Namen.
- Die Kommandozentrale der SL wird nicht umgebaut, sie bekommt nur ihren Menüeintrag.

## 6. Umfang nach Abnahme (Schätzung)

Ein Menübaustein (Rechner und Handy), Umbau von `shell.tsx` und `navigation.ts` (Gruppen und Namen sind dort schon angelegt), Umbenennungen in den betroffenen Seiten, Weltkarte als Ansicht in Orte, Tests für sichtbare Einträge je Rolle (Spieler, SL, CMS-Zugang). Eine Etappe, einzeln abnehmbar.
