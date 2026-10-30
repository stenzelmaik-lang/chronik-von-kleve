# Spieler- und Charakterverwaltung 3.0 – Qualitätssicherung und Überarbeitung

Stand 30.10.2026. Branch `claude/charakterverwaltung-3` auf Basis des Codex-Stands `cd25b96` (Branch `codex/charakterverwaltung-3`, nicht gepusht). Nur lokal: kein Push, keine PR, kein Deployment, keine Migration, keine produktiven Daten. Der Codex-Bericht `Spieler-und-Charakterverwaltung-3.md` bleibt als Vorgeschichte gültig, soweit dieser Bericht nichts anderes sagt.

## 1. Befund am Codex-Stand (im Browser geprüft)

Die Serverlogik war weitgehend vorhanden und sauber abgesichert (Bogenkorrektur ohne Budgets, Bestandsübernahme, Rechte, XP-Verlauf, Audit). Die Mängel lagen vor allem in Ablauf und Bedienung:

| # | Mangel | Wirkung |
|---|---|---|
| M1 | Bestandsübernahme, Rechte und XP-Korrektur lagen in eingeklappten Blöcken; zwei konkurrierende Einstiege („SL-Werte ändern“, „Bogen als SL bearbeiten“) plus eine dritte Einzelwert-Korrektur | Ablauf für die SL nicht erkennbar |
| M2 | Bogeneditor als Formular mit Zahlenfeldern, ohne Papierbogen-Struktur, Dialog nicht höhenbegrenzt | unübersichtlich, Speichern nicht immer sichtbar |
| M3 | Die Übernahme fror den Bogen **vor** dem Nachtrag als Ausgangsstand ein | spätere Nachträge des Spielers fehlten im belegten Ausgangsstand |
| M4 | Kein Weg für Spieler, einen freigegebenen Nachtrag als fertig zu melden | SL musste außerhalb der App nachfragen |
| M5 | Werteleiste (Blut/Willenskraft) klebte mit `top:144px`, obwohl der Kopf nicht mitläuft | Inhalt schob sichtbar darunter durch („schiebt mit“) |
| M6 | Spielerprofil öffnete sich unterhalb der Kartenreihe; SL selbst als „Spieler“ mit 0 Akten | Seite sprang, Liste verrutschte |
| M7 | Disziplinen/Hintergründe nur als Zahl, Menschlichkeit/Willenskraft/Blut nicht als Punkte/Kästchen, fehlende Werte als 0 | Werte schlecht ablesbar, Lücken nicht erkennbar |
| M8 | Hero-Schaltfläche „Bogen bearbeiten“ für Spieler mit SL-Freigabe gesperrt | Freigabe wirkte nicht |
| M9 | Nach dem Speichern sprang die SL-Ansicht an den Seitenanfang; der Verlauf verschwand bis zum nächsten Laden | Orientierung ging verloren |
| M10 | Charakterauswahl der Spieler: Namen liefen ohne Abstand ineinander | Darstellungsfehler |

Kernproblem Bestandscharaktere: Gespielte Papierbögen liegen erwartbar über dem V20-Erschaffungsrahmen (beim Referenzcharakter z. B. Attribute 7/6/4 statt 7/5/3, Disziplinen 4 statt 3). Über den Erschaffungsweg sind sie deshalb nicht abbildbar. Der Weg führt über die Bestandsübernahme ohne Budgets. Diesen Weg hat die Oberfläche bisher nicht geführt.

## 2. Umgesetzte Verbesserungen

**Ein Ablauf für Bestandscharaktere** (Status sichtbar als Leiste: Erfasst → Nachtrag → SL-Prüfung → Im Spiel):
1. SL öffnet in „Freigaben“ für genau diesen Charakter „Spieler darf Bogen bearbeiten“ (oder trägt selbst nach).
2. Spieler trägt im Bogen-Editor ohne Punktebudget nach und meldet „Nachtrag fertig · SL informieren“ (neue Aktion `catch_up_done`, ändert keine Werte/XP).
3. SL übernimmt mit einem Schritt: verfügbare XP laut Bogen, optional bisher erhalten/verbraucht, Beleg und Grund. Optional zugleich freigeben und Spielerbearbeitung beenden (`historical_import` mit `confirm`/`closeEditing`). Der Ausgangsstand wird bei der ersten Freigabe aus dem nachgetragenen Bogen gebildet (M3 behoben).

**Bogen-Editor** (`character-sheet-editor.tsx`): Aufbau wie der V20-Papierbogen (Identität, Attribute, Fähigkeiten inkl. freier Zeilen, Disziplinen/Hintergründe/Tugenden mit Überzeugung/Instinkt, Menschlichkeit/Pfad, Willenskraft, Blutvorrat, Vorzüge/Schwächen, Clansschwäche). Punkte werden angeklickt, Werte über 5 sind umschaltbar. Kopf, Bereichsnavigation und Fußleiste sind fest, nur der Bogen scrollt. Die Fußleiste zeigt geänderte Bereiche und den Vergleich mit dem Erschaffungsrahmen (nur zur Orientierung, keine Sperre, keine XP-Umrechnung). Nicht erfasste Zahlen bleiben leer statt erfunden.

**SL-Verwaltung** (`character-admin.tsx`): Karten statt Klappblöcke. Charakterbogen, Prüfung (freigeben/zurückgeben), Bestandsübernahme, Freigaben (Spielbetrieb, Spielerbearbeitung als Schalter, Entwicklung direkt/Antrag/gesperrt), Erfahrung (erhalten/verbraucht/verfügbar, Vergabe, Korrektur/Rücknahme einer Vergabe, Buchungsliste), Kontakt (vorhandenes Briefsystem) und Verlauf mit lesbaren Vorher/Nachher-Änderungen. Doppelte Einzelwert- und Textkorrektur entfernt (der Editor deckt beides ab), Anträge/SL-Notiz/Regelausnahmen bleiben.

**Spielerprofile**: feste Zweispaltigkeit (Liste links, Profil rechts; auf dem Handy springt die Ansicht zum Profil). Charakterkarten mit Status, Clan, verfügbaren XP, Bearbeitungs- und Entwicklungsfreigabe, Hinweis „wartet auf dich“ und direkten Schaltflächen „Bogen ansehen“/„Verwalten“. SL ohne Akten wird nicht als Spieler gelistet.

**Bogenanzeige** (gilt auch für Spieltisch-Leseansicht und Command-Center-Karte, da gemeinsame Bausteine): Disziplinen, Hintergründe und freie Fähigkeiten als Punkte; Menschlichkeit/Pfad und Willenskraft als Punkte, Blutvorrat als Kästchen; deutliche Kreise statt kleiner Glyphen; fehlende Attribute/Tugenden als „Noch nicht erfasst“. Identität ist immer sichtbar wie der Kopf des Papierbogens. Die Spieltisch-Dateien selbst wurden nicht verändert.

**Layout**: Werteleiste klebt mit 8 px Abstand bzw. in der SL-Inspektion gar nicht (M5). Die Scrollposition bleibt nach dem Speichern erhalten (M9). Charakterauswahl als Karten (M10). Ohne horizontalen Überlauf bei 375 px.

## 3. Regeln und XP

Grundlage bleibt das Drive-Dokument „Erfahrungs- & Belohnungssystem der Kleve-Chronik“ (Attribut ×4, Fähigkeit neu 3/×2, Clansdisziplin ×5, fremde ×7, Tugend/Menschlichkeit ×2, Willenskraft ×1) sowie die V20-Erschaffungswerte (7/5/3, 13/9/5, 3, 5, 7, 15 Freebies). Regelhierarchie laut SL: **Hausregel vor offiziellem V20-Regelbuch**, für die Erschaffung die V20-Erschaffungsregeln. Bei gespielten Bögen gilt, was auf dem Bogen steht. Daraus folgt für Fälle ohne Hausregel:
- **Neue Disziplin (0→1): 10 XP.** Clansdisziplinen lernt der Spieler im Rahmen seiner Entwicklungsfreigabe. Eine clansfremde neue Disziplin ist serverseitig nur per Antrag mit SL-Genehmigung möglich (V20: Lehrer erforderlich), auch bei direkter Entwicklungsfreigabe. Nur Namen aus dem V20-Disziplinkatalog. „Geschwindigkeit“ (Assamiten-Bezeichnung für Celerity) wird neben „Schnelligkeit“ nicht zusätzlich angeboten.
- **Hintergründe:** V20 kennt dafür keinen XP-Preis; sie wachsen über das Spielgeschehen. Sie bleiben per XP gesperrt; die SL trägt sie im Bogen-Editor ein.
- **Pfade (Thaumaturgie/Nekromantie):** neuer Pfad 7 XP, nur per Antrag mit SL-Genehmigung (Lehrer). Sekundärpfade aktueller Wert ×4, höchstens bis zum Primärpfad. Der Primärpfad entspricht dem Disziplinwert und steigt mit der Disziplin; er ist nicht einzeln käuflich. Im Bogen-Editor gibt es eine Pfad-Liste mit Kennzeichen „Primär“.
- **Caitiff:** jede Disziplin aktueller Wert ×6 (aus dem Bogen abgeleitet, nicht vom Client übernommen).
- **Rituale:** V20 nennt keinen festen XP-Preis; sie bleiben SL-Entscheidung und werden im Bogen notiert.
- Hinweis: Das V20-Regelwerk-PDF im Drive ist ein Bildscan ohne Textebene. Die V20-Werte stammen aus der Standard-Erfahrungstabelle der Jubiläumsausgabe und sollten bei Gelegenheit am Buch gegengelesen werden.

Historische Gesamt- und Verbrauchswerte bleiben „?“, solange sie nicht belegt sind. Die drei Felder erhalten/verbraucht/verfügbar sind immer sichtbar. Doppelte Eröffnung, doppelte Gegenbuchung und negativer Saldo bleiben serverseitig ausgeschlossen.

## 4. Referenzcharakter

Abgleich Originalbogen ↔ gespeicherter Stand ↔ Anzeige ausschließlich privat in `.local-work/character-3/` (ignoriert). Bei Disziplinen und einem Hintergrund wich die sichtbare Bogenseite von Codex' privatem Formularfeld-Abgleich ab. Entscheidung der SL: Es gilt die sichtbare Bogenseite (entspricht dem gespeicherten Stand). Lokal wurden zusätzlich die Bogenwerte für Blut pro Runde, aktuelle Willenskraft und Blut übernommen. Es wurde nichts an Produktionsdaten geändert.

## 5. Prüfergebnisse

| Prüfung | Ergebnis |
|---|---|
| Einzel-/Regressionstests (`pnpm test`) | 173/173 bestanden (neu: Erschaffungsrahmen-Vergleich, neue Disziplin, Celerity-Doppelname, Caitiff, Pfade) |
| Vollständige Integration, frische lokale D1 mit allen Migrationen | Exit 0, 1.924 Prüfungen bestanden, darunter 26 neue (u. a. neuer Pfad nur per Genehmigung für 7 XP, Primärpfad nicht einzeln käuflich, neue Clansdisziplin direkt, fremde nur per SL-Genehmigung, Hintergrund ohne XP-Preis, (Nachtrag, Meldung, Übernahme+Freigabe in einem Schritt, doppelte Eröffnung, geschlossene Bearbeitung, keine SL-Daten beim Spieler, fremder Spieler) |
| Browserabnahme (`tests/character-management-browser.mjs`, Edge headless) | 10/10: Profil → Bogen, Abbrechen ohne Schreiben, Punkte über 5, Freigabe, Spielernachtrag + Meldung, Übernahme+Freigabe, XP vergeben/zurücknehmen, Spieler B ohne Zugriff, 1440 px und 375 px ohne Überlauf, keine JS-Fehler |
| Typecheck, ESLint der geänderten Dateien, Produktionsbuild | bestanden |
| Manipulationsversuche Spieler A per API (XP, Rechte, Übernahme, Freigabe) | 403; Spieler B auf fremde Akte 404 |

## 6. Lokale Abnahme

```powershell
cd <Worktree cvk-charakter-3>
.\scripts\start-charakter-3.ps1 -Build   # beim ersten Mal bzw. nach Codeänderungen
.\scripts\start-charakter-3.ps1          # danach
```

Adresse `http://127.0.0.1:8846/sl/command-center?bereich=charaktere`, eigener Speicher `.local-test/charakter-3` (bleibt erhalten). Nur synthetische Konten `command-gm@`, `command-a@`, `command-b@example.invalid` (Kennwort im Testfixture). Ein privater Referenzcharakter wird nur geladen, wenn die ignorierte Datei `.local-work/character-3/referenz-local.json` vorhanden ist.

1. SL → Spieler & Charaktere → Spieler A → Referenzcharakter „Verwalten“.
2. „Bogen bearbeiten“: Lücken nach Papierbogen eintragen (Tugenden, Menschlichkeit, Willenskraft, Blut, Hintergründe, Clansschwäche), Grund angeben, speichern. Verlauf zeigt Vorher/Nachher.
3. „Bestehenden Charakter übernehmen“: verfügbare XP, Beleg, Grund → „Bestand übernehmen und freigeben“.
4. „Erfahrung“: XP vergeben, eine Vergabe über „Korrigieren“ zurücknehmen.
5. „Freigaben“: Spielerbearbeitung erlauben, Entwicklung wählen, speichern.
6. Abmelden, als Spieler A anmelden → Charakter → Entwicklung: Bogen bearbeiten bzw. „Nachtrag fertig“. Als Spieler B ist die Akte nicht sichtbar.
7. Zurück als SL: Profil zeigt „wartet auf dich“, Verwaltung zeigt Schritt „SL-Prüfung“; freigeben. Nach Neustart sind alle Änderungen gespeichert.

Browserabnahme erneut ausführen (Instanz läuft): `CVK_PLAYWRIGHT_MODULE=<playwright/index.mjs> CVK_PLAYWRIGHT_CHANNEL=msedge node tests/character-management-browser.mjs`.

## 7. Offen

- Rituale: bewusst ohne XP-Preis (SL-Entscheidung).
- Bereichsnavigation im Editor markiert den aktuellen Abschnitt nur beim Anklicken, nicht beim Scrollen.
- Spieltisch-Leseansicht profitiert von den gemeinsamen Bausteinen; eigene Gestaltung des Spieltisch-Bogens bewusst nicht angefasst (paralleler Branch `claude/spieltisch-medien`).
- Produktion: keine Migration nötig (alles im bestehenden Charakter-JSON). Vor Übernahme in Produktion fachliche Abnahme durch den Projektinhaber.
