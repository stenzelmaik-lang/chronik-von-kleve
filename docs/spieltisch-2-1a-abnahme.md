# Spieltisch 2.1a – Alpha-Release und UX-Abnahme

Stand: 28.10.2026. Entwicklung auf `codex/spieltisch-2-1a`, Basis `70a0368f33a5230147692ad1cb66c9faf4a0912b`. Nach ausdrücklicher Alpha-Freigabe über PR #27 integriert und veröffentlicht. Die folgenden lokalen Prüfungen und ihre Grenzen bleiben getrennt vom Live-Nachweis; Details stehen im Releaseabschnitt am Ende. Der vorherige Prototyp-Spielstand bleibt unverändert.

## Bedienung und bestehende Bausteine

Teilnehmer oben auswählen → kompakte Profil-/Bogen-/Inventar-/Nachrichtensymbole horizontal in der Bildschirmmitte. Auch der große Schuber öffnet mittig über der unveränderten Bühne. Erneutes Symbol, Aufwärtspfeil oder Escape schließt ihn. Zwischen Menüs wechselt nur die persönliche Ansicht. Tastaturfokus kehrt zum Auslöser zurück; die interne Bogen-Navigation unterstützt Pfeiltasten, Pos1 und Ende. Bestehende reduzierte Bewegung aus dem Kontoprofil wird in den Bühnen-Portalbereich übernommen.

Wiederverwendet werden:

- Authentifizierung, aktive Kampagnen-/Sitzungsrechte und bestehende Live-Raum-Verbindungen.
- `characterDetailProjection`, `RatingGroup`, `CharacterListReadout`, vorhandene V20-Gruppen und `RichTextView`. Der eingebettete Bogen besitzt keine Schreibaktion.
- `InventoryPanel`, sein Daten-Cache, Inventaroperationen und vorhandene Item-Dialoge. Ein optionaler Portal-Kontext hält diese Dialoge innerhalb der Bühnenebene. Außerhalb dieser Einbettung bleibt ihr Verhalten erhalten.
- `MessageCenter` und `/api/messages`, einschließlich Archiv, Lesebestätigung, Sendungs-Idempotenz und Empfängerprüfung. Die Projektleitung hat in diesem Auftrag ausdrücklich das private Senden durch aktive Spieler genehmigt. Empfänger und Absender lesen ihre eigene Korrespondenz; SL ist kein zusätzlicher Leser fremder Unterhaltungen.
- Vorhandene Kontoavatare und geschützter Medienspeicher; kein neuer Uploadweg.

## Daten- und Rechteverhalten

Die obere Leiste enthält ausschließlich Identität, Avatarreferenz und tatsächliche Präsenz. Keine vollständigen Charakterbögen oder Inventare werden dafür übertragen. Menüinhalte laden erst beim Öffnen.

Anwesenheit nutzt vorhandene `room.peers`: Heartbeat alle acht Sekunden, bestehender Ablauf nach 30 Sekunden, mehrere Tabs je Mitglied. AFK ist eine ausdrücklich eigene, sitzungsbezogene Wahl und gilt für die Verbindungen dieser Person. Ein geschlossener Tab setzt andere Tabs nicht offline. Rot ist ausschließlich fehlende gültige Verbindung, kein auswählbarer Status. Verspätete Befehle eines vorherigen Spielabend-Laufs werden abgewiesen. Die bestehende Grenze von acht gleichzeitigen Raumverbindungen bleibt erhalten.

Neue Adapterroute `/api/live-participants` prüft bei jedem Abruf aktive Spielabend-/Teilnehmerrechte und Charakterzuordnung. Spielerprofil (Kontoname und Kontoavatar), öffentliche Figur und geschützter vollständiger Bogen sind getrennte Antworten. E-Mails, Kontosicherheit und Profileinstellungen anderer Teilnehmer werden nicht ausgeliefert. Ein Kontoavatar wird nur im autorisierten Spielrundenkontext ausgeliefert; seine private Originaldatei erhält dadurch keine allgemeine Freigabe.

Fremde Spieler sehen nur ausdrücklich gruppenfreigegebene Figuren ohne Geheim-/Sperrkennzeichen. Die öffentliche Karte enthält Name, ein bereits zugängliches Portrait und vorhandene `player_visible`-Beschreibungsblöcke. Die private Charakterbiografie wird nicht automatisch veröffentlicht. Fehlende Freigaben erscheinen als verständlicher Leerzustand. Auch bei der SL wird eine private Figur im Register „Öffentliche Figur“ nicht als veröffentlicht dargestellt.

Eigenes und berechtigtes SL-Inventar verwenden die bisherigen Grenzen. Insbesondere bleiben private Spieler-Gegenstände weiterhin auch gegenüber SL geschützt, soweit die bestehende Inventarlogik dies vorgibt. Fremde Spieler erhalten ausschließlich aktive Gruppen-Gegenstände und keinerlei Schreibaktionen. Direkte Bogen-, Inventar-, Avatar- oder Nachrichtenaufrufe können diese Rechte nicht umgehen.

Keine zusätzliche Datenbank, Tabelle, Migration oder große Abhängigkeit. AFK ergänzt ausschließlich den vorhandenen geschützten Live-Raum-JSON-Stand. Keine Änderung an produktiven D1-/R2-Beständen.

## Prüfungen

| Prüfung | Nachweis |
|---|---|
| Unit-/Regressionstests einschließlich W10/Prototyp | 326 bestanden |
| Vollständige HTTP-Integration | 1.615 bestanden; `participants-integration-final.log`, einschließlich Negativtest für private Figuren im öffentlichen SL-Register |
| Rollen-/Rückrollprüfungen | 46 bestanden; ausschließlich lokale Test-D1 |
| Typecheck, gezieltes ESLint und Produktionsbuild | bestanden; private Protokolle `participants-typecheck.log`, `participants-final-lint.log`, `participants-build.log` |
| SL, Besitzer A, fremder Spieler B | unabhängige reguläre Testidentitäten; keine simulierten Rollenheader |
| Direkte Rechteprüfungen | fremder Vollbogen abgewiesen; private/sl-Inventargegenstände nicht in B-Antwort; private Original-Avatar-Datei weiterhin gesperrt; fremde Privatgespräche auch für SL und Kampagnenexport gesperrt |
| Inventar im Browser | bestehender Item-Dialog über dem Schuber geöffnet, neuer synthetischer Gegenstand gespeichert, normale Inventaransicht wieder sichtbar |
| Nachrichten im Browser | A wählt B, Empfänger vorgewählt, privat gesendet; B meldet sich unabhängig an und liest die Nachricht im eigenen Posteingang |
| Anwesenheit im Browser | grün bei Verbindung, AFK synchron bei SL, eigene Rückkehr, zwei A-Tabs, erster Abgang bleibt grün, letzter Abgang wird rot; API-Tests zusätzlich Timeout und Reconnect |
| Bühne / Schuber | gleiche Bühnengeometrie und Objektpositionen vor/nach Öffnen; weder Seitenwechsel noch globale Pause |
| Desktop | 1920×1080: 740 px Schuber; 1440×900: 600 px; 1366×768: 620 px; jeweils exakt mittig, interne Scrollfläche, kein horizontaler Überlauf |
| Weniger verfügbarer Platz | zusätzlich 1536×864 geprüft; das ist eine Layoutprobe, kein behaupteter nativer 125-%-Browserzoom |
| Reduzierte Bewegung | bestehende Kontooption im Browser gespeichert, Portal erbt sie; gemessene Animation und Transition jeweils `1e-06s` |
| W10 bei geöffnetem Menü | gemeinsamer Wurf schließt das persönliche Menü; SL und Spieler identisch: ID `14bffe06-81ac-4b76-a073-be77cbd4ff82`, Endwerte `10,9,1,1,8,1,3,6,6,1`, beide `settled` |
| Bestehende Funktionen | vollständiger Regressionstest einschließlich Bühne, NPCs, Dokumenten, Notizen, Whiteboard und W10 |

Lokale Antwortzeitmessung (Median aus drei warmen Abrufen, kein Produktionsbenchmark): öffentliches Profil 13,9 ms / 532 Bytes; eigener Bogen 14,8 ms / 1.779 Bytes; freigegebenes Inventar 14,2 ms / 1.248 Bytes. Initiale Leiste und Präsenz erhalten keine vollständigen Bögen. Der Schuber verwendet den vorhandenen Live-Snapshot und benötigt keine zusätzliche Polling-Verbindung; ausschließlich der notwendige Heartbeat ergänzt die bestehende Raumverbindung.

Die lokalen Prüffiguren, Inventargegenstände, Nachrichten und Konten sind synthetisch. Die Projektleitung hat zusätzlich ausdrücklich nur Name und vorhandene Bogenwerte von „Noir Kim Aiko“ zur privaten Sichtprüfung auf `127.0.0.1:8820` genehmigt. Nur dieser begrenzte Ausschnitt wurde in eine lokale Referenzfigur übernommen; keine Biografie, SL-Texte, Beziehungen oder Kontodaten. Das Original blieb unverändert. Der zuvor abgelehnte umfassendere Übernahmeversuch wurde nicht ausgeführt.

## Browser und Nachweise

- SL: <http://127.0.0.1:8820/spielbereich?bereich=sitzung>
- Getrennte Spieleransicht: <http://localhost:8820/spielbereich?bereich=sitzung>
- Private Screenshots/Messdaten: `.local-work/spieltisch-2/evidence/2-1a/`.
- Öffnen: Teilnehmer auswählen und eines der vier Symbole verwenden; für den eigenen Anwesenheitsstatus zusätzlich Tasse/Sessel.

## Grenzen und Abnahmestatus

Der native 125-%-Browserzoom wurde nicht verifiziert: Der Browser-Shortcut hatte in der verfügbaren Steuerung keine Wirkung. Die effektiv kleinere Fläche wurde separat geprüft, ersetzt diesen Nachweis aber nicht. Bei der persönlichen UX-Abnahme 125 % noch einmal im normalen Browser einstellen.

Eigene Kontoeinstellungen verbleiben in der vorhandenen Profilverwaltung. Es wurde keine zweite Profilverwaltung oder allgemeine Spieler-Biografie-Freigabe erfunden. Nicht ausdrücklich veröffentlichte alte Charaktertexte bleiben geschützt.

## Tatsächlich geänderte Bereiche

- Neue Teilnehmeradapter: `domain/live-participants.ts`, `server/live-participants.ts`, `app/api/live-participants/route.ts`.
- Menü und Lesedarstellung: `app/spielbereich/modules/spieltisch/participants.tsx`, `participants.module.css`, `participant-content.tsx`, `character-readonly.tsx`, `use-presence.ts`; Einbindung in bestehende `stage.tsx` und `types.ts`.
- Bestehender Live-Raum und Teilnehmerprojektion: `server/live-game.ts`, `server/live-stage.ts`, `app/api/live-table/route.ts`.
- Optional eingebettetes Inventar: `app/spielbereich/modules/inventory.tsx`, `inventory/use-inventory.ts`, `inventory/inventory.module.css`; Dialog-Portalziel in `components/ui/dialog.tsx`.
- Bestehende Nachrichten: `app/api/messages/route.ts`, `app/spielbereich/modules/message-center.tsx`, `message-center.module.css`; Absender-Projektion in `server/entities.ts`.
- Tests: `tests/live-participants.test.mjs`, `live-participants-integration.mjs`, `character-access.test.mjs`, `weekend-integration.mjs`, `integration.mjs`.
- Diese Abnahmedokumentation. Keine Änderungen an Drizzle, Lockfiles, Original-Prototyp oder anderen Fachbereichen. Private Testkopien und Screenshots bleiben aus Git ausgeschlossen.

**Die zunächst rein lokale Etappe ist abgeschlossen. Die anschließend erteilte Alpha-Freigabe und der tatsächliche Live-Stand sind unten dokumentiert. Persönliche UX-Abnahme der Alpha bleibt offen.**

## Alpha-Freigabe und feste Menümittellinie

Die Projektleitung hat am 28.10.2026 die Veröffentlichung auf der bestehenden Alpha-Hauptseite und iterative kleine Layoutkorrekturen ausdrücklich freigegeben. Der vorherige lokale STOPP ist für diesen Auftrag aufgehoben. Funktionsleiste und Schuber sind jetzt beide fest zur horizontalen Viewport-Mitte ausgerichtet. Der Teilnehmerwechsel verändert ihre Position nicht. Zugriffsschutz und bestehende Menüfunktionen bleiben unverändert. Produktive Datenrisiken, unklare Rechte oder erforderliche Migrationen bleiben Stoppgründe.

Versions-Vorschauadressen werden im Produktions-Build ausdrücklich deaktiviert, um die bestehende Cloudflare-Einstellung beim Deployment zu erhalten. Keine Schemaänderung.

## Tatsächliche Veröffentlichung am 28.10.2026

- Live: <https://chroniplay.cc/spielbereich?bereich=sitzung>.
- PR: <https://github.com/stenzelmaik-lang/chronik-von-kleve/pull/27>.
- Veröffentlichter Merge-Commit: `1f971925b2c3d549297aa939e90b3975c5c7f521`; vor dem Deploy war der Quellbaum identisch zum geprüften Build-Stand `14ea9442e805f670b1b703e8799b381c338605bc`.
- Worker `chronik-von-kleve`, Version `f17b7ff4-33e1-4cae-9868-76133997a887`, Deployment `ebf2b402-d363-4378-ace3-ff58dde66336`, 100 % Verkehr seit `2026-10-28T08:10:27.9655Z` (09:10 Uhr Berlin).
- D1 `a4bc79e6-3f33-4b03-b240-9c341bd1d4d7`, R2 `chronik-von-kleve-r2`, `AUTH_ACCESS_ENVIRONMENT=closed-alpha-production` unverändert. Worker-Versionsvorschauen sind weiterhin deaktiviert. Kein Schemaeingriff und keine Migration.

### Sicherung und Bestandsprüfung

Privates finales Backup unter `.local-work/spieltisch-2/release-21a/`, lokal wiederhergestellt und geprüft am `2026-10-28T08:05:08Z`: 32 reguläre Anwendungstabellen plus vollständiges Originalschema, SQLite-Integrität OK, keine Fremdschlüsselverletzungen. Der FTS-Index wurde aus 3.520 vorhandenen Abschnitten rekonstruiert und auf Integrität geprüft. Keine privaten Sicherungsdateien in Git.

- SQL-Sicherung SHA-256: `e9c3380a72a539ddaee1f68b69baa1bcdefc92ab04652f2678129f7dcb284a3c`.
- Originalschema SHA-256: `47c1169027b99d83ded85ebb9ee0e2f795af251a605305a8544ae7f116dc7fc6`.
- Nachvergleich sämtlicher 32 Tabellen: 31 vollständig identisch, einschließlich Konten, Rollen, Charaktere, Kampagnen und Inhalte. In `auth_sessions` sind alle 20 bestehenden Sitzungen erhalten; bei genau zwei Sitzungen wurde ausschließlich `last_seen_at` vorgerückt. Dies entspricht dem vorhandenen Verhalten authentifizierter Zugriffe in `server/platform-auth.ts`. Keine neuen oder entfernten Sitzungen und keine geänderten Zugangsdaten.
- Keine Testdaten oder echten Charakterdaten übernommen, keine produktiven Schreibtests durchgeführt.

### Tests und offene Sichtprüfung

Die oben dokumentierten 326 Unit-/Regressionstests, 1.615 HTTP-Integrationsprüfungen und 46 Rollen-/Rollback-Prüfungen bleiben Grundlage. Nach der Zentrierung zusätzlich 14 gezielte Tests, Typecheck, gezieltes ESLint, Diff-Prüfung, Produktionsbuild und Wrangler-Deploymentprobe bestanden.

Live auf Hauptdomain und bestehender workers.dev-Adresse je sechs Prüfungen bestanden: Anmeldung erreichbar (200), geschützter Spielbereich verweist zur Anmeldung (307), Teilnehmer/Bogen-, Bühne-, Live-Raum- und Nachrichten-API ohne Sitzung jeweils 401 mit `private, no-store`.

Die erneute visuelle Prüfung der letzten Zentrierung, nativer 125-%-Browserzoom und die Live-Charakterbogenprüfung mit echtem Charakter bleiben **ungeprüft**. Die Browsersteuerung wurde beendet, weil die Windows-Browseradresse nicht sicher erkannt werden konnte. Frühere lokale Full-HD-/1440-/kleinere-Viewport-Prüfungen und getrennte authentifizierte SL-/Spielerprüfungen sind oben dokumentiert; sie ersetzen diese noch ausstehende persönliche Alpha-UX-Abnahme nicht.

Der bereits bekannte Cloudflare-Autobuild-Pfad mit pnpm-Workspace-Fehler ist kein bestandener CI-Nachweis. Veröffentlicht wurde kontrolliert über Wrangler aus dem erfolgreich geprüften lokalen Produktionsbuild. GitHub meldete für den Release-Commit keine Statusprüfungen.

### Rückrollmöglichkeit

Vorherige Worker-Version `72d154d7-478c-4e44-9a40-e1aeccd12b64` (Anwendungscode `ff930003…`) bleibt vorhanden. Kein Rollback durchgeführt. Bei einem Fehler zunächst Daten erhalten und Fix-forward prüfen; ein Code-Rollback erfordert die Prüfung der inzwischen geschriebenen Daten und Rechte. Kein blindes Zurückspielen des Backups und kein Rücksetzen legitimer Sitzungs- oder Spieländerungen.

**Alpha veröffentlicht: JA. Persönliche UX-Abnahme mit echtem Charakter und 125 % Zoom: offen.**
