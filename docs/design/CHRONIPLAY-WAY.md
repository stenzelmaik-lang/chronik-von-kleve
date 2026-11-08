# ChroniPlay-Way

Stand 08.11.2026 · Etappe 3 · **abgenommen am 08.11.2026** (Schriftpaar Spectral + IBM Plex Sans, Flächenfamilie Tealgrau). Die Anwendung folgt in Etappe 4.

Dieses Dokument legt die Bild- und Sprach-DNA von ChroniPlay fest. Es gilt erst nach Abnahme durch den Besitzer an der Musterseite (`prototypes/designgrundlage/musterseite.html`). Etappe 4 wendet es Schritt für Schritt an.

## Leitidee: zwei Ebenen, die sich nicht mischen

**Tischebene** – warm und stofflich. Die Tischplatte und alles, was darauf liegt: Papier, Handouts, Notizzettel, Notizbuch, Würfel, Würfelschale. Diese Dinge sehen aus wie Dinge. Sie dürfen Schatten werfen, Papier hat Linien, Holz und Filz haben Farbe.

**Rahmenebene** – dunkel, flach und ruhig. Leisten, Menüs, Panels, Schubladen, die Seiten des Spielerbereichs. Gold-Haarlinien, Eckmarken, Serif-Titel. Leder, Holz und Messing kommen hier nicht vor.

Inhaltlich trägt die **Sprache der Akte**, die das Projekt schon spricht: Fallakte, Dossier, NPC-Akten, Spuren, Codex Noctis. Daraus folgen Registerreiter, Karteikarte, Aktenzeichen und Eckmarken statt Buchrücken und Lederband.

## Bild-DNA: prüfbare Regeln

1. **Farbe.** Eine Grundfläche (`--cp-bg`), ein Textton (`--cp-text`), Gold als Akzent (`--cp-gold`). Blutrot (`--cp-blood`) nur für Gefahr, Clan und Warnung, als Text in `--cp-blood-text`. Höchstens zwei Akzente je Ansicht.
   - Die Flächen kommen aus **einer** Familie: Tealgrau (`--cp-surface-*`) oder Marineblau (`--cp-navy-surface-*`). Der Besitzer wählt an der Probe, die andere Familie wird danach entfernt.
   - Komponenten nutzen nur `--cp-*`-Tokens, keine Hex-Werte.
2. **Form.** Kantig. Radius `--cp-radius` (2 px) statt gerundeter Karten. Eckmarken (`--cp-corner`, 10 px, Gold) sind das Erkennungszeichen. Linien 1 px, die Doppellinie nur an Hauptflächen.
3. **Ornament** nur an festgelegten Stellen: Rahmen um Porträt und Hauptkarte, Gold-Haarlinie unter Abschnittstiteln. Nie hinter Text, nie als Hintergrundmuster.
4. **Icons.** Ein eigener Satz, höchstens etwa 30 Stück: 24er-Raster, Strich `--cp-icon-stroke` (1,5), eckige Enden (`square`) und Ecken (`miter`), keine Füllung. Gilt für Menüs, Reiter und Leerzustände. Funktionale Kleinsymbole (Schließen, Pfeile) dürfen aus `lucide-react` bleiben. Zwölf Proben stehen auf der Musterseite.
5. **Schrift.** Höchstens zwei Familien, selbst gehostet, freie Lizenz mit Nachweis im Repo (`prototypes/designgrundlage/fonts/HERKUNFT.md`).
   - Eine Serif mit Charakter für Titel (`--cp-font-title`), eine ruhige Schrift für Fließtext und Notizen (`--cp-font-text`).
   - Drei Paare zur Wahl: Spectral + IBM Plex Sans, Fraunces + Source Sans 3, Cormorant Garamond + Alegreya Sans.
   - Bis zur Wahl stehen die Tokens auf Georgia und Arial, wie heute.
6. **Leerraum.** Ein Hauptelement je Ansicht. Abschnitte trennt Abstand (`--cp-space-*`), nicht Kasten. Kasten im Kasten ist ein Fehler.
7. **Bewegung** nur, wo sie Information trägt, etwa beim Würfelwurf oder einer neuen Nachricht. Keine Daueranimation. `prefers-reduced-motion` gilt. Dauer `--cp-duration`, Kurve `--cp-ease`.
8. **Bilder** nur mit geklärter Herkunft: eigene Zeichnungen, Assets des Besitzers, die laut Besitzer freigegebenen World-of-Darkness-Symbole (ein Rechtenachweis liegt im Repo nicht vor). Keine neuen KI-generierten Bilder als Dekor, über Ausnahmen entscheidet der Besitzer.

### Kontrast (gemessen, WCAG)

Auf `--cp-bg` und allen drei Flächenstufen beider Familien erreichen `--cp-text` (≥ 11,2:1), `--cp-text-muted` (≥ 5,9:1), `--cp-gold` (≥ 7,0:1) und `--cp-blood-text` (≥ 5,9:1) mindestens 4,5:1. **`--cp-text-faint` nur auf Fläche 1 und 2** (≥ 5,1:1). Auf Fläche 3 liegt es mit 4,52:1 an der Grenze.

Auf Papier: `--cp-ink` 12,2:1, `--cp-ink-soft` 5,3:1, `--cp-ink-gold` 5,5:1, `--cp-blood` 6,4:1. `--cp-blood` ist auf dunklem Grund **keine** Textfarbe (2,5:1).

## Verbotsliste (ein Verstoß heißt Nacharbeit)

- Verläufe oder Leuchten als Dekor, Milchglas- und Blur-Karten, gestapelte Schlagschatten. Erlaubt sind Materialdarstellung auf der Tischebene (Papierlinien, Schatten eines Objekts).
- Emoji als Symbole.
- Raster aus gleichen Karten nach dem Muster Icon, Titel, Text (heute: Kacheln unter „Meine Vorbereitung“).
- Pill-Badges überall, zentrierter Kopfbereich mit zwei Knöpfen.
- Bibliotheks-Komponenten in Standardoptik.
- Floskeln („Tauche ein“, „Entdecke“, „Erlebe“), Ausrufezeichen, Superlative, Platzhaltertexte.

## Sprach-DNA

- Du-Ansprache, kurze Sätze, ein Gedanke je Satz. Vorbild sind die vorhandenen Texte: „Die Nacht hinterlässt Spuren.“, „Schulden und Versprechen der Nacht.“, „Jeder Ort bewahrt seine Geschichte.“
- Nachtmotiv sparsam, höchstens ein Bild je Ansicht. Fachbegriffe der Runde (Domäne, Kainskinder) nur, wo sie schon gelten.
- Werkzeug- und Fehlertexte sind nüchtern: Was ist passiert, was bleibt erhalten, was kann der Spieler tun. Kein Rollenspielton in Fehlermeldungen. Beispiel: „Nicht gespeichert. Dein Entwurf bleibt erhalten.“
- Ein Wort pro Ding, festgehalten im [Glossar](GLOSSAR.md).
- Großbuchstaben nur für kurze Orientierungszeilen („PERSÖNLICHE ANSICHT“), nie für Sätze.
- Jeder Bereich erklärt sich kurz selbst: ein Satz unter dem Titel und ein Knopf „Kurz erklärt“ mit höchstens fünf Schritten (Entscheidung des Besitzers, 08.11.).

## Tokens

Definiert in `app/globals.css` zwischen `/* cp-tokens:start */` und `/* cp-tokens:end */`. Die Musterseite trägt denselben Block, `tests/design-tokens.test.mjs` hält beide gleich. Solange keine Regel sie liest, ändern die Tokens nichts an bestehenden Seiten.

| Gruppe | Tokens |
|---|---|
| Grund und Flächen | `--cp-bg`, `--cp-surface-1…3`, `--cp-line`, `--cp-line-strong`; Alternative `--cp-navy-*` |
| Text | `--cp-text`, `--cp-text-muted`, `--cp-text-faint` |
| Akzente | `--cp-gold`, `--cp-gold-strong`, `--cp-gold-line`, `--cp-gold-wash`, `--cp-blood`, `--cp-blood-text`, `--cp-focus` |
| Tischebene | `--cp-paper`, `--cp-paper-edge`, `--cp-ink`, `--cp-ink-soft`, `--cp-rule`, `--cp-ink-gold` |
| Schrift | `--cp-font-title`, `--cp-font-text`, `--cp-size-xs…3xl` (12–44 px), `--cp-leading`, `--cp-leading-title`, `--cp-tracking-caps` |
| Abstand | `--cp-space-1…8` (4, 8, 12, 16, 24, 32, 48, 64 px) |
| Form und Bewegung | `--cp-radius`, `--cp-hairline`, `--cp-corner`, `--cp-icon-stroke`, `--cp-duration`, `--cp-ease` |

Die Materialtöne der Tischobjekte auf der Musterseite (Holz der Würfelschale, Filz, Würfel) sind bewusst noch keine Tokens. Sie werden es, wenn der Besitzer die Objekte abnimmt.

## Was heute davon abweicht (Messung aus Etappe 0)

- **Farben:** 2.149 verschiedene Hex-Werte in den Stilen. Gold in mindestens acht Tönen.
- **Formen und Größen:** 58 verschiedene Eckenradien, 105 Schriftgrößen. 368 Verläufe und 27 Blur-Flächen.
- **Schriften:** Keine Webschrift. `--font-cormorant` wird benutzt, ist aber nirgends definiert.
- **Charakterbogen:** Er sieht an drei Stellen verschieden aus.

Etappe 4 löst das schrittweise auf (4a Leisten, 4b Charakterbogen, 4c Navigation), jeder Schritt einzeln abnehmbar.
