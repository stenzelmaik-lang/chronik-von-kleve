# Spieltisch, Termine und gemeinsames Whiteboard

Releaseumfang: bestehende Übersicht entschlacken, Szene mit exklusiven Werkzeug-Drawern, SL-Vorbereitung und mobile Bedienung verbessern, Kalender mit festen SL-Terminen und Terminabstimmung, gemeinsames Whiteboard für ausdrücklich gruppensichtbare Sitzungen.

Keine neue Migration, kein Import und keine Änderung bestehender Accounts, Charaktere, Kampagnen oder freigegebener Sitzungsinhalte. Migration 0012 ist bereits vorhanden. Neue Kalender- und Whiteboard-Daten verwenden die bestehenden Records und Berechtigungen.

Bildschirmfreigabe bleibt auf `closed-alpha-production` serverseitig gesperrt. Relay und echter Medien-Ende-zu-Ende-Test fehlen. Mikrofon und Webcam sind nicht implementiert. Whiteboard-Abgleich erfolgt etwa alle zwei Sekunden, nicht über einen WebSocket-Dienst.

Prüfungen: 213 Unit-/Regressionstests, 1304 isolierte Integrationprüfungen, 46 Rollenfundament-Prüfungen, Typprüfung, gezieltes ESLint, lokaler und Produktionsbuild sowie Wrangler-Dry-Run bestanden. Die Medienfreigabe-Sperre wurde zusätzlich nach dem vollständigen Integrationlauf eingebaut; lokaler Signalisierungspfad unverändert.

Produktionssicherung privat unter `.local-work/spieltisch-release-20261012`: vollständiger Datentabellen-Export B0.sql, originales Schema B0-schema.json, geprüfte Wiederherstellung B0-restored.sqlite und Time-Travel-Bookmark in backup-result.json. D1-Gesamtexport unterstützt vorhandene FTS5-Tabellen nicht. Deshalb wurden sämtliche regulären Tabellen in einem gemeinsamen Export gesichert, virtuelle Suchtabellen aus dem Originalschema erzeugt, sekundäre Indizes und Trigger aus dem Schema wiederhergestellt und FTS aus den gesicherten Abschnitten neu aufgebaut. SQLite-Integrität ok, keine FK-Verletzungen. Alle Sicherungsbestandteile bleiben privat und außerhalb von Git.

Deployment erfolgt gezielt auf den bestehenden Worker mit unveränderten DB-/R2-Bindings, Kompatibilität, Laufzeitlimits und Observability. Zusätzliche Preview-URLs wurden vor dem Release abgeschaltet; stabile Live-Adresse bleibt erhalten. Kein automatisches Deployment von main vorausgesetzt, kein Main-Overwrite.

Nachprüfung: veröffentlichte Versionskennung und 100-Prozent-Traffic, Bindings und Preview-Sperre, anonyme Zugriffsabwehr, erneute private Sicherung und Vergleich persistenter Tabellen. Authentifizierte Browserabnahme der neuen Funktionen durch echte Teilnehmer bleibt von lokalen Rollenprüfungen getrennt.

Rollback: kein Datenbank-Restore als Testbereinigung und kein blindes Zurückschalten auf Code, der die neuen internen Whiteboard-/Abstimmungsrecords nicht schützt. Bei Problemen zuerst Zugriff sichern und kompatiblen Fix-forward verwenden. Bestehende Spieleranmeldungen und neue Schreibvorgänge erhalten.

Tatsächlicher Deployment-SHA, Version, Sicherungshashes und Nachprüfung werden im privaten Releaseprotokoll dokumentiert; dieser Text ist keine vorweggenommene Live-Erfolgsbestätigung.
