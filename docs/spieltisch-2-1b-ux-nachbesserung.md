# Spieltisch 2.1b – UX-Nachbesserung

Stand: 28.10.2026. Freigegebener Folgeauftrag zur vorhandenen Alpha-Spielerzentrale. Ausgangsstand `c974b7d08620a4db043370a88a094dfe91d8fbfe`, sauberer Arbeitsbaum, Branch `codex/spieltisch-2-1b-ux`.

## Ergebnis und wiederverwendete Systeme

- Die freigegebene 70/30-Anordnung, drei Informationsfelder und vier Vorbereitungszugänge bleiben erhalten.
- Charakter statt Login-Name: vorhandenes autorisiertes Porträt, Name, Clan, Konzept, Generation, Wesen, Verhalten, Erzeuger und tatsächliche Kampagnenzugehörigkeit. Bereits vorhandener Hintergrundtext ist aufklappbar. Keine neue Identitäts-/Profilstruktur und keine erfundenen Werte.
- Kompakter Wechsel rechts oben nur bei mehreren eigenen aktiven Charakteren. Serverseitige Prüfung von Konto, Kampagne, Eigentum und Archivstatus. Auswahl im bestehenden `auth_profiles.preferences`-JSON pro Kampagne; SSR stellt sie beim erneuten Öffnen wieder her. Eine explizite gültige Charakter-URL kann die Ansicht gezielt öffnen. Profilformulare behalten die Wahl bei. Avatar, Bewegungseinstellungen und fremde Kampagnen werden nicht überschrieben.
- Vorhandenes Charakter-Companion-API um bestätigte Archivierung/Wiederherstellung erweitert; bestehendes `archived`-Kennzeichen und Versionsschutz wiederverwendet. Charakter-ID, vollständige Werte, XP, Medien und Verknüpfungen bleiben erhalten. Archivansicht besitzt einen eigenen Leseselektor, der keine archivierte Figur als aktive auswählt. Gewöhnliches physisches Löschen ist serverseitig gesperrt und aus dem Editor entfernt. Runtime-, Engine- und Companion-Änderungen erfordern zuerst Wiederherstellung.
- Figurenwechsel verwirft ungespeicherte Textentwürfe nur nach Bestätigung. Bogen und Inventar verwenden dieselbe aktive ID. Die Auswahl ändert keine laufenden Sitzungen oder vorhandenen Spieltischzuordnungen.
- Eine kompakte Hauptnavigation: ChroniPlay, echtes Kampagnenabzeichen, „Chronik erkunden“, weitere bestehende Bereiche und Kontomenü. Command Center nur für berechtigte SL; bestehende Ortsredaktion für berechtigte Redakteure erhalten. Profil, Abmeldung, Codex, Weltbereiche und Datenexporte bleiben erreichbar. Kein separater Startseite-/Übersicht-/Nachrichtenbutton auf der Zentrale.
- Sichtbarer Monatskalender nutzt `calendarDays` und autorisierte vorhandene Termine. Heutiger Tag und Terminmarkierungen, laufende lokale 24-Stunden-Uhr im Sekundentakt, bestehender Vollkalender und Abstimmungen. Keine zweite Kalenderengine.
- „Zusammenfassung lesen“ öffnet den konkreten vergangenen freigegebenen Sitzungseintrag über den vorhandenen Records-Lesepfad. Die kleine neue Lesekomponente speichert nichts und öffnet keinen aktuellen Spieltisch.
- Doppeltes Nachrichtenfeld entfernt; Postfach ausschließlich über „Meine Vorbereitung“ auf der Zentrale. Vorhandene Postfachkomponente arbeitet unverändert weiter. Das noch unentschiedene dritte Feld ist ruhig als nicht belegter Bereich kenntlich; keine erfundene Offene-Fäden-Funktion. Bereits freigegebene Neuigkeiten oder eigene Notizhinweise wären bestehende Quellen für eine spätere fachliche Entscheidung.
- Vor dem ersten Live-Snapshot zeigt der bestehende Spieltisch einen Ladezustand; der alte Sitzungs-/Startbildschirm blitzt beim Eintritt in einen laufenden Abend nicht mehr auf.

Keine Schemaänderung, Migration, neue Abhängigkeit, zweite Charakter-/Nachrichten-/Kalenderengine oder echte Testdatenübernahme. XP-Grafiken, zusätzliche Aktivitäts-/Minispielpunkte und große grafische Neugestaltung bleiben spätere eigenständige Aufgaben.

## Prüfungen und Grenzen

- 281 Unit-/Regressionstests, 1.655 vollständige HTTP-Integrationsprüfungen und 46 Rollen-/Rückrollprüfungen in frischen lokalen D1-/R2-Beständen bestanden.
- Zusätzliche 24 gezielte Abschlussprüfungen, Typecheck, gezieltes ESLint, Produktionsbuild und Deploymentprobe bestanden. UI-Detektor ohne Befund; Darstellung zusätzlich tatsächlich angesehen.
- Getrennt authentifizierte lokale Spieler-A-/Spieler-B-/SL-Kontexte, keine Rollenheader oder produktiven Demo-Konten. Beschädigte Originaldaten werden bei Archivierung abgewiesen und bleiben erhalten. Auswahl ohne URL wiederhergestellt; Profil-Speichern erhält die Auswahl. Fremde, unbekannte, kampagnenfremde und archivierte Charakter-IDs abgewiesen.
- Bestätigen/Abbrechen, Archivansicht, Wiederherstellung, veraltete Versionen, unveränderte vollständige Bögen/XP und bestehende laufende Sitzung geprüft. Private Figuren und Inhalte bleiben fremden Spielern verborgen.
- Browser: Edge `156.0.4314.50`, 1920×1080, 1440×1000, 1536×864, 1152×720 und 390×844. 70/30 gemessen, kein horizontaler Überlauf; Charakterwechsel, passendes Inventar, Postfach, Rückblick, Kontomenü, heutiger Tag, echte Terminmarkierung und sichtbar tickende Uhr bestanden. Der verzögerte Spieltischabruf zeigt Ladezustand statt alten Startbildschirm. Keine JavaScript-Seitenfehler.
- Private Belege: `.local-work/spieltisch-2/evidence/2-1b-ux/`, Testlogs `21b-ux-*.log`. Echte Charakterdaten wurden nicht in die Testumgebung importiert. Neue Live-Ansicht mit echtem Charakter und nativer 125-%-Browserzoom bleiben persönliche Alpha-UX-Sichtprüfung; die kleineren effektiven Zoom-Flächen wurden lokal geprüft.

## Freigabevorbereitung und Rückrollgrenzen

Ziel: bestehender Alpha-Worker `chronik-von-kleve` auf `chroniplay.cc`, Cloudflare-Konto `688c841e3110458e2e64b001c3291920`. D1 `a4bc79e6-3f33-4b03-b240-9c341bd1d4d7`, R2 `chronik-von-kleve-r2`, `closed-alpha-production` und deaktivierte Versionsvorschauen bleiben unverändert.

Frisches privates Backup: `.local-work/spieltisch-2/release-21b-ux/`, lokal wiederhergestellt und geprüft am `2026-10-28T13:05:31Z`. Alle 32 Anwendungstabellen und vollständiges Originalschema mit 156 Objekten; Integrität OK, keine Fremdschlüsselverletzungen. 3.520 FTS-Einträge rekonstruiert und Integrität geprüft.

- SQL-SHA-256: `5cfcb3570f177c743e671e3adf839d05a13b48f7a9a63d77163384f8f6dde48b`.
- Schema-SHA-256: `3ba5d77c5c2d347f093748c09ef10eed94b4d2023a30035d354bb578cac72d39`.
- Vorherige Worker-Version `bb692e18-96ee-4e27-a2d2-6db9de0dc266` (Code `1087998…`) bleibt vorhanden. Nach neuer Charakterwahl/Archivierung bevorzugt Fix-forward. Kein blindes Zurückschalten: der alte Dashboard-Code berücksichtigt archivierte Figuren noch nicht vollständig und besitzt den alten Löschpfad. Kein Zurückspielen des Backups über legitime neue Profil-/Spieländerungen.

Nach erfolgreicher Alpha-Veröffentlichung tatsächlichen Commit, Version, Live-Zugangsschutz und Bestandsvergleich ergänzen. Danach STOPP zur persönlichen UX-Abnahme; keine neue Hauptbaustelle.

## Tatsächlicher Alpha-Release

- Live: <https://chroniplay.cc/spielbereich?bereich=dashboard>.
- PR: <https://github.com/stenzelmaik-lang/chronik-von-kleve/pull/31>.
- Veröffentlichter Commit: `b01b88f4cc5886ec7d09d39b5620f8de2b844a2a`; Quellbaum vor dem Deploy identisch zum geprüften Branch-Commit `f76deb7bd2cd49b8a3803d406a35f42694238f24`.
- Worker-Version `5eff2bf3-8949-496c-82ce-f4893ef14388`, Deployment `f98e54c0-285f-4608-967a-bf53b6ed551f`, 100 % Verkehr seit `2026-10-28T13:19:01.609214Z` (14:19 Uhr Berlin).
- Bestehende D1-/R2-Anbindungen, geschlossenes Alpha-Zugangsprofil und deaktivierte Versionsvorschauen bestätigt. Keine Migration und keine produktiven Test-Schreibvorgänge.
- 22 Live-Prüfungen auf Hauptdomain und workers.dev bestanden: Anmeldung 200; Zentrale/Rückblick ohne Anmeldung 307 zur Anmeldung; Dashboard, Charakterwahl, Bogen, Sitzungsdaten, Nachrichten, Termine, Dateien und Bühne ohne Anmeldung jeweils 401 mit `private, no-store`. Das live ausgelieferte Stylesheet ist bytegleich mit dem geprüften Build.
- Bestandsvergleich aller 32 Anwendungstabellen: 31 vollständig identisch, einschließlich Profile, Charaktere, Rollen, Kampagnen und Inhalte. Alle 20 bestehenden Anmeldesitzungen erhalten. Bei zwei Sitzungen ausschließlich reguläres Fortschreiben von `last_seen_at`; keine neuen/gelöschten Sitzungen und keine geänderten Zugangsdaten. Keine Testkonten oder Charakterdaten übernommen.
- Privater Nachweis: `release-21b-ux/live-smoke.json`, `data-comparison.json`, `data-comparison-session-classification.json` unter `.local-work/spieltisch-2/`.

**Alpha veröffentlicht: JA. Zur persönlichen UX-Abnahme bereit: JA.** Neue echte Charakteransicht und nativer 125-%-Zoom bleiben persönlich zu bestätigen. Drittes Informationsfeld und weiterführende XP-/Aktivitätsfunktionen bleiben fachlich offen beziehungsweise späteren Etappen vorbehalten. Kein neuer Bereich begonnen.
