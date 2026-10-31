# W10-Hybrid – Abnahme Phase B (Charakterintegration)

Stand: 31.10.2026. Zur Abnahme durch den Projektinhaber. Ausführliche Herleitung: [Phase-B-Bericht](PHASE-B-BERICHT.md) und [Abgleich der Entscheidungen](PHASE-B-ENTSCHEIDUNGEN-ABGLEICH.md).

## 1. Gegenstand und Grenze

- Branch `claude/w10-hybrid-phase-b`, nur lokal. Basis ist `origin/main` `02af145`; der Branch enthält den Phase-A-Kern von Codex.
- **Nicht** gepusht, keine PR, kein Deployment, keine produktiven Daten. Keine Migration, kein Schemaeingriff.
- Das Hybridprofil bleibt `1.0.0-draft`, `productionEnabled: false`. Die Würfelvorschau `/api/w10-preview` antwortet nur in der lokalen Testinstanz (`W10_HYBRID_PREVIEW=local-only`), sonst 404. Gewürfelt wird nicht, gebucht wird nichts.
- Phase C und D wurden nicht begonnen.

| Commit | Inhalt |
| --- | --- |
| `0803d15` | Phase A (Codex), übernommen |
| `d47ec09` | Phase B: Adapter, serverseitige Poolableitung, Vorschau-Route, Rechte |
| `7ab3ec0` | Abgleich der sieben Entscheidungen, Korrekturplan |
| `a76baae` / `624980f` | K3 SG über 10, K7 Charakterbindung, K5 Wundabzüge |
| `7686c0b` / `ac7bf56` | K4 Spezialisierungen, Entscheidung R4 |
| `3c5272c` | K6 eigene Fähigkeiten mit stabiler ID |
| `2360121` | K1 persönlicher Stress (nur lesend), Entscheidungen R1/R1b |
| dieser Commit | Abnahmeunterlage, lesbare Demo, Hinweistext „Kenntnis ohne Wert“ |

## 2. Abnahmekriterien des Projektinhabers → Nachweis

| Nr. | Kriterium | Nachweis | Stand |
| --- | --- | --- | --- |
| 1 | Gruppenstress und persönlicher Stress strikt getrennt | eigenes, geschütztes Feld `personalStressUnits`; Unit K1-1..3; Integration Block „stress“ (Gruppenstress vor und nach den Vorschauen gleich, Schreibversuche 403) | erfüllt für Phase B |
| 2 | Alte Charakterdaten unverändert ohne genehmigte Migration | Altwert 0–10 bleibt gespeichert und hat keine Wirkung; Blut unberührt; eigene Fähigkeiten ohne ID wortgleich (Integration „own abilities“); Spezialisierungsfeld optional; Vorschau nur lesend (Versionsprüfung) | erfüllt |
| 3 | Ungültige SG vor dem Würfeln abgelehnt | `DIFFICULTY_ABOVE_10` mit Aufschlüsselung und Hinweis; Kappung auch im Kern entfernt; Unit B05/D10; Integration „SG“ | erfüllt |
| 4 | Spezialisierungen nur bei zutreffenden Proben | Prüfung von Besitz, Ziel, Aktivität und Mindestwert 4; keine Doppelwertung ohne 10; Unit K4-1..4; Integration „specialties“ | erfüllt; R4-Bestätigung durch die SL folgt mit Phase D |
| 5 | Wundabzüge an den richtigen Pools, Ausnahmen beachtet | V20-Abzug aus der Gesundheitsleiste, einmalig, vor den Sonderwürfeln; handlungsunfähig blockiert; Unit K5; Integration „wounds“ | erfüllt für gewöhnliche Proben; **Ausnahmen offen bis zur Quellprüfung** |
| 6 | Eigene Fähigkeiten per stabiler ID auswähl- und berechenbar | `custom:cab_…`, Kategorie, Umbenennen, Deaktivieren, Verwechslungsschutz; Unit K6-1..4; Integration „own abilities“ | erfüllt für neue Einträge; Bestand ohne ID wartet auf M6 |
| 7 | Jeder Wurf eindeutig einem berechtigten Charakter zugeordnet | laufender Abend Pflicht; nur der ausgewählte, spielbereite Charakter; kein Rückfall auf andere Figuren des Besitzers; fremde Figuren 404; Integration „binding“, „rights“ | erfüllt für die Vorschau; Prüfung auf Charakterwechsel beim verbindlichen Wurf und NSC-Weg folgen in Phase D |
| 8 | Wiederholte Requests ohne doppelte Würfe oder Ressourcen | Die Vorschau ist nur lesend, wiederholte Aufrufe ändern nichts (Integration „read-only“, zweiter Lauf auf demselben Speicher grün) | **Würfe und Buchungen: Phase D** |
| 9 | Bestehende Systeme funktionsfähig | Standardlauf 282/282; ULTIO-Pager- und Zustandswerte-Integration; Browsertest der Charakterverwaltung bei 1440 und 375 px; `/api/live-table`, 3D-Würfel, `use-shared-dice.ts` und die 30-Würfel-Grenze unverändert | erfüllt |

## 3. Letzter Prüflauf (frisch gebaut, frische Instanz)

| Prüfung | Ergebnis |
| --- | --- |
| `pnpm test` (Standardlauf) | 282/282 bestanden |
| `test:w10-hybrid` | 81/81 bestanden |
| `tests/w10-hybrid-integration.mjs` (SL, Spieler A, Spieler B; 11 Prüfblöcke) | bestanden, auch im Wiederholungslauf |
| ULTIO-Pager-, Zustandswerte-Integration | bestanden |
| Browsertest der Charakterverwaltung (Stand K6, danach keine Oberflächenänderung) | bestanden |
| Typecheck, ESLint der geänderten Dateien, lokaler Build | bestanden |

## 4. Selbst prüfen

```powershell
cd C:\Users\Stenz\Documents\ChroniPlay-Claude\cvk-w10
.\scripts\start-w10-hybrid.ps1 -Build      # Port 8878, nur synthetische Daten
```

In einem zweiten Fenster:

```powershell
cd C:\Users\Stenz\Documents\ChroniPlay-Claude\cvk-w10
node --experimental-strip-types scripts/w10-preview-demo.mjs          # lesbare Vorschauen mit Herkunft
node --experimental-strip-types tests/w10-hybrid-integration.mjs      # vollständige Abnahmeprüfung
```

Ohne `node` im PATH das Präfix aus der Phase-A-Übergabe verwenden. Anmeldung im Browser unter `http://127.0.0.1:8878/anmelden`: `command-gm@`, `command-a@`, `command-b@example.invalid`; das Passwort steht in `scripts/test-local.mjs`.

**Sichtprüfung in der Oberfläche (als SL):** Command Center → Spieler & Charaktere → Demo Spieler B → Bogen ansehen → Verwaltung → Bogen bearbeiten → Bereich „Fähigkeiten“:
1. Spezialisierung hinzufügen, „Schusswaffen“ wählen und benennen. Bei 3 Punkten erscheinen Hinweis und Sperre; nach dem Erhöhen auf 4 lässt sich speichern.
2. Unter „Zusätzliche Fähigkeiten“ eine Fähigkeit hinzufügen. Ohne Kategorie ist das Speichern gesperrt; der Name „Nahkampf“ wird abgelehnt.
3. Nach dem Speichern zeigt der Reiter „V20-Bogen“ die Spezialisierung.

## 5. Offen nach Phase B (bewusst, nicht Teil dieser Abnahme)

| Punkt | Zuständig |
| --- | --- |
| R4-Ablauf: SL setzt die Spezialisierung bei Probenaufforderungen, Einspruch mit Neuauswertung derselben Würfel | Phase D |
| Charakterwechsel zwischen Vorschau und Wurf; idempotente, atomare Würfe und Buchungen | Phase D |
| Würfelweg der SL für NSC | eigener Auftrag |
| Ausnahmen vom Wundabzug (Absorption, Schaden, Körperkraft-Schaden, Aufheben) | Quellprüfung, dann Umsetzung |
| Schreiben und Würfelwirkung des persönlichen Stresses; Altwert am Spieltisch nur noch lesend | Phase C/D bzw. Aktivierung |
| Migration Blut → Hunger (M2), eigene Fähigkeiten ohne ID (M6) | nur nach gesonderter Freigabe |
| XP-Käufe eigener Fähigkeiten über die ID; Spezialisierungen im Erschaffungseditor | Folgeaufträge |
| Mehrere Spezialisierungen je Eigenschaft nach V20 | Quellprüfung |

## 6. Abnahmeerklärung

- [ ] Phase B ist im beschriebenen Umfang abgenommen.
- [ ] Freigabe für einen Push des Branches und einen Pull Request (kein Merge und kein Deployment ohne weitere Freigabe).

Datum / Projektinhaber: ____________________
