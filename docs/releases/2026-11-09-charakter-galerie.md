# Release 09.11.2026 (spätnachmittags): Nachträge Charakterbereich und Galerie

Freigabe des Besitzers (09.11.): „Live bringen“.

| | |
|---|---|
| Live-Codecommit | `672a060` auf `claude/navigation` |
| Worker-Version | `71f87d7f-bf2e-4388-af95-2f8589cdf5d7`, Tag `672a060-Charakter-Galerie` |
| Zeitpunkt | 2026-11-09T14:24:35Z |
| Vorversion | `754ca503-e1be-4cfc-bc7c-7ee390aed9c9` (Tag `48b094a-Gesamtstand`), vor dem Deploy geprüft: keine fremde Version dazwischen |
| Migration | keine |
| D1-Lesezeichen vor dem Deploy | `000001f1-00000c9e-0000511e-76801db21cc560e171dba01436aeffaf` |
| Konfiguration | unverändert (D1, R2, drei Variablen, `limits.cpu_ms=5000`) |

## Inhalt
Kampagnen links neben dem Kampagnennamen, Spieltisch nicht mehr in der Kopfleiste, keine doppelte Galerie-Kachel; Vorstellung als Texteditor, Vorstellung/Hintergrundgeschichte/„So spiele ich ihn“ zweispaltig mit Live-Vorschau; Entwicklung im Bogen-Rahmen, XP-Bereich lesbar; Tischprofil „Charakter“, „Kainskind der Chronik“, Beschreibung vor der Vorstellung, keine Galerie im Profil; „Charaktererstellung ansehen“ (schreibgeschützt) unter Weitere Aktionen; XP-Kachel mit Balken und direktem Sprung zur Entwicklung; Persönliches Archiv ohne SL-interne Dateien; Galerie mit „Bild hinzufügen“ (gleiche Bilderliste wie „Porträt & Referenzen“, freigegeben), höchstens 8 Bilder je Charakter.

## Prüfungen
Typecheck sauber; ESLint 0 Fehler in geänderten Dateien; `pnpm test` 411/411; Gesamtlauf 525/531 (6 bekannte Altfälle); Profil-Integration 35/35 lokal; Build grün; Probelauf mit Produktionsbindungen. Nach dem Deploy: `/anmelden` 200, `/spielbereich` 307, geschützte Routen 401; Fingerabdruck: alle neuen Oberflächentexte ausgeliefert, „Spielerzentrale“ und „Chronik erkunden“ nicht.

## Rückweg
`wrangler rollback 754ca503-e1be-4cfc-bc7c-7ee390aed9c9 --name chronik-von-kleve`. Formatierte Vorstellungen zeigt die Vorversion als Rohtext an.
