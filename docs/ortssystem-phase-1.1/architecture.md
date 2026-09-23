# Ortssystem Phase 1.1 – Architekturentscheidung (vor Implementierung)

Ausgang: d7dc4a16f07de0c545cc13f2deb798e371b743aa / Sites 12. Auftrag und FINAL-Spezifikation am 14.09.2026 vollständig gelesen. Kein Content-, Design- oder Recovery-Sprint.

## Bestand und Zuordnung A–E

A. `entities` bleibt die gemeinsame Identität: Ort, Bereich und Raum sind PLACE-Entities mit stabiler ID und einem Strukturtyp. Informationen bleiben eigenständige CLUE-Entities. `relationships` verbindet die Hierarchie über `location.contains`. Legacy-ID bleibt Provenienz; kein Legacy-Datensatz wird umbenannt oder gelöscht. Die neue strukturierte Ortsprojektion wird nicht über den generischen Entity-Serializer ausgeliefert.

B. Eine 1:1-Erweiterung `location_nodes` enthält ortsspezifische Struktur, sortierbare Position, Zustand, einzeln geschützte Marker, Fraktionssignale und Dossierattribute. `location_actions` enthält vorbereitete Definitionen, Zielreferenzen, Status und Revision. Beide referenzieren dieselben Kampagnen/Entities; kein zweites Weltsystem. Raumreihenfolge ist keine Identität. Öffentliche View-Keys werden stabil aus IDs abgeleitet und dienen auch Notizverknüpfungen, ohne sprechende interne IDs auszuleiten.

C. `knowledge` erhält nullable `discovery_state` und `version`; bestehende epistemische `state`-Werte bleiben unverändert. Discovery und Wahrheitsbewertung sind unterschiedliche Dinge. Public-, Gruppen- und persönliche Grants werden getrennt ausgewertet. Kein Grant bedeutet hidden; Datenbankexistenz allein gibt kein Wissen. Das Maximum zutreffender Grants zählt. Der normale Discovery-Schreibpfad bestätigt den Status oder erhöht ihn; Rückstufungen sind gesperrt. Eine administrative Korrektur ist nicht implementiert. Verborgene Eltern werden bei individuell freigegebenen Räumen ausschließlich als neutrale Container dargestellt. GM_SECRET-Eltern verhindern weiterhin jede Auslieferung ihrer Kinder. Ein freigegebener neutraler Hinweis ist ausdrücklich getrennt vom geheimen Bereichstitel.

D. `world_events` bleibt append-only: Änderungen speichern Akteur, Zeit, Objekt, vorher/nachher, Grund und Zielgruppe. Zustands-/Discovery-Updates verwenden erwartete Revisionen und atomare D1-Batches mit bedingtem Event-Insert. Prepared Actions behalten zunächst exakt den Version-12-Vertrag (Auslösung protokollieren, keine nachträglich erfundenen Zustellungen oder rückwirkenden Freischaltungen). Definition und Auslösezustand werden persistent; vorhandene Auslöseevents werden übernommen.

E. `records` bleibt Notizspeicher und Eigentümergrenze. Ortsnotizen validieren Location-/Area-/Room-Ziele auf dem Server; Spieler dürfen nur bekannte Ziele referenzieren. Vorhandene private und Gruppennotizen bleiben erhalten. Die SL erhält keine Änderungsrechte an fremden Spielernotizen. Kein Rich-Text-/Offline-/Backup-UI in diesem Sprint. Kampagnenexport wird um die neuen strukturierten Daten ergänzt.

## Migration und Schutz

Schemaänderung ausschließlich additiv per neuer Drizzle-Migration. Der unveränderte V12-Musterort wird als versionierter JSON-Migrationsdatensatz aus dem Laufzeitmodell entfernt. Ein expliziter, GM-geschützter, idempotenter Datenübertragungsschritt schreibt nur diese Baseline und ein Migrationsereignis; kein Seed auf GET und kein stiller TypeScript-Fallback. Vorhandene Entities, Grants, Events, Records, Dateien und Recovery-Daten werden nicht überschrieben. Counts und Inhaltsprüfsummen werden vor/nach erhoben. Bei bereits vorhandenem widersprüchlichem Stable-ID-Datensatz wird abgebrochen statt überschrieben.

## Bewusste Grenzen

Nur Electric Taberna produktiv. Bestehendes Design bleibt erhalten. Kein Mehrkampagnen-UI, keine neue Authentifizierung, keine Offline-Synchronisation. Revisionen und Exportdaten bereiten diese späteren Aufgaben vor. Historische Aktivitätsbeispiele werden als Baseline mit Herkunft erhalten; sie werden nicht als neu gespielte Ereignisse erfunden.
