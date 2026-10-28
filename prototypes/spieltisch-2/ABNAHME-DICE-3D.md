# Spieltisch 2.0 – persönliche W10-3D-Darstellung zur lokalen Abnahme

Stand: 26.10.2026. Fortsetzung der lokal abgenommenen Sticky-Notes-Etappe. Keine Produktivfreigabe.

## Ziel, Bestand und Grenze

Das bestehende W10-Werkzeug erzeugt weiterhin den Rohwurf. Eine kurz sichtbare 3D-Inszenierung übernimmt ausschließlich dessen feststehende Werte und endet mit denselben Zahlen in derselben Reihenfolge. Es werden weder Würfelwerte neu erzeugt noch Erfolg-/Patzer-/Hunger-/Hausregeln ergänzt.

`app/spielbereich/modules/dice.tsx` unterstützt bereits Pools 1–30, Schwelle 2–10, unverzerrte lokale Zufallswerte, einen optionalen gemeinsamen Wurfpfad und die Rohwertanzeige. Ergänzt wurde nur ein optionaler `onResult`-Callback mit einer Kopie der Ergebnisse. Ohne Callback bleiben die bestehenden Aufrufer unverändert. Der produktive gemeinsame Wurfpfad wird hier nicht angeschlossen oder getestet.

**Dieses Muster ist eine persönliche lokale Ergebnisdarstellung. Andere Teilnehmer erhalten daraus noch keinen Wurf-Event. Es ist keine Mehrspieler- oder Produktionsabnahme.**

## Gestaltung und technische Variante

Geprüfte Varianten: zusätzliche WebGL-/React-Three-Fiber-Laufzeit mit neuen Paketen oder ein kleiner 3D-Projektionsrenderer im bestehenden Prototyp. Für die kurze Inszenierung von höchstens 30 Würfeln wurde die zweite Variante gewählt.

- Echte zehnseitige Geometrie mit zehn kongruenten Drachenflächen, zwölf Ecken und zwanzig Kanten; keine Würfelbilder oder umbeschrifteten W6.
- Perspektivisch projizierte Körper, Flächenschattierung, warme Ziffern, Kanten und Bodenschatten; Obsidian-/Gold-Material passend zum HUD.
- Softwareprojektion in Canvas 2D. Keine neue WebGL-/Physikplattform, keine neue Abhängigkeit.
- Kontrollierte Dreh-/Wurfinszenierung des vorhandenen Ergebnisses, keine physikalische Zufallssimulation. Zahlen 6 und 9 sind unterscheidbar markiert; 10 bleibt 10.
- Vorhandener Layer `transient_fx`; keine Umstellung von Szene, NPC, Dokument oder Whiteboard.
- Ergebniswerte zusätzlich als zugängliche DOM-Liste; Skip und Schließen per Tastatur, Escape mit Rückfokus.
- Bestehender Werkzeug-Drawer bleibt daneben bedienbar. Nicht verfügbare gemeinsame Navigation wird nur im lokalen Prototyp nicht angeboten.

## Zustand und Datenfolgen

Ein eingefrorener Ergebnis-Snapshot lebt ausschließlich im lokalen UI. Er verschwindet beim Schließen beziehungsweise Betrachterwechsel. Er wird weder in D1 noch in den lokalen Bühnen-/Notizspielstand geschrieben. Ein neuer ausdrücklicher Wurf ersetzt nur die alte Darstellung.

Der Renderer läuft ungefähr 1,45 Sekunden, kann übersprungen werden und stoppt danach. Ein Resize erzeugt anschließend nur ein neues statisches Bild. Bei unsichtbarem Tab wird direkt die Endlage dargestellt. `prefers-reduced-motion` wird respektiert; bei fehlendem Canvas bleiben vollständige Zahlen und Rohwurf erhalten. Keine Audios und keine dauerhafte Animationsschleife.

Sticky Notes behalten ihre zuletzt freigegebene Regel: private Zettel sind für Ersteller und SL lesbar, andere Spieler erhalten sie nicht. Die Notiz-/Bühnen-Datei wurde vor und nach sämtlichen Würfeltests mit identischem SHA-256 geprüft.

## Arbeitsbaumschutz

- HEAD bleibt `d33f4162a7d0d1a1544cbded2c2e2c6b348d6c1b`, isolierter Branch `codex/spieltisch-2-prototyp`.
- Sicherung vor dieser Etappe: `.local-work/spieltisch-2/before-dice-3d-20261026-231711.zip` mit vorherigen Prototypdateien, ursprünglichem DicePanel und privatem Testspielstand.
- Der geschützte Checkout `cvk-m1-kernmodell` bleibt sauber auf `d33f416`.
- Kein Commit/Push/Merge/Deployment, keine Migration, kein Cloudflare-/Produktionsaufruf und keine echten Spielerdaten.

Geändert nur in dieser isolierten Arbeitskopie: `app/spielbereich/modules/dice.tsx` (optionaler Ergebnis-Callback), `prototypes/spieltisch-2/main.tsx` und `stage.module.css` (Darstellung/Bedienung).

Neu unter `prototypes/spieltisch-2/`: `dice-geometry.mjs`, `dice-effect.tsx`, `dice-geometry.test.mjs` und dieser Bericht. Bestehende Sticky-Notes-/Server-/Persistenzdateien wurden für die Würfel nicht verändert.

## Tatsächlich geprüfte Abnahme

| Prüfung | Ergebnis |
|---|---|
| Pools 1, 5, 30 im Browser | Korrekte Zahl an Körpern/Einzelergebnissen; DOM-Rohwurf und Darstellung exakt gleich und nicht sortiert |
| Alle Werte 1–10 | Automatisiert geprüft: passende Endfläche, aufrechte Ziffernachsen, korrekte Geometrie; 10 auch im Browser aufgetreten |
| Geometrie | Geschlossener Körper, koplanare Flächen, jeweils zweimal verwendete Kanten, kongruente Drachenflächen, gegenüberliegende Zahlen summieren sich zu 11 |
| Überspringen | Laufende Animation beendet, identische Zahlen erhalten, kein neuer Rohwurf ausgelöst |
| Escape / Rückfokus | Schließt zuerst die Würfelansicht, bestehendes Werkzeug bleibt erhalten; Fokus zurück zum Würfel-HUD |
| Pool 0 | Bestehender Würfelknopf gesperrt |
| Reduzierte Bewegung | Explizites lokales Testprofil `?ansicht=a&testMotion=reduce`: sofortige statische Endlage, identische Zahlen, kein Skip nötig |
| Canvas nicht verfügbar | Explizites lokales Testprofil `?ansicht=b&testCanvas=off`: statische vollständige DOM-Ergebnisse, keine fremde private Notiz und keine Anwendungsfehler |
| Full HD | Integrierter Browser tatsächlich 1920 × 1080 CSS-Pixel; Bühne 1864 × 1024; Würfelfläche 1120 × 380 neben dem Drawer |
| Kleinere Fläche | Tatsächlich 960 × 540; Würfelfläche 526 × 369 vollständig innerhalb der Bühne; Schließen sichtbar und erreichbar |
| Leerlauf | Nach abgeschlossener Full-HD-Animation blieb der Zähler während der anschließenden Tests bei 90 → 90; kein Weiterrechnen ohne Resize |
| Regression | **78 Tests, 0 Fehler**, einschließlich bisheriger Bühnen-, Whiteboard-, Notiz-, Charakter-, Inventar-, Szenen- und Sichtbarkeitsprüfungen |
| Typen / Build | TypeScript und lokaler Browserbundle-Build bestanden |
| Teststand | Gespeicherte Bühnen-/Notizdatei vor und nach den Browserwürfen SHA-256-identisch |

Belege unter `.local-work/spieltisch-2/evidence/dice-3d/`: `regression.txt`, `typecheck.txt`, `browser.json`, `fullhd.json`, `state-before.json`, `state-after.json` und Screenshots `01-five-dice`, `03-reduced-motion`, `04-no-canvas`, `05-fullhd`, `06-small-layout`.

Messgrenze: Die 90 Frames sind ein einzelner lokaler Full-HD-Durchlauf, keine p75-/FPS-/INP-/GPU-Lastabnahme. Brave und der integrierte Browser wurden verwendet. Reduzierte Bewegung und Canvas-Ausfall wurden als Testprofile geprüft; kein tatsächlicher Betriebssystemwechsel, GPU-Ausfall oder nativer 200-%-Zoom wird behauptet. Der Bundle umfasst 262379 Byte unkomprimiert. Keine Performanceaussage für echten Netzwerk-/Mehrspielerbetrieb.

## Persönliche Abnahme

Öffnen: `http://127.0.0.1:8812/` → unten Würfel → Anzahl/Schwelle → Würfeln. Die Ansicht und das Ergebnis bleiben persönlich. Der bekannte Startbefehl bleibt `node prototypes/spieltisch-2/server.mjs` aus diesem Worktree.

**Persönliche lokale W10-3D-Etappe abnahmebereit: JA.**

Nächster einzelner Schritt: Pano beurteilt die Würfelform, Bewegung und Lesbarkeit im Prototyp. Gemäß installiertem `chroniplay-experience-design` v2.0, Abschnitt 5.7: „STOPP zur persönlichen Abnahme.“ Keine weitere Etappe oder Live-Veröffentlichung begonnen.
