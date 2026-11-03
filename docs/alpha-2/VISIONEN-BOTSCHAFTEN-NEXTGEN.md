# NEXTGEN: Visionen & persönliche Botschaften – Abschlussbericht

- **Branch:** `claude/visionen-nextgen`
- **Basis:** `origin/main` `70f4059`. Diese Basis enthält Codex-PR #72 (`codex/live-regie-layout`). Den hat Claude bisher nicht veröffentlicht; ein Deployment dieses Branches bringt ihn mit.
- **Stand:** Live seit 03.11.2026 mit Galerien, Tönen und Tempo (`2b62ddf`, siehe Abschnitt 9). Die Live-Regie-Nachbesserung aus Abschnitt 10 ist lokal geprüft und noch nicht live.
- **Datum:** 03.11.2026

## 1. Bestand vorher

Visionen und Briefe wurden in Schritt 6 der Szenenvorbereitung (`whispers`) angelegt. In der Regie spielte die SL sie aus: Als Tischobjekt `scene-whisper:` lag ein Token auf dem Spielfeld, das ein kleines Dialogfenster öffnete (oben links bei Visionen, rechts bei Briefen).

Das hatte vier Schwächen:
- Die Vision war ein Fenster und kein Erlebnis.
- Es gab keine Rückmeldung, ob ein Spieler sie gesehen hat.
- Es gab keine Auswahl der Empfänger beim Auslösen.
- Es gab keinen Stil pro Vision.

## 2. Konzept

| Thema | Entscheidung |
| --- | --- |
| Vorbereitung | Sie bleibt in der Szene (Schritt 6). Neue Felder sind optional, alte Einträge bleiben gültig. |
| Auslösen | Jedes Auslösen erzeugt einen **Zustellungslauf** mit eigener Kopie des Inhalts. Die Vorbereitung wird dabei nicht verbraucht und kann beliebig oft erneut ausgelöst werden. |
| Empfänger | Beim Auslösen wählt die SL eine von drei Möglichkeiten: „Vorgesehene“ (aus der Vorbereitung), „Ganze Gruppe“ oder eine freie Auswahl. Ein Empfänger, der nicht an der Runde teilnimmt, wird abgelehnt. Es gibt keinen stillen Ersatz durch eine andere Gruppe. |
| Quittungen | Pro Empfänger: `seenAt` („sieht es gerade“) und `ackAt` („bestätigt“). Jeder bestätigt unabhängig. |
| Geheimhaltung | Sie gilt serverseitig. Spieler erhalten nur eigene, aktive, unbestätigte Läufe, ohne internen Titel, Notiz, andere Empfänger oder Szenenherkunft. Bilder und Ton gibt eine eigene, empfängergeprüfte Route aus. |
| Zuverlässigkeit | `requestId` macht Doppelklicks wirkungslos. Ein Reload startet eine unbestätigte Vision neu. Die Bestätigung wird bis zu viermal wiederholt. Das Schreiben ist per Compare-and-swap gegen gleichzeitige Änderungen geschützt. |
| Altbestand | Alte `scene-whisper:`-Tischobjekte funktionieren weiter. Das Pult hat dafür den Knopf „Ältere Tisch-Zustellung zurückziehen“. |

## 3. Umgesetzte Funktionen

### Spielerseite: Vision (Vollbild)

**Eintritt und Isolation**
- Die Vision legt sich als Vollbild über die ganze Seite. Der Tisch darunter wird unscharf, entsättigt und leicht vergrößert („hineingezogen“).
- Alle anderen Seitenbereiche sind währenddessen `inert`, also weder klick- noch fokussierbar.
- Nur die adressierten Spieler werden herausgezogen; alle anderen spielen normal weiter.

**Ablauf**
- Phasen: Eintritt → Spiel → Ende → Austritt.
- Textabschnitte schweben einzeln herein und bleiben lange genug lesbar. Die Lesezeit wächst mit der Textlänge, liegt zwischen 3,5 und 16 s und ist bei ruhigen Effekten 15 % länger.
- Bilder schweben als nicht anklickbare Erscheinungen; jedes Preset bewegt sie anders.

**Sechs Presets**

| Preset | Look |
| --- | --- |
| Klassisch | grau-gold |
| Traum | türkis |
| Dunkel | schwarz |
| Bedrohung | rot beleuchteter Nebel, schwarze Schattententakel, langsames Unbehagen-Pulsieren unter 0,3 Hz, kein Stroboskop |
| Dramatisch | violett-gold |
| Erinnerung/Echo | sepia |

**Ende**
- Die Vision endet nur über „Ich habe alles gesehen“. Daneben gibt es „Noch einmal“.
- Danach kehrt der Tisch unverändert zurück.

**Werkzeuge während der Vision**
- „Weiter“
- „Text vollständig anzeigen“; die Escape-Taste öffnet ebenfalls den Volltext und beendet nicht.
- „Effekte ruhiger“ / „Effekte wieder voll“
- „Ton einschalten“ / „Ton aus“

**Barrierefreiheit**
- Die Systemeinstellung „Bewegung reduzieren“ wird respektiert. Ruhige Effekte bleiben lokal gespeichert.
- Alles ist per Tastatur bedienbar; der Fokus landet auf dem Abschlussknopf.

### Spielerseite: Persönliche Botschaft

**Fax**
- Das Blatt wird mit Ruckpausen eingezogen.
- Kopfzeile: TELEFAX, Datum, Kennung `CP-XXXXXX`, „Seite 1/1“, Von und An.

**Brief**
- Briefpapier mit Absender und Datum.

**Für beide Layouts**
- Die Botschaft ist nicht modal und liegt über allen Tischebenen. Sie passt auch auf Handybreite.
- Der Inhalt erscheint als Rich Text; Anhänge als Bilder.
- Abschluss mit „Gelesen · ablegen“ (Fax) oder „Gelesen · Brief schließen“ (Brief).

### SL-Editor (Szene, Schritt 6, Bereich „Inszenierung“)

- Visionstyp als sechs Karten mit Farbmuster.
- Für Botschaften das Layout Fax oder Brief und einen Absender, der für Spieler sichtbar ist.
- „Vorschau abspielen“: Die Vorschau läuft nur lokal, stellt nichts zu und erzeugt keinen Eintrag.
- Unter „Weitere Möglichkeiten“:
  - eigene Textabschnitte (bis 20 × 600 Zeichen);
  - Ton oder Musik aus der Galerie;
  - interne Notiz, nur für die SL.
- Titel, Empfänger und Bilder bleiben wie bisher; der Titel ist nur für die SL sichtbar.

### Regie-Pult „Visionen & Briefe“

**Pro vorbereitetem Eintrag**
- Empfängerwahl: Vorgesehene, Ganze Gruppe (n) oder Auswahl.
- „Vorschau“
- „Vision auslösen“ bzw. „Botschaft zustellen“.

**Letzte Läufe**
- Status je Empfänger: wartet, sieht es gerade, bestätigt, zurückgezogen.
- Pro Empfänger „erneut“; pro Lauf „Zurückziehen“.
- Das Pult aktualisiert sich alle 2,5 s.

## 4. Geänderte Komponenten und Datenstrukturen

### Neue Dateien

| Datei | Inhalt |
| --- | --- |
| `domain/personal-delivery.ts` | Presets, Layouts, Textabschnitte, Lesedauer, Empfängerauflösung, Status, Spielerprojektion, Faxkennung |
| `server/settings-store.ts` | `readSetting` / `mutateSetting` (Compare-and-swap auf `settings`); `server/live-figures.ts` nutzt es jetzt ebenfalls |
| `server/live-deliveries.ts` | Lauf-Speicher, `deliver` / `withdraw` / `seen` / `ack`, Spielerprojektion, Asset-Freigabe |
| `app/api/live-deliveries/route.ts` | GET (nur SL) und POST (zod-geprüft) |
| `app/api/live-deliveries/asset/route.ts` | Bild/Ton nur für Empfänger; privat, `no-store`, `nosniff`, Sandbox-CSP, Range-Unterstützung |
| `app/spielbereich/modules/spieltisch/delivery-players.tsx` + `.module.css` | Vision- und Botschafts-Player |
| `app/spielbereich/modules/spieltisch/delivery-stage.tsx` | Warteschlange am Tisch, Quittungen, lokale Vorschau |
| `app/spielbereich/modules/spieltisch/delivery-desk.tsx` + `.module.css` | Regie-Pult |
| `app/spielbereich/modules/prepared-whisper-staging.tsx` + `.module.css` | Inszenierung im Editor |

### Geänderte Dateien

| Datei | Änderung |
| --- | --- |
| `domain/story-scene.ts` | `sceneWhisperSchema` mit den optionalen Feldern `preset`, `fragments`, `audioFileId`, `layout`, `sender`, `note` |
| `server/story-scenes.ts` | Tondateien werden beim Speichern geprüft |
| `server/live-stage.ts` | Der Spieler-Snapshot enthält `deliveries` (nur eigene; die SL erhält keine) |
| `app/spielbereich/modules/spieltisch/types.ts` | `Snapshot.deliveries` |
| `app/spielbereich/modules/spieltisch/stage.tsx` | `DeliveryStage` am Spielertisch |
| `app/spielbereich/modules/spieltisch/regie.tsx`, `regie-window.tsx` | `DeliveryDesk` ersetzt die alte Freigabeliste |
| `app/spielbereich/modules/prepared-whispers.tsx` | Bindet die Inszenierung ein; Hinweistext angepasst |
| `package.json` | `test` ergänzt um `tests/personal-delivery.test.mjs`; neues Skript `test:deliveries` |

### Daten

- **Zustellungsläufe:** in der Tabelle `settings` unter `live-deliveries:<Kampagne>:<Sitzung>` als JSON `{rev, runs, requests}`, höchstens 300 Läufe. Es gibt kein neues Tabellenschema und keine Migration.
- **Szenen-JSON:** nur optionale Zusatzfelder. Bestehende Szenen bleiben unverändert gültig.

## 5. Durchgeführte Prüfungen (lokal, synthetische Fixtures)

| Prüfung | Ergebnis |
| --- | --- |
| `pnpm test`-Liste (Unit, inkl. neuer `personal-delivery.test.mjs`) | 356/356 bestanden |
| Alle `tests/*.test.mjs` (73 Dateien) | 495/499; **4 Fehler in `npc-data.test.mjs` / `npc-dossier.test.mjs`** (siehe Befund) |
| `tests/live-deliveries-integration.mjs` (`--regie`) | 30/30 |
| `tests/live-deliveries-browser.mjs` (SL + A 1280×800 + B 390×844, Edge) | alle 14 Schritte bestanden, keine Seitenfehler |
| `tests/scene-whispers-integration.mjs` (Altpfad) | bestanden |
| `tests/scene-whispers-browser.mjs` (Altpfad + Editor + Regie) | bestanden nach Anpassung (siehe unten) |
| Volle Integration (`test:integration`) | 2046 Prüfungen + 46 Rollenprüfungen bestanden; ein Lauf davor scheiterte einmal an „fetch failed“ in fremden Charaktertests, die Wiederholung war grün |
| Story-Editor: `story-browser-smoke.mjs`, `preparation-guide-browser.mjs` (`--spieltisch-release`) | beide bestanden |
| ESLint (alle neuen und geänderten Dateien), `tsc --noEmit` | sauber |

### Abgesicherte Punkte

**Geheimhaltung und Rechte**
- Kein interner Titel, keine Notiz und keine fremden Empfänger im Spieler-Snapshot.
- Fremde Spieler erhalten 404, Anonyme 401; nach der Bestätigung sind die Bilder wieder gesperrt.
- Spieler dürfen weder auslösen noch auflisten noch zurückziehen.

**Zuverlässigkeit**
- Veraltete Vorbereitung → 409.
- Doppelte `requestId` → keine zweite Zustellung.
- Zweimal bestätigen ist harmlos.
- Nach einem Reload läuft eine unbestätigte Vision erneut.

**Mehrspieler**
- A und B erhalten gleichzeitig verschiedene Inhalte.
- „Ganze Gruppe“ schließt die SL aus.
- Jeder bestätigt unabhängig.

**Erlebnis und Ablauf**
- Die Vorschau stellt nichts zu.
- Der Tisch ist während der Vision `inert` und danach wieder bedienbar.
- Die Vorbereitung wird durch das Auslösen nicht verbraucht.

### Angepasster Alttest

`tests/scene-whispers-browser.mjs` (nicht in der CI) prüfte die abgelöste Regie-Liste „Vision ausspielen“. Ich habe ihn nicht gelöscht, sondern angepasst:
- Der Altpfad am Tisch und der Editor-Teil sind unverändert.
- Der Regie-Teil nutzt jetzt das neue Pult, die Vollbild-Vision (inklusive scrollbarem Volltext) und das Fax.
- Er nutzt jetzt optional `CVK_BROWSER_CHANNEL`.

Dabei hat er einen **echten Fehler dieser Arbeit** gefunden: Die unsichtbaren Radio-Felder der Preset-Karten liefen auf 390 px Breite 49 px seitlich über. Das ist behoben: Die Karte ist jetzt positioniert, und das Grid nutzt `minmax(min(210px, 100%), 1fr)`. Danach gab es keinen Überlauf mehr.

### Befund außerhalb dieser Arbeit (nicht geändert)

`tests/npc-data.test.mjs` und `tests/npc-dossier.test.mjs` scheitern mit denselben 4 Fehlern auch auf unverändertem `main` `70f4059`. Ursache: Sie erwarten `/api/entities?type=NPC&includeRedacted=1`; der Code ruft inzwischen `…&view=player` auf. Diese Tests stehen nicht in `pnpm test` und damit nicht in der CI. Die Klärung (Test anpassen oder Verhalten prüfen) ist ein eigener Auftrag.

## 6. Bekannte Einschränkungen

- **Kein echtes Gerät:** Geprüft wurde nur in Headless-Edge mit Desktop- und Handy-Viewport, nicht auf einem echten Handy oder Tablet.
- **Synthetische Bilder:** Die Fixture-Bilder sind winzig und erscheinen deshalb als Flecken. Der Look mit echten Kampagnenbildern ist noch nicht beurteilt.
- **Ton:** Browser können Autoplay blockieren. Dann erscheint „Ton einschalten“; die Vision läuft ohne Ton weiter.
- **Tentakel:** Es sind einfache SVG-Striche mit roter Schattenkante. Wirkung gut, aber kein Kunstwerk.
- **Aktualisierung per Polling, nicht Push:** Spieler alle 1,5 s über den Stage-Snapshot (nur bei sichtbarem Tab), das Pult alle 2,5 s. Zwischen Auslösen und Erscheinen können ein bis zwei Sekunden liegen.
- **Begrenzter Verlauf:** Pro Sitzung bleiben höchstens 300 Läufe; ältere fallen heraus.
- **Galerie-Löschungen:** Wird ein Bild in der Galerie gelöscht, liefert ein bereits laufender Lauf es nicht mehr aus. Es gibt keine Warnung beim Löschen.
- **Geplante Layouts:** Telegramm, digital, Pager und verschlüsselt sind nur als „Geplant“ im Editor angekündigt.

## 7. Benötigte Grafik- und Audio-Assets

1. **Nebel je Preset** als WEBP, ca. 1920×1080, kachelbar oder weich auslaufend: Traum (hell, schwebend), Bedrohung (dicht, bodennah), Echo (staubig, Sepia). Bisher teilen sich alle `mist-v2.webp` mit Farbfiltern.
2. **Tentakel bzw. Silhouette** für „Bedrohung“ als freigestelltes PNG/WEBP oder SVG mit Transparenz, 2–3 Varianten.
3. **Faxpapier**: Thermopapier-Textur mit Rand und leichtem Grauschleier. Optional ein Gerätesilhouette-Rand für den Einzug.
4. **Briefpapier** und ein Wachssiegel als Variante zum bestehenden `paper-v2.webp`.
5. **Optionale Ambient-Sounds je Preset** (OGG/MP3, 20–60 s, loopfähig, leise abgemischt): Herzschlag oder Atmen (Bedrohung), Wasser oder Glocken (Traum), Rauschen oder Plattenknistern (Echo), Faxgeräusch (Fax). Sie können heute schon pro Vision über die Galerie gewählt werden.

## 8. Empfohlene nächste Verbesserungen

1. Layouts Telegramm, digital/Messenger, Pager und verschlüsselt (mit Entschlüsselungs-Moment).
2. Intensitätsregler pro Vision (sanft / normal / heftig) zusätzlich zum Preset.
3. Bildplatzierung im Editor: Position, Größe und Reihenfolge der Erscheinungen selbst festlegen.
4. Galerie-Löschschutz: vor dem Löschen anzeigen, welche Visionen oder Botschaften die Datei nutzen.
5. Ein Push-Kanal (z. B. Durable Object oder WebSocket) statt Polling für sofortiges Erscheinen.
6. Ein Archiv „Erhaltene Botschaften“ für Spieler zum späteren Nachlesen (bewusst nicht Teil dieses Auftrags).
7. Aufnahme von `tests/live-deliveries-integration.mjs` in die CI über einen `--regie`-Schritt.

## 9. Release und Nachbesserung (03.11.2026)

### Release 1

| | |
| --- | --- |
| Live-Codecommit | `96c22b2`, identisch mit `main` |
| Inhalt | dieser Stand plus der bereits live laufende Codex-Branch `codex/live-table-map-release` (`95ddc4b`) |
| Worker-Version | `e9d7f9bb-44c4-496b-9442-ffb6caff2705`, Tag `96c22b2-Visionen` |
| Zeitpunkt | 11:15 UTC |
| Migration | keine |

### Nachbesserung auf SL-Wunsch (Branch `claude/visionen-galerie`)

- **Eigene Galerieabschnitte „Visionen“ und „Botschaften“:**
  - Bilder und Töne, die direkt an einer Vision oder Botschaft hochgeladen werden, landen getrennt von der allgemeinen Galerie.
  - Sie sind immer SL-intern, nur Bilder und Töne sind erlaubt, und nur die SL darf hochladen.
  - Der Abschnitt steht im Speicherpfad (`users/<id>/<abschnitt>/<datei>`). Es gibt keine Migration.
  - Die Galerie hat für die SL Filter „Allgemein / Visionen / Botschaften“. Lädt man bei aktivem Filter hoch, landet die Datei im jeweiligen Abschnitt.
- **Editor entschlackt:**
  - Im Text von Visionen und Botschaften gibt es keine allgemeine Galerie und keinen Schalter „Weitere Formatierung“ mehr.
  - Unten liegt die eigene Bildergalerie des Abschnitts mit Upload und Auswahl per Klick.
  - Früher verknüpfte Bilder aus der allgemeinen Galerie bleiben erhalten und sind gekennzeichnet.
- **Töne:**
  - Visionen bekommen eigene Töne per Upload.
  - Botschaften haben ein eingebautes Ankunftsgeräusch: ein typisches Faxgeräusch (Anwahlton, Antwortton, Modem-Zwitschern, Rauschen, Drucker) bzw. Briefrascheln (Hereingleiten, Knistern, Aufsetzen).
  - Beide werden per Web Audio erzeugt, ohne Audiodateien und ohne Lizenzfrage.
  - Alternativ „Kein Geräusch“ oder ein eigener Ton.
  - „Anhören“ im Editor.
  - Blockiert der Browser den Ton, erscheint beim Spieler „Geräusch abspielen“.
- **Tempo:**
  - Die Grundlesezeit ist kürzer: etwa 7 statt 10 Sekunden für 100 Zeichen.
  - Neu ist ein Tempo pro Vision: Ruhig / Normal / Zügig.
  - „Weiter ›“ ist deutlicher und leuchtet beim ersten Text kurz auf.
  - Der Doppelklick-Schutz ist von 1,2 s auf 0,5 s verkürzt.

### Prüfungen der Nachbesserung

| Prüfung | Ergebnis |
| --- | --- |
| Unit-Tests | 359/359 |
| Integration Visionen | 38/38, u. a. Abschnitts-Upload, Spieler-Sperre, falsche Dateitypen, Tempo und Geräusch beim Spieler |
| Browser | 19 Schritte bestanden, darunter Editor-Upload, Tempo, Weiter-Hinweis und Fax-Ton (im Browser tatsächlich abgespielt) |
| Alte Visions- und Brief-Prüfungen | bestanden |
| Volle Integration | 2046 + 46 |
| Story-Editor-Browserprüfungen | bestanden |
| Typprüfung, Lint | sauber |

## 10. Nachbesserung Live-Regie (Branch `claude/regie-spontan`)

### Eingebaut, in die bestehende Architektur und ohne Parallelmodul

**1. Spontan erstellen**
- Im Regie-Pult stehen „Neue Vision“ und „Neue Botschaft“. Sie öffnen einen kompakten Editor mit:
  - Titel (intern) und Empfängern (ganze Gruppe oder Auswahl);
  - Visionstyp und Tempo bzw. Fax/Brief, Absender und Geräusch;
  - Text sowie Bildern und Tönen aus den eigenen Galerien.
- Knöpfe: „Vorschau auf meinem Tisch“, „Jetzt ausspielen/zustellen“, optional „In dieser Szene speichern“ und „Nur speichern“.
- Server:
  - Neuer Befehl `compose` im bestehenden `/api/live-deliveries`: dieselbe Prüfung (`sceneWhisperSchema`), dieselbe Lauf-Erzeugung und dieselben Quittungen wie bei vorbereiteten Inhalten.
  - `save` legt den Eintrag vorher in der Szene ab, per ID ersetzt, damit nie doppelt.
  - Wiederholte Anfragen mit derselben `requestId` stellen nichts doppelt zu.
  - Neuer Befehl `save-entry`: Bearbeiten und Speichern aus der Regie. Er liest die Szene frisch und ersetzt nur diesen Eintrag. Die Antwort enthält die neue Szenenversion, mit der das Pult weiterarbeitet.
- Nicht gespeicherte spontane Inhalte erscheinen unter „Spontan ausgespielt“, nur für die aktuelle Szene. Von dort lassen sie sich erneut senden oder nachträglich speichern.

**2. Einklappen**
- Jeder Eintrag ist eine Zeile mit Titel, Typ und Zustellstatus, z. B. „12:41 · sieht es gerade 1 · bestätigt 1“.
- Aufgeklappt gibt es Empfängerwahl, Vorschau, Auslösen, „Bearbeiten“ (der Kompakt-Editor direkt im Eintrag) und die letzten Zustellungen mit „erneut“ und „Zurückziehen“.
- Nach dem Auslösen klappt der Eintrag automatisch zu.

**3. Vorschau auf dem SL-Tisch**
- Die Regie übergibt den Inhalt per `BroadcastChannel` des eigenen Browsers an den offenen Spieltisch der SL (`TablePreview`, nur bei `a.gm`).
- Der Tisch spielt ihn mit exakt der Spielerdarstellung ab, inklusive Hineinziehen, Animation und Ton, über dem unveränderten Tischzustand.
- Kein Serveraufruf, also keine Zustellung, keine Quittung und kein Spielereignis. Beliebig oft wiederholbar.
- Ist kein Tisch offen, läuft die Vorschau wie bisher in der Regie, mit Hinweis.

**Nebenbei behobener Fehler aus der ersten Lieferung:** `DeliveryStage` und `PersonalDeliveryReader` hatten im Tisch denselben React-Key. Das ging zufällig gut, führte aber nach einer kleinen Umstellung dazu, dass sich Visionsfenster bei jeder Abfrage verdoppelten. Jetzt hat `DeliveryStage` einen eigenen Key, und es entsteht nachweislich nur ein Fenster.

### Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| Unit-Tests | 359/359 |
| Integration Visionen | 47/47. Neu: spontanes Fax nur an B (Doppelklick, ohne Szenenänderung), spontane Vision an die Gruppe mit Speichern (genau ein Eintrag, genau eine Zustellung), Bearbeiten aus der Regie samt neuer Version, Spieler-Sperre, ungültige Inhalte |
| Browser (SL-Regie, SL-Tisch, Spieler A und B) | 24 Schritte bestanden (Details unten) |
| Alte Visions- und Brief-Prüfungen | bestanden |
| Volle Integration | 2046 + 46 |
| Story-Editor-Browserprüfungen | bestanden |
| Typprüfung, Lint | sauber |

Abgedeckt in der Browserprüfung:
- Einträge starten eingeklappt und klappen nach dem Auslösen zu.
- Wieder aufgeklappt zeigen sie Quittungen und „Bearbeiten“.
- Ein spontanes Fax geht nur an B, auch beim Doppelklick genau einmal.
- Eine spontane Vision geht an die ganze Gruppe und bleibt gespeichert.
- Die Vorschau erscheint nur auf dem SL-Tisch, ist wiederholbar, A und B sehen nichts, und es entsteht keine Zustellung.
- Keine Seitenfehler.

**Prüfgrenze:** Die Tisch-Vorschau braucht Regie und Spieltisch im selben Browser, was der übliche Aufbau mit dem zweiten Fenster ist. Auf einem anderen Gerät läuft sie stattdessen in der Regie.

## 11. Ausdrücklich nicht getan

- Kein Deployment, keine Migration, keine Schreibzugriffe auf Produktion (D1/R2).
- Keine Änderung an bestehenden Kampagnendaten oder Rechten.
- Keine Tests gelöscht. Die 4 NPC-Altfehler sind gemeldet, nicht verändert.
- Screenshots aus `artifacts/live-deliveries/` und `.local-work/` sind nicht versioniert.
