# ChroniPlay 2036 — isolierter Regieprototyp

Start in PowerShell aus der bestehenden Arbeitskopie:

```powershell
Set-Location 'C:\Users\Stenz\Documents\Codex\cvk-phase-c-remote-test\.review-work\live-release-git'
node prototypes/command-center/server.mjs
```

SL: http://127.0.0.1:5196/
Spieler A: http://127.0.0.1:5196/player?id=a
Spieler B: http://127.0.0.1:5196/player?id=b

Keine Installation nötig. Mit Strg+C stoppen. Zustand wird ausschließlich in der ignorierten Datei state.local.json gespeichert. Port 5196 muss frei sein. Keine D1-/R2-/Produktionsverbindungen.

## Tatsächlich implementiert

Sitzungsphasen; zwei synthetische Szenen; private Regie; persistente Notizen; zielgerichtete Text-Handouts; Widerruf; Spielerprojektion ohne SL-Felder; Revisionen gegen konkurrierendes Überschreiben; begrenzter Ereignisverlauf; HTML-Escaping; Loopback-Bindung.

Die Spieleransichten aktualisieren sich alle zwei Sekunden. Dies ist Polling, kein vollständiges Mehrbenutzersystem.

## Demonstriert, keine echte Authentifizierung

SL-Zugang ist auf diesem lokalen Demonstrationsserver frei erreichbar. Der Sitzungsschlüssel schützt den API-Aufruf, ersetzt aber keinen Login, da die SL-Seite ihn ausliefert. Spieler A/B sind auswählbare Demoidentitäten, keine geprüften Benutzer. Deshalb nur synthetische Daten und niemals öffentliche Freigabe, Tunnel oder echte Geheimnisse verwenden.

Die Szene mit dem Namen Electric Taberna ist ausdrücklich synthetisch. Keine vorhandenen Ortsdaten oder Medien wurden übernommen oder verändert.

## Integration offen

Vorhandene SessionPanel/DicePanel wurden gelesen. Keine zweite Charakter- oder Würfelberechnung wurde gebaut. Die eigentliche Integration muss die bestehenden Actor-/Kampagnenrollen, Ortsprojektionen und Medienfreigaben verwenden. Charaktere bleiben in der vorhandenen Character Engine. Phaser ist ein späterer Visualisierungsadapter, keine eigene Regelengine.

Drive-Projektbibel, Roadmap und Übergabe wurden in diesem Durchlauf nicht gelesen. Der Prototyp beansprucht daher keine vollständige Übereinstimmung mit diesen Dokumenten. Die offizielle Onyx-Path-Bogenübersicht wurde geprüft; keine V5-Mechaniken implementiert.

## Layoutentscheidung

Geprüft wurden ein modulares Kachel-Dashboard und ein szenenzentrierter Regiearbeitsplatz. Gewählt wurde der Regiearbeitsplatz: Szenen links, Erzählung/Notizen zentral, Freigaben rechts. Weniger Kontextwechsel während des Spielabends. Auf schmalen Displays stapeln sich die Bereiche.

## Prüfungen

`node prototypes/command-center/test.mjs` prüft Zugriff, Projektion, zielgerichtete Freigabe, Widerruf und konkurrierende Änderungen; stellt Ausgangswerte anschließend wieder her.

Browser: Notiz gespeichert und nach vollständigem Reload erhalten; Handout für A sichtbar. Weitere Browserprüfungen werden im Abschlussbericht separat angegeben. Keine vollständige Plattformregression erforderlich: bestehende Plattformdateien unverändert.
