# Ortsverwaltung: Bereiche und Räume anlegen

Stand: 26.10.2026, lokale Korrektur auf `codex/m1-kernmodell`, Ausgangscommit `105d064cf505eb42eb961fec2414a98d796a32d4`.

## Befund

Das bestehende Modell und die API unterscheiden bereits `location`, `area`, `room` und `information`. Der bisherige Button „Bereich“ erschien ausschließlich beim markierten Hauptort. Beim markierten Bereich „Bahnhofsvorplatz“ erschien nur „Raum“. Das erklärt die beobachtete Ansicht; die Funktion fehlte nicht serverseitig, war aber zu stark von der aktuellen Baumauswahl abhängig und unklar beschriftet.

Der vorhandene Schreibpfad prüft schon serverseitig: Bereich direkt unter einem bestehenden Hauptort, Raum unter einem bestehenden Bereich, Erkenntnis beim Hauptort. Fremde/fehlende Eltern und unzulässige Verschachtelungen werden abgelehnt. Daran wurde nichts geändert.

## Gezielte Korrektur

- „Bereich hinzufügen“ bleibt für den ausgewählten bestehenden Hauptort verfügbar, auch bei markiertem Bereich, Raum oder Erkenntniseintrag. Das sichtbare Ziel heißt „Hauptort: …“. Damit können weitere gleichrangige Bereiche entstehen, ohne versehentlich den markierten Bereich als Elternknoten zu verwenden.
- „Raum hinzufügen“ erscheint bei ausgewähltem Bereich und zeigt „Bereich: …“ als Ziel.
- Dropdown und Baum kennzeichnen Hauptorte ausdrücklich als „Hauptort“.
- Das vorhandene Anlageformular wiederholt den tatsächlichen Elternknoten vor dem Absenden und benennt die Aktion konkret: „Bereich anlegen“, „Raum anlegen“ usw. Die bestehenden stabilen IDs werden über denselben API-Schreibpfad verwendet; kein Rückfall auf die Anlage eines Hauptortes bei fehlendem Elternknoten.
- „Neuer Hauptort“ und „Neue Erkenntnis“ bleiben separate Aktionen. Neue Inhalte bleiben unveröffentlichte Entwürfe.
- Die Design-/UX-Skills führten zu verbbasierten Beschriftungen, sichtbarer Zielzuordnung, ausreichend großen Schaltflächen und einer begrenzten Formular-Layoutkorrektur. Während der Anlage darf das Verzeichnis mitwachsen; der Baum wird auf Tablet nicht mehr auf 0 px verdrängt. Keine neue Navigation oder allgemeines CMS-Redesign.

Keine Schemaänderung, Migration, neue Objekttypen, Datenübernahme, automatische Freigabe oder Änderung gespeicherter Bestandsinhalte. Der neue reine Frontend-Helfer löst nur vorhandene Eltern-IDs auf; er ist kein weiteres Datenmodell.

## Nachweise

253 Unit-/Schema-Tests einschließlich sechs neuer Tests für Elternauflösung, Geschwisterbereiche, Raumziele, eigenständige Erkenntnisse, ungültige Ziele und unveränderte Knoten bestanden. TypeScript, gezieltes ESLint und Build bestanden; bekannte nicht blockierende Vinext-Buildhinweise bleiben bestehen. Layout-Detektor und `git diff --check` ohne Befund.

Vollständige isolierte HTTP-Integration: 1425 Prüfungen sowie 46 zusätzliche Rollen-/Migrationsprüfungen und atomarer Batch-Rollback bestanden. Der neue Abnahmetest stellt einen bestehenden synthetischen Hauptbahnhof mit veröffentlichtem Bahnhofsvorplatz und privatem Bild bereit und legt anschließend Empfangshalle und Warteraum an. Er vergleicht Hauptortbestand, alte Knoten/Positionen, Beschreibungen, Bildreferenzen, Revisionen und Freigaben vor/nach der Anlage. Die bestehenden Werte bleiben gleich. Neue Entwürfe werden nicht automatisch an Spieler ausgeliefert; Spieler-Schreibversuche und unzulässige Eltern werden abgewiesen.

Browser-Abnahme mit eigener synthetischer SL-Anmeldung und lokalem Testbestand:

1. Hauptort „Hauptbahnhof Kleve“ auswählen → „Bereich hinzufügen“ zeigt den Hauptort als Ziel → „Empfangshalle“ anlegen.
2. „Bahnhofsvorplatz“ und „Empfangshalle“ erscheinen als Bereiche mit identischer Einrückung (10 px) unter demselben Hauptort.
3. Empfangshalle auswählen → „Raum hinzufügen“ zeigt Empfangshalle als Ziel → „Warteraum“ anlegen. Er erscheint eine Ebene tiefer (20 px).
4. Bei markiertem Bahnhofsvorplatz bleibt „Bereich hinzufügen“ mit dem Hauptort als Ziel verfügbar. Eingabe abbrechen: kein weiterer Knoten entsteht.
5. „Neue Erkenntnis“ öffnet weiterhin das eigenständige Formular; keine Umdeutung zum Bereich oder Raum.
6. Neu laden und Hauptort erneut auswählen: die Hierarchie bleibt erhalten, es gibt keinen zusätzlichen Hauptort. Desktop 1440 px, Tablet 834 px sowie Mobil 390/320 px geprüft; kein horizontales Überlaufen. Die Erstellungsaktionen sind per Tastatur erreichbar. Bei geöffnetem Tablet-Formular bleibt mindestens 120 px Baumfläche, auf Mobil im Test 236 px; Schaltflächen 44–55 px hoch. Keine Browserfehler aufgezeichnet.

Der getestete Hauptbahnhof ist ausdrücklich ein isoliertes synthetisches Objekt, keine Kopie oder Änderung des realen Produktionsortes. Auf Produktion wurde keine Empfangshalle und kein Raum angelegt. Keine echten Konten verwendet, keine Freigaben umgestellt. Keine Prüfung auf physischem Mobilgerät/Safari und keine formale WCAG-Zertifizierung.

Lokale Vorschau: `node scripts/test-local.mjs --location-areas`, danach `/sl/command-center?bereich=ortscms` öffnen und „Hauptbahnhof Kleve“ wählen. Der vorhandene Testläufer liefert nur frische lokale D1-/R2-Ressourcen; Vorschau und vollständige Integration nicht gleichzeitig ausführen.

Lokal abnahmebereit: JA. Die anschließende Live-Veröffentlichung wurde am 26.10.2026 gesondert beauftragt. Sie umfasst ausschließlich diese Korrektur einschließlich Tests und Dokumentation; keine Migration, Datenübernahme oder Anlage von Produktions-Testorten. Private Sicherungs- und Release-Nachweise liegen unter `.local-work/location-creation-release-20261026/` und werden nicht mit veröffentlicht.
