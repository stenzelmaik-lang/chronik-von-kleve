# Storybuch und Szenenmanager – lokale Funktionsabnahme

Stand: 02.10.2026. Branch `codex/story-scene-manager-foundation`.

## Tatsächlich implementiert

- Szenen erstellen, bearbeiten, speichern und nach vollständigem Neuladen wieder öffnen.
- Szenen-Switcher mit Suche, Handlungsstrangfilter, Schauplatz und Laufstatus.
- Erzählung, Personen, Interaktion, Geheimnisse und Konsequenzen als getrennte Register.
- Verweise auf bestehende Orts-, NSC-, Hinweis- und Handout-Identitäten. Keine zweite Spielweltdatenbank.
- Parallel laufende Szenen für ausdrücklich ausgewählte Charakter-Teilgruppen oder die Kampagnengruppe.
- Aktivieren, pausieren, fortsetzen, abschließen und erneut aufrufen. Wiederaufnahme erzeugt einen neuen Lauf; abgeschlossene Läufe bleiben erhalten.
- Private Vorbereitung bleibt getrennt vom tatsächlich dokumentierten Spielverlauf. Keine automatische Kanonfestlegung, Auslösung oder Veröffentlichung.
- Gespeicherte Erzählung ausdrücklich für Gruppe oder Charakter freigeben und gezielt widerrufen. Veröffentlichungen sind eingefrorene Fassungen; spätere Entwurfsänderungen erscheinen nicht automatisch.
- Individuelles Charakterwissen für bestehende Hinweise und Handouts. Ein anderer Charakter desselben Kontos erhält dieses Wissen nicht automatisch.
- Gemeinsame sichere Spielerkomponente in tatsächlicher Sitzung und SL-Spielerblick. Private Regie, Geheimnisse, Teilgruppenlisten und Revisionsdetails werden nicht an Spieler übertragen.
- Serverseitiger Versionsschutz und atomare Speicherung einschließlich Audit; veraltete Änderungen liefern HTTP 409. Offene Eingaben bleiben im Konfliktfall erhalten.

## Daten und Berechtigungen

Bestehende SCENE-Entities speichern das private Dokument in `gm_body` und Läufe/Freigaben in `content`. `world_events` protokolliert explizite Änderungen. Tatsächliche Ereignisse verwenden bestehende private NOTE-Entities mit Verweisen auf Sitzung, Szene und Lauf.

`knowledge.audience` erhält den logischen Wert `character`. Die bestehende physische TEXT-Spalte besitzt keinen SQL-Enum-Constraint; es ist keine Migration erforderlich. Ein serverseitig geprüfter, tatsächlich eigener Charakterkontext ist für die persönliche Spielerprojektion zwingend. GM_SECRET und Recovery bleiben gesperrt. Generische Entity-/Knowledge-Pfade können die Szenenfreigabe nicht umgehen.

API: `/api/command-center/scenes` für SL-Befehle und geprüfte Vorschau; `/api/session-scenes` für die begrenzte Spielerprojektion. Vorhandene Authentifizierung und Kampagnenrollen bleiben maßgeblich.

## Nachweise

| Prüfung | Ergebnis |
|---|---|
| Typecheck | bestanden |
| Lint | bestanden |
| Build | bestanden |
| Fach- und Regressionstests | 121 bestanden, 0 fehlgeschlagen |
| Isolierte Integration | 921 Prüfungen bestanden |
| Rollen-, Backfill- und Rollbacktests | 46 Prüfungen bestanden |
| Echte lokale SL-/Spieler-Browserprüfung | bestanden für unten genannten Ablauf |

Logs und Screenshots: `outputs/story-scene-20261002/`. Bekannte Buildwarnung: Client-Chunks über 500 kB; Build erfolgreich. Keine neuen Abhängigkeiten. Keine produktive Migration, keine Produktionsdatenänderung, kein Push, Merge oder Deployment.

Die Integration prüft unter anderem Rollenüberschreitungen, fremde Kampagnen, blockierte Benutzer, persönliche/gruppenbezogene Freigaben, Widerruf, geheime Referenzen, parallele Änderungen und den vollständigen Rollback einer absichtlich fehlgeschlagenen Audit-Schreiboperation.

### Echte Browserprüfung

1. Zwei eindeutig synthetische Szenen angelegt und mit vorhandenen Ortsidentitäten verknüpft.
2. Erzählung, private Regie, Geheimnisse und optionale Entwicklung gespeichert; vollständiges Neuladen und späterer Serverneustart erhalten die Daten.
3. Teilgruppen A und B parallel aktiviert. A pausiert, fortgesetzt, abgeschlossen und erneut aufgerufen. B läuft unabhängig weiter.
4. Tatsächliche synthetische Ereignisnotiz mit Szene und Lauf gespeichert; nach Reload sichtbar. Vorbereitete optionale Entwicklung unverändert erhalten.
5. Erzählungen jeweils nur für Charakter A beziehungsweise B freigegeben; Hinweis nur für A.
6. Normaler Login als A: eigene Erzählung und Hinweis sichtbar, keine privaten SL-Texte oder andere Szene. Reload erhält ausgewählten Charakterkontext.
7. Wechsel zu A's zweitem Charakter: persönliche Szene und Hinweis verschwinden. Gruppenblick enthält keine persönlichen Freigaben.
8. Separater normaler Login als B: nur B's Szene, kein A-Hinweis und kein SL-CMS-Einstieg.
9. Gezielter Widerruf von A's Szene geprüft: sichere Vorschau leer. Testfreigabe anschließend wiederhergestellt.
10. SL-Anmeldung wiederhergestellt. Browserkonsole des abschließenden Tests ohne erfasste Fehler/Warnungen.

Screenshots: `sl-scenes.png`, `player-a.png`, `player-b.png`. Die Browserprüfung war sequenziell mit zwei echten lokalen Spieleranmeldungen; Gleichzeitigkeit wird zusätzlich durch die isolierten Integrationstests geprüft. Kein behaupteter produktiver oder mehrmonitoriger Live-Test.

## Selbst ausprobieren

Laufende lokale Adresse: http://127.0.0.1:8798/spielbereich?bereich=sitzung

Nur synthetische Demo-Konten:

- SL: `command-gm@example.invalid`
- Spieler A: `command-a@example.invalid`
- Spieler B: `command-b@example.invalid`
- Demo-Passwort: `ChroniPlay-Demo-2036!`

In der Sitzung das Werkzeug **Szenenregie** öffnen/vergrößern. Die beiden SYNTHETISCH-Szenen sind als Abnahmedaten erhalten. Spieler wählen unter **Charakterwissen auswählen** ausdrücklich ihren Charakter oder gemeinsames Gruppenwissen.

Neustart im Projektverzeichnis: `node scripts/test-local.mjs --command-center-2`. Falls Node nicht im Windows-Pfad liegt, den vorhandenen Codex-Node unter `C:\Users\Stenz\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe` verwenden. Die Startdatei prüft den markierten isolierten Datenbestand und überschreibt keinen unmarkierten Bestand.

## Bewusst noch nicht umgesetzt

Bedingungseditor, verzweigte Dialogengine, automatische Konsequenzen, fiktive Zeitsteuerung und Rätselengine gehören zum späteren Abschnitt. Vorbereitete Gesprächs- und Probennotizen sowie der vorhandene Würfelbereich bleiben nutzbar, sind aber noch keine automatisierte Ausführungsengine. Die aktuelle Wissensfreigabe betrifft bestehende Hinweise/Handouts; Bilder und Medien nutzen weiterhin ihre bestehende geschützte Infrastruktur.

Status: lokal funktionsfähig und zur persönlichen Abnahme bereit; nicht veröffentlicht und nicht als vollständige finale Storyengine abgenommen.
