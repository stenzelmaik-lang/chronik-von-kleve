# 4b · Abweichungsliste Charakterbogen gegen das V20-Referenzblatt

Stand 08.11.2026

**Referenz:** das zweiseitige deutsche V20-Blatt (Jubiläumsausgabe, „Neonate“) aus dem Drive-Ordner des Besitzers. Ich habe nur den Aufbau verglichen: Felder, Gruppen, Reihenfolge, Punktanzahl. Das Blatt in Drive ist ausgefüllt. Wie vom Besitzer vorgegeben habe ich Werte und eingetragene Daten ignoriert; nichts davon steht hier oder im Repo. Das Blatt selbst liegt nicht im Repo.

**Verglichene Ansichten (alle nur lesend):**
- **Spielerzentrale** und **SL-Ansicht der Charakterverwaltung**: beide `CharacterDetail` (`character-detail.tsx`, Reiter „V20-Bogen“);
- **Ingame-Menü** am Spieltisch: `CharacterReadOnly` (`spieltisch/character-readonly.tsx`).

Die Bearbeitungsmaske (`character-creation-fields.tsx`, `character-sheet-editor.tsx`) bleibt nach Auftrag funktional unverändert und steht deshalb nicht in der Liste.

Legende: ✓ entspricht · ≠ weicht ab · – fehlt

## Seite 1

| Feld auf dem Blatt | Spielerzentrale / SL | Ingame | Befund |
|---|---|---|---|
| Name, Spieler, Chronik | ✓ (Kopf) | ✓, als Liste mit Rohschlüsseln | ≠ Ingame zeigt unbekannte Schlüssel roh |
| Wesen, Verhalten, Konzept | ✓ | ✓ | – |
| Clan, Generation, Erzeuger | ✓ | ✓ | – |
| Gruppe **Körperlich** | ✓ | ✓ | – |
| Gruppe **Gesellschaftlich** | ≠ heißt „Sozial“ | ≠ „Sozial“ | Bezeichnung des Blatts übernehmen |
| Gruppe **Geistig** | ≠ heißt „Mental“ | ≠ „Mental“ | Bezeichnung des Blatts übernehmen |
| Attribute je Gruppe, Reihenfolge | ✓ | ✓ | – |
| 5 Punkte je Zeile | ✓ | ✓ | – |
| **Wert über 5** | ≠ wird bei 5 abgeschnitten (`Dots max=5`) | ✓ zeigt mehr Punkte | einheitlich: Punkte wachsen mit |
| **Fehlender Wert** | ≠ erscheint als 0 (leere Punkte) | ≠ erscheint als 0 | „–“, nie leer, nie 0 |
| Talente, Fertigkeiten, Kenntnisse (je 10, Reihenfolge) | ✓ | ✓ | – |
| je eine freie Zeile pro Fähigkeitsgruppe | ≠ eigene Fähigkeiten stehen gesammelt unter „Freie Fähigkeiten“ | ≠ ebenso | in ihre Gruppe einordnen (Talent / Fertigkeit / Kenntnis) |
| Spezialisierungen (auf dem Blatt in der Zeile) | ≠ eigener Block unter den Fähigkeiten | – fehlen | an der jeweiligen Zeile zeigen |
| Werte ohne Zuordnung | ✓ „Weitere gespeicherte …“ | – fehlen | zeigen, als „ohne Zuordnung“ |
| Disziplinen (Liste mit Punkten) | ✓ | ✓ | – |
| Hintergründe (Liste mit Punkten) | ✓ | ✓ | – |
| Tugenden „Gewissen/Überzeugung“, „Selbstbeherrschung/Instinkt“, „Mut“ | ≠ nur die gespeicherten Namen (Gewissen …) | ≠ ebenso | Doppelbezeichnung nur zeigen, wenn nichts gespeichert ist. Gespeicherte Namen (z. B. „Überzeugung“) bleiben, wie sie sind |
| Menschlichkeit/Pfad, 10 Punkte | ✓ Punkte | ≠ nur Zahl als Text | 10 Punkte an allen Orten |
| Haltung (zum Pfad) | – | – | nicht im Datenmodell → offen |
| Willenskraft: 10 Punkte permanent, 10 Kästchen temporär | ≠ Punkte und Text „Aktuell x von y“ | ≠ Rohwerte (Permanent/Temporär) | Punkte und Kästchen wie auf dem Blatt |
| Blutvorrat: 20 Kästchen, Blut pro Runde | ✓ Kästchen bis zum Maximum | ≠ Rohwerte | Kästchen an allen Orten |
| Gesundheit: 7 Stufen mit Abzügen | ≠ nur oben als „Gesund“ im Live-Block | ≠ Rohobjekt | die 7 Stufen mit Abzug und aktuellem Schaden |
| Clansschwäche | ✓ | ✓ | – |
| Erfahrung | ✓ (Reiter „Entwicklung“) | ✓ Rohwerte | lesbar beschriften |

## Seite 2

| Feld auf dem Blatt | Spielerzentrale / SL | Ingame | Befund |
|---|---|---|---|
| Andere Eigenschaften (Zeilen mit Punkten) | ≈ „Weitere gespeicherte …“, Pfade | – | mit „ohne Zuordnung“ abgedeckt |
| Pfade (Thaumaturgie u. a.) | ✓ | – | zeigen |
| Rituale (Ritual, Stufe) | – | – | nicht im Datenmodell → offen |
| Kampf (Waffe, Schwierigkeit, Schaden, Reichweite, Schussfolge, Magazin, Versteck) | – | – | nicht im Datenmodell → offen. Teile davon gehören ins künftige Inventarsystem |
| Vorzüge & Schwächen mit Kosten | ✓ | ✓ | – |
| Verbündete & Kontakte | ≈ Reiter „Bekannte Verbindungen“ | – | bleibt im Reiter |
| Ausrüstung | ≈ Inventar (eigener Bereich) | ≈ Spielerleiste „Inventar“ | bleibt im Inventar |
| Beschreibung (Alter, Aussehen, Todestag, Geschlecht, Herkunft, Haar, Augen, Größe, Gewicht, Nationalität) | – | – | nicht im Datenmodell → offen |
| Persönliche Geschichte | ✓ Reiter „Geschichte & Bilder“ | ✓ | – |
| Ziele | ✓ (Spielhilfe/Ziele) | ✓ | – |

## Dazu: dieselbe Figur sieht an drei Orten verschieden aus

- **Spielerzentrale:** Porträt im Goldrahmen, Banner, nummerierte Blöcke.
- **Ingame-Menü:** Reiter, Werte als Schlüssel-Wert-Liste in Arial, keine Punkte für Ressourcen.
- **SL-Charakterverwaltung:** wie die Spielerzentrale, mit zusätzlichem Reiter „Verwaltung“.

## Umsetzung in 4b (nur Darstellung)

Eine Bogen-Komponente für alle lesenden Orte, zwei Layouts: breit für Spielerzentrale und SL, schmal fürs Ingame-Menü. Ändern wird sich nur die Darstellung:
- Gruppennamen wie auf dem Blatt;
- Punkte wachsen über 5;
- „–“ für fehlende Werte;
- eigene Fähigkeiten in ihrer Gruppe, Spezialisierungen an der Zeile, Werte ohne Zuordnung sichtbar;
- Menschlichkeit, Willenskraft, Blut und Gesundheit wie auf dem Blatt.

**Nicht in 4b**, weil es eine Datenmodell-Änderung wäre: Haltung, Rituale, Kampfblock, Beschreibungsfelder. Vorschlag: ein eigener Auftrag „Bogen Seite 2“. Die Bearbeitungsmaske bleibt funktional unverändert. Die Probenauswahl im Ingame-Menü (Attribut und Fähigkeit für einen Wurf wählen) bleibt, wie sie ist.
