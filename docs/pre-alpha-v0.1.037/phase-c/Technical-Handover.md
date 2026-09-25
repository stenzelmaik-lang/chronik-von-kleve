# Chronik von Kleve – Pre-Alpha v0.1.037 Phase C

## Stand

- Arbeitsbasis und Phase-B-PR-Head: `d8e147128630d46aa34137f798b4a886b3d3721b`.
- Implementierungsbranch: `codex/pre-alpha-v0.1.037-phase-c`.
- Der Phase-C-Änderungssatz wird als eigener Draft-PR gegen den Phase-B-Branch geführt und verweist auf GitHub-Issue #2.
- **Nicht gemergt, nicht produktiv deployed.** Es gibt für Phase C daher keine Sites-Version und keine Deployment-ID.
- Die bestehende `vite.config.ts` samt D1-/R2-Bindings wurde nicht geändert.

## Was jetzt funktioniert

Das erste Orts-CMS arbeitet mit bestehenden `location_nodes` und ihren unveränderten Entity-IDs. Die Electric Taberna lässt sich auswählen; bestehende Bereiche, Räume und Informationsknoten können pro Zielgruppe als Draft bearbeitet werden. Draft-Speichern ist versionsgeschützt. Ein Editor kann zielgebundene Gruppen-Drafts schreiben und zur Prüfung einreichen; nur Owner oder Spielleitung können freigeben, veröffentlichen, zurückziehen oder gezielt sperren.

Die Freigaben erzeugen zielbezogene Release-Versionen. Player-Detailseite, Hub-Kacheln, Suche und Kartenmarker lesen dieselbe serverseitige Player-Projektion. Eine persönliche Freigabe bleibt an eine aktive konkrete Spieleridentität gebunden. Sperren stoppen die Auflösung in niedrigere Zielgruppen; Widerrufe können auf eine ausdrücklich vorhandene niedrigere Freigabe zurückfallen, nie auf alte Entity-Felder, sobald der Knoten verwaltet wird.

Private CMS-Bilder werden in R2 abgelegt und nur über `/api/cms/media` nach erneuter Zielgruppenprüfung gestreamt. Die bestehende Datei-Löschung verweigert Referenzen auf aktive Editorial-Medien. Der Geodateneditor startet für Electric Taberna bei `unknown`. Erfundene oder bisherige Testkoordinaten werden nicht übernommen; Koordinaten benötigen einen expliziten Kartenklick, Genauigkeit, Quelle und Prüfzeitpunkt.

Das ist ein lokaler, isoliert geprüfter Implementierungsstand. Es wurde kein angemeldeter Live-Browser gegen ein Phase-C-Deployment geprüft; dieses Deployment existiert absichtlich noch nicht.

## Architektur

- Kanonische Identität und Elternbeziehungen verbleiben in `entities` und `location_nodes`; es gibt keine zweite Ortsdatenbank.
- `entity_revisions` hält zielgruppengebundene, versionierte Drafts, Player-Payload, getrennte GM-Notizen und geprüfte Geodaten.
- `entity_revision_events` zeichnet Draft- und Review-Übergänge append-only auf.
- `entity_revision_media` bindet bestehende Datei-IDs an konkrete Revision und Zielgruppe.
- `entity_revision_releases` ist ein append-only Ledger für `publish`, `revoke` und `block`, pro Entity und Zielgruppe fortlaufend versioniert.
- `server/location-revision-projector.ts` löst Preview und Liveausgabe. Die bestehende `server/location-repository.ts` verwendet den Projektor sowohl für Detail als auch World Hub.
- `server/location-cms-service.ts` prüft Rollen, stabile IDs, Elternknoten, Payloads, Reviewstatus und erwartete Versionen. D1-Batches sichern zusammengehörige Revision/Event- und Release/Knowledge-Schreibvorgänge atomar.
- Public, Gruppe und Spieler sind getrennte Ziele. Bei Spielern wird die aktuelle Kampagnenmitgliedschaft serverseitig geprüft. `campaign_owner` und `campaign_gm` dürfen prüfen und veröffentlichen; `campaign_editor` darf sichere Gruppen-Drafts schreiben und einreichen; normale Spieler dürfen das CMS nicht öffnen.

## Sicherheitsgrenzen

`GM_SECRET`, `recoveryOnly` und Recovery-Entities sind weder bearbeitbar noch publizierbar. Gesperrte oder fremde Kampagnenmitglieder können das CMS und seine APIs nicht nutzen. Spieler erhalten weder Draft- und Review-Daten noch GM-Konflikte oder direkte R2-URLs. Persönliche Bildfreigaben werden bei jedem Abruf erneut gegen Release, Revision, aktive Mitgliedschaft und Zielperson geprüft.

Das CMS setzt keine neue Anmeldung um. Es verwendet den vorhandenen serverseitigen Sites-Actor und dessen Kampagnenrollen. Die spätere Cloudflare-Anmeldung mit E-Mail/Passwort, Google oder Discord bleibt ein Release-Gate; die nötigen Identitäts- und Datenzuordnungen stehen in `Identity-Cloudflare-Auth-Gate.md`.

## Migration und Betrieb

Migration `0005_phase_c_editorial_revisions.sql` ist additiv. Sie ergänzt vier Tabellen, Trigger/Indizes und den für den zusammengesetzten Dateischlüssel benötigten eindeutigen Index auf `files(campaign_id,id)`. Es werden keine Orts-, Charakter-, Inventar- oder Recovery-Zeilen aktualisiert. Drizzle-Schema, Snapshot und Journal sind abgeglichen (`drizzle-kit check`).

Migrationen 0004 und 0005 liefen ausschließlich auf frischen temporären Test-D1-Datenbanken. Der Integrationslauf nutzt einen lokalen Miniflare-Worker, zufällige OS-Temp-Verzeichnisse und nicht persistentes Test-R2. Es gab keine produktive Migration, keinen Backfill, keine produktive Datenänderung, keinen Produktivimport und kein Deployment. Ein Rollback-Versuch wurde ausschließlich auf einer physischen Kopie der isolierten Test-D1 ausgeführt.

## Grenzen und offene Freigaben

- Echte Cloudflare-Identität und sichere Verknüpfung vorhandener Konten sind nicht implementiert.
- Es gibt keinen echten Plattformadministrator und keinen Bootstrap-Endpunkt.
- Ein Live-Browser-/Mobiltest, echter Player-Login und produktive Medien-ACL-Prüfung sind offen.
- MAP-QA-01 bis MAP-QA-04 aus v0.1.036 bleiben unabhängig offen.
- Keine neuen Orte, Lore, Kampagnen oder Recovery-Inhalte wurden erstellt.
- Der Release-PR bleibt Draft und ungemergt. Vor Livebetrieb müssen Migrationen, Identitätsfreigabe, Live-QA und Deployment separat abgenommen werden.

## Handoff pointers

Siehe `Migration-0005-und-Rollback.md`, `Berechtigungen-und-Medien.md`, `Identity-Cloudflare-Auth-Gate.md` und `Testbericht.md`. Der endgültige Commit/PR-Head wird zusätzlich im Drive-Release-Nachweis festgehalten, nachdem der Branch geschrieben und verifiziert wurde.
