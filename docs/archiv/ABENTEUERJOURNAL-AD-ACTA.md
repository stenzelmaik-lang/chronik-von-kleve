# Abenteuerjournal AJ-01 · ad acta

Stand 08.11.2026 · Entscheidung des Besitzers

## Was es war

Ein freistehendes, verschiebbares 3D-Buch auf dem Spieltisch (Three.js, prozedurale Materialien). Register „Chronik“ mit eigenen Notizen und datierten Chronikeinträgen sowie „Charakterbogen“ nach der deutschen V20-Papiervorlage. Dazu Lesezeichen, Eselsohren, Wachssiegel zum Speichern und ein CSS-Buch als Ersatz ohne WebGL. Gespeichert wurde in den vorhandenen Charakternotizen (`records`, `kind='notizen'`) mit den optionalen Feldern `journalKind` und `playDate`. Einzelheiten stehen in [AJ-01-Übergabe](../alpha-2/AJ-01-ABENTEUERJOURNAL-UEBERGABE.md) und im [Release-Bericht](../releases/2026-11-07-abenteuerjournal.md).

## Warum es nicht weiterverfolgt wird

1. **Bildsprache:** Braun, Leder und Messing passen nicht zur Bildsprache des Projekts (Dunkel, Teal, Gold).
2. **Bogen:** Der Charakterbogen im Buch gibt die Papiervorlage nicht richtig wieder.
3. **Doppelung:** Das Buch wiederholt, was der Tisch schon hat (Charakterbogen, Dokumente, Inventar). Auf den Screenshots vom 08.11. verdeckt sein Buchrücken am rechten Rand außerdem Text der Bedienhilfe.

An seine Stelle tritt ein schlichtes Notizbuch im Spielerbereich und am Spieltisch (Etappe 2).

## Wo der Stand liegt

| | |
|---|---|
| Tag | `archiv/abenteuerjournal-aj01` (annotiert) auf `f57d990`. Bisher nur lokal angelegt, der Push folgt nach Freigabe: `git push origin archiv/abenteuerjournal-aj01` |
| Branches (unverändert) | `claude/chroniplay-abenteuerjournal-23ec22` (Entwicklung), `claude/journal-release` (Live-Stand, Spitze `5f4bf8a`) |
| Commits | `606c69e` (erste Version), `f57d990` (SL-Ansicht) |
| Worker-Versionen | `9ecd595a-a629-46a7-97f4-fb292616fb77` (erste Version), `240e208e-a57f-4f46-9d07-1992ecca6373` (SL-Ansicht, derzeit live), Vorversion `ec57ff4e-1209-4c3d-8129-810298eb93f7` |
| Rückbau im Code | Branch `claude/journal-ad-acta`, siehe [Übergabe Etappe 1](../notizbuch/ETAPPE-1-UEBERGABE.md) |

**In Produktion ist das Buch noch aktiv.** Ohne Codeänderung schaltet es ab, wenn die Worker-Variable `AJ01_JOURNAL_CAMPAIGNS` geleert wird. Beides ist eine Produktionsänderung, und den Zeitpunkt entscheidet der Besitzer.

## Gespeicherte Einträge

Einträge mit `journalKind` oder `playDate` bleiben unverändert in der Datenbank. Sie erscheinen weiter in der Charakterverwaltung und in der Notizenliste des Spielerbereichs. Beim Speichern behalten sie alle Felder (Test `tests/journal-retirement-integration.mjs`). Das Notizbuch aus Etappe 2 zeigt sie wieder an, das Spieldatum wird dort das Datum der Seite.

## Was wiederverwendbar ist

- In neutrale Module übernommen, mit Tests:
  - `domain/calendar-date.ts`: Prüfung und deutsche Anzeige eines Kalenderdatums, für das Notizbuch.
  - `domain/sheet-values.ts`: fehlender Wert gegen echte Null, Punktreihen über fünf, Screenreader-Text, für die gemeinsame Bogenansicht in Etappe 4b.
- Nur in der Git-Historie (Tag), bei Bedarf von dort holen:
  - Entwurfslogik (`draftDirty`, `draftProblem`): Entwurf gehört fest zu seiner Figur.
  - Ablagelogik für das Buch auf dem Tisch (`clampPlace`).
  - Freigabeschalter nach Kampagne (`journalAvailable`, gleiches Muster wie die Probenzentrale).
  - Prozedurale Materialien der 3D-Szene (`book-scene.mjs`).
  - Die optionalen Eigenschaften `toolbar` und `quietFooter` des Rich-Text-Editors.
