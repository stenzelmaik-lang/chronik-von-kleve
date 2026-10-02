# SL-Zugriff auf Kampagnencharaktere – 02.10.2026

## Befund

Im angemeldeten produktiven Brave-Browser enthielt die Command-Center-Auswahl ausschließlich Pano / Noir Kim Aiko. Die Ursache wurde im Quellcode bestätigt: Command-Center-SQL, Entity-Projektor, Detail-Projektor und Schreibberechtigung schlossen private Charaktere anderer Besitzer auch für die zuständige SL aus.

## Korrektur

Aktive `campaign_gm` und `campaign_owner` erhalten Zugriff auf Charakterbögen ihrer eigenen Kampagne, einschließlich privater Entwürfe. Eine zentrale Rollen-/Kampagnenprüfung schützt den Zugriff. Listen, Bogen, Engine und Regiefokus verwenden die gleiche Berechtigung. Es werden keine Sichtbarkeiten, Besitzer oder bestehenden Charakterwerte migriert. Private Charaktere bleiben anderen Spielern verborgen.

Private Spielernotizen, Nachrichten, Dateien und Inventardaten behalten ihre bisherigen separaten Zugriffsregeln. Bestätigte permanente Werte und XP-Ledger bleiben gegen direkte Manipulation gesperrt; die vorhandenen Prüfungs- und Korrekturaktionen gelten weiterhin. Private Charaktere werden nicht automatisch eingereicht, bestätigt oder veröffentlicht. Die Charakter-Sichtbarkeitsauswahl erklärt den SL-Zugriff ausdrücklich.

## Nachweise

- Typecheck, vollständiges Lint und Build: bestanden. Bekannte Warnung für Client-Chunks über 500 kB bleibt bestehen.
- 124 Fach-/Regressionstests bestanden.
- 934 Integrationstests, atomarer Test-D1-Batch-Rollback und 46 Rollen-/Migrationsprüfungen bestanden, ausschließlich isoliert lokal.
- Explizit geprüft: privater Spielerbogen in SL-Liste/Command Center; SL lesen/bearbeiten; normale versionsgeschützte Speicherung; stale write 409; Originalwerte zurückgespeichert; Spieler B, Editor, blocked/pending und fremde Kampagnen abgewiesen.
- Bestehende Tests für private Notizen, Briefe, Dateien, Inventar und bestätigte Charakterwerte bleiben bestanden. Recovery-Regression bestanden.
- Tatsächlicher lokaler Browser: fremden Spieler-A-Bogen als Demo-SL öffnen, Konzept ändern, speichern, vollständig neu laden, Änderung wieder im Bearbeitungsdialog lesen, synthetisches Konzept anschließend zurücksetzen.
- Live-Prüfung war ausschließlich lesend; keine produktiven Charakterwerte oder Rollen geändert. Die Korrektur ist noch nicht live installiert.

## Lieferung

Push auf `codex/story-scene-manager-foundation` enthält auch die bereits gesicherten Szenenmanager- und Verkleinern-Korrekturen. Kein Merge, Deployment oder produktiver Datenbankeingriff. Cloudflare-Production-Branch im Dashboard vor Push: `main`; dieser Push verändert `main` nicht. Die bereits sichtbare ältere Cloudflare-Build-Fehlermeldung zu pnpm-Konfiguration wurde nicht als Teil dieses Berechtigungsfixes verändert.

Lokale Prüfung: http://127.0.0.1:8798/spielbereich?bereich=charaktere
Testprotokolle und Screenshot: `outputs/story-scene-20261002/sl-character-*` (lokale Artefakte, nicht in Git).
