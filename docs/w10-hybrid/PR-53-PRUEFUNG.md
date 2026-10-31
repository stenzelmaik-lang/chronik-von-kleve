# Technische Prüfung PR #53 – W10-Hybrid Phase B

Stand: 31.10.2026, zuletzt aktualisiert nach dem Push der Prüfkorrekturen. Geprüft von Claude Code im Auftrag des Projektinhabers. Ohne Merge, ohne Deployment, ohne Beginn von Phase C oder D.

PR: https://github.com/stenzelmaik-lang/chronik-von-kleve/pull/53 · Branch `claude/w10-hybrid-phase-b` → `main` (`6ed3896`).

## Ergebnis in Kürze

**Empfehlung: PR #53 kann zusammengeführt werden.** Der ursprüngliche PR-Stand `5de954a` hatte eine echte Regression (Befund F1): Charaktere, deren eigene Fähigkeiten eine ID haben, ließen sich über die allgemeine Records-Route nicht mehr speichern. Die Korrektur liegt im PR, Commit **`7653031`** (gepusht, ohne Force-Push). Die vom Projektinhaber verlangte Kennzeichnung „Vorbereitung ohne Würfelwirkung“ folgt im nächsten Commit (Abschnitt 7). Ein Merge nach `main` löst nach aktuellem Befund **kein** automatisches Deployment aus (Abschnitt 8).

## 1. Prüfumfang

| Prüfpunkt | Ergebnis |
| --- | --- |
| Konflikte mit `main` | keine; `main` (`6ed3896`, PR #52) ist im Branch enthalten (Merge-Commit `5de954a`). GitHub meldet ebenfalls keine Konflikte. |
| GitHub-Checks | **Für diesen PR läuft kein Check.** Der einzige Workflow (`story-editor-checks.yml`) wird bei Pull Requests nur durch Story-Editor-Pfade ausgelöst, die der PR nicht berührt. Nach einem Merge läuft er auf `main` (Typecheck, Tests, Build, vollständige HTTP-Integration). Diese Schritte habe ich deshalb lokal ausgeführt (siehe Abschnitt 4). Den Status in GitHub konnte ich nicht direkt lesen: Die GitHub-CLI fehlt hier, und das Repository ist privat. |
| Umfang des Diffs | 30 Dateien, davon 12 neu im Code (W10-Kern, Adapter, Spezialisierungen, eigene Fähigkeiten, Stress, Vorschau-Route), 5 Dokumente; geändert: Records-, Engine- und Projektionspfade, Bogeneditor und Bogenansicht, Testskripte. Keine Schemamigration, keine Abhängigkeitsänderung. |

## 2. Auswirkungen auf bestehende Funktionen

Nach einem Merge und einem späteren Deployment ändert sich für Nutzer Folgendes, **auch wenn das Hybrid-Würfelsystem noch nicht freigegeben ist**:

| Bereich | Änderung | Bewertung |
| --- | --- | --- |
| Bogeneditor (SL bzw. freigegebene Spielerbearbeitung) | neuer Abschnitt „Spezialisierungen“; eigene Fähigkeiten mit Kategorie und „Aktiv“ | gewollt (Entscheidungen 4 und 6). Spezialisierungen werden gespeichert und angezeigt, wirken aber erst mit dem freigegebenen Würfelsystem. |
| Bogenansicht | zeigt Spezialisierungen | gewollt |
| Bogenvalidierung (`validateExistingSheet`) | prüft zusätzlich Spezialisierungen und eigene Fähigkeiten **mit ID** | betrifft keine Bestandsbögen: Bestandseinträge haben kein `id` und keine `specialties`. Eine Untersuchung des Codes ergab keinen Schreibweg, der bisher IDs in `customAbilities` gesetzt hätte. |
| Records-Route | `personalStressUnits` geschützt; eigene Fähigkeiten werden validiert, aber nicht mehr umgebaut (F1) | Schutz gewollt; F1 siehe unten |
| XP-Ziele | deaktivierte eigene Fähigkeiten werden nicht mehr zum Kauf angeboten (F2) | Korrektur |
| Live-Würfel (`/api/live-table`, 3D, `use-shared-dice.ts`) | einzige Berührung: `evaluateNormalV20` rechnet über den neuen Kern `evaluateV20` | gleichwertig, belegt durch die Phase-A-Tests (vollständiger Raum mit 3 Würfeln, Referenzvektoren, Prototyp-Tests). Ergebnisformat und Grenze von 30 Würfeln unverändert. Neu werden nur lückenhafte Arrays abgelehnt, die aus gespeichertem JSON nicht entstehen können. |
| `/api/w10-preview` | neu | in Produktion 404 (Bindung `W10_HYBRID_PREVIEW=local-only` fehlt dort; Unit-Test B09 prüft, dass die Wrangler-Konfiguration sie nicht enthält) |
| `scripts/test-local.mjs` | neue Option `--w10-hybrid`; Konflikt mit `--vision-assets` aufgelöst | ohne Option unverändert; vollständige Integration grün |

## 3. Befunde

| Nr. | Schwere | Befund | Status |
| --- | --- | --- | --- |
| F1 | **hoch** (Regression im Stand `5de954a`) | Das Body-Schema der Records-Route prüfte `customAbilities` mit einem nicht-strikten Zod-Objekt. Dabei wurden `id` und `active` stillschweigend entfernt und die übrigen Schlüssel umsortiert. Folgen: (a) Ein unverändertes Speichern über die allgemeine Route scheiterte bei bestätigten Bögen für Spieler **und** SL mit 400 („Geschützte Bogenwerte …“ bzw. „Bestätigte permanente Charakterwerte sind gesperrt.“), weil der reihenfolgeabhängige Vergleich eine Änderung sah. (b) Bei nicht geschützten Bögen wären IDs und der Deaktiviert-Status still verloren gegangen. Ohne IDs war dieser Fall lokal grün (200); mit ID lieferte er 400. | **behoben in `7653031`**: Die Route validiert eigene Fähigkeiten nur noch und behält Inhalt und Reihenfolge unverändert (`app/api/records/route.ts`). Regressionstest im Integrationstest: Ein unverändertes Speichern gibt 200, ID und `active` bleiben erhalten. |
| F2 | niedrig | Deaktivierte eigene Fähigkeiten erschienen als XP-Kaufziel. | **behoben in `7653031`** (`server/character-engine-service.ts`), Integrationstest ergänzt |
| F3 | niedrig (Dokumentation) | Der Phase-B-Bericht sagte, die Kategorie werde nie automatisch gesetzt. Das ältere Bestandsformular schlägt aber wie bisher sichtbar „Kenntnis“ vor. | Bericht korrigiert in `7653031` |
| F4 | Hinweis | Der Workflow auf `main` prüft ESLint nur für Story-Editor-Dateien. Die W10-Dateien sind lokal lint-sauber, werden in CI aber nicht gelintet. | kein Handlungsbedarf für den Merge |

Weitere geprüfte Punkte ohne Befund: Rechte (fremde Charaktere 404, Same-Origin, Login), keine SL-Daten in der Vorschau, strikte Ablehnung freier Clientwerte, Freigabegrenze der Vorschau, unveränderte Altwerte (Blut, Stress 0–10, eigene Fähigkeiten ohne ID).

## 4. Tests

Auf dem Stand `7653031` (PR-Stand `5de954a` plus die Prüfkorrekturen):

| Prüfung | Ergebnis |
| --- | --- |
| Standardlauf (`npm test`) | 289/289 bestanden |
| `test:w10-hybrid` | 81/81 bestanden |
| Vollständige HTTP-Integration (`test:integration:run`, wie im CI auf `main`) | 1.930 Prüfungen bestanden + 46 D1-Rollenprüfungen, Exit 0 (die D1-Fehlermeldung im Log stammt aus einem absichtlich ausgelösten Fehlertest, M2.4) |
| `tests/w10-hybrid-integration.mjs` (SL, Spieler A, Spieler B; frische Instanz) | bestanden, mit neuem F1/F2-Regressionstest |
| ULTIO-Pager-, Zustandswerte-Integration | bestanden |
| Browsertest der Charakterverwaltung (Edge, 1440/375 px) | 10/10 bestanden |
| Typecheck, ESLint der geänderten Dateien, Produktionsbuild | bestanden |

Zur Einordnung: Die vollständige HTTP-Integration lief auch auf dem unveränderten PR-Stand grün (1.930 Prüfungen). F1 fand erst die gezielte Prüfung. Die vorhandene Suite enthält keinen Charakter mit eigener Fähigkeit samt ID.

## 5. Abgleich der Entscheidungen K1–K7

| Nr. | Entscheidung (Kurz) | Umsetzung im PR | Erfüllt |
| --- | --- | --- | --- |
| K1 | Stress getrennt; neuer Wert 0–300; Altwert ohne Wirkung; Gruppenstress nur SL | eigenes, geschütztes Feld `personalStressUnits`, in Phase B nur lesend; Start 0 als „nicht erfasst“ (R1b); Altwert sichtbar ohne Wirkung (R1); Gruppenstress unberührt | ja (Schreiben und Wirkung: Phase C/D) |
| K2 | Hunger langfristig, keine Umrechnung von Blut | Blut wird weder gelesen noch verändert; Migration M2 nur als Konzept | ja |
| K3 | SG > 10 ungültig, keine Kappung | Ablehnung mit Aufschlüsselung und Hinweis; Kappung auch aus dem Kern entfernt | ja (Grenze für Stressmali: Phase C) |
| K4 | Spezialisierungen im Bogen und in der Engine | Feld, Validierung, Editor, Anzeige, Anwendung nur bei Passung, mindestens 4 Punkte; R4 dokumentiert | ja (R4-Ablauf: Phase D) |
| K5 | Wundabzüge vollständig, Ausnahmen beachten | V20-Abzug aus der Gesundheitsleiste, einmalig, vor den Sonderwürfeln; Ausnahmen bewusst blockiert und ausgewiesen | teilweise: gewöhnliche Proben ja; Ausnahmen offen bis zur Quellprüfung |
| K6 | eigene Fähigkeiten mit stabiler ID | ID, Kategorie, Aktiv, Verwechslungsschutz, Auswahl, Spezialisierungen; Bestand unberührt (M6) | ja für neue Einträge; mit F1-Korrektur auch über die allgemeine Route stabil |
| K7 | nur ausdrücklich gewählter Charakter in der Sitzung | laufender Abend, Auswahl im Profil, spielbereit, kein Rückfall; SL auf Spielercharaktere des Abends beschränkt | ja für die Vorschau (Charakterwechsel beim Wurf und NSC-Weg: Phase D bzw. eigener Auftrag) |

## 6. Empfehlung und nächste Schritte

1. Prüfkorrekturen sind gepusht (`7653031`). Die Kennzeichnung nach der Veröffentlichungsentscheidung ist im Folgecommit enthalten (Abschnitt 7).
2. PR #53 ist aus technischer Sicht **sicher zusammenführbar**: keine Konflikte, keine Migration, Produktionspfad der Live-Würfel gleichwertig, Vorschau in Produktion deaktiviert, alle verfügbaren Prüfungen grün.
3. Veröffentlichung: Der Projektinhaber hat entschieden, dass Spezialisierungen und die neuen Felder eigener Fähigkeiten sichtbar werden dürfen, gekennzeichnet als Vorbereitung ohne aktive Würfelwirkung (umgesetzt, Abschnitt 7). Ein Deployment bleibt eine eigene Freigabe.
4. Nicht Teil dieses PR: Phase C/D, NSC-Würfelweg, Wund-Ausnahmen, Migrationen M2/M6.

Merge und Deployment erfolgen nur nach ausdrücklicher Freigabe des Projektinhabers.

## 7. Veröffentlichungsentscheidung: Kennzeichnung als Vorbereitung

Entscheidung des Projektinhabers (31.10.2026): Spezialisierungen und die neuen Felder eigener Fähigkeiten dürfen sichtbar werden, müssen aber als Vorbereitung ohne aktive Hybrid-Würfelwirkung gekennzeichnet sein.

Umsetzung: `hybridPreparationNote()` in `domain/character-specialties.ts` liefert den Hinweis „Vorbereitung für das Hybrid-Würfelsystem: wird gespeichert und angezeigt, hat aber noch keine Würfelwirkung.“, solange das Profil nicht freigegeben ist (`productionEnabled: false`). Nach der Freigabe liefert die Funktion einen leeren Text, und der Hinweis verschwindet. Er erscheint
- im Bogeneditor über „Spezialisierungen“,
- im Bogeneditor über „Zusätzliche Fähigkeiten“ (für Kategorie und „Aktiv“),
- in der Bogenansicht über der Liste der Spezialisierungen.

Ein Unit-Test sichert die drei Stellen und den Profilstatus.

## 8. Löst ein Merge nach `main` ein Deployment aus?

| Weg | Befund |
| --- | --- |
| GitHub Actions | **nein.** Einziger Workflow ist `story-editor-checks.yml` (Typecheck, Tests, Build, Integration); er enthält keinen Deploy-Schritt. |
| Cloudflare Workers Builds (Git-Integration) | **Konfiguration vorhanden, nach Befund nicht aktiv.** Laut `docs/pre-alpha-v0.1.037/phase-c/Technical-Handover.md` ist für `main` `npm run build` und `npx wrangler deploy` hinterlegt; laut `docs/spieltisch-2-0/Etappe-2-Medien.md` war der automatische Build am 30.10. pausiert. Eine Prüfung über `wrangler deployments list` (31.10., nur lesend) bestätigt das: Die Merges #47, #49, #50 und #51 nach `main` erzeugten **kein** Deployment. Alle Deployments sind manuelle, getaggte Uploads einzelner Commits. Das Deployment von `6ed3896` (Merge von #52) erfolgte 46 Sekunden nach dem Merge, mit eigener Nachricht und eigenem Tag; das spricht für einen manuellen Upload, ein Build mit Installation dauert deutlich länger. |
| Sonstige Integrationen | keine im Repository erkennbar |

**Ergebnis:** Ein Merge von PR #53 ist nach aktuellem Befund ohne automatisches Deployment möglich. **Restrisiko:** Den Schalter der Workers-Builds-Integration im Cloudflare-Dashboard kann ich aus dem Repository nicht lesen. Wer ganz sicher gehen will, prüft vor dem Merge unter Workers & Pages → `chronik-von-kleve` → Settings → Build, dass automatische Production-Deployments für `main` deaktiviert sind. Nach dem Merge zeigt `wrangler deployments list`, dass keine neue Version aktiv wurde. Selbst bei einem ungewollten Deployment bliebe die Würfelvorschau in Produktion deaktiviert (404). Live gingen dann die geprüften Bogenänderungen dieses PR: gekennzeichnete Bogenfelder, erweiterte Validierung, Records-Korrektur.
