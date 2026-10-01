# Profil & geschlossene Alpha – persönliche lokale Abnahme

Stand: 01.10.2026. Phase 2 und Phase 3 sind ausschließlich lokal implementiert. Basis ist der veröffentlichte GitHub-main-Commit `1ec090ef06810827ad166fa3916ed2db4683f702`. Kein Push, Merge oder Deployment dieser Erweiterungen.

## Selbst ausprobieren

1. In dieser Arbeitskopie `Start-Closed-Alpha.cmd` doppelt anklicken. Kein Ändern der Windows-Skriptausführungsrichtlinie nötig. Die vorhandene Codex-Node-Laufzeit wird erkannt.
2. Nach „Isolated application ready“ im Browser **http://127.0.0.1:8795/anmelden** öffnen. Das Startfenster geöffnet lassen.
3. Mit einem der folgenden **ausschließlich lokalen synthetischen** Konten anmelden. Gemeinsames Demopasswort: `ChroniPlay-Demo-2036!`.

| Konto | E-Mail | Rechte |
| --- | --- | --- |
| Spielleitung | command-gm@example.invalid | Nur Leitung der Testkampagne |
| Spieler A | command-a@example.invalid | Eigene Charaktere und eigenes Profil |
| Spieler B | command-b@example.invalid | Eigene Spieleransicht |
| Plattformadmin | command-admin@example.invalid | Globale Verwaltung ausschließlich im lokalen Testbestand |

Der Start prüft Port 8795 und beendet keine fremden Prozesse. Build und Migrationen laufen nur lokal; D1/R2 liegen unter `.local-test/closed-alpha-access`. Vollständige Neustarts erhalten Teständerungen. Alte Testbestände werden weder überschrieben noch ungeprüft migriert. Mit Strg+C im Startfenster beenden. Fehlende Abhängigkeiten oder unerwartete Bindings führen zum Abbruch, nicht zu einem Remote-Ausweichbetrieb.

## Phase 2 – umgesetzt und lokal geprüft

- Über den Namen oben am Spieltisch **Mein Profil** öffnen.
- Anzeigename, private JPG/PNG/WebP-Profilbilder bis 2 MB und Darstellungsoptionen ändern, speichern und vollständig neu laden.
- Eigene Kampagnenrollen und explizite Plattformrechte getrennt anzeigen.
- Nur eigene Sitzungen anzeigen und beenden. Öffentlich sichtbare Sitzungs-IDs sind keine Anmeldungsschlüssel.
- Passwort nach Bestätigung des bisherigen Passworts ändern; alle bisherigen Sitzungen werden beendet. Anschließend normal neu anmelden.
- Bestehende Auth-2.0-Konten und Zuordnungen weiterverwenden. Keine zweite Benutzerverwaltung; Charaktere und Profile bleiben unterschiedliche Objekte.

## Phase 3 – umgesetzt und lokal geprüft

- SL: **Mein Profil → Spielgruppe & Einladungen**. Eine persönliche, E-Mail-gebundene Einladung für 1, 3 oder 7 Tage erzeugen oder widerrufen.
- Einladung kann ein neues Spielmitglied erzeugen oder gezielt ein vorhandenes, noch nicht verbundenes Spielmitglied übernehmen. Vorhandene Charakter-Eigentümer-IDs bleiben erhalten. Keine automatische Verknüpfung nur anhand einer passenden E-Mail.
- Einladungen vergeben ausschließlich Spielerrechte. Gesperrte oder unberechtigte Einladende, fremde Kampagnen, abgelaufene/widerrufene/verwendete Links und doppelte parallele Einlösungen werden serverseitig abgewiesen.
- Plattformadmin: separate globale Kontosperren sowie Wiederherstellungslinks nach erneuter Passwortprüfung. Wiederherstellung gilt 30 Minuten, nur einmal, beendet alte Sitzungen und meldet nicht automatisch an.
- Öffentliche Registrierung bleibt geschlossen. Links erscheinen ausschließlich einmal zur persönlichen Übergabe; Datenbank speichert nur ihren Hash. Kein automatischer E-Mail-Versand und kein neuer kostenpflichtiger Dienst.

Einladungs- und Wiederherstellungslinks tragen ihren Schlüssel im URL-Fragment. Nach Öffnen wird dieses entfernt. Wer vor Abschluss neu lädt, öffnet den ursprünglichen persönlichen Link erneut. Die eingegebene Dokumentation einer Identitätsprüfung ist nur ein Auditbeleg: Ein Administrator muss die Person über einen unabhängig bekannten Kontaktweg tatsächlich prüfen, bevor er den Link übergibt. Gleiche Identitätsstrings sind kein Nachweis.

## Testergebnisse

Typecheck, vollständiges Lint, Build und `drizzle-kit check`: bestanden. **94 Fachtests, 702 isolierte Integrationsprüfungen und 46 Rollen-/Backfill-/Rollbackprüfungen** bestanden. Zusätzlich atomarer D1-Batch-Rollback geprüft. Die 70 neuen Integrationschecks umfassen Profil-/Avatar-Datenschutz, Concurrency, Sitzungssperren, Einladungen, ursprüngliche Charakterzuordnungen, Passwortwechsel, Wiederherstellung und globale Sperren. Bestehende Charakter-, Nachrichten-, Orts- und Recovery-Regression bleibt erhalten.

Echter Browser: Profilname und privates Testbild gespeichert und nach Neuladen erhalten; Einladung erstellt und widerrufen, beide Zustände nach Neuladen geprüft; getrennte SL-, Spieler- und Plattformansichten; normale Anmeldung/Abmeldung; Desktop und Mobilansicht 390×844 ohne seitlichen Überlauf. Passwortwechsel und Einlösung inklusive Wiederherstellung automatisiert über die wirklichen APIs mit synthetischen Passwörtern geprüft; kein persönliches Passwort im Browser durch den Agenten gesetzt.

Bekannte Build-Warnungen: Client-Chunks über 500 kB und bestehende vinext-Routenklassifikation. Kein Buildfehler.

## Vor einer späteren Veröffentlichung

**Migration 0007 ist nur auf isolierten lokalen Testdatenbanken angewendet.** Sie ergänzt Profile, einmalige Zugangsfreigaben, Sicherheitsereignisse, eine Account-Version und öffentliche Sitzungs-IDs. Keine Tabellen werden ersetzt oder gelöscht; bestehende Passworthashes, Identitätslinks, Sitzungen und Charakter-Eigentümer werden in der Erhaltungsprobe unverändert geprüft.

Der neue Anwendungscode setzt 0007 voraus. Deshalb kein Deployment dieses Branches vor gesonderter Migrationsfreigabe, frischem Backup und erneuter Produktionsprüfung. Rückfall vor erstmaliger Freigabe: bisherigen Worker unverändert betreiben. Nach einer genehmigten späteren Migration bevorzugt nur Anwendung zurückrollen und additive Tabellen erhalten. Nach realen Konto-/Profiländerungen niemals die neuen Tabellen oder Konten blind löschen; ein Datenrestore erfordert vorher geprüfte Sicherung und ausdrücklich akzeptiertes Wiederherstellungsfenster.

Produktive Einladungen benötigen später ausdrücklich `AUTH_ACCESS_ENVIRONMENT=closed-alpha-production`; ohne diese Einstellung verweigert der Dienst die Freigabe. Kein tatsächlicher Plattformadministrator wurde eingerichtet. Ein späterer produktiver Administrator beziehungsweise ein sicherer administrativer Wiederherstellungsweg benötigt eine separate Freigabe.

Vorhandene Konten werden nicht als neue Konten ein zweites Mal eingeladen. Eine zusätzliche Kampagnenzuordnung für ein bereits verbundenes Konto ist hier keine neue allgemeine Verwaltungsfunktion. Öffentlich sichtbare Community-Avatare, automatische E-Mails und offene Selbstregistrierung gehören ebenfalls nicht zu diesem Stand.

Nach persönlicher Abnahme stoppen und die Produktionsfreigabe gesondert prüfen.
