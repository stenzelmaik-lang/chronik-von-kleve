# Gemeinsamer Live-Spieltisch v1

## Bedienung

- `Sitzung` öffnen und als SL `Spielabend starten`. Bestehende Sitzung wählen
  oder einen neuen Spielabend benennen. Das Whiteboard öffnet sich automatisch.
- `Szene bespielen`: vorbereitete Szene und Zielgruppe wählen, Vorschau prüfen,
  ausdrücklich senden. Nur Titel und öffentliche Erzählung werden übertragen.
  Regienotizen, Geheimnisse, Atmosphäre und Konsequenzen bleiben in der Vorbereitung.
- `Medien einspielen`: vorhandene Dateien auswählen oder privat hochladen,
  Zielgruppe wählen und senden. Die Medienansicht öffnet sich für die Empfänger
  automatisch; die SL schaltet die gemeinsame Slider-Position weiter.
- `Würfeln`: W10-Pool und Zielgruppe wählen. Zufall und Identität kommen vom Server.
  Keine automatische Patzer-, Hunger-, XP- oder Charakterwertänderung.
- Whiteboard-Notizen, Zeichnungen und eingefügte Bilder sieht immer die gesamte
  berechtigte Runde. Individuelle Freigaben betreffen Szenen, Medien und Würfe.
- Whiteboard-Werkzeuge: Auswahl/Verschieben (V), Hand/Ansicht (H), Rechteck (R),
  Ellipse (O), Pfeil (A), Linie (L), Freihand (P), Text (T), Entfernen (E).
  Text doppelt anklicken oder über die Objektauswahl bearbeiten. Pfeiltasten
  verschieben eine Auswahl; Entf löscht. Strg+Z und Strg+Umschalt+Z steuern die
  lokale Änderungshistorie. Zoom und Hand verschieben nur die eigene Ansicht.
  Excalidraw dient als Bedienreferenz, keine externe Plattform erhält Spielinhalte.

## Bestehende Technik und Schutz

Keine neue Tabelle, Migration oder Medienplattform. Spielraum und Ereignisse
verwenden private reservierte Kontexte in `records`; Dateien bleiben im bestehenden
privaten R2-Bucket. Kampagnenzugehörigkeit, aktive Mitgliedschaft und Empfänger
werden serverseitig geprüft. Allgemeine Notiz-, Entity- und Dashboard-Endpunkte
geben diese Kontexte nicht aus und erlauben keine gefälschten Live-Schreibzugriffe.

Original-Sitzungen und Szenen werden nicht umgeschrieben. Der Live-Start macht
private Sitzungsnotizen nicht öffentlich. Ein neuer Lauf erhält eine eigene Kennung;
verspätete Aktionen vom vorigen Lauf werden abgelehnt. Wiederholte Würfelanfragen
mit derselben Aktionskennung liefern denselben gespeicherten Wurf.

Formen und Objekt-Revisionen sind optionale Ergänzungen bestehender Board-Elemente.
Alte Zeichnungen und Bilder bleiben lesbar und bearbeitbar, ohne automatische
Datenmigration. Gemeinsame Objekte lassen sich von berechtigten Runde-Mitgliedern
bearbeiten. Änderungen prüfen Objektkennung, Bildquelle, Board-Epoche und erwartete
Revision serverseitig. Paralleländerungen verlieren keine fremden Objekte;
veraltete Änderungen desselben Objekts werden abgelehnt. Rückgängig darf ebenfalls
keine neuere fremde Bearbeitung überschreiben. Originalautor und ID bleiben bei
Bearbeitungen erhalten; Wiederherstellen eines gelöschten Objekts legt ein neues an.

Aktiver Live-Stand und Board teilen sich eine einzige, nicht überlappende Abfrage.
Unveränderte Zustände liefern nur einen kleinen privaten Cursor statt aller Inhalte;
die serverseitige Identitäts-/Mitgliedschaftsprüfung erfolgt trotzdem bei jedem Aufruf.
Der Cursor berücksichtigt nur für diesen Nutzer sichtbare Ereignisse. Verdeckte
Freigaben an andere Spieler lösen keine entsprechende Inhaltsaktualisierung aus.
Keine fremden Sitzungsdokumente mehr im aktiven Abgleich. Hintergründe pausieren;
ohne laufenden Abend wird seltener geprüft. Kein neuer Dienst oder Relay eingerichtet.

Private Medien sind ausschließlich über authentifizierte kontextgebundene Endpunkte
abrufbar, auch bei Byte-Range-Anfragen. Nichtempfänger erhalten keine Datei oder
Metadaten. Ausblenden, Ende und Neustart sperren den bisherigen Medienabruf.
HTTP-Caching bleibt `private, no-store`; keine öffentlichen Original-URLs.

PDF-Seiten werden bei Bedarf im Slider mit fest gepinntem Mozilla PDF.js angezeigt.
Dokumentskripte, Formulare und externe Links werden nicht ausgeführt. Der Renderer
und dessen Worker sind öffentliche Programmbestandteile, keine Originaldokumente.
Seitenwechsel innerhalb einer PDF sind lokal; die SL steuert die Auswahl der Datei.

## Grenzen

- Aktiver Änderungsabgleich ungefähr alle 400 ms statt zwei Sekunden; Netzwerk und
  Server kommen hinzu. Kein WebSocket-/Excalidraw-Streaming: Zeichnungen und Bewegungen
  werden nach dem jeweiligen abgeschlossenen Eingriff gespeichert und übertragen.
- Audio/Video starten Nutzer über Browser-Steuerelemente. Kein framegenauer gemeinsamer
  Abspielstand und keine Umgehung von Autoplay-Regeln; Codec-Unterstützung des Browsers.
- Unterstützt: JPEG, PNG, WebP, GIF, PDF, MP3, OGG, WAV, M4A, MP4 und WebM,
  maximal 10 MiB je Datei und 20 Dateien je Slider. Whiteboard verwendet nur Bilder.
- Keine Bildschirmfreigabe, Relay-Kosten, Webcam oder Mikrofon. Die bestehende
  Produktionssperre für Bildschirmfreigabe bleibt erhalten.
- Board-Grenzen bleiben bestehen: 200 Elemente, 128 Zeichenpunkte, 500 Textzeichen,
  acht gleichzeitige Zeichenverbindungen. Bilder werden zunächst in festen Bereichen
  eingefügt und sind danach auswählbar und verschiebbar. Keine frei skalierbaren Bilder,
  Mehrfachauswahl oder vollständige Excalidraw-Funktionsgleichheit behauptet.
- Kein automatisches Importieren, keine neue Berechtigung und keine Änderung echter
  Spieler-, Charakter-, Konto-, NPC- oder Kampagnendaten durch dieses Release.

## Prüfungen und Veröffentlichung

Automatisierte Unit-/Schema-Tests, TypeScript, geänderte Quelldateien mit ESLint,
Produktionsbuild und vollständiger HTTP-Integrationstest in frischer isolierter D1.
Neue Integrationsfälle prüfen SL und zwei getrennte synthetische Spieler: private
Originalsitzung, gezielte Szene, sichere Wiederholung von Würfen, verdeckter Sender,
geschützte Medien/Byte-Ranges, Slider, Ausblenden, Board-Bilder, reservierte Kontexte,
Ende/Neustart und Erhaltung bestehender Originale.

Browserprüfung ausschließlich lokal mit synthetischen Konten und eigenen Testdateien:
Start/automatisches Whiteboard, Szene, Notiz, Tastaturwurf, Medien-Dialog, PDF-Seite,
Audio-Dekodierung und Mobilbreiten 390/320. Dies ist keine echte Spieler-Live-Abnahme.
Eine Videodatei mit tatsächlichem Codec wurde nicht als Browser-Referenz getestet.

Die Abhängigkeitsprüfung meldet bekannte Befunde in bereits vorhandenen Next-/Sharp-
und Build-Hilfspaketen, nicht in PDF.js. Der veröffentlichte Worker verwendet den
vorhandenen vinext-Runtimepfad, nicht Nexts betroffene SSG-/ISR-/Bildoptimierungsserver;
Sharp und `next/dist/server` sind nicht im Worker-Artefakt enthalten. Kein ungezieltes
Framework-Upgrade im Rahmen dieses Spieltisch-Release.

Vor Veröffentlichung: aktuellen Worker und Bindings prüfen, frisches vollständiges
D1-Backup privat sichern, FTS rekonstruieren und Kopie mit Integritäts-/FK-Prüfung
wiederherstellen. Nur den sauberen Commit pushen. Produktionsartefakt mit bestehenden
D1/R2-IDs und Schutzvariablen bauen; Dry-Run; kontrolliertes Deployment. Kein SQL-
Import und keine Migration notwendig. Danach aktive Version, private API-Sperren und
ausgelieferte Programmbestandteile prüfen. B1 gegen B0 vergleichen; legitime Auth-
Sitzungs-/Auditänderungen nicht als Testdaten löschen oder zurücksetzen.

Keine synthetischen Produktionsobjekte erforderlich. Bei Fehlern keine blinde B0-
Wiederherstellung oder Rückschaltung nach neuen Live-Schreibvorgängen: zuerst sichern,
Kompatibilität prüfen, vorzugsweise Fix-forward. Private Backups und Laufzeitdaten
bleiben außerhalb Git.
