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

## Leseverfeinerung vom 19.10.2026

Lokaler Ausgangsstand: `68b644517ce0ccace7f05e8b0e1a4752a5fadfe5`. Der Auftrag betrifft ausschließlich die Bereichs-Lesedarstellung und deren Umbrucherhaltung. Keine Migration, keine neuen Abhängigkeiten, keine Änderung von Produktivdaten oder Freigaben und keine neuen Editorfunktionen; kein Commit/Push oder Deployment in diesem Schritt.

Gestaltung: ruhige Leseakte statt weiterer verschachtelter Bild-/Textkarten. Die vorhandene Serifenschrift bleibt für den Bereichstitel; Absätze nutzen die vorhandene Sans-Serif-Schrift mit 16 px/1,6 und maximal 70 ch. Inhaltsüberschriften sind 23/18 px groß. Dezentere Flächen, zurückhaltende Bereichsauswahl, erkennbare Listenzeichen und eine kompakte SL-Aktionszeile ersetzen die optisch dominanten Rahmen. Die bestehenden beiden Freigabeaktionen bleiben erhalten, einschließlich deaktiviertem Zustand und mindestens 44 px Höhe. Design- und Typografie-Skills sowie getrennte Layout-/Textprüfungen haben diese zurückhaltende Richtung bestimmt; kein produktweiter Stilwechsel.

Bild und ausdrücklich markierte Einleitung bleiben eine eigene Zeile; der vollständige Text folgt darunter. Auf schmalen Flächen stehen Bild, Einleitung und Beschreibung untereinander. Lightbox, geschützte Bildquellen und Tastaturnavigation werden weiterverwendet.

Lesefluss: Nur diese beiden Bereichs-Reader aktivieren die neue optionale Darstellung. Einrückungsbedingte Zeilenwechsel in validierten Rich-Text-Dokumenten werden beim Anzeigen als normaler Wortzwischenraum behandelt. Speicherung, Importmodell und Editoroberfläche bleiben unverändert. Klartext und ungültige historische Rich-Text-Werte behalten ihre bisherige Darstellung. Der bestehende HTML-Ausgabeweg erhält separat gespeicherte harte Umbrüche jetzt ausdrücklich als `br`, damit sie beim Export/Reimport nicht mit folgendem eingerücktem Text verschmelzen. Regressionen prüfen auch ein bzw. zwei Leerzeichen oder einen Tab nach dem Umbruch; es wird kein bestehender Datensatz automatisch gespeichert oder konvertiert.

Kompatibilitätsgrenze: Das bestehende v1-Textformat unterscheidet nicht in jedem Fall zwischen einem HTML-Quelltextumbruch und einem beabsichtigten Umbruch. Separat gespeicherte Umbrüche und mehrdeutige nicht eingerückte Umbrüche werden daher konservativ erhalten, auch nach HTML-Export/Reimport. Eine beabsichtigte, innerhalb desselben Textteils eingerückte Zeile kann nicht zuverlässig von Quelltexteinrückung unterschieden werden. Es findet kein Umschreiben oder Löschen gespeicherter Texte statt.

Lokale Browserprüfung mit getrennten synthetischen Spieler-/SL-Konten: Desktop 1440 px, Tablet 834 px und Mobil 390/320 px ohne horizontales Überlaufen. Desktop-Absätze haben im Test 623 px Lesebreite, Einleitungen daneben 524 px; gemessen 16 px Schrift und 25,6 px Zeilenhöhe. Expliziter Testumbruch bleibt zweizeilig; Klartext bleibt `pre-wrap`. Lange Einleitungen wachsen ohne Überlappung; die Beschreibung beginnt 32 px unter der gesamten Öffnungszeile. Spieler erhalten weder geheimen Testbereich noch SL-Text oder Freigabeschaltflächen. Die kompakte SL-Zeile ist im Desktopfall 61 px hoch, ihre Schaltflächen jeweils 44 px. Bereichswechsel mit Pfeil-/Home-Taste, Bildöffnung per Enter, Escape und Fokusrückgabe geprüft; keine Browserfehler aufgezeichnet.

Prüfgrenzen: Chromium-Desktop mit schmalen Viewports, kein physisches Mobilgerät/Safari und keine formale Screenreader-/WCAG-Abnahme. Der abschließende Design-Detektor nennt nur die drei bestehenden Merkmale außerhalb der verfeinerten Bereichs-Lesestile: zwei SL-/Hinweis-Schmuckkanten und den vorhandenen Arial-Fallback. Keine automatische Änderung dieser übrigen Oberflächen.

Abschließender Stand einschließlich Umbruch-Roundtripkorrektur: 246/246 Unit-/Schema-Tests, TypeScript, gezieltes ESLint und Produktionsbuild bestanden. Der erneut ausgeführte vollständige Lauf meldet 1405 Integrationsprüfungen, 46 zusätzliche Rollen-/Migrationsprüfungen und erfolgreichen atomaren Batch-Rollback, ausschließlich auf frischen lokalen Testressourcen. Die abschließende Browserkontrolle des neu gebauten Standes bestätigt sichtbare Listenzeichen, den expliziten Umbruch, keine Seitenüberbreite und keine Browserfehler. Die bekannten Buildhinweise zu Chunkgröße und Vinext-Routenklassifizierung bleiben ohne Buildfehler bestehen. `git diff --check` erfolgreich. Lokal zur visuellen Abnahme bereit; nicht committed, gepusht oder live veröffentlicht.

## Aktuelle Layoutkorrektur: durchgehende Textspalte

Auf ausdrücklichen Nutzerwunsch ersetzt eine feste Bild-/Textaufteilung die vorherige Einleitungszeile: Auf breiten Flächen steht das Bild links oben, rechts stehen Einleitung, Beschreibung, Kontext und Raumhinweise untereinander. Kein Beschreibungstext fließt unter das Bild. Die freie linke Fläche erhält noch keine Statusanzeigen, Platzhalter oder künstliche Mindesthöhe. Bereichsweite SL-Steuerung und SL-Notizen bleiben oberhalb der Inhaltsaufteilung; Sichtbarkeit und Inhalte bleiben unverändert.

Ohne Bild entfällt die Bildspalte vollständig; auch ohne markierte Einleitung bleibt die Beschreibung auf breiten Flächen rechts. Auf Tablet/Mobil folgt die gesamte Textspalte unter dem Bild, ohne schmale Restspalte. Diese Präzisierung folgt der Nutzerfreigabe statt einer zusätzlichen Layoutvariante; die Design-Skills unterstützen die stabile Spaltentrennung und die mobile Lesbarkeit.

Browsernachweis mit synthetischen Daten: Bei 1440 px Bildspalte 400 px, Textspalte 524 px; sämtliche Beschreibungsblöcke beginnen rechts, die Fläche unter dem 306 px hohen Bildbutton bleibt frei. Bei 1152 px beträgt die Textbreite 392 px; auch Raumhinweise und SL-Raumaktionen bleiben darin ohne Seitenüberbreite. Eine lange Einleitung vergrößert nur die Textspalte (hier 572 px), nicht den Bildbutton. 834/390/320 px stapeln die Spalten ohne horizontales Überlaufen; Fließtext bleibt 16 px. Bereich ohne Bild nutzt die volle verfügbare Textbreite. Lightbox per Enter, Escape und Fokusrückgabe weiterhin geprüft; keine Browserfehler.

247 Unit-/Schema-Tests einschließlich neuer Strukturregression, TypeScript, gezieltes ESLint, Build und Layout-Detektor bestanden. Die vorhandene HTTP-Integrationsabnahme steht im vorherigen Abschnitt; sie wurde für diese rein lokale JSX-/CSS-Anordnung nicht erneut ausgeführt. Keine Migration, Änderung von Produktionsdaten, Veröffentlichung oder neue Statusfunktion.

## Freigegebene Veröffentlichung vom 19.10.2026

Nach der visuellen Abnahme wurde der Push samt Live-Veröffentlichung dieser Überarbeitung freigegeben. Ausgangscommit bleibt `68b644517ce0ccace7f05e8b0e1a4752a5fadfe5`; veröffentlicht werden ausschließlich die acht zugehörigen Quell-, Test- und Dokumentationsdateien, ohne Migration, Import oder produktiven Schreibtest.

Erneutes Release-Gate: 247/247 Unit-/Schema-Tests, TypeScript und gezieltes ESLint erfolgreich. Der vollständige isolierte HTTP-Lauf wurde nun ebenfalls wiederholt: 1405 Integrationsprüfungen, 46 zusätzliche Rollen-/Migrationsprüfungen und atomarer Batch-Rollback bestanden. Git-Zielbranch und aktive Produktionsversion entsprechen dem erwarteten Ausgangsstand. Eine frische vollständige D1-Sicherung wurde lokal einschließlich FTS-Wiederaufbau wiederhergestellt; Integrität `ok`, keine Fremdschlüsselverletzungen. Private Sicherung und spätere Veröffentlichungs-/Live-Nachweise bleiben Git-ignoriert unter `.local-work/location-reading-release-20261019/`.
