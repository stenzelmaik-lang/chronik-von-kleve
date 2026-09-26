# Testbericht – Pre-Alpha v0.1.037 Phase C

Stand: 26.09.2026. Alle Datenbanktests liefen lokal mit isolierten Testressourcen. Es gab keine produktiven Änderungen.

| Prüfung | Ergebnis | Nachweis |
|---|---|---|
| Lokaler Build | BESTANDEN | Alle App-/API-Routen einschließlich CMS erzeugt. |
| Workers-CI-Buildsimulation | BESTANDEN | Lokaler Test mit Phase-C-Werten; Preview-D1/R2 getrennt von Production; legacy_env fehlt. Kein Cloudflare-Build/Deploy. |
| Lint | BESTANDEN | ESLint; dist und .next ausgeschlossen; keine Lintausgabe. |
| Typecheck | BESTANDEN | TypeScript ohne Ausgabe/Fehler. |
| Fachtests | 45 BESTANDEN | Foundation, Recovery, Ortsprojektion, Geodaten, Cache, Karte, Preview-/Remote-Test-Konfiguration, Rich Text und Passwort-Hashing. |
| Integration | 460 BESTANDEN | Miniflare, frische temporäre Test-D1 und isoliertes Test-R2; Auth 2.0, CMS-Workflow, verifizierte E-Mail, generische Ablehnung und Passwortlängenbegrenzung. |
| Rollen/Backfill/Rollback | 46 BESTANDEN | Frische isolierte Test-D1, Konflikte, Idempotenz, Status, Audit, Rechte und Rollback-Kopie. |
| D1-Batch-Atomarität | BESTANDEN | Fehlgeschlagener zweiter Batch-Schritt hinterließ keine Teiländerung. |
| Migration 0004/0005/0006 | TEST-D1 BESTANDEN | Ausschließlich frische lokale Test-D1; Auth-Crosswalk bleibt leer, kein Backfill oder echtes Konto. |
| drizzle-kit check | BESTANDEN | Journal, Snapshots und generiertes M0006-Schema stimmen überein. |
| Auth-/CMS-Zugriff | BESTANDEN | Ohne Cookie 401 auf den geschützten CMS-, Mitglieder- und Recovery-Endpunkten; gefälschte OAI-Header 401; Registrierung 404; explizit verknüpfter und verifizierter synthetischer Login erhält nur vorhandene `members.id`. |
| Auth-KDF und Eingabelimits | BESTANDEN | PBKDF2-HMAC-SHA-256 mit 600.000 Runden; unbekannte/unverknüpfte Konten erhalten generische Ablehnung über Dummy-Hash; unbestätigte E-Mail und Passwörter über 200 Zeichen werden vor Session beziehungsweise KDF abgewiesen. |
| Email-only Linking | BESTANDEN | Gleiche E-Mail ohne Crosswalk kann weder anmelden noch Session-/CMS-Daten abrufen. |
| Crosswalk Constraints | BESTANDEN | Doppelte Mitgliedszuordnung und Update vorhandener Links werden von der isolierten DB abgelehnt. |
| Cloudflare-Test-D1/R2 | NICHT AUSGEFÜHRT | Die getrennten Ressourcen existieren, aber Wrangler ist in dieser Umgebung nicht angemeldet. Die Remote-Test-D1 enthält nur `_cf_KV`; Migrationen 0000–0006 wurden dort nicht ausgeführt. Es gab keine Remote-App- oder R2-Schreiboperation. |
| Live-Browser/Access/Player | OFFEN | Kein Phase-C-Deployment und keine echte Alpha-Identität getestet. Der lokale Loginbildschirm wurde im Browser geöffnet; es wurde kein echter Zugang provisioniert. |
| CMS-Funktions-/Designabnahme | OFFEN | Speichern, Marker/Koordinaten, Navigation und UI bleiben beanstandet. |
| MAP-QA-01 bis MAP-QA-04 | OFFEN | Unabhängige Live-Prüfungen bleiben bestehen. |

Insgesamt 552 bestandene automatisierte Prüfpunkte: 45 Fachtests, 460 Integrationsprüfungen, 46 Rollen-/Backfill-/Rollbackprüfungen und eine Atomaritätsprobe. Erwartete negative HTTP-Antworten 401/403/404/409 sind bestandene Sicherheitstests. Sämtliche Auth-Konten und Crosswalks der Suite sind synthetisch und nur in der temporären lokalen Test-D1 vorhanden.

Ein zusätzlicher paralleler Harness-Lauf endete einmal während einer HTTP-Testabfrage mit `fetch failed`; der anschließende vollständige Lauf und ein unabhängiger vollständiger Lauf bestanden jeweils. Der lokale Harness verwendet einen festen Port; weitere parallele Harness-Läufe sollten vermieden werden.

## Datenflussdiagnose

Für den gemeldeten lokalen Veröffentlichungsfehler wurde kein fehlgeschlagener Datenbank-API-Aufruf nachgewiesen. Der beobachtete UI-Pfad hielt vor dem Request an, weil die Veröffentlichungsnotiz fehlte; der aktuelle UI-Pfad liefert dafür einen verständlichen Standardgrund. Der synthetische lokale CMS-Ablauf speicherte den Entwurf in D1, überstand Reload und durchlief Einreichen, Genehmigung sowie gezielte Veröffentlichung. Das beweist den lokalen Testpfad, nicht eine echte Cloudflare- oder Produktionsveröffentlichung. Electric Taberna-Kanon wurde dabei nicht geändert.

## Sicherheitskorrekturen

- campaign_editor erhält ausschließlich Gruppenentwürfe der aktiven Kampagne für @group. Persönliche/Public-Revisionsdaten und Metadaten gelangen nicht in die Editorantwort.
- Preview-API und CMS-Bildvorschau binden den Zugriff an Rolle, Kampagne, konkrete Revision, Zielgruppe und passenden Medienanhang. Erratene persönliche/Public- und fremde IDs ergeben opake 404-Antworten.
- Private CMS-Bilder haben keine generische direkte URL. Der Datei-Löschpfad schützt referenzierte Medien.
- Widerruf und Blockierung greifen in der aktuellen Player-Projektion ohne Legacy-Fallback. Tests decken zwei synthetische Spieler, GM, Editor, blockierten Benutzer, fremde Kampagne, GM_SECRET, Recovery, Notizen und Medien ab.
- Public bedeutet nicht anonym: Der anonyme Reader erhält 401; aktive angemeldete Kampagnenmitglieder lesen gemäß Freigabe.
- Versionsschutz, konkurrierende Saves/Publikationen und atomare D1-Batches sind getestet.

## Datenintegrität und Grenzen

Migrationen 0004/0005/0006, Rollen-Backfill und Recovery-Regression wurden nur lokal auf isolierten Test-D1-Ressourcen ausgeführt. Es wurden keine produktiven Daten, Migrationen, Backfills, Recovery-Importe, Releases, Secrets oder Dateien verändert. Kein produktives Deployment und kein PR-Merge.

Der Build zeigt weiterhin einen minifizierten Client-Chunk über 500 kB. Build erfolgreich; kein riskantes Code-Splitting begonnen. Google-/Discord-OAuth und ein realer, administrativ verifizierter Alpha-Account bleiben Release-Blocker.
