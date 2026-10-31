# W10-Hybrid – Abgleich der Projektinhaberentscheidungen mit Phase B

Stand: 31.10.2026. Branch `claude/w10-hybrid-phase-b` (lokal, `d47ec09`). Grundlage: die sieben Entscheidungen des Projektinhabers zu Phase B, der [Phase-B-Bericht](PHASE-B-BERICHT.md) und der tatsächliche Code.

## Umsetzungsstand

| Korrektur | Stand |
| --- | --- |
| K3 SG über 10 | **umgesetzt** (lokal): Ablehnung `DIFFICULTY_ABOVE_10` mit Grund-SG, Modifikatoren, Summe und Hinweistext. `cap_at_10` ist aus dem Phase-A-Kern entfernt; ein mitgesendetes Policy-Feld führt im Kern zu `INVALID_DIFFICULTY_POLICY` und an der Route zu 400. |
| K7 Charakterbindung | **umgesetzt** (lokal): `sessionId` ist Pflicht, der Spielabend muss laufen. Spieler würfeln nur mit der im Profil gewählten, spielbereiten Figur. Ohne Auswahl, mit einer anderen Auswahl, mit einem Entwurf oder einem Bogen in Prüfung gibt es 409; fremd oder unbekannt 404. Die SL ist auf Spielercharaktere des Abends beschränkt. Offen: NSC-Weg, Wechselprüfung beim verbindlichen Wurf (Phase D). |
| K5 Wundabzüge | **umgesetzt** für gewöhnliche Proben: Der Abzug aus der bestehenden Gesundheitsleiste (`readVitals`) wird einmal vom Pool abgezogen, bevor Sonderwürfel verteilt werden. Außer Gefecht, Torpor und endgültiger Tod führen zu `INCAPACITATED`. Ist der Pool leer, gilt `NO_DICE` ohne Ersatzwürfel. Die Ausnahmen (Absorption, Schaden, Körperkraft-Schaden, Aufheben von Abzügen) bleiben bis zur Quellprüfung offen und stehen sichtbar in `notApplied`. |
| K4 Spezialisierungen | **umgesetzt** (lokal): Feld `specialties` im Bogen, Editor und Bogenansicht; serverseitige Anwendung in der Vorschau. Details unten. R4 ist entschieden (siehe unten). Offen: Erschaffungseditor für Engine-Entwürfe, Primärquellenprüfung zur Anzahl je Eigenschaft. |
| K6, K1 | offen |

**Ursprünglich war dieses Dokument nur ein Plan.** Gegenüber `d47ec09` ändert es weder Code noch Daten. Es beginnt nicht mit Phase C oder D und nimmt keine Migration vor.

## Übersicht

| Nr. | Entscheidung | Ist-Stand im Repository | Phase-B-Stand `d47ec09` | Bedarf |
| --- | --- | --- | --- | --- |
| 1 | Zwei getrennte Stressressourcen | Gruppenstress (`stress`, 0–10) und persönlicher Stress (`personal[characterId]`, 0–10, nur manuell durch die SL) liegen **im selben JSON-Dokument** `settings[stateKey(campaign)]` (`domain/character-vitals.ts`, `server/live-vitals.ts`). `personalStressUnits` 0–300 gibt es nicht. | Stress wird nicht angewandt (`notApplied`). | Neuer, getrennter Speicher. Bestandsfrage zu `personal` 0–10 (siehe R1). |
| 2 | Hunger 0–5 langfristig, keine Umrechnung | `blood`, `bloodMax`, `bloodPerRound`, `generation` im Charakterbogen; Generationstabelle V20 S. 270 in `character-vitals.ts`. Kein Hungerfeld. | Blut wird weder gelesen noch verändert. | Keine Phase-B-Korrektur. Nur die Migrationsvorbereitung ist dokumentiert (Abschnitt M2). |
| 3 | SG > 10 ungültig, keine Kappung | Phase-A-Core kennt `difficultyOverflow: 'cap_at_10'`. | **Abweichung:** Die Route akzeptiert `difficultyOverflow: 'cap_at_10'`. | Korrektur K3 |
| 4 | Spezialisierungen verbindlich | Kein Spezialisierungsfeld in `characterSheetFields`, Editor oder Engine. `evaluateV20` unterstützt `specialtyApplies` bereits. | `specialtyApplies` ist immer `false`. | Korrektur K4 (additives Feld, keine Migration) |
| 5 | Wundabzüge integrieren | Vorhanden: `vitalHealthLevels` mit V20-Abzügen (0/−1/−1/−2/−2/−5/handlungsunfähig) und `readVitals(body).health.penalty`, Quelle laut Code V20 S. 284 f. | **Abweichung:** Wunden werden nicht angewandt. | Korrektur K5 |
| 6 | `customAbilities` vollwertig | Einträge `{name, value}` ohne ID und ohne Kategorie, teils als Freitext-String (`character-detail.tsx`). XP-Käufe adressieren den **Namen**. | Nicht auswählbar. | Korrektur K6 für neue Einträge. Für den Bestand nur Inventur und Migrationskonzept (M6). |
| 7 | Nur ausdrücklich gewählter Charakter in der aktiven Sitzung | Auswahl `auth_profiles.preferences.activeCharacters[campaign]` (`server/character-selection.ts`). Spieltisch: Teilnehmer des Raums, Entwürfe und Charaktere in Prüfung ausgeschlossen. **Ohne gültige Auswahl zeigt `tableCharacters` alle spielbaren Figuren des Besitzers.** | **Abweichung:** `ownedActiveCharacter` prüft weder die Auswahl noch die Sitzung. Engine-Entwürfe und Charaktere in Prüfung sind erlaubt. | Korrektur K7 |

## Korrekturen in Phase B (vor der Phase-B-Abnahme)

### K3 – Schwierigkeit über 10 ablehnen
- `difficultyOverflow` aus dem Route-Schema entfernen. Ein Client, der es sendet, erhält 400.
- `deriveW10Preview` ruft den Core stets mit `reject` auf. Ergebnis `blocked: DIFFICULTY_ABOVE_10` mit Grund-SG, jedem Modifikator samt Herkunft, ungekappter Summe und dem deutschen Hinweis „V20 erlaubt nur SG 2–10; die SL kann Probe oder Umstände ändern“.
- `cap_at_10` aus `domain/w10-hybrid-draft.ts` entfernen, damit kein späterer Pfad still kappt. Die Phase-A-Tests D10/D11 und ihre Gegenstücke werden auf Ablehnung umgestellt. Davon ist nur Draft-Code betroffen.
- Die Stressmali-Grenze (Spezifikation 9.2, „kombinierte Stress-SG-Mali maximal +2“) ist als eigene Modifikatorgruppe `stress` mit `stackingPolicy: sum_capped(+2)` vorzusehen. Sie begrenzt nur persönliche und Gruppenstressmali. Aktiv wird sie erst, wenn Stressmali tatsächlich einfließen (Phase C).
- Tests: Grund-SG 10 + ungelernte Fertigkeit → abgelehnt, ohne Würfel, ohne Kosten und ohne Ereignis. Bei Grund-SG 9 + 1 bleibt SG 10 gültig. Ein manipuliertes `difficultyOverflow` liefert 400.

### K4 – Strukturierte Spezialisierungen
Vorschlag für ein additives Bogenfeld `specialties`. Bestehende Bögen ohne das Feld bleiben unverändert.

```json
{ "id": "spec_<uuid>", "target": { "kind": "attribute|ability|customAbility", "id": "dexterity|melee|cab_<uuid>" },
  "name": "Säbel", "scope": "Kurzbeschreibung des Geltungsbereichs", "active": true }
```
- Validierung (Engine und `validateExistingSheet`): Ziel existiert. Die Eigenschaft hat nach V20 S. 96 mindestens 4 Punkte. Höchstens eine aktive Spezialisierung je Ziel, sofern die Primärquelle nichts anderes sagt (**prüfen**). Die ID ist eindeutig. Die Pflicht-Fachrichtung bei Handwerk, Technologie usw. bleibt ein **getrenntes** Textfeld und begründet keine Doppelwertung.
- Fällt der Wert später unter 4, bleibt die Spezialisierung gespeichert, wirkt aber nicht. Sie wird nicht gelöscht.
- Bearbeitung über die vorhandenen Wege `edit_sheet`/`sl_adjustment` und den Editor. `specialties` kommt in `characterSheetFields` und in den Bestandsschutz der Records-Route.
- Probe: Die Anfrage darf `specialtyId` nennen. Der Server prüft Besitz, Ziel (Attribut oder gewählte Fähigkeit) und Aktivität. Je Probe gilt höchstens eine Doppelwertung. Danach greifen die Einserabzüge nach V20, wie in `evaluateV20` bereits umgesetzt.
- **R4 – entschieden am 31.10.2026 durch den Projektinhaber:** (1) Bei einer **SL-Probenaufforderung** legt die SL fest, ob und welche Spezialisierung gilt. (2) Bei einem **freien Spielerwurf** beansprucht der Spieler sie selbst; der Wurf zeigt den Anspruch für die SL sichtbar markiert. (3) Hält die SL eine beanspruchte Spezialisierung **nach dem Wurf** für unpassend, werden **dieselben Würfel** ohne Doppelwertung neu ausgewertet. Es wird nicht neu gewürfelt. Das korrigierte Ergebnis wird als SL-Korrektur protokolliert, nicht als natürlicher Wurf; das ursprüngliche Ergebnis bleibt im Ereignis erhalten.

### K5 – Wundabzüge
- Quelle: `readVitals(body).health` (bestehende Leiste und Stufe). `penalty: null` (Außer Gefecht) sowie `status: torpor/final-death` → `blocked: INCAPACITATED`.
- Reihenfolge: Grundpool → Wundabzug → weitere Poolmodifikatoren → endgültiger Pool → erst dann Hunger- und Stresswürfel. Das ist erfüllt, weil Phase A die Sonderwürfel aus dem übergebenen Pool verteilt.
- Pool ≤ 0 nach Abzug → `blocked: NO_DICE`. Kein Ersatzwürfel.
- Kein Doppelabzug: eine Modifikatorgruppe `wounds` mit `stackingPolicy: single`. Die Vorschau zeigt Stufe, Abzug und Quelle.
- Ausnahmen (Absorption, Schaden, darunter die Sonderbehandlung von Körperkraft-Schadenswürfen gegenüber mechanischem Waffenschaden, und mögliche Blutausgaben gegen Wundabzüge): **gegen die V20-Primärquelle prüfen, bevor sie programmiert werden.** Phase B leitet nur `ordinary`-Proben ab. Für `damage`/`soak` blockiert der Pfad deshalb mit `WOUND_RULE_NOT_VERIFIED`, bis Quelle und Tests vorliegen.
- Tests: jede Gesundheitsstufe, Legacy-`current` ohne Leiste, Pool fällt auf 0, Außer Gefecht, kein Doppelabzug, `soak`/`damage` blockiert.

### K6 – Eigene Fähigkeiten mit stabiler ID
- Neue Einträge erhalten serverseitig `{ id: "cab_<uuid>", name, value, category: talent|skill|knowledge, active: true }`. Die Kategorie ist Pflicht.
- Auswahl per `abilityId: "custom:cab_<uuid>"`. Danach gelten dieselben Regeln wie bei Standardfähigkeiten (ungelernt, Spezialisierung, Wunden).
- Schutz: IDs sind je Charakter eindeutig, ein Name darf nicht mit einer V20-Standardfähigkeit oder einer anderen aktiven eigenen Fähigkeit verwechselbar sein (Groß-/Kleinschreibung und Leerzeichen normalisiert). Umbenennen ändert nur `name`. `active: false` deaktiviert, statt zu löschen. Historische Ereignisse speichern den Namen als Momentaufnahme.
- XP-Käufe adressieren eigene Fähigkeiten derzeit über den Namen (`server/character-engine-service.ts`, `domain/character-engine.ts`). Für neue Einträge kommt die ID hinzu; der Name bleibt als Rückfall für den Bestand.
- **Bestand ohne ID wird nicht angefasst.** Solche Einträge zeigt die Vorschau als `CUSTOM_ABILITY_NEEDS_INVENTORY` an; sie sind nicht würfelbar und gehen nicht verloren. Siehe M6.

### K7 – Charakterbindung an Auswahl und Sitzung
- Spieleranfrage: `sessionId` wird Pflicht. Der Server prüft: aktiver, gestarteter Raum. Der Akteur ist Teilnehmer. Die Figur ist **genau** die per `selectedCharacter` gewählte, gehört dem Akteur, ist nicht archiviert und nicht geheim und ist kein Engine-Entwurf und kein Charakter in Prüfung (gleiche Regeln wie `tableCharacters`).
- Ohne gültige Auswahl: `409 CHARACTER_SELECTION_REQUIRED` mit klarer Aufforderung. Der Server wählt nie automatisch, auch nicht bei genau einer Figur. Eine automatische Auswahl bei nur einer Figur nur nach ausdrücklicher Entscheidung (**Rückfrage R7**).
- Sind mehrere Figuren vorhanden und keine ist gewählt, zeigt der Spieltisch heute alle Figuren des Besitzers an. Für die Anzeige bleibt das so. Für Würfel gilt dieser Rückfall **nicht**.
- Charakterwechsel: Die Vorschau gibt `characterId` und `characterVersion` zurück. Ein späterer verbindlicher Wurf (Phase D) muss beide erneut prüfen; bei einem Wechsel zwischen Vorschau und Wurf → 409.
- SL: eigener Weg mit ausdrücklicher Charakter-ID für Spielercharaktere der Sitzung. NSC über einen getrennten, SL-exklusiven Auswahlweg (NSC-Records). Der NSC-Weg ist **nicht** Teil dieser Korrektur, sondern ein eigener Auftrag, weil NSC-Werte ein anderes Datenmodell haben.
- Die Auswahl archiviert oder deaktiviert keine anderen Figuren.

### K1 – Stress (nur Phase-B-Anteil)
- Phase B liest höchstens einen künftigen, getrennten Wert `personalStressUnits` und zeigt ihn transparent an. Schreiben, automatische Änderungen und Minispiele gehören zu Phase C/D und werden **nicht** begonnen.
- Speicherort-Vorschlag: serverseitig geschütztes Feld je Charakter (z. B. in `records.body`, eingetragen in `protectedKeys` der Records-Route und **nicht** in `characterSheetFields`) oder eine eigene Tabelle. In keinem Fall gehört es zum Gruppenstress-Dokument.
- Gruppenstress bleibt ausschließlich `op: 'stress'` durch die SL. Ein Test stellt sicher, dass kein W10-Pfad `stress` schreibt.

## Rückfragen an den Projektinhaber

| Nr. | Frage | Vorschlag |
| --- | --- | --- |
| R1 | Was geschieht mit dem bestehenden manuellen persönlichen Stress `personal[characterId]` 0–10 neben `personalStressUnits`? | Unverändert lassen und als „Altwert (manuell)“ anzeigen. Kein Würfeleinfluss, keine Umrechnung. Abschaffung nur durch eine gesonderte Entscheidung. |
| R1b | Startwert von `personalStressUnits` für bestehende Figuren? | Fehlendes Feld = „noch nicht erfasst“, rechnerisch 0, sichtbar gekennzeichnet. Keine geschriebene Initialisierung. |
| R4 | Wer bestätigt die Anwendbarkeit einer Spezialisierung? | **Entschieden:** nach Probenart (SL-Aufforderung: SL; freier Wurf: Spieler beansprucht). Einspruch der SL: Neuauswertung derselben Würfel als protokollierte Korrektur. |
| R7 | Automatische Auswahl, wenn ein Spieler genau eine spielbare Figur hat? | Nein. Einmalige ausdrückliche Auswahl. |
| R5 | Wundabzug-Ausnahmen | Erst nach Quellprüfung durch Claude/Codex mit Seitenangaben implementieren. Bis dahin blockiert der Pfad. |

## Migrationspflichtige Arbeiten (nicht freigegeben, nur Konzept)

- **M2 Blut → Hunger:** (1) schreibgeschützte Bestandsaufnahme aller `blood`, `bloodMax`, `bloodPerRound` und `generation` sowie der Disziplinkosten; (2) versioniertes Hunger-Zielmodell; (3) Regeln je Fall, unklare Fälle zur manuellen Prüfung; (4) Backup und getesteter Rollback; (5) gesonderte Freigabe. Blutwerte bleiben bis dahin unverändert und werden nie gelöscht.
- **M6 `customAbilities` ohne ID:** (1) schreibgeschützte Inventur je Charakter (Objekt oder Freitext, Name, Wert, Dubletten, Kollisionen mit Standardfähigkeiten, Bezüge in `xpLedger` und Anträgen); (2) Konzept zur ID-Vergabe mit SL-Bestätigung der Kategorie; (3) Probelauf lokal mit Kopie; (4) Backup und Rollback; (5) Freigabe. Freitext-Einträge werden nie automatisch zerlegt.
- **Kein** Migrationsbedarf: Spezialisierungen (additives Feld, Bestand bleibt leer), Wundabzüge (lesen vorhandene Leiste), SG-Ablehnung, Charakterbindung.

## Abnahmekriterien → geplante Tests

| Kriterium | Nachweis |
| --- | --- |
| 1 Stress getrennt | Unit: W10-Pfade schreiben weder `stress` noch `personal`. Integration: Gruppenstress unverändert nach Vorschauen. Schema-Test: getrennter Speicher. |
| 2 Altdaten unverändert | Integration: Hash der Records vor und nach der Testsuite identisch für Blut, eigene Fähigkeiten ohne ID und Bögen ohne Spezialisierungen. |
| 3 SG ungültig vor dem Würfeln | K3-Tests: ohne Würfel, ohne Ereignis, ohne Kosten. |
| 4 Spezialisierung nur bei Zutreffen | Unit: falsches Ziel, inaktiv, Wert < 4, fremde ID → keine Doppelwertung. Vektor D06/D07 mit Server-Snapshot. |
| 5 Wunden | K5-Tests je Stufe sowie Ausnahmen blockiert bis zur Quellprüfung. |
| 6 Eigene Fähigkeiten | Unit und Integration: Auswahl per ID, Umbenennung, Deaktivierung, Dublettenschutz, Bestand ohne ID nicht würfelbar und nicht verloren. |
| 7 Eindeutige Zuordnung | Integration SL/A/B: ohne Auswahl 409, nicht gewählte eigene Figur 409/404, fremde Figur 404, Nichtteilnehmer 404, Entwurf 409, Wechsel zwischen Vorschau und Wurf 409. |
| 8 Idempotenz | Für die Vorschau trivial (nur lesend, bereits getestet). Für verbindliche Würfe und Ressourcen: **Phase D**, dort Pflichttest. |
| 9 Bestand funktionsfähig | Standardlauf, `test:w10-hybrid`, Pager-, Zustandswerte-, Inventar- und Charakterauswahl-Integration. |

## Risiken

- **Gemeinsames Stressdokument:** Persönlicher Altwert und Gruppenstress teilen heute ein Settings-JSON mit gemeinsamer Version. Der neue Speicher darf dieses Dokument nicht erweitern, sonst entstehen Versionskonflikte zwischen SL-Aktionen und Würfen.
- **Name als Schlüssel bei eigenen Fähigkeiten:** XP-Ledger und Anträge verweisen per Name. Eine Umbenennung ohne ID-Pfad könnte Bezüge brechen. Deshalb wird der Bestand vor M6 nicht umbenannt.
- **Spezialisierungsbestätigung (R4 entschieden):** Phase B setzt den freien Anspruch mit Markierung bereits um („vom Spieler beansprucht“ bzw. „von der SL gesetzt“). Die SL-Probenaufforderung mit festgelegter Spezialisierung und die nachträgliche Neuauswertung brauchen gespeicherte, unveränderliche Wurfereignisse. Sie folgen deshalb mit **Phase D**; dort sind Pflichttests: gleiche Würfel, keine neue Zufallsziehung, Originalergebnis erhalten, Korrektur als SL-Aktion protokolliert und kein Doppelverbrauch von Ressourcen.
- **Wund-Ausnahmen:** Fehlinterpretationen ohne Quellprüfung würden Kampfergebnisse verfälschen. Deshalb blockiert der Pfad, statt zu raten.
- **Bogenschutz geprüft:** Ein Spieler kann die mechanischen Werte eines nicht übernommenen Altbogens nicht über `/api/records` ändern. Der Versuch lieferte lokal 403, die Vorschau blieb bei Geschick 3. Engine-**Entwürfe** sind dagegen frei editierbar und werden deshalb in K7 für Würfe ausgeschlossen.
- **Phase-A-Core:** Das Entfernen von `cap_at_10` ändert Draft-Tests. Produktiver Code ist nicht betroffen, weil der Draft in keine freigegebene Route eingebunden ist.

## Vorgeschlagene Reihenfolge (Phase B, lokal)

1. K3 (klein, ohne Datenmodell)
2. K7 (Rechte und Bindung)
3. K5 (nur `ordinary`)
4. K4 (Feld, Validierung, Editor)
5. K6 (neue Einträge)
6. Gemeinsame Integrationsabnahme

M2 und M6 erst nach gesonderter Freigabe. Stress-Schreibpfade erst in Phase C/D.
