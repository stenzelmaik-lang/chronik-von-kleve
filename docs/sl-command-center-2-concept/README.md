# SL Command Center 2.0 – Konzept zur Abnahme

Stand: 02.10.2026. Phasen A–C des aktuellen Master-Auftrags. **Keine Freigabe zur vollständigen Produktimplementierung vorausgesetzt.**

Der Vorschlag: ein andockbarer SL-Arbeitsplatz mit eigenständigem Storykontext, mehreren Charakterakten und einer bewussten Sendeschale. Vorbereitung, Live-Regie und Nachklang verwenden dieselben Inhalte in unterschiedlichen persönlichen Anordnungen. Plattformadministration bleibt außerhalb dieses Arbeitsplatzes.

## Direkt ausprobieren

Laufender Entwurf: **http://127.0.0.1:8797/**

1. Helena auswählen und ihre Akte mit dem Pin anheften.
2. Corvina auswählen und „Weitere Akte“ öffnen. Helena bleibt angeheftet, die neue Akte folgt Corvina. Die Story bleibt offen.
3. Über „…“ Werkzeuge verschieben und ihre Höhe ändern. Den Mittelsteg ziehen oder mit Pfeiltasten verändern. Neu laden: Anordnung bleibt erhalten.
4. Bei „Medien“ Helena wählen, „Prüfen & senden“ öffnen und den Empfänger kontrollieren. Anschließend beide Empfängersichten vergleichen.
5. „Moment“ notieren: Er erscheint im Protokoll. Vorbereitete Möglichkeiten werden dadurch nicht automatisch abgeschlossen.
6. „Zweites Konzeptfenster“ öffnen. Es hat eine eigene Anordnung und folgt dem gemeinsamen Personenfokus, sofern eine Akte nicht angeheftet ist.

**NUR DESIGN / MOCKUP:** ausschließlich synthetische Daten. Versand, Notizen und Ereignisse werden nur im Browser simuliert. Keine Anmeldung, echte Character Engine, D1, R2 oder produktive Inhalte. Das Modell ist keine Berechtigungsprüfung der tatsächlichen Anwendung.

## Unterlagen

- [Bestandsaufnahme](01-Bestandsaufnahme.md): geprüfte Codebasis, Wiederverwendung und Lücken.
- [Konzeptarchitektur](02-Konzeptarchitektur.md): Arbeitsabläufe, Datenmodell, Sicherheit, mehrere Fenster und Umsetzungsetappen.
- [Prüfbericht](03-Pruefbericht.md): tatsächlich ausgeführte Prüfungen und ihre Grenzen.
- [Startdatei für Windows](Start-Konzept.cmd): Doppelklick startet ausschließlich den lokalen Konzeptserver; anschließend die obige Adresse öffnen. Bei belegtem Port nichts beenden, sondern den vorhandenen Server verwenden.

Der Konzeptserver benötigt keine Cloudflare-Anmeldung, keine Passwörter und keine zusätzlichen Pakete. Er bindet ausschließlich an 127.0.0.1 und liefert nur sechs fest benannte Konzeptdateien aus. Er besitzt keinen Schreib- oder Proxy-Endpunkt.

## Zur Entscheidung durch Pano

1. Andockbare Arbeitsbereiche als Standard, frei anordbar und mehrfach instanzierbar; überlappende Fenster nur als spätere optionale Darstellung.
2. Ein strukturiertes Plotdossier im vorhandenen Entity-System; historische Chronikeinträge bleiben historische Chronikeinträge.
3. Bestehende Revisionstabellen prüfen und ihren generischen Kern sorgfältig herauslösen, bevor neue Dokumenttypen darauf aufbauen.
4. Zuerst Storybuch + Arbeitsplatz + vorhandene Charakter-/Orts-/Textnachrichtenwerkzeuge umsetzen. Audio, Video und interaktive Rätsel erhalten eigene Abnahmestufen.

**Freigabe offen:** Produktintegration, neue Datenbankschemata, Push, Merge und Veröffentlichung. Dieses Paket endet mit dem Konzept und dessen lokaler Demonstration.
