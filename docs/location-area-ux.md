# Ortsbereiche: Darstellung und HTML-Bearbeitung

Stand: lokale Umsetzung auf `codex/m1-kernmodell`, Ausgangscommit `1a74279e5412e50eb0b3df59c3bd7e6e85f308ed`.

## Umfang

- Der Abschnitt „Bekannte Bereiche“ nutzt eine eigene volle Zeile im bestehenden Ortsdossier. Auf ausreichend breiten Flächen bleibt links eine 260-px-Navigation, rechts der flexible Bereichsinhalt. Schmalere Flächen erhalten eine Spalte, auch in der CMS-Vorschau.
- Korrektur des Textumflusses: Bild und ausdrücklich markierte Einleitung stehen in einer eigenen Grid-Zeile. Die übrige Beschreibung beginnt immer darunter, unabhängig davon, ob Bild oder Einleitung höher sind. Es gibt keinen Float mehr.
- Bereichstitel und Metadaten stehen vor Bild und Beschreibung. Die Bildvorschau bleibt auf 400 px begrenzt; Lagepläne werden mit `object-fit: contain` vollständig angezeigt.
- Die vorhandene Bild-Lightbox unterstützt auch Bereichsbilder: Einpassen, 100–400 % Zoom, Verschieben mit Zeiger, Schaltflächen und Pfeiltasten. X/Escape schließen; Fokus und Dossierposition bleiben erhalten.
- Die bestehenden Beschreibungseingaben im Orts-CMS bieten „Visuell“, „HTML-Quelltext“ und eine Vorschau ohne Speicherung oder Veröffentlichung.
- Bereichsbeschreibungen verwenden 16 px/1,6, H2/H3 mit 24/20 px und erkennbare Absatzabstände. Der äußere Detailcontainer hat keine maximale Breite oder künstliche Mindesthöhe; nur Leseblöcke bleiben auf 75 ch begrenzt. Vorhandene Schriften und Farben bleiben maßgeblich.

## Speicherung und Sicherheit

Kein neues Textmodell: HTML wird mit dem bereits eingesetzten `parse5`-Parser in das bestehende typisierte `cvk-rich-v1`-Dokument überführt. Der HTML-Modus liefert daraus beim erneuten Bearbeiten wieder sicheren Quelltext. Einrückung, redundante Tags und gefährliche Attribute werden nicht als unveränderter Rohquelltext archiviert. Erhalten werden die unterstützte Textstruktur und erlaubten Formatierungen.

Zusätzlich erlaubte Klassen: `cp-intro`, `cp-highlight`, `cp-note`, `cp-divider`. Die serverseitige Dokumentvalidierung prüft diese Klassen ebenfalls bei direkt eingereichtem JSON. Der Reader erzeugt React-Elemente; unbereinigtes HTML wird nicht in die Spieleransicht injiziert.

Die vorhandenen sichtbaren Textgrenzen bleiben bestehen, etwa 1200 Zeichen für Bereichshinweise. Formatierungsdaten werden separat begrenzt und verbrauchen dieses sichtbare Textbudget nicht. Zu lange oder zu komplexe Eingaben werden abgelehnt, nicht still abgeschnitten. Die vorhandene Unterstützung für Tabellen, sichere Links und geschützte Bilder wird nicht entfernt.

Klartext wird nicht automatisch als HTML interpretiert oder konvertiert. Bestehende Ortsidentitäten, Elternverknüpfungen, Freigabe-/Prüfabläufe, SL-Notizen und private Medienendpunkte bleiben unverändert. Bildvergrößerung verwendet ausschließlich eine bereits in der aktuellen sicheren Projektion enthaltene Quelle.

Keine Datenbankmigration, keine Produktivdatenübernahme und kein Deployment gehören zu dieser Umsetzung. Insbesondere werden keine bestehenden Inhalte von Electric Taberna bearbeitet.

Kompatibilität: Vorhandene Klartext- und Rich-Text-Dokumente bleiben lesbar. Neue Dokumente mit den optionalen `className`-Angaben benötigen den hier erweiterten Reader. Ein späterer Rücksprung auf einen älteren, strikt validierenden Reader darf deshalb nicht ungeprüft erfolgen.

## Wiederholbare lokale Prüfung

1. Projekt bauen: `node scripts/run-framework.mjs build`.
2. Unit-/Schema-Prüfungen: `node --experimental-strip-types --test tests/*.test.mjs`.
3. Vollständige Integration mit frischen lokalen D1-/R2-Ressourcen: `node scripts/test-local.mjs`.
4. Anschließend getrennt die Browser-Vorschau starten: `node scripts/test-local.mjs --location-areas`.

Die Vorschau legt ausschließlich neue synthetische Ortsobjekte unter `127.0.0.1:8794` an und gibt den direkten Dossierlink aus. Sie darf nicht parallel zum vollständigen Integrationstest laufen. Die Testkonten sind die vorhandenen lokalen Demonstrationsrollen; es werden keine Produktionskonten verwendet.

Browser-Abnahme: SL und Spieler getrennt; Desktop 1440 px, Tablet 834 px und Mobil 390/320 px. Prüfen: Quelltext eingeben → Vorschau → Entwurf speichern → neu öffnen; gezielte Veröffentlichung ausschließlich der Testdaten; Bereich wechseln mit Tastatur; Bild öffnen → Zoom/Verschieben → Escape/X → unveränderter Auswahl-/Scrollkontext. Geheimen Testbereich, SL-Text und unveröffentlichte Bildquellen dürfen Spieler nicht erhalten.

Die Integration prüft zusätzlich die serverseitige HTML-Bereinigung, unveränderte Klartexte, Ablehnung ungültiger Eingaben ohne Überschreiben, private Bildantworten, Sofortsperre sowie unveränderte bereits vorhandene Entities, Mitgliedschaften und Spielercharaktere.

## Ergebnis der ersten lokalen Abnahme (vor der Folgekorrektur)

- 239 Unit-/Schema-Tests bestanden, einschließlich der neuen HTML-, Zeichenlimit- und Entwurfsregressionen.
- Vollständiger isolierter HTTP-Lauf: 1405 Prüfungen bestanden, zusätzlich 46 Rollen-/Migrationsprüfungen und der atomare Batch-Rollback-Test. Die neuen Bereichsprüfungen sind in diesem Lauf enthalten.
- TypeScript, ESLint für die geänderten Quelldateien, Produktionsbuild und `git diff --check` erfolgreich. Der Build meldet weiterhin die vorhandene Warnung zu großen Chunks und einen Vinext-Hinweis zur Routenklassifizierung; kein Buildfehler.
- Getrennte synthetische SL-/Spieleranmeldungen im lokalen Browser geprüft. Spieler erhalten weder den geheimen Testbereich noch SL-Texte, SL-Freigabeaktionen oder unveröffentlichte Entwurfsinhalte. Freigegebene Bilder bleiben für sie vergrößerbar.
- Desktop 1440 px, Tablet 834 px sowie Mobil 390/320 px geprüft: keine horizontale Seitenüberbreite, schmale Ansichten einspaltig. Desktop-Navigation 260 px; Bereichsdetail etwa 1026 px. Neben dem 400-px-Bild hat der Text etwa 536 px, darunter bis 75 ch (hier 737 px). Fließtext 16 px/1,65, Einleitung 18 px/1,6, Inhaltsüberschriften 24/20 px.
- Bereichsnavigation mit Pfeiltasten, Bildöffnung, 100–400-%-Zoom, Verschieben mit Maus/Pfeiltasten/Schaltflächen, Einpassen sowie X/Escape geprüft. Fokus kehrt zum Auslöser zurück; bei bereits sichtbarem Auslöser blieb die Dossier-Scrollposition unverändert.
- HTML eingefügt, Vorschau angezeigt, zwischen visueller und Quelltextansicht gewechselt, gespeichert und erneut geöffnet. Alle vier freigegebenen Klassen bleiben erhalten; Skripte werden entfernt. Auch ein ungültiger HTML-Entwurf bleibt nach Wechsel zwischen CMS-Reitern unverändert korrigierbar, statt als Klartext oder alter gültiger Stand gespeichert zu werden.

Lokale Antwortzeit-Stichprobe mit synthetischem Spieler, je zehn aufgewärmte Aufrufe einschließlich Antwortkörper: Dossier 16,8 ms Median (15,0–26,9 ms, 3661 Bytes), geschütztes Bild 32,2 ms Median (22,8–37,8 ms, 148389 Bytes). Beide Antworttypen wurden auf private, nicht speicherbare Antworten geprüft. HTML-Konvertierung eines 1000-Zeichen-Beispiels: im Mittel 0,47 ms bei 100 Durchläufen. Dies sind ausschließlich lokale Messwerte, keine Live-Latenzen, Lighthouse-Ergebnisse oder Core-Web-Vitals.

Prüfgrenzen: Chromium-basierter Desktop-Browser mit schmalen Viewports, keine Prüfung auf physischem Smartphone, in Safari oder mit Screenreader; keine formale WCAG-Zertifizierung. Der abschließende Design-Detektor nennt drei bereits vorhandene Merkmale (Schmuckkante einer Hinweisbox, SL-Kennzeichnung und Arial-Fallback). Diese bleiben zugunsten der bestehenden Identität und des begrenzten Auftrags unverändert.

Eingesetzte Design-, Typografie-, Accessibility- und Sicherheits-Skills führten insbesondere zur lesbaren Textbreite, der Tastatur-/Fokusrückgabe der Lightbox sowie zur doppelten HTML- und Dokumentvalidierung. Zusätzliche unabhängige Layout-/Quelltextprüfungen erfolgten ohne Änderungen durch die Prüfer.

Lokal abnahmebereit: **JA**. Keine Migration, kein Commit/Push, kein Deployment und keine Änderung bestehender Produktionsdaten. Die synthetische Vorschau ist keine echte Spielerabnahme auf Produktion.

## Folgekorrektur: feste Bild-/Einleitungszeile

Der frühere Desktop-Float ist entfernt. Der erste zusammenhängende, explizit mit `cp-intro` markierte Blockabschnitt erscheint neben dem unverändert großen Vorschaubild. Ein vollständig als Einleitung markierter Inline-Span wird ebenfalls unterstützt; eine nur teilweise hervorgehobene Passage führt nicht dazu, dass ein kompletter normaler Absatz verschoben wird. Weitere Textabschnitte und spätere separate Hervorhebungen bleiben in ihrer Reihenfolge im unteren Beschreibungsbereich.

Ohne `cp-intro` steht die gesamte Beschreibung unter dem Bild. Ohne Bild wird keine leere Bildspalte reserviert. Ohne Bild und Einleitung entfällt die Öffnungszeile vollständig. Lange Einleitungen vergrößern ihre Zeile ohne Abschneiden oder feste Höhe; auf schmalen Flächen folgen Bild, Einleitung und Beschreibung untereinander.

Die Aufteilung erfolgt ausschließlich beim Lesen über das bereits validierte Rich-Text-Modell. Keine Änderung gespeicherter HTML-Dokumente, kein automatisches Umschreiben von Klartext, keine Änderung des Editors, der Klassen-Allowlist, der Sichtbarkeit oder der Lightbox. Regressionstests prüfen vollständige Block-/Formatierungserhaltung, lange und mehrteilige Einleitungen sowie unmarkierte Bestandsinhalte.

Browserprüfung mit synthetischer Spielerrolle bei 1440/834/390/320 px bestanden: keine geheimen Testinhalte und kein horizontales Überlaufen. Bei kurzer Einleitung ist die Öffnungszeile 306 px hoch (Bild einschließlich Öffnen-Leiste); die Beschreibung startet 24 px darunter. Bei langer Einleitung wächst die Zeile auf 333 px; die Beschreibung beginnt wiederum 24 px unter der gesamten Zeile. Die untere Beschreibung nutzt 960 px Containerbreite im geprüften Desktopfall, unabhängig von der 400-px-Bildspalte. Tablet und Mobil stapeln Bild, Einleitung und Beschreibung; Klartext ohne Bild reserviert keine Öffnungszeile. Lichtbox-Öffnung, Zoom, Escape und Tastaturnavigation weiterhin funktionsfähig, keine Browserfehler aufgezeichnet.

242 Unit-/Schema-Tests einschließlich der neuen Aufteilungsfälle sowie TypeScript und gezieltes ESLint bestanden. Der vollständige isolierte Lauf mit 1405 Integrationsprüfungen, 46 zusätzlichen Rollen-/Migrationsprüfungen und atomarem Batch-Rollback ist ebenfalls grün. Die unabhängigen Layout-/Typografiechecks bestätigen die strukturelle Trennung und den ausschließlich lokalen CSS-Scope. Die drei bereits dokumentierten Design-Detektorhinweise betreffen weiterhin unveränderte Bestandsstile, keine neue Layoutlücke.
