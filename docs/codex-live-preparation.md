# Codex v1 – Live-Vorbereitung, 10.10.2026

## Grenzen dieser Freigabe

Kein Push, Merge, Deployment, Produktionsimport oder produktive Migration ausgeführt. Keine Konten, Rollen, Spieler-, Charakter- oder Kampagnendaten geändert. Google Drive bleibt das einzige verwaltete Quellarchiv; Spieler benötigen keine Drive-Verbindung. Der bestehende Reader und die 15 vorbereiteten Quellen werden weiterverwendet.

## Gesicherter Stand

Der bereits lokal abgenommene Stand ist separat als Commit `89bfaf7` gesichert. Der nachfolgende Commit ergänzt ausschließlich die ausdrücklich beauftragte SL-Buchfreigabe, dauerhaften SL-Zugriff, technische Rechtstextseiten und Release-Prüfnachweise. Der endgültige SHA steht im Abschlussbericht.

Private Bestände werden nicht versioniert oder im öffentlichen Client-Build ausgeliefert:

- Produktionsbackup: `C:/Users/Stenz/Documents/Codex-Private-Backups/codex-v1-20261010/production-B0.sql`.
- SHA-256: `cfcf60a4c0cde10e3f9edb566fcda6c0eccd276931a722db575473aaa4c2fb56`.
- Quellen-/Seiten-/OCR-/Provenienzarchiv: dort `private-import.tar`, 1.606.591.488 Bytes.
- Archiv-SHA-256: `92ad5edabfec5be4e3beb421fca03ad39dde5fe51f750d210d3de16d3e2ec21b`.
- Archiv vollständig zurückgelesen: 2.950 Dateien, 1.604.306.653 Bytes Inhalt; alle originalen und vorbereiteten Quellhashes identisch. Historische Import-Auditdatei bleibt ebenfalls im Archiv erhalten.
- Private Prüfkopien und Manifeste: `.local-work/codex-release-20261010/`. Keine Webroute darauf.

Dies ist eine zweite lokale Kopie außerhalb des Checkouts, kein verschlüsseltes externes/off-device Backup. Dateien enthalten geschützte Regelwerke bzw. private Konto-/Sitzungsdaten; nicht öffentlich teilen.

## Migration 0012

Frischer vollständiger Export von Produktions-D1 `chronik-von-kleve-db` am 10.10.2026, 09:30 Uhr Europe/Berlin. Der Export kann D1-Abfragen vorübergehend blockieren; er schreibt keine fachlichen Daten. Export und Backup bleiben unverändert.

Migration getestet auf daraus wiederhergestellter lokaler SQLite-Kopie und zusätzlich im isolierten workerd/Miniflare-D1. Vergleich sämtlicher Zeilenhashes und Anzahlen der 31 bestehenden Tabellen bestanden. SQLite-Integritätsprüfung erfolgreich; Fremdschlüssel vor/nach Migration ohne Fehler. D1 erlaubt `integrity_check` nicht, deshalb erfolgt diese Prüfung separat auf SQLite; der Runtime-Test prüft Datenhashes/Fremdschlüssel.

Schemaänderung ausschließlich:

- `codex_sections` mit FK zu bestehenden `entity_content_blocks`, `ON DELETE CASCADE`.
- Index `idx_codex_sections_block`.
- externe, wiederaufbaubare FTS5-Tabelle `codex_fts` einschließlich FTS-interner Tabellen.
- drei INSERT/UPDATE/DELETE-Trigger zur Indexpflege.

Keine Änderung bestehender fachlicher Tabellen, keine NPC-/Legacy-Migration, keine Buchimporte durch 0012. SQL, Drizzle-Schema, Journal und Snapshot bleiben konsistent. Für Freigabemetadaten reicht vorhandenes Entity-JSON; keine neue Migration erforderlich.

Der D1-Time-Travel-Lesezugriff funktioniert. Der bei der Vorbereitung gelesene Bookmark ist **nicht** der finale Cutover-Bookmark und ersetzt kein frisches Backup direkt vor späterer Änderung. Kein Restore ausgeführt.

Wichtig: D1-SQL-Export unterstützt laut [Cloudflare](https://developers.cloudflare.com/d1/best-practices/import-export-data/) keine Datenbanken mit virtuellen Tabellen. Nach 0012 darf deshalb nicht ungeprüft dasselbe Voll-Exportverfahren versprochen werden. Keinesfalls produktive FTS-Tabellen für ein Backup löschen. Für spätere Wartung zuerst Time Travel und einen separat getesteten logischen Export der Basistabellen plus Wiederaufbau des abgeleiteten Indexes vorsehen. [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) setzt die ganze Datenbank zurück und darf neue Spieleränderungen nicht blind überschreiben.

## Zugriff und zentrale Buchfreigabe

- Der Auth-/Mitgliedschaftspfad bleibt unverändert: aktive Kampagnenmitgliedschaft erforderlich; fremde Besucher, gesperrte Konten und fremde Kampagnen abgewiesen.
- Produktionskopie bestätigt Pano als aktive `campaign_gm`. Diese vorhandene Rolle erhält vollständigen Zugriff auf alle fertig vorbereiteten Bücher, Inhaltsverzeichnisse, Kapitel, Originalseiten und Suchfundstellen, unabhängig vom lokalen Prüfmodus. Keine Rolle neu vergeben.
- Spielerfreigabe und Nutzungsberechtigung sind getrennte Bedingungen. Neue nicht freigegebene Bücher bleiben SL-intern; der schon freigegebene eigene Stress-Handout-Prototyp behält seine Freigabe.
- SL-Steuerung im bestehenden Reader: „Buchfreigaben für Spieler“. Freigabe betrifft das **gesamte** Buch inklusive aller Kapitel/Originalansichten. Widerruf sperrt neue Lese- und Suchanfragen sofort; bereits angezeigte Inhalte können technisch nicht rückwirkend entfernt werden.
- `PATCH /api/codex` akzeptiert nur Buch-ID und Freigabe-Bool, prüft echten aktiven SL-/Owner-Status, Kampagne und Herkunft; keine Rechtebestätigung über diese API. Erfolgreiche Änderung speichert Akteur und Zeitpunkt im Buch-JSON, D1-Batch atomar.
- Verlagswerke werden erst freigabefähig, wenn eine gesondert autorisierte Rechtebestätigung `rights=licensed`, einen nichtleeren `rightsEvidence`-Nachweis und `rightsConfirmedAt` hinterlegt. Alle realen Verlagsbestände bleiben derzeit `pending`. Die Felder sind keine juristische Validierung eines Nachweises.
- Bei ausdrücklicher Gesamtfreigabe werden Kapitel sichtbar; beim Widerruf bleibt der übergeordnete Buchzugriff zwingend gesperrt. Geheimhaltung lässt sich nicht durch Kapitel-ID, Suchquery oder Seitenbild-URL umgehen.
- Generische Content-Block-Endpunkte liefern/ändern keine Codex-Kapitel. Originale besitzen keine öffentlichen Datei-API-Einträge. Reader-Endpunkte liefern nur Kapitel oder geschützte JPEG-Seiten, ohne direkte PDF-/Drive-URLs; `private, no-store`, `nosniff`.
- Produktions-R2 lesend geprüft: `r2.dev` deaktiviert, keine Custom Domains. Keine Einstellung geändert. Authentifizierte Worker-Routen bleiben für die spätere Live-Abnahme gesondert zu prüfen.
- Kein Download-Button. Speichern/Abfotografieren sichtbarer Inhalte ist dennoch nicht absolut verhinderbar.

## Rechtstextseiten

`/impressum` und `/datenschutz` technisch vorhanden und vom Codex verlinkt. Offen gekennzeichnete Platzhalter; keine Anbieteranschrift, Rechtsgrundlage, Frist oder juristische Aussage erfunden. Vor Live-Freigabe sind bestätigte Betreiber-/Datenschutztexte einzusetzen.

## Späterer Live-Ablauf – noch nicht ausgeführt

1. Gesonderte Freigabe für Deployment, Migration und kontrollierten Import einholen; geprüften Commit exakt festlegen. Rechtstexte bestätigen. Wartungs-/Schreibstopp und reale rein lesende Spielerprüfung vereinbaren.
2. Ressourcen erneut identifizieren; frisches finales Backup und Time-Travel-Bookmark vor 0012, aktiven Code und private R2-Konfiguration festhalten. Das heutige B0 ist nur Vorbereitungssicherung.
3. Produktionsschema gegen Prüfkopie vergleichen. Bei Abweichung oder vorhandenem Codex-Schema stoppen; nicht blind alle alten Migrationen erneut ausführen. Nur geprüfte 0012 anwenden und Migrationstracking kontrolliert nachführen.
4. Exakten geprüften Code deployen. Kein weiterer Reader, keine Verlagsfreigabe durch Deployment.
5. Kontrollierten Upload/Import separat freigeben und durchführen. Das private Release-Paket ist durch `scripts/codex-release-package.mjs` mit demselben validierten Importer erzeugt: `books-staged.sql`, `books-activate-after-assets.sql`, `r2-private-assets.json`. Der Importer bleibt unverändert lokal-only; der Paketgenerator besitzt keine Netzwerk-/Produktionsbindung. Er liest die Produktionskopie ausschließlich read-only, prüft vorhandene IDs und verwendet deren eindeutig bestätigten Pano-Owner. Alle 15 Spielerfreigaben sind im Paket ausdrücklich geschlossen, auch das eigene Handout. Zunächst nur neue private R2-Schlüssel prüfen/hochladen und Hashes verifizieren, dann den gestuften SQL-Import kontrolliert ausführen. Aktivierungs-SQL erst nach vollständigem Assets-/Zeilen-/FK-Abgleich. Reale Konten und Legacy-Bestände werden nicht übernommen, geändert oder ersetzt. Paket bei verändertem Produktionsstand erneut prüfen; nicht unbesehen alte SQL-Dateien ausführen.
6. SL prüft alle Bücher und Fundstellen; realer Spieler authentifiziert sich selbst, prüft ausschließlich freigegebene eigene Regeln sowie Geheimnis-/Rechtesperre. Keine Veränderung bestehender Spieler-/Charakterdaten, kein B0-Restore als Testbereinigung.
7. GO nur bei Integrität, Originalschutz, Rollenprüfung, vollständigen 15 Buchbeständen und bestandenen Reader-/Such-Smokes. Verlagsfreigabe bleibt bis gesonderter Nutzungsberechtigung ausgeschlossen.

Bei Problemen: Sperre halten, vorzugsweise Fix-forward. Keine blinde Rücksetzung von Worker/D1 nach neuen Daten oder Anmeldungen. FTS ist abgeleitet und kann aus `codex_sections` wiederaufgebaut werden, nicht aus bereits zurückgesetzten Spielerdaten. Jeder Restore braucht separat bewertete Auswirkungen und ausdrückliche Freigabe.

## Verbleibende Grenzen

79 Seiten mit ausdrücklich ungeprüfter OCR, eine Seite ohne erkannte Zeichen; Originalbilder vollständig. Vier Editionsmetadaten offen, nicht geraten. Finale Live-Performance/Smoke-Tests noch nicht durchgeführt. Rechtstexte, Freigabe/Ausführung des vorbereiteten Produktionsimports, frisches Cutover-Backup, produktive Migration/Deployment und gesonderte Verlags-Spielerberechtigung bleiben Freigabehürden, nicht erledigte Schritte.

## Abschlussprüfungen

191 Unit-/Regressionstests, 1.211 HTTP-Integrationstests, zusätzlich 46 Rollenprüfungen bestanden. Typecheck/Build erfolgreich; Lint keine Fehler, fünf bestehende fachfremde Warnungen. Alle 15 Quellen gegen Reader/TOC/Suche/Seitenbilder erneut geprüft: 5.199 Prüfungen, 2.911 Seiten. Suchmedian ca. 16 ms, p95 ca. 17 ms, ausschließlich lokale API-Messwerte.

Release-Paket zusätzlich auf lokaler Produktionskopie eingespielt: vor Aktivierung fail-closed, danach SL-Reader für alle 15 Bücher, keine Spielerfreigabe, keine Änderung bestehender Zeilen, FK/Integrität bestanden. R2-Paketmanifest ordnet jede Datei einem privaten Schlüssel, Größe und SHA-256 zu. Originale/Reader-Texte sind nicht im Git-Commit, sondern nur im privaten Paket.

Browser: SL-Freigabebereich per Tastatur nutzbar; Verlagsfreigabe ohne Nutzungsberechtigung deaktiviert; Widerruf des eigenen synthetischen Testhandouts führt in der Spielerrolle nur zu Metadaten, keine Steuerung. Freigabebereich bei Mobil-Viewport 375×812 ohne horizontalen Dokumentüberlauf. Impressumsplatzhalter erreichbar. Keine reale Benutzeranmeldung und keine Live-Smokes durchgeführt.

Ein lokaler Neuimport scheiterte einmal mit `EADDRINUSE` am Miniflare-Transport bei parallel laufenden Prüfungen. Der anschließende frische Lauf und vollständige Quellenprüfung bestanden. Keine Produktionsauswirkung; keine Wiederaufnahme/Überschreibung eines halbfertigen Produktionsimports.
