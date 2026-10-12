# Gemeinsamer Spielraum – lokaler Whiteboard-Prototyp

Stand: 12.10.2026, codex/m1-kernmodell. Keine Veröffentlichung, Infrastrukturänderung, neuen Konten oder Produktionsdatenänderung.

## Umgesetzt

- Im Live-Sitzungsbereich, nicht in der SL-Vorbereitung: gemeinsames Whiteboard und Bildschirmbereich.
- Ein Raum je bereits ausdrücklich für die Gruppe freigegebener Sitzung. Nur aktive ChroniPlay-Konten der zugehörigen Kampagne; keine anonymen Gäste oder externen Einladungslinks.
- SL öffnet und schließt bewusst. Teilnehmende treten selbst bei; höchstens acht gleichzeitige Browserverbindungen.
- Gemeinsames Zeichnen, Farbe und zugängliche Texteingabe. Änderungen werden nach dem Speichern etwa alle zwei Sekunden abgeglichen. Dies ist HTTP-Abgleich, noch kein WebSocket-Echtzeitdienst.
- Serverseitige Autorenschaft, begrenzte Pfade/Texte und atomare Einträge. Gleichzeitige Zeichnungen überschreiben einander nicht; Wiederholungen erzeugen keine Dubletten.
- Nur SL darf das Board bewusst leeren. Alte Zeichenentwürfe können nach einem Leeren nicht still zurückgeschrieben werden.
- Schließen beendet den gemeinsamen Zugriff; Wiederöffnen erhält das gespeicherte Board. Verbindungsfehler behalten den lokalen, noch nicht übertragenen Entwurf in der aktuellen Ansicht.
- Bildschirmfreigabe-Grundlage mit nativer Browserauswahl, einer aktiven Freigabe, eigenem Stop, separaten Teilnehmerverbindungen und geschützter WebRTC-Signalisierung.
- Kein Mikrofon, keine Webcam, keine Aufnahmen oder serverseitig gespeicherten Bildschirmframes. Audio-SDP ist aktuell ausdrücklich abgelehnt.

## Bestehende Datenbasis

Vorhandene Anmeldung, Kampagnenrechte und records-/Entity-Adapter weiterverwendet. Keine zusätzliche Tabelle, Migration oder Änderung bestehender Sitzungs-/Charakterinhalte.
Neue interne Records verwenden ausschließlich reservierte Kontexte live-table und live-table-signal. Sie erscheinen nicht in normalen Notizen, Dashboard oder generischen Entity-Projektionen und sind dort nicht schreib-/löschbar. Persönliche Exporte verwenden ebenfalls die geschützte Projektion; administrative Vollsicherungen bleiben verlustfrei.
Bildschirm-Signale werden nur an den eigenen vorgesehenen Browserteilnehmer ausgeliefert. ICE-/SDP-Metadaten können Netzwerkadressen enthalten und werden in aktiven Räumen nach ungefähr 45 Sekunden bereinigt. Schließen entfernt die betreffenden Signalrecords; ein vollständiger administrativer Snapshot kann noch solche kurzlebigen Metadaten enthalten.
Teilnehmer-Leases laufen nach 30 Sekunden ohne Erneuerung ab. Ein fremdes Peer-ID kann nicht übernommen werden. Jede HTTP-Anfrage prüft erneut Anmeldung und Kampagnenzugang.
Worker-Prüfvorgaben beeinflussten insbesondere die serverseitige Autorisierung, begrenzte Nutzdaten, begrenzte Abfragen und das Vermeiden globaler, nutzerübergreifender Laufzeitdaten.

## Bildschirmfreigabe: ausdrücklich noch offen

Release-Grenze: In `closed-alpha-production` ist die Bildschirmfreigabe serverseitig gesperrt. Beigetretene Ansichten erhalten einen klaren Hinweis und deaktivieren die Freigabeaktion. Direkte Start-Anfragen werden ebenfalls abgelehnt. Lokale Signalisierungstests bleiben möglich; der produktive Whiteboard-Betrieb ist davon unabhängig.

Die Projektleitung bestätigt: Es ist noch kein Relay eingerichtet. Keine neue Cloudflare-/TURN-Ressource oder Kosten aktiviert.
LIVE_ICE_SERVERS_JSON ist lediglich ein optionaler, serverseitiger Testkonfigurationsweg für RTCIceServer-Daten; ohne Konfiguration stehen keine STUN-/TURN-Dienste bereit. Keine öffentlich fest eingebauten Drittanbieter und keine Geheimnisse im Repository. Für einen produktiven Dienst müssen Anbieter, Berechtigung und kurzlebige Zugangsdaten zuerst sauber integriert werden; dauerhaft wiederverwendbare Relay-Passwörter sind keine Live-Lösung.
Noch nicht nachgewiesen: reale Bildschirmübertragung zwischen unterschiedlichen Geräten/Internetanschlüssen, Relay-Konnektivität, unterstützte Desktopbrowser und tatsächlicher Bandbreitenbedarf. Ein echter Capture-Test wird nicht automatisch gestartet: Die betroffene Person muss bewusst eine Quelle auswählen.
Native Bildschirmfreigabe setzt einen unterstützten Browser, sicheren Kontext und unmittelbare Benutzeraktion voraus. Voice/Webcam sind spätere eigene Umsetzungsschritte, derzeit keine aktivierbaren Funktionen.

## Prüfstatus

212 Unit-/Regressionstests, Typprüfung, gezieltes ESLint und Build bestanden. Bestehender Bundlegrößen-Hinweis unverändert.
Isolierte API-Integration prüft Raumrechte, Geheimnisschutz, Autorenschaft, parallele Einträge, Wiederholungen, Signalempfänger, Share-Stop, Leeren, Schließen und Wiederöffnen. Keine Aussage über tatsächliche Mediaübertragung allein anhand bestandener Signalisierungstests.
Finaler vollständiger Lauf: 1.304 Integrationprüfungen und 46 Rollenfundament-Prüfungen bestanden. Dabei wurden auch übergroße Nachrichten vor dem JSON-Parsing abgelehnt. Alle Schreibvorgänge ausschließlich in isolierter Test-D1.
Browser: zwei unabhängig gerenderte Ansichten desselben synthetischen SL-Kontos. Texte in beide Richtungen und eine gezeichnete Punktmarkierung erschienen ohne Neuladen im jeweils anderen Fenster. Das belegt den Mehrfenster-Abgleich, nicht zwei reale Spieleranmeldungen oder Medienübertragung. Verschiedene Spieleridentitäten/Geheimnisschutz wurden separat in API-Integration geprüft. Mobile aktive Ansicht bei 390px ohne horizontalen Seitenüberlauf; Whiteboardbreite 323px.
Kein Bildschirm-, Mikrofon- oder Webcam-Capture im Test gestartet. Ein realer Media-Ende-zu-Ende-Test bleibt offen. Änderungen uncommittet im Entwicklungsbranch; der Arbeitsbaum ist nicht sauber.

## Einordnung

Lokale funktionale Whiteboard-Grundlage; kein vollständig abgenommener Teams-Ersatz. Gesamtbereich mit Internet-Bildschirmfreigabe noch nicht live-freigabereif. Weiter erforderlich: gesondert freigegebener Relay-/Credential-Zugangsweg und echter Ende-zu-Ende-Medientest. Bestehende Spiele-/NPC-/Codex-Daten wurden nicht an Produktion verändert.

Quellen: [MDN Bildschirmfreigabe](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia), [MDN WebRTC-Verbindungen](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity), [Cloudflare Worker-Prüfvorgaben](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/).
