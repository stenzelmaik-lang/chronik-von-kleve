# SL-CMS 3.0 – Entwicklungsplan

Stand: 29.10.2026. Status: Umsetzung geplant; keine Etappe durch diesen Plan als implementiert oder abgenommen erklärt.

## Grundlage und Arbeitsbasis

- Auftrag: beigefügter Entwicklungsauftrag 01 plus ausdrücklicher Auftrag zur eigenständigen technischen Planung und Ergänzung von Lücken.
- Abgleich: jüngste verfügbare Beiträge aus „00 – Projektsteuerung“ (`6ac141cb-78c0-83ed-9cec-1b9c3de137f8`) und „01 – UX & Systemkonzept“ (`6aca8196-c29c-83eb-b1f7-c515bcdc5b4a`), insbesondere UX 3.0-B und der anschließende Umsetzungsauftrag.
- Geprüfter GitHub-main: `bf8a80ca1370ae274aa8b625d72e8e685d5efa37`, einschließlich Löschfunktionen aus PR #37 und Buildkorrektur aus PR #38. Kein Rückgriff auf den älteren Stand von PR #36.
- Separater lokaler Branch: `codex/sl-cms-3`; Worktree: `work/sl-cms-3` im Entwicklungsarbeitsverzeichnis. Bestehende Worktrees bleiben erhalten.
- Verbindlicher Ablauf: Spielabend auswählen → Übersicht lesen → Szene bearbeiten → Material prüfen → Vorbereitung kontrollieren → zurück zur Übersicht.
- Vorbereitung veröffentlicht nichts. Live-Regie und Grundlayout des Spieltischs bleiben außerhalb dieser Umsetzung. Produktive Veröffentlichung erst nach gesonderter Freigabe.

## Gezielter Codeabgleich

| Bestandteil | Befund | Konsequenz |
| --- | --- | --- |
| `StoryWorkspace`, Spielabende und Szenennavigation | Vorhanden; Öffnen zeigt unmittelbar gemeinsame Bearbeitungsoberfläche | Lesübersicht als Standard ergänzen; Editor ausdrücklich öffnen |
| Sieben Inhaltsbereiche | `SceneDocument` enthält bereits `narration`, `atmosphere`, `dialogueNotes`, `interactions`, `secrets`, `possibleConsequences`, `gmNotes` | Vorhandene Felder verwenden, kein neues Szenenmodell |
| Spielabendzuordnung | `SessionPreparation.sceneIds` und `SceneDocument.sessionIds`; Lesen/Entfernen berücksichtigen beide | Beide Bestandsformen lesen; explizite Reihenfolge aus `sceneIds` erhalten |
| Szenenreihenfolge | Katalog wird nach Titel/ID geladen, Übersicht gruppiert nach Ort | Geplante Reihenfolge statt alphabetischer oder ortsweiser Umsortierung anzeigen |
| Materialübersicht | Katalog liefert Elementtitel/-arten, aber keine vollständige NPC-/Dateizuordnung und keinen vollständigen Vorbereitungsbefund | Bestehende SL-Katalogantwort um kompakte Zusammenfassungen erweitern; keine Volltexte je Szene laden |
| Rich-Text und Fokus | Gemeinsamer `RichTextEditor`, Quelltext, Vorschau und Vergrößerung vorhanden | Wiederverwenden; tatsächlichen Speicherrundlauf prüfen, keine zweite Editorengine |
| Speicherung | Autosave, Versionsprüfung, Historie und Wiederherstellung vorhanden | Bestehende Mechanismen absichern; nicht neu bauen |
| Verknüpfungen und Löschen | Bestehende Referenzvalidierung, Entfernen von Zuordnungen und explizite Löschpfade vorhanden | Beibehalten; Material entfernen ist keine Löschung des Originals |

Geprüfte Schwerpunkte: `app/spielbereich/modules/story-workspace.tsx`, zugehöriges CSS, `domain/story-preparation.ts`, `domain/story-scene.ts`, `server/story-preparation.ts`, `server/story-scenes.ts`, bestehende command-center-Endpunkte und Browser-Smoke-Test. Keine erneute Gesamtinventur.

## Etappen und konkrete Abnahme

### 1 – Spielabendübersicht und Navigation

**Zuerst umsetzen; danach persönliche Sichtprüfung.**

- Einstieg zeigt vorhandene Spielabende und „Spielabend anlegen“. Öffnen führt zur Lesübersicht. „Spielabend bearbeiten“ öffnet die vorhandenen Metadaten ausdrücklich.
- Übersicht zeigt Titel, bestehenden Vorbereitungsstatus, Termin soweit vorhanden und Szenen in geplanter Reihenfolge. Schauplätze stehen bei den Szenen; ein fehlender Spielabend-Schauplatz ist kein Fehler.
- `sceneIds` bestimmt die Reihenfolge. Nur über `sessionIds` verknüpfte Bestandsszenen erscheinen zusätzlich, stabil sortiert und ohne schreibende Bestandskorrektur. Doppelte Zuordnungen erzeugen keine doppelten Karten. Schlanke Aktionen „Nach oben/unten“ nutzen das bestehende Array; kein Drag-and-Drop erforderlich.
- Pro Szene: Titel, Schauplatz, vorhandene Inhaltsbereiche, verknüpfte NPCs und Materialarten mit Namen sowie „Szene bearbeiten“. Unvollständige optionale Felder sind Hinweise, keine Sperren.
- Neue Szene übernimmt den geöffneten Spielabend. Eine fehlgeschlagene ergänzende Zuordnung führt zu einer verständlichen Meldung und einem Wiederaufnahmeweg zur bereits erstellten Szene, niemals zur stillen Neuanlage.
- „Zurück zum Spielabend“, „Neue Szene“ und Auswahl einer anderen Szene sind eindeutig. Bei mehrfach zugeordneter Szene führt der Rückweg zum tatsächlich aufrufenden Spielabend.
- Freie Szenen und Handlungsstränge bleiben als sekundärer Zugang erreichbar. Keine Daten anhand vermeintlicher Testnamen ausblenden oder löschen.
- URL, Browser-Zurück, Neuladen und aktuelle Auswahl passen zusammen; Rückkehr erhält den Kontext. Lade-, Leer-, Fehler- und Nicht-verfügbar-Zustände sind ausdrücklich darzustellen.

**Betroffene Teile:** StoryWorkspace, vorhandenes CSS, kleine Übersichtsprojektion im bestehenden Domain-/Serverpfad, zugehörige Typen und Tests. Keine geplante Tabellenmigration.

**Abnahme:** Spielabend öffnen → Übersicht lesen → Szene bearbeiten → speichern → zurück → andere Szene öffnen → Browser-Zurück/Neuladen. Reihenfolge, IDs, Inhalt und Verknüpfungen bleiben erhalten. Mindestens ein Legacy-Fall mit nur szenenseitiger Zuordnung und ein Fall mit zwei Spielabenden werden geprüft.

### 2 – Geführte Szenenbearbeitung und HTML

- Sieben frei anwählbare Bereiche, verständlich benannt. Vor/Zurück unterstützt die Bearbeitung; kein Pflichtassistent und keine Mindestbefüllung aller Bereiche.
- Vorhandene Originalfelder unverändert weiterverwenden. Optionale Abzweigungen verwenden bestehende Möglichkeiten beziehungsweise Unterszenen, soweit fachlich passend; keine Ereignisengine.
- Großer bestehender Editor mit visueller Ansicht, HTML, sanitisiertem Vorschaurendering und echtem Fokusmodus. Escape und Tastaturfokus funktionieren; gespeicherter Inhalt sieht wie die Vorschau aus.
- Kleine HTML-Hilfe: `h2/h3`, `p`, `ul/li`, vorhandene ChroniPlay-Klassen; keine künstlichen Zeilenumbruchketten oder Inhaltsumschreibungen.
- Aktuelle Grenzen sichtbar beachten: Szenentext 7.000 Klartextzeichen / 45.000 Eingabezeichen pro Feld, Spielabendnotizen 10.000 / 65.000. Fehler vor dem Verlassen verständlich anzeigen; Erweiterung nur mit begründetem, separat geprüftem Limit.

**Abnahme:** Alle sieben Felder mit Absätzen, Listen, Überschriften und erlaubten Klassen bearbeiten → Quelltext/Visuell/Vorschau wechseln → speichern → neu laden. Erlaubte Formatierung bleibt, gefährliches HTML wird entfernt. Bestehender Text wird beim Tabwechsel nicht ersetzt.

### 3 – Originalmaterial und private Schnellvorschau

- Vorhandene Ortsakten, NPCs, Bilder, Audio, Handouts und vorbereitete Proben über bestehende Referenzen/Elemente auswählen, austauschen und aus der Szene entfernen.
- Einheitlicher Bedienweg „Auswählen → privat prüfen → verknüpfen“. Geeignete vorhandene Akten-, Bild-, Audio- und Dokumentansichten wiederverwenden. Keine automatische Spielerfreigabe, kein Audio-Autoplay.
- Kompakte Materialspalte; Vorschau bedarfsgerecht öffnen. Audio beim Schließen beziehungsweise Wechsel stoppen. Ungeeignete Dateitypen, fehlende Dateien und fehlende Rechte nachvollziehbar anzeigen.
- Bei vorbereiteten Proben zuerst prüfen, ob der bestehende `check`-Elementtyp den benötigten Verweis trägt. Keine neue Proben- oder Würfelengine als Nebenaufgabe.

**Abnahme:** Vorhandenen Ort und Schäfer anhand ihrer IDs auswählen; Bild, Audio und Original-Handout privat prüfen, austauschen und lösen. Originale und sämtliche Spielerfreigaben bleiben erhalten.

### 4 – Speicherung und Abschlussprüfung der Vorbereitung

Diese Etappe bündelt die vertiefte Prüfung; Datenschutz, Versionierung und Schutz ungespeicherter Eingaben gelten bereits in Etappe 1.

- Speicherzustand ausdrücklich als Zustand führen: Ungespeichert / Speichert / Gespeichert / Fehler. Navigation und Autosave dürfen nicht von zufälligen Meldungstexten abhängen.
- Bei Bereichswechsel laufendes Speichern zuverlässig abschließen beziehungsweise Eingaben behalten. Bei Fehlern niemals „Gespeichert“ behaupten oder Navigation still fallenlassen.
- Parallele Änderungen liefern einen Konflikt mit erhaltenem eigenen Entwurf; kein automatisches Überschreiben durch den älteren Stand. Wiederherstellung betrifft Vorbereitung, nicht historische Freigaben oder Szenenläufe.
- Serverseitig zurückgelieferte, erlaubte normalisierte Inhalte und die aktuelle Version korrekt übernehmen, ohne inzwischen weitergeschriebene Eingaben zu verlieren.
- Vorbereitungsanzeige zeigt vorhandene Inhalte und offene Prüfhinweise. „Spielbereit“ ist eine bewusste Entscheidung der SL anhand des bestehenden Spielabendstatus; ein ausgefülltes Feld beweist keine inhaltliche Qualität.
- `ready`, aktive Sitzung, Kanonstatus und Spielerfreigabe bleiben unterschiedliche Zustände. Keine Freigabe oder Sitzungsaktivierung durch bloßes Speichern.

**Abnahme:** Zwei Browserfenster bearbeiten dieselbe Szene; Speichern während weiterer Eingaben; Verbindungsabbruch; Validierungsfehler; Neuladen; historische Vorbereitung wiederherstellen. Kein Textverlust, keine stillen Konfliktüberschreibungen, keine veränderte Freigabe.

### 5 – Gesamtabnahme am bestehenden Kasernenablauf

- Existierende IDs von Spielabend, Auftaktszene, Kaserne und Schäfer gezielt nachweisen; Titel allein gilt nicht als Identitätsnachweis. Keine zweite Kaserne oder Auftaktszene erzeugen.
- Schreibende Abläufe zunächst mit isolierten Testdaten; echte private Inhalte nur im ausdrücklich erlaubten Umfang lokal verwenden. Ein synthetischer Test ersetzt keine spätere persönliche Abnahme mit Originalmaterial.
- Vollständiger Ablauf: Übersicht → sieben Bereiche → Materialvorschau → speichern → neu laden → Übersicht. Originaldateien und bestehende Verknüpfungen kontrollieren.
- Desktop Full HD, 1440 px, 125 % tatsächlicher Browserzoom, schmaler Mobilviewport, Tastatur und Fokusmodus. Zoom nicht durch eine andere Fensterbreite als bewiesen erklären.
- Rollenprüfung mit getrennten autorisierten Testidentitäten: SL darf vorbereiten, Spieler und fremde Kampagnen erhalten weder private Inhalte noch Vorbereitungssuchtreffer. SL-Vorschau allein ist kein Spielerlogin-Nachweis.
- Relevante Domain-/HTTP-Integrationstests, Browser-Smoke, Typecheck, gezielter Lint und Produktionsbuild ausführen. Bestehende Tests an die ausdrücklich geänderte Lesübersicht anpassen, fachliche Assertions beibehalten.

**Abnahme:** Nachweisbarer vollständiger Vorbereitungsworkflow, persönliches UX-Ergebnis und konkrete Restfehler dokumentiert. Kein Livegang allein aufgrund dieses Plans.

## Ergänzte Lücken und technische Leitplanken

1. **Reihenfolge und Mehrfachzuordnung:** Alphabetische Katalogsortierung ist keine Spielplanung. Reihenfolge pro Spielabend führen; eine Szene kann mehreren Abenden gehören, ohne kopiert zu werden.
2. **Statusbegriffe:** Ausspielstatus ersetzt keinen Vorbereitungsstatus. Keine neue Status-Ontologie; zunächst vorhandene Spielabendwerte und transparente Inhaltsindikatoren verwenden.
3. **Ladeaufwand:** Für die Lesübersicht kompakte serverseitige SL-Zusammenfassungen liefern. Keine Anfrage für jedes einzelne vollständige Szenendokument. Volltexte und Medien erst bei Bedarf laden; Performance anhand tatsächlicher Messungen berichten.
4. **Erstellen und Entfernen:** Teilfehler dürfen keine verwaisten, unauffindbaren Szenen und keine Duplikate bei Wiederholung erzeugen. Verknüpfung entfernen, archivieren und endgültig löschen bleiben klar getrennt.
5. **Bestandskontext:** Kampagne, übergreifender Handlungsstrang und Spielabend nicht anhand des Titels „Der Hunger bleibt“ gleichsetzen. Tatsächliche IDs und vorhandene Beziehungen entscheiden.
6. **Geheimnisschutz:** Auch Namen, Vorschaubilder, Suchtexte und Fehlerantworten können private Informationen verraten. Prüfung umfasst diese Oberflächen und direkte Endpunkte, nicht nur sichtbare Tabs.
7. **Betrieb und Dokumentation:** Pro Etappe Änderungsumfang, Prüfresultate, Screenshots, bekannte Fehler und Datenmodellentscheidung aufschreiben. Abnahme offener Punkte nicht aus alten Berichten übernehmen. Lokale Commits sind kein GitHub-Push oder Deployment.

## Liefer- und Freigabeablauf

Jeweils eine Etappe: lokal implementieren → angemessen testen → Oberfläche prüfen → lokalen Commit und Etappenbericht bereitstellen → persönliche Sichtprüfung → nächste Etappe. Geplanter lokaler Branch steht bereit; dieser Plan ist der erste Liefergegenstand.

Für Etappen 1–4 ist nach dem gezielten Abgleich keine Tabellenmigration vorgesehen. Falls beim Umsetzen eine neue persistente Struktur zwingend erforderlich wird, Bedarf, Kompatibilität und Migration gesondert melden. Keine produktive Migration ausführen.

Vor einem später autorisierten Push/PR zuerst automatische Cloudflare-Auswirkungen kontrollieren. Die frühere Live-Erlaubnis anderer Aufträge ersetzt die aktuelle Vorgabe „keine Veröffentlichung ohne separate Freigabe“ nicht. Die bestehende Preview-Sperre wird für diese Arbeit nicht umgangen.
