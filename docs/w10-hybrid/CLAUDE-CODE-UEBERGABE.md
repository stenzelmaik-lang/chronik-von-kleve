# W10-Hybrid – Phase A und Übergabe an Claude Code

Stand: 31.10.2026. Auftrag: Bestandsabgleich, Phase A lokal implementieren, verbessern und zur Weiterentwicklung durch Claude Code vorbereiten.

## Einstieg und Freigabegrenze

- Branch: `codex/w10-hybrid-phase-a`.
- Worktree: `C:/Users/Stenz/Documents/Codex/2026-10-03/02-entwicklung-code-du-bist-der/work/w10-hybrid-phase-a`.
- Basis: `0795040473843cf5858332985ee6dd5575ae23ff`, beim Start über GitHub als aktuelles `main` bestätigt.
- Der vorherige Arbeitsordner `work/galerie-vorbereitung` blieb auf `codex/galerie-material-releasebericht`, Commit `8f9f1445dbfd07fb9c10b17788421b942c2ecb92`, unverändert und sauber.
- Die neue Umsetzung wurde lokal geprüft. Kein Push, Merge, Deployment, produktiver Datenzugriff oder Schemaeingriff.
- Maßgebliche Eingangsspezifikation: [CP-RULES-W10-001, v1.0](CP-RULES-W10-001-v1.0-draft.md). Die Kopie ist bytegleich zur übergebenen Datei; SHA-256: `673f99a817217fddbd521aa673d00839c66bd3b237ecd859377f05597ed1329a`.
- Das Hybridprofil bleibt `1.0.0-draft`, `productionEnabled: false`. Dieser Marker ist keine serverseitige Berechtigungsprüfung. Die Draft-Funktionen sind in keine Anwendungsroute eingebunden.

**Zuerst lesen:** dieses Dokument, dann die Ursprungsspezifikation. Die folgenden Präzisierungen sind Implementierungs- und Prüfverträge; sie erklären keine Hausregel zum produktiv genehmigten Regelwerk.

## Ergebnis des Bestandsabgleichs

| Bereich | Befund | Weiterverwendung / Lücke |
| --- | --- | --- |
| W10-Zufall | vorhanden | `domain/w10.ts`: `crypto.getRandomValues`, unverzerrtes Rejection Sampling, kein Erfolgs-Fallback. Weiterverwendet. |
| V20-Normalprobe | vorhanden / erweitert | Die bestehende API delegiert die Mathematik an `domain/w10-core.ts`. Ergebnisformat und 1–30-Würfel-Grenze der bestehenden API bleiben erhalten. |
| 3D, gemeinsame Würfe, lokales / gemeinsames Schließen | vorhanden | Bestehende Komponenten und Synchronisierung bleiben erhalten. Keine Rendereränderung in Phase A. |
| Charakterbogen und Runtime | vorhanden / anpassbar | `domain/character-engine.ts`, `server/live-vitals.ts`, `/api/character-engine`, `/api/character-runtime` und vorhandene Records weiterverwenden. Keine zweite Charakterhaltung. |
| Pool aus Bogenwerten | fehlt im Würfelpfad | `use-shared-dice.ts` sendet noch Pool/SG; der Live-Pfad bindet den Pool noch nicht an eine autoritative Charakterauswahl. Phase B. |
| Stabile Attribut-/Fähigkeits-IDs | anpassbar | Bestand nutzt deutsche Schlüssel, darunter bereits Diebstahl und Technologie. Übersetzungsadapter ergänzen, gespeicherte Schlüssel nicht umbenennen. |
| Versionierter Regel-Snapshot im Live-Event | anpassbar | `server/live-stage.ts` wertet bestehende gespeicherte Faces beim Laden erneut mit `evaluateNormalV20` aus. Für Hybridereignisse müssen Regelversion und ursprüngliche Auswertung gespeichert werden. |
| Persönlicher Stress | anpassbar, Konversion offen | Bestand: `TableVitals.personal[characterId]` mit 0–10, manuell durch SL. Entwurf: 0–300 Einheiten. Keine automatische Umdeutung. |
| Gruppenstress | vorhanden | 0–10 und explizite SL-Aktion. Kein automatischer Wurf-Hook ergänzt. |
| Hunger | fehlt als Hybrid-Runtime | Bestehende Blutpunkte nicht konvertiert oder entfernt. Migrationsentscheidung erforderlich. |
| Willenskraft | vorhanden / anpassbar | Temporäre Ressource und Ausgabepfade vorhanden. Wurfgebundene Vorabansage, Rundensperre und atomare Buchung fehlen noch. |
| Regelregister einzelner Kräfte | fehlt als ausführbarer, freigegebener Katalog | Vorhandene Disziplinnamen sind kein geprüftes Aktionsregister. Einzelkräfte erst in Phase F. |

## Implementierter Umfang

### Gemeinsame V20-Mathematik

`domain/w10-core.ts` enthält `evaluateV20(faces, options)`. Die Funktion benötigt keinen Zufall, keine Uhrzeit, keine Datenbank und keinen Browser.

- Gewürfelte Erfolgswürfel und gewichtete Erfolge getrennt.
- Passende Spezialisierung: Zehn zählt zweimal; kein neuer Würfel.
- Einsen annullieren ausschließlich erwürfelte Erfolgsanteile.
- Garantierte Erfolge bleiben erhalten; Mehrerfolgsproben können trotzdem scheitern.
- Patzer nur ohne einen einzigen gewürfelten Erfolgswürfel und mit mindestens einer Eins; `botchPolicy: never` für Schaden/Absorption.
- Unveränderliches Ergebnis mit nachvollziehbaren Zählungen und Indizes der annullierten Erfolgsanteile.
- Die normale bestehende API behält ihren Vertrag. Sparse Arrays werden jetzt ebenfalls als ungültig abgelehnt.

### Lokaler Hybrid-Vertrag

`domain/w10-hybrid-draft.ts` enthält:

- `prepareDraftRoll`: mathematische Vorbedingungen, ungelernte Kategorien, ausdrückliche SG-Kappung, vorab deklarierte Willenskraft und Würfelverteilung.
- `resolveDraftRoll`: deterministische Auswertung vorgegebener Faces; stabile Die-IDs, eingefrorener Request, Regelversion, Zählungen, Flags und **nur vorgeschlagene** Ressourceneffekte.
- `sampleDraftRoll`: lokaler Testadapter zur vorhandenen Zufallsquelle. Das technische Arbeitslimit von 1.000 Würfeln gilt nur für diesen Adapter. Der reine Resolver besitzt keine neue 10-/30-Würfel-Regelgrenze; die bestehende Live-API bleibt bei 30.
- `changeStressUnits`: reine Integer-Berechnung mit Begrenzung auf 0–300. Keine Runtime-Buchung und kein freigegebenes Minispiel.
- `resolveDraftRouse` / `sampleDraftRouse`: freiwillige Einzelprobe mit 6–10 als bestandener Kostenprüfung. Hungeränderung als Vorschlag für `after_action_resolution`; kein Rückschluss auf den Aktionserfolg.

Diese Eingaben sind **keine HTTP-Requests**. Insbesondere `allowed`, `spentThisRound`, `knowledgeException`, `specialtyApplies`, Pool und Charakterversion müssen bei späterer Integration serverseitig ermittelt werden. Ein Client darf diese Vorbedingungen nicht selbst bestätigen.

## Präzisierungen gegenüber dem Eingangsentwurf

1. **Phasengrenzen messbar machen.** Phase A liefert reine Berechnung und lokale Vorbedingungen. S09/S10 sowie Transaktionen und echte Rundensperren sind keine durch Unit-Tests bewiesene Zugriffssicherheit. Phase C/D muss sie eigens integrieren und prüfen.
2. **Bestehenden persönlichen Stress ausdrücklich behandeln.** Neben Blut → Hunger braucht auch Stress 0–10 → 0–300 eine genehmigte Bestands-/Koexistenzentscheidung. Die Zahlen werden weder multipliziert noch überschrieben.
3. **Automatische Erfolge getrennt modellieren.** `resolution: automatic`, ursprünglicher Pool in `pool.base`, effektiver gewürfelter Pool 0, keine Würfel, kein Stress, keine Wurfanimation. Dadurch bleibt `dice.length === pool.effective` wahr. Ein gleichzeitiger Willenskraftkauf wird abgelehnt.
4. **SG10 nicht stillschweigend verändern.** Bei einem rechnerischen Wert >10 blockiert der Draft standardmäßig. Nur `cap_at_10` erlaubt eine sichtbare Kappung mit Basis, Modifikatoren und ungekappter SG. Diese technische Auswahl ersetzt nicht die spätere fachliche Freigabe der Policy oder des kombinierten Gruppenstresslimits.
5. **Erzwungene Rouse-Proben benötigen eine Einzelregel.** `voluntary: false` wird mit `FORCED_ROUSE_REQUIRES_RULE` blockiert. Ein unspezifiziertes Ausnahmeflag aktiviert keine neue Sonderregel.
6. **Historische Würfe einfrieren.** Alte `v20-normal`-Ereignisse nicht nachträglich unter Hybridregeln auswerten. Neue Ereignisse brauchen gespeichertes Ergebnis, Regelversion, Request-/Charakterversion und konsequente Sichtbarkeitsprojektion. Der Draft schreibt keine Events.
7. **Zufall bei Transaktionswiederholungen schützen.** Der Pseudocode in 15.4 darf bei einem optimistischen Retry nicht erneut würfeln. Vor Implementierung festlegen, wie ein autoritativer Versuch Faces unveränderlich zuordnet und parallele identische Requests denselben gespeicherten Ausgang erhalten. Bloße erneute Zufallsziehung innerhalb einer wiederholten Transaktion reicht nicht.
8. **Ressourcenpfade vollständig einbeziehen.** `character-runtime`, Live-Vitals und spätere Aktionsausgaben dürfen eine Rundensperre oder einen Ressourcen-Ledger nicht umgehen. Prüfen und gemeinsam absichern; vorhandene manuelle Rechte nicht ungefragt abschaffen.
9. **Keine versteckte Freigabe durch Tests.** Hybridparameter 30/35/45/15 und die Würfelfarben bleiben Entwurfswerte. Keine Monte-Carlo-Analyse oder zweite fachliche Abnahme vorgetäuscht.

## Fachlicher Quellenabgleich

Die folgende Prüfung erfolgte mit dem Text der privaten [deutschen V20-Jubiläumsausgabe](https://drive.google.com/file/d/1myQ_5Nb6SrfCNZq55v7xb7EgKNxneyEu/view), nicht allein mit der SL-Zusammenfassung. Seitenangaben sind gedruckte Buchseiten.

| Originalstelle | Gegenprüfung in Phase A |
| --- | --- |
| S. 96, Spezialitäten | Eigenschaft 4+ begründet die Spezialisierung; Zehner-Doppelwertung bei passender Anwendung. Die Besitz-/Anwendungsprüfung bleibt Phase B/F. |
| S. 99, 103, 105–106, Fähigkeitsgruppen | Untrainierte Talente, +1 SG bei Fertigkeiten ohne Wert, grundsätzlich gesperrte Kenntnisse mit ausdrücklichen Ausnahmen. |
| S. 249–251, Schwierigkeiten / Patzer / automatischer Erfolg | Erfolge und Einsen getrennt; ein ursprünglich erfolgreicher Würfel verhindert den normalen Patzer. Automatischer knapper Erfolg nur im geeigneten Kontext. |
| S. 267, Willenskraft | Vor dem Wurf ansagen, ein Punkt pro Runde, geschützter Erfolg; nicht pauschal für jede Aktion zulässig. |
| S. 273–274, Schaden / Absorbieren | Die allgemeinen Erfolgsregeln gelten weiter; beide Wurftypen können nicht patzen. Ergänzende Mischvektoren `[1,6]` und `[1,6,7]` prüfen den Einserabzug, den D14/D15 allein nicht unterscheiden. |

Kein seitenweises Vollaudit des Grundbuchs, keine Prüfung aller Sonderkräfte, keine offizielle V5- oder Hausregelabnahme.

## Tests und Prüfgrenzen

| Prüfung | Ergebnis |
| --- | --- |
| Vollständiger Standard-Testlauf einschließlich neuem Core und bisherigen W10-Tests | **261/261 bestanden** |
| Gezielter Lauf mit W10, bisheriger Synchronisierung und Charakterzuständen | **60/60 bestanden**; lokales Synchronisierungsmodell, keine neue HTTP-/Echtkonto-Abnahme |
| Neuer Testbestand `tests/w10-hybrid.test.mjs` | 32 Testgruppen, enthalten im Standardlauf |
| Vollständiger 3-Würfel-Raum, SG 2–10 | 9.000 Kombinationen gegen unabhängige Erfolgs-/Patzererwartung; zusätzlich Spezialitätsvarianten |
| Würfelverteilung | 1.680 Kombinationen aus Pool 1–40, Hunger 0–5 und sieben Stressständen |
| Stress-Grenzen | Alle Ausgangswerte 0–300 mit den sechs relevanten positiven/negativen Änderungen |
| Typecheck | bestanden |
| ESLint der geänderten TypeScript-/Testdateien | bestanden |
| Produktionsbuild, nur lokal | bestanden |

Reproduzierbare Befehle bei vorhandenen Projektabhängigkeiten:

```sh
pnpm test
pnpm run test:w10-hybrid
pnpm run typecheck
pnpm exec eslint domain/w10.ts domain/w10-core.ts domain/w10-hybrid-draft.ts tests/w10-hybrid.test.mjs
pnpm run build
```

In dieser Windows-Ausführungsumgebung fehlte `npm` im Shell-PATH. Der Testbefehl aus `package.json` wurde deshalb direkt mit dem vorhandenen Node ausgeführt. Der erste Standardlauf wurde durch `EACCES` für die lokale Miniflare-Verbindung blockiert; mit erlaubter localhost-Ausführung bestand er vollständig. Die vorhandenen Abhängigkeiten wurden per lokalem `node_modules`-Junction wiederverwendet. Keine Lockfile- oder Abhängigkeitsänderung.

Der Build meldet weiterhin große Client-Chunks als Hinweis. Der Build wurde erfolgreich abgeschlossen; eine Optimierung der bestehenden Oberfläche gehörte nicht zu diesem Auftrag. Prüfprotokolle dieses Worktrees liegen privat unter `.local-work/w10/`.

### Abdeckung der Spezifikations-IDs

| IDs | Aussage |
| --- | --- |
| D01–D16 | reine Auswertung und lokale Eingabe-/Kontextprüfung bestanden |
| H01–H08 | Würfelverteilung, Flags, Rouse-Rechnung und Vorbedingung bestanden |
| H09 | verzögerter Effekt **als Vorschlag** getestet; tatsächliche Transaktionsreihenfolge noch Phase D |
| S01–S08 | reine Rechnung, Ausschlüsse und Priorität bestanden |
| S09 | keine Gruppenstressmutation im Core; echte Ablehnung über HTTP noch separat prüfen |
| S10 | Minispiel-/Ruhephasenautorisierung nicht implementiert; Phase C/D |
| W01–W04 | lokale Vorbedingungen und fehlende Seiteneffekte bestanden; persistente Rundensperre/Atomarität noch Phase D |
| X01–X08 | keine neue Hybridintegration abgenommen; vorhandene Synchronisierung ersetzt diese Prüfung nicht |
| Statistik 16.3 | **nicht ausgeführt**; separates Balancing-Gate vor Hausregelfreigabe |

Keine neue Browseroberfläche in Phase A; deshalb keine persönliche UX-/Echtkonto-Abnahme oder Prüfung der Hybridregeln im Spieltisch behauptet.

## Nächster begrenzter Auftrag für Claude Code

1. Diesen Branch und den aktuellen `main` vergleichen, fremde Änderungen schützen, Phase-A-Tests reproduzieren. Vorhandene APIs und Renderer erhalten.
2. Phase B lokal: stabile Auswahl-IDs auf die vorhandenen deutschen Bogenwerte abbilden; serverseitige Poolableitung und transparente Vorschau einschließlich Modifikatorherkunft. Freie Pool-/Face-/Ressourcenangaben dürfen den verbindlichen Pfad nicht bestimmen.
3. Phase B abnehmen, bevor Phase C/D beginnt. Stress-/Hunger-Konversion und SG-Policy sind offene Entscheidungen, keine stillen Datenmigrationen.
4. Phase C: Hausregelparameter simulieren und fachlich prüfen; bestehende Gruppenstressfunktion erhalten. Minispielabschluss und Ruhephase serverseitig validieren.
5. Phase D: vorab autorisierte Kosten, Rundensperren, versionierte unveränderliche Events, Idempotenz und atomare Buchungen über sämtliche betroffenen Schreibpfade nachweisen.
6. Erst anschließend Phase E mit bestehender 3D-Schale, berechtigten getrennten Logins und Reconnect prüfen. Phase F/G gesondert behandeln.

**Übergabestatus:** Phase-A-Core lokal technisch geprüft und für Review vorbereitet. Das gesamte Hybridregelsystem ist noch nicht produktions- oder livefreigegeben.
