# Chronik von Kleve – Pre-Alpha v0.1.037 Phase C

Stand: 26.09.2026. Status: lokaler Integrationskandidat, noch nicht live-abnahmebereit.

## Quellstand

Der konsolidierte Arbeitsstand liegt lokal unter `.review-work/phase-c/e1-working-copy`, Branch `codex/phase-c-etappe-1-ortverwaltung`, auf Basis des geprüften Phase-C-Remotestands `c822c0d7a079807a7123dc3d9bddd099b1cdb77c`. Der Integrationskandidat enthält die Phase-C-Reviewkorrekturen, den fail-closed Testressourcen-Runner und Auth 2.0 samt Migration 0006. Der endgültige lokale Kandidatencommit wird im Abschlussbericht dieses Arbeitslaufs ausgewiesen. Der Remote-Status von PR #6 wurde nicht geändert; kein Push, PR-Update, Merge oder Deployment wurde ausgeführt.

Das aktualisierte Source-Delta enthält die Phase-C-Dateien und lokale Review-/Preview-Korrekturen. Keine Git-Metadaten, Umgebungsdateien, Secrets, Abhängigkeiten oder Build-Ausgaben sind enthalten.

## Funktionsstand

Das CMS verwendet bestehende location_nodes und stabile Entity-IDs; Electric Taberna bleibt Referenzort. Editor-Draftlisten liefern nur Gruppenentwürfe der aktiven Kampagne für @group. Private und Public-Revisionen samt Inhalten und Metadaten werden ausgeschlossen. Bildvorschauen prüfen Rolle, Kampagne, konkrete Revision, Zielgruppe, Status und den passenden Anhang. Private CMS-Bilder erhalten keine allgemeine Datei-URL.

Die gemeinsame serverseitige Projektion versorgt Detail, Hub, Suche, Karte und Medien. Veröffentlichungen sind gezielt für Public, Gruppe oder Spieler. Public bedeutet derzeit nicht anonym: Der Reader verlangt Anmeldung und aktive Kampagnenmitgliedschaft. GM_SECRET, Recovery und fremde Kampagnen bleiben gesperrt.

## Migration und Preview-Konfiguration

Migration 0005 ergänzt Revisionen, Events, Medienreferenzen und Releases additiv. Migration 0006 ergänzt Auth-Konten, Provider-Identitäten, gehashte Sitzungen, Rate Limits sowie einen expliziten, unveränderlichen Crosswalk zu vorhandenen `members.id`-Werten. Migrationen 0004/0005/0006 wurden nur mit frischer lokaler Test-D1 ausgeführt. Kein Backfill oder echtes Konto wurde angelegt. Keine produktive Migration, kein Recovery-Import oder Deployment wurde durchgeführt.

Wrangler 4.137.0, @cloudflare/vite-plugin 1.58.0, @cloudflare/workers-types 5.20260925.2 und Miniflare 5.20260921.0-alpha sind im Lockfile fixiert. Miniflare ist eine direkte Entwicklungsabhängigkeit, weil der isolierte Integrationstest es direkt importiert. Die produktiven Top-Level-Bindings in vite.config.ts sind unverändert. Für Worker Previews wird ein getrennter Wrangler-Previews-Block erzeugt. Nicht-main-Builds verweigern fehlende oder partielle Preview-Konfiguration, falsches Worker-Ziel, ungültige Datenbank-ID und Produktions-D1/R2-Namen. Die lokalen Tests decken diese Ablehnungen ab.

Eine lokale Workers-CI-Buildsimulation band Preview-D1 chronik-von-kleve-phase-c-db (93863382-2046-4efc-a5b7-7eb1306955f9) und Preview-R2 chronik-von-kleve-phase-c-r2. Production blieb chronik-von-kleve-db (a4bc79e6-3f33-4b03-b240-9c341bd1d4d7) und chronik-von-kleve-r2. Im Build-Artefakt gab es keine legacy_env-Sektion und keine Runtime-Variablen. Das war ein lokaler Build, kein Cloudflare Preview.

## Aktueller Cloudflare-Iststand, nur lesend geprüft

Die Preview-D1 existiert und meldet null Tabellen. Der Preview-R2-Bucket existiert; Objekte wurden nicht aufgelistet. Die Build-Variablenabfrage lieferte keine benutzerdefinierten Variablen. Die vier PHASE_C-Werte fehlen daher noch in den Cloudflare Build Settings.

Für den Phase-C-Branch besteht eine Preview-Konfiguration mit auto_build=true und auto_delete=true. Die letzten zwei Preview-Build-Datensätze standen auf stopped. Dieser Auftrag löste keinen Preview-Build aus. Die Worker-Build-Konfiguration für main weist npm run build und npx wrangler deploy aus. Eine Cloudflare-Access-Anwendung für Preview Worker URLs ist inzwischen eingerichtet; ihre Allow-Regel ist auf Cloudflare-Kontomitglieder beschränkt. Ein echter Access-Login wurde nicht getestet. Damit ist die ältere Drive-Notiz „Access nicht aktiviert“ überholt.

## Offene Infrastruktur- und CMS-Abnahme

Der Worker muss die vier benutzerdefinierten PHASE_C-Werte in Workers Builds eintragen, den erzeugten Preview-Block prüfen und den Access-Schutz mit erlaubtem und abgewiesenem Zugang testen. Ein späterer Preview-Push kann wegen auto_build=true automatisch einen Preview-Build starten. Migrationen 0004/0005 dürfen vorher nur manuell auf der Preview-D1 angewendet werden.

Die CMS-Abnahme durch den Nutzer ist offen: Speichern und Fehlerrückmeldungen, Koordinaten-/Markerbearbeitung, Navigation sowie Hierarchie, Beschriftungen und visuelle Qualität. Kein Redesign wurde in diesem Abschluss begonnen.

Weitere offene Punkte: kein anonymer Public-Reader; Auth 2.0 ist nur lokal mit synthetischen Konten integriert; das sichere manuelle Provisionierungs- und Crosswalk-Verfahren für reale Alpha-Nutzer ist noch nicht freigegeben oder umgesetzt; die E-Mail-Adresse muss durch diesen freigegebenen Prozess unabhängig bestätigt werden; Google-/Discord-OAuth ist nicht implementiert; es wurde keine echte Plattformadministratorrolle vergeben. Passwörter werden mit PBKDF2-HMAC-SHA-256 / 600.000 Runden gespeichert; Login-JSON ist auf 2 KB, E-Mail auf 320 und Passwort auf 200 Zeichen begrenzt. Keine Live-Browser-/Mobilprüfung, MAP-QA-01 bis MAP-QA-04 offen. Keine neue Lore oder kanonischen Orte.

Die abschließende `drizzle-kit check`-Prüfung nach den Auth-Härtungen war erfolgreich („Everything's fine“); sie prüft Journal und Snapshots, führt aber keine produktive Migration aus. Build, Typecheck, Lint, 45 Fachtests, 460 Integrationstests sowie 46 Rollen-/Backfill-/Rollbackprüfungen waren erfolgreich. Der vollständige Cloudflare-Remote-Test wurde nicht ausgeführt: Die Wrangler-Anmeldung fehlt, und die separate Cloudflare-Test-D1 enthält nur `_cf_KV`, nicht die Migrationen 0000–0006. Die isolierten Integrationstests nutzten frische lokale Miniflare-D1/R2-Ressourcen. Siehe Testbericht, Dateiliste, Migration-0005-und-Rollback, Berechtigungen-und-Medien, Identity-Cloudflare-Auth-Gate und Cloudflare-Testlauf.

## Produktionsfreigabe-Gate

Am 26.09.2026 zeigten die lesenden Cloudflare-Prüfungen für den Produktions-Worker `chronik-von-kleve` weiter die Bindings `DB` → `chronik-von-kleve-db` (`a4bc79e6-3f33-4b03-b240-9c341bd1d4d7`) und `BUCKET` → `chronik-von-kleve-r2`; Preview-URLs sind deaktiviert. Die Produktions-D1 enthält null Anwendungstabellen und ausschließlich die interne `_cf_KV`-Tabelle. Der separate Test-D1-Stand ist ebenfalls migrationsleer. Eine echte D1-Sicherung als SQL-Export wurde nicht erzeugt.

Als aktueller Produktions-Restore-Punkt wurde lesend die D1-Time-Travel-Bookmark-ID `00000005-00000000-000050f2-39e332c3cf5bbf907db3dcddc5688708` festgestellt. Sie ist ein Cloudflare-Restore-Punkt, kein heruntergeladener, unabhängig archivierter Datenbankexport. Unmittelbar vor einer später genehmigten Produktionsänderung muss der Bookmark erneuert, ein exportierter Backup-Stand erstellt und dessen Wiederherstellbarkeit geprüft werden. Rollback-Plan: Anwendung zurück auf den vorherigen Worker-Stand; D1 bei Bedarf im freigegebenen Wartungsfenster auf den vorab bestätigten Bookmark wiederherstellen; R2-Objekte anhand eines vorherigen Bestands-/Sicherungsplans behandeln. Es wurde kein Rollback ausgeführt.

Da die Produktions-D1 keine Anwendungstabellen hat, genügt bei späterer Veröffentlichung keine isolierte Ausführung von 0004–0006: Nach Backup und ausdrücklicher Freigabe wäre die kompatible vollständige Basiskette 0000–0006 in Reihenfolge zu prüfen und auszuführen. Diese Abnahme ist offen; dieser Auftrag hat nichts davon verändert.

Draft PR #6: https://github.com/stenzelmaik-lang/chronik-von-kleve/pull/6
Offizieller Drive-Ordner: https://drive.google.com/drive/folders/1yTzK9MRQ8BF7_7z9bEVyNcHojZve45xu
