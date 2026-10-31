# Zustandswerte am Spieltisch (Blut, Willenskraft, Gesundheit, Stress, Maskerade)

Stand 30.10.2026 · Branch `claude/spieltisch-zustandswerte`, abgezweigt von `claude/charakterverwaltung-3` (`4edf70a`), mit `claude/spieltisch-medien` (`6d0aba8`) lokal zusammengeführt. Der Merge lief ohne Konflikte, nur `package.json` wurde automatisch zusammengeführt. Beide Ursprungsbranches bleiben unverändert. Es gab keinen Push, keine PR, kein Deployment und keine Migration.

## Lokale Testinstanz

```powershell
.\scripts\start-zustandswerte.ps1          # vorhandenen Build starten
.\scripts\start-zustandswerte.ps1 -Build   # vorher neu bauen
```

- Adresse: `http://127.0.0.1:8852/anmelden`, danach „Spielabend“ → Spieltisch. Der synthetische Abend „SYNTHETISCH – Zustandswerte“ wird beim ersten Start automatisch gestartet.
- Speicher: `.local-test/zustandswerte`. Konten: `command-gm@`, `command-a@` und `command-b@example.invalid` (Passwort siehe Repo-Fixture).
- Inhalt: Spieltisch-Fixture „Kaserne“, ein spielbereiter Charakter für Spieler A (10. Generation) und einer für Spieler B (bestätigt).

## Regelgrundlage (bestätigt)

| Wert | Quelle | Umsetzung |
|---|---|---|
| Blutvorrat | V20-Regelwerk (Drive `Regelwerk.pdf`, englische 20th Anniversary Edition, lokal mit Textebene), S. 121, 268–270 | Maximum und Blut pro Runde laut Generationstabelle S. 270. Ein im Bogen eingetragenes `bloodMax`/`bloodPerRound` hat Vorrang. Bei Blut 0 erscheint der Hinweis auf Raserei und die Selbstbeherrschungsgrenze. |
| Willenskraft | S. 120, 266–267 | Permanent (Kreise) und Vorrat (Kästchen); der Vorrat liegt nie über dem permanenten Wert. Einsatz −1. Zurückgewinnen und „Ende der Geschichte: voll“ entscheidet die SL. |
| Gesundheit | S. 121 (Stufentabelle), S. 284–285 („Applying Damage“) | 7 Stufen mit Abzügen 0/−1/−1/−2/−2/−5/–. Schadensarten Wucht `/`, Tödlich `X`, Schwer `*`: Schwer wird oben eingetragen, Normalschaden zuletzt und zuerst geheilt. Schaden über „Außer Gefecht“ hinaus führt bei Normalschaden in die Starre und bei schwerem Schaden zum endgültigen Tod. „Außer Gefecht“ ohne Blut führt sofort in die Starre. |
| Heilung | S. 268, 285 | 1 Blut heilt eine Stufe Normalschaden. Eine Stufe Schwer kostet 5 Blut und einen ganzen Tag Ruhe; jede weitere Stufe am selben Tag zusätzlich 1 Willenskraft (nur SL). |
| Neue Nacht | S. 268 (Erwachen), S. 267 (SL-Option) | Jede Figur verliert 1 Blut. +1 Willenskraft nur, wenn die SL die V20-Option einschaltet (Standard: aus). |
| Gruppenstress | Drive „Stress-Regel – Spielerhandout“ (Hausregel der Kampagne) | Gemeinsame Leiste 0–10 mit den Stufen Alltag 0–3, Angespannt 4–6 (+1 SG), Hochdruck 7–9 (+2 SG) und Bruchpunkt 10. Den Bruchpunkt wendet die SL bewusst per Schaltfläche „Alle −1 Willenskraft“ an, nichts geschieht automatisch. |
| Maskerade | Kein V20-Charakterwert. Die Kampagne nutzt „Maskerade-Stufe 0–5“ (einmal 6) in den SL-Eskalationsmatrizen der Orte (Altdaten CVK-LIVE). | Kampagnenweite Stufe mit Standardskala 0–5 (einstellbar 3–10). Ohne ausdrückliche Freigabe bleibt sie nur bei der SL, auch serverseitig. |

## Offen (bewusst nicht erfunden, einstellbar gelassen)

1. **Maskerade-Skala und Bedeutung der Stufen:** Die Altdaten nutzen meist 0–5, an einer Stelle 6. Die Skala ist einstellbar; die Stufentexte bleiben in den SL-Ortsmatrizen.
2. **Stress-Handout nennt „1 Hunger“:** Hunger ist ein V5-Begriff, kein V20-Wert. Bitte klären, ob „−1 Blut“ gemeint ist. Bis dahin gibt es keine Automatik.
3. **(Erledigt am 31.10.: beides umgesetzt, siehe Nachtrag.) Stress pro Gruppe oder pro Charakter:** Das Handout beschreibt eine Gruppenleiste. Die alte Datenbank kannte zusätzlich `domain_stress` pro Charakter und Stress pro Ort. Umgesetzt ist die Gruppenleiste laut Handout.
4. **Kooperation +1 Willenskraft (Handout Abschnitt 4):** Die SL bucht das manuell mit „Zurückgewinnen“.
5. **Blutgrenze pro Runde:** Sie wird bei Spielerbuchungen pro Vorgang geprüft, Runden werden nicht gezählt. Die SL kann mehrere Runden in einem Vorgang buchen.
6. **Bögen ohne Schadensart:** Ältere Bögen speichern nur die Stufe (`health.current`). Diese Stufen erscheinen als `■ Art nicht erfasst`, bis die SL sie korrigiert. Es wird keine Art geraten.

## Steuerrecht: eine Einstellung, serverseitig geprüft

Unter „Zustände der Runde → Steuerung & Freigaben“ wählt die SL eines von drei Profilen:

| Vorgang | Empfohlen (Standard) | Erweitert | Nur SL |
|---|---|---|---|
| Eigenes Blut ausgeben (−1, höchstens Blut pro Runde) | Spieler | Spieler | SL |
| Eigene Willenskraft einsetzen (−1) | Spieler | Spieler | SL |
| Blut trinken (+) | SL | Spieler | SL |
| Normalschaden mit Blut heilen | SL | Spieler | SL |
| Schaden, schwere Heilung, Stufen entfernen, Zurücksetzen, Korrektur, Willenskraft zurückgewinnen | SL | SL | SL |
| Gruppenstress, Maskerade, Neue Nacht, Bruchpunkt, Freigaben | SL | SL | SL |

Die SL darf immer alles. Fremde Figuren existieren für Spieler am Tisch nicht (404). Zusätzlich gelten die Regelprüfungen: kein negativer Vorrat, nicht über das Maximum, Starre und endgültiger Tod sperren Spielerbuchungen. Archivierte, SL-geheime und noch nicht bestätigte Engine-Entwürfe nehmen nicht teil. Hat eine Person eine aktive Figur gewählt, zählt nur diese.

## Oberfläche

- **Auf dem Tisch (unten links):** Spieler sehen ein kompaktes Feld für die eigene Figur mit Blut-, Willenskraft- und Gesundheitskästchen sowie dem Gruppenstress. Die SL sieht dort Stress, Maskerade und die Zahl der Figuren. Ein Klick öffnet die Seitenleiste „Zustände“ (auch über die Werkzeugleiste).
- **Spieleransicht:** Die Leisten sind wie auf dem Papierbogen aufgebaut (Kreise permanent, Kästchen Vorrat, Gesundheitstabelle mit `/ X *`). Dazu kommen die erlaubten Schaltflächen und ein Regelhinweis zum Willenskrafteinsatz.
- **SL-Übersicht:** Alle Figuren mit Schnellaktionen (−1/+1, Schaden nach Art und Stufen eintragen, heilen, Zurücksetzen mit Rückfrage, Status aufheben und Freigabe für die Runde). Dazu Gruppenstress und Maskerade ±1, „Neue Nacht“, „Alle −1 Willenskraft“, Profilwahl und Verlauf.

## Nachtrag 31.10.2026: zwei getrennte Anzeigen auf dem Tisch

Auf Wunsch der Spieler-Sicht („Point of View“) zeigt der Tisch die Werte jetzt dauerhaft in zwei getrennten Teilen. Die Steuerung bleibt unverändert in der Seitenleiste.

- **Körper (unten links):** Name, Zustand in Worten (Unverletzt, Verletzt … Außer Gefecht, Starre, Endgültiger Tod) mit Würfelabzug, breite Gesundheitsleiste mit den sieben Kästchen des Bogens (Wucht gestreift, Tödlich rot, Schwer glühend), Blutvorrat als Phiole mit Teilstrichen sowie Willenskraft-Punkte. Mit zunehmender Verwundung schlägt das Herzsymbol schneller und der Rahmen färbt sich.
- **Wundrand:** Ist die eigene Figur verletzt, färbt sich der Rand des Tischs für diesen Spieler rot, je nach Schwere stärker und pulsierend. In der Starre wird die Sicht dunkel; bei leerem Blutvorrat pulsiert ein schwacher Rand. Die SL sieht keinen Wundrand. Bei „Bewegung reduzieren“ entfällt die Animation.
- **Druck (unten rechts):** drei getrennte Zeilen, jeweils mit Stufe und Leiste: **Ich** (persönlicher Stress der eigenen Figur), **Gruppe** (Gruppenstress laut Handout) und **Maskerade** (Risiko). Ab „Hochdruck“ bzw. „In Gefahr“ hebt sich die Zeile farbig ab, bei „Bruchpunkt“/„Bruch droht“ pulsiert sie.
- **SL:** Links eine Kurzübersicht aller Figuren (Gesundheitsleiste, Blut), rechts Gruppenstress, die genaue Maskerade-Stufe und der höchste persönliche Stress.
- **Persönlicher Stress (neu, löst offenen Punkt 3):** je Figur 0–10, gleiche Stufennamen wie der Gruppenstress. Nur die SL bucht (±1 in der Figurenkarte), der Besitzer sieht ihn. Die Wirkung legt die SL fest, nichts wird automatisch gewürfelt. Gespeichert als optionales `personal` im Tisch-JSON, ohne Schemamigration.
- **Maskerade-Risiko (neu):** Die SL wählt unter „Steuerung & Freigaben“: *Nur SL*, *Spieler sehen die Lage* (Standard für neue Tische) oder *Spieler sehen die Stufe*. Bei „Lage“ erhalten Spieler serverseitig nur die grobe Lage (Gewahrt, Aufmerksamkeit, In Gefahr, Bruch droht), nie die Zahl. Die Lage ist eine reine Darstellung, keine Regel: 0 = Gewahrt, bis 40 % der Skala = Aufmerksamkeit, darüber = In Gefahr, Maximum = Bruch droht. Ältere Stände ohne diese Wahl behalten ihre Bedeutung (sichtbar = Stufe, sonst nur SL).
- Auf 375 px stehen beide Teile nebeneinander über der Würfelleiste. Ist eine Seitenleiste offen, verschwinden sie dort; am Desktop nur der Teil, den die Leiste verdeckt.

Prüfung: Unit-Suite 179/179 (neuer Test für persönlichen Stress und Maskerade-Lage), Integration mit SL/A/B um persönlichen Stress und Maskerade-Ansichten erweitert, alles bestanden; Medien- und Regie-Regression bestanden. Browser: Spieler A bei 1440×900 und 375×812 (keine horizontale Scrollbreite), SL bei 1440×900, keine Konsolenfehler.

## Datenhaltung, Live-Verteilung, Protokoll

- **Charakterwerte:** Sie liegen wie bisher im Charakter-JSON (`blood`, `willpowerTemporary`, `health`). Neu ist das optionale `health.track` mit Schadensarten und `health.status`; `health.current` wird synchron gehalten, sodass Bogen und ältere Ansichten unverändert funktionieren. Die bestehende Route `character-runtime` hält `track` bei Stufenänderungen konsistent.
- **Tischwerte:** Profil, Stress, Maskerade, Freigaben und das SL-Protokoll liegen als JSON in `settings` (`table-vitals:<Kampagne>`) mit strengem Zod-Schema und Versions-Vergleich. Es gibt keine Schemamigration.
- **Live-Verteilung:** Die Werte sind Teil des bestehenden Spieltisch-Snapshots (750-ms-Abfrage) und werden pro Person gefiltert. Spieler erhalten weder fremde Figuren-IDs noch Maskerade, Einstellungen oder Protokolle. Das prüft der Integrationstest auf Rohtextebene.
- **Protokoll:** Jede Charakteränderung läuft über `saveEngine` und erzeugt ein atomares `world_events`-Ereignis `character.vitals` mit Vorher/Nachher-Werten. Es erscheint im Charakterverlauf der Verwaltung und in der Tischübersicht der SL. Gruppenänderungen schreiben `table.vitals`.

## Prüfungen

- Unit: `tests/character-vitals.test.mjs` 9/9; gesamte Unit-Suite 178/178. TypeScript und ESLint der geänderten Dateien ohne Befund. Produktionsbuild erfolgreich.
- Integration (`tests/zustandswerte-integration.mjs`, SL, Spieler A und B gegen Port 8852): Sichtbarkeit, Rechte je Profil, Live-Aktualisierung, Neuladen nach neuer Anmeldung, Schaden/Heilung/Reset, Gruppenstress, Geheimhaltung der Maskerade, veraltete Version und alter Lauf (409), Freigabe und Rücknahme einer Figur, Neue Nacht und Charakterverlauf. Alles bestanden.
- Regression auf derselben Instanz: `spieltisch-medien-integration` und `spieltisch-regie-integration` ALL PASS.
- Browser (eingebauter Browser): SL-Ansicht bei 1440×900 (Schaden über die Oberfläche eingetragen, Stress +1); Spieler A bei 375×812 (kompaktes Feld, Seitenleiste, „1 Blut ausgeben“ → 12/13, keine horizontale Scrollbreite, keine SL-Aktionen und keine Figur von B sichtbar).
- Beobachtung außerhalb dieser Änderung: Die SL-Browsersitzung bekam während der Prüfung einmal ohne eigenes Zutun 401 und musste sich neu anmelden. Die Kopfzeile des Spieltischs überlappt bei 375 px (bestehendes Layout).

## Geänderte Dateien

Neu: `domain/character-vitals.ts`, `server/live-vitals.ts`, `app/api/live-vitals/route.ts`, `app/spielbereich/modules/spieltisch/vitals.tsx`, `vitals.module.css`, `tests/character-vitals.test.mjs`, `tests/zustandswerte-integration.mjs`, `scripts/start-zustandswerte.ps1`, dieser Bericht.
Angepasst: `server/live-stage.ts` (Snapshot), `app/spielbereich/modules/spieltisch/stage.tsx` und `types.ts` (Einbindung), `app/api/character-runtime/route.ts` (Schadensleiste synchron), `scripts/test-local.mjs` (Modus `--zustandswerte`, Port 8852), `package.json` (Skripte).
