# ChroniPlay – überprüfbarer Projektstand

Stand der Dokumentation: **26. Oktober 2026**. Dieser Stand ersetzt die veraltete Orientierung allein an Sites-Version 39 beziehungsweise dem GitHub-Hauptbranch vom 3. Oktober.

## Implementierte Bereiche

| Bereich | Gesicherter Meilenstein | Aktueller Umfang / Grenze |
| --- | --- | --- |
| Charakter-Grundlage | `c8c1648` | Ausgangspunkt des bisherigen Hauptbranches; vorhandene Charakterdaten bleiben erhalten. |
| M1-Kernmodell | `3e8da2f` | Entities, Status/Spielstatus, Content-Blöcke, Beziehungen, `replaced_by`, serverseitige Geheimnistrennung. |
| NPC v1 | `a4a0cd0`, weitere Folgecommits | Charakterkarten und Akten, getrenntes Lesen/Bearbeiten, Bilder, Feldfreigaben und Spielervorschau. |
| Codex v1 | `e1bf1ae` | 15 vorbereitete Quellen, Reader/Originalseiten, Kapitel, Suche, Buchfreigaben und serverseitige Sperre. Technischer Zugriff ist kein Lizenznachweis. |
| Spieltisch / Whiteboard | `aa21c68` bis `1a74279` | Sitzungs-/Szenenablauf, Medien, Würfel und gemeinsames Zeichenbrett. Voice/Webcam sind nicht als fertig abgenommen dokumentiert; ein Internet-Relay fehlt weiterhin. |
| Ortsdarstellung / Hierarchie | `3c35c4b` bis `2e1c024` | HTML-Lesedarstellung, Bild-Lightbox, Hauptort → Bereich → Raum und eindeutiges Erstellungsziel. |
| Ortsdossier 2.0 | Commit dieser Zusammenführung | Spieler-/SL-Umschaltung, interne HTML-Kapitel, Schnellübersicht, Suche und lesender Seitenbereich im Spieltisch. |

Die vollständige Commit-Historie ist maßgeblich. Die Tabelle bündelt Funktionsbereiche und behauptet keine zusätzliche Abnahme nicht geprüfter Funktionen.

## GitHub und Live-Stand

Vor dieser Zusammenführung lag `main` bei `c8c16483a8acaa927f5a669ddcbd7fd0b9b19c33` vom 3. Oktober 2026. `codex/m1-kernmodell` lag ohne divergierende Hauptbranch-Commits 24 Commits voraus. Diese bereits gesicherten Entwicklungsstände werden zusammen mit dem geprüften Ortsdossier erhalten und auf `main` zusammengeführt; kein Squash und kein Umschreiben bestehender Commit-IDs.

Die letzte vor diesem Auftrag verifizierte Veröffentlichung war `2e1c0245027032293945b81330608ca3e34a8658`. Der neue Live-Stand wird nach erfolgreicher Veröffentlichung durch den annotierten Tag [pre-alpha-2026-10-26-ortsdossier-2](https://github.com/stenzelmaik-lang/chronik-von-kleve/tree/pre-alpha-2026-10-26-ortsdossier-2) und den zusammengeführten Pull Request belegt. Das Tag wird erst nach Live-Prüfung gesetzt; ohne Tag darf dieser Text nicht als Deployment-Nachweis verwendet werden. Backup-, Worker-Versions- und Integritätsnachweise bleiben privat.

## Ortsdossier-Abnahme

- 261 Unit-/Schema-Tests, 1.456 HTTP-Integrationsprüfungen und 46 zusätzliche Rollen-/Migrationsprüfungen; atomarer Rollback geprüft.
- TypeScript, betroffene ESLint-Dateien, vollständiger Build und Diff-Prüfung.
- Lokale Browserprüfung als synthetischer SL und Spieler: Ansichtstrennung, vorhandene Bereichsauswahl, Kapitel, Suche, HTML-Speichern, unveränderte Alttexte, Tastatur, Fokus und mobile Darstellung bis 320 px.
- Spieltisch-Overlay erhält URL, Werkzeugauswahl, Würfelwerte und einen ungespeicherten Whiteboard-Entwurf. Kein erneutes Laden des Spieltischs.
- Keine Migration und keine automatische Änderung bestehender Ortsinhalte oder Freigaben.

Die lokale Rollenprüfung ersetzt keine echte Spielerabnahme auf einem physischen Mobilgerät. Bei der Veröffentlichung werden öffentliche/geschützte Endpunkte und die vorhandene SL-Sitzung zusätzlich lesend geprüft. Es werden keine synthetischen Testobjekte in Produktion angelegt.

## Geprüfte Erweiterung: dauerhaftes Ortsdossier-System

Auf Basis von `855ec4c` lokal erweitert: unabhängige SL-Kapitel (25.000 Zeichen), Tabellen/aufklappbare Abschnitte, mehrere private Medien, separate Entdeckung, Strukturpflege mit Archiv/Wiederherstellung, sichere Suche/Verknüpfungen und Export. Keine neue Datenbank, Migration oder Spieltischintegration. Einzelheiten und aktuelle Nachweise: [Ortsdossier-System](ortsdossier-system.md).

273 Unit-/Schematests, 1.544 Integrationsprüfungen, 46 Rollen-/Migrationsprüfungen und atomarer Rollback bestanden; TypeScript, ESLint und Build bestanden. Lokale Browserprüfung mit getrennten synthetischen SL-/Spielerkonten, HTML-/Tabellenbearbeitung, Speichern/Abbrechen, langen Kapiteln, Geheimnisschutz, Galerie, Suche/Rücknavigation und Desktop/Tablet/Mobil bis 320 px durchgeführt. Die Browsererweiterung blockiert allein die automatisierte Übergabe lokaler Upload-Dateien; API-Upload und Zugriffsschutz sind geprüft. Details und Prüfgrenzen stehen im verlinkten Nachweis.

Dieser Abschnitt ist **kein Live-Nachweis**. Der nach Veröffentlichung und Datenvergleich gesetzte Tag [pre-alpha-2026-10-26-ortsdossier-system](https://github.com/stenzelmaik-lang/chronik-von-kleve/tree/pre-alpha-2026-10-26-ortsdossier-system) und [Pull Request #23](https://github.com/stenzelmaik-lang/chronik-von-kleve/pull/23) identifizieren den gesicherten Stand. Private Backup-, Worker- und Integritätsnachweise bleiben außerhalb des Repositories.
