# Etappe 4b · Charakterbogen · Übergabe

Stand 08.11.2026 · Claude Code (Opus 5.5) · lokal, nicht gepusht, nicht deployt

| | |
|---|---|
| Branch | `claude/anwenden-designgrundlage` |
| Basis | `8eac35a` (4a, vom Besitzer am 08.11. abgenommen) |
| Commit | 4b (dieser Commit), einzeln zurücknehmbar |

## Referenz

- **Blatt:** das zweiseitige deutsche V20-Blatt aus dem Drive-Ordner des Besitzers (`V20_2-Page_Neonate_Interactive_German.pdf`).
- **Ausgefülltes Blatt:** Es enthält den Charakter einer Mitspielerin. Nach Vorgabe des Besitzers („ohne Werte“) habe ich nur Felder, Gruppen, Reihenfolge und Punktanzahl verglichen. Es stehen keine Werte, Namen oder persönlichen Angaben im Repo.
- **Speicherort:** Das Blatt selbst liegt nicht im Repo.

## Abweichungsliste

[docs/design/4b-ABWEICHUNGSLISTE.md](../design/4b-ABWEICHUNGSLISTE.md): Feld für Feld, Seite 1 und 2, für Spielerzentrale bzw. SL-Ansicht und das Ingame-Menü.

## Änderungen (nur Darstellung, Rechte und Daten unverändert)

1. **Ein Bogenmodell** `domain/character-sheet-view.ts` (rein, ohne Oberfläche): baut aus der bestehenden Projektion die Sicht des Papierbogens. Es nutzt die in Etappe 1 geretteten Hilfen `sheetNumber`, `dotSlots` und `dotLabel` (`domain/sheet-values.ts`) statt neuer Logik.
2. **Eine Komponente** `app/spielbereich/modules/character-sheet/character-sheet.tsx` mit zwei Layouts:
   - **breit** (bis zu 3 Spalten): Spielerzentrale und SL-Ansicht der Charakterverwaltung, beide über `CharacterDetail`;
   - **schmal** (einspaltig): Ingame-Menü, in `CharacterReadOnly`.
   - Rahmenebene mit Tokens: Eckmarken, Spectral-Titel, Gold-Haarlinie unter Abschnittstiteln.
3. **Behobene Abweichungen:**
   - Gruppen heißen wie auf dem Blatt: Körperlich, **Gesellschaftlich**, **Geistig** (vorher „Sozial“, „Mental“).
   - **Wert über 5:** Punkte wachsen mit (vorher bei 5 abgeschnitten).
   - **Fehlender Wert:** „–“ (vorher leere Punkte, also nicht von 0 zu unterscheiden). Eine echte 0 bleibt als 0 lesbar.
   - **Eigene Fähigkeiten** stehen in ihrer Gruppe (Talent, Fertigkeit, Kenntnis), deaktivierte bleiben ausgeblendet.
   - **Spezialisierungen** stehen an ihrer Zeile, mit Zusatz, „(deaktiviert)“ und „wirkt erst ab 4 Punkten“ wie bisher. Der Hinweis „Vorbereitung, noch keine Würfelwirkung“ bleibt (Release-Entscheidung, Test `w10-selection`).
   - **Werte ohne Zuordnung** sind sichtbar.
   - **Tugenden** zeigen die Doppelbezeichnung des Blatts, wenn nichts gespeichert ist. Gespeicherte Namen (z. B. „Überzeugung“) bleiben unverändert.
   - **Menschlichkeit/Pfad** mit 10 Punkten, **Willenskraft** mit 10 Punkten und 10 Kästchen, **Blutvorrat** als Kästchen mit „pro Runde“, **Gesundheit** mit 7 Stufen, Abzügen und Schadensmarken. Im Ingame-Menü stand vorher nur eine Liste aus Rohwerten.
   - **Leere Kopffelder** zeigen „–“. Lange Namen brechen um.
4. **Unverändert:**
   - die Bearbeitungsmaske;
   - die Probenauswahl im Ingame-Menü (Attribut und Fähigkeit für einen Wurf wählen, mit Reitern);
   - die Projektionen und Routen.

## Pflichttestfälle

`tests/character-sheet-view.test.mjs` (7 Tests, in `pnpm test`):
- Wert 0, Wert über 5, fehlender Wert „–“ (nie leer, nie 0);
- Spezialisierungen mit Zusatz und Status;
- eigene Fähigkeiten in ihrer Gruppe, Werte ohne Zuordnung;
- sehr lange Namen;
- leerer Bogen;
- Listen und Freitext aus dem Altbestand, Tugenden, Ressourcen, Gesundheit.

Rechte: `tests/character-sheet-integration.mjs` (6 Prüfungen gegen lokale Instanz):
- Spieler A liest den eigenen Bogen;
- Spieler B liest A's Bogen nicht und kommt nicht an die SL-Projektion (403);
- die SL liest über ihre eigene Projektion;
- nicht angemeldet liefern beide Projektionen 401.

## Bildschirmfotos (lokale Instanz `--ge-01`, synthetische Figur)

| | vorher (`8eac35a`) | nachher |
|---|---|---|
| Spielerzentrale 1280 px | ![](../design/4b/vorher-1280-spielerzentrale.jpg) | ![](../design/4b/nachher-1280-spielerzentrale-oben.jpg) ![](../design/4b/nachher-1280-spielerzentrale-unten.jpg) |
| Ingame-Menü 1280 px | ![](../design/4b/vorher-1280-ingame.jpg) | ![](../design/4b/nachher-1280-ingame.jpg) |
| Spielerzentrale 375 px | – | ![](../design/4b/nachher-375-spielerzentrale.jpg) |

Den Vorher-Stand habe ich in einem temporären Worktree gebaut und danach samt seiner Testdatenbank gelöscht.

## Prüfungen (beobachtet)

| Prüfung | Ergebnis |
|---|---|
| Routenliste vor und nach dem Umbau | gleich |
| `pnpm run typecheck` | ohne Fehler |
| `pnpm test` | **403/403** (+7) |
| `node --experimental-strip-types --test tests/*.test.mjs` | **517/523**, dieselben 6 Altfälle |
| ESLint auf allen neuen und geänderten Dateien | ohne Befund |
| `pnpm run build` | erfolgreich |
| `pnpm run test:integration:run` | Exit 0 |
| `tests/character-sheet-integration.mjs` | 6/6 |
| Browser 1280 und 375 px | Spielerzentrale breit bzw. einspaltig, kein waagerechter Scroll (`scrollWidth` 375). Ingame schmal, Titel nach Korrektur im richtigen Stil |
| Kontrast | Bogentext auf `--cp-surface-1` 14,0:1, Nebentext 7,4:1, Gold 8,8:1 |

Beim Durchsehen behoben:
- Die Stile der Spielerleiste überschrieben im Ingame-Menü die Gruppentitel. Die Bogen-Stile sind jetzt spezifischer.
- Die Spezialisierungsvermerke der alten Ansicht fehlten zunächst im Modell, sind jetzt wieder vollständig.

## Prüfgrenzen

- **Testdaten:** Die synthetische Figur hat keine Fähigkeiten und keine Spezialisierungen. Die Fälle „über 5“, „Spezialisierung“, „eigene Fähigkeit“ sind per Unit-Test belegt, im Browser nur mit „fehlend“ und normalen Werten gesehen.
- **SL-Ansicht:** im Browser nicht geöffnet. Sie nutzt dieselbe Komponente `CharacterDetail` (Rechte per Integrationstest).
- **Kein echtes Mobilgerät**, kein Screenreader-Durchgang. Punkte und Kästchen haben Textalternativen (`role="img"`, `aria-label` mit Wert bzw. „nicht erfasst“).
- **Darüber liegende Bereiche:** Der feste Live-Block (Blut, Willenskraft, Gesundheit) über dem Bogen in der Spielerzentrale ist unverändert, ebenso die Reiter der Probenauswahl im Ingame-Menü.

## Offen

- **Bogen Seite 2, nicht im Datenmodell:** Haltung, Rituale, Kampfblock, Beschreibungsfelder. Das wäre ein eigener Auftrag mit Schemaänderung.
- **4c Navigation:** Die Zieltabelle legst du vor dem Umbau fest.

## Ausdrücklich nicht getan

Kein Push, kein Deployment, keine Migration, keine Datenänderung. Keine geänderten Routen, Rechte oder Projektionen. Das V20-Blatt ist nicht im Repo.


## Nachbesserung nach Kritik des Besitzers (09.11.2026)

**Kritik:**
- Der Kopf des Bogens stand doppelt da.
- Die Leiste mit Blut, Willenskraft und Gesundheit wanderte beim Scrollen mit und ist eigentlich sinnlos, weil diese Werte am Spieltisch gesteuert werden.
- Am Tisch soll die Aufteilung in Reiter bleiben.
- Die Optik war nicht schön genug, gewünscht ist mehr wie das V20-Blatt.
- Statt der drei Knöpfe im Kopf soll dort das Clan-Banner hängen.
- „Figurenprofil“ soll „Charakterprofil“ heißen.

**Umgesetzt:**
- **Live-Leiste entfernt:** Die Leiste mit Blut, Willenskraft, Gesundheit und Erfahrung ist aus der Charakteransicht (`CharacterDetail`) entfernt. Die Werte stehen lesend im Bogen, Erfahrung unter „Entwicklung“. Gesteuert werden sie am Spieltisch. Die Komponente `character-live-vitals.tsx` bleibt im Repo, wird hier aber nicht mehr eingebunden.
- **Kopf ohne Knöpfe:** Die Knöpfe sind aus dem Charakterkopf in eine eigene Aktionsleiste darunter gewandert: Ausrüstung & Inventar, Charakter archivieren, Weitere Aktionen, Charakter wechseln. Im Kopf hängt jetzt das **Clan-Banner** (vorhandene Grafik der Spielerzentrale).
- **Umbenennung:** Der Reiter heißt jetzt **„Charakterprofil“**.
- **Kein doppelter Kopf mehr:** In der Spielerzentrale lässt der Bogen die Kopfdaten weg, die stehen schon im Charakterkopf.
- **Ingame-Menü wieder mit Reitern:** Identität, Attribute, Fähigkeiten, Vorteile, Zustände & EP, Geschichte. Jeder Reiter zeigt seinen Abschnitt im neuen Bogenstil, die Probenauswahl ist unverändert.
- **Optik nach dem V20-Blatt:**
  - Zierrahmen mit Doppellinie und selbst gezeichneten Eckornamenten;
  - Kopfzeile mit dem Namen der Figur;
  - Abschnittstitel mittig mit Schmuckleisten links und rechts;
  - Gruppentitel in gesperrten Versalien;
  - Punkte wie gedruckte Kreise.

  Alles als eigene SVG-Zeichnung im CSS, keine Verlagsgrafik, kein Farbverlauf.

**Bilder:** ![](../design/4b/nachbesserung-1280-kopf-banner-bogen.jpg) ![](../design/4b/nachbesserung-1280-ingame-reiter.jpg)

**Prüfungen:**

| Prüfung | Ergebnis |
|---|---|
| typecheck | ohne Fehler |
| ESLint auf den geänderten Dateien | ohne Befund |
| `pnpm test` | 403/403 |
| alle Testdateien | 517/523, dieselben 6 Altfälle |
| Build | erfolgreich |
| Browser 1280 px | Spielerzentrale und Ingame-Reiter geprüft |
| `test:integration:run` und Rechtetest | **nicht erneut ausgeführt.** Seit dem letzten grünen Lauf auf `854c481` ist nur Oberfläche geändert, keine Route und keine Projektion |
| Browser 375 px | nach der Nachbesserung **nicht** geprüft. Das Clan-Banner ist unter 700 px ausgeblendet |

**Offen, besprochen mit dem Besitzer:** Neuordnung des ganzen Charakterbereichs als eigener Schritt mit Zieltabelle:
- Charakterprofil mit den Feldern von Seite 2 (Vergangenheit, Antrieb, Haltung, Aussehen …);
- Notizen und Verbindungen aus „Geschichte & Bilder“ in Notizbuch bzw. Archiv;
- „Kontext für die nächste Nacht“ an einen anderen Ort;
- Porträt und Referenzen überarbeiten;
- „Aktive / Archivierte Charaktere“ neu gestalten;
- Charakterprofil optisch angleichen;
- die Bearbeitungsmaske entschlacken.

## Zweite Nachbesserung (09.11.2026)

**Wunsch des Besitzers:**
- Die Menüführung soll nach oben und schön gestaltet sein.
- „Aktive / Archivierte Charaktere“ soll dort aufgehen.
- Der Kopf mit dem Clan-Banner soll als eigener Block im Bogenstil über dem Bogen stehen.
- Die Bogen-Überschrift „V20 · Charakterbogen / Name“ soll wegfallen, weil der Name schon im Kopf steht.

**Umgesetzt:**
- **Menüleiste ganz oben** über dem Charakterkopf, auf der Rahmenebene:
  - Umschalter „Aktive / Archiviert (n)“, ersetzt die beiden großen Knöpfe darüber;
  - Ausrüstung & Inventar, Bogen bearbeiten (sofern berechtigt), Charakter archivieren, Weitere Aktionen, Charakterwahl;
  - sichtbarer Fokusring.

  Alle Ziele bleiben erreichbar. Im leeren Zustand (kein Charakter) steht der bisherige Umschalter weiter da.
- **Charakterkopf als Block im Bogenstil:** Doppelrahmen, Eckornamente, Spectral-Titel, Feldnamen in Gold-Versalien, Clan-Banner hängt vom oberen Rand.
- **Bogen-Überschrift** in der Spielerzentrale entfernt.

**Bild:** ![](../design/4b/nachbesserung2-1280-menue-kopf-bogen.jpg)

**Prüfungen:**
- typecheck, ESLint und Build ohne Fehler, `pnpm test` 403/403, Browser bei 1280 px.
- **Nicht geprüft:** 375 px, die Integrationsprüfung (nur Oberfläche geändert) und der leere Zustand im Browser.
