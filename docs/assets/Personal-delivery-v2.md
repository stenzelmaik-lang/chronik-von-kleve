# Persönliche Inhalte – Grafikassets v2

Stand: 31.10.2026. Lokale Überarbeitung auf `codex/visionen-botschaften`, Grundlage `e9fd1ec7bf0bb42a605c1cd1a7a8c5796f7d3f8a`. Keine Veröffentlichung.

## Ergebnis

- Geschlossener Brief: echtes Bildasset mit Papierstruktur und rotem Wachssiegel. Titel und Bedienhinweis werden als HTML darübergelegt. Die Ankunftsbewegung führt von rechts auf den Tisch.
- Geöffneter Brief: strukturiertes Briefpapier als Hintergrund; die Lesefassung erscheint rechts statt mittig.
- Vision: organischer, transparenter Nebel als Bildasset. Die Lesefläche bleibt oben links und auf den oberen Bühnenbereich begrenzt. Auf Desktop stehen Text und Bild nebeneinander; auf kleinen Bildschirmen scrollen sie innerhalb derselben begrenzten Lesefläche.
- Geöffnete Lesefassungen verwenden nichtmodale Dialoge. Der übrige Spieltisch bleibt bedienbar, Escape schließt die fokussierte Lesefassung. Ein geöffneter modaler Medien-/Dokumentdialog behält seine bisherige Tastaturbehandlung.
- Freigaben, adressierte Inhalte, serverseitiger Dateischutz, persönliche Schließzustände sowie vorhandenes Verschieben und Skalieren der Bühnenobjekte bleiben erhalten.
- Beim Lesen wird die eigene darunterliegende Kachel nur vorübergehend ausgeblendet. Nach dem Schließen ist sie wieder an ihrer gespeicherten Position sichtbar. Die Druckanzeige macht während der Lesefassung Platz.
- Nur neue persönliche Bühnenobjekte bekommen die geänderten Standardpositionen. Bereits gespeicherte, gegebenenfalls manuell verschobene Objekte werden nicht umpositioniert.

## Dateien und Budget

| Asset | Laufzeitdatei | Auflösung | Größe |
| --- | --- | --- | --- |
| Umschlag | `public/images/personal-delivery/envelope-v2.webp` | 900 × 600 | 97.934 Byte |
| Briefpapier | `public/images/personal-delivery/paper-v2.webp` | 860 × 1075 | 174.874 Byte |
| Nebel | `public/images/personal-delivery/mist-v2.webp` | 1200 × 675 | 185.448 Byte |

Zusammen **458.256 Byte / ca. 448 KiB**. Alle drei Dateien besitzen Alpha-Transparenz. Die Grafiktests sichern ein Gesamtbudget unter 500 KiB. Die Dateien sind reine dekorative Oberflächen ohne Nachrichteninhalt; nur diese Dekoration darf öffentlich als statisches Asset erreichbar sein. Persönliche Texte und vorbereitete Bilder bleiben auf den bisherigen autorisierten Datenwegen.

Erzeugung: eingebautes `image_gen`, drei getrennte Generierungen mit `transparent_background: true`. Die Originale wurden nicht verändert. Lokale Quellkopien und Metadaten liegen unter `.local-work/whispers/assets/`. Für die Laufzeit wurden ausschließlich Auflösung und WebP-Kompression mit vorhandenem Sharp angepasst; Alpha bleibt erhalten. Keine neue Anwendungsabhängigkeit.

Quellbilder im Generatorarchiv `C:/Users/Stenz/.codex/generated_images/01a17951-6121-7853-b44e-86741549a3aa/`:

- Umschlag: `exec-3684eb16-f4b1-4557-bd60-366380abd0d9.png`
- Papier: `exec-72d6609f-7599-42e9-be6e-d73ffe72b021.png`
- Nebel: `exec-8670542a-d01b-4769-8577-5cdd96971869.png`

## Promptset

### Umschlag

> Use case: stylized-concept. Production UI sprite for ChroniPlay, an elegant modern gothic noir tabletop RPG website. Single physically believable CLOSED personal letter envelope, top-down orthographic view, front flap side visible, warm antique ivory cotton paper with subtle real fibers and creases, small deep oxblood wax seal with simple unbranded abstract seal impression at the flap point, refined slightly worn edges, soft realistic drop shadow. Landscape 3:2 proportions, centered filling 90% width, perfectly isolated on a genuinely transparent background with alpha. No text, no lettering, no address, no icons, no desk, no hands, no other objects. Restrained rich tactile material and professional premium game inventory asset, not a flat vector icon. The envelope center/front should have quiet undecorated areas to overlay a short dynamic title in HTML. All four edges visible, clean silhouette. Output one transparent PNG asset.

### Briefpapier

> Use case: stylized-concept. Production UI asset for a premium gothic noir RPG personal letter, matching an antique ivory cotton-paper envelope with oxblood wax. A SINGLE unfolded blank sheet of warm cream cotton letter paper, straight-on orthographic top-down view, portrait 4:5 ratio, real paper fibers and very light fold lines, tactile softly irregular deckle edges and subtle soft realistic drop shadow. Almost entirely light ivory, not dirty/burned or fantasy parchment. Top left has one tiny refined burgundy embossed neutral circular seal motif, edges very subtly aged. Large empty clean central writing area at least 80% of sheet, absolutely NO writing, no text, no runes, no fake gibberish. Isolated on genuinely transparent alpha background; no desk, no envelope, no other objects. Professional realistic game UI asset; all edges visible. Output one transparent PNG asset.

### Nebel

> Use case: stylized-concept. Production transparent VFX UI asset for a vampire gothic noir tabletop RPG: one wide horizontal irregular cloud of ethereal volumetric smoke, muted blue-grey and smoky teal with faint pale silver wisps, realistic cinematic fine smoke filaments and organic curled edges. Landscape 16:9 composition. This is a READING FRAME: central 65% of area is calm dark desaturated blue-green atmospheric fog with substantial opacity for legible white HTML text laid over it. The smoke around the perimeter curls softly and fades organically to completely transparent alpha at every outside edge, no rectangular border. Lighter wisps mostly along the top-left and outer rim, no bright hotspot behind text. Spacious organic ghostly thought-cloud, sophisticated restrained supernatural effect, not neon, not a cartoon cloud. No objects, no eyes/faces, no skulls, no symbols, no text, no scene or background. One unified isolated fog cloud on a genuinely transparent background. Output one transparent PNG asset.

## Lokale Abnahme und Bestandsschutz

Die separate Grafik-QA wurde mit `node --experimental-strip-types scripts/test-local.mjs --regie --vision-assets` auf Port **8891** ausgeführt, eigener Speicher `.local-test/vision-assets`. Der QA-Server wird nach der Prüfung gestoppt. Browser-/Integrationstests verändern ausschließlich diesen synthetischen QA-Abend. Der bisherige Speicher `.local-test/regie` für Port **8890** wird hierfür nicht neu befüllt oder zurückgesetzt.

Für die QA: `CVK_TEST_URL=http://127.0.0.1:8891` setzen, dann die vorhandene `scene-whispers-integration.mjs` und `scene-whispers-browser.mjs` ausführen. Der Browserlauf prüft zusätzlich Positionen, nichtmodale Bedienung, geladene Assets, Bildwechsel und mobile Begrenzung. Bei reduzierter Bewegung entfallen die Eintrittsanimationen.

| Prüfung | Ergebnis |
| --- | --- |
| Vollständiger Standardlauf einschließlich Platzierungs- und Assetbudgetprüfung | **230/230 bestanden** |
| Typecheck und gezielter ESLint | bestanden |
| Lokaler Produktionsbuild | bestanden; bestehender Client-Chunk-Hinweis |
| HTTP-Integration: drei synthetische Rollen, Versionen, Empfänger und Dateischutz | bestanden |
| Browser: 1440×900, 375×812, Editor 390×844 | bestanden |
| Vision oben links / oberer Bereich; Brieflesefassung rechts | bestanden |
| Bühne und weitere Werkzeuge während einer geöffneten Vision bedienbar | bestanden |
| Tatsächlich geladene Assets, Bildwechsel, Tastatur, Reconnect, reduzierte Bewegung | bestanden |
| Mehrfacher schneller Wechsel zwischen Vision und Brief | bestanden |
| Vorbereitungseditor: mehrere Einträge, speichern, neuladen, gezielt ausspielen | bestanden |

Der schnelle Ansichtswechsel hatte zunächst ein Problem durch das verspätete native `close`-Ereignis: Es konnte eine inzwischen neu geöffnete Lesefassung wieder schließen. Dieses redundante Ereignis setzt nun keinen neueren Darstellungszustand mehr zurück; der Browserlauf prüft mehrfaches unmittelbares Schließen und Wiederöffnen.

Aktuelle Screenshots und Prüfprotokolle liegen unter `.local-work/whispers/browser/` bzw. `.local-work/whispers/`, außerhalb der Versionierung. Der bestehende Abnahmeserver **8890** wurde mit demselben Build und seinem erhaltenen Speicher wieder gestartet. Für die neue Darstellung die bereits geöffnete Seite neu laden.

Persönliche UX-Abnahme und eine spätere Live-Freigabe sind nicht Bestandteil dieser Grafiküberarbeitung.
