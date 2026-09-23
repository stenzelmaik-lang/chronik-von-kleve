# Sprint 2 – Legacy & Canon Recovery

Arbeitsstand 2026-09-14; Grundlage ist der abgenommene Sprint-1-Commit `d1386ee45b7af000e2fa4898478e4c1ec034dd51`. Maßgeblich ist Auftrag 002 einschließlich „KONKRETE QUELLEN GEFUNDEN“, zusammen mit beiden Recovery Masters. Ihre vollständigen Text-Snapshots mit Dokument-ID und Revision sind unter `recovery/inputs` als unveränderte Exportrepräsentation gesichert.

## IMPLEMENTIERT

- 649 Quellenreferenzen: offizieller Drive-Bestand, sieben vollständige Dokument-Exporte, beide Register, zwei lokale Website-Stände und der unveränderte 67er-Katalog.
- 159 materialisierte Quellenreferenzen mit 104 verschiedenen Originaldateien; gleiche Bytes werden anhand SHA256 platzsparend geteilt. 490 weitere Dateien bleiben technische/vertrauliche Hashreferenzen am Ursprung.
- 2.005 einzeln adressierbare Claims mit Quelle, JSON-Pointer, alter ID, Zielentität soweit sinnvoll, Recovery-Status, Entscheidung, Konfliktkandidaten und Hash der strukturellen Nutzdaten. Die unveränderten Datei-Bytes sind die eigentliche Originalreferenz.
- Separate Recovery-Klassifikation; Sprint-1-CanonStatus unverändert. Standard GM-only; keine automatische Kanonentscheidung.
- Drei additive D1-Tabellen: recovery_sources, recovery_records, recovery_conflicts. Kein bestehendes Datenfeld wird migriert, gelöscht oder überschrieben. Migration 0002 ist schema-only. R2 speichert Originale unter recovery/campaignId/SHA256; bestehende files-Objekte bleiben unberührt.
- Wiederholbarer, in Fünfer-Quellenabschnitten fortsetzbarer GM-Import; bestehender Katalog muss zuerst vorhanden sein. Jeder Originalblock wird vor R2-Speicherung und bei Lesen geprüft. Fehlgeschlagene Abschnitte können erneut ausgeführt werden.
- Verweise auf dieselben bestehenden Entitäten anhand des nachgewiesenen ursprünglichen kind:id-Hashverfahrens. DB-Orts-/NSC-Zuordnungen verwenden explizite Listen; keine unscharfe Namenssuche. Neue Recovery-Entitäten sind GM_SECRET und zusätzlich recoveryOnly. Technische Metadaten erzeugen keine Weltentität.
- Ein Löschen einer verknüpften Weltentität löscht nicht den Quellclaim: FK setzt entity_id auf null, historische Ziel-ID bleibt in Original-Metadaten erhalten.
- Neues Quellenarchiv im bestehenden CMS: Import/Fortsetzen, Titelsuche, Statusfilter, Originalansicht, Konfliktregister, fehlende DB-Kategorien. Keine Lore-Bearbeitung oder Kanonfreigabe in diesem Sprint.
- GM-Kampagnenexport enthält alle drei Recovery-Tabellen. R2-Bytes sind getrennt zu sichern; das Source-Paket enthält die materialisierten Originale zusätzlich für Wiederaufbau.
- Keine Änderung an workspace.tsx, keine neuen Gameplay-Systeme, kein Redesign und kein Sprint 3.

## Mindest-Coverage

| Quelle | Nachweis |
|---|---|
| Offizielle statische places.json | 10 vollständige Originalobjekte |
| DB-Ortsdokument | 11 Ortsbeschreibungen, einschließlich Schwanenburg |
| DB-NSC-Dokument | 14 Beschreibungen; Avi ergänzt den im bisherigen Katalog fehlenden NSC |
| chronik.diary.json | 22 Claims, keine automatische gespielte Geschichte |
| encounters.json | 23 Vorlagen + 22 Ortsreferenzen |
| archive.json / Index | 4 + 7; zusätzliche lokale Indexfassungen und alle gefundenen Einzelrecords/Backups erhalten |
| news.json | 2 unterschiedliche Einträge mit identischer news-001; getrennte source/pointer-basierte IDs |
| events.json | 1 historischer Termin; upcoming nicht als aktueller Zustand importiert |
| merchants.json | 48 Rost + 20 Kurator; Händlercontainer zusätzlich erhalten |
| boons / ledger / threads | beide lokale Fassungen als geprüft leer dokumentiert |
| DB-SL-Texte | komplette verfügbare Dokumentrepräsentation, S3-Teil UNPLAYED_PREP |
| 67er-Katalog | vollständiger unveränderter Baseline-Snapshot, Identitäten erhalten |

Maschinenlesbare Dateien: recovery/manifest.json, coverage.json, legacy-id-mapping.json, place-version-matrix.json, conflicts.json. Eingangsregister bleiben unverändert erhalten. Character/Data-Privacy-Matrix und Feature-Recovery-Liste liegen daneben als Markdown.

## Architektur und Grenzen

Originale sind ausschließlich serverseitig eingebunden, komprimiert in server/recovery-package.json und nach Import in R2. Keine Ablage unter public, kein Clientimport. Alte HTML-Texte werden als escaped Text gezeigt, niemals mit dangerouslySetInnerHTML oder Script-Ausführung. Alte Freischaltungen sind ausschließlich Quellenfelder. Auth bleibt Sites/ChatGPT plus bestehende serverseitige Mitgliedschaft und GM-Rolle.

Recovery ist ein Index über Quellen, keine zweite Welt-Datenbank. Aktuelle Entitäten tragen weiterhin die Spieloberfläche. Claims dürfen mehrere verschiedene Quellenstände derselben Entität beschreiben. Keine Quelle wird aufgrund einer jüngeren Fassung gelöscht. supersedes/supersededBy bleiben leer, solange keine konkrete belegte Zuordnung geprüft wurde. Konflikt-Verweise auf Claims werden teilweise durch Stichwörter als Prüfkandidaten ermittelt; sie sind keine Behauptung, dass jeder Satz tatsächlich widerspricht.

## TEILWEISE IMPLEMENTIERT

- Klassifikation einzelner Storyaussagen: Quellen sind vollständig adressiert, aber überwiegend GM_REVIEW/WORKING. Keine vollständige semantische Abnahme aller 2.005 Claims. Der bestätigte Konfliktregister-Text bleibt vom Claimstatus getrennt.
- Historische DB-Inhalte: vollständige verfügbare Fund-Dokumente gesichert, jedoch kein vollständiger SQL-/phpMyAdmin-Rohdump gefunden. Die Dokumenttitel „vollständig“ beweisen keine vollständige Feldabdeckung der ehemaligen Datenbank.
- Suche im CMS zeigt höchstens 100 Titel-Treffer; vollständige Coverage ist im Export/Handover verfügbar. Volltextsuche und Seitennavigation noch offen.

## NICHT IMPLEMENTIERT

- Kein Wiederaufbau alter Runtime oder Auth. Kein Gameplay-Ausbau, keine Kanonentscheidungen, keine automatischen Spielerfreigaben.
- Keine Wiederherstellung fehlender 7 Character-, 4 Profil-, 2 SL-Notiz-, 41 Inventar-, 25 Nachrichten-, 14 Regeldokument- oder 31 Regeleintrags-Rohzeilen. Mengen sind aus dem DB-Übersichtsdokument belegt und im Manifest ausdrücklich fehlend markiert.
- Keine automatische Übernahme verlinkter Medienbytes oder alter Medien-ACL. Kein neues aktives Vier-Spieler-Setup.

## PROBLEM / RISIKO und offene Prüfung

- Rohdump nicht gefunden: Drive-Suche nach panoram_vampireabend fand Fund-Dokumente, keine Rohdatei; Dateinamensuche in den lokalen Desktop-Projektbeständen ebenfalls ohne Dump. Weitere anders benannte/private Quellen können existieren; keine Behauptung einer vollständigen Suche über das gesamte Konto/alle Datenträger.
- Technische Altdateien sind überwiegend Hashreferenzen, keine byteweise Kopien im Handover. Zugangsdaten bewusst ausgeschlossen. Die unveränderten Ursprünge müssen erhalten bleiben.
- Medienverweise können fehlen, ins Leere zeigen oder öffentlich erreichbar sein. Recovery veröffentlicht keine neuen Medien; bestehende öffentliche Altassets werden hier nicht nachträglich entzogen. Separater Medienbestand-/ACL-Abgleich ist offen.
- Konfliktliste enthält 13 vorgegebene und zwei technische Konflikte. Weiteres fachliches Lesen kann zusätzliche Konflikte ergeben. Keine Vollständigkeitsbehauptung über alle Lore-Widersprüche.
- Öffentliches Deployment und Importstatus müssen im abschließenden Handover separat nachgewiesen werden. Lokale Tests allein belegen keinen produktiven Datenbestand.
- Native Review-Entitäten bleiben gesperrt. Ein späterer freigegebener Sprint braucht einen bewussten, auditierten Redaktions-/Freigabefluss, der die Quellen selbst nicht verändert.

## Reproduktion / Tests

`python scripts/recovery_inventory.py` erzeugt Paket und Matrizen aus den mitgelieferten Inputs; --collect wird nur bei bewusstem Neuabzug verwendet. Der akzeptierte Katalog darf beim Wiederaufbau nicht geändert werden. Keine Legacy-Skripte ausführen.

`node --experimental-strip-types --test tests/foundation.test.mjs tests/recovery.test.mjs` prüft Originalhashes/Bytegleichheit, JSON-Pointer, eindeutige Claim-IDs, Mindestmengen, leere Quellen, ID-Kollision und bestehende Projektion. `npm run test:integration` verwendet ausschließlich eine neue isolierte lokale D1/R2-Instanz und prüft vollständigen Import, Wiederholung, GM-Zugriff, blockierte Spieler, unveränderte Legacy-Daten/Knowledge/WorldEvents und Export. Build/Lint/Typecheck-Ergebnisse werden im Handover mit letztem geprüften Stand festgehalten.
