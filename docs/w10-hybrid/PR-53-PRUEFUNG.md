# Technische Prüfung PR #53 – W10-Hybrid Phase B

Stand: 31.10.2026. Geprüft von Claude Code im Auftrag des Projektinhabers. Ohne Merge, ohne Deployment, ohne Beginn von Phase C oder D.

PR: https://github.com/stenzelmaik-lang/chronik-von-kleve/pull/53 · Branch `claude/w10-hybrid-phase-b` → `main` (`6ed3896`).

## Ergebnis in Kürze

**Empfehlung: Zusammenführen ist sicher, sobald die beiden Prüfkorrekturen dieses Berichts im PR liegen.** Der PR-Stand `5de954a` hatte eine echte Regression (Befund F1): Charaktere, deren eigene Fähigkeiten eine ID haben, ließen sich über die allgemeine Records-Route nicht mehr speichern. Die Korrektur ist lokal umgesetzt und getestet, aber noch **nicht** gepusht. Ohne diese Korrektur rate ich vom Merge ab.

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
| F1 | **hoch** (Regression) | Das Body-Schema der Records-Route prüfte `customAbilities` mit einem nicht-strikten Zod-Objekt. Dabei wurden `id` und `active` stillschweigend entfernt und die übrigen Schlüssel umsortiert. Folgen: (a) Ein unverändertes Speichern über die allgemeine Route scheiterte bei bestätigten Bögen für Spieler **und** SL mit 400 („Geschützte Bogenwerte …“ bzw. „Bestätigte permanente Charakterwerte sind gesperrt.“), weil der reihenfolgeabhängige Vergleich eine Änderung sah. (b) Bei nicht geschützten Bögen wären IDs und der Deaktiviert-Status still verloren gegangen. Ohne IDs war dieser Fall lokal grün (200); mit ID lieferte er 400. | **behoben** (lokal): Die Route validiert eigene Fähigkeiten nur noch und behält Inhalt und Reihenfolge unverändert. Regressionstest im Integrationstest: Ein unverändertes Speichern gibt 200, ID und `active` bleiben erhalten. |
| F2 | niedrig | Deaktivierte eigene Fähigkeiten erschienen als XP-Kaufziel. | **behoben** (lokal), Integrationstest ergänzt |
| F3 | niedrig (Dokumentation) | Der Phase-B-Bericht sagte, die Kategorie werde nie automatisch gesetzt. Das ältere Bestandsformular schlägt aber wie bisher sichtbar „Kenntnis“ vor. | Bericht korrigiert |
| F4 | Hinweis | Der Workflow auf `main` prüft ESLint nur für Story-Editor-Dateien. Die W10-Dateien sind lokal lint-sauber, werden in CI aber nicht gelintet. | kein Handlungsbedarf für den Merge |

Weitere geprüfte Punkte ohne Befund: Rechte (fremde Charaktere 404, Same-Origin, Login), keine SL-Daten in der Vorschau, strikte Ablehnung freier Clientwerte, Freigabegrenze der Vorschau, unveränderte Altwerte (Blut, Stress 0–10, eigene Fähigkeiten ohne ID).

## 4. Tests

Auf dem Endstand (PR-Stand `5de954a` plus die Prüfkorrekturen):

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

1. **Prüfkorrekturen in den PR pushen** (ein Commit auf `claude/w10-hybrid-phase-b`, kein Force-Push). Erst danach mergen.
2. Danach ist PR #53 aus technischer Sicht **sicher zusammenführbar**: keine Konflikte, keine Migration, Produktionspfad der Live-Würfel gleichwertig, Vorschau in Produktion deaktiviert, alle verfügbaren Prüfungen grün.
3. Vor einem **Deployment** bewusst entscheiden: Bogeneditor und Bogenansicht zeigen dann Spezialisierungen und die neuen Felder eigener Fähigkeiten, obwohl das Würfelsystem noch nicht aktiv ist.
4. Nicht Teil dieses PR: Phase C/D, NSC-Würfelweg, Wund-Ausnahmen, Migrationen M2/M6.

Merge und Deployment erfolgen nur nach ausdrücklicher Freigabe des Projektinhabers.
