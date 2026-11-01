# GE-01C – Konzept für eine geschützte Live-Alpha

**Status:** nur Konzept. Keine Freigabe, keine Aktivierung, keine Migration. Grundlage ist der Code-Stand `cf2c45f` (Branch `claude/ge-01c-ux`). Live läuft weiterhin Worker `2371bc92` (Whiteboard 2.0), `main` = `c768189`.

## Ergebnis in einem Satz

GE-01C lässt sich **technisch sicher** für ausgewählte reale Testspieler verfügbar machen. Die Voraussetzung ist ein zweistufiger Schalter: eine serverseitige Kampagnen-Allowlist plus ein SL-Schalter pro Spielabend. Hinzu kommen vier kleine Härtungen vor der Aktivierung. Eine Migration ist dafür **nicht** nötig.

## 1. Ausgangslage im Code

| Aspekt | Stand |
|---|---|
| Freischaltung | `liveChecksEnabled()` in `server/live-checks.ts` verlangt `GE01_CHECKS=local-only` **und** `AUTH_ACCESS_ENVIRONMENT=local-test`. In Produktion ist das bewusst unmöglich. `server/live-stage.ts` wiederholt diese Prüfung als eigene Zeile |
| Rechte SL | `requestCheck` nur mit `gmOnly`. Zielgruppe nur aus Teilnehmern des Abends (`liveAudience`). Szene darf nicht archiviert sein |
| Rechte Spieler | `rollCheck` nur für adressierte Spieler. Prüft eigene aktive Figur (`ownedActiveCharacter`, `selectedCharacter`, im INSERT erneut über `owner_id` und `activeCharacters`) und Bogenversion. Ein Wurf pro Probe und Figur (INSERT als Linearisierungspunkt), Ratenbegrenzung 30/min |
| Pool und Würfel | Nur serverseitig (`deriveW10Preview`, `liveRoll`, `resolveC1OrdinaryCheck`). Client-Pool und Client-Würfel werden mit 400 abgewiesen (Integrationstest) |
| Unfertige Regeln | `resolveC1OrdinaryCheck` lehnt Proben mit Kostenabsichten ab, also Blut, Willenskraft oder Hybridkosten. Hunger, Stress und Maskerade werden vom Probenpfad nicht berührt. Pool über 30 wird abgelehnt |
| Sichtbarkeit | Spieler sehen nur an sie adressierte Proben und Würfe. SL-Hinweise erreichen keine Spieler-Route (Integrationstest, Browsertest) |
| Bestehende Würfel | Der freie V20-Wurf (`action:'roll'`, `DicePanel`) ist unverändert und unabhängig vom Schalter |
| Daten | Proben und Würfe sind `records` (`kind='notizen'`, `context='live-table-event'`) im Raum des Abends. Es gibt keine neue Tabelle und keine Schemaänderung |

## 2. Aktivierungsstrategie (Vorschlag)

**Stufe A – serverseitige Allowlist (Betreiber).** Eine neue Variable, zum Beispiel `GE01_ALPHA_CAMPAIGNS`, nennt die Kampagnen-IDs, in denen Proben überhaupt möglich sind. Fehlt sie oder ist sie leer, ist die Funktion aus. Das ist der Normalfall und der Notschalter auf Betriebsebene.

**Stufe B – SL-Schalter pro Spielabend.** Im bestehenden Raumdatensatz des Abends kommt ein Feld `checksAlpha:true` hinzu. Es ist JSON im vorhandenen Record, daher **ohne Migration**. Die SL setzt es in der Regie unter „Proben“ mit einem Schalter „Charakterproben für diesen Abend“ und kann es ebenso abschalten. Die Wirkung tritt beim nächsten Abruf ein (Polling, wenige Sekunden). Ein neuer Abend startet immer ausgeschaltet.

`liveChecksEnabled(a, room)` wird damit zu: lokale Testinstanz **oder** (Kampagne in der Allowlist **und** `room.checksAlpha`). `live-stage.ts` nutzt dieselbe Funktion statt der eigenen Kopie.

**Abschaltung**
- Sofort: SL-Schalter aus. Die Probenoberfläche verschwindet, Server-Befehle antworten 404.
- Betriebsebene: Allowlist leeren. Das erfordert eine neue Worker-Version, dauert Sekunden bis Minuten und braucht keine Migration.
- Notfall: `wrangler rollback` auf die vorherige Worker-Version, heute `2371bc92`. Das ist sicher, weil sich kein Schema ändert.

**Was nach der Abschaltung bleibt:** Bereits gespeicherte Würfe sind normale Live-Ereignisse. Sie bleiben im Würfelprotokoll lesbar und werden nicht neu ausgewertet (`v20-normal`, gespeicherte Würfel). Offene Proben werden nicht mehr angezeigt. Es ist nichts zurückzurechnen, weil Charakterwerte nie geschrieben werden.

## 3. Härtungen vor einer Aktivierung (Aufwand klein)

1. Den Schalter wie oben einbauen, mit Tests für Spieler, SL und nicht angemeldet bei ein- und ausgeschaltetem Schalter sowie für Kampagnen außerhalb der Allowlist.
2. Für Spieler `checks[].recipients` aus der Projektion entfernen. Heute sehen Spieler die IDs der übrigen Adressaten, ohne Namen oder Werte.
3. Alpha-Ereignisse kennzeichnen: `alpha:'ge-01c'` plus vorhandene Regel- und Bogenversion. So lassen sie sich später filtern oder auswerten.
4. Die offenen Punkte 1 bis 3 der Übergabe beheben: Text bei gesperrter Probe, mobile Überlappung prüfen und eine Prüfung auf einem echten Mobilgerät.

## 4. Trennung synthetischer und echter Daten

| Stufe | Umgebung | Daten | Ziel |
|---|---|---|---|
| 0 | lokal `--ge-01` | synthetisch | erledigt (dieser Stand) |
| 1 | isolierte Vorschau- oder Remote-Testumgebung mit eigener D1 und eigenem R2 (siehe `CLOUDFLARE_PR_PREVIEW_ISOLATION_REVIEW.md`) | synthetisch | Schalter, Rechte und Abschaltung auf echter Cloudflare-Laufzeit |
| 2 | Produktion, Allowlist nur mit einer **synthetischen Testkampagne** | synthetisch in Produktion | Nachweis, dass echte Kampagnen unberührt bleiben |
| 3 | Produktion, Allowlist mit **einer freigegebenen echten Runde**, SL-Schalter nur für den vereinbarten Abend | echt | Alpha mit ausgewählten Spielern |

Synthetische Konten (`@example.invalid`) gelangen nie in echte Kampagnen, und echte Charaktere werden nie in Stufe 0 bis 2 kopiert. Die Allowlist verhindert technisch, dass eine echte Runde vor Stufe 3 Proben sieht.

## 5. Rückfallplan

1. Probleme während des Abends: Die SL schaltet die Proben in der Regie aus. Danach würfelt die Runde wie bisher mit dem freien Wurf, der Abend läuft weiter.
2. Fehlerhafte Anzeige oder Last: Allowlist leeren und eine neue Worker-Version ausrollen.
3. Schwerer Fehler: `wrangler rollback` auf die letzte gute Version. Ohne Migration gibt es keinen Datenrückbau.
4. Nachbereitung: Alpha-Ereignisse über die Kennzeichnung auswerten. Charakterbögen sind unverändert, weil der Probenpfad nicht schreibt.

## 6. Entscheidungen für die Projektleitung

1. Freigabe des Zwei-Stufen-Schalters (Allowlist plus SL-Schalter) als Aktivierungsmodell.
2. Welche reale Runde und welche Spieler nehmen in Stufe 3 teil?
3. Sollen gesperrte Proben, etwa eine Kenntnis ohne Wert, der SL zusätzlich gemeldet werden, damit sie umentscheiden kann?
4. Nach welcher Frist dürfen offene, nie gewürfelte Proben eines Abends ausgeblendet werden?
5. Danach folgt ein separater Auftrag für Härtungen und Stufe 1 bis 2, erst dann die Produktivfreigabe.
