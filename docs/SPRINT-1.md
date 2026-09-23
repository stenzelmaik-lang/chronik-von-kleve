# Chronik von Kleve — Sprint 1 Foundation Reset

Stand: 14.09.2026. Baseline: `addf46bab9201dd185d0717152b39db579fb1028`.
Verbindliche Quelle: [Projektordner](https://drive.google.com/drive/folders/1ohnJLsSwocWUQBg1pfVtCpF6JPdAsc2A).
[Entwicklungsplan](https://docs.google.com/document/d/1nUuARy0g5YDi3n0lQhz2JYU1cvYwYxRSeZ8HS0792ZM/edit) und [Auftrag 001](https://docs.google.com/document/d/1P8bL_Axwjr-_iynvxPmFue-I_c9tmdpe_lC_vI-QLds/edit).
Entwicklung ausschließlich mit Astra, ohne Luna oder Subagenten. Kein Sprint 2 begonnen.

## IMPLEMENTIERT

- Navigation/Shell, API-Client, Types, Record-Editor, Character, Dashboard, Session, World Map, Economy, Merchant, Favors, CMS, Chronicle und Dice aus dem bisherigen Monolithen getrennt. Die Datei `workspace.tsx` koordiniert weiterhin bestehende Galerie, Verwaltungsansicht, generische Listen und Dialogaktionen. Sie enthält keine neue Knowledge-Fachlogik.
- Neue Hooks `use-navigation.ts` und `use-workspace-data.ts`. Zugriffsabhängiger Einstieg wird aus dem URL-Parameter serverseitig übergeben. Asynchrone Datenladevorgänge ignorieren überholte Antworten. Formularzustand wird beim erneuten Laden durch Remount aus dem gespeicherten Stand initialisiert.
- Gemeinsame Domain-Typen und Zod-Enums für Actor/Membership, Campaign, Entity/EntityType, Visibility, CanonStatus, KnowledgeState, Relationship, WorldEvent und KnowledgeGrant.
- Einzige Kampagne: stabile ID `chronik-von-kleve`. Kein Kampagnenwechsel und keine Kampagnenerstellung in der UI.
- Neue D1-Tabellen `campaigns`, `entities`, `relationships`, `knowledge`, `world_events`; Kampagnenbezug an bestehenden `members`, `records`, `files`.
- Legacy-Adapter mit unveränderlichen IDs: `entities.id = records.id`, Verweis `legacy_record_id`. Texte bleiben ausschließlich in `records`. Es werden keine Kanontexte umgeschrieben oder doppelte Inhaltskopien angelegt. Neue native Entitäten besitzen eine UUID und speichern ihren Inhalt in `entities`.
- Serverprojektion `server/entities.ts`: Nicht autorisierte Entitäten fehlen vollständig in Spielerantworten. `gmBody`, reservierte verschachtelte Geheimnisfelder und als `GM_SECRET` markierte Objekte werden nicht ausgeliefert. `GM_SECRET`-Entitäten sind nicht freigebbar. Legacy-Orte mit `discovered=false` oder `content_unlocked=false` werden serverseitig zurückgehalten.
- Minimaler Knowledge-Pfad: GM gibt einer aktiven Gruppe oder einem aktiven Spieler einen Wissensstand; jede Freigabe wird persistent und zusammen mit einem Audit-Ereignis in einem D1-Batch gespeichert. Im bestehenden Record-Editor gibt es für gespeicherte Kampagneninhalte einen Abschnitt „Wissen freigeben“.
- Neue API `/api/entities` (GET, GM-POST für minimale native Entitäten), `/api/knowledge` (GM-GET/POST). Alte `/api/records`-Antworten und der persönliche Export verwenden denselben Schutzpfad.
- Vollständiger strukturierter GM-Kampagnenexport unter `/api/export?scope=campaign`, im Header als „Kampagne sichern“. Enthält Kampagne, rohe Entitäten, Beziehungen, Knowledge, World Events, sämtliche zugeordneten Legacy-Records, Dateimetadaten inklusive R2-Schlüssel und Mitglieder. Auch Daten anderer Besitzer gehören zum expliziten GM-Backup. Persönlicher Export bleibt erhalten.
- Build erfolgreich; ESLint 0 Errors / 0 Warnings; TypeScript-Prüfung erfolgreich; 3 Foundation-Tests und 63 API-Integrationsprüfungen bestanden.

## Architektur und Berechtigungen

Die Anmeldung bleibt Sites/ChatGPT-Authentifizierung. Die Plattform liefert die Identität in vertrauenswürdigen `oai-authenticated-user-*`-Headern. Die GM-Zuordnung erfolgt weiterhin über die serverseitig konfigurierte Variable `GM_EMAIL`. Neue Spieler bleiben `pending`, bis der GM sie aktiviert; `blocked` wird bei jedem geschützten Request abgewiesen. Die produktiven Werte sind nicht Bestandteil dieses Source-Pakets.

Neue Kernobjekte und Abfragen sind intern kampagnenbezogen. Die Mitgliederstruktur bleibt in diesem Sprint auf eine aktive Kampagne je Mitglied beschränkt; dies ist noch keine vollständige spätere Mehrkampagnen-Mitgliedschaft.

Bestehende `visibility=group`-Records bleiben für aktive Spieler lesbar, sofern kein expliziter Legacy-Inhaltslock vorliegt. Bestehende Eigentümerrechte bleiben bestehen. Knowledge-Grants sind zusätzliche Leserechte für den freigegebenen Lesetext; sie geben niemals den GM-Text frei. Ein individueller Grant wird durch einen Gruppen-Grant ergänzt. `UNKNOWN` entzieht nur genau diesen Grant; er überstimmt weder einen anderen Grant noch die alte Gruppen-Sichtbarkeit. Die Oberfläche erklärt dies ausdrücklich. Persönliche Notizen, Charaktere, Inventar, Wirtschaft und Gefallen verwenden weiter ihre bisherigen Sichtbarkeitsregeln und lassen sich über diesen neuen Grant-Editor nicht freigeben.

Der GM sieht in `/api/entities` und im vollständigen Backup alle Kampagnenobjekte. Die alte Record-Liste behält ihre bisherige Behandlung fremder privater Records bei. Das ist eine bewusste administrative Fähigkeit des neuen Kern-/Backup-Pfads; eine feinere Datenschutz-Rollenmatrix ist nicht umgesetzt.

`server/entities.ts` ist die zentrale Leseprojektion. Keine Route liefert neue Tabellen ungefiltert an Spieler. Beziehungen und Ereignisse haben in Sprint 1 noch keine Spieler-Leseroute; ihre Rohdaten sind nur Bestandteil des GM-Backups. URLs werden nicht als Rechte behandelt. Dateiabrufe haben eigene Eigentümer-/Sichtbarkeitsprüfungen.

Die Freigabe eines gesperrten Legacy-Orts setzt ausschließlich in der erlaubten Antwort `discovered/content_unlocked` auf true, damit die bestehende Kartenoberfläche den genehmigten Inhalt öffnen kann. Die kanonisch gespeicherten Flags werden dabei nicht geändert.

## Datenbank und Migration

`drizzle/0001_purple_blockbuster.sql` ist eine additive Migration nach `0000_aromatic_network.sql`, mit aktualisiertem Drizzle-Snapshot und Journal. Sie legt die Kampagne an, ergänzt die drei Legacy-Tabellen und erzeugt einen Identity-Adapter für jeden vorhandenen Record. Es gibt keine Löschung/Neuanlage bestehender Tabellen, keinen Inhaltstausch und keine R2-Schlüsseländerung. Auch vorhandene Records außerhalb des mitgelieferten Katalogs erhalten den Adapter.

Neue `records` erzeugen per INSERT-Trigger automatisch ihre Entität. Der `INSERT OR IGNORE`-Katalogimport bleibt idempotent und überschreibt vorhandene Legacy-Records nicht. Aktualisierungen lesen aktuelle Daten über den Adapter; eine Inhaltskopie muss nicht synchronisiert werden.

Neue Tabellen verwenden Foreign Keys, Beziehungen prüfen beide Endpunkte innerhalb derselben Kampagne. Identitäts-Trigger verhindern das Umbenennen von IDs und Kampagnenzuordnungen. Bei Löschung eines Records werden der Identity-Adapter und abhängige Beziehungen/Grants kaskadiert gelöscht; Audit-Ereignisse bleiben mit ihrer alten Entity-ID erhalten.

SQLite kann einer gefüllten Legacy-Tabelle keine NOT-NULL-Spalte mit nichtleerem Default und Foreign Key hinzufügen. Deshalb besitzen die drei nachträglich ergänzten Kampagnenspalten Default + NOT NULL und prüfende INSERT-/UPDATE-Trigger anstelle eines Tabellen-Rebuilds. Neue Kern-Tabellen haben reguläre FKs. Diese handgeschriebenen Ergänzungen der generierten Migration müssen bei späteren Migrationen erhalten bleiben.

Die Migration enthält keine QA-Spieler, Testentitäten oder Testdateien. Der Test erzeugt seine Fixtures erst in einer isolierten lokalen Datenbank. Die produktive Migration backfillt ausschließlich den dort tatsächlich vorhandenen Bestand. Alle Legacy-Kanonstatus starten neutral als WORKING; es wird kein Kanonstatus aus Lore erraten.

`world_events` protokolliert native Entitätserstellung und Knowledge-Änderungen inklusive ausführendem Actor. Legacy-Updates/-Löschungen erzeugen Trigger-Ereignisse mit `actor_id=legacy-trigger`; hier ist der tatsächliche Bearbeiter noch nicht erfasst. Die Ereignisse enthalten keine kopierten Loretexte. Ein umfassendes Spielwelt-Ereignissystem ist nicht Bestandteil von Sprint 1.

## Export, Wiederherstellung und Sicherung

Der GM-Export ist ein D1-Batch mit konsistentem strukturiertem Snapshot. Format `cvk-campaign-backup`, Version 1. Legacy-JSON-Felder bleiben als Original-Strings erhalten, um verlustfreie Wiederherstellung zu ermöglichen. Dateimetadaten enthalten R2-Schlüssel, Dateiname, MIME-Typ, Größe, Besitzer und Sichtbarkeit.

R2-Binärdaten sind **nicht** im JSON-Export enthalten und müssen separat gesichert werden. Das JSON kennzeichnet dies. Ein fertiger Restore-Button, ein Restore-CLI und ein automatisiertes Vollbackup inklusive R2 existieren nicht. `settings` ist die ungenutzte globale Starter-Tabelle und nicht Teil des Kampagnenexports. Laufzeitkonfiguration, Auth-Secrets und externe Sites-Zugriffsrichtlinien sind ebenfalls kein Kampagneninhalt und werden nicht exportiert.

Ein Code-Rollback allein macht eine angewendete Datenmigration nicht rückgängig. Die neuen Tabellen/Spalten sind additiv; kein destruktives Down-Script wird mitgeliefert. Bei Datenwiederherstellung ist eine separate kontrollierte Prüfung und Sicherung nötig. Die D1-Tests prüfen Migration und Erhalt der Daten; ein produktiver Restore wurde nicht ausgeführt.

## Erhaltene Funktionen und Darstellung

Landing Page, Navigation, GM-Mitgliederverwaltung, Katalogimport, Charaktere, Notizen, Inventar, Galerie mit R2-Uploads, Chronik, generische Inhalte, Karte, Händler, Wirtschaft, Gefallen, Würfel und einfache gemeinsame Sitzung sind weiterhin vorhanden. Bestehende Farben, Typografie, Animationen, CSS und Breakpoints wurden nicht neu entworfen. Kein neues Lorematerial und keine neuen Bilder.

`app/spielbereich/modules/`: `shell`, `navigation`, `use-navigation`, `use-workspace-data`, `api-client`, `shared`, `record-editor`, `knowledge-grants`, `character`, `dashboard`, `session`, `world-map`, `economy`, `merchant`, `favors`, `cms`, `chronicle`, `dice`.

Technik bleibt React 19, TypeScript, Next/Vinext-Kompatibilität, Vite, Cloudflare Worker, D1/SQLite, R2, Drizzle-Schema/Migrationen, Tailwind und vorhandene shadcn/Base-UI-Primitiven. Abhängigkeiten wurden nicht ausgetauscht. Prettier wurde als temporäres Formatierungswerkzeug benutzt, nicht als Laufzeitabhängigkeit hinzugefügt.

## QA reproduzieren

Node >=22.13, `npm ci`, dann:

```text
npm run build
npm run lint
npm run typecheck
npm test
npm run test:integration
```

Der Integrationstest benötigt das fertige `dist`-Build. Er erstellt einen neuen lokalen Datenordner unter `work/tests/<UUID>`, wendet beide Migrationen lokal an, startet einen Worker auf Loopback-Port 8793 mit ausschließlich synthetischer GM-Adresse, führt HTTP-Tests aus und beendet ihn. Kein `--remote`, keine produktiven Datenänderungen. Port 8793 muss frei sein. Lokale Testordner werden zur Diagnose aufbewahrt und nicht exportiert. Unter Windows vor erneutem Build laufende Worker stoppen, da sie `dist` sperren können.

Foundation-Test: individuelle und Gruppenrechte, falsche Kampagne, blockierte Mitglieder, GM_SECRET auf Entität und verschachteltem Objekt, gesperrte Legacy-Orte, Migration aller 67 Katalogdatensätze mit unveränderter SHA-256-Prüfsumme, Erhalt des R2-Schlüssels, FK-Integrität, unveränderliche IDs, Audit-Trigger und Löschkaskaden.

HTTP-Test: anonyme/pending/blocked Requests, GM-Erkennung, Gruppen-/Einzelfreigabe und Rücknahme, Spieler darf keine Freigabe oder Kernentität erzeugen, keine GM-Daten in Spieler-/Legacy-Antworten, private Notizen, Versionskonflikt, CSRF-Origin-Prüfung, privater R2-Upload und Abruf, idempotenter 67er-Katalogimport, vollständiger GM-Export und geschützter persönlicher Export, bestehende API-Bereiche. Keine Produktionsmutation durch QA.

Kein vollständiger interaktiver Browser-E2E-Test und kein neuer Mobile-/Accessibility-Audit. Der Erhalt der UI basiert auf Extraktion bestehender Komponenten, erfolgreichem Build/Typecheck und Funktionsprüfung der APIs. Dies ersetzt die Abnahme durch den Hauptchat nicht.

Lint: 0 Errors, 0 Warnings. Zwei dateilokale, begründete Ausnahmen für native `<img>` bleiben: Originalbilder/geschützte R2-URLs werden direkt geladen, ohne öffentlichen Image-Optimizer-Cache. Die vorhandenen Ausnahmen für unverändert mitgelieferte UI-Primitiven bleiben bestehen. Laufzeit-/Build-/Arbeitsausgaben werden beim Lint nicht als Anwendungscode geprüft.

## TEILWEISE IMPLEMENTIERT

- Fachliche Modularisierung: die geforderten Module sind getrennt; Workspace bleibt Koordinator und enthält noch die kleine Galerie-/Verwaltungs-/Listenoberfläche.
- Entitätenmigration: alle Legacy-IDs und Kampagnenbezüge sind umgesetzt; Fachinhalte liegen noch im kompatiblen `records.body`. Noch keine vollständige Normalisierung aller NSC-, Orts- und Handout-Felder.
- Knowledge: echter Sicherheitskern und minimale GM-Bedienung, noch keine eigenständige Wissenschronik, keine Einzelabschnitt-Freigaben und keine redaktionelle Status-UI.
- Events/Relationships: echte persistente Tabellen und Constraints; Knowledge-Audit aktiv. Noch keine Beziehungen-UI oder umfassende Spielwelt-Ereignisverarbeitung.
- Backup: vollständiger strukturierter Kampagnenzustand; R2-Bytes/Restore/Automatisierung separat und offen.

## NICHT IMPLEMENTIERT — bewusst außerhalb dieses Auftrags

Vertical Slice Kaserne → Electric Taberna → Bahnhof, neue Lore/Kanonentscheidungen, VTT/2D/3D-Tisch, Voice, Webcam, KI/Interludes, Physik-Würfel, Mehrkampagnen-UI, Marktplatz, Redesign/AAA-Politur, neue Händler-/Wirtschaftssysteme, Live-Synchronisation und vollständiger Original-V20-Bogen.

## PROBLEM / RISIKO und offene Punkte für die Abnahme

1. Der flexible Legacy-JSON-Container kann semantische Geheimnisse enthalten, die nicht als GM-Feld/GM_SECRET markiert sind. Eine automatische Lore-Klassifikation findet nicht statt. GM muss den Lesetext vor Gruppenfreigabe prüfen. Die 67 importierten Einträge bleiben anfangs SL-sichtbar.
2. Bestehende Dateien unter `public/images` sind öffentlich. Entity-Knowledge ändert keine Datei-ACL; R2-Rechte bleiben separat. Ein bislang öffentlicher Asset-URL wird durch Verstecken einer Entität nicht privat.
3. Knowledge ist additiv. UNKNOWN ist kein individuelles „deny“ gegen eine Gruppenfreigabe; die UI beschreibt die Regel.
4. GM-Kern- und Kampagnenexport erlauben administrative Einsicht auch in private Besitzerinhalte. Eine feinere Rechte-/Datenschutzentscheidung bleibt der Abnahme vorbehalten.
5. Bestehender Händler nutzt fest codierte Angebote; Geldabbuchung und Inventarerstellung sind zwei Requests und nicht atomar. Wirtschaft/Gefallen sind einfache JSON-Ledger; keine regelverbindliche Buchhaltung. Diese Fachlogik wurde nicht ausgebaut.
6. Charakterbogen und V20-Regeldetails bleiben Prototypen; manche benutzerdefinierten Lesefelder sind optisch noch bedienbar, während der Server unzulässiges Speichern verhindert. Keine neue Regellogik.
7. Session/Dashboard wählen bisher den ersten passenden Datensatz; keine echte Live-Synchronisation, Polling oder ausgewählte Charakterbindung. Keine Migration auf neues Gameplay.
8. Keine durchgehende Audit-Erfassung aller Aktionen: Legacy-Trigger kennen noch nicht den editierenden Actor; Dateiänderungen haben kein World-Event.
9. Neue Datenmodelle sind vorbereitet, aber noch kein vollständiges Mehrkampagnen-Mitgliedschaftssystem. Globale `settings` bleiben ungenutzt.
10. Das Legacy-Verfahren verwendet JSON.parse-Fallback für ungültige JSON-Objekte; Rohdaten bleiben im Backup erhalten. Große Bestände werden aktuell ohne Pagination gelesen. Der aktuelle kleine Bestand ist getestet, Lasttests fehlen.
11. Auth-Header dürfen nur vom Sites-Dispatcher stammen. Lokale Test-/Entwicklungsworker dürfen nicht als ungeschützter öffentlicher Server ins Internet gestellt werden.
12. Ein kompletter Restore und eine manuelle UI-Abnahme sind offen. Automatisierte Tests belegen den geprüften lokalen Build, nicht jede denkbare Produktionskonfiguration.

Nach Source-Handover stoppen. Der nächste Sprint braucht die Abnahme im Hauptchat.
