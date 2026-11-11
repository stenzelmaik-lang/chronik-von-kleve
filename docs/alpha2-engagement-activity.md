# Aktive Zeit und Zeitziele für Alpha 2.0

Die Vorschau ist im Worker nur mit `CVK_ENGAGEMENT_ENABLED=1` verfügbar. Sie erfordert die additive D1-Migration `0014_alpha2_engagement_activity.sql`. Im Spielbereich schaltet der Spieler die Messung für den aktuellen Besuch ein. Ein Neuladen beginnt wieder mit ausgeschalteter Messung. Der lokale Test-Worker aktiviert die Vorschau für die HTTP-Suite. Für einen isolierten Browser-Test lässt sie sich mit `node --experimental-strip-types scripts/test-local.mjs --access-alpha --engagement` öffnen.

## Messprotokoll

- `GET /api/engagement` gibt die eigenen Summen für heute, sieben Berliner Kalendertage und das aktuelle Vorbereitungsfenster zurück. Für das Fenster kommen die Bereichssummen und der vorläufige Zeitfortschritt hinzu. Kampagne und Mitglied stammen aus der aktiven Sitzung.
- `POST /api/engagement` akzeptiert `{category}` zum Start und `{category, ticket}` zur Fortsetzung. Die Antwort enthält `{ticket, seconds}`. Ein Start zählt null Sekunden. Bei Ablauf, Wiederholung, falschem Bereich oder parallelem Anspruch lautet die Antwort `{ticket:null, seconds:0}`. Ein Neustart nach einer Unterbrechung verwendet `{category, ticket, restart:true}` mit dem zuletzt erhaltenen Ticket und schreibt null Sekunden gut. Er ist frühestens nach fünf Sekunden möglich.
- Der Browser sendet nach einem vertrauenswürdigen Eingabeereignis in einem sichtbaren, fokussierten Dokument und anschließend etwa alle 30 Sekunden. Nach 120 Sekunden ohne Eingabe stoppt er. Hintergrund, Fokusverlust, Offline-Wechsel, Seitenschließung und erkannte Zeitsprünge unterbrechen die Kette. Eine unterbrochene Kette beginnt erst nach erneuter Interaktion. Der Spieltisch und die SL-Oberfläche sind ausgenommen.
- D1 hält pro Mitglied und Kampagne ein zufälliges Ticket. Es akzeptiert Fortsetzungen zwischen 25 und 40 Sekunden Serverzeit und zählt höchstens 30 Sekunden pro Abschnitt. Ticketwechsel und Addition erfolgen in einer D1-Transaktion. Ein Abschnitt über Mitternacht zählt ab dem neuen Berliner Kalendertag. Verspätete oder verlorene Signale werden verworfen.
- Die Bereiche sind `character`, `notebook`, `codex`, `story` und `other`. Der Worker erhält weder die Art der Eingabe noch eine URL, einen Client-Zeitstempel oder ein Gerätekennzeichen.

## Zeitfenster und EP

Die Spielleitung kennzeichnet im vorhandenen Gruppenkalender feste Termine und Abstimmungen als Spielabende für die Zeitziele. Die Kennzeichnung kann sie auch bei bestehenden Terminen setzen und entfernen. Der letzte registrierte, tatsächlich gespielte Abend aus `played_sessions` ist der stabile Intervallschlüssel. Das Vorbereitungsfenster beginnt am Folgetag und endet vor dem Kalendertag des nächsten gekennzeichneten Spielabends. Bei offenen Abstimmungen dient der früheste noch kommende Vorschlag als Vorschau, sofern kein fester Spielabend vorliegt. Ohne bestätigten Termin laufen die täglichen Summen weiter. Am Folgetag eines verstrichenen Termins wartet das Fenster wieder auf einen neuen Termin, solange kein gespielter Abend registriert wurde.

Die Formel verwendet die verstrichene UTC-Dauer zwischen den beiden Berliner Tagesanfängen. So funktioniert die Regel mit älteren gespielten Abenden, die nur ein Datum haben. Die Umstellung auf Sommerzeit kann das Intervall um eine Stunde verkürzen. Bei zwei aufeinanderfolgenden Spieltagen gibt es kein volles Vorbereitungsdatum. Überschreitet die Exponentialformel den darstellbaren Zahlenbereich, bleibt das Ziel offen.

Die Zeitmessung belegt Serverkontakte in plausiblen Abständen. Ein authentifiziertes Skript kann solche Kontakte nachahmen. Die Stufenplanung im Servermodul benötigt deshalb unabhängig verifizierte, charaktergebundene Sekunden für genau die aktuelle Terminversion. Sie liefert je Stufe eine +1-EP-Quelle für `bookCharacterXpReward`. Die Buchungskennung basiert auf dem gespielten Abend und bleibt bei Verlegung stabil. Der Ledger kann so dieselbe Stufe bei Wiederholung erkennen, und eine Verlegung führt zu keiner Rückbuchung.

Eine produktive Quelle für qualifizierte Zeit, die Auswahl eines verbindlichen Empfängercharakters pro Intervall und der automatische Buchungsaufruf folgen in einem eigenen Schritt. Die HTTP-Route zur Messung ruft die Buchung nicht auf.

## Speicherung

D1 speichert nur Bereichssummen pro Mitglied, Kampagne und Berliner Kalendertag sowie den jeweils jüngsten Ticketzustand. Tickets verlieren nach 40 Sekunden ihre Funktion als Zeitnachweis und werden überschrieben, sobald eine neue Messung startet. Summen sind auf 365 Kalendertage beschränkt. Ein neuer Messstart entfernt ältere Summen für das eigene Konto. Für einen späteren Live-Rollout sind ein regelmäßiger Löschlauf für inaktive Konten und alte Ticketzeilen sowie die Aufbewahrung in Backups festzulegen. Die Anwendung zeigt Aktivität nur im eigenen Spielerbereich an.
