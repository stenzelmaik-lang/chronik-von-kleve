# Spieltisch 2.0 – Etappe 1 zur persönlichen UX-Abnahme

Stand: 26.10.2026. Ausschließlich lokaler Prototyp, kein Release Candidate für Produktion.

## Ziel und Arbeitsbaumschutz

Ein bedienbarer Full-HD-Spieltisch mit großer Bühne, schmalem Edge-HUD, Szenenwechsel, verschiebbarem NPC, positionierbarem Dokument, persönlicher Lesefassung und überlagernden Werkzeugen.

- Verifizierter Ausgang: `d33f4162a7d0d1a1544cbded2c2e2c6b348d6c1b`, Branch `codex/m1-kernmodell`, sauber.
- Separate Arbeitskopie: `work/spieltisch-2-prototyp` unter dem Arbeitsverzeichnis dieses Chats.
- Prototypbranch: `codex/spieltisch-2-prototyp`, HEAD weiterhin der Ausgangscommit. Neue Prototypdateien sind zur Abnahme absichtlich noch nicht committet.
- Kein Push, Merge, Deployment, Cloudflare-Aufruf, D1-/R2-Binding, Datenbankimport oder Zugriff auf echte Konten/Sitzungen.
- Vorhandene App-/Domain-Dateien wurden nicht bearbeitet. Der Prototyp importiert passende Bestandsteile unverändert.

## Installierter Skill

`chroniplay-experience-design` 2.0 ist unter `.agents/skills/chroniplay-experience-design/` installiert. `SKILL.md`, Installationsanleitung und sämtliche Referenzen 01–09 sind vorhanden und gelesen.

Quelle: [vollständiger Drive-Ordner v2.0](https://drive.google.com/drive/folders/1GcMxn7LmtcanBgjW6IjLe1EtlEglyazX). Der erreichbare Drive-Bestand enthält die entpackten Markdown-Dateien, keine ZIP-Datei. Er wurde vollständig übernommen; ein lokales ZIP mit dem Ordner `chroniplay-experience-design/` wurde daraus zusätzlich erzeugt. Es wird nicht als heruntergeladenes Original-ZIP ausgegeben. `.agents` und private Testbestände bleiben ignoriert.

## Bestandsaufnahme und Integrationsentscheidung

| Baustein | Verifizierter Bestand | Entscheidung für Etappe 1 |
|---|---|---|
| Spieltisch/Shell | `app/spielbereich/workspace.tsx`, `modules/shell.tsx`; bislang breite Navigation und einzelne Arbeitsflächen | Isolierte neue UI-Komposition, keine Änderung der bestehenden Routes |
| Sitzung und Regie | `modules/live-session.tsx`, `session.tsx`, `command-player-session.tsx`, `/api/live-table` | Keine echte Sitzung starten; gemeinsame Bühne nur als synthetischer Speicher im lokalen Prozess |
| Szenen | `session-stage.tsx`, `story-scene-manager.tsx`, `server/live-commands.ts`, `domain/live-game.ts` | Bestehende Motive verwenden; kein zweites persistentes Szenenmodell und keine neue Engine |
| Orte und Karte | `world-experience.tsx`, `world-maplibre.tsx`, `/api/locations`; MapLibre vorhanden | Keine Location-/Discovery-Freigaben ändern; schematische Bestandskarte als persönliche Demoansicht |
| NPC | `npc-dossier.tsx`, `npc-profile.ts`, `/api/entities/npc`; getrennte Primär-/Sekundärbilder | Vorhandenes freigestelltes Schäfer-Bild lokal als reine Bildreferenz; keine Entity anlegen/übernehmen |
| Dokumente | `live-pdf.tsx`, geschützte Medienpfade und Dateien vorhanden | Klar synthetisches einseitiges Handout; kein neuer PDF-Reader und kein Import echter Dokumente |
| Whiteboard | `board-editor.tsx`, `domain/board-editor.ts`, `domain/live-table.ts` | Unveränderter Editor und bestehende Operationen; transparente Einbettung nur im lokalen Prototyp |
| Würfel | `dice.tsx` bietet W10-Rohwürfe | Bestehendes Werkzeug lokal wiederverwenden; kein geteilter Wurf, keine neue V20-Auslegung, kein 3D |
| Charakter und Inventar | `character.tsx`, `character-detail.tsx`, `character-live-vitals.tsx`, `inventory.tsx`, `inventory/` | Kontext-Integrationspunkt; keine echten Charakterdaten, kein Inventarumbau |
| Nachrichten | `message-center.tsx`, `/api/messages`, privater Versand und Ungelesen-Anzeige vorhanden | Demo-Postfach und ausdrücklich synthetischer Zähler; kein tatsächlicher Versand |
| Rechte | `server/access.ts`, `server/live-game.ts`, Entity-/NPC-/Location-Projektionen | Bestehendes Produktionsrecht unverändert; lokale Rollen sind Simulation, kein Auth-Nachweis |

### Whiteboard-Befund

Der vorhandene Editor unterstützt Auswahl, Freihand, Text, Linien, Pfeile, Rechteck, Ellipse, Verschieben, Undo/Redo und Tastatur. `Shape` ist memoisiert. Pointerbewegungen aktualisieren eine lokale Vorschau; ein abgeschlossener Vorgang wird gesendet. Freihandpunkte werden nach 128 Punkten reduziert; die Undo-Historie ist begrenzt. Das ist bereits nutzbare Fachlogik und wurde nicht neu gebaut.

Die aktuelle Live-Einbettung prüft aktive Änderungen ungefähr alle 350–400 ms; der eigenständige `LiveTable`-Pfad verwendet 2-s-Polling, Peer-Heartbeats 10 s. Das sind Pollingpfade, kein bestätigter Pushdienst. Ein Vorgang wird über bestehende Records-/Versionspfade gespeichert. Die tatsächliche Internet-/D1-Latenz wurde hier bewusst nicht gegen Produktion gemessen und nicht als behoben ausgegeben.

Im Prototyp gibt es einen kleinen lokalen Zustandsabruf pro Sekunde mit Versionsantwort, keinen zweiten Whiteboard-Poller. Gezeichnet wird mit dem unveränderten Bestandseditor. Bei ausgeschaltetem Zeichenmodus bleiben Striche sichtbar, Werkzeuge sind inert und blockieren Bühnenobjekte nicht. Die Editorkomponente bleibt gemountet, damit bloßes Schließen des Zeichenmodus nicht ihre Undo-Historie löscht. Ein Browser-Reload beginnt eine neue persönliche Editorhistorie.

## Variante und Begründung

**A – Edge-HUD:** 56 px oben, 56 px links, überlagernde Schubladen, schwebendes Dock. Dies ist die freigegebene Variante und wird umgesetzt. Sie verbindet Wiedererkennbarkeit mit viel freier Bühne.

**B – vollständig ausgeblendetes Kino-HUD:** mehr reine Bildfläche, aber schlechterer Einstieg und höherer Erinnerungsbedarf. Nur als Alternative bewertet, nicht zusätzlich implementiert. Keine neue UX-Grundentscheidung außerhalb der Freigabe.

## Schichtgrenzen und Zustand

Die sechs logischen Schichten heißen `background`, `scene`, `stage_objects`, `annotation`, `transient_fx`, `hud`. Sie haben getrennte Render- und Eingabeaufgaben. Szene und Objekte sind keine gekoppelte austauschbare Seite.

- Bühnenpositionen sind normalisierte Rechtecke. Begrenzung verhindert verlorene Objekte; Maus- und Tastaturänderungen verwenden dieselbe Begrenzungsfunktion.
- Figuren, Dokumente und Skizzen sind in dieser ersten Simulation ausdrücklich **szenenübergreifend**. Szenenwechsel entfernt nichts automatisch.
- Ein neues Objekt ist privat. Erst „Für Runde zeigen“ ändert die simulierte gemeinsame Projektion.
- „Privat ansehen“ einer Szene verändert die gemeinsame Szene nicht.
- SL-Positionsänderungen wirken auf den simulierten gemeinsamen Stand. Spieleränderungen an Position/Größe und Lesezoom bleiben persönlich.
- Dokumentzoom/Schließen einer Lesefassung und Drawer-Zustand ändern keine gemeinsamen Objekte.
- Noch keine persistierten Bühnenfelder, echte Mehrbenutzerfreigabe oder Übertragung der Prototyp-Viewerparameter auf Produktionsrechte.

## Daten- und Assetquellen

- Kampagnenmotiv: bestehendes `public/images/chronik-von-kleve-banner.png`, tatsächlich von `app/kampagne/page.tsx` verwendet.
- Kaserne: `public/images/a26afdbc6dbae776e2b8.jpg`; Zuordnung aus `server/catalog.json`.
- Electric Taberna: `public/images/edf112ec863d6cd02b1a.jpg`; Zuordnung aus Katalog und Location-Modell.
- Schäfer: vorhandene transparente PNG aus dem ChroniPlay-Projektordner, unverändert in den ignorierten privaten Prototypbestand kopiert. Keine öffentliche neue Dateifreigabe und kein NPC-Import.
- Handout und Spielerrunde sind synthetische Demonstrationsdaten. Keine Präsenzpunkte oder echten Onlinezustände werden erfunden.

Der Server bindet nur `127.0.0.1`, erlaubt ausschließlich aufgelistete Medien und verwendet `private, no-store`. Unfreigegebene NPC-Bytes, Dokumente und private Notizen fehlen in Spielerprojektionen. Das sind **Simulationstests**; der frei wählbare Viewer ist ausdrücklich keine Produktionsauthentifizierung. Produktive Integration muss die vorhandene Actor-/Kampagnenprüfung benutzen.

## Durchgeführte Prüfungen

| Prüfung | Ergebnis / Beleg |
|---|---|
| Full HD | Tatsächlich 1920 × 1080 CSS px gemessen, DPR 1; Bühne 1864 × 1024, rund 92 % der Fläche |
| Freie Bühne | Keine permanente breite Seitenleiste; Screenshot `01-buehne-frei.jpg` |
| Szene/NPC/Dokument | Kaserne öffnen, Schäfer auflegen, per Pfeiltaste verschieben; Dokument auflegen, per Maus ziehen und Größen-Griff benutzen; Screenshot `02-kaserne-objekte.jpg` |
| Dokument lesen | Eigene modale Lesefassung, 100 → 120 %, Escape; Bühnenrechteck unverändert |
| Kontext | 392 px Overlay; Bühnenbreite bleibt 1864 px; Escape gibt Fokus an Kontext-/Szenen-Trigger zurück |
| Rollen | Separate Browseransicht Spieler A: vor Freigabe nur NPC, kein privates Handout und keine SL-Werkzeuge; nach Freigabe Handout sichtbar; private Szenenvorschau bleibt bei SL |
| Persönliche Position | Spielerposition x=24,4742 %, gemeinsamer Stand x=23,4742 %: keine gemeinsame Änderung |
| Szenenwechsel | Taberna übernimmt dieselben Objektpositionen; Skizze bleibt erhalten; Screenshot `03-taberna-skizze.jpg` |
| Whiteboard | Transparenter SVG-Untergrund, Linie per Maus, Undo → 0, Redo → 1, passiv weiterhin sichtbar; Originalbild unverändert |
| Vergrößerte UI | 960 × 540 CSS-Layout als 200-%-Entsprechung auf Full HD, keine horizontale Überbreite; tatsächlicher nativer Browserzoom durch die Steuerung nicht separat bestätigt |
| Medienfehler | Absichtliche 404: vorheriges Kampagnenbild bleibt, verständliche Fehlermeldung und „Erneut laden“ |
| Langsame Medien | Separater isolierter Fehler-/Latenzserver, absichtlich 650 ms Verzögerung; kalter HTTP-Abruf 699 ms. Warme Browser-Bildwechsel sind vorab dekodiert und kein Kaltlade-Nachweis |
| Browser-Konsole | Keine Anwendungsfehler im normalen Prototyp; absichtliche 404 im Fehlerprofil separat |
| Tests | 63 lokale Funktionsprüfungen einschließlich 5 neuer Zustands-/Projektionsprüfungen bestanden; 20 lokale HTTP-Prüfungen bestanden |
| Build/Typen | Lokaler Browserbundle-Build und TypeScript-Prüfung bestanden; kein Worker-Deployment-Build erforderlich |

Belege liegen in `.local-work/spieltisch-2/evidence/`: Screenshots, `http.json`, `regression.txt`, `typecheck.txt`, `delayed-media.json`. Die Tests verwenden ausschließlich synthetischen Arbeitsspeicherzustand.

### Performancegrenze

Beobachteter lokaler Whiteboard-Commit: 32 ms für einen einzelnen Linienvorgang. Beobachteter warmer Szenenbildwechsel: 1 ms für bereits geladene/dekodierte Bilder. Das sind einzelne lokale Messungen, keine p75-Werte, kein FPS-/INP-/LCP-Nachweis und kein Versprechen für Internetbetrieb. Der Clientbundle liegt bei ungefähr 245 KB unkomprimiert. Weitere Messwerte und Payloadgrößen stehen im HTTP-Nachweis.

## Start und verwendete Dateien

```powershell
cd '<Pfad dieses Worktrees>'
node prototypes/spieltisch-2/server.mjs
```

Öffnen: `http://127.0.0.1:8812/`. Spieleransichten: `?ansicht=a` beziehungsweise `?ansicht=b`. Ein belegter Port wird nicht freigeräumt. Der Serverzustand bleibt nur bis zum Beenden des lokalen Servers erhalten.

Der lokale Runner liest die bereits installierten React-/Esbuild-Bibliotheken des geschützten Ausgangscheckouts, schreibt seine Build-Dateien aber nur nach `.local-work/spieltisch-2/build`. Falls nötig setzt `CVK_PROTOTYPE_DEPENDENCIES` einen anderen vorhandenen `node_modules`-Pfad. Keine gemeinsame veränderliche Vite-/Worker-Laufzeit und keine Installation neuer Pakete notwendig.

Neue Dateien ausschließlich unter `prototypes/spieltisch-2/`: `main.tsx`, `stage.module.css`, `stage-state.mjs`, `server.mjs`, `types.ts`, `css.d.ts`, `tsconfig.json`, `stage.test.mjs`, `http-check.mjs`, dieser Abnahmebericht. Lokaler Skill und private Medien/Testnachweise sind ignoriert.

## Bekannte Grenzen und offene Entscheidungen

- Keine echte Anmeldung, Kampagnenzuordnung oder produktive Speicherung angebunden; Viewerrollen sind Demo-Auswahl.
- PDF-/DOCX-Handouts, reale NPC-Akten, MapLibre-Entdeckungsdaten, Charakter-/Inventar-/Nachrichtenanbindung bleiben unverändert im Bestand und sind nicht Teil dieser vertikalen Strecke.
- Whiteboard-Einbettung ist lokal. Netzwerkprotokoll, Last und Koordinatenbezug bei unterschiedlichen tatsächlichen Clientgrößen benötigen vor produktiver Integration eigene Abnahme. Bestehender 1000 × 600 Editorraum ist dokumentiert, keine Datenmigration erfolgt.
- Kein 3D-Würfeln, keine Webcam/Voice, kein Relay oder neue Echtzeitplattform. Temporäre Effektebene ist vorbereitet.
- Originalmotive von Kaserne/Taberna haben 1024 × 1024 Pixel und werden für Full HD beschnitten; keine Originale wurden überschrieben.
- Native 200-%-Browserzoom- und beide OS-Reduced-Motion-Zustände sind nicht als vollständig getestet ausgegeben; die CSS-Regel respektiert `prefers-reduced-motion`.

**Abnahmebereit für die persönliche UX-Prüfung von Etappe 1: JA.**

**Nächster einzelner Schritt: Pano prüft den lokalen Ablauf persönlich. Danach STOPP; keine weitere Etappe, kein Commit/Push/Merge oder Live-Release ohne gesonderte Freigabe.**
