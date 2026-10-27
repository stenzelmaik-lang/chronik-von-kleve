# W10 v1.2 – lokaler Entwicklungs- und Prüfstand

27.10.2026 · **W10 v1.2 zur persönlichen UX-Abnahme bereit: JA.** Keine persönliche UX-Freigabe und keine Produktivfreigabe vorweggenommen.

Die ausstehenden Browserfälle wurden am 27.10.2026 am unveränderten v1.2-Stand geprüft. Screenshots und DOM-Nachweise wurden gespeichert. Der native Windows-Zoomzugang scheitert weiterhin an der sicheren Erkennung der Browseradresse; der Projektleiter hat deshalb den 125%-Zoom kontrolliert manuell geprüft und vollständige Sichtbarkeit/Bedienbarkeit bestätigt. Fenstergrößen sind unabhängig davon tatsächlich gemessen, nicht als Browserzoom ausgegeben. Darstellungsgrenzen großer Pools sind unten ausdrücklich dokumentiert.

## Stand und Sicherung

- Worktree: `work/spieltisch-2-prototyp`, Branch `codex/spieltisch-2-prototyp`.
- HEAD unverändert `d33f4162a7d0d1a1544cbded2c2e2c6b348d6c1b`. Kein Commit, Push, Merge oder Deployment.
- Vorheriger Arbeitsbaum: `M app/spielbereich/modules/dice.tsx`, unversionierte `domain/w10.ts` und `prototypes/spieltisch-2/`. Diese v1.1-Arbeiten wurden vor Änderungen vollständig gesichert.
- Sicherung: `.local-work/spieltisch-2/before-w10-v1.2-20261027.zip`, SHA-256 `289a4733fa242da5fb0daa6a3b992795d5a6ff6c13b5e9b4449422feef56b180`.
- Originaler Bühnenstand bleibt bytegleich: `.local-work/spieltisch-2/state.json`, SHA-256 `d600320be77877ce727bfeccc6f34862accf89354e044623f413d191beee553c`.
- Eigene v1.2-Instanz: **8816**, eigene Zustandskopie `state-8816.json`, eigener Build `build-v1.2`. Die bestehende 8812-Instanz und ihr Build bleiben getrennt.
- Separate, disponible HTTP-QA: 8818. Keine D1/R2-Bindings, Migrationen, echten Konten oder Produktionsdaten.

Übergabe vollständig gelesen: [START-HIER und Spezifikation in Drive](https://drive.google.com/drive/folders/1ugKq4DQOFuz2FBGBUE_PEub3TnSwfjj3). Originalpaket und Bildreferenzen liegen privat unter `.local-work/spieltisch-2/w10-v1.2-handoff/`. Das Referenzlogo wurde nicht in die Schale oder das Bühnenbild kopiert.

## Änderungen und Bestandsreuse

v1.1 war eine persönliche Browserdarstellung mit separatem Ergebnisprotokoll, einem Acht-Sekunden-Schließtimer und einer Blur-Demotion zur statischen Ausgabe. Die Bühne nutzte bereits versionierte lokale Server-Snapshots mit Polling. Der vorhandene produktive Live-Event-Pfad besitzt ebenfalls stabile Ereignis-IDs, Werfer, Zeit, Sitzung und Rohwürfe, benötigt aber echte Authentifizierung und Datenbankzugriffe; er wurde hier nicht produktiv eingebunden.

v1.2 verwendet dieselbe Bühnenprojektion, denselben lokalen Server, denselben privaten Snapshot und das bestehende DicePanel weiter. Keine neue Realtime-Plattform oder zweite Physikengine. Eine Runde erhält ein kleines zusätzliches Würfeljournal im bestehenden lokalen Zustandsformat. Alte Zustände ohne Journal bleiben lesbar; ungültige gespeicherte Journale werden ohne stillen Datenreset abgewiesen.

- Dunkelpetrolfarbener Filz, dunkler Rand, zurückhaltende messingfarbene Nähte und hellere rote Ziffern. Die bewährte achteckige Kollisionsform bleibt erhalten; nur die Präsentationsfläche ist kleiner und adaptiv.
- Kein Timer-Close und kein Entfernen bei Blur, Szenen- oder normalen Snapshot-Updates. Ruhende Würfel bleiben sichtbar, ohne laufende Render-/Physikschleife.
- Skip fordert direkt die unveränderte physische Endlage an. Escape während der Bewegung fordert zuerst das Ergebnis an; Escape in der Endansicht schließt lokal. Schließen per X ist ausdrücklich nur lokal.
- „Für alle schließen“ ist eine getrennte, zentral auf SL beschränkte Aktion für den aktuell gewählten Roll. Andere offene Würfe und das Protokoll werden nicht gelöscht.
- Einmalige Ergebniserzeugung auf der zentralen lokalen Instanz mit **unveränderter** `domain/w10.ts`-Quelle und V20-Auswertung. Clients erhalten dieselben Ereignis-IDs, Reihenfolge, Werte, Auswertung und Bewegungsseeds. Keine erneuten Ergebniswürfe bei Empfängern, Reconnect oder Skip.
- Neue Ereignisse werden geordnet angezeigt und überschreiben einen bereits sichtbaren Wurf nicht. Der Wechsel erfolgt ausdrücklich per Button; alte Würfe bleiben im gemeinsamen Sitzungsprotokoll aufrufbar.
- Lokales Ausblenden wird pro Tab/Rolle in `sessionStorage` gespeichert und springt bei normalen Snapshots oder Reload nicht ungewollt wieder auf. Ein später beitretender Kontext erhält offene Würfe als Endbild.
- Dieselbe Übertragung wie die Bühne: Polling ungefähr einmal pro Sekunde, kein behaupteter WebSocket-Push oder framesynchroner Ausrollweg. Veraltete/duplizierte Journalrevisionen werden ignoriert; Retry-IDs und parallele neue Ereignisse sind abgesichert.

Das Journal veröffentlicht ausschließlich öffentliche Standardproben der einen synthetischen Sitzung. Keine geheimen Würfe oder neue Sichtbarkeitsmodi. 500 Einträge sind die lokale Schutzgrenze; bei Erreichen werden zusätzliche Würfe abgewiesen, niemals alte Einträge gelöscht. Wie im bestehenden Live-Pfad gilt eine Begrenzung auf 30 neue Würfe pro Minute und Werfer.

## Dateien relativ zur v1.1-Sicherung

Neu: `shared-dice.mjs`, `dice-inbox.mjs`, `use-shared-dice.ts`, `shared-dice.test.mjs`, `shared-dice-http-check.mjs`, dieser Bericht.

Angepasst innerhalb `prototypes/spieltisch-2/`: `main.tsx`, `types.ts`, `dice-effect.tsx`, `dice-tray.mjs`, `dice-webgl.mjs`, `stage.module.css`, `stage-state.mjs`, `stage-storage.mjs`, `server.mjs`.

Außerhalb des Prototypordners ausschließlich `app/spielbereich/modules/dice.tsx`: optionale Beschriftung für geteilte Würfe und optionale Wiederanzeige aus dem Protokoll. Bestehende Aufrufer behalten ihre Defaults. RNG/V20-Engine, Physik, Geometrie, Root-Paketdateien und Produktionsrouten bleiben gegenüber v1.1 unverändert.

## Tatsächlich bestandene Prüfungen

| Bereich | Nachweis |
|---|---|
| Automatisierte Regression | **103/103 Tests bestanden**, einschließlich vorhandener Würfel-/Physik-, Sticky-, Board-, Live-Game/-Table-, Charakter-, Inventar-, Szenen- und Ortsprüfungen. |
| Neue gemeinsame Würfe | 12 Tests: zentrale Erzeugung, Retry ohne Neuziehung, ID-Kollision, Manipulations-/Sitzungsabwehr, Autorität des Werfers, SL-Schließen mit Revision, Sequenz, Queue, lokale Ausblendung, Reconnect, Persistenz und Rate-Limit. |
| HTTP | **38 gemeinsame Würfelprüfungen**, zusätzlich **20 Bühnen- und 26 Sticky-Prüfungen**, alle auf 8818 bestanden. Parallele gleiche Requests ergeben genau ein Ereignis; unabhängige Spielerrequests bleiben sequenziell erhalten. |
| Typecheck / Build | TypeScript des Prototyps und lokaler esbuild erfolgreich; `git diff --check` ohne Fehler. |
| SL → Spieler A | Zwei gleichzeitig offene unabhängige UI-Kontexte im IAB, ohne Reload derselbe Roll `efc6452c-00ab-4d28-beed-02602cb5ae78`, Werte `4,3,4,9,4`, gleiche Auswertung und gleicher Seed. |
| Dauer / Last | Beide Ansichten nach **146,531 Sekunden** weiterhin offen und unverändert. Canvas-Zähler SL 182 / Spieler A 183 zu Beginn und Ende unverändert: kein fortlaufendes Rendering im Ruhezustand. |
| Lokales Schließen | Spieler A schließt, SL bleibt offen. Nach A-Reload bleibt der Wurf lokal verborgen. |
| Später Beitritt | Spieler B erhält denselben offenen Wurf; private A-Notiz fehlt in seiner Ansicht. |
| Gemeinsames Schließen | Explizite SL-Aktion entfernt den gewählten Wurf in den anderen Ansichten. Nach bewusstem Queue-Wechsel erneut für SL und A nachgewiesen. |
| Spieler → SL | A-Wurf erscheint automatisch bei SL mit Werfer A und identischen Werten `5,9,4,10,2`. |
| Queue / 1 W10 | Ein zusätzlicher SL-Wurf mit 1 W10 und Wert 10 ersetzt die sichtbare A-Probe nicht. Erst manueller Wechsel in beiden Tabs zeigt die neue Endansicht. |
| Datenintegrität | Originalzustand bytegleich. Vorbestehende Objekte, Board und Szene in der 8816-Kopie unverändert; nur vorhandene synthetische NPC-/Dokumentobjekte zur späteren visuellen Regression zusätzlich aufgelegt. Keine echten Entities angelegt oder geändert. |

## Abgeschlossene Browser-Restabnahme vom 27.10.2026

Die vorhandenen 103 Tests, 84 HTTP-Prüfungen, der Typecheck und Build wurden in dieser reinen Restabnahme **nicht erneut ausgeführt**. Quellcode und Architektur wurden nicht geändert. Alle Implementierungsdateien stimmen bytegleich mit der vor Beginn vorhandenen v1.2-Sicherung überein. Nur dieser Bericht und private Prüfnachweise wurden ergänzt; neue synthetische Würfe bleiben im vorhandenen lokalen Journal.

| Auftragspunkt | Ergebnis und Beleg |
|---|---|
| 1. Zoom / Fenster | **Erfüllt.** Tatsächlich gemessene CSS-Viewports: SL 1920×1080, Spieler 1280×720 und 960×540, DPR jeweils 1. Ein offener Wurf behält dabei ID und Werte. Kein horizontaler Seitenüberlauf, Zahlenleiste und Schließen-Schaltflächen im Sichtbereich. **125% echter Browserzoom: vom Projektleiter manuell bestätigt**, nicht automatisch gemessen. Bilder `08-window-1280x720.jpg`, `08-window-960x540.jpg`. |
| 2. Große Pools / Lesbarkeit | **Technisch erfüllt, Darstellungsgrenze dokumentiert.** 10, 20 und 30 W10 auf der Bühne geprüft, 30 W10 zusätzlich während des Rollens gesichert. Alle Werte und die Auswertung sind vollständig in der Ergebnisleiste lesbar und stimmen mit der 3D-Endwerteprüfung überein. Körper können sich aus der Kameraperspektive teilweise überdecken; kleine 3D-Ziffern sind besonders bei engem Fenster nicht durchgehend einzeln ablesbar. Bilder `01-30-rolling-fullhd.jpg`, `02-30-settled-sl-fullhd.jpg`, `03-30-settled-player-fullhd.jpg` (Spieler tatsächlich 1280×720), `05-pool-10-fullhd.jpg`, `06-pool-20-rolling.jpg`, `07-pool-20-settled-fullhd.jpg`. |
| 3. Fallback / reduzierte Bewegung | **Erfüllt über vorhandene Testprofile.** Ein neuer Spieler-A-Wurf kam gleichzeitig in normaler, reduzierter und statischer Ansicht an. `testMotion=reduce` zeigt eine ruhende 3D-Endlage mit Hinweis; `testCanvas=off` zeigt die statische Schale, **0 Canvas-Elemente**, gleiche ID/Werte/Auswertung. Beide bleiben offen und reagieren auf den SL-Schließbefehl. Bilder `09-reduced-motion.jpg`, `10-static-fallback.jpg`. Keine echte Grafikkartenstörung und keine Änderung der globalen OS-Einstellung behauptet. |
| 4. Gemeinsame Sichtbarkeit | **Erfüllt für die lokale Simulation.** Separate SL-/Spieler-Tabs zeigen denselben neuen 30er-Wurf `40cdbb79-18c4-4d5d-a778-7681f715b29c`, gleiche Reihenfolge, Seed und Auswertung: 10 Roherfolge, 3 aufgehoben, 7 Nettoerfolge. Dasselbe für 10/20 W10 und einen Spieler-A-Wurf. Reale Logins wurden nicht verwendet. |
| 5. Manuelles Schließen | **Erfüllt.** Spieler A schließt nur seine Ansicht, SL bleibt offen. A-Reload öffnet den bewusst verborgenen Wurf nicht erneut. „Für alle schließen“ entfernt den gewählten Roll bei den anderen Teilnehmern einschließlich Fallback-/Reduced-Motion-Kontexten. Escape während Bewegung überspringt zur Endlage ohne Schließen; zweites Escape schließt nur die eigene Ansicht. Auch der Skip-Button am Einzelwurf zeigt die offene 3D-Endlage, identisch zum Spielerergebnis. `11-single-die-skip.jpg`, JSON-Nachweise. |
| 6. Wiederverbinden | **Erfüllt.** Später beitretender Spieler B und dessen Reload erhalten denselben offenen 30er-Wurf als Endbild ohne Neuziehung. Bewusst lokal ausgeblendete Ansicht bleibt verborgen. Private A-Notiz fehlt bei B. `04-reconnect-player-b.jpg`. |

### Nachweise

Private Ablage: `.local-work/spieltisch-2/evidence/w10-v1.2/restabnahme-20261027/`.

- `browser-results.json`: gemessene Viewports, Roll-IDs, Wertefolgen, Auswertungen, Renderzustände und Buttonpositionen für die geprüften Abläufe.
- `console-errors.json`: keine Fehler in den geprüften SL-/Spieler-Konsolen.
- `acceptance-integrity.json`: unveränderter Implementierungsstand, unveränderte vorbestehende Objekte/Board/Szene, manuelle Zoom-Bestätigung und Grenzen.
- Die genannten JPEGs bilden Animation, Endlage, Rollen, Fenstergrößen und Fallback ab. Es wurde **keine Bildschirmaufnahme** erzeugt; geliefert werden Screenshots, nicht ein behauptetes Video.
- Frühere Nachweise bleiben unter `.local-work/spieltisch-2/evidence/w10-v1.2/` erhalten; v1.1-Vorherbild und Materialreferenzen unverändert im Übergabepaket.

### Offene Fehler und Einschränkungen

**Keine neuen funktionalen Blocker in den sechs geprüften Abläufen gefunden.** Für die persönliche Designentscheidung bleiben diese sichtbaren Grenzen:

1. Bei 20–30 Würfeln überdecken sich einzelne Körper in der 3D-Perspektive. Die vollständige lesbare Zahlenleiste ist die verlässliche Gesamtübersicht. Bei 960×540 sind feine 3D-Ziffern klein; Ergebnis und Schließen bleiben lesbar/erreichbar. Dies wurde dokumentiert und gemäß Prüfauftrag **nicht umgebaut**.
2. Reduced Motion / Fallback wurden über vorhandene lokale Testprofile erzwungen. Eine echte Treiberstörung, mehrere unterschiedliche Grafikkarten oder die globale OS-Einstellung wurden nicht geprüft.
3. Rollen sind weiterhin simuliert. Die Browsernachweise ersetzen keine produktive Authentifizierungs-/Kampagnenprüfung.

### Technischer Blocker des nativen Zoomzugangs und manuelle Ersatzprüfung

Die Browser-Erweiterung und der In-App-Browser liefern Seiteninhalt, DOM und Screenshots. Der separate native Windows-Zugriff (`cua.getApp` auf das frisch ermittelte Brave-Fenster) konnte dagegen die aktuelle Browser-URL nicht sicher genug zur Durchsetzung der UI-Regeln erkennen und stoppte deshalb vor weiteren nativen Eingaben. Diese Schutzprüfung wurde nicht umgangen.

Ein vorausgehender Tastaturversuch wurde **nicht** als Zoomnachweis gezählt: CSS-Zoom und DPR blieben 1; die Änderung der Fensterhöhe allein belegt keinen Zoom. Danach wurde eine konkrete manuelle Prüfung über das Brave-Browsermenü angefordert. Antwort des Projektleiters: **„Bei 125 % vollständig sichtbar und bedienbar“**. Dies bestätigt Ergebnis, persönliche Schließaktion und unteres Würfel-Symbol. Ein automatischer 125%-Screenshot liegt nicht vor; diese Teilprüfung wird ausschließlich als manuelle Nutzerbestätigung geführt.

Die zuvor zusätzlich erwähnten allgemeinen Dokument-/Whiteboard-Regressionen wurden in dieser auf sechs Browserfälle begrenzten Restabnahme nicht erneut gestartet. Deren automatisierte Nachweise bleiben die schon bestandene Suite. Die visuellen Belege zeigen vorhandenen NPC, Handout und Sticky gleichzeitig mit den Würfeln; ihre Daten blieben unverändert.

## Lokale Ansicht und Grenze

- SL: <http://127.0.0.1:8816/?ansicht=gm>
- Spieler A: <http://127.0.0.1:8816/?ansicht=a>
- Spieler B: <http://127.0.0.1:8816/?ansicht=b>

Die Rolle wird im Prototyp weiterhin simuliert. Zentrale Prüfungen gegen fremde Sitzung, unbekannten Teilnehmer, unerlaubte Schließaktion und manipulierte Ergebnisse sind echte lokale Adaptertests, **kein Nachweis produktiver Kontenauthentifizierung**. Echte ChroniPlay-Logins, Kampagnenrechte, Live-Synchronisierung und Internetlatenz wurden nicht integriert oder geprüft.

**STOPP zur persönlichen UX-Abnahme. W10 v1.2 ist dafür lokal bereit. Keine Veröffentlichung, kein Push/Merge und keine weitere Etappe.**
