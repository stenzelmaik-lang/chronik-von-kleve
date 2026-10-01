# Regie der Nacht – aktueller lokaler Prüfstand, 30.09.2026

Branch: `codex/sl-command-center-v2`. Ausschließlich lokal; kein Push, Merge, Deployment oder produktiver Datenzugriff. Dieser Bericht beschreibt den aktuellen Patch. Ältere Abschnitte in SL-COMMAND-CENTER-V2.md sind die Entwicklungshistorie.

## Tatsächlich umgesetzt

- Eine fokussierte Hauptarbeitsfläche, optional zwei Werkzeuge. Ausgeblendete Werkzeuge behalten ihre Eingaben. Mobil sind alle sechs Werkzeuge sichtbar, zwei Arbeitsflächen stehen dort untereinander.
- Gemeinsame SessionStage für SL, Gruppen-Vorschau und normale Spielersicht. Die veröffentlichte Szene steht im Mittelpunkt; Bearbeitung, Initiative und Protokoll sind gezielt aufklappbar.
- Eigener Titel statt doppelter Sitzungsüberschriften. Inhaltserstellung bleibt im bestehenden SL-CMS; keine Adminsteuerung ergänzt.
- Ein Status-/Initiative-/Log-Schreibvorgang übernimmt nicht nebenbei ungespeicherte Szene oder Untertitel. Szene wird nur mit „Für die Gruppe veröffentlichen“ übernommen. Die Eingabe heißt ausdrücklich ungespeicherter Szenentext, nicht persistierter Entwurf.
- Warnung beim Wechsel der Sitzung, wenn Szene oder private Notizen ungespeichert sind. Werkzeugwechsel und Gruppen-Vorschau erhalten die Eingabe. Vollständiger Browserreload verwirft ungespeicherten Szenentext.
- Private Notizen als eigener kleiner Baustein: Speichern beim Verlassen, währenddessen Feld gesperrt, Fehler behalten den Text, manueller Wiederholungsversuch. Bestehendes gm_body und Versionsschutz bleiben maßgeblich.
- Gruppen-Vorschau enthält serverseitig projizierte Sitzungen und freigegebene Text-Handouts. Handouts werden auf id/title/text begrenzt. Keine persönlichen Grants, private Texte oder Grant-Metadaten im Preview-Response. Aktualisieren lädt auch die Vorschau erneut.
- Normale Spieler gleichen ihre Sitzungen und freigegebenen Handouts alle zehn Sekunden im sichtbaren Fenster und bei Fokus ab. Keine WebSocket-/Pushbehauptung. Fehler entfernen den angezeigten Datenstand und werden sichtbar gemeldet.
- Bestehende Orts-/Charakter-/Würfelkomponenten und Berechtigungen wiederverwendet. Keine zweite Fachlogik, kein neues Schema, keine Lore.

## Prüfung

PASS: Typecheck, vollständiger ESLint, Build; 69 Fach-/Regressionstests; 550 isolierte Integrationchecks; 46 Rollen-/Backfill-/Rollback-Prüfungen; atomarer D1-Batch-Rollback. Originalausgaben in qa/*.txt. Nach dem letzten reinen Beschriftungs-/Responsive-CSS-Feinschliff erneut erfolgreicher Build und Browserprüfung.

Browser, echte lokale Anwendung und reguläre synthetische Auth-2.0-Anmeldungen:

1. SL: Szenentext ändern, Status auf Pause setzen. Gruppen-Vorschau zeigt weiterhin alten Szenentext und gespeicherten Status. Erst ausdrückliches Veröffentlichen übernimmt den Text.
2. SL: private Notiz ändern, Werkzeug wechseln, vollständig neu laden. Text erhalten.
3. SL: Text-Handout gezielt A freigeben. Echter Login A zeigt es; echter Login B zeigt es nicht. Beide sehen veröffentlichte Szene, keine private SL-Notiz und keine Regiewerkzeuge.
4. SL: Electric Taberna auswählen, automatisch speichern, vollständig neu laden. Ortszuordnung erhalten. Private Zuordnung erzeugt keine Spielerfreigabe.
5. Desktop: einzelne und zwei Werkzeuge, Charakterkontext, Gruppenansicht geprüft. Mobile Viewport 390×844: Lesbarkeit, Werkzeugbedienung und kein seitlicher Seitenüberlauf geprüft. Dies ist Browser-Responsive-QA, kein physischer Smartphone-Test.
6. Negative API-Regression: anonyme/Spieler/Editor/blocked/pending/fremde Kampagne/plattform-only abgewiesen; fremde private Charakterdaten bleiben verborgen; persönliche Handouts fehlen in Gruppenpreview; Gruppen-Widerruf entfernt Handout; Preview enthält nur erlaubte Felder.

## Nachweise / lokale Benutzung

Laufende isolierte Anwendung: http://127.0.0.1:8794/spielbereich?bereich=sitzung

SL: command-gm@example.invalid; Spieler A: command-a@example.invalid; B: command-b@example.invalid.
Öffentliches synthetisches Demo-Passwort aller drei lokalen Testkonten: ChroniPlay-Demo-2036!

Startanleitung und Verhalten der lokalen Testressourcen: ../SL-COMMAND-CENTER-V2.md. Reload speichert bestätigte Änderungen; jeder Serverneustart erzeugt bewusst eine frische isolierte Test-D1/R2 und setzt Demoänderungen zurück. Keine produktiven Konten verwenden.

Screenshots: qa/regie-desktop.jpg, qa/regie-mobile.jpg, qa/spieler-desktop.jpg, qa/spieler-mobile.jpg. Aufnahme echter Anwendung, keine Designmockups. Die synthetischen Texte dienen ausschließlich QA.

## Verbleibende Grenzen

- Persönliche Funktionsabnahme und Live-Veröffentlichung offen. Lokal geprüft bedeutet nicht live abgeschlossen.
- Bestehender direkter lokaler Abmeldelink /signout-with-chatgpt liefert 404. Authänderung außerhalb dieses Patches; QA-Kontowechsel erfolgte durch normale erneute Anmeldung.
- Handoutfreigaben kampagnenweit, nicht sitzungsgebunden; andere Grants/Sichtbarkeit können Zugriff gewähren. Medien-Handouts verbleiben in bestehender Dokumentverwaltung.
- Gruppenpreview simuliert keine persönlichen Freigaben. Charakterkontext bleibt lesend und der Link öffnet den vorhandenen allgemeinen Charakterbereich.
- Aktive Sitzung ist die lokal gewählte beziehungsweise erste lesbare Sitzung; keine neue kampagnenweit persistierte Session-Scheduling-Architektur.
- Vorhandene Buildwarnungen: Client-Chunk über 500 kB, vinext-Routenklassifizierung und Plugin-Timing. Kein Buildfehler. Keine umfassende Performance-/Accessibility-Zertifizierung behauptet.
- Keine umfassende Neugestaltung sämtlicher CMS-, Charakter-, Inventar- oder Plattformseiten; dieser Patch konzentriert sich auf den Sitzungsablauf.

## Geänderte Dateien dieses Patches

app/api/command-center/route.ts
app/spielbereich/modules/command-center.tsx
app/spielbereich/modules/command-center.module.css
app/spielbereich/modules/command-notes.tsx (neu)
app/spielbereich/modules/session-stage.tsx (neu)
app/spielbereich/modules/session-stage.module.css (neu)
app/spielbereich/modules/session.tsx
app/spielbereich/workspace.tsx
tests/integration.mjs
docs/sl-command-center-v2/README.md und qa-Nachweise
