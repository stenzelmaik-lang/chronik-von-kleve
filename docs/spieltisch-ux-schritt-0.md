# Spieltisch, Übersicht und SL-Regie – lokaler Abschluss

Stand: 11.10.2026. Basis: e1bf1ae1a61025619d610e466481e16622c4fba1, Branch codex/m1-kernmodell.
Alle fünf Umsetzungsschritte des vorgegebenen UX-Plans sind lokal umgesetzt. Dieser Bericht ersetzt die Zwischenstände.
Keine Produktionsänderung, kein Deployment, Push oder Commit; keine Migration. Schreibtests ausschließlich mit isolierten synthetischen Daten.

## Umsetzung

| Punkt | Ergebnis | Umsetzung / Grenze |
| --- | --- | --- |
| A01 Übersicht | erfüllt | Charakterkontext, freigegebene Szene und nächster sichtbarer Termin priorisiert. Desktop 1440×900: Schnellaktionen enden bei 874px, Charakterauswahl bei 442px. Nachgeordnete Karten benötigen weiterhin Scrollen. |
| A02 Mobile Regie | erfüllt | Szenenregie zuerst, Kontext einklappbar; gespeicherte Desktop-Präferenzen bleiben unverändert. |
| A03 Mobile Vorbereitung | erfüllt | Einspaltige Akte, Werkzeug-/Auswahlmenüs und einklappbarer Kontext. |
| A04 Protokoll | erfüllt | Ehrliche Aktion „Zur Sitzung“, kein vorgetäuschter Protokoll-Direktlink. |
| A05 Bedienbarkeit | erfüllt | Benannte Icon-Aktionen, wichtige Aktionen mit 44px-Fläche; Tastatur und Fokus-Rückkehr geprüft. Kein formaler WCAG-Gesamtaudit. |
| A06 Freigabezustände | erfüllt | Regie-Auswahl, tatsächliche Aktivierung und serverseitig freigegebener Gruppenstand getrennt. Keine implizite Veröffentlichung. |
| A07 Szenenfokus | erfüllt | Szenenorientierter Standard, bestehender Expertenarbeitsplatz optional; Live-Werkzeuge direkt oder über Werkzeugmenü. |
| A08 Live-Dichte | erfüllt | Anordnungsfunktionen nur im Anordnungsmodus; keine funktionslosen Erstellen-/Bearbeiten-Aktionen oder leere Warteschlange. |
| A09 Schreibfläche | erfüllt | Metadaten und zusätzliche Link-/Bildwerkzeuge einklappbar; Text sichtbar. Navigationsschutz und Versionskonflikt erhalten Entwürfe. |
| A10 Originalreferenzen | erfüllt | Suche, Typfilter, stabile IDs, Orts-Breadcrumbs und unterscheidbare gleichnamige Medien mit geschützter Vorschau. Keine Kopien/Zusammenführungen. |
| A11 Orientierung | erfüllt | Konsistente Bereichsnamen, aktiver Journal-Unterbereich und nachgeordnete geplante Werkzeuge. |
| A12 Datenzustände | erfüllt | Fehlend, Nullstand, Laden und Fehler getrennt. Engine-XP-Ledger und Legacy-Bestandsangabe unterscheidbar; keine Konvertierung. |
| A13 Spieltischwerkzeuge | erfüllt | Bestehender W10-Rohwurf, private Schnellnotiz und bedarfsgeladene, nur lesende Charakter-/Inventaransicht. Vollseiten erhalten; keine Buchungen beim Öffnen. |
| A14 Spieler-Wartezustand | erfüllt | Erlaubte Spielmöglichkeiten, keine geheimen Titel oder fremden Einzelcharakterdaten; Fehler nicht als leerer Spielstand dargestellt. |
| A15 Hierarchie | erfüllt | Verdichtete Noir-Hierarchie, gegliederte Panels und lesbarer Szenentext; kein neuer Hero oder Animationssystem. |

Bestehende Dashboard-, Sitzungs-, Szenen-, Würfel-, Notiz-, Inventar-, Story- und Workspace-Pfade weiterverwendet. Keine parallele Architektur.

## Abschließende Prüfung

- 203 Unit-/Regressionstests bestanden, einschließlich gezielter UX-/Quellchecks und Breadcrumb-Tests.
- 1.234 Integrationprüfungen und 46 Rollenfundament-Prüfungen bestanden. Alle Schreibvorgänge ausschließlich in frischer isolierter Test-D1.
- Typprüfung, Produktionsbuild, gezieltes ESLint und git diff --check bestanden.
- Bestehender Build-Hinweis auf große JavaScript-Bundles bleibt; kein Buildfehler.
- Browser: SL und zwei unabhängig angemeldete synthetische Spieler; 1440×900, 834×1112 sowie 390/360/320px Breite. Keine horizontalen Seitenüberläufe in geprüften Ansichten.
- Tastatur, Panel-Vergrößerung/Escape/Fokus, Vorbereitung, Suche, private Medienvorschau, Speichern, ungespeicherte Navigation und Versionskonflikt geprüft.
- Spieler A sieht gezielte Freigabe; B weder diese Szene noch A-Notizen, A-Charakterauswahl oder SL-Geheimnisse. Unberechtigter Charakteraufruf zeigt im finalen Build Fehler ohne falsche Leerzustände; Rückkehr zur Gruppenansicht funktioniert.
- Private Notiz gespeichert und Leserechte geprüft; Abbrechen verwirft Entwurf. Charakter-/Inventar-Kurzansicht nur lesend.
- Gespeicherte synthetische Desktop-Panelpräferenzen bleiben bei Responsive-Darstellung unverändert; Auswahl veröffentlicht nichts.

## Leistung: Messgrenzen

Lokale HTTP-Messung mit synthetischen Daten, erster Abruf und Median/Maximum der folgenden fünf Abrufe in Millisekunden:

| Endpoint | Erster Abruf | Median / Maximum | Antwortgröße |
| --- | ---: | ---: | ---: |
| dashboard | 30 | 16 / 16 | 987 Bytes |
| session-scenes | 19 | 31 / 56 | 642 Bytes |
| command-center | 22 | 32 / 34 | 11.285 Bytes |
| preparation | 27 | 16 / 17 | 2.571 Bytes |

Performance-Prüfanleitung verwendet. Verfügbare Browsersteuerung liefert keine Rendering-Traces: LCP, INP, CLS und vollständige Browser-Ladezeiten nicht gemessen. Keine Aussage zur Produktionsleistung oder sehr großen Kampagnen. Optionale Charakter-/Inventardaten erst bei Öffnung angefordert.

## Abschluss

### Nachtrag 12.10.2026: Szenen-Seitenbereich

Auf ausdrücklichen Wunsch Aufklappbereiche durch Icon-Schalter ersetzt: Spielerwerkzeuge, Initiative/Protokoll und die szenenorientierte SL-Regie verwenden einen von rechts eingeblendeten Seitenbereich. Nur ein Bereich ist gleichzeitig offen; aktives Icon oder Escape schließen ihn. Besuchte Inhalte bleiben für Entwürfe erhalten. Reduzierte Bewegung berücksichtigt; bestehende API-/Berechtigungslogik unverändert. 205 Tests, Typprüfung, ESLint und Build bestanden. Browserprüfung mit synthetischem Spieler; keine erneute vollständige Rollen-/Integrationabnahme dieses reinen UI-Nachtrags.

Alle lokalen Umsetzungsschritte abgeschlossen; kein offener Funktionsblocker in den durchgeführten Prüfungen. Vollständige Browser-Leistungsmetriken bleiben unbestätigt.
Produktionskonten, Rollen, Spieler-/Charakter-/Kampagnendaten und echte Electric Taberna unverändert. Keine Migration oder Veröffentlichung.
Änderungen uncommittet im genannten Branch; Arbeitsbaum daher nicht sauber. Synthetische Vorschau: http://127.0.0.1:8794/spielbereich.
