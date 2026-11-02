# CP2-07B – Originalauswertung und Regelversion von Würfen

Stand: 02.11.2026 · Ergebnis: lokal implementiert und geprüft; nicht veröffentlicht.

## Basis und Umfang

- Branch: `codex/cp2-07b-roll-snapshot`.
- Vorheriger lokaler Alpha-2-Stand: `41b22c9`.
- Produktiver Teilnehmer-Hotfix: `25ceef7`, im isolierten Arbeitsstand konfliktfrei durch Merge `7f2169f` übernommen.
- Vorhandene Arbeitsstände und der Hotfix-Checkout wurden nicht verändert.

## Verhalten

Neue freie Würfe speichern ihre Originalauswertung im vorhandenen `report`-Feld. Neue freie Würfe erhalten `rulesVersion: v20-normal-1`; neue Charakterproben `rulesVersion: v20-c1-ordinary-1`. Die Kennungen beschreiben die jeweiligen bestehenden Live-Auswertungen, nicht die separat vorhandene Hybrid-Draft-Version.

Die Bühne übernimmt gespeicherte Reports unverändert und reicht eine vorhandene Versionskennung weiter. Bei alten Ereignissen ohne Report bleibt der bestehende lesende Auswertungs-Fallback erhalten. Historischen Ereignissen wird weder eine vermeintliche Originalauswertung noch eine erfundene Regelversion nachträglich gespeichert.

Keine neuen Regeln, Ressourcenbuchungen, Berechtigungen oder Tabellen. Teilnehmer-Hotfix und Empfängergrenzen bleiben erhalten. Bei späteren fachlichen Änderungen müssen die zugehörigen Versionskennungen bewusst fortgeschrieben werden.

## Ausgeführte Prüfungen

| Prüfung | Ergebnis |
|---|---|
| Projekt-Standardtests (`node --run test`) | 340/340 bestanden, keine übersprungenen Tests |
| C1-Regeltests | 11/11 bestanden |
| Vollständige isolierte Integration | 2.011 Prüfungen bestanden, Exitcode 0 |
| Rollen-/Migrationsprüfungen im Integrationslauf | 46 bestanden; zusätzlich atomarer D1-Rollback geprüft |
| GE-02-Integration in separater synthetischer Instanz | bestanden, einschließlich gespeicherter Charakterauswertung und Versionsweitergabe |
| GE-01-Integration in derselben synthetischen Instanz | bestanden, einschließlich Replay und Empfängergrenzen |
| Typprüfung | bestanden |
| ESLint der geänderten TypeScript-Dateien | bestanden |
| Build | bestanden |
| `git diff --check` | bestanden |

Der neue Regressionstest verwendet eine gespeicherte Interpretation, die absichtlich vom Ergebnis des heutigen freien Auswerters abweicht. Er bestätigt damit den Vorrang der Originalauswertung und nicht nur Gleichheit zweier Neuberechnungen. Ein weiterer Test prüft den lesbaren Altbestand ohne nachträglich hinzugefügte Metadaten.

Die Integration prüft einen gespeicherten freien Report über das Live-Ereignis, die Weitergabe im Bühnen-Snapshot und die unveränderte Interpretation bei identischer Wiederholung. Die enthaltenen Nachzüglerprüfungen des Teilnehmer-Hotfixes bestanden ebenfalls.

## Grenzen

- Standardtests sind der vorhandene Projekt-Standardlauf; dies ist keine Behauptung, sämtliche außerhalb dieses Laufs vorhandenen Testdateien ausgeführt zu haben.
- Der Build enthält weiterhin die bekannte Vinext-Meldung zur statischen Routenklassifizierung.
- In der Fehlerausgabe der erfolgreichen Integration stehen absichtlich ausgelöste Datenbankfehler aus den bestandenen Rollback-Prüfungen.
- Der GE-Teststart wurde einmal anhand eines nicht sofort sichtbaren Logmarkers abgewartet; dieser Warteprozess wurde beendet und die tatsächlich laufende Fixture per HTTP geprüft. Danach wurden GE-02 und GE-01 jeweils einmal erfolgreich ausgeführt.
- Keine neue Browser-/Geräteabnahme und kein GitHub-CI-Lauf für diesen lokalen Stand.
- Kein Push, kein Remote-Merge, keine Migration, keine Produktivdatenänderung und kein Deployment.

Der lokale Merge des bereits produktiven Hotfixes ist eine Basisintegration im neuen Arbeitsstand und keine Veröffentlichung des Alpha-2-Pakets.
