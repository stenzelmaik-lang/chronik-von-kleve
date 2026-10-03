# Phase 2A – lokaler Story Workspace

Stand: 03.10.2026. Basis 788712bb08ec6e3e9fc219a883db87e96ba05d45. Branch codex/command-center-phase2a.

## Benutzbare Lieferung

http://127.0.0.1:8802/sl/command-center
Lokale Anmeldung: command-gm@example.invalid / ChroniPlay-Demo-2036!
Dieser Zugang gilt ausschließlich für die isolierte Loopback-Arbeitsumgebung, ohne Plattformadministratorrechte.
Windows: Start-StoryWorkspace.cmd doppelklicken. Läuft Port 8802 bereits, die vorhandene Anwendung öffnen; fremde Prozesse werden nicht beendet.
Die gespeicherte D1/R2 liegt in .local-work/story-workspace und wird bei Neustarts erhalten. Dieses Verzeichnis nicht löschen; für eine Dateisicherung zuerst den zugehörigen Server stoppen und dann das ganze Verzeichnis kopieren. Kein Cloud-/Produktionsimport. Keine erfundene Story „Der Hunger bleibt“.

## Implementiert

- Story, Sitzungsvorbereitung, Szenen und hierarchische Unter-Szenen auf den vorhandenen Entities/Records.
- Getrennte Storyabschnitte, Status, Kurzüberblick, Favoriten, Anheften, Suche und zuletzt geöffnete Akten.
- 15 Elementtypen; zentrale Personen-/Orts-/Dateireferenzen statt kopierter Weltakten.
- Sitzung bestimmt ihre Szenenzuordnung. In einer Szene werden zugeordnete Sitzungen verlinkt angezeigt. Eine aus einer Sitzung neu angelegte Szene anschließend dort auswählen.
- Visueller/HTML-Editor: Überschriften, Hervorhebungen, Listen, Zitate, Tabellen, Links, private Bilder und Trennlinien. Serverseitige HTML5-Analyse und sichere Dokumentstruktur, kein direktes unsicheres HTML-Rendering.
- Sichtbares Autosave, manuelles Speichern, serverseitige Versionsbindung, Konfliktschutz, Verlaufsanzeige und bestätigte Wiederherstellung.
- Wiederherstellung betrifft Vorbereitung; vorhandene tatsächliche Szenenläufe/Publikationen und Sitzungs-Livefelder bleiben erhalten.
- Vorbereitung ausschließlich für berechtigte Kampagnen-SL. Keine implizite Spielerfreigabe. Private Datei-Uploads über bestehenden Dateipfad, Kampagnenbindung und Schutz aktuell/historisch verknüpfter Dateien.
- Bestehender Live-Szenenmanager liest dieselben vorbereiteten Elemente. Keine neue Live-Engine und keine erzwungene Szenenfolge.

## Nachweis

Typecheck bestanden; Lint bestanden; Build bestanden.
134 Fach-/Regressionstests bestanden.
1007 Integrationstests bestanden, zusätzlich isolierter D1-Batch-Rollback bestanden.
Charakter-, Inventar-, Orts-, Auth-, Rollen-, Recovery- und Medienregression im vollständigen Lauf enthalten.
52 Phase-2A-Integrationprüfungen einschließlich paralleler Änderungen, Sitzungs-Audit-Rollback, Hierarchierennen, fremder Kampagnen/Dateien, Player-Sperren, sicherer HTML-Verarbeitung und Wiederherstellung.
Erwartete Fehlermeldungen aus absichtlich erzeugten Audit-/D1-Fehlern sind negative Testbelege, keine unerledigten Laufzeitfehler.
Bekannte Buildwarnung: Client-Chunk über 500 kB. Zusätzlich vinext-Routenklassifizierung teilweise „Unknown“ (Build erfolgreich).
Logs: outputs/phase2a-{build,typecheck,lint,unit,integration}.log.

Echter Browser auf getrennter synthetischer QA-Datenbank (8798): Story erstellen/bearbeiten/neuladen, Sitzung erstellen/verknüpfen, Haupt-/Unter-Szene und Hinweis, zentraler Ort ohne Kopie, Editor mit Tabelle/Zitat, privates synthetisches Bild hochladen/einfügen/speichern/neuladen (Bild tatsächlich geladen), Favoritenfilter, historische Sitzung wiederherstellen und neu laden. Neustart erhält Datensätze. Screenshots in outputs/phase2a-browser-session.jpg und phase2a-working-workspace.jpg.
Der Arbeitsbestand auf 8802 ist getrennt und ohne synthetische Geschichten oder Kampagnenfixtures. Ein persönlicher Pano-Abnahmetest steht noch aus.

## Kurze persönliche Abnahme

1. + Story: eigenen Titel und Text schreiben. Auf „Gespeichert“ warten, vollständig neu laden.
2. + Szene: Handlungsstrang wählen, + Unter-Szene und ein Element anlegen.
3. + Sitzung: Story/Szenen und vorhandene zentrale Orte auswählen. Ortsauswahl erscheint nur, wenn zentrale Ortsakten in dieser Arbeitsdatenbank vorhanden sind.
4. Privates Bild hochladen, im Editor auswählen/einfügen, speichern und neu laden.
5. Favorit setzen, suchen, Verlauf laden und einen alten Vorbereitungsstand bewusst wiederherstellen.

## Grenzen / bewusst offen

- Personen, Audio/Video, Handouts und Rätsel können vorhandene Referenzen/Platzhalter verwenden. Keine neue NSC-, Medien-, Rätsel-, Würfel-, Trigger- oder Zeit-Engine.
- Kein eigener Upload für Audio/Video; keine externe Einbettung/iframes. Private Bilder/PDF über bestehenden Upload.
- Keine neue Löschverwaltung: Elemente können entfernt und über Revisionen wiederhergestellt werden; Akten werden über Status archiviert.
- Die leere lokale Arbeitsdatenbank enthält keine kopierten Produktionsorte. Der zentrale Ortsverknüpfungstest nutzt ausschließlich die getrennte QA-Datenbank.
- Keine neue SQL-Migration; bestehende Migrationen nur lokal auf isolierter D1 eingerichtet.
- Keine browserübergreifende Live-Synchronisierung/Phase 2B. Zuletzt geöffnet ist lokal pro Nutzer gespeichert.
- Kein Push, Merge, Deployment oder produktiver Schreibvorgang. Lokal implementiert und zur persönlichen Abnahme bereit, nicht live veröffentlicht.

Geänderte Dateien: siehe PHASE2A-CHANGED-FILES.txt. Exakten lokalen Commit liefert die Abschlussmeldung; nachfolgende report-only Änderungen verändern die Implementierung nicht.

