# W10 v1.1 – lokale UX- und Regelabnahme

Stand: 27.10.2026. **W10 v1.1 lokal abnahmebereit: JA.** Persönliche UX-/Regelabnahme steht aus. Keine Produktivfreigabe.

## Arbeitsstand und Schutz

- Isolierter Worktree: `work/spieltisch-2-prototyp`, Branch `codex/spieltisch-2-prototyp`.
- Unveränderter Ausgangscommit: `d33f4162a7d0d1a1544cbded2c2e2c6b348d6c1b`. Kein neuer Commit, Push, Merge oder Deployment.
- Der ursprüngliche Checkout `cvk-m1-kernmodell` ist weiterhin sauber auf diesem Commit. Laufende fremde Server wurden nicht angefasst.
- Vorher-Sicherung: `.local-work/spieltisch-2/before-w10-v1.1-20261027-c2b5035f.zip` einschließlich bisheriger uncommitteter Prototypänderungen.
- Der persönliche lokale Bühnenstand `state.json` ist bytegleich zur Vorher-Sicherung, SHA-256 `d600320be77877ce727bfeccc6f34862accf89354e044623f413d191beee553c`.
- Einstieg: <http://127.0.0.1:8812/?w10=1.1>. Ausschließlich synthetische Rollen und Inhalte, keine D1-/R2-Bindings.

## Phase A: Zufall und V20

Das vorhandene Werkzeug verwendete bereits `crypto.getRandomValues` und Rejection Sampling. Es gab keinen gefundenen Mechanismus für garantierte Erfolge. Die vorherige Schwellenanzeige war allerdings nur eine Rohwertauswertung.

Diese Zufallsquelle wird in `domain/w10.ts` weiterverwendet: Pro Würfel ein unabhängiges 32-Bit-Wort; nur die sechs Werte ab 4.294.967.290 werden verworfen. Der verbleibende Bereich ist genau durch zehn teilbar. `% 10 + 1` ist damit unverzerrt. Es gibt keine Ergebnisverbesserung, erfolgsabhängige Wiederholung oder Ersatzquelle. Eine defekte Zufallsquelle bricht den Wurf ab.

Normale V20-Proben werden separat ausgewertet: Einsen heben jeweils einen Erfolg auf. Mindestens ein verbleibender Erfolg bedeutet Erfolg. Ohne ursprünglichen Erfolg und mit mindestens einer Eins entsteht ein Patzer. Sobald ursprünglich ein Erfolg gewürfelt wurde, sind vollständig aufgehobene Erfolge ein Fehlschlag, auch bei überschüssigen Einsen. Ohne Erfolg und ohne Eins ebenfalls Fehlschlag. Zehnen zählen normal einmal; Spezial-, Willenskraft-, Schadens-, Absorptions- und Hausregeln sind ausgeschlossen.

**Primärquelle geprüft:** [V20-Grundregelwerk im privaten Quellarchiv](https://drive.google.com/file/d/1myQ_5Nb6SrfCNZq55v7xb7EgKNxneyEu/view), gedruckte Seite 250, PDF-Seite 267. Die vorhandene aufbereitete Quellenlabel-Angabe 266 bezeichnet nicht die gedruckte Seite; deren Korrektur gehört nicht zu diesem Auftrag. Eine widersprechende Projektzusammenfassung `1jhTf3jXFn51gKvsR2kaOlMZuur4-FiL8jc8gn2o1rJA` wurde ausdrücklich nicht als Hausregel übernommen oder verändert.

Das persönliche Ergebnisprotokoll zeigt tatsächliche Werte in Originalreihenfolge, Schwierigkeit, Zeit, ursprüngliche Erfolge, Einsen, aufgehobene Erfolge und Nettoerfolge. Das Ändern der nächsten Schwierigkeit verändert keine alten Ergebnisse. Bis zu 25 Würfe pro simulierter Rolle bleiben beim Schließen/Öffnen des Werkzeugs erhalten; ein Seitenreload leert dieses flüchtige Protokoll. Es ist kein neues produktives Journal.

## Phase B: Bühnenwurf und achteckige Schale

Die zunächst getestete untere Würfelbox wurde auf ausdrücklichen UX-Wunsch ersetzt. Der Wurf liegt direkt in `transient_fx` über der gesamten Spielbühne. Der Eingabedrawer schließt beim Würfeln. Die W10 fliegen von wechselnden Seiten in eine mittige achteckige Würfelschale mit violettem Stoff, dunklem Außenrand und Nähten, angelehnt an das nachgereichte Schalenfoto. Material-/Formreferenzen bleiben privat gesichert; es gibt keine Skin-Verwaltung.

Die bestehende D10-Geometrie wird weiterverwendet, ergänzt um kleine Kantenfasen und rauchig-schwarzes Material mit roten Ziffern. `three@0.186.1` rendert die Szene; `@dimforge/rapier3d-compat@0.21.0` simuliert reale Starrkörper, Flug, Rotation, Boden-, Rand- und Würfelkontakte bei festem Zeitschritt. Kollisionskörper enthalten ausschließlich die Schale und Würfel, niemals NPCs, Notizen, Dokumente oder Whiteboard. Große Pools werden innerhalb desselben Wurfs zeitlich leicht versetzt freigesetzt, damit keine überlappenden Startkörper künstlich auseinander explodieren.

**Ergebnis und Bewegung bleiben getrennt:** Die Physik erhält nur Anzahl und einen separaten Bewegungsseed, keine Würfelwerte und keine Schwierigkeit. Genau ein ergebnisunabhängiger Simulationsdurchlauf wird vorbereitet. Eine Symmetriedrehung der kompletten nummerierten Hülle wird vor dem ersten sichtbaren Frame festgelegt und bleibt über den gesamten Wurf konstant. Es gibt kein nachträgliches Austauschen von Ziffern, Drehen der Endlage oder ergebnisabhängiges Neusimulieren. Die endgültige sichtbare obere Fläche wird zusätzlich mit dem Originalwert verglichen. Bei instabiler/uneindeutiger Lage oder einem Darstellungsfehler bleibt ausschließlich die unveränderte statische Ergebnisausgabe; es wird nicht erneut gewürfelt.

Escape und „Sofort zeigen“ funktionieren einschließlich Rückfokus. Reduzierte Bewegung und der bestehende lokale Fallback-Testpfad verwenden eine statische achteckige Ausgabe. Die Fläche fängt keine Bühneninteraktionen ab; nur ihre eigenen Bedienelemente reagieren auf Pointer. Nach dem Ausrollen endet die RAF-Schleife. Die Schale wird nach acht Sekunden abgeräumt oder sofort per Schließen/Escape entfernt; Ergebnisse bleiben im persönlichen Protokoll. Hintergrundwechsel/Skip/Schließen brechen die Vorbereitung ab und geben GPU-/Physikressourcen frei.

Gewählte Variante: transparente Bühnenebene plus räumliche zentrale Schale. Die verworfene Variante „unteres separates Würfelfenster“ entsprach nicht der gewünschten Inszenierung.

## Geänderte Dateien dieser Etappe

- `domain/w10.ts`: unverzerrte W10-Quelle, reine normale V20-Auswertung, unveränderliche Protokolleinträge.
- `app/spielbereich/modules/dice.tsx`: bestehendes Werkzeug weiterverwendet; normale V20-Auswertung und Protokoll nur über optionalen Modus. Bestehende Aufrufer behalten standardmäßig Rohwurfverhalten und gemeinsamen API-Pfad.
- `prototypes/spieltisch-2/main.tsx`, `dice-effect.tsx`, `stage.module.css`: lokale Integration, Bühneneffekt, Protokoll und Bedienung.
- `dice-geometry.mjs`, `dice-physics.mjs`, `dice-tray.mjs`, `dice-webgl.mjs`: vorhandene Form, separate Bewegung, gemeinsame physische/renderbare Schale und Renderer.
- `w10-rules.test.mjs`, `dice-physics.test.mjs`: neue Regel-/Physiktests; vorhandene Geometrietests weiterhin grün.
- `server.mjs`: lokale Lazy-Chunks, exakt erlaubte Build-Dateien, ausschließlich zusätzlich `wasm-unsafe-eval` für Rapier; kein gewöhnliches `unsafe-eval`. Keine produktive CSP-Änderung.
- Eigene `package.json`, `pnpm-lock.yaml`, `.gitignore` ausschließlich im Prototyp. Root-Paketdateien unverändert.
- Dieser Abnahmebericht. Vorherige Etappenberichte bleiben als historische Nachweise erhalten.

## Verifikation

| Prüfung | Tatsächliches Ergebnis |
|---|---|
| Automatisierte relevante Regressionen | **91/91 bestanden**, keine ausgelassenen Tests. Whiteboard, Live-Table/-Game, Charaktere, Inventar, Command Workspace, Szenen, Ortsbibliothek, Bühnen-/Sticky-Zustand und Würfel. |
| Regeltests | Alle Ergebnisklassen, mehrere Einsen, völlig erfolglose Würfe, aufgehobene Erfolge, Buchbeispiele, 1.000 vollständige Drei-Würfel-Kombinationen, Sampling-Grenzen, unveränderliche Protokolle und Fehlerquelle. |
| Physik/Geometrie | 1/5/30 Würfel, tatsächliche Kontakte, variable und reproduzierbare Bewegungsseeds, Form-/Quaternion-Abgleich für alle zehn Werte, Abbruch und Freigabe, Start außerhalb/Ende innerhalb aller acht Schalenwände. |
| Zusätzlicher Physikaudit | **60/60 Würfe** (20 Bewegungsseeds je Poolgröße) stabil innerhalb der Schale, keine uneindeutigen Endflächen. Alle zehn möglichen Beschriftungswerte je Endlage verifiziert. |
| TypeScript / lokaler Build | Prototyp-Typecheck und esbuild erfolgreich. Kein produktiver Build oder Deployment ausgeführt. |
| HTTP-Regression | **20 Bühnen- und 26 Sticky-Prüfungen bestanden**, ausschließlich separate QA-Instanz 8814. Danach beendet. |
| Chunk-/Pfadprüfung | **7 Prüfungen bestanden**: exakte Build-Chunks, WASM-CSP, private/source/produktive Pfade nicht ausgeliefert, fremder Origin abgelehnt ohne Zustandsänderung. |
| Browser | IAB, tatsächlich 1920×1080 und 960×540 sowie Standardfenster. 5 und 30 Würfel in neuer Schale ohne Fallback, sichtbare Endwerte gleich protokollierten Werten; unterschiedliche Flugrichtungen/Bewegungen und Kontakte. |
| Bedienung / Fallback | Überspringen unveränderte Werte/kein Canvas, Escape entfernt Effekt und fokussiert Würfel-HUD. Reduzierte Bewegung und Canvas-off statisch. Protokoll nach Drawer-Wechsel erhalten, ursprüngliche Schwierigkeit trotz neuer Eingabe unverändert. |
| Rollen / Erhalt | Simulierter Spieler B sieht weder die private A-Notiz noch das SL-Wurfprotokoll; SL sieht private A-Notiz. Vorhandene Zustandsdatei exakt unverändert. Keine reale Konten-/Mehrspielerprüfung behauptet. |
| Konsole | Keine Fehler im geprüften Browser. Ein anfänglicher GPU-Shader-Präzisionshinweis war nicht fatal; kein WebGL-Fallback beim normalen Wurf. |

Private Nachweise: `.local-work/spieltisch-2/evidence/w10-v1.1/` mit Testausgabe, HTTP-Nachweisen, 60-Wurf-Audit, Browserdaten, Screenshot und Umfangs-/Hashprotokoll.

**Gemessene lokale Werte, keine Internet-/FPS-Garantie:** Audit maximal 100,7 ms reine Physikvorbereitung, längste Bewegung 5,1 Sekunden. Im Browser neuer Full-HD-Maximalwurf: 139 ms Vorbereitung, 116 Würfelkontakte zwischen 58 Paaren, 4,92 Sekunden Bewegung. Initiales JS 262.163 Bytes plus gemeinsamer Chunk 3.825 Bytes, CSS 21.402 Bytes; die 4.899.727 Bytes umfassende Three/Rapier/WASM-Darstellung lädt erst beim ersten animierten Wurf. Übertragungszeit im Internet und ältere GPUs sind hier nicht nachgewiesen. Native 200%-Browserzoom- und Smartphoneabnahme sind nicht erfolgt; 960×540 ist ausdrücklich ein kleinerer CSS-Viewport.

## Persönliche Abnahme und Grenzen

HUD „Würfel“ öffnen → Pool/Schwierigkeit → Würfeln → Flug über Bühne und Ruhe in mittiger Schale ansehen → Escape oder Schließen → Protokoll erneut öffnen. Normale Fehlschläge und Patzer sind möglich; es gibt keinen Demo-Erfolgspfad.

Nur lokale persönliche Darstellung, noch keine produktive serverseitige Wurfautorität oder Zustellung an Mitspieler. Reale Rollen, Kampagnen, Konten und Live-Synchronisierung wurden nicht angebunden oder verändert. Die lokale Rollenwahl ist keine produktive Zugriffssicherheitsabnahme.

**STOPP zur persönlichen UX- und Regelabnahme. Kein Live-Push und keine weitere Hauptbaustelle.**
