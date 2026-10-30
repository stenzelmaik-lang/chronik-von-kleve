# SL-CMS 3.0 – Qualitätsprüfung der geführten Vorbereitung

30.10.2026 · Branch `codex/sl-cms-3` · ausschließlich lokal.

## Verbindlicher aktueller Durchgang

Der Projektleiter hat die grundsätzliche Szenenführung, HTML-Bereiche, Geheimnisse, Folgen/Proben und SL-Notizen bestätigt. Beauftragt ist die Qualitätsüberarbeitung der springenden Menü-/Bildauswahlen, der NPC-Auswahl und der Empfängerdarstellung. Die spätere umfassende Arbeit am Spielmaterial gehört ausdrücklich nicht zu dieser Etappe.

## Überarbeitete Bedienung

**Wechseln und Aktenaktionen:** Beide verwenden die bestehende portierte Popover-Komponente als begrenzten Schieber. Öffnen verändert weder die Höhe der Planungsleiste noch die Position der Inhaltsfläche. Jeweils nur einer der beiden Schieber ist geöffnet. Escape und Klick außerhalb schließen; der Tastaturfokus kehrt zum Auslöser zurück. Die aktuellen Archivieren-/Löschen-/Bestätigungswege und Berechtigungen bleiben erhalten. Nach Abbrechen einer Aktenaktion bleibt die Akte bestehen; das Menü wird bei erneutem Bedarf wieder bewusst geöffnet.

**NPCs:** Einheitlicher Auswahlschalter mit Icon und Öffnungsindikator, Suche im begrenzten Auswahlbereich, Bild-/Namenszeilen mit Auswahlzustand. Ausgewählte Original-NPCs stehen außerhalb als kompakte Einträge mit Entfernen-Aktion. Vorhandene Primärbilder werden verwendet, fehlende Bilder werden mit einem neutralen Personensymbol dargestellt. Es werden keine NPC-Kopien oder neuen Pflichtfelder angelegt.

**Bildgalerie / Bild anhängen:** Dieselbe begrenzte Oberfläche, Suchfeld und Miniaturen. Die Galerie schiebt den Editor nicht mehr nach unten. Größenbegrenzung und Kollisionsbehandlung halten sie im Fenster; Bilder bleiben lazy und über die vorhandenen authentifizierten Datei-Endpunkte geschützt. Auswählen schließt den Schieber. Textauswahl und Einfügen im bestehenden Rich-Text-Editor bleiben erhalten.

**Spieler und aktiver Charakter:** Die SL-Auswahl zeigt die tatsächlich gespeicherte aktive Kampagnenfigur zusammen mit dem Spielernamen, optional mit einem bereits für die SL lesbaren Charakterbild. Suche funktioniert über Figuren- und Spielernamen. Ohne gültige Auswahl steht ausdrücklich „Kein aktiver Charakter gewählt“; es wird weder eine beliebige erste Figur gewählt noch eine Kontoeinstellung verändert.

Die neue reine Leseprojektion unter `/api/messages?recipients=1&context=preparation` ist SL-geschützt. Sie liest die vorhandene Zuordnung in `auth_profiles.preferences.activeCharacters`, die genehmigte Kontoverknüpfung und die bestehenden Charakter-Originale. Eigentümer, Kampagne, Archiv-/Recovery-Status und vorhandene Entity werden geprüft. Es werden ausschließlich ID, Name und eine vorhandene zulässige Bildreferenz projiziert, keine Bogenwerte, Biografie oder SL-Texte. Der normale Empfänger-Endpunkt bleibt für Spieler unverändert.

## Erklärung der Botschaftsprüfung

„Baustein wählen“ greift auf vorbereitete Bausteine **dieser Szene** zu. Bewusst übernommen werden nur deren vorbereiteter Text und eine zugeordnete Datei. Andere Szenen und verknüpfte Originalakten werden dabei nicht automatisch kopiert.

„Empfänger & Botschaft prüfen“ zeigt die tatsächliche Nachricht mit Anhängen und gewählten Empfängern. Diese Kontrolle ist noch kein Versand. Erst „Privat zustellen“ erzeugt die persönlichen Nachrichten im bestehenden Postfach. Speichern, Weiter, Auswahl eines Spielers oder Öffnen einer Galerie stellen nichts zu. Die bisher geprüfte private Zustellung und der serverseitige Schutz der Anhänge bleiben unverändert.

## Qualität und Nachweise

- 145 Unit-/Regressionstests bestanden.
- Typecheck, gezielter ESLint der geänderten Komponenten/Serverpfade/Tests und Produktionsbuild bestanden.
- 1.787 vollständige isolierte HTTP-Integrationsprüfungen sowie 46 Rollen-/Backfill-/Rollback-Prüfungen bestanden.
- Neue Browserprüfungen messen unveränderte Leistenhöhe und Inhaltsposition beim Öffnen; gegenseitiges Schließen, Escape und anschließende Fokus-Rückkehr.
- NPC-Auswahl und Galerie funktionieren weiter per Tastatur; Original-IDs, HTML, Bildreferenzen und Materialtexte bleiben gespeichert.
- Empfängerauswahl zeigt die vom synthetischen Spieler selbst gespeicherte Figur. Serverseitig geprüft: nur Identitätsdaten; kein Zugriff durch normale Spieler auf die SL-Projektion; aktive Figurenwechsel werden übernommen; fremde Eigentümer und archivierte Figuren führen zu keiner ersatzweise geratenen Figur.
- Persönliche Zustellung wird weiter tatsächlich im Spielerpostfach geöffnet; nicht ausgewählte Spieler erhalten weder Nachricht noch private Datei.
- Bisheriger kompletter SL-Browserablauf bleibt Bestandteil: Anlage, Zuordnung/Reihenfolge, HTML/Vollbild, Speichern/Neuladen, Rücknavigation, Mobil, Rechte, Löschen und Abbrechen.
- Desktop 1920/1440 px, 390 px Mobil und CSS125; neue mobile Schieberbegrenzung geprüft. CSS125 ersetzt keinen nativen Browser-Zoomtest.
- Kurze Öffnungsbewegung respektiert `prefers-reduced-motion`. Die bestehenden Hauptbereiche und Materialfunktionen wurden nicht umgebaut.

Die Schreibprüfungen laufen ausschließlich auf frischen synthetischen lokalen Daten unter Port 8824 bzw. in der isolierten Integration. Die persönliche Abnahmeinstanz 8822 wird mit ihrem bisherigen Spielstand weitergeführt. Sicherung vor dem Eingriff: `.local-test/before-panel-quality-review-20261030`.

Keine neue Tabelle, keine Migration, keine Änderung produktiver Daten oder Konten, kein Import, kein Push/Merge und kein Deployment. Die neue Charakterprojektion verändert keine aktive Auswahl und erweitert keine Dateifreigabe. Die persönliche UX-Abnahme erfolgt an der bedienbaren lokalen Anwendung; danach Stopp.
