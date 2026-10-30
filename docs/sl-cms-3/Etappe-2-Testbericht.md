# SL-CMS 3.0 – Geführte Spielabend- und Szenenplanung

29.10.2026 · historischer erster Stand, ausschließlich lokal.

Die verbindlichen Korrekturen aus dem persönlichen Durchgang vom 30.10.2026 sind in [Etappe-2-UX-Nachbesserung.md](Etappe-2-UX-Nachbesserung.md) dokumentiert und ersetzen insbesondere die direkte Szenenschrittauswahl und das alte Textlimit.

## Freigabe und Umfang

Etappe 1 wurde durch den Projektleiter in diesem Entwicklungsauftrag persönlich abgenommen („soweit ist das abgenommen“). Anschließend wurde die geführte Anlage des gesamten Spielabends ausdrücklich beauftragt. Grundlage sind der bestehende Etappenplan und das freigegebene Konzept aus 01; ältere Chatbeiträge mit noch offener Abnahme werden durch diese direkte Entscheidung überholt.

Umgesetzt ist die Führung durch bestehende Daten und Speicherwege:

1. **Grunddaten:** Titel, optionaler Termin und vorhandener Kurzüberblick; Favorit/Anheften bleiben verfügbar.
2. **Szenen planen:** vorhandene Szenen zuordnen oder neue erstellen, geplante Reihenfolge kontrollieren und ändern. Originale bleiben referenziert.
3. **SL-Notizen:** private Hinweise für den gesamten Abend im bestehenden Rich-Text-Feld.
4. **Prüfen:** Ablauf und Zusammenfassung kontrollieren; optional bewusst als vorbereitet kennzeichnen; speichern und zur Lesübersicht zurückkehren.

Jede Szene nutzt ihre sieben vorhandenen Textfelder: Erzählung, Atmosphäre, NPCs/Dialoge, Interaktionen/Spielmaterial, Geheimnisse, Folgen/Proben und SL-Notizen. Die vorhandenen NPC-/Hinweisreferenzen und Szenenelemente bleiben verwendbar. Optionale Abzweigungen nutzen die vorhandenen `possibilities`; keine neue Ereignis- oder Würfelengine.

Die Schritte sind jederzeit direkt anwählbar und überspringbar. Leere optionale Bereiche erzeugen keine Ersatztexte. Beim Schrittwechsel wird der bestehende versionierte Schreibpfad verwendet. Bei Speicher-/Validierungs-/Versionsfehlern bleibt der aktuelle Schritt mit seiner Eingabe offen. Servernormalisierung wird übernommen, ohne während des Speicherns weitergeschriebene Eingaben zu überschreiben.

## Bedienung und Wiederaufnahme

- Neue Spielabende starten automatisch in der Führung, vorhandene Abende über „Spielabend bearbeiten“.
- Nach einer Szenenanlage aus der Führung kehrt „Speichern & zum Spielabend“ zur Szenenplanung desselben Abends zurück.
- Aktueller Schritt und Rückkehrkontext werden in der URL geführt; ein Neuladen stellt die passende Ansicht wieder her.
- Während der Bearbeitung treten Suche und Neuanlage zurück. Bestehende Archivieren-/Löschen-Aktionen sind unter „Aktenaktionen“ erreichbar.
- Der bestehende Editor bietet Visuell, HTML, sichere Vorschau und Fokusmodus. Die ergänzte HTML-Hilfe erläutert Absätze, Überschriften, Listen und vorhandene ChroniPlay-Klassen.
- Inhaltsgrenzen bleiben unverändert: Szenentexte 7.000 sichtbare Zeichen, Spielabendnotizen 10.000; keine stille Lockerung der Serverlimits.
- „Vorbereitet“ bleibt eine bewusste SL-Entscheidung. Das Abschließen der Führung startet keine Sitzung, aktiviert keine Szene und veröffentlicht nichts.

## Nachweise

| Prüfung | Ergebnis |
| --- | --- |
| Typecheck | bestanden |
| Gezielter ESLint einschließlich neuer Komponenten und Tests | bestanden |
| Bestehende Unit-/Regressionstests | 141 bestanden |
| Produktionsbuild | bestanden |
| Isolierte HTTP-Integration | 1.762 Prüfungen bestanden |
| Rollen-/Backfill-/Rollback-Proben | 46 bestanden |
| Bisheriger vollständiger Browser-Smoke | bestanden, an die Führung angepasst |
| Neuer Browserablauf zur geführten Anlage | bestanden |
| Mechanischer Designcheck der geänderten Vorbereitungsansicht | ohne Befunde |

Der neue Browserablauf weist tatsächlich nach:

- Ungültiger Titel hält die Grunddaten offen; ein gültiger Titel wird serverseitig normalisiert gespeichert.
- Spielabend und Szene werden über die Oberfläche angelegt und anhand ihrer IDs wiedergefunden.
- Alle sieben Szenenbereiche werden angesprungen, gültiges HTML mit Überschriften/Absätzen/Listen bleibt erhalten, ein optionaler Bereich bleibt bewusst leer.
- NPC-Zuordnung verwendet dieselbe Original-ID.
- Rückkehr aus der Szene öffnet die Szenenplanung desselben Abends; keine doppelte Zuordnung.
- Spielabendnotizen werden gespeichert und „Vorbereitet“ ausdrücklich gewählt. Szenenläufe und Veröffentlichungen bleiben leer.
- Neuladen stellt den Szenenschritt wieder her.
- 7.001 sichtbare Zeichen blockieren Speichern/Weiter; der ungültige Quelltext bleibt im Editor. Nach Korrektur funktioniert der Wechsel.
- Eine echte parallele API-Änderung erzeugt einen Versionskonflikt; lokaler Entwurf und parallel gespeicherte Serverdaten bleiben erhalten.
- Mobilansicht 390 px und CSS125 bei der Spielabendführung ohne horizontalen Überlauf; tatsächlicher nativer Browserzoom bleibt persönliche Prüfung.
- Eigenständig angemeldeter synthetischer Spieler erhält 403 für Spielabend- und Szenenvorbereitung.

Die lokale Testinstanz 8824 verwendet ausschließlich frische synthetische Daten. Der persönliche Abnahmestand auf 8822 wird separat persistent weitergeführt und wurde unter `.local-test/before-guided-preparation` gesichert. Keine produktiven Originaldaten wurden kopiert oder verändert.

Die GitHub-Prüfungskonfiguration wurde um den neuen Browserablauf erweitert. Diese Konfiguration wurde lokal vorbereitet; ein entfernter GitHub-Lauf oder Push wird hier nicht behauptet.

## Dateien und Grenzen

Hauptänderungen: `story-workspace.tsx`, `story-workspace.module.css`, `session-overview.tsx`, neue `preparation-guide.tsx`, deklarative Schrittdefinitionen in `domain/preparation-guide.ts`, angepasster bestehender Browser-Smoke und neuer `tests/preparation-guide-browser.mjs` sowie die zugehörige CI-Konfiguration.

Keine neue Tabelle, keine Migration, keine parallele Speicherung und keine Änderung des Spieltischlayouts. Die separate Material-Schnellvorschau aus Etappe 3 wird hier nicht als umgesetzt erklärt; vorhandene Materialreferenzen und Elementeditoren werden weiterverwendet. Die umfassende persönliche Gesamtabnahme mit Originalmaterial bleibt nach den vorgesehenen Etappen ausstehend.

Die interaktive lokale Ansicht ist auf `http://localhost:8822/sl/command-center?bereich=sitzung` erreichbar. Ein vorhandener lokaler Entwurf wurde im ersten Führungsschritt geöffnet, ohne seinen Inhalt zu verändern. Keine Veröffentlichung; Stopp zur persönlichen UX-Abnahme der Führung.
