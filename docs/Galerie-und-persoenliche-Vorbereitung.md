# Galerie und persönliche Vorbereitung

Stand: 31.10.2026. Lokale Umsetzung auf `codex/galerie-vorbereitung`.
Basis: `69951209bec58ceb03bf2b0bbf5439bf5426eae2`, gemergter PR #47.
Kein Push, Merge oder Deployment; keine produktiven Datenzugriffe und keine Migration.

## Bedienung

- **SL → Command Center → Galerie:** eigener Menüpunkt, Bildraster, Suche,
  Sortierung nach Name, Alter oder Dateigröße, Dateiart und geschützte Vorschau.
  Neue Dateien sind standardmäßig SL-intern; die bestehende Auswahl zwischen
  privat, SL-intern und Gruppe bleibt vorhanden. Löschen benötigt eine Bestätigung.
  Verwendete Originaldateien bleiben mit einer verständlichen Konfliktmeldung erhalten.
- **SL → Command Center → Material → Materialvorlagen & Handout-Pakete:**
  Dokumente zum Ausfüllen, Text-Handouts, Bilder/Polaroids, PDF, Audio und Video vorbereiten.
- **Material → Szenenbausteine:** Der bisherige Bausteineditor der Szenenvorbereitung
  ist hier erreichbar, einschließlich aller vorhandenen Bausteinarten, Pager,
  Referenzen und Hinweis-/Handoutzuordnungen. Gespeichert wird weiterhin dieselbe
  Szene; Erzählung, Einsatzplan und andere Kapitel werden nicht umkopiert oder gelöscht.
- **Szenenvorbereitung, Schritt 4 → Interaktion & Einsatzplan:** nur Erklärung,
  geplanter Einsatz, Anlass und Ablauf. Keine Bausteinverwaltung mehr in diesem Schritt.
- **Mehrseitiges Handout:** bis zu 20 Bildseiten in einer Vorlage. Mehrfachupload,
  stabile Seiten-IDs, einzelne Seiten entfernen sowie nach oben/unten ordnen.
  Auf dem Tisch erscheint ein Handout mit eigener Lesefassung und Vor-/Zurückblättern.
  Beim Öffnen wird nur die aktuelle Seite über den berechtigten Asset-Endpunkt geladen.
- **Spielerzentrale → Archiv & Vorbereitung:** dieselbe Vorbereitung für die
  eigenen Unterlagen. Bereits vorhandene persönliche Notizen bleiben darunter erhalten.
- **Regie → Material:** gespeicherte eigene Vorbereitungen und das vorbereitete
  Material der gewählten Szene. Kein ungefilterter Dateidump mehr im Materialbereich.
  Auch vorbereitete Text-Handouts ohne Datei oder bestehende Handout-Akte sind auflegbar.
- **Spieltisch → Dokumente:** eigene gespeicherte Vorbereitung und bereits
  ausgelegte Dokumente. Bewusst für alle oder ausgewählte Teilnehmer auflegen.
  Bilder erscheinen als vorhandene Polaroids, andere Medien über die bestehenden Bühnenobjekte.
- Ein aufgelegtes Textdokument lässt sich durch den Autor oder die SL ausfüllen.
  Die Arbeitsfassung wird mit den ausdrücklich gewählten Empfängern synchronisiert;
  die private Vorlage bleibt unverändert. Persönliches Material bleibt über Szenenwechsel erhalten.
  Szenengebundene Handouts werden wie das übrige Szenenmaterial abgeräumt.
- Autor und SL können Material zurückziehen. Andere Teilnehmer können die
  freigegebene Arbeitsfassung lesen und ihre eigene Ansicht öffnen/schließen.
  Private Originaldateien werden dadurch nicht allgemein freigegeben.
- **Als Nachricht senden** öffnet den vorhandenen Postfachentwurf, mit dem
  vorbereiteten Text und gegebenenfalls der eigenen Originaldatei als Anhang.
  Empfänger und Versand bleiben eine ausdrückliche Aktion im bestehenden Postfach.

## Bestehende Technik

Keine neue Datenbank und keine parallele Bühnen- oder Nachrichtenengine:

- Vorlagen sind private `records` vom vorhandenen Typ `notizen`, mit dem
  abgegrenzten Kontext `table-material`. Der allgemeine Records-Schreibpfad
  kann diesen Kontext weder veröffentlichen noch bearbeiten oder löschen.
- Bestehende `files`/R2-Objekte werden per ID verknüpft. Keine Kopie der Bild- oder Mediendateien.
- Vorlagen-API: `/api/table-materials`, GET/POST/DELETE, serverseitig nur eigene
  Vorlagen innerhalb der aktuellen aktiven Kampagne; auch die SL erhält keinen
  pauschalen Zugriff auf unveröffentlichte Spielerentwürfe.
- Veröffentlichung, Bewegung, Empfängerauswahl, Entfernung und Arbeitsfassung
  verwenden `/api/live-stage` und den bestehenden versionierten Spieltischstand.
  Eigentümer und Arbeitsinhalt kommen aus der serverseitig geprüften Quelle,
  nicht aus frei übermittelten Clientfeldern.
- Die bestehende `/api/live-stage/asset`-Route liefert Material nur an aktuell
  berechtigte Empfänger. Nach dem Zurückziehen ist auch der alte Asset-Link gesperrt.
- Vorlagenänderungen, Arbeitsfassungsänderungen und Bühnenänderungen besitzen
  Versionsprüfungen. Die Dokumentrevision ist vom allgemeinen Bühnenstand getrennt:
  fremde Notizbewegungen blockieren kein Speichern; echte Dokumentkonflikte erhalten den Entwurf. Eine veraltete Fassung überschreibt keinen neueren Stand.
- Private Vorbereitungen bleiben auch über den generischen Entity-Zugriff und
  den Kampagnenexport vor fremdem Zugriff geschützt. Im persönlichen Export
  bleiben die eigenen Vorlagen enthalten.
- Unfertige Material- und Szenenbausteinentwürfe bleiben innerhalb der geöffneten
  Anwendung bei Bereichswechseln und Schließen des Schubers im Arbeitsspeicher
  erhalten. Sie werden nicht in localStorage oder eine zweite Datenbank geschrieben.
  Vor vollständigem Verlassen der Seite warnt die bestehende Browsermechanik.
- Geschlossene Spielabende blockieren das Löschen der privaten Vorlage nicht.
  Historische Arbeitsfassungen und ihre Dateireferenzen bleiben erhalten.
- Die Galerie respektiert bestehende Dateisichtbarkeit. SL kann eigene sowie
  zugängliche SL-/Gruppendateien löschen, jedoch keine fremden privaten Spielerdateien.
  Die Schutzprüfungen für Referenzen und Verlauf bleiben erhalten; Profilbilder sind ebenfalls geschützt.

## Prüfungen

Nur synthetische Konten `command-gm`, `command-a`, `command-b` auf getrennten lokalen Ressourcen.

| Prüfung | Ergebnis |
| --- | --- |
| Standard-Unit-/Regressionstests einschließlich 8 Materialtests | 223/223 bestanden |
| Zusätzliche bestehende Bühnen-Domaintests | 5/5 bestanden |
| Vollständige isolierte HTTP-/D1-Integration | 1.921 Prüfungen bestanden |
| Rollen-/D1-Backfill-/Rollback-Prüfungen | 46 Prüfungen bestanden |
| Neue Material-API, Rollen, Empfänger, Arbeitsfassung, Löschschutz, Charaktervergleich | 84 Prüfungen bestanden |
| Eigene Lifecycle-/Profilbildprüfung auf separater Testinstanz | 15 Prüfungen bestanden |
| Neue Browserabläufe | 12 Hauptabläufe + 8 Randfälle + 11 Paket-/Umzugsprüfungen bestanden |
| Typecheck, ESLint der betroffenen Dateien, Produktionsbuild | bestanden |
| Mechanischer Gestaltungscheck der neuen Oberfläche | keine Befunde |

Browsernachweise: Galerie bei 1920×1080, 1440×900 und 390×844;
persönliche Vorbereitung auf Desktop und Mobil; Regie, Tastaturverschiebung,
Ausfüllen, gezieltes Auflegen und Zurückziehen mit getrennten Spieleransichten.
Zusätzlich: vollständiges synthetisches Sieben-Seiten-Paket, Blättern bis zur letzten
Seite und zurück, mobiler Schließen-Knopf bei langen Titeln, erhaltene Entwürfe und
Speichern der verschobenen Szenenbausteine ohne Änderungen an der Originalszene.
Die Galerieaufnahme bei 1920 wurde nach vollständigem Laden aller Vorschauen erneut erstellt.
Prüfprotokolle und Screenshots liegen lokal und werden nicht veröffentlicht:
`.local-work/material/`.

Lokaler Einstieg: `http://127.0.0.1:8882/sl/command-center?bereich=galerie`.
Start nach Build: `CVK_TEST_PORT=8882 node --experimental-strip-types scripts/test-local.mjs --regie`.
Die Ressourcen werden durch den vorhandenen lokalen Teststarter angelegt;
Produktions-D1 und Produktions-R2 sind nicht angebunden.

## Bewusste Grenzen

- Sortieren ist eine Ansichtsreihenfolge (Name, Alter, Größe), keine neue Ordnerstruktur.
- Referenzierte Bilder und Dateien werden nicht zwangsweise aus Akten oder Verlauf entfernt.
- Die Vorlage bleibt erhalten. „Vorlage erneut auflegen“ ersetzt bewusst eine
  bereits ausgefüllte Arbeitsfassung. Die Aktion ist entsprechend beschriftet.
- Ausfüllen bezieht sich auf vorbereitete Textdokumente. PDF-Dateien bleiben im
  vorhandenen Reader; es wurde kein zusätzlicher PDF-Formulareditor eingeführt.
- Nachrichtentexte werden im bestehenden Klartextentwurf angezeigt. Vor dem
  Versand sind Inhalt, Anhänge und Empfänger kontrollierbar.
- Die lokale technische Prüfung ersetzt keine persönliche UX-Abnahme oder einen
  später gesondert freigegebenen Produktionsrelease.
- Die zusätzlichen Bühnenfelder sind optional und benötigen keine Migration.
  Ein alter Worker versteht neue `record`-Bühnenobjekte allerdings nicht. Ein
  späterer Release darf nach deren Nutzung nicht blind auf alten Code zurückrollen.

## Unabhängige Schlussprüfung

Die sechs bei der Gegenprüfung gefundenen Datenschutz-, Entwurfs-, Konflikt-
und Löschschutzprobleme wurden behoben und gezielt nachgetestet. Das lokale
Ergebnis lautet **SHIP**; die separate Dokumentationsprüfung fand keine Pflichtkorrektur.
Die Archivaufnahme wurde nach vollständig geschlossener Postfachüberblendung neu erstellt.
Nicht blockierender UX-Restpunkt: Die Bildseitenverwaltung folgt im Handouteditor
noch auf den optionalen Texteditor und erfordert dadurch gegebenenfalls Scrollen.
Die persönliche UX-Abnahme bleibt beim Projektinhaber; es wurde nichts veröffentlicht.
