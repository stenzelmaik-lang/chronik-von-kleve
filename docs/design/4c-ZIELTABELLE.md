# 4c · Zieltabelle Navigation im Spielerbereich · Fassung 2

Stand 09.11.2026 · ersetzt Fassung 1 (Seitenmenü, vom Besitzer verworfen: „Wir wollten nie ein Seitenmenü haben“). **Umgebaut wird erst nach Abnahme.**

Leitlinie des Besitzers: Die **Spielerzentrale mit ihrem Kachelsystem bleibt** und wird weitergeführt, verbessert und verschönert. Oben in der Menüleiste steht „Mein Abend“: **Spielerzentrale** und **Spieltisch**. Termine, Rückblicke und Inventar bleiben Kacheln. Gefallen und Wirtschaft bekommen später einen eigenen Aufbau.

Was aus Fassung 1 bleibt: Namen nach Glossar, Spielergalerie, Rückblicke-Liste, Würfel und Weltkarte nicht mehr als eigene Einträge, Kennungen (`?bereich=`) unverändert.

## 1. Kopfleiste (oben, auf jeder Seite des Spielerbereichs)

| Heute | Danach |
|---|---|
| ChroniPlay · Kampagnenname | bleibt (Logo führt zur Spielerzentrale) |
| – | **Spielerzentrale** |
| – | **Spieltisch** (Live-Tisch) |
| Chronik erkunden | **Die Welt** (Glossar), öffnet wie heute die Welt mit ihrer eigenen Leiste |
| Kampagnen | bleibt |
| Command Center (SL) | bleibt |
| Ortsredaktion (Redakteur) | bleibt nur für Redakteure ohne SL-Rolle, heißt „Ortsverwaltung“ |
| Zur Spielerzentrale | entfällt (steht jetzt fest in der Leiste) |
| Kontomenü | bleibt |

Der aktive Eintrag ist markiert. Auf dem Handy bleibt die Leiste oben, die Einträge brechen in eine zweite Zeile um (wie heute), kein Seitenmenü und keine Schublade.

## 2. Leiste „Die Welt“ (wie heute unter der Kopfleiste, nur in der Welt)

Orte · Chronik · Persönlichkeiten · **Überlieferungen** (neu in der Leiste, bisher nur per Link) · Codex Noctis. Neuigkeiten und Händler kommen dazu, sobald sie neu aufgebaut sind.

## 3. Spielerzentrale (Kachelsystem, Aufbau wie im Screenshot)

| Platz | Heute | Danach |
|---|---|---|
| Großer Charakterblock | Porträt, Name, Clan-Banner, Werte, „Spieltisch betreten“ | bleibt; optisch an Bogen und Charakterprofil angleichen (Spectral, Goldlinien, Eckornamente) |
| Nächster Abend | Kalender, „Kalender öffnen“ | bleibt = Kachel **Termine** |
| Erfahrung & Fortschritt | freie XP, „Entwicklung ansehen“ | bleibt |
| Letzter Spielabend | „Die Chronik wartet“ | bleibt = Kachel **Rückblicke**, neu mit Link „Alle Rückblicke“ |
| Weitere Chronik-Informationen | leer („kein Inhalt festgelegt“) | Vorschlag: **Galerie**-Kachel mit den neuesten freigegebenen Bildern der Runde (Entscheidung 2) |
| Reihe „Meine Vorbereitung“ | Charakter · Inventar · Postfach · Notizbuch | Charakter · Inventar · Postfach · Notizbuch · **Galerie** (Entscheidung 2) |

**Verschönern (ohne neuen Aufbau):** Schrift und Farben nach Designgrundlage, Kacheln mit einheitlichem Rahmen und Eckornament wie der Bogen, ruhigere Hover- und Fokuszustände, Kachelreihe auf dem Handy zweispaltig statt gequetscht, Info-Knopf „Kurz erklärt“.

## 4. Nicht im Menü und nicht als Kachel (bis zum Neuaufbau)

Gefallen, Wirtschaft, Händler, Neuigkeiten: per Link weiter erreichbar, keine Änderung. Würfel: gewürfelt wird am Spieltisch. Spielleitung (Materialvorbereitung, Chronik-CMS): bleibt im Command Center.

## 5. Deine Entscheidungen

1. **Kopfleiste** wie in Abschnitt 1 (Spielerzentrale · Spieltisch · Die Welt · Kampagnen · Command Center)?
2. **Galerie:** als fünfte Kachel in „Meine Vorbereitung“ und zusätzlich in der leeren Kachel „Weitere Chronik-Informationen“ als Vorschau? Oder nur eins davon?
3. **„Meine Vorbereitung“** als Überschrift der Kachelreihe behalten, oder umbenennen (z. B. „Mein Charakter & meine Seiten“)?
4. **Überlieferungen** in die Welt-Leiste aufnehmen?

## 6. Was danach mit dem lokalen Stand passiert

Das Seitenmenü (`PlayerMenu`) und seine Stile werden entfernt. Spielergalerie, Galerie-Schnittstelle mit Rechtetests, Rückblicke-Liste und die Glossar-Namen bleiben. Keine Datenänderung, keine Migration.
