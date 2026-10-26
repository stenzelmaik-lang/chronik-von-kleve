# ChroniPlay – Chronik von Kleve

Private Pre-Alpha für die bestehende Spielrunde. Stand: **26. Oktober 2026**.

Die Anwendung läuft mit React/Vinext auf Cloudflare Workers, D1 und privatem R2-Speicher. Bestehende ChroniPlay-Konten und serverseitige Rollen steuern den Zugang.

## Aktueller Entwicklungsstand

- M1-Kernmodell: Entities, Content-Blöcke, Beziehungen und getrennte Spieler-/SL-Projektionen.
- NPC-Akten: Karten, Lesedossier, Bearbeitung, Bilder und gezielte Inhaltsfreigaben.
- Codex: Bibliothek mit 15 Quellen, Reader, Originalseiten, Kapitel und Volltextsuche; Inhalte und Suchergebnisse bleiben geschützt.
- Spieltisch: Sitzungen, Szenen, Medien, Würfel und gemeinsames Whiteboard. Für zuverlässige Bildschirmübertragung über das Internet ist weiterhin ein Relay erforderlich.
- Ortsverwaltung: Hauptorte → Bereiche → Räume, HTML-Beschreibungen, geschützte Bilder und Freigaben.
- Ortsdossier 2.0: getrennte Spieler-/SL-Ansicht, formatierte interne Kapitel, Suche und lesender Schnellzugriff vom Spieltisch.

Der frühere README-Verweis auf Sites-Version 39 beschreibt den historischen Ausgangspunkt, nicht den heutigen Funktionsstand. Der Hauptbranch enthält die zusammengeführten Entwicklungsstände; ein GitHub-Commit allein ist kein Nachweis einer Live-Veröffentlichung.

## Dokumentation

- [Projektstatus und Abnahmegrenzen](docs/PROJECT_STATUS.md)
- [Dauerhaftes Ortsdossier-System: lokale Erweiterung und offene Abnahme](docs/ortsdossier-system.md)
- [Ortsdossier 2.0: Bedienung, Datenerhalt und Prüfungen](docs/location-dossier-2.md)
- [Release-Markierung Ortsdossier 2.0](https://github.com/stenzelmaik-lang/chronik-von-kleve/tree/pre-alpha-2026-10-26-ortsdossier-2) – wird erst nach erfolgreicher Veröffentlichung gesetzt.

## Entwicklung und Prüfungen

Node.js ab 22.13, Abhängigkeiten laut Lockfile. `pnpm run typecheck`, `pnpm run build` und `pnpm run test:integration` prüfen Typen, Build und den isolierten lokalen HTTP-Ablauf. Für sämtliche Unit-/Schema-Tests alle `tests/*.test.mjs` mit dem Node-Test-Runner ausführen; das historische `pnpm test` führt nur eine Teilmenge aus.

Lokale Tests verwenden eigene D1-/R2-Bestände und synthetische Konten. Private Importbestände, Sicherungen, Zugangsdaten und Release-Protokolle gehören nicht ins Repository. Produktionsänderungen erfolgen nur mit gesonderter Ausführungsfreigabe.
