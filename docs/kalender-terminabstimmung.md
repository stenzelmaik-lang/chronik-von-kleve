# Übersicht, Kalender und Terminabstimmung

Lokale Umsetzung, 12.10.2026, Branch codex/m1-kernmodell. Kein Commit, Push oder Deployment.

## Umfang

- Übersicht zeigt keine fehlenden Wirtschaftsdaten, leeren Gefallen, leeren Notizen, fehlenden SL-Mitteilungen oder fehlenden Sitzungseinträge. Ohne aktive freigegebene Szene entfällt die Szenenkarte. Bestehende ausdrücklich inaktive/archivierte/abgesagte Zusatzdaten werden nicht als aktive Übersicht ausgewählt.
- Funktionierende Grundaktionen und Charakteranlage bleiben erreichbar; keine globalen Bereiche gelöscht oder deaktiviert.
- Termine über Journal & mehr: Monatskalender, Monatswechsel, Tagesauswahl und verständliche Uhrzeiten in Geräte-Ortszeit.
- SL kann feste Termine anlegen/bearbeiten und Abstimmungen mit 2–20 Vorschlägen erstellen. Spielgruppen- oder SL-interne Sichtbarkeit.
- Mitglieder stimmen ausschließlich als eigenes authentifiziertes Konto mit Ja/Vielleicht/Nein ab und können ihre Antwort ändern. Tabelle zeigt Antworten und Zusagen.
- SL legt einen Vorschlag verbindlich fest: Datum erscheint im Kalender, weitere Antworten gesperrt. Stimmen bleiben erhalten.
- Bestehende Termineinträge bleiben erhalten, auch unvollständige Legacy-Einträge. Ungültige vorhandene Vorschläge führen zu einem sichtbaren Fehler, nicht zu stiller Text-/Datenänderung.
- Manuelles Aktualisieren lädt aktuelle Antworten. Keine Doodle-Verbindung, zusätzlichen Konten, E-Mails, Serientermine oder externe Kalenderintegration.

## Speicherung und Schutz

Bestehende records-/Entity-Adapter weiterverwendet, keine neue Tabelle oder Migration. Termine bleiben kind=termine; Stimmen sind private, actor-/kampagnengebundene Records mit geschütztem appointment-vote-Kontext. Stimmen werden nicht als persönliche Notizen oder Dashboard-Notizen ausgeliefert. Der generische Schreib-/Löschpfad darf sie nicht verändern.
Reader verwendet bestehende serverseitige Entity-Projektion. Geheimen Terminen kann nicht per erratener ID zugestimmt werden. Konto-ID stammt aus der Sitzung, nicht aus dem Client. Gleichzeitige Antworten/Terminbearbeitungen sind versionsgesichert; die atomare Abstimmungsoperation prüft zusätzlich den aktuellen offenen Pollstand.

## Prüfung

- 209 Unit-/Regressionstests, Typprüfung, gezieltes ESLint und Build bestanden; bestehender Bundlegrößen-Hinweis bleibt.
- 1.265 Integrationprüfungen und 46 Rollenfundament-Prüfungen bestanden, einschließlich anonymer/Spieler-/SL-/Kampagnengrenzen, ungültiger Vorschläge, Antwortänderung, Versionskonflikt, paralleler Antworten, finalem Kalenderdatum und Abstimmungssperre. Ein vorangegangener Lauf wurde durch einen lokalen Testserver-Verbindungsfehler unterbrochen; der vollständige Wiederholungslauf ohne parallele Vorschau bestand.
- Browser mit synthetischer SL und unabhängig angemeldetem synthetischen Spieler: festen Termin und Abstimmung erstellt; Spielerantwort gespeichert, Tabelle geprüft, SL-Termin festgelegt, Antwortfunktion danach entfernt.
- Mobile Breite 390px ohne horizontalen Seitenüberlauf; breite Abstimmungstabelle scrollt innerhalb ihres Bereichs. Kalender und Icon-Aktionen zugänglich benannt.
- Finale Übersicht ohne leere Wirtschaft-/Gefallen-/Mitteilungs-/Notizkarten geprüft; Termine über Journal erreichbar.
- Produktionskonten, Spieler-/Charakter-/Kampagnendaten nicht angefasst. Alle Schreibtests ausschließlich in isolierter Test-D1; synthetische lokale Vorschau weiterhin verfügbar.
