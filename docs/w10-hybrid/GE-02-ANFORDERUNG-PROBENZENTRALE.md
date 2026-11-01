# GE-02 – Verbindliche Anforderung: Zentrale Kommandozentrale für Charakterproben

**Status:** von der Projektleitung als verbindliche fachliche Anforderung für GE-02 vorgegeben (1. November 2026). Aufgenommen auf Basis von GE-01C (`claude/ge-01c-ux`, Code-Stand `cf2c45f`). Dieses Dokument enthält **noch keine Umsetzung, keine Produktivaktivierung und keine neuen Regelmechaniken**.

## 1. Vorgabe der Projektleitung (Wortlaut sinngemäß gegliedert)

ChroniPlay erhält **innerhalb der bestehenden SL-Regie** eine zentrale Steuerung für alle Charakterproben. Zwei Arbeitsweisen sind gleichwertig.

**A. Vorbereitete Proben**
- In der Szenenvorbereitung hinterlegt die SL Proben mit Bezeichnung, Eigenschaften, Schwierigkeit und optionalen erzählerischen Konsequenzen.
- In der Live-Regie ruft sie die Probe ab, wählt oder bestätigt die betroffenen Figuren und gibt sie frei.

**B. Spontane Proben**
- Die SL erstellt jederzeit eine Probe ohne Vorbereitung.
- In der einfachsten Variante genügen der betroffene Charakter und die Schwierigkeit. Die passenden Eigenschaften wählt dann der Spieler.

**Gemeinsamer Spielablauf**
- Der Spieler erhält die Probenanforderung auf seinem Spieltisch.
- Er öffnet seinen Charakterbogen am oberen Spieltischrand, markiert oder bestätigt Eigenschaften und würfelt selbst.
- Die zentrale serverseitige Regelengine berechnet den Pool aus den autorisierten Charakterwerten und allen tatsächlich geltenden, **freigegebenen** Modifikatoren.
- Hunger, persönlicher Stress, Gruppenstress, Szenenbedingungen und spätere Mechaniken laufen über **dieselbe** Berechnung, **sobald ihre Regeln freigegeben sind**.

**Architektur**
- Es gibt keine getrennte Würfelberechnung für vorbereitete und spontane Proben.
- Beide Wege nutzen dieselben Serveraktionen, Charakterdaten, Berechtigungen und Ereignisse sowie denselben Three.js-/Rapier-Würfelrenderer.

**UX**
- Die SL kann mit möglichst wenigen Eingaben eine Probe vorbereiten, abrufen oder spontan ausgeben.
- Sie muss dafür nicht zwischen technischen Verwaltungsmodulen wechseln.
- Die Spieler bleiben aktiv am Pen-&-Paper-Spiel beteiligt.

**Umsetzung**
- Bestehende GE-01C-Funktionen werden wiederverwendet.
- Keine eigenmächtige Produktivaktivierung, keine unfertigen Regelmechaniken.

## 2. Abgleich mit dem GE-01C-Stand

| Anforderung | GE-01C heute | Lücke für GE-02 |
|---|---|---|
| Zentrale Steuerung in der bestehenden Regie | Bereich „Proben“ im Zweitfenster und in der Tisch-Regie, mit Ausgabe, Status und Zählmarke | erfüllt; nur Feinschliff |
| Gleiche Serveraktionen für beide Wege | Beide Wege enden in `requestCheck` und `rollCheck` (`server/live-checks.ts`) mit denselben Ereignissen, Rechten und demselben Renderer | erfüllt; als Architekturregel festhalten und testen |
| A: Proben in der Szenenvorbereitung hinterlegen | Szenenbaustein `kind:'check'` nur mit Titel und Freitext. Die Regie liest Attribut, Fähigkeit und SG heuristisch aus dem Wortlaut (`parsePreparedCheck`) | **Strukturierte Felder** am Szenenbaustein: Eigenschaften, SG, Konsequenzen, optional vorgesehene Figuren. Der Freitext-Leser bleibt nur als Rückfall für Altbestände |
| A: optionale erzählerische Konsequenzen | Landen heute als privater SL-Hinweis (`gmHints`) | eigenes Feld (Erfolg, Fehlschlag, Patzer) und in der SL-Statusliste beim Ergebnis anzeigen |
| A: abrufen, Figuren bestätigen, freigeben | Chip „Vorbereitet in dieser Szene“ füllt das Formular, danach „Wer würfelt?“ und „Probe ausgeben“ | Vorgesehene Figuren vorbelegen, damit ein Abruf aus einem Klick plus Bestätigung besteht |
| B: einfachste Variante Charakter + SG | Ein Titel ist Pflicht, die Zielwahl erfolgt pro Spieler (mit Figurname) | **Titel optional** (Standard aus SG oder Eigenschaften, etwa „Probe · SG 6“). Zielwahl **pro Figur** statt pro Spieler, die Figur bestimmt den Spieler |
| Spieler öffnet den Bogen oben und würfelt selbst | erfüllt (eigener Name → Charakterbogen, Bestätigen oder Wählen, Serverpool, „Würfeln“) | offene Punkte aus der GE-01C-Übergabe, Abschnitt 5 |
| Zentrale Regelengine mit allen freigegebenen Modifikatoren | `deriveW10Preview` und `resolveC1OrdinaryCheck` mit Herkunftsangaben. Aktiv sind Bogenwerte, Gesundheitsabzug und ungelernte Fertigkeit. Persönlicher Stress ist als Entwurf **nicht aktiv** | Ein **einziger Erweiterungspunkt** für künftige Modifikatoren. Jeder Modifikator trägt einen Freigabestatus und bleibt ohne Freigabe wirkungslos, aber sichtbar erklärbar. Kein Modifikator außerhalb dieser Kette |
| Hunger, Gruppenstress, Szenenbedingungen | nicht vorhanden; Hunger ist V5 und nach Regelhierarchie nicht ins V20-System zu mischen ohne Entscheidung des Besitzers | nur die Schnittstelle vorsehen; Aktivierung erst nach Regelfreigabe (Hausregel > V20 > Erschaffung) |
| Keine Produktivaktivierung | lokal per `GE01_CHECKS=local-only`; Live-Alpha nur als Konzept | unverändert; Aktivierung nur über das freigegebene Alpha-Modell |

## 3. Umsetzungsvorschlag GE-02 (zur Freigabe)

1. **Strukturierte vorbereitete Probe:** Am Szenenbaustein kommt ein optionales Teilobjekt `check` hinzu, nach dem Muster von `pager` und `material` in `sceneElementSchema`. Felder:
   - `attributeId?` und `abilityId?` als stabile W10-IDs aus `trait-ids`
   - `difficulty` von 2 bis 10
   - `consequences?` mit Erfolg, Fehlschlag und Patzer, nur für die SL
   - `targetCharacterIds?`

   Die Szene liegt als JSON im vorhandenen Datensatz, daher ist **keine Migration** nötig. Ältere Szenen bleiben gültig.
2. **Eingabe in der Szenenvorbereitung** (Command Center, bestehender Szeneneditor). Keine neue Verwaltung.
3. **Regie „Proben“:**
   - Vorbereitete Proben als Liste mit „Ausgeben“, Ziel vorbelegt.
   - Spontane Probe auf zwei Pflichtangaben reduziert: Figur(en) und SG.
   - Konsequenzen erscheinen beim Ergebnis in der Statusliste.
4. **Server:**
   - `requestCheck` erhält optional `targetCharacterIds` und leitet die Spieler-IDs daraus ab. Das Server-Gegenstück prüft, dass die Figur zum Abend gehört.
   - Konsequenzen gelangen nie an Spieler-Routen.
   - Der Ereignistyp bleibt gleich, mit Versionsfeld.
5. **Modifikator-Kette:** Ein Register mit Freigabestatus pro Modifikator. Nur freigegebene Einträge wirken. Tests sichern, dass nicht freigegebene Mechaniken (Stress, Hunger, Szenenbedingungen) den Pool nicht verändern.
6. **Tests:**
   - Gleichheit beider Wege: dieselbe Probe vorbereitet und spontan liefert identische Ereignisstruktur und Poolberechnung.
   - Rechte für SL, Spieler und nicht angemeldet.
   - Konsequenzen nie bei Spielern.
   - Browserlauf A und B.

## 4. Grenzen

- Keine Produktivaktivierung.
- Keine Hunger-, Stress-, Gruppenstress-, Maskerade- oder Szenenbedingungsregeln ohne gesonderte Regelfreigabe.
- Keine zweite Würfelberechnung, keine zweite Charakterbogenverwaltung, kein zweiter Renderer.
- Schemaänderungen nur an JSON-Dokumenten. Eine echte DB-Migration bräuchte eine eigene Freigabe.
