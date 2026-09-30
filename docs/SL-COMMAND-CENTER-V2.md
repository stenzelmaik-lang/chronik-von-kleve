# SL Command Center 2.0 — lokale Abnahme

## Start

In PowerShell:

```powershell
Set-Location 'C:\Users\Stenz\Documents\Codex\cvk-phase-c-remote-test\.review-work\live-release-git'
node scripts/run-framework.mjs build
node scripts/test-local.mjs --command-center
```

Adresse: http://127.0.0.1:8794/anmelden

Diese Startvariante erstellt bei jedem Start eine **frische lokale Testumgebung**. Änderungen bleiben bei Neuladen der Seite erhalten, werden beim nächsten Serverstart jedoch nicht übernommen. Keine vorhandene lokale oder produktive Datenbank wird benutzt. Strg+C stoppt den Server. Vor erneutem Build den eigenen Testserver stoppen, da Windows Builddateien während der Ausführung sperren kann.

Synthetische Konten, ausschließlich für diese isolierte Testumgebung:

- SL: `command-gm@example.invalid`
- Spieler A: `command-a@example.invalid`
- Spieler B: `command-b@example.invalid`
- Gemeinsames öffentliches **Demo-Passwort**: `ChroniPlay-Demo-2036!`

Das sind keine produktiven Zugangsdaten. Normale Anmeldung und vorhandene Auth-2.0-/Kampagnenrollen werden benutzt, keine Demoheader oder automatische Browser-Authentifizierung. Der Server bindet ausschließlich Loopback. Die elektrische Taberna wird aus dem bestehenden akzeptierten Referenzfixture übernommen; Sitzungs- und Handout-Testtexte sind klar synthetisch.

## Implementiert

- Regulärer Einstieg Spielbereich → Sitzung; aktive campaign_gm/campaign_owner erhalten die Regie, normale Spieler die bestehende Sitzung plus ihre freigegebenen Handouts.
- Modulare Werkzeuge, maximal zwei gleichzeitig; Schließen blendet Werkzeuge aus und erhält deren Eingaben.
- Wiederverwendung von SessionPanel, WorldExperience und DicePanel. Keine zweite Charakter-, Orts- oder Würfelengine.
- Vorhandene Sitzungen auswählen, Szene bearbeiten/veröffentlichen, Initiative und vorhandenes Log.
- Private Notizen im bestehenden gm_body der ausgewählten Sitzung mit vorhandener Versionsprüfung.
- Aktive Mitglieder und vorhandene Charakterzuordnungen über kampagnengebundene Datenquelle; Einstieg in die vorhandene Charakterverwaltung.
- Echte HANDOUT-Entitäten über bestehende Knowledge-API gezielt freigeben und widerrufen. Spieleransicht lädt ausschließlich die bestehende sichere Entity-Projektion. Keine Orts-CLUE-Datensätze in dieser Freigabeoberfläche.
- Gruppen-Sitzungsvorschau serverseitig projiziert. Die SL-Werkzeuge bleiben beim Umschalten gemountet; es werden keine GM-Texte in die Vorschauantwort übertragen.
- Spieler-Handouts aktualisieren bei Fensterfokus und alle zehn Sekunden während sichtbarer Sitzung. Nach Widerruf kann bereits Gelesenes nicht aus dem Gedächtnis entfernt werden; erneuter Serverabruf wird gesperrt.
- Lokaler Testserver liefert Build-JavaScript korrekt aus. Loginformular verwendet auch ohne funktionierendes JavaScript POST, damit Eingaben nicht als URL-Abfrage gesendet werden. Auth-Regeln unverändert.

## Teilweise / nicht verbunden

- Handout-Grants gelten **kampagnenweit**, nicht sitzungsgebunden. Keine behauptete Sitzungsisolation für Grants. Andere persönliche oder Gruppenfreigaben können weiterhin Zugriff gewähren. Bei dauerhaft sichtbaren Legacy-Inhalten wird kein scheinwirksamer Widerruf angeboten.
- Medien/Dokument-Handouts verwenden weiterhin ihren bisherigen Datei-/CMS-Bereich; im neuen Werkzeug sind zunächst Text-Handouts verbunden. Keine neue Medienfreigabe oder ungeschützte URL.
- Charaktere: direkter lesender Kontext mit vorhandener sicherer Detail-Projektion (Attribute, Disziplinen, Blut, Willenskraft und Menschlichkeit), Aktualisierung und Verwaltungseinstieg. Private fremde Charaktere werden bereits aus der Zuordnungsantwort ausgeschlossen. Keine eigenständige Schreib-/Porträtverwaltung innerhalb der Regie. Anwesenheit/Verbindungsstatus nicht verfügbar.
- Ortsdossier integriert, aber keine neue Zuordnung eines Ortes zu einer Szene oder zweite Ortsverwaltung eingeführt.
- Verlauf zeigt das vorhandene Sitzungslog; kein neues vollständiges Regie-Audit oder Sitzungsarchiv.
- Kein Voice/Video, Push, Phaser-Ausbau, XP-Verwaltung oder neue Regellogik.
- Bekannte lokale Grenze: bestehender Abmeldelink `/signout-with-chatgpt` wird vom direkten lokalen Worker nicht aufgelöst (404). Kontowechsel bei der QA erfolgt durch erneute reguläre Anmeldung. Dieses Problem wurde nicht als funktionierend gemeldet und nicht durch einen Auth-Bypass umgangen.

## Prüfungen

- Typecheck, vollständiger Lint und Build bestanden. Bekannt: Client-Chunk >500 kB; vinext kann einige dynamische Routen statisch nicht klassifizieren.
- 69 Fach-/Regressionstests, 536 Integrationstests, 46 Rollen-/Backfill-/Rollbackprüfungen und atomarer D1-Batch-Rollback bestanden auf ausschließlich isolierten lokalen Ressourcen.
- Neue Negativtests: anonyme Benutzer, Spieler, Editor, gesperrte/pending SL, Plattformrolle ohne Kampagnenrolle, fremde Kampagne; geheimnisfreie Gruppen-Sitzungsvorschau; Handout A/B, vertraulicher Text und serverseitiger Widerruf.
- Browser: normale SL-Anmeldung → Sitzung; modulare Bedienung; private Notiz speichern → vollständiger Reload → erneut vorhanden; Szene veröffentlichen; serverseitige Gruppenvorschau. Echte normale Browseranmeldungen mit zwei synthetischen Spielern: persönliches Handout für A sichtbar, für B verborgen; nach Widerruf auch für A verborgen. Keine SL-Regie oder privaten Notizen in beiden Spieleransichten.

## Dateiumfang

Neue Dateien: domain/command-center.ts, app/api/command-center/route.ts, app/spielbereich/modules/command-center.tsx, command-center.module.css, tests/command-center.test.mjs und dieser Bericht.

Geändert: app/spielbereich/workspace.tsx, app/anmelden/auth-form.tsx (POST-Fallback), package.json (Testaufnahme), scripts/test-local.mjs (isolierte interaktive Abnahme/Assetauslieferung), tests/integration.mjs.

Der bislang uncommittete Prototyp unter prototypes/command-center wird mitgesichert. state.local.json bleibt ignoriert. Keine Änderung an Character Engine, produktiven Bindings, Migrationen oder Produktionsdaten. Kein Push, Merge oder Deployment.

Branch: codex/sl-command-center-v2. Der lokale Commit steht im Abschlussbericht.

## Erweiterung: Charakterkontext

Browserprüfung: Demo Spieler A auswählen → vorhandener synthetischer Charakter aus regulärer API sichtbar; B auswählen → leerer Kontext, kein zuvor ausgewählter Charakter. Eine ungespeicherte Szeneneingabe blieb beim Wechsel erhalten. Werte aktualisieren verwendet ausschließlich /api/character-detail. Keine neue Engine und keine Character-Schreiboperation. Neue Negativtests prüfen private fremde Charaktermetadaten und die bestehende HTTP-404-Sperre. Tests erneut: 69 Fachtests, 536 Integrationstests, 46 Rollenprüfungen; Typecheck, vollständiger Lint und Build bestanden. Bekannte Buildwarnungen unverändert.

Zusätzliche geänderte Dateien: command-character.tsx, command-center.tsx, app/api/command-center/route.ts, scripts/test-local.mjs (synthetischer Charakter über regulären Owner-Login), tests/integration.mjs, dieser Bericht und Browsernachweis docs/qa/command-character-context.jpg.