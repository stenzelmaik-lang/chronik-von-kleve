# Prüfbericht – Konzeptphasen A–C

Datum: 02.10.2026. Ausgangsstand `bb6bc07b1b404165bfc9765d7937d4dfe653ef59`; Konzeptbranch `codex/sl-command-center-2-concept`. Dieser Bericht betrifft ausschließlich den lokalen Konzeptentwurf und die Quellcodeanalyse.

## Eindeutiger Status

| Prüfgegenstand | Ergebnis |
|---|---|
| Tatsächliche Codebasis / Branch-Abhängigkeiten | **GEPRÜFT.** B1a und alter Command-Center-Stand bereits im Ausgangsbranch enthalten. |
| Grundlagenpapier | **GELESEN.** Kombinierte Version 2.0 mit allgemeinem Pen & Paper und V20. |
| Gesamtarchitektur / Informationsfluss | **KONZEPT AUSGEARBEITET.** Freigabe zur Produktumsetzung offen. |
| Frei anordbare Werkzeug-Demonstration | **NUR DESIGN / MOCKUP**, tatsächlich lokal ausführbar. |
| Vollständiges Storybuch mit sicherem Server-Editor | **NICHT IMPLEMENTIERT** durch diesen Auftrag. |
| Sichere echte Medien-Delivery / Spielerlogins | **NICHT NEU IMPLEMENTIERT ODER GETESTET**. Bestehende Textnachrichten im Code geprüft; Simulation ist kein Security-Nachweis. |
| Mehrfenster-Konzept | **TEILWEISE GEPRÜFT.** Tatsächliches separates Brave-Fenster öffnet und empfängt Fokuswechsel. Automatisierte Bedienung im Popup begrenzt, siehe unten. |
| Neue Kosten / externe Dienste | **KEINE.** Keine neue Bibliothek, kein Cloudflare-Aufruf. |
| App-/Schema-/Auth-/Kanonänderungen | **KEINE.** Neue Dateien ausschließlich im Konzept-Dokumentationsordner. |
| Push / Merge / Deployment / Migration | **NICHT DURCHGEFÜHRT.** |

## Automatisierte Prüfungen

**PASS – 9 Tests, 0 Fehler.** Ausgabe: [konzept-tests.txt](qa/konzept-tests.txt).

Sechs Modelltests:

1. Angeheftete Helena bleibt bei Helena; zweite folgende Akte wechselt zu Corvina; Story bleibt vorhanden; Pin lösen folgt wieder.
2. Mehrfachinstanzen verschieben, ohne angeheftete Referenz oder Story zu verlieren.
3. Layout-Reload erhält Instanzen; unzulässige Werkzeuge, doppelte IDs, ungültige Bindungen und Größenwerte werden begrenzt.
4. Zwei unabhängige Fensteranordnungen verwenden denselben Personenfokus.
5. Ausdrücklicher Probeversand ist empfängergebunden, idempotent und erzeugt kein Ereignis; unbekannter Empfänger abgewiesen.
6. Nur ausdrückliche Momentnotiz erzeugt einen tatsächlichen Probeeintrag; Leertext, Überlänge und Wiederholung geprüft.

Drei lokale Serverprüfungen:

7. Sichtbare Konzeptkennzeichnung, `no-store`, CSP mit `connect-src 'none'`.
8. App-APIs, Schema, `.env` und Traversal-Pfad sind nicht abrufbar (404).
9. POST/PUT/PATCH/DELETE besitzen keinen Endpunkt (404); HEAD funktioniert.

**PASS – vollständiger Projekt-Typecheck**, Exit 0. **PASS – vollständiger Projekt-Lint**, Exit 0. Nach Ergänzung der Servertests nochmals Lint aller Konzeptdateien, Exit 0. Syntaxprüfung von Browsermodul und Konzeptserver erfolgreich.

**Build und vollständige D1/R2-App-Regression nicht erneut ausgeführt:** kein Anwendungs-, Paket-, Schema- oder Worker-Code verändert. Frühere Inventar-/Character-Testzahlen werden hier nicht als neue Command-Center-Ergebnisse ausgegeben. Diese Phasen führen keine produktive Funktions- oder Sicherheitsabnahme durch.

## Tatsächlicher Browsertest

Codex-In-App-Browser: Laptop-Viewport **1366 × 768** und Desktop **1920 × 1080**. Keine horizontale Seitenüberbreite (gemessen jeweils Seitenbreite = Viewportbreite). Danach temporäre Viewportvorgabe zurückgesetzt. Prüfung ist Browser-QA, kein physischer Zweimonitor-/Gerätetest.

| Ablauf | Nachgewiesenes Ergebnis |
|---|---|
| Helena anheften → Corvina wählen → weitere Akte | Helena bleibt angeheftet, zweite Akte folgt Corvina; Story weiter geöffnet. |
| Menü: Akte links / rechts / nach oben | Reihenfolge und Spalte ändern sich; Pin bleibt erhalten. |
| Ziehen: Corvina in die linke Spalte | Tatsächlicher Drag funktioniert; anschließend per Menü wieder rechts angeordnet. |
| Breitensteg per Pfeiltaste und per Ziehen | Breite geändert und nach vollständigem Reload erhalten. |
| Werkzeughöhe kompakt wählen → Reload | Gespeicherte Höhe `small` erhalten; anschließend zurück auf `medium`. |
| Werkzeug fokussieren und zurück | Fokusklasse aktiv, anschließend alle geöffneten Werkzeuge wieder vorhanden. |
| Suche „Medien“ | Passendes Konzeptwerkzeug als Treffer; Suche ist noch kein Kampagnensuchdienst. |
| Empfänger Helena → Versandprüfung → Abbrechen | Helena ausdrücklich benannt; kein Probeversand und keine Nachricht in der Simulation. |
| Erneut prüfen → bewusst senden → Empfängersichten | Helena erhält Nachricht; Corvina zeigt ausdrücklich „keine Nachricht erhalten“. |
| Momentnotiz → Nachklang | Ein tatsächlicher Probeeintrag; drei vorbereitete Möglichkeiten weiterhin offen. |
| SL-Konzeptnotiz / Vorbereitungsnotiz → Reload | Lokale synthetische Texte und gewählter Modus erhalten. Keine D1-Persistenz behauptet. |
| Normales Brave-Fenster → zweites Fenster | Eigenes echtes Popup unter `?window=aux`, andere Werkzeuge/Anordnung. Wechsel zu Corvina in der Hauptregie erscheint in der folgenden Akte des Nebenfensters. |

Warn-/Fehlerkonsole des In-App-Konzepts nach diesen Abläufen: **keine Einträge**. Kein Browser-API-Abruf an die echte Anwendung; der Konzeptserver blockiert Verbindungen über CSP.

## Bekannte Begrenzung / PROBLEM – RISIKO

Im In-App-Browser entstand über `window.open` kein steuerbarer zweiter Tab. Im normalen Brave-Browser wurde das getrennte Fenster tatsächlich geöffnet und dessen geänderter Personenfokus ausgelesen. Die automatisierte Mausbedienung und Screenshotaufnahme dieses Popupfensters scheiterten am Browser-Steuerkanal (`Input.dispatchMouseEvent` / `Page.captureScreenshot` Timeout). Ein Tastaturversuch bewirkte keine angeheftete Akte. **Keine erfolgreiche Popup-Pin-/Reload-Bedienabnahme behauptet.**

Die Pin-/Reload-Logik ist im Hauptfenster tatsächlich geprüft und zusätzlich im gemeinsamen Modell getestet. Nebenfenster-Bedienung sowie Betrieb auf zwei physischen Monitoren bleiben für die persönliche Abnahme offen. Die tatsächlichen DOM-Nachweise beider Brave-Fenster liegen in [hauptfenster-brave.txt](qa/hauptfenster-brave.txt) und [nebenfenster-brave.txt](qa/nebenfenster-brave.txt).

Andere offene Grenzen: Prototyp besitzt zwei Spalten statt des geplanten beliebig verschachtelten Produkt-Docking-Baums; keine echte Anmeldung, DB-Persistenz, serverseitige Empfängerprüfung, Audio/Video, Rätselsteuerung, vollständige Charakteraktionen oder neuer Rich-Text-Editor. Geplante Aktionen nennen diese Grenze in der Oberfläche. Keine Kampagnensecrets in den Beispieldaten.

## Sichtbare Nachweise

- [Laptop mit angehefteter Helena und folgender Corvina](qa/regie-laptop.png)
- [Desktop](qa/regie-desktop.png)
- [Aktuell geöffneter Entwurf](qa/regie-aktuell.png)
- [Bewusste Versandprüfung](qa/versandpruefung.png)
- [Corvina erhält keine Probe-Nachricht](qa/corvina-keine-nachricht.png)
- [Nachklang](qa/nachklang-laptop.png)

Diese Bilder zeigen die tatsächliche lokale Konzeptoberfläche. Sie sind ausdrücklich keine Screenshots eines fertig implementierten Live-Command-Centers.

## Änderungen und Sicherung

Neue Dateien nur unter `docs/sl-command-center-2-concept/`: drei Fach-/Prüfdokumente, README, Windows-Starter, statischer Konzeptserver, sechs Prototype-Assets, Icon-Generator aus dem bereits installierten Lucide-System, Modell-/Servertests sowie QA-Nachweise. Exakte Liste: [changed-files.txt](changed-files.txt).

Abgleich von `app`, `domain`, `server`, `db`, `scripts`, Paketdateien und `vite.config.ts` gegen den Ausgangscommit: **keine Änderungen**. Keine bestehenden Werte, Datenbanken oder laufenden Inventar-Testprozesse überschrieben. Konzeptserver eigener geprüfter freier Port 8797, ausschließlich Loopback. Der lokale Konzeptcommit wird in der Abschlussmeldung genannt; kein Remote-Release.

**Nächster Gate:** Pano prüft den klickbaren Entwurf und entscheidet über die vorgeschlagenen Kernprinzipien/erste Umsetzungsetappe. Bis dahin keine weitere Produktentwicklung.
