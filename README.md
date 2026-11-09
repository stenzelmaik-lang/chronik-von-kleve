# ChroniPlay – Chronik von Kleve

ChroniPlay verbindet Spieltisch, Live-Regie und Vorbereitung für Pen-&-Paper-Runden. Die geschlossene Alpha läuft mit der bestehenden Spielrunde von „Chronik von Kleve“. [ChroniPlay öffnen](https://chroniplay.cc/)

## Live-Stand und Weiterentwicklung

Der am **7. November 2026** abgeglichene Live-Stand ist als Quellcode auf GitHub gesichert. Neue Releases bauen auf diesem Stand auf. [Live-Quellbranch](https://github.com/stenzelmaik-lang/chronik-von-kleve/tree/codex/live-source-2026-11-07) · [Geprüfter Quellcommit `5e6ae31`](https://github.com/stenzelmaik-lang/chronik-von-kleve/commit/5e6ae3164e701538d8240671ae92bc549eeace9b)

Das **Abenteuerjournal (AJ-01)** liegt auf einem eigenen Entwicklungsbranch. Vor der Veröffentlichung wird es mit dem Live-Quellstand zusammengeführt und gemeinsam mit den bestehenden Figurenprofilen und Tischfunktionen geprüft. [Journal-Branch](https://github.com/stenzelmaik-lang/chronik-von-kleve/tree/claude/chroniplay-abenteuerjournal-23ec22)

## Funktionen der Alpha

- **Spieltisch.** Gemeinsame Bühne mit Würfeln, Whiteboard und Karte. Spieler öffnen Figuren- und Spielerprofile am Tisch und nutzen freigegebene Medien und Tonaufnahmen. Für zuverlässige Bildschirmübertragung über das Internet ist ein Relay erforderlich.
- **Live-Regie.** Die Spielleitung führt durch Szenen, liest Erzählung und Dialoge, spielt Material aus und sieht im Tischblick die laufenden Freigaben. Szenenwechsel beenden die bisherige Musik. Schnellzugriffe steuern Musik und Effekte, Zustandskarten zeigen die Werte der Runde.
- **Command Center.** Die Spielleitung bereitet Spielabende, Szenen, Material und Standardfiguren vor. In der Ortsredaktion pflegt sie Hauptorte, Bereiche, Räume und deren Freigaben und Kartenpositionen.
- **Spielwelt und Wissen.** Ortsdossiers und NPC-Akten haben getrennte Spieler- und SL-Ansichten. Der Codex bietet einen Reader und Volltextsuche für freigegebene Inhalte.

Die Anwendung nutzt React und Vinext auf Cloudflare Workers mit D1 und privatem R2-Speicher. ChroniPlay-Konten und serverseitige Rollen steuern den Zugriff.

## Dokumentation

- [Projektstatus und Abnahmegrenzen](docs/PROJECT_STATUS.md)
- [Dauerhaftes Ortsdossier-System: Funktionen und geprüfte Bedienung](docs/ortsdossier-system.md)
- [Ortsdossier 2.0: Bedienung, Datenerhalt und Prüfungen](docs/location-dossier-2.md)

## Entwicklung und Prüfungen

Vorausgesetzt sind Node.js ab 22.13 und die in `package.json` festgelegte pnpm-Version.

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm run build
pnpm run test:integration:run
```

Die lokalen Integrationstests verwenden eigene D1- und R2-Bestände mit synthetischen Konten. Private Importbestände, Sicherungen und Zugangsdaten bleiben außerhalb des Repositorys. Live-Veröffentlichungen erfordern eine gesonderte Freigabe.
