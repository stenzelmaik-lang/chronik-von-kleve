# ChroniPlay Hybrid – W10-Regel-Engine: vollständige Auflösungs- und Integrationsspezifikation

**Dokument-ID:** CP-RULES-W10-001  
**Version:** 1.0 – fachlicher Architektur- und Prüfentwurf (keine Produktionsfreigabe)  
**Datum:** 31.10.2026  
**Regelprofil:** `chroniplay-hybrid-v20-base@1.0.0-draft`  
**Projekt:** ChroniPlay / Chronik von Kleve  
**Zielgruppe:** Spielleitung, UX-/Systemplanung, Claude Code, QA, Regelredaktion

> **Leseregel / Vertrauensniveau:** Dieses Dokument ist eine gründliche *Implementierungsspezifikation* für die W10-Kernengine und ein **Vollständigkeits- und Abnahmerahmen** für V20-Inhalte. Es ist **keine vollständige, zertifizierte Transkription aller V20-/V5-Regelbücher** und kein Ersatz für die lizenzierten Bücher. Eine zuverlässige Vollautomatisierung *aller einzelnen* Disziplinen, Pfade, Rituale, Vorzüge, Nachteile, Kampftechniken und Quellenbücher erfordert ein separates, quellenverifiziertes Regelregister je Fähigkeit. **Ungeprüfte Regeln werden nicht geschätzt, sondern gesperrt bzw. der SL zur Entscheidung vorgelegt.** Für Produktivcode gelten nur Regeln mit `approved`-Status.

---

## Inhaltsverzeichnis

1. Auftrag, Grenzen und Quellen
2. Normative Prioritäten, Begriffe und Versionsstrategie
3. Würfelpool aus Charakterbogen und Aktionen
4. V20-W10-Kern: mathematisch präzise Regeln
5. Würfelarten: normal, Hunger, Stress
6. Probetypen und spezielle Auflösungspipelines
7. V20-Sonderfälle und Ausschlussregeln
8. ChroniPlay-Hybrid: Hunger / Erweckungsproben
9. ChroniPlay-Hybrid: persönlicher Stress
10. Willenskraft, Kosten und weitere Ressourcen
11. Kampf, Schaden, Absorption und Zustände
12. Disziplinen, Pfade, Rituale und Sonderfähigkeiten – Registry-Architektur
13. Ergebnisautomatik, Szeneneffekte und SL-Zuständigkeit
14. Zustandsmaschine, Persistenz, Sicherheit, Synchronisierung
15. Datenschemata und Rechenalgorithmus
16. Testvektoren und Property-Tests
17. Regelabdeckung und Audit-Katalog
18. Umsetzungsetappen, Abnahmekriterien und Stop-Gates
19. Quellenregister und unverbindliche offene Entscheidungen

---

## 1. Auftrag, Grenzen und Quellen

### 1.1 Verbindliche Projektentscheidungen

- Basis ist die **deutsche V20-W10-Auflösung**: Würfel mit Ergebnissen >= Zielschwierigkeit sind Erfolge, Einsen löschen erwürfelte Erfolge. V5-Schwierigkeiten als *Anzahl benötigter Erfolge* werden **nicht** zur Kernmechanik.
- Attribut/Fähigkeit und weitere Werte kommen lesend aus dem **autoritativen Charakterbogen**; es gibt keinen zweiten Spieler-Würfelzähler.
- **Persönlicher Stress** wird durch gültige Proben und zulässige Entspannungsaktivitäten automatisch verwaltet.
- **Gruppenstress** (bisherige Leiste 0–10) ist eine **ausschließlich durch SL-Aktionen kontrollierte** andere Ressource. Ein persönlicher Patzer verändert Gruppenstress niemals selbständig.
- Die **3D-Würfelschale** ist Präsentation: Sie berechnet keine fachlichen Ergebnisse. Genau ein autoritativer Wurf wird an alle Berechtigten verteilt.
- Ein geworfener, offener Wurf bleibt sichtbar, bis er bewusst lokal versteckt bzw. durch die SL gemeinsam geschlossen wird. Keine Zeitschließung.
- Automatische Wirkung nur bei explizit freigegebenen, versionierten Effekten. Unbekannte Mechanik: `pending_rules_review`, nicht „nach bestem Wissen“ vollstrecken.

### 1.2 Tatsächlich eingesehene Primär-/Projektunterlagen

- **Vampire: Die Maskerade Jubiläumsausgabe** (deutsche V20-Ausgabe), private Google-Drive-Kopie: Kapitel 3 (Eigenschaften / Spezialisierungen), Kapitel 4 (Disziplinen), **Kapitel 5 S. 245–255** (Würfel), Kapitel 6 (Kampf, Schaden, Willenskraft), Kapitel 7 (Moral) und Anhang. Quelle: `https://drive.google.com/file/d/1myQ_5Nb6SrfCNZq55v7xb7EgKNxneyEu/view`.
- **V:tM V20 Kernregeln für Spielleiter**, Arbeitszusammenfassung, Google Drive: `https://docs.google.com/document/d/1jhTf3jXFn51gKvsR2kaOlMZuur4-FiL8jc8gn2o1rJA/edit`. **Achtung: Diese Zusammenfassung enthält in der Botch-Formulierung eine Inkonsistenz und ist keine höchste Regelautorität.**
- **Stress-Regel – Spielerhandout** / **Stress- & Bonus-Matrix (SL-Only v2)**, historische Dokumente von 2025; keine Belege für aktuelle Entwicklungsversion. `https://docs.google.com/document/d/1IzxykSEhrxuoCQ9oyUHndjCyW8HFWrlyGLmbkp_KNHM/edit`, `https://docs.google.com/document/d/1zM4EVyCbPniNnGEpSfWd9lG-V5KcN4j9s8QIEBOUCYI/edit`.
- **ChroniPlay W10 v1.2** – `START-HIER.md` und `02-FUNKTION-UND-SYNCHRONISATION.md` (Google Drive, Stand 27.10.2026). Bestehende Würfel-UI und Session-Synchronisation weiterverwenden.
- **ChroniPlay Character Engine 2.0 – Etappe A Architekturbericht**, 28.09.2026 (Google Drive): bestehende `records`-/Entity-Identität, `app/api/character-runtime/route.ts`, getrennte Werte und Projektions-APIs. **Nur historischer Projektbericht, keine aktuelle Codeinspektion.**
- V5-Regelgrundlage / freie Regeln zu Hunger und Erweckungsproben: `https://app.roll20.net/compendium/vtm/Rules%3ARouse%20checks%20and%20using%20the%20Blood`.
- Rechte- und Veröffentlichungshinweis: `https://www.paradoxinteractive.com/games/world-of-darkness/community/dark-pack-agreement`.

### 1.3 Abgedeckt versus nicht behauptet

**Hier spezifiziert:** generische V20-Würfelmathematik, Wurfklassen, Combat-Pipeline als Interface, V5-inspirierte Zusatzwürfel, Ressourcenschnittstellen, Stress, Zuständigkeiten, Eventmodell und breite automatisierte Testfälle.

**Nicht durch diese Datei allein vollständig freigegeben:** jede einzelne V20-Disziplinstufe (einschließlich Elder Powers), alle Thaumaturgie-/Nekromantie-/Blutmagiepfade und Rituale, sämtliche Blutlinien, **alle** Vorzüge/Schwächen, Clanbesonderheiten, Ausrüstungswerte und Quellenbücher. Diese dürfen erst durch den in Abschnitt 12/17 definierten Regelkatalog aktiviert werden. So wird keine falsche „Vollständigkeit“ behauptet.

---

## 2. Normative Prioritäten, Begriffe, Versionsstrategie

**Regelhierarchie:** 1. ausdrücklich freigegebene ChroniPlay-Produktregel; 2. bestätigte Chronik-von-Kleve-Hausregel; 3. *verifizierte* deutsche V20-Kernregel; 4. V5-Mechanik, die ausdrücklich als Hybridregel übernommen wurde; 5. sonstige Quellen **nur nach Freigabe**. Historische Texte und Vorschläge sind nie automatisch maßgeblich.

**Jede Regel muss nachweisbar besitzen:** `ruleId`, `version`, `sourceType` (`v20_core|v20_supplement|v5_core|hybrid_house`), `bookEdition`, `sourceLocation`, `licenseScope`, `status` (`draft|source_checked|peer_reviewed|approved|deprecated`), `testIds`, `authorOfApproval`, `approvedAt`.

**Begriffe:**

- `rawSuccesses`: Summe der erwürfelten Erfolge **vor** 1er-Abzug, inklusive möglicher 10er-Spezialisierungsboni.
- `rawSuccessDice`: **Anzahl einzelner W10**, die die Schwierigkeit erreichen (wichtig für die V20-Patzerdefinition).
- `ones`: Zahl aller gewürfelten Einsen aus den für diesen Wurf zugelassenen Würfelarten.
- `netRolledSuccesses`: `max(0, rawSuccesses - ones)`.
- `guaranteedSuccesses`: getrennt erfasste automatische Willenskraft-/Regeleffekte; Einsen löschen sie **nicht**.
- `totalSuccesses`: `netRolledSuccesses + guaranteedSuccesses`.
- `requiredSuccesses`: benötigte Erfolge für die konkrete Aktion; in V20 meist 1, bei Sonderaktionen/erweiterten Prüfungen auch höher. **Nicht** mit der Schwierigkeit des Einzelwürfels verwechseln.
- `strictV20Botch`: `rawSuccessDice === 0 && ones >= 1` bei einer **botch-fähigen** regulären Probe, außer eine andere verbindliche Regel verhindert/überstimmt den Patzer.
- `mechanicalOutcome`: `success|failure|botch|inapplicable|pending_opposition|blocked`.
- `narrativeFlag`: z.B. `BESTIAL_FAILURE`, `BEAST_TAINTED_SUCCESS`, `STRESS_REACTION` – Flags ändern nicht ungeprüft den mechanischen Wurfausgang.

**Regelsatz pro Spiel/Charakter:** `rulesetId`, `rulesetVersion`, ggf. `disciplineCatalogVersion`. Ein Wurf speichert diese Versionen dauerhaft. Regelupdates dürfen vergangene Würfe und Kosten nicht rückwirkend umdeuten.

---

## 3. Würfelpool aus Charakterbogen und Aktionen

### 3.1 Normalfall und Ausnahmen

`basisPool = Attribut + Fähigkeit` ist Standard. Dies ist **keine universelle Formel**: reine Attributwürfe, Willenskraft, Tugend-/Moraltests, Disziplin- oder Widerstandswürfe können andere Felder oder feste Pools verwenden. Spezialwürfe erhalten **explizite Definitionen** statt künstlich ausgewählter Fähigkeit.

**Beispiel:** Geschick 3 + Nahkampf 2 = 5 W10. Würfelpooländerungen durch Wunden, Ausrüstung, Disziplinen, Zustände, Gruppenstress, Szeneneffekt, Aktionsteilung usw. folgen einer nachvollziehbaren Modifikatorpipeline.

### 3.2 Vollständiger V20-Bogen als Entitätsklassifikation

**Attribute (9):** Körperkraft, Geschick, Widerstandsfähigkeit; Charisma, Manipulation, Erscheinungsbild; Wahrnehmung, Intelligenz, Geistesschärfe. Normalisierte Schlüssel bevorzugen `strength`, `dexterity`, `stamina`, `charisma`, `manipulation`, `appearance`, `perception`, `intelligence`, `wits`. Namensabbildung aus der jeweils genutzten deutschen Ausgabe überprüfen.

**Fähigkeitsgruppen (V20-Grundbogen; je 10):**

- **Talente / Talents:** Alertness (Aufmerksamkeit), Athletics (Sportlichkeit), Awareness (Magiegespür), Brawl (Handgemenge), Empathy (Empathie), Expression (Ausdruck), Intimidation (Einschüchtern), Leadership (Führungsqualitäten), Streetwise (Szenekenntnis), Subterfuge (Ausflüchte).
- **Fertigkeiten / Skills:** Animal Ken (Tierkunde), Crafts (Handwerk), Drive (Fahren), Etiquette (Etikette), Firearms (Schusswaffen), Melee (Nahkampf), Performance (Vortrag), Larceny (Diebstahl), Stealth (Heimlichkeit), Survival (Überleben).
- **Kenntnisse / Knowledges:** Academics (Akademisches Wissen), Computer (Computer), Finance (Finanzen), Investigation (Nachforschung), Law (Recht), Technology (Technologie), Medicine (Medizin), Occult (Okkultismus), Politics (Politik), Science (Naturwissenschaften).

**Pflicht für Character Engine:** stabile Feld-IDs statt Abgleich nach Übersetzungsstrings; zusätzlich freie/custom Fähigkeiten mit Einordnung, Probe-Permissions und Quelle. Abweichende Übersetzungen werden als UI-Aliasse geführt, nicht als unterschiedliche Werte. **Die genauen deutschen Labels sind vor UI-Freigabe gegen den konkreten Charakterbogen abzugleichen.** V20 verwendet im Kernbogen ausdrücklich **Diebstahl (`larceny`)** und **Technologie (`technology`)** – nicht die abweichenden älteren Listen mit `security`/`linguistics`. Zusätzliche frei gewählte Talente, Berufsfertigkeiten und Fachgebiete benötigen eigene Registry-IDs. Bei *Handwerk* und *Technologie* verlangt das Regelbuch eine inhaltliche Spezialisierung/Fachrichtung schon beim Gebrauch; **das bedeutet nicht**, dass eine mechanische 10er-Doppelwertung ohne den allgemeinen Spezialisierungsanspruch (Eigenschaft 4+) entsteht.

### 3.3 Ungelernt, Spezialisierung, unzulässige Pools

- Talente ohne Punkte: gewöhnlich ohne alleinige Ungelernt-Strafe nutzbar, soweit keine Sonderregel eingreift.
- Fertigkeiten ohne Punkte: **+1 auf die V20-Zielschwierigkeit** (nach Kappungsregeln).
- Kenntnisse ohne Punkte: regulär **keine Probe ohne Begründung/ausdrückliche Ausnahme** (die Engine zeigt `blocked: KNOWLEDGE_UNTRAINED`; nicht still mit 0 Würfeln werfen).
- Eigenschaften/Fähigkeiten ab 4 können eine passende Spezialisierung erhalten. **Bei einem anwendbaren, bestätigten Spezialisierungsbezug zählt jede gewürfelte 10 als zwei Erfolge statt einem**. Eine 10 ist aber weiterhin **nur ein** erfolgreiches Würfelergebnis für die `rawSuccessDice`-Patzerprüfung.
- Bei Pool 0: `blocked: NO_DICE`, sofern die konkrete Regel nicht ausdrücklich einen anderen Ablauf erlaubt. Es wird **kein verdeckter 1W10-Ersatz** erfunden.
- Höhere Attribute, Sonderpoolwerte oder Elder Powers können über gewöhnliche Bereiche hinausgehen. Keine willkürliche globale Poolobergrenze 10. Bei Moral-/Willenskraftwerten mit eigener Skala keine inkompatiblen Werte dazurechnen.

### 3.4 Modifikatorpipeline

1. Aktuelle genehmigte Charakterrevision und Rechts-/Szenenkontext lesen.
2. Probentyp/Profil bestimmen: `ordinary|opposed|extended|combat_attack|damage|soak|moral|frenzy|courage|discipline|rouse|resistance|initiative|custom`.
3. Grundpool aus einer **konfigurierten** Formel ableiten.
4. Bonifikationen/Mali zum Pool anwenden (Wunden, Ausrüstung, aktive Disziplinen, Zustände, kombinierte Aktionen, Umwelt, Clanregeln).
5. Basis-SG aus SL-Aufforderung oder Regeldefinition; modifizieren nach Fertigkeit 0, Umwelt, Ziel, Stress etc.; V20 SG zwischen 2 und 10; kein stilles Aufweiten auf 11.
6. Zusätzliche Erfolge, Wiederholungen, Erfolgsgrenzen und Spezialwürfe als typisierte Effekte anhängen.
7. Negative Pools/unsinnige Kombinationen ablehnen; keine Werte im Bogen verändern.
8. Berechnung zusammen mit `base`, `modifiers[]`, `effective`, `provenance` für alle Berechtigten nachvollziehbar speichern.

**Modifikator-Policy:** Im Feld `stackingGroup` und `stackingPolicy` genau festlegen, ob Boni addieren, den höchsten Wert verwenden oder sich gegenseitig ausschließen. Wund-, Stress- und Gruppenstressmodifikatoren nicht doppelt anwenden, auch wenn sie aus Charakterbogen und Szenenservice stammen.

---

## 4. V20-W10-Kern – verbindlicher Algorithmus

### 4.1 Schwierigkeit und Ergebnis

- Reguläre Schwierigkeit = **Zielzahl eines einzelnen W10**: 2–10, Standard 6, gebräuchlich 3–9. **Nicht** benötigte Erfolge.
- Jedes W10 >= `difficulty` zählt 1 Erfolg; unter aktivierter Spezialisierung zählt eine 10 **2** Erfolge.
- Jede geworfene 1 streicht **einen erwürfelten** Erfolg. Die Zahl kann nicht unter 0 fallen.
- **Patzer** genau dann, wenn **keiner der Würfel einen Erfolg erzielt** und **mindestens eine 1** zeigt und die Würfelklasse patzen darf. Mehr 1er als Erfolge bedeutet **keinen Patzer**, wenn überhaupt ein Würfel erfolgreich war.
- Ohne garantierte Erfolge: `totalSuccesses >= requiredSuccesses` => mechanischer Erfolg, sonst Fehlschlag oder Patzer.
- Ein garantierter Willenskraft-Erfolg wird **nicht** durch Einser gestrichen. Er verhindert, sofern anwendbar, einen vollständigen Fehlschlag. Vor dem Wurf deklarieren; nicht nachträglich einsetzen.
- Niedrige Ergebniszahl als Grad anzeigen, aber nicht „außergewöhnlichen Erfolg“ anstelle einer Fähigkeitsschwelle erfinden. Resultattabellen einzelner Disziplinen haben Vorrang.

### 4.2 Beispielvektoren

| W10 | SG | rawSuccessDice | rohe Erfolge | 1er | Netto | Resultat |
|---|---:|---:|---:|---:|---:|---|
| `[3,8,7,10]` | 6 | 3 | 3 | 0 | 3 | Erfolg |
| `[1,7]` | 6 | 1 | 1 | 1 | 0 | **Fehlschlag, kein Patzer** |
| `[1,1,4,5]` | 6 | 0 | 0 | 2 | 0 | **Patzer** |
| `[2,3,4,5]` | 6 | 0 | 0 | 0 | 0 | Fehlschlag |
| `[10,1]`, passende Spezialisierung | 6 | 1 | 2 | 1 | 1 | Erfolg |
| `[10,1]`, ohne Spezialisierung | 6 | 1 | 1 | 1 | 0 | Fehlschlag |
| `[1,1,1,9]` | 6 | 1 | 1 | 3 | 0 | Fehlschlag, **kein Patzer** |
| `[7,8]` | 9 | 0 | 0 | 0 | 0 | Fehlschlag |
| `[10,1,2]`, WP vorab +1 garantiert | 6 | 1 | 1 | 1 | 1 (garantiert) | Erfolg |

**Grenzfall Spezialisierung:** Doppelte 10er-Erfolge sind mathematisch Erfolge, aber die `rawSuccessDice`-Bedingung für Patzer betrachtet die Zahl der tatsächlich mindestens einmal erfolgreichen Würfel. Bei Hausregel-Sonderwürfeln ohne normale Erfolgseigenschaft wird niemals automatisch ein Erfolg angenommen.

### 4.3 Automatischer Erfolg ohne Würfeln

V20 sieht in unbedrohlichen Fällen einen automatischen knappen Erfolg vor, wenn der **reguläre Würfelpool mindestens so hoch wie die Schwierigkeit ist**. **Keine automatische Freigabe** in Kämpfen, akuter Gefahr, angespannten Proben, bei Qualitätspflicht oder wenn die Szene ausdrücklich einen echten Wurf braucht. Die Engine bietet der SL/Regeldefinition `allowAutomaticSuccess` an und prüft Kontext. **Kein echter Roll-Event, keine Stresszunahme, keine Würfelanimation** bei automatisch geglückter Alltagsaktion.

### 4.4 Wurfregeln als reine Funktionen

`evaluateV20(faces[], difficulty, specialtyApplies, guaranteedSuccesses, requiredSuccesses, botchPolicy)` darf keine Datenbank, keine Animation und keinen Zufall aufrufen. Der RNG ist vorgelagert; Rechenfunktionen sind deterministisch und mit festen Testdaten ausführbar.

---

## 5. Drei Würfeltypen im ChroniPlay-Hybrid

| Typ | Farbe | Standard-W10-Erfolg? | 1er löscht Erfolg? | Sonderauslöser |
|---|---|---|---|---|
| `NORMAL` | neutral/elfenbein | ja | ja | keiner |
| `HUNGER` | tiefrot | ja | ja | bestialischer Fehlschlag / bestiengefärbter Erfolg |
| `STRESS` | schwarz/violett | ja | ja | Stressreaktion bei misslungener Probe und Stresswürfel-1 |

**Würfelmix:** `hungerDice = min(pool, hunger)`; danach `stressDice = 1`, wenn persönlicher Stress >= 2, mindestens ein Nicht-Hunger-Würfel übrig und der Probentyp die Hausregel erlaubt; `normalDice = pool - hungerDice - stressDice`. Summe = `pool`; **niemals** zusätzliche Würfel als Bestrafung erzeugen. Die Reihenfolge im UI ist unabhängig von Zuordnung, aber jeder Würfel speichert `dieId`, `type`, `face`.

**Ausnahmen:** Rouse-Checks verwenden genau einen eigenen Erweckungs-W10, **keine Hunger-/Stresswürfel**. `damage`, `soak`, `initiative`, `feeding_quantity`, bestimmte rein reflexive und passive Würfe erhalten standardmäßig **keine** Hunger- und Stresssubstitution. Jede Ausnahme ist explizit mit `diceProfile` festgelegt; keine generische Ausnahme auf Basis bloßer UI-Bezeichnungen.

**V20-Spezialisierung auf Sonderwürfel:** Da sie gewöhnliche W10 ersetzen, kann eine anwendbare V20-Spezialisierung auch deren 10 zur Doppelwertung machen. **Der besondere „Bestienerfolg“-Trigger** setzt zusätzlich zwei *tatsächlich geworfene* 10en voraus, davon mindestens eine rote 10; die Spezialisierungs-Doppelwertung einer einzigen 10 ist **kein** zweiter Zehnerwürfel.

---

## 6. Probetypen und Sonderpipelines

### 6.1 `ordinary`

Einwurf mit `requiredSuccesses` (Standard 1), SG und einem Pool. Treffer/Information/Auswirkung erst durch danach zugeordnete Fähigkeitseffekte oder Szenenlogik. `ordinary` ist stressfähig, sofern `stressEligible=true` und verbindliche Spielprobe.

### 6.2 `opposed` / Widerstreit

- Beide Seiten haben **eigene** Würfelpools, Würfelarten, SG und zeitgebundene Effekte.
- Ergebnisvergleich anhand **bereinigter Erfolge**; `netMargin = attacker.totalSuccesses - defender.totalSuccesses`.
- Gleichstand nach der für diesen konkreten Wettstreit hinterlegten Regel; **kein universeller Sieg des Angreifers**. In V20 können Ties je nach Handlung zu Fortsetzung/Gleichstand führen.
- Eigene Patzer werden je Teilnehmer bewertet; zulässige persönliche Stressvergabe **pro eigener Probe**. Gruppenstress bleibt SL.
- Geheime Verteidigerwerte/Informationen werden nicht an Unberechtigte übertragen.

### 6.3 `extended` / Längerfristige Aufgabe

- Definition: `targetAccumulatedSuccesses`, `interval`, `deadline`, `maxAttempts?`, `retryPenalty`, `participantPolicy`, `failurePolicy`.
- Jeder Teilwurf hat eigene ID, Würfel und Einzelresultat. Kumulative Erfolge werden **nur** nach gültigem Teilwurf fortgeschrieben.
- Patzer kann nach konkreter Regel Projektverlust, Rückschritt, Warnung oder Abbruch bedeuten. **Nie universell alle Fortschritte löschen**, wenn keine Regel dies definiert.
- Stressereignisse nur, wenn `stressEligible` und `attemptCountPolicy`/`cooldown` greifen – keine Spamfarm mit beliebig wiederholter Probe.
- Mehrpersonenzusammenarbeit: vom konkreten Szenenprofil definierte Addition/Unterstützungsmechanik statt pauschaler Würfelbonus.

### 6.4 Wiederholter Versuch

V20 kann weitere Versuche erschweren, insbesondere nach Fehlschlägen. Das ist situationsabhängig. `retryPolicy` ist `allowed|disallowed|requires_change|sl_review`, `difficultyStep` optional; die Engine darf **nicht automatisch jede wiederholte Probe +1** geben. Eindeutiges `challengeId`/`attemptIndex` verhindert Umgehen durch neu angelegte Würfe.

### 6.5 `resistance`, `moral`, `frenzy`, `courage`

- Verwenden oft andere Pools als Attribut + Fähigkeit und verfügen über eigene SG/Ergebnistabellen.
- `frenzy`/Rötschreck kann V20-Virtues und V5-inspirierte Hungerzustände betreffen. Dieser Mix braucht einen **separaten genehmigten Hausregel-Eintrag**, bevor er Ressourcen oder Charakterkontrolle verändert.
- `moral`/Pfad-/Menschlichkeitsprüfungen lösen **nicht** automatisch „-1 Menschlichkeit“ aus, wenn keine exakt definierte, freigegebene Regel und SL-Kontext vorliegen.
- Diese Würfe sind **standardmäßig nicht stressfähig**, um unbeabsichtigte Doppelbestrafung / automatisierte psychische Kaskaden zu verhindern; per Einzelregel konfigurierbar.

### 6.6 Initiative / passive Vergleiche

Initiative ist kein Standard-„Anzahl Erfolge“-Wurf. V20 verwendet grundsätzlich W10 + Geschick + Geistesschärfe (mit kontextabhängigen Modifikatoren). Separate `initiativeResolver`-Schnittstelle; keine 1er-Streichung und keine Stressvergabe.

### 6.7 `damage`, `soak`

V20-Kern: Für Schaden und Absorption bei passendem Würfelpool sind gewürfelte 1er relevant zur **Annullierung erwürfelter Erfolge**, aber **diese Würfe können nicht patzen**. `botchPolicy = NEVER`; fehlende Erfolge = 0 Schaden bzw. 0 Absorption. **Kein Stresszuwachs** aus beiden Wurftypen.

---

## 7. V20-Sonderfälle, die nicht verloren gehen dürfen

| Thema | Fachliche Anforderung | Umsetzung |
|---|---|---|
| Spezialisierung | 4+ / passende Ausprägung; 10 zählt doppelt | `specialtyApplies` mit Quelle/Begründung |
| Ohne Talent | i.d.R. möglich | untrained policy nach Kategorie |
| Ohne Fertigkeit | +1 SG | DifficultyModifier mit Herkunft |
| Ohne Kenntnis | i.d.R. blockiert | `requiresTraining` |
| Einser | streichen erwürfelte Erfolge | in Math Engine |
| Patzer | kein **einziger** erfolgreich geworfener Würfel + mind. eine 1 | getrennte `rawSuccessDice` |
| Abgesagte/abgebrochene Probe | keine Würfelwertung | Status vor commit |
| Automatischer Erfolg | meist trivial; Pool >= SG bei erlaubtem Kontext | eigenes Ereignis ohne Würfel |
| Vorab-Willenskraft | +1 garantierter Erfolg, 1 WP/Runde, aktionsabhängig | pre-roll action & locking |
| Geteilte Handlungen | Würfel aus kleinstem beteiligten Pool auf Aktionen verteilen | `multiActionPlan` |
| Aktionsbeschränkungen | einzelne Disziplinen modifizieren pro Runde Aktionen | action economy resolver |
| Ausweich-/Parieraktionen | reaktive/gegebenenfalls geteilte Pools | combat resolver |
| Soak/Damage | niemals patzen | `NEVER_BOTCH` |
| Verletzungsabzüge | Poolmali; teils Ausnahmen (Absorption, gewisse Widerstände) | Effektflags pro Wurftyp |
| Schadensarten | bashing/lethal/aggravated; Typ und Wesen beachten | typed damage pipeline |
| Schusswaffen gegen Vampire | vom Zieltyp / Trefferzone abhängige Sonderregel | target type |
| Feuer/Sonnenlicht | schwer heilbare/typisierte Effekte | source-specific pipeline |
| Generation | Limits und Disziplininteraktion | generation registry |
| Menschlichkeit/Pfad | eigene moralische Tests/Schwellen | moral module |
| Vorzüge/Schwächen | können Proben, Schwierigkeiten, Ressourcen, Trigger ändern | typed effect registry |
| Clan- und Blutliniennachteile | Sonderfälle überschreiben allgemeine Werte | priority/order rules |
| Mehrfachwürfe/Extended | progress und Widerstreite getrennt | dedicated resolver |
| Ausrüstung, Reichweite, Deckung | Pool, SG, Schaden, Manöver | gear/combat tables |
| Geheime SL-Probe | kein Leak von Pool/Ziel/Ergebnis | visibility policy |

**Keine „allgemeine Formel“ darf Spezialtexte aus V20 übergehen.** Unterschiedliche Sonderregeltypen erfordern deklarative Maschinenregeln oder einen ausdrücklich geprüften, isolierten Handler; niemals einen langen, undurchsichtigen `if`-Block aus einzelnen Disziplinennamen.

---

## 8. V5-inspirierter Hunger in der V20-Basis (Hausregel)

### 8.1 Ressource

`hunger: 0..5`, nur ein autoritativer Wert je Charakter. **Nicht** gleichzeitig mit einem für dieselben Kräfte automatisch verbrauchten Blutpunktepool verrechnen. **Achtung Migration:** Aktuelle ChroniPlay-Charakterdaten besitzen historisch „Blut aktuell/max“; diese Daten **nicht automatisch überschreiben oder umdeuten**, ehe ein genehmigtes Migrationskonzept (Generation, alte Ressourcen, aktive Charaktere) existiert.

### 8.2 Erweckungsprobe / Rouse Check

Ein separater W10, kein normaler Fertigkeitswurf. `face >= 6` => Hunger unverändert; `face <= 5` => Hunger um 1 erhöhen, maximal 5. Eine erforderliche Erweckungsprobe wird durch die genehmigte Fähigkeit definiert. Bei Hunger 5 ist eine freiwillige Erweckungsprobe **gesperrt**. Unfreiwillige/erzwungene Sonderfälle sind eigene Regeln, nicht automatisch „Hunger 6“.

**Zeitpunkt:** Kosten und Zulässigkeit vor Ausführung prüfen, Ressourcenveränderung anhand einer klaren transaktionalen Phasenregel buchen. Für V5-inspirierte Erweckungsproben gilt: Aktionseffekt kann unabhängig vom Erfolg des Rouse Checks wirksam sein; zusätzliche Hungerwürfel aus der fehlgeschlagenen Erweckungsprobe werden **erst nach Auflösung dieses Effekts** berücksichtigt. Nicht unmittelbar den laufenden Wurf umformen.

### 8.3 Hungerwürfel

`min(pool,hunger)` reguläre W10 werden zu roten Hungerwürfeln. Die mathematische V20-Auswertung bleibt unverändert (inkl. 1er-Abzug und ggf. Spezialisierungs-10er); Hunger ist nur ein regelgeprüfter **zusätzlicher Trigger**, kein zweites Ergebnisverfahren.

**Hausregel `BESTIAL_FAILURE`:** Die endgültige *mechanische* Probe ist ein Fehlschlag/Patzer und mindestens ein Hungerwürfel zeigt 1. Das Ereignis löst eine Bestienmarkierung aus. Erzählwirkung erst durch freigegebenes Clan-/Szenenregelprofil; keine beliebige automatische Raserei.

**Hausregel `BEAST_TAINTED_SUCCESS`:** Endgültige Probe gelingt, es wurden mindestens zwei tatsächliche 10en gewürfelt, darunter mindestens ein Hungerwürfel mit 10. Keine zusätzlichen V5-„Krit-Bonuserfolge“: 10er werden **nur** nach V20-Spezialisierung gewertet. Bestiengefärbter Erfolg überschreibt die Tatsache des Erfolgs nicht.

**Priorität:** Erst V20-Kernresultat berechnen, **danach** Hungerflags; bei Misserfolg ist Bestienflag möglich, bei Erfolg ein Bestien-Erfolgsflag. Beides gleichzeitig ausgeschlossen. V20-Patzer kann als Untertyp `botch` erhalten bleiben.

### 8.4 Nahrung/Feeding

Füttern ist eine **eigene Handlung** mit `source`, `quantity`, `restrictions`, `consent/scene outcome`, `hungerChange` und `narrativeConsequences`. Nicht durch willkürliche erfolgreiche „Trinkprobe“ Hunger beliebig auf 0 setzen; eventuelle V5-Beschränkungen für Hunger 0 und Blutquelle müssen vor Freigabe in einem separaten, quellgeprüften Feeding-Regelblatt feststehen.

### 8.5 V20-Blutkosten auf Hunger abbilden

**Kein universelles 1 BP = 1 Rouse** für alle Systeme: unterschiedliche Generationen, Kosten pro Runde, mehrfaches Blutausgeben, Heilung, Attributssteigerung, Blutmagie und Rituale lassen sich nicht verlustfrei zu einer einzigen Schablone konvertieren. **Hausregel-Arbeitsannahme:** gewöhnlicher einzelner Blutpunkt kann bei ausdrücklich freigegebenen Fähigkeiten eine Erweckungsprobe werden; alle anderen Kosten **pro Fähigkeits-ID**, erst nach Autorisierung. `unmappedCost` = blockieren und Review-Task auslösen.

---

## 9. Persönlicher Stress (ChroniPlay-Hausregel)

### 9.1 Datenmodell

`stressUnits: integer[0,300]`; `stressPoints = floor(stressUnits/100)`; `stressProgress = stressUnits % 100` für Werte unter 300; bei 300 => 3 volle Punkte, Progress = 0. Kein float und keine negativen Werte.

**Vorläufiges Balancing – NICHT offiziell / Zahlen gelten erst nach simulationsgestützter Abnahme:**

| Ergebnis einer stressfähigen persönlichen Aktion | Einmalige Stressänderung |
|---|---:|
| normaler Erfolg | 0 |
| bestiengefärbter Erfolg | 0 |
| gewöhnlicher Fehlschlag | 0 |
| V20-Patzer ohne Hunger-1 | +30 |
| misslungene Probe mit Hunger-1, aber kein V20-Patzer | +35 |
| V20-Patzer mit Hunger-1 | +45 |
| misslungene Probe mit Stresswürfel-1 ohne höheres Ereignis | +15 |

**Regel für Priorität:** pro Wurf **genau ein** Treffer aus dieser Tabelle mit Priorität `V20 botch + hunger1 > failed + hunger1 > V20 botch > failed + stress1 > other`. Die Werte addieren sich **nicht**. Wenn ausdrücklich ein anderes Stressereignis parallel eintritt, muss dessen separate Ursache/ID begründet sein. Routine, Schaden, Soak, Initiative, Rouse, automatische Erfolge und Testwürfe sind standardmäßig nicht stressfähig.

### 9.2 Stressstufen und SG-Mali

- 0 Punkte: kein Effekt.
- 1 Punkt: +1 V20-SG auf `pressure=true`.
- 2 Punkte: +1 V20-SG auf `pressure=true`; bis zu ein Stresswürfel.
- 3 Punkte: +1 V20-SG auf alle als relevant (`nontrivial=true`) gekennzeichneten persönlichen Proben; bis zu ein Stresswürfel.
- SL-definierter Gruppenstress beeinflusst persönliche Würfe **nur**, wenn die separate Gruppenstressregel eine entsprechende Modifier-Quelle bietet. Kombinierte Stress-SG-Mali als **Hausregel maximal +2**; übrige SG-Modifikatoren dürfen weiter greifen, Gesamtschwierigkeit maximal 10. Keine stillen Änderungen an der SL-Vorgabe; UI zeigt Basis und effektiven Zielwert.

### 9.3 Stresswürfel und Rückkopplung

Ein Stresswürfel ersetzt einen **normalen** W10 erst nach Hungersubstitution, nur wenn Pool Restwürfel enthält und der Typ stressfähig ist. Eine 1 bei **misslungener Probe** ermöglicht `STRESS_REACTION`. Dies ist eine **markierte erzählerische Komplikation**, kein garantiert gescheiterter Wurf. Bei gleichzeitigem schwererem Hunger-/Patzerereignis wird keine zweite Stressreaktion erzwungen. Eine Stressreaktion darf höchstens eine aktiv freigegebene Effektvorlage wählen; keine freie LLM-Erfindung als automatisch vollstreckte Statusänderung.

### 9.4 Stressabbau

- Erfolgreiches persönliches Minispiel: vorgeschlagen `-100 stressUnits`, innerhalb genehmigter Ruhephase, max. 1 pro Charakter/Ruhephase, kein Kampf/akute Gefahr/eigene laufende Probe. Szenen- und Charakterbesitz prüfen; servervalidierte Abschlussbedingung; kein clientgesendetes `stress -= 100`.
- Erfolgreiches Rollenspiel: denselben Abbau bei einem spezifisch definierten und bestätigten Szenen-/Bewältigungsereignis. Wenn nicht vorbereitbar, darf SL die **erreichte narrative Bedingung bestätigen**, ohne persönlich Stresswerte tippen zu müssen.
- Mehr Stresspunkte dürfen nie „unter null“ abgebaut werden. Stress bei 0 bleibt 0; leere Minispiele haben keine verdeckten Boni.
- Vorhandene Wurf-/Rollenergebnisse sind historisch und werden bei nachträglicher Entspannung nicht rückwirkend verändert.

### 9.5 SL-Grenze

**Gruppenstress** darf nur durch berechtigte `GM_GROUP_STRESS_ADJUSTED`-Befehle, niemals durch automatische Würfel-Hooks, Spieler-Minispiele oder private Charakterwerte verändert werden. Vorschläge an den SL sind erlaubt, aber ohne Commit. Gruppenstress-Konsequenzen des historischen 2025-Regelwerks bleiben **separater, erst nach aktuellem Stand zu bestätigender Katalog**.

---

## 10. Willenskraft, Kosten, Ressourcen

### 10.1 V20-Willenskraft

- Permanente und temporäre Willenskraft getrennt. Für eine zulässige Probe kann **vor dem Wurf** 1 temporärer Punkt als garantierter Erfolg ausgegeben werden. Maximal **1 Willenskraftpunkt pro Runde** nach allgemeiner V20-Regel; Sonderfälle nur durch einzelne, überprüfte Regeln.
- Dieser automatische Erfolg kann nicht durch Einsen oder einen Patzer verloren gehen. Der Ausgabe-Dialog darf nicht erst nach dem Wurf erscheinen.
- Ausnahmen: nicht jede Handlung darf damit geboostet werden (insbesondere bestimmte Kampf-/Schadens-/Spezialfälle); `willpowerPolicy` der Fähigkeit kontrolliert das. Keine universelle „WP rettet alles“-Schaltfläche.
- V20 erlaubt außerdem situatives Widerstehen, Verhalten trotz Zwang sowie für eine Runde Verletzungsabzüge ignorieren. **Eigenständige Aktionstypen/Policies** statt immer „+1 Erfolg“.
- Keine automatische V5-nachträgliche Wiederholung von 3 Würfeln im Hybrid, solange nicht gesondert genehmigt.
- Bei einem durch Regelgründe **vor** dem eigentlichen Würfeln abgebrochenen Versuch keine Ausgabe. Bei einem verbindlich gestarteten, kostenpflichtigen Würfelwurf gelten dessen freigegebene Ausgaberegeln, auch bei Misserfolg.

### 10.2 Einheitlicher Kostenablauf

`preflight -> reserve/authorize -> roll/resolve -> commit -> publish`. Bei Erweckungsproben mit nachgelagerter Hungersteigerung müssen Reihenfolge und Zeitpunkt pro Fähigkeit feststehen. Atomarer Commit aller verpflichtenden Mutationen; Spielzustand wird nicht teilweise gespeichert.

### 10.3 Ressourcenfamilien

`hunger`, `willpowerTemporary`, `health`, `activeConditions`, `inventoryItems`, `usesPerScene`, `turnActions`, `cooldowns`, `moralityOrPath`, `generation`, `experience`, `statusEffects`, ggf. `ritualMaterials`. Jede Ressource mit Min/Max, Eigentümer, Änderungsberechtigung, Ledger und Wiederherstellungsregeln. XP und Erschaffungswerte dürfen nicht über freie Wurf-Endpunkte manipulierbar sein.

### 10.4 Ressourceneffekt ist nicht automatisch Würfelerfolg

Ein misslungener Rouse Check muss keine misslungene Disziplin bedeuten. Ein erfolgreicher Resistenzwurf bedeutet nicht automatisch, dass Kosten refundiert werden. Jedes Fähigkeitsobjekt besitzt **explizite** `costWhen` (`on_attempt|on_activation|on_success|per_round|on_maintain`) und `refundPolicy`. Fehlende Angaben führen zu `BLOCKED_RULE_INCOMPLETE`.

---

## 11. Kampfpipeline, Schaden und Sonderzustände

### 11.1 Pipeline (V20-typisiert)

1. Runde starten: Initiative/Handlungserklärungen gemäß gekoppelter Kampf-Engine; SL-/Szeneneinschränkungen erfassen.
2. Aktionsbudget prüfen: Standardaktion, geteilte Handlungen, zusätzliche Aktionen (z.B. Geschwindigkeit) und bereits eingesetzte Ressourcen.
3. Angriffsprobe: passender Pool (gewöhnlich Geschick + Handgemenge/Nahkampf/Schusswaffen/Sportlichkeit), SG aus Regel-/Ausrüstungsprofil.
4. Verteidigung: ausweichen/blocken/parieren oder automatische/reaktive Variante gemäß Kampfmanöver.
5. Erfolg gegen Verteidigung vergleichen, effektive **zusätzliche Erfolge nach dem ersten** zu Schadenswürfeln addieren, wenn das entsprechende Angriffsprofil dies vorsieht.
6. `damageDice` aus Waffe/Stärke, Zusatzwürfeln und Effekten bestimmen; mindestens 1 Schadenswürfel bei regelkonformem Treffer (regelgebundene Ausnahmen separat). `damage` **kann nicht patzen**.
7. `soak` berechnen (Widerstandsfähigkeit, Seelenstärke/Fortitude, Rüstung, Schadensart, Zieltyp). `soak` **kann nicht patzen**.
8. Schaden nach allen Absorptions-/Halbierungsregeln je Zieltyp/Schadensart in geordneten Gesundheitsschaden umrechnen; Statusanpassung atomar.
9. Ergebnis-Popup zeigt mechanische Fakten, aber keine nicht vorbereiteten Storyfolgen.

### 11.2 Schadensklassifizierung

`BASHING|LETHAL|AGGRAVATED` mit Quelle (unbewaffnet, Klinge, Kugel, Feuer, Sonne, Zähne/Klauen, Disziplin), Trefferzone, Zielwesen (Vampir/Mensch/Ghul/sonstige), Rüstung und expliziten Besonderheiten.

- Wucht-/Schlagschaden: Vampir-Sonderbehandlung (V20 nach Absorption Halbierung gemäß korrekter Rundung) **separat quellgeprüft** programmieren; nicht blind für alle Wesen.
- Tödlich: Vampire können häufig mit Widerstandsfähigkeit/Fortitude absorbieren; Menschen nicht automatisch entsprechend.
- Schwer heilbar: grundsätzlich nur explizit erlaubter Soak (z.B. Seelenstärke), gegebenenfalls qualifizierte Rüstung nach Quelle.
- **Nie** einen Patzer/Stressereignis aus Schaden- oder Soakwürfen generieren.

### 11.3 Wunden und Zustände

Gesundheitsleiste mit Wundstufen und entsprechenden Poolabzügen; Soak, bestimmte Widerstands- und Sonderwürfe sind anders zu behandeln. `damageApplication`, `healing`, `torpor`, `incapacitated`, `staked`, `frenzy`, `rotschreck`, `dominated` sind **typisierte Zustände** mit Provenienz, Endbedingungen und Berechtigungen. Sondermechaniken für Feuer, Sonne und endgültigen Tod **nicht als generischer Wurf-Handler** implementieren.

### 11.4 Geteilte Aktionen

V20: Bei mehreren freiwilligen Aktionen den **kleinsten** der beteiligten Ausgangspools ermitteln und dessen Würfel nach Ansage auf die Einzelhandlungen verteilen. Die Aktionsteilung wird **vor** dem Wurf festgelegt, nicht nach sichtbaren Würfelergebnissen. Disziplin-bedingte Zusatzaktionen haben explizite Ausnahmen und dürfen ihrerseits nicht nochmals geteilt werden, wenn die jeweilige Regel dies ausschließt. Jeder Teilwurf hat einen konsistenten `parentActionId` und konkrete Würfelzuordnung.

---

## 12. Regelregister für Disziplinen, Pfade, Rituale und Sonderfähigkeiten

### 12.1 Grundsatz – nicht mit einem „Vampire“-Sammelschalter erledigen

V20 umfasst zahlreiche sich stark unterscheidende Fähigkeiten mit **passiven, aktivierten, gewürfelten, reflexiven, mehrstufigen, wirkungsabhängigen und erzählerischen** Effekten. Ein universeller „Disziplin = Würfelpool + Blutkosten“-Algorithmus wäre fachlich falsch.

Jede Einzelkraft (auch innerhalb derselben Disziplin) braucht einen **separaten Registry-Eintrag pro Regelversion**, mit einer Ausführungsart oder einem Regel-Handler. Bibliothekseinträge werden erst nach Lesen des Originaleintrags, dokumentierter Quelle, Gegenprüfung und Tests `approved`.

### 12.2 Mindestfelder eines Eintrags

```yaml
ruleId: v20-core/discipline/auspex/level-2/example  # Beispiel-Schema, keine echte Kraftfreigabe
rulesetId: chroniplay-hybrid-v20-base
rulesVersion: 1.0.0-draft
source:
  edition: v20-german
  book: Vampire: Die Maskerade – Jubiläumsausgabe
  page: null                      # vor Freigabe belegen
  licenseUse: private_reference
status: draft                     # approved erforderlich
kind: discipline_power
requirements:
  disciplineId: auspex
  minRating: 2
  prerequisites: []
  targetPolicy: configured
activation:
  actionEconomy: action|reflexive|passive|ritual|multi_round
  allowedContexts: []
  costWhen: on_activation
  costs: []                       # kein implizites Blut/Willenskraft
  hungerConversionRuleId: null    # falls benötigt separat freigeben
roll:
  mode: ordinary|opposed|extended|none|special
  poolFormula: null               # tokenisierte Feldreferenzen
  difficultyFormula: null
  requiredSuccesses: 1
  specialized: false
  canSpendWillpower: false
  diceProfile: standard_action
outcomes:
  onSuccess: []
  onFailure: []
  onBotch: []
  narrativeOnly: []
state:
  duration: null
  stackingGroup: null
  expiryPolicy: null
  cooldown: null
security:
  visibility: owner_and_gm
  targetAuthorization: required
review:
  sourceCheckedBy: null
  approvedBy: null
  tests: []
```

### 12.3 Quellen-/Mechanikgruppen, die als Registry-Pakete geprüft werden müssen

- **Kern-Disziplinen (V20-Grundbuch)** u.a. Tierhaftigkeit/Animalism, Auspex, Beherrschung/Dominate, Geschwindigkeit/Celerity, Seelenstärke/Fortitude, Verdunkelung/Obfuscate, Stärke/Potence, Präsenz/Presence, Gestaltwandel/Protean, Irrsinn/Dementation, Schattenspiele/Obtenebration, Fleischformen/Vicissitude, Quietus, Serpentis, Schimären/Chimerstry, Nekromantie, Thaumaturgie. Dazu im konkreten Inhaltsverzeichnis weitere Grund- und Blutliniendisziplinen **vollständig inventarisieren**; diese Liste ist *kein* Vollständigkeitsnachweis.
- **Thaumaturgie-/Nekromantie- und sonstige Magiepfade:** jeder Pfad und jede Stufe mit gesonderter Wirkung, Ressource, Erfolgsstaffel und Nebenwirkung; die **Rituale nach Grad, Vorbereitung, Material, Zeit, Wiederholungen und Nachwirkung** separat.
- **Disziplinstufen 6+ / Elder Powers** und Varianten sind eigenständige Regelobjekte, nicht extrapolierte Stufe-5-Effekte.
- **Clan-/Blutlinien-Flüche und -Vorteile** (insbesondere Ventrue-Nahrung, Toreador-Faszination, Nosferatu-Erscheinung, Malkavianer-Eigenschaften, Tremere-Vitae-Sonderfall usw.). Keine ungetesteten Pauschal-Effekte.
- **Vorzüge/Schwächen**: permanente Boni, situative Trigger, Kosten, Probenmodifikatoren, rollenspezifische Informationen, Einschränkungen.
- **Ausrüstung/Waffen/Rüstung**: Kategorie, Schaden, Typ, Reichweite, Feuermodus, Ladung, Verletzung, Zieltyp, Schutzeffekte.
- **Menschlichkeit/Pfade, Tugenden, Raserei und Rötschreck**, Blutbindung, Jagd, Heilung, Tagesruhe, Generation, Hintergrundwerte.
- **Weitere Quellenbücher**: vollständig getrennte und ausdrücklich lizenz-/quellengeprüfte Add-on-Regelsätze, nicht automatisch „alle Supplemente aktiviert“.

### 12.4 Reihenfolge für Umsetzung und Qualität

1. **Inventory:** alle Buchquellen und Ausgaben inventarisieren; Buchkürzel, Regelversion, Inhaltsverzeichnis, ggf. Errata.
2. **Extract:** manuell/regelredaktionell Mechanik zusammenfassen, keine langen Buchpassagen in Produktdateien kopieren.
3. **Normalize:** Attribute/Fähigkeit, Kostenzeitpunkt, Pool, SG, Effekt, Sonderregeln typisieren.
4. **Validate:** mit Originalseite vergleichen, Sonderfälle/Konflikte markieren.
5. **Test:** Erfolg, Fehlschlag, Patzer, Ressourcenlimits, Wiederholung, Abbruch, fehlende Berechtigung.
6. **Approve:** zwei Prüfstationen (Regelredaktion + QA/Implementierung) pro Fähigkeit vor `approved`.
7. **Release:** versionierten Katalog freischalten; unvollständige Kräfte bleiben im Charakterbogen lesbar, aber nicht als „automatisch ausführen“ aktiv.

---

## 13. Ergebnisautomatik und SL-Zuständigkeit

### 13.1 Ausgabestufen

1. **Rechenfakt:** Würfelflächen, Pool, Schwierigkeit, Einsen, Erfolge, Botch, Sonderflags.
2. **Regelkonsequenz:** genehmigte Ressourcenänderung, erlaubte Status-/Dauerwirkung, Stresszuwachs, Fortschritt eines Extended Rolls.
3. **Szenenkonsequenz:** nur durch vorher konfigurierte SL-Szenenregeln (z.B. Handout, Tür freigeben, ULTIO-Pager, Quest-Flag).
4. **Erzählentscheidung:** bleibt beim SL, sofern keine passende autorisierte Szenenregel existiert.

### 13.2 Ergebnis-Popup

- Titel `Erfolg|Fehlschlag|Patzer|Automatisch erfolgreich|Wurf ungültig`; bei Bedarf Flag `Bestie` oder `Stressreaktion` getrennt.
- Für Spieler verständlicher Kontext: Attribut/Fähigkeit, Basis/effektiver SG, W10-Zahlen, 1er-Abzug, ggf. Spezialisierung/automatische Erfolge, Ressourcen, persönlicher Stress vorher/nachher.
- Geheime Werte und Privatinformationen nur im jeweiligen Berechtigungsbereich; SL erhält geeignete Regieinformationen.
- **Nicht** ungeprüft Aussagen wie „Ziel tot“, „Polizei informiert“, „Geheimtür gefunden“ erfinden.
- Fehler-/Blockiernachrichten nennen präzisen Grund und nächste zulässige Handlung. Nie ein simuliertes Resultat als echten Wurf ausgeben.

### 13.3 Gruppenstress

SL darf `adjustGroupStress(+/- n, reason, sceneId)` auslösen. Automatische Ergebnisse dürfen lediglich `suggestedGMConsequence` anbieten. Keine direkte Schreibberechtigung aus Spieler-, Minispiel- oder Würfelendpunkten.

---

## 14. Zustandsmaschine, Datenhaltung, Sicherheit, Synchronisierung

### 14.1 Wurf-Lebenszyklus

`CREATED -> PREFLIGHT_OK -> COMMITTED_ROLL -> SETTLED_OPEN -> CLOSED_SHARED` (SL); benutzerspezifisch `LOCALLY_HIDDEN` als **Darstellungszustand**, nicht Zerstörung des Wurfs. Für einen noch nicht gestarteten Wurf gibt es `CANCELLED_BEFORE_COMMIT`, für eine regelwidrige Aktion `BLOCKED`. Fehlgeschlagene Transaktion darf keine angeblich gültigen Würfel erzeugen.

**Vor `COMMITTED_ROLL`:** Identität, aktive Session, Charakterbesitz/-berechtigung, Regeln, Ressourcen, Ziel, Wiederholungen, gegenwärtige Statusversion und Idempotency-Key prüfen.

**Commit:** autoritatives RNG einmal auslösen; Würfelfaces + Rule Snapshot + Konsequenzen in einer konsistenten Commit-Einheit persistieren. Client führt **niemals** einen zweiten fachlichen Zufallswurf aus; 3D-Animation benutzt lediglich bereits feststehende Ergebnisse.

### 14.2 Kein UI-Betrug / keine Ressourcenmanipulation

- Server-/Sessionautorität für RNG, Modifikatoren, Rollen und Ressourcen.
- Idempotenz nach `requestId/rollId`. Wiederholung gleicher Anfrage gibt den bereits gespeicherten Wurf zurück.
- Owner darf nicht beliebige Werte aus Browser-Sicht auf 5 Hunger, 0 Stress oder 99 Erfolge setzen.
- Für geheime Würfe separate `visibility`-Projektion; andere Spieler und selbst betroffene Charaktere dürfen bei SL-geheimen Würfen keine vertraulichen Details erhalten, sofern Regel nicht ausdrücklich sichtbar.
- Servervalidierte Completion Tokens für Minispiele; Zeit/Klickzahl nicht allein aus Browser-Payload vertrauen.
- Roll-Events bleiben nach Reconnect zuverlässig mit gleicher Würfel-ID, gleicher Reihenfolge und gleichen Zahlen sichtbar.
- Ein Wurf wird erst durch bewusste Aktion geschlossen. Neuer Wurf verdrängt den alten nicht lautlos.
- Versionierung und Zugriffskontrolle vorhanden; bestehende DB/Session-API vor neuer Migration inspizieren.

### 14.3 Bestehende ChroniPlay-Strukturen respektieren

Historischer Architekturstand nennt `records`/`records.body` mit stabilen Entity-IDs, Character-Projektion sowie getrennte `character-runtime`-API für Blut, temporäre Willenskraft und Gesundheit. **Nicht voraussetzen, dass dies im aktuellen Repository noch exakt so ist**: Claude Code muss auf dem tatsächlichen aktuellen Branch `git status`, Datenmodell, AuthZ, Dice-Engine und Event-/Broadcast-Wege prüfen. Keine zweite globale Charakterdatenbank anlegen und keine Live-Migration ohne ausdrücklichen Auftrag.

---

## 15. Verträge und Algorithmus (implementierungsnahe Referenz)

### 15.1 Roll-Request (konzeptionell, erst nach Repository-Audit ableiten)

```json
{
  "requestId": "unique-idempotency-key",
  "sessionId": "active-session-id",
  "characterId": "canonical-character-id",
  "challengeId": "optional-challenge-id",
  "rulesetId": "chroniplay-hybrid-v20-base",
  "actionRuleId": "roll/ordinary",
  "selection": {"attributeId":"dexterity","abilityId":"melee"},
  "context": {"pressure":true,"nontrivial":true,"combat":false},
  "declared": {"baseDifficulty":6,"requiredSuccesses":1,"spendWillpower":false},
  "visibility": "shared"
}
```

**Verbot:** Spieler sendet für einen verbindlichen Wurf weder freie `diceFaces` noch einen selbst gewählten finalen Pool, beliebige `stressUnits` oder „Gewinner = ich“. Auswahl muss sich auf tatsächlich besessene Charakterwerte beziehen. SL kann Probenanforderungen/Schwierigkeit vorgeben; spätere SL-Übersteuerung wird protokolliert und nicht als automatischer natürlicher Wurf deklariert.

### 15.2 Snapshot

```json
{
  "rollId":"uuid","characterVersion":15,"rulesVersion":"1.0.0",
  "dice":[{"id":"d1","type":"NORMAL","face":7},
          {"id":"d2","type":"HUNGER","face":1}],
  "pool":{"base":2,"effective":2,"hungerDice":1,"stressDice":0},
  "difficulty":{"base":6,"modifiers":[],"effective":6},
  "evaluation":{"rawSuccessDice":1,"rawSuccesses":1,"ones":1,
                "netRolledSuccesses":0,"guaranteedSuccesses":0,
                "totalSuccesses":0,"outcome":"failure",
                "flags":["BESTIAL_FAILURE"]},
  "effects":[{"type":"PERSONAL_STRESS_DELTA","amount":35}],
  "state":"SETTLED_OPEN"
}
```

### 15.3 Pure Resolver – Pseudocode

```text
resolveRoll(snapshot):
  validate all face in [1..10], difficulty in [2..10]
  assert dice.length == snapshot.pool.effective
  count rawSuccessDice = number of dice with face >= difficulty
  count rawSuccesses = sum of (face>=difficulty ? (face==10 && specialtyApplies ? 2 : 1) : 0)
  count ones = number of dice with face==1
  netRolled = max(0, rawSuccesses - ones)
  guaranteed = approvedPreRollSuccesses  # never reduced by ones
  total = netRolled + guaranteed
  rawBotch = botchPolicy.ALLOWS && rawSuccessDice==0 && ones>0
  if total >= requiredSuccesses: outcome = SUCCESS
  else if rawBotch && guaranteed==0: outcome = BOTCH
  else: outcome = FAILURE
  flags = evaluateHungerAndStressFlags(outcome, dice, context, rules)
  stressDelta = getSingleHighestPriorityStressDelta(outcome, flags, rules)
  return immutableResult(outcome, counts, flags, stressDelta)
```

**Anmerkung zu garantiertem Erfolg:** 1 Punkt WP ist ein garantierter Erfolg; dieser verhindert in typischen 1-Erfolgs-Proben den Patzer. Ein sehr spezieller Wurf mit erforderlichen mehreren Erfolgen kann trotz WP insgesamt scheitern; die eindeutige Sondersemantik dazu wird vom entsprechenden Regel-Handler bestimmt (der reine W20/V20-Patzer sollte wegen des garantierten Erfolgs nicht „vollständig gescheitert“ sein). Diese Ausnahme ist in Tests abzudecken.

### 15.4 Preflight- und Commit-Vertrag

```text
prepareRoll(request):
  auth actor and membership; verify character ownership, visibility
  load immutable character+runtime snapshot & active ruleset
  ensure actionRuleId APPROVED
  evaluate prerequisites, target validity and action budget
  derive pool, difficulty and cost preflight
  freeze selections including willpower and specialty
  return preview + authoritative confirm token (short-lived)

commitRoll(confirmToken, requestId):
  atomic transaction / optimistic retry:
    if requestId already committed: return original event
    check version and resources still valid
    sample unbiased W10 server side once per die
    resolve via pure rules function and configured effect pipeline
    commit mandatory costs, effects, stress and event snapshot exactly once
    append signed/audited ledger entry; publish one session event
  never reseed/reroll to match visuals
```

### 15.5 Ketten von Wirkungen

`effects[]` wird über `trigger`, `priority`, `stackingGroup`, `maxRecursionDepth`, `sourceRollId` und `causationId` kontrolliert. Aus einem Stresspunkt darf nicht automatisch eine neue Probe entstehen, die erneut Stress erzeugt, ohne ausdrücklich zugelassene Szenenaktion. Feste maximale Effekttiefe schützt vor Endlosschleifen.

---

## 16. Testvektoren und QA

### 16.1 Feste Kern-Testfälle (mindestens)

| ID | Gegeben | Erwartung |
|---|---|---|
| D01 | `[1,7]`, SG6 | Fehlschlag, **kein** Patzer |
| D02 | `[1,1,5]`, SG6 | Patzer |
| D03 | `[1,1,7]`, SG6 | Fehlschlag, **kein** Patzer |
| D04 | `[4,5]`, SG6 | Fehlschlag ohne Patzer |
| D05 | `[6,10]`, SG6 | 2 Erfolge (ohne Spezialisierung) |
| D06 | `[6,10]`, SG6, passende Spezialisierung | 3 Erfolge |
| D07 | `[10,1]`, SG6, Spezialisierung | 1 Nettoerfolg |
| D08 | `[10,1]`, SG6, ohne Spezialisierung | 0 Erfolge, kein Patzer |
| D09 | `[1,3]` SG6, WP+1 vorab | 1 garantierter Erfolg, kein Patzer |
| D10 | 0 Würfel und kein Sonderhandler | Blockiert ohne RNG |
| D11 | SG1 / SG11 bei V20 | ungültig bzw. explizit gekappte Modifikatoren gemäß Policy |
| D12 | Wurf trotz untrainierter Kenntnis | Blockiert oder nur explizite SL-Ausnahme |
| D13 | Fertigkeit 0, Basis-SG6 | effektive SG7 |
| D14 | Schaden `[1,2,3]` SG6 | 0 Schaden, niemals Patzer/Stress |
| D15 | Soak `[1,4,5]` SG6 | 0 Absorption, niemals Patzer/Stress |
| D16 | Automatischer Erfolg ohne Spannung, Pool>=SG | 1 knapper Erfolg, keine Würfel oder Stress |
| H01 | Pool6, Hunger2, Stress2 | 3 normale, 2 Hunger, 1 Stress |
| H02 | Pool3, Hunger3, Stress2 | 3 Hunger, 0 Stress |
| H03 | Pool5, Hunger2; rote 1 und Probe scheitert | BESTIAL_FAILURE |
| H04 | Pool5, Hunger1; zwei 10, davon rote 10; Erfolg | BEAST_TAINTED_SUCCESS |
| H05 | nur eine rote 10 + Spezialisierungs-Doppelzählung | **kein** bestiengefärbter Erfolg allein wegen eines Würfels |
| H06 | Rouse-W10 5 | Hunger+1, max.5 |
| H07 | Rouse-W10 6 | Hunger unverändert |
| H08 | Hunger5, freiwillige Rouse-Probe | Blockiert, kein RNG |
| H09 | Rouse fail bei Aktivierung | Hungeranstieg erst nach laufendem Effekt |
| S01 | Stress 95, +30 | 125 (1 Punkt, 25 Fortschritt) |
| S02 | Stress 235, -100 | 135 (1 Punkt, 35 Fortschritt) |
| S03 | Stress 299, +45 | 300; kein Überschreiten |
| S04 | Stress 0, -100 | 0; kein negativer Wert |
| S05 | V20-Patzer + Hunger-1 + Stress-1 | **nur** +45, nicht addieren |
| S06 | normaler Fehlschlag ohne Spezialflag | 0 Stress |
| S07 | erfolgreicher stressfähiger Wurf | 0 Stress |
| S08 | Schaden-/Soak-/Rouse-/Testwurf mit 1 | 0 persönlicher Stress |
| S09 | Spieler sendet direkte Gruppenstressänderung | verboten |
| S10 | Spieler schließt Minispiel außerhalb freigegebener Ruhephase ab | kein Abbau |
| W01 | WP-Aktivierung nach sichtbarem Ergebnis | abgelehnt |
| W02 | WP 0 und Ausgabewunsch | abgelehnt |
| W03 | zweite WP-Ausgabe gleicher Runde | abgelehnt, sofern keine freigegebene Ausnahme |
| W04 | abgelehnter Wurf vor Commit | keine Ressourcenkosten |
| X01 | identischer `requestId` zweimal | genau ein Roll und ein Ressourcencommit |
| X02 | zwei Tabs, gleicher Roll | gleiche Die-IDs, Faces, Auswertung |
| X03 | Reconnect bei offener Schale | gleicher gespeicherter Roll sichtbar |
| X04 | lokal schließen | andere sehen Wurf weiter |
| X05 | SL „für alle schließen“ | gemeinsamer Zustand geschlossen, Protokoll bleibt |
| X06 | Secret Roll | keine geheimen Daten bei unberechtigtem Spieler |
| X07 | konkurrierende Kostenänderung | atomarer Konflikt, keine doppelte Ausgabe |
| X08 | unvollständige Disziplin | kein automatischer Effekt, Review-Status |

### 16.2 Property-Based Tests

- Für jede Würfelliste `faces` und gültige SG: `0 <= netRolled <= rawSuccesses`, `rawSuccessDice <= pool`.
- Wenn `rawSuccessDice > 0`, ist `strictV20Botch = false`, selbst bei beliebig vielen Einsen.
- Wenn `botchPolicy=NEVER`, ist `outcome != botch`.
- `normal+hunger+stress == pool`, und nie negative Würfelanzahlen.
- Spezialwürfeltyp ändert **nicht** die Würfelflächenergebnisse und den V20-Normalerfolg bei gleichen Faces.
- Ein dokumentierter Wurf ist bei derselben Regelversion und denselben Faces **deterministisch**.
- `stressUnits` bleibt stets in `[0,300]`; `hunger` in `[0,5]`; Ressourcen bleiben im erlaubten Bereich.
- Ein `rollId` hat genau **ein** dauerhaftes Ergebnis und maximal eine idempotente Konsequenzerzeugung je autoritativem Trigger.
- Die Summe der exklusiven Stressklassifikationen pro Wurf ist 0 oder 1.
- Roll-Commit und Ressourcenänderung sind atomar oder es findet **gar keine** Änderung statt.

### 16.3 Statistische Tests / Balancing-Gate

Mindestens 100.000 simulierte Proben pro repräsentativem Profil (Pool 1/3/5/7/10, SG 4/6/7/8/9, Hunger 0/1/3/5, Stress 0/1/2/3, mit/ohne Spezialisierung). Metriken:

- normaler Erfolg, Fehlschlag, V20-Patzer, bestialischer Misserfolg, bestiengefärbter Erfolg, Stressreaktion;
- mittlere Würfe bis zum ersten/zweiten/dritten persönlichen Stresspunkt;
- Auswirkungen von SG+1 auf Charaktere mit geringem Würfelpool;
- Rückkopplung durch Stresswürfel und regelmäßigen Abbau;
- Anteil blockierter Aktionen bei Hunger 5; Anteil erzwungener SL-Eingriffe;
- Unterschiede der Erfolgswahrscheinlichkeit zu reinem V20.

**Stop-Gate:** Bei einer nachweisbar unspielbaren Patzer-/Stressspirale werden Parameter angepasst und neue Regelversion erzeugt, nicht das Ergebnis kosmetisch geschönt. Eine echte mathematische/Monte-Carlo-Analyse ist gesondert auszuführen; **nicht** behaupten, sie sei bereits erfolgt.

---

## 17. Regelinventar und Vollständigkeitsaudit

### 17.1 Pflicht-Inventory für V20-Grundbuch (separat nach Seiten und Edition katalogisieren)

| Regelblock | Kernauflösung in dieser MD? | Alle Einzelfälle aus Buch geprüft? | Freigabestatus |
|---|---|---|---|
| W10-Mathematik, Patzer, Schwierigkeit, automatischer Erfolg | **Ja** | Kernpassagen geprüft | für QA vorbereitet |
| Attribut- und Fähigkeitsgruppen | strukturell ja | einzelne Übersetzungslabels prüfen | Draft |
| Ungelernt, Spezialisierungen | ja | relevante Ausnahmen prüfen | Draft |
| einfache, erweiterte, widerstreitende Proben | allgemein ja | jede Szenenaktionsform nein | Draft |
| Mehrfachaktionen / Initiative | Schnittstelle ja | alle Manöver nein | Draft |
| Schaden, Absorption, Heilung | Kernpipeline ja | Tabellen und alle Typ-/Zielausnahmen nein | Draft |
| Willenskraft | Kernmechanik ja | alle Disziplin-Ausnahmen nein | Draft |
| Generation / Blut und Hybrid-Konversion | Architektur ja | Konversion je Fähigkeit nein | **BLOCKER** |
| Disziplinen Kernbuch (jede Stufe) | Registry ja | **nein** | **BLOCKER** |
| Disziplinen 6+ / Blutlinien | Registry ja | **nein** | **BLOCKER** |
| Thaumaturgie-/Nekromantiepfade | Registry ja | **nein** | **BLOCKER** |
| Rituale (alle Grade) | Registry ja | **nein** | **BLOCKER** |
| Vorzüge / Schwächen / Clanflüche | Registry ja | **nein** | **BLOCKER** |
| Waffen, Rüstung, Ausrüstung | Schema ja | alle Werte nein | **BLOCKER** |
| Jagd/Fütterung, Raserei/Rötschreck | Pipeline ja | alle Varianten nein | **BLOCKER** |
| Menschlichkeit/Pfade und Degeneration | Schnittstelle ja | Detailtabellen nein | **BLOCKER** |
| Erweiterte Zusatzbücher und Errata | Inventarmethode ja | **nein** | **außerhalb Grund-Kernscope** |

> **Wichtig:** „Vollständige W10-Spezifikation“ heißt nicht „100 % aller Vampire-Regeln automatisch verfügbar“. Vollständigkeit wird für **jede explizit aufgeführte Buchquelle / jedes Buchkapitel und jede Fähigkeit** quantitativ nachgewiesen (z.B. `approved / inventory = 218 / 218`), nicht durch eine allgemeine Behauptung.

### 17.2 Abnahmeprotokoll pro Regel

Eintrag:

```text
[ ] Quelle/Ausgabe/Seite vorhanden
[ ] Mechanik ohne urheberrechtlich problematischen Volltext extrahiert
[ ] Voraussetzungen geprüft
[ ] Attribut/Fähigkeit/Pool definiert
[ ] V20-Ziel-SG und benötigte Erfolge definiert
[ ] Erfolgs-/Fehlschlag-/Patzerfälle beschrieben
[ ] Ressourcenkosten inkl. Zeitpunkt und Refund geprüft
[ ] Hunger-/Stress-/Willenskraft-Interaktion erklärt
[ ] Sonderzustände, Dauer und Stapelung definiert
[ ] Ziel-/Sichtbarkeits-/Rollenrechte geklärt
[ ] Positiv-, Negativ- und Grenztests vorhanden
[ ] Zweite fachliche Gegenprüfung erfolgt
[ ] Status auf approved gesetzt, neue Version eingefroren
```

### 17.3 Projekt-Audit vor Coding

Claude Code dokumentiert vor Implementierung: Branch/Commit/dirty state, vorhandene W10-RNG-/Renderer-API, Eventbus, Character Schema, Runtime API, Rollenresolver, aktuelle Stresstabelle, Migrationen, Testabdeckung, Idempotenzstrategie. **Keine blinde Änderung des Live-Datenbestands.** Die historische W10-v1.2-Übergabe verbietet eigenmächtige große Engine-Umbauten innerhalb ihres damaligen Auftrags; **diese neue Spezifikation ist zunächst Planungsgrundlage, keine implizite Freigabe zum Merge/Deploy.**

---

## 18. Umsetzungsetappen und Freigabe-Gates

**Phase A – Reiner Core-Resolver:** `evaluateV20` als isolierte Funktion, Typen, Testvektoren, keine DB-Migration. Alle D-/S-/H-/W-Kernfälle bestanden; zusätzlich Referenzvergleich mit geprüften V20-Seiten.

**Phase B – Charakterintegration:** Charakterbogen-Auswahl -> saubere Pool- und Modifier-Vorschau; keine freien Spieler-„Pool=99“-Requests. Charakter-/Rollen- und Privatdatenregression.

**Phase C – Hunger/Stress-Hausregel:** versionierte Sonderwürfel, deterministic flags, Stress-Units und Minispiel-Erfolge; Monte-Carlo-Balancing, Grenzfälle; keine Gruppenstressmutation.

**Phase D – Ressourcen/Wurftransaktionen:** Willenskraft, Rouse, Kostenbuchung, autoritatives RNG, Idempotenz, Atomarität, Event-Historie.

**Phase E – 3D-/Live-Synchronisierung:** Bestehende Schale wiederverwenden, Roll-Payload einmal auswerten, zwei echte berechtigte Logins, Reconnect, lokales/globales Schließen.

**Phase F – Disziplin-/Aktionspakete:** nur einzeln freigegebene Katalogeinträge mit sourcePage+Tests; erst Basissatz, dann Zusatzpfade/Elder Powers/Quellenbücher. Fortschritt messbar pro Eintrag.

**Phase G – Szenenaktionen:** Ergebnis-Popup, genehmigte Handouts, ULTIO-Pager, spielerische Effekte; keine narrativen Erfindungen; Test in echter Chronik.

**Produktions-Stop-Gates:** Kein Rollout ohne aktive Regelversion, vollständigen verpflichtenden Testsatz, überprüfte AuthZ, Rollback-/Migrationsplan, Sicherung von Bestandscharakteren, Lizenzprüfung und explizite Projektleiter-Abnahme.

---

## 19. Offene Entscheidungen, Revisionsbedarf und Lizenz

### 19.1 Fachlich vor automatisierter Produktivsetzung klären

1. **V20-Blutbestand -> V5-Hunger**: Wie gehen wir mit existierenden Charakteren um? Migrationspolicy als eigene Abnahme.
2. **W10-Typen auf Verteidigungs-/Moral-/Disziplinproben**: genaue Teilmengen anhand Roll-Registry, nicht global alle Würfe.
3. **Kumulierte SG-Mali**: vorgeschlagen `stress + gruppenstress <= +2`, aber was geschieht bei bereits SG10? Explizite Cap-Policy und Kompensationen.
4. **Stress-Balancing**: 30/35/45/15 sowie max.300 vorläufig; simulieren und mit Spielgruppe testen.
5. **Raserei und Clanflüche**: wer entscheidet über automatische Auslösung und erzählerische Reaktion? Freigabepflicht.
6. **Willenskraft bei Sonderaktionen**: erlaubte Proben per Katalog prüfen; kein globales Ja.
7. **V20-Spezialisierung mit Hunger-/Stresswürfel**: aktueller Hausregelentwurf wendet sie an; Regressionstest und SL-Abnahme.
8. **Untaugliche/gesperrte Kenntnisse, Wunden, Multi-Action und Ausrüstung**: Einzelfälle anhand Kernbuchseiten durchsehen.
9. **V20-Add-ons**: Namen, Edition, Errata, Lizenzgrundlage und in welchen Chroniken aktiviert – keine „alle Bücher“-Freischaltung ohne Quellenliste.
10. **Nicht-vorbereitete Rollenspiele zur Stressreduktion**: SL bestätigt nur die erzählerische Bedingung, nicht den Stresswert. Klare Einmaligkeit und Begrenzung.
11. **Unklarheit „V5 Blut“**: Entscheidung zugunsten Hunger als einzigem Blutverbrauchsmodell ist derzeit ein Designentwurf aus der Planung; muss den existierenden Runtime-Blutbestand und V20-Generationseigenschaften berücksichtigen, bevor es verbindlich migriert wird.

### 19.2 Qualitätsvorbehalt

Die in diesem Entwurf verifizierten V20-Kernstellen stammen aus **dem zugänglichen deutschen V20-Grundregelwerk**. Dennoch ist **keine seitenweise Vollprüfung des gesamten Grundbuchs oder sämtlicher Zusatzbücher** abgeschlossen worden. Der Qualitätsanspruch wird durch einen transparenten Auditpfad, vorläufige Blocker und Tests gesichert – gerade weil die Spielleitung die Regeln nicht selbst lückenlos nachprüfen kann. In einer kostenintensiven Entwicklung wäre eine unzutreffende „alles geprüft“-Behauptung riskanter als ein dokumentierter Stop-Gate.

### 19.3 Urheberrecht und Vertrieb

Diese Datei ist eine eigenständige technische Spezifikation und enthält keine umfangreichen wörtlichen Regelbuch-Passagen. Private Bücher dienen zur internen Quellenprüfung. Bei Veröffentlichung eines V20/V5-kompatiblen Tools müssen Umfang der implementierten Regeltexte, Logos, Marken und Monetarisierung gesondert geprüft werden. Das **Dark Pack Agreement** erlaubt unter Bedingungen bestimmte kostenlose Fan-Tools; es ist **keine pauschale Erlaubnis** für kommerzielle Regelbuch-Reproduktionen. Die Regel-Engine sollte generisch und regelpaketfähig bleiben.

**Ende des Dokuments – v1.0.** Nächster sinnvoller Schritt: Core-Resolver gegen V20-Testvektoren und ausgewählte Disziplin-Registry-Einträge im isolierten Branch prüfen. Erst nach dem QA-Gate an aktuelle Claude-Code-Entwicklung übergeben.
