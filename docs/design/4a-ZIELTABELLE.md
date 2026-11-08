# 4a · Zieltabelle Spielerleiste oben und linke Tischleiste

Stand 08.11.2026 · **Vom Besitzer entschieden am 08.11.2026:** Das Leistensymbol „Zustand“ ist gestrichen, alle anderen Ziele bleiben. Die Panel-Typen in `stage.tsx` bleiben unverändert, nur ihre Erreichbarkeit würde sich ändern. Nichts davon verschiebt Rechte, Routen oder Daten.

## Alle Ziele am Spieltisch heute

| Ziel (Panel / Ansicht) | Spielerleiste oben | Leiste links | Weitere Stelle | Wer | Vorschlag |
|---|---|---|---|---|---|
| Szenen des Abends (`scenes`) | – | Szenen | – | SL | behalten |
| Regie (`regie`) | – | Regie | eigenes Fenster | SL | behalten |
| Dokumente (`documents`) | – | Dokumente | – | alle | behalten |
| Zustand, eigene Werte (`vitals`) | „Eigene Werte steuern“ (nur buchen) | Zustand | Rundenanzeige unten links (öffnet `vitals`) | Spieler | **nur an einem Ort:** Die Rundenanzeige bleibt der Einstieg, weil sie die Werte ohnehin zeigt. Das Leistensymbol „Zustand“ entfällt. „Eigene Werte steuern“ bleibt oben, weil es bucht statt anzeigt. *Die grafische und technische Überarbeitung von „Mein Zustand“ ist ein eigener Auftrag (Befund des Besitzers).* |
| Eingesteckt (`pocket`) | – | Eingesteckt | – | Spieler | **behalten**, eigenes Symbol (Tasche statt Rucksack). Vorstufe des Inventars (Entscheidung des Besitzers) |
| Inventar | Inventar | – | Spielerbereich | alle (fremde nur SL) | behalten, klar getrennt von „Eingesteckt“ |
| Charakterbogen | Charakterbogen | – | Spielerbereich | alle (fremde nur SL) | behalten |
| Profil | Profil | – | – | alle | behalten |
| Nachrichten / Postfach | Nachrichten | – | Spielerbereich | alle | behalten |
| Notizbuch eines Spielers lesen | Notizbuch (lesen) | – | – | SL | behalten |
| Eigenes Notizbuch (`notebook`) | – | Notizbuch | Spielerbereich | alle | behalten |
| Notizzettel (`sticky`) | – | Zettel | Zettel auf der Bühne | alle | behalten |
| Gemeinsam zeichnen | – | Zeichnen | – | alle | behalten |
| Bedienhilfe (`help`) | – | Hilfe | – | alle | behalten |
| Kontext der Szene (`context`) | – | – | Knopf „Kontext“ oben rechts | alle | behalten |
| Würfel (`dice`) | – | – | Dock unten | alle | behalten |
| Weltkarte (`map`, `place`) | – | – | Dock unten | alle | behalten |
| Figuren (`npcs`) | – | – | kein Einstieg in `stage.tsx` | – | nur notieren: Panel ohne Einstieg, wird aus der Regie gesteuert |

Bei echter Doppelung sehe ich nur **einen** Fall: Zustand ist zugleich über das Leistensymbol und über die Rundenanzeige erreichbar, beide öffnen dasselbe Panel. Alles andere sind verschiedene Dinge mit ähnlichem Namen. Für die gibt es klarere Wörter (Glossar) und eigene Symbole.

## In diesem Schritt schon umgesetzt (ohne Erreichbarkeit zu ändern)

- Eigener Icon-Satz in Leiste und Dock, mit sichtbarer Kurzbeschriftung. Der volle Name steht weiter als Tooltip und für Screenreader.
- Die Leiste ist breiter, mit einer gemeinsamen Breite für Bühne, HUD und Schubladen.
- Namen in Rundenanzeige und Spielerleiste werden nicht mehr abgeschnitten: Sie brechen um, der ganze Name steht im Tooltip.
- Leiste, Dock und Schubladen nutzen die Tokens der Rahmenebene: Spectral für Titel, Plex für Bedienung, sichtbarer Fokusring.
- Die Würfelschale ist ein Tischobjekt: Holzrand und dunkelgrüner Filz, im 3D-Modell und im Ersatzbild ohne WebGL. Die achteckige Form bleibt, weil die Würfelphysik daran hängt.
- Notizzettel bleiben vorerst wie sie sind (Wunsch des Besitzers: eigens schöner gestalten).

## Entschieden

- Das Leistensymbol „Zustand“ ist entfernt (Antwort des Besitzers: „Ja, streichen“). Der Einstieg läuft über die Rundenanzeige. Das Panel `vitals` ist unverändert.
- Alle anderen Ziele bleiben, wo sie sind.
