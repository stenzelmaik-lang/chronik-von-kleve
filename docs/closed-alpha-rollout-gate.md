# Profil und geschlossene Pre-Alpha: Rollout gestoppt

Stand: 01.10.2026. **NICHT VERÖFFENTLICHT – SECURITY GATE NICHT BESTANDEN.**

Der Projektleiter hat den Rollout freigegeben und zugleich ausdrücklich verlangt,
bei einem sicherheitskritischen Problem vor der Veröffentlichung anzuhalten.
Diese Stopbedingung ist eingetreten. Die erfolgreich bestandenen Funktionstests
sind keine Freigabe zum Übergehen dieses Gates.

## Tatsächlich geprüfter Stand

- Lokale freigegebene Anwendung: `e8171ce0171383f7adcbfcea387c77724ea45261`,
  Branch `codex/closed-alpha-access-2026-10-01`.
- Basis und weiterhin veröffentlichter GitHub-main:
  `1ec090ef06810827ad166fa3916ed2db4683f702`.
- Aktive Produktionsversion: `1e365ea0-27e5-46de-a02f-c5e11ba11229`, 100 % Traffic.
- Aktives Deployment: `a62b87fd-8034-4930-a582-d4bd225c5dbb`.
- Worker `chronik-von-kleve`, Domain `chroniplay.cc`.
- D1 `chronik-von-kleve-db`, ID `a4bc79e6-3f33-4b03-b240-9c341bd1d4d7`.
- R2 `chronik-von-kleve-r2`; unverändert, keine Medienübernahme oder Änderung.
- Automatische GitHub-Builds bleiben pausiert: Include `*`, Exclude `*` im
  authentifizierten Cloudflare-Dashboard geprüft. Preview-URLs bleiben deaktiviert.
- Kein neuer kostenpflichtiger Dienst aktiviert. Bestehende Nutzung im Dashboard
  $0.00 im aktuellen Abrechnungszeitraum; das ist keine garantierte Ausgabensperre.

## Sicherheitsbefund und konkrete Relevanz

**BLOCKER: MapLibre GL JS 5.24.0, GHSA-jrc7-96c5-q579 / CVE-2026-85061.**
Der Hersteller stuft den Sanitizer-Bypass als kritisch ein. Betroffen sind
Attributionen aus fremden Kartenstilen. Unsere echte `WorldMapLibre` verwendet
`https://tiles.openfreemap.org/styles/dark` mit aktiviertem Attribution-Control.
Die installierte Bibliothek iteriert in `DOM.removeAttributes()` eine lebende
Attributliste und entfernt Einträge während derselben Iteration. Das
Attribution-Control schreibt das Resultat von `DOM.sanitize()` in `innerHTML`.
Damit ist der betroffene Datenpfad tatsächlich vorhanden. Keine Angriffspayload
wurde an die Produktionsseite oder den Kartenanbieter gesendet. Ein bereits
erfolgter Angriff ist damit ausdrücklich nicht behauptet.

Quelle: [Hersteller-Sicherheitshinweis](https://github.com/maplibre/maplibre-gl-js/security/advisories/GHSA-jrc7-96c5-q579).
Die Herstellerkorrektur ist 6.4.1; ein Major-Upgrade muss kompatibel geprüft
werden. Alternativ beschreibt der Hersteller eine Sanitierung vor Übergabe.
Es wurde keine ungeprüfte Reparatur oder Versionsänderung vorgenommen.

Weitere Auditbefunde, getrennt vom nachgewiesenen Maps-Blocker:

- `react-server-dom-webpack` 19.2.6: hoher DoS-Befund
  [GHSA-wx67-qw84-cm4g](https://github.com/react/react/security/advisories/GHSA-wx67-qw84-cm4g).
  Der verwendete vinext/RSC-Stack erfordert eine gesonderte Prüfung der tatsächlich
  erreichbaren Decoderpfade; nicht als erledigt oder als live ausgenutzt ausgeben.
- `next` 16.3.4: kritischer Auditbefund für Node-`next/og`-ImageResponse,
  [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j).
  In den Anwendungskomponenten und APIs wurden keine `next/og`- oder
  `ImageResponse`-Verwendungen gefunden. Das ist nicht derselbe bestätigte
  Produktionspfad wie beim Maps-Befund.
- Der gesamte pnpm-Audit meldet 40 Befunde: 2 kritisch, 21 hoch, 13 mittel,
  4 niedrig. Darunter befinden sich viele Entwicklungswerkzeuge. Diese Zahlen
  bezeichnen keine 40 nachgewiesenen live ausnutzbaren Anwendungslücken.
- Die vorhandene npm-Lockdatei fehlt der schon im pnpm-Lock vorhandene
  `@noble/hashes`-Eintrag. Keine Bibliotheksversion wurde geändert. Der Lockabgleich
  ist noch offen und vor einem frischen npm-CI-Build zu korrigieren.

## Backup und Migrationsprüfung

Produktive SQL-Sicherung vom 01.10.2026:
177355 Bytes, SHA-256
`e5a6ee8ef3f44b6e60541024fa56cd48b1e56259e492bb0449e0f43a8704a98e`.
Time-Travel-Bookmark:
`00000061-00000642-000050f7-ad787f2f88c75c93db16e2b5d86726e5`.
Vorheriger Worker als Multipart gesichert, 8814093 Bytes, SHA-256
`563b66d517feb399d1af0961c8b4752fdf869f1c287aeacd409dcee82d9dd981`.

Die vollständige SQL-Sicherung wurde nur in einer isolierten SQLite-Kopie
wiederhergestellt. D1 exportiert referenzierte Unique-Indizes nach den Daten;
deshalb wurde nur während dieser nativen Wiederherstellung die FK-Erzwingung
ausgeschaltet, anschließend wieder eingeschaltet und vollständig geprüft.
Migration 0007 wurde auf dieser Kopie erfolgreich angewendet. Sämtliche
ursprünglichen Spalten und Zeilen aller bisherigen Tabellen blieben unverändert.
Integritätsprüfung und Foreign-Key-Prüfung bestanden. Die Session-Inserts des
alten Workers funktionieren auch mit dem additiven neuen Schema.

Produktiver Bestand der Sicherung: 1 Auth-Konto, 1 Kampagnenmitgliedschaft,
0 globale Administratorrollen, 21 Entities/Ortsknoten, 34 Revisionen,
32 Freigaben, 4 Dateien, 0 Records/Charakterdatensätze und 0 Recovery-Quellen/-Records.
Diese Cloudflare-Datenbank ist nicht die historische Sites-Datenbank. Deren
alte Recovery-Zähler dürfen nicht als hier vorhandene Datensätze ausgegeben werden.
Keine Demo-Konten im Produktionsbestand.

Die Sicherungen enthalten private Daten und verbleiben ausschließlich im
ignorierten lokalen Verzeichnis `.wrangler/release-evidence/closed-alpha-rollout-20261001`.
Sie gehören weder in Git, einen Source-ZIP noch in einen öffentlichen Handover.

**PROD MIGRATION 0007: NICHT AUSGEFÜHRT.** Rollback war nicht erforderlich.
Nach einer späteren sicheren Veröffentlichung bevorzugt nur den Worker auf die
obige Version zurückrollen und das additive Schema samt neuen Nutzerdaten erhalten.
Eine vollständige Datenwiederherstellung braucht ein ausdrücklich geprüftes
Wiederherstellungsfenster; Worker-Rollback stellt keine D1/R2-Daten wieder her.

## Wiederholte Tests

| Prüfung | Tatsächliches Ergebnis |
| --- | --- |
| Typecheck | Bestanden |
| Vollständiges Lint | Bestanden, keine Fehler/Warnungen |
| Lokaler Build | Bestanden |
| Produktionsbuild | Bestanden |
| Wrangler Deployment Dry Run | Bestanden; kein Upload/Deployment |
| Fach- und Regressionstests | 94 bestanden, alle 16 `*.test.mjs` einbezogen |
| Isolierte Integrationsprüfungen | 702 bestanden |
| Rollen-/Backfill-/Rollbackprüfungen | 46 bestanden |
| Atomarer D1-Batch-Rollback | Bestanden |
| Wiederherstellung und 0007-Erhaltung auf Kopie | Bestanden |
| Produktions-Sicherheitsgate | NICHT BESTANDEN: Maps-Blocker |

Die npm-Testliste enthält derzeit nur 72 der Fachtests; für diese Freigabeprüfung
wurden zusätzlich die bestehenden Character-Live-/Weekend-Tests einbezogen.
Bekannte Build-Warnungen: Client-Chunks über 500 kB und vinext-Routenklassifikation.
Keine produktiven synthetischen Accounts, Bilder, Charaktere oder Orte angelegt.

## Veröffentlichung und Einladungen

- Push: nicht durchgeführt.
- Merge: nicht durchgeführt.
- Neues Deployment: nicht durchgeführt.
- Produktive Profil-/Passwort-/Einladungstests: nicht durchgeführt, Erweiterung nicht live.
- Tatsächliche Einladungen: keine erzeugt oder versendet; Teilnehmer noch nicht ausgewählt.
- Öffentliche Registrierung bleibt geschlossen.
- Keine reale globale Administratorrolle vergeben; GM ist kein Plattformadmin.

Einzige vorbereitende Source-Anpassung seit dem abgenommenen lokalen Stand:
`vite.config.ts` setzt bei einem expliziten Produktionsbuild auf `main`
`AUTH_ACCESS_ENVIRONMENT=closed-alpha-production`. Lokale und Preview-Builds
erhalten diese Freigabe nicht automatisch. Bindings, CPU-Limit und
Kompatibilitätsdatum bleiben unverändert. Diese Anpassung ist nur lokal gesichert.

Nach Behebung und Nachprüfung der Sicherheitsbefunde: erneut Abhängigkeiten und
Locks prüfen, Build/Regression ausführen, frisches Backup erstellen, nur 0007
produktiv migrieren und dann das passende Produktionspaket veröffentlichen.
Die bisherigen Rolloutfreigaben sind kein Auftrag, ein nicht bestandenes
Sicherheitsgate zu übergehen.

## Anleitung für die ersten drei Mitglieder – erst nach sicherem Rollout

1. Projektleiter wählt die drei Personen und ihre individuellen E-Mail-Adressen.
2. Auf `chroniplay.cc` anmelden: Mein Profil → Spielgruppe & Einladungen.
3. Je Person die aktive Kampagne und ausschließlich Spielerrechte verwenden,
   eine Laufzeit von 1, 3 oder 7 Tagen wählen. Vorhandene unverbundene Mitglieder
   gegebenenfalls ausdrücklich auswählen, niemals allein per E-Mail automatisch mappen.
4. Den einmal angezeigten Link persönlich über einen bereits bekannten Kontaktweg
   übergeben. Kein automatischer E-Mail-Dienst. Links nicht in öffentliche Chats posten.
5. Teilnehmer öffnet den Link, setzt selbst sein Passwort und meldet sich danach
   normal an. Der Link ist E-Mail-gebunden, zeitlich begrenzt und einmalig verwendbar.
6. Nicht mehr benötigte Einladungen sofort in derselben Verwaltung widerrufen.

Fehlerrückmeldung ohne zusätzliches Modul: direkt an den Projektleiter mit Seite,
Schritten, Erwartung, tatsächlichem Ergebnis und optionalem Screenshot.
Keine Passwörter, privaten Briefe oder Einladungslinks an Fehlerberichte anhängen.
Eine Live-Einlösung wird erst mit der ersten tatsächlich ausgewählten Person geprüft.

**STOPP. Keine weitere Entwicklungsphase begonnen.**
