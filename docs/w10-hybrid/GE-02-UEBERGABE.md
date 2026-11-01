# GE-02 – Zentrale Kommandozentrale für Charakterproben (Übergabe)

**Stand:** 1. November 2026 · **Status:** lokal umgesetzt, zur Abnahme durch die Projektleitung. Kein Push, kein Merge, kein Deployment, keine Migration, keine Produktivaktivierung, keine neuen Regelmechaniken.

| | |
|---|---|
| Anforderung | [GE-02-ANFORDERUNG-PROBENZENTRALE.md](GE-02-ANFORDERUNG-PROBENZENTRALE.md) (verbindlich laut Projektleitung) |
| Branch | `claude/ge-01c-ux` (Worktree `C:\Users\Stenz\Documents\ChroniPlay-Claude\cvk-ge01c`), baut auf GE-01C auf |
| Commits | `a462c4a` Funktion, `475cd12` und `9179d1f` Korrekturen, `3cf1aa4` und `c192f1b` Browsertest |
| Getesteter Build | Code-Stand `3cf1aa4` (danach nur Testdateien geändert), `BUILD_ID edc2383e-471d-43fe-860b-a7a48bae552a`, Chunk `regie-window-CcBMJjPI.js` MD5 `581b2a2ca447df86f039692f3e7cc05f` (Server und `dist` identisch) |
| Lokale Instanz | `http://127.0.0.1:8898` (`scripts/test-local.mjs --ge-01`, `CVK_TEST_PORT=8898`), synthetische Konten wie in GE-01C |

## 1. Umsetzung

**A – Vorbereitete Proben**
- Der Szenenbaustein „Probe“ hat ein optionales Teilobjekt `check` in `domain/story-scene.ts`:
  - Attribut und Fähigkeit als stabile W10-IDs
  - SG 2 bis 10
  - vorgesehene Figuren
  - private Folgen bei Erfolg, Fehlschlag und Patzer
- Es liegt im Szenen-JSON wie `pager` und `material`, daher **keine Migration**. Ältere Bausteine bleiben gültig.
- Eingabe in der vorhandenen Szenenvorbereitung (Spielleitung → Materialvorbereitung → Szenenbausteine). Die Kopfzeile zeigt „Geschick + Diebstahl · SG 7“.
- In der Regie unter „Proben“ stehen alle vorbereiteten Proben der Szene als Liste:
  - Mit vorgesehenen Figuren am Tisch reicht **ein Klick „Ausgeben“**.
  - Sonst übernimmt „Figur wählen“ die Werte ins Formular, und die SL tippt nur noch die Figur an.
  - Bereits ausgegebene Proben sind markiert.
- Alte Freitext-Proben werden weiter gelesen, als Rückfall über `parsePreparedCheck`.

**B – Spontane Proben**
- Pflicht sind nur Figur(en) oder „Ganze Runde“ und SG.
- Die Bezeichnung ist optional. Ohne Bezeichnung heißt die Probe nach ihren Eigenschaften oder einfach „Probe“.
- Eigenschaften leer bedeutet: Der Spieler wählt.

**Ein Weg für beide**
- Beide Arbeitsweisen bauen dieselbe `CheckSpec` und dasselbe `requestCheck` über `checkRequestBody` in `domain/live-checks.ts`.
- Das Formular baut keinen eigenen Request (per Test abgesichert).
- Würfeln, Pool, Ereignisse, Berechtigungen und der Three.js-/Rapier-Renderer sind unverändert der GE-01C-Pfad.

**Server** (`server/live-checks.ts`)
- `requestCheck` nimmt entweder eine Zielgruppe **oder** Zielfiguren (`targetCharacterIds`). Die Spieler leitet der Server aus den Besitzern der Figuren ab. Figuren ohne Spieler am Abend werden abgelehnt.
- `rollCheck` lässt nur die vorgesehene Figur würfeln.
- Folgen, Zielfiguren und Vorbereitungsherkunft sind SL-only in `liveEvents` und der Stage-Projektion.
- Spieler sehen bei Proben nie mehr andere Adressaten. Ihre Empfängerliste enthält nur noch sie selbst. Das ist die Härtung 2 aus dem Alpha-Konzept.

**Folgen am Ergebnis**
- In „Laufende Proben“ erscheint nach dem Wurf die vorbereitete Folge zum tatsächlichen Ausgang, etwa „Folge: Kein Zugriff; Schäfer bleibt arglos.“
- Das gilt nur für die SL.

**Modifikator-Register** (`domain/w10-modifier-register.ts`)
- Eine Liste aller Größen, die Pool oder SG verändern dürfen, jeweils mit Freigabestatus.
- Freigegeben: Attribut, Fähigkeit, Spezialisierung, Wundabzug, ungelernte Fertigkeit.
- Nicht freigegeben: persönlicher Stress, Gruppenstress, Hunger, Szenenbedingung, Willenskraft.
- Der Live-Pfad verweigert jeden Wurf, dessen Herkunftsangaben einen nicht freigegebenen oder unbekannten Eintrag enthalten, statt ihn still mitzurechnen.
- Die Regelarithmetik (`w10-selection`, `w10-core`) ist **unverändert**. Neue Mechaniken kommen zuerst hier als „nicht freigegeben“ hinzu.

## 2. Prüfungen (beobachtet)

| Prüfung | Ergebnis |
|---|---|
| TypeScript, ESLint (geänderte und neue Dateien) | 0 Fehler |
| Produktionsbuild (lokal) | bestanden |
| `tests/ge-02-check-desk.test.mjs` (neu) | 4/4: Schema, gleicher Request für beide Wege, Register gegen echte Previews, Server-Absicherungen |
| `tests/ge-01c-check-lifecycle.test.mjs` | 7/7 |
| Gesamtsuite `tests/*.test.mjs` + Prototyp | 521/522. Einziger Fehlschlag ist der bekannte Altfehler `npc-data.test.mjs`: nicht in `pnpm test`, auf der Basis 38e8c75 identisch |
| `tests/ge-01-integration.mjs` | PASS |
| `tests/ge-02-integration.mjs` (neu) | PASS. Abgedeckt: Zielgruppe und Figuren schließen sich aus; unbekannte Figur → 400; nur SL gibt aus; Figur B wird zu Spieler B; Folgen und Figur-IDs nicht bei Spielern; A sieht B's Probe nicht und darf sie nicht würfeln; vorbereitet und spontan liefern **gleichen Pool und gleiche Ereignisstruktur** |
| `tests/ge-02-browser.mjs` (aus dem GE-01C-Test weiterentwickelt) | 12/12, keine Seitenfehler: Szenenvorbereitung mit Feldern; Abruf in der Regie mit Wertübernahme; Spieler bestätigt im eigenen Bogen; Serverpool gleich Anzeige; ein Wurf; vorbereitete Folge in der Regie; keine Althinweise nach Reload; Replay ohne Neuwurf; spontane Probe ganze Runde „1 von 2“; **spontan nur Figur B + SG 5**; mobil; V20-Sperre; Rechte |

Handrechnung des letzten Laufs: 3 W10 (Geschick 3 + Diebstahl 0) gegen SG 8 (7 +1 ungelernt) mit 3, 2, 2 ergibt keinen Erfolg und keine Eins, also Fehlschlag. In der Regie erscheint passend „Folge: Kein Zugriff; Schäfer bleibt arglos.“

Screenshots aus dem getesteten Build (`docs/qa/ge-02/`):
[00 Szenenvorbereitung](../qa/ge-02/00-szenenvorbereitung-probe.jpg) · [01 Regie vorbereitete Proben](../qa/ge-02/01-regie-proben-vorbereitet.jpg) · [02 ausgegeben](../qa/ge-02/02-regie-probe-ausgegeben.jpg) · [03 Spieler](../qa/ge-02/03-spieler-neue-probe.jpg) · [04 Bogen und Pool](../qa/ge-02/04-spieler-bogen-auswahl-pool.jpg) · [05 Wurf](../qa/ge-02/05-spieler-wurf-ergebnis.jpg) · [06 Ergebnis mit Folge](../qa/ge-02/06-regie-wurf-abgeschlossen-folge.jpg) · [07 Reload](../qa/ge-02/07-spieler-nach-reload-ruhig.jpg) · [08 Würfelprotokoll](../qa/ge-02/08-wuerfelprotokoll.jpg) · [09 B freie Wahl](../qa/ge-02/09-spieler-b-freie-wahl.jpg) · [10 1 von 2](../qa/ge-02/10-tischregie-teilweise-gewuerfelt.jpg) · [10b Figur + SG](../qa/ge-02/10b-spontan-figur-und-sg.jpg) · [11 mobil](../qa/ge-02/11-mobil-probe-im-bogen.jpg) · [12 V20-Sperre](../qa/ge-02/12-v20-sperre-kenntnis-ohne-wert.jpg)

## 3. Abgleich mit der Vorgabe

| Vorgabe | Stand |
|---|---|
| Zentrale Steuerung in der bestehenden Regie, ohne Modulwechsel | Bereich „Proben“: vorbereitete Liste, neue Probe und laufende Proben an einer Stelle |
| A: Bezeichnung, Eigenschaften, Schwierigkeit, optionale Konsequenzen in der Szenenvorbereitung | umgesetzt, Bild 00 |
| A: abrufen, Figuren wählen oder bestätigen, freigeben | umgesetzt, Bild 01; „Ausgeben“ in einem Klick bei vorgesehenen Figuren |
| B: einfachste Variante Charakter + SG | umgesetzt, Bild 10b und Integrationstest |
| Spieler: Bogen oben, markieren oder bestätigen, selbst würfeln | GE-01C-Ablauf, Bilder 03 bis 05 und 09 |
| Server berechnet Pool aus autorisierten Werten und freigegebenen Modifikatoren | Regelkern unverändert; Register-Sperre gegen nicht freigegebene Einträge |
| Hunger, Stress, Gruppenstress, Szenenbedingungen später über dieselbe Berechnung | als „nicht freigegeben“ im Register vorgesehen, **nicht aktiv** |
| Keine getrennte Würfelberechnung | ein `requestCheck`, ein `rollCheck`, ein Renderer; Gleichheit per Integrationstest |
| Keine Produktivaktivierung | weiterhin nur `GE01_CHECKS=local-only` in der lokalen Testinstanz |

## 4. Prüfgrenzen und offene Punkte

1. Der **Ein-Klick-„Ausgeben“** vorbereiteter Proben mit hinterlegten Figuren ist im Browser nicht durchgespielt. Das Fixture kennt die Figuren-IDs beim Anlegen der Szene noch nicht. Der Serverweg ist per Integrationstest belegt, die Anzeige „Figur live wählen“ und der Formularweg im Browser.
2. **Befund außerhalb des Auftrags:** `npc-data.test.mjs` („NPC workspace uses read panel …“) schlägt weiterhin fehl. Der Test steht nicht in `pnpm test` und fiel schon auf der Basis 38e8c75 aus; er wurde nicht verändert.
3. Ein Szenenbaustein, der eine Figur vorsieht, die später den Spieler wechselt oder entfernt wird, zeigt im Editor „nicht mehr aktiv“ mit „Entfernen“, nach dem Vorbild des Pagers. In der Regie erscheint „vorgesehene Figur nicht am Tisch“.
4. Die offenen Punkte aus GE-01C, Abschnitt 5, bestehen weiter:
   - Text „Pool wird berechnet“ bei einer Sperre
   - Überlappung mobil
   - keine Prüfung auf echtem Gerät
5. Eine zweite Spielleitung am Tisch würde als Figurbesitzerin gelistet, wenn sie eine Figur hat; der Server lehnt ihren Wurf ab (unverändert).

**Ausdrücklich nicht getan:** kein Push, kein PR, kein Merge, kein Deployment, keine Migration, keine Remote-D1-Befehle, keine Aktivierung von Hunger, Stress, Gruppenstress, Szenenbedingungen oder Willenskraft. Die Codex-Instanz auf Port 8895 blieb unberührt.
