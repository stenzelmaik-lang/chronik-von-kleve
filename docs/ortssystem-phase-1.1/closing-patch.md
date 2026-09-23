# Ortssystem Phase 1.1 – Closing Patch

Ausgang: Commit 298f31c7741a838fb33721662057b3ebc5163e21, Sites 14.

## IMPLEMENTIERT
- Discovery ist monoton: hidden → rumored → known → visited → investigated.
  Gleichen Status bestätigen ist erlaubt, Rückstufung ergibt HTTP 400.
- Discovery benötigt expectedRevision. 0 bezeichnet einen noch nicht vorhandenen
  Grant; bestehende Grants verwenden ihre knowledge.version. Fehlende Revision: 400.
  Aktuelle Revisionen sind für die SL über GET /api/knowledge?entityId=... abrufbar.
- Compare-and-swap: UPDATE ... WHERE version=?; neue Grants mit
  ON CONFLICT DO NOTHING. Genau eine parallele Änderung kann erfolgreich sein.
  Kein erfolgreicher Write: 409. Ereignisse nur bei changes()=1 im selben D1-Batch.
  knowledge-Änderungen erhöhen ebenfalls version, damit ein Entzug einen vorher
  gelesenen Discovery-Stand ungültig macht. Epistemische Werte bleiben erhalten;
  ein expliziter neuer nicht-hidden Discovery-Grant setzt UNKNOWN auf DISCOVERED.
  UNKNOWN ohne erneute explizite Freigabe bleibt ungültiges Wissen.
- Player-Projektion liest explizite gültige Public-, Gruppen- und persönliche Grants.
  UNKNOWN-Grants und gespeicherte Fixture-Discovery erzeugen keine Freigabe.
  visibility=public ist eine explizite öffentliche Inhaltsregel.
- Persönliche Grants gelten nur in der persönlichen Sicht des angemeldeten Spielers.
  target=group enthält keine persönlichen Grants, auch in der GM-Vorschau.
- Freigegebene Räume können in einem neutralen Elterncontainer erscheinen. Dessen
  echter Name, weitere Räume und separat GM-geschützte Zustände/Marker bleiben verborgen.
- GM_SECRET / recoveryOnly in Entity oder Ortsattributen ist eine absolute Grenze;
  sie gilt auch für Nachfahren und bereits vorhandene Grants.
- Ortsnotiz-Referenzen verwenden dieselbe Projektion wie die sichtbaren Ortsdaten.

## NICHT IMPLEMENTIERT / bewusst außerhalb des Auftrags
Administrative Discovery-Rückstufung, weitere Orte, neue Fachsysteme, Designumbau.

## Migration / Produktion
Keine Schemaänderung und keine neue Migration. Vorhandene Migrationsdateien
bleiben identisch. Der produktive Baseline-Transfer wird nicht erneut ausgelöst.
Automatische Tests verwenden eine isolierte lokale Datenbank: dort werden die
bestehenden Migrationen/Fixtures zum Testaufbau und Recovery-Regressionsprüfung genutzt.

## Prüfung
Fachtests plus vollständige lokale HTTP-Integration prüfen parallele Erstellung
und Aktualisierung, Gewinner-/Verliererereignisse, Monotonie, persönliche Area-/Room-
Freigaben, neutrale Eltern, Grant-Entzug, fehlende Grants, Public-Regel, GM_SECRET,
Notizen, Prepared Actions und vorhandene Foundation-/Recovery-Funktionen.
Produktiv erfolgt nur lesender Vorher-/Nachher-Abgleich der Daten.
