# Live-Release 31.10.2026 – Regie-Nachbesserung und Zustände der Runde

Veröffentlicht auf Anweisung des Projektinhabers („okey live push“). Kein Merge nach `main`, keine Datenbankmigration.

## Inhalt

Der Branch `claude/regie-nachbesserung` baut auf `claude/release-regie-pager` (`0881837`) auf:

- `2b50b88` – Der Pager kommt auf dem Spieltisch an. Dazu kommen ein festes Bereichsmenü im Regie-Fenster, ziehender Nebel und weitere Atmosphären mit weicheren Übergängen sowie YouTube-Musik (offizielle Einbettung über youtube-nocookie, Laden erst nach persönlicher Zustimmung).
- `ff0dfa4` – Zustände der Runde: Übersicht unten links mit Schadens-Effekt, Dropdown für die eigenen Werte im Spielermenü und Zustände im Regie-Fenster. Sichtbarkeit und Schadensrecht sind umschaltbar.

Details stehen in den Berichten der Sitzung unter `docs/spieltisch-2-0/`.

**Bewusste Verhaltensänderung:** Blut, Willenskraft und Schaden sind jetzt standardmäßig für alle am Tisch sichtbar. Die SL kann das als Einstellung der Runde zurückstellen. Alle anderen Charakterdaten bleiben privat.

## Prüfungen vor dem Deploy

- Typecheck, ESLint, Produktionsbuild.
- `pnpm test` 213/213. Zusätzliche Unit-Tests (Bühne, Zustände, Regie, Pager) 37/37.
- Integrationsregression: 1.968 PASS, 0 FAIL.
- Integration mit SL, Spieler A und Spieler B, alle grün: Regie-Nachbesserung, Zustände der Runde, Pager, Regie-Zweitfenster, Zustandswerte, Spieltisch-Regie, Medien.
- Browser (Edge/Playwright), alle grün: Regie-Nachbesserung, Pager, Zustände der Runde, Regie-Zweitfenster, Erzählung UX.
- Die 3 Live-Charaktere aus der Sicherung werden fehlerfrei gelesen.

## Deploy

- Worker `chronik-von-kleve`, Version `dbe65764-e093-4ad6-88cf-cbab17e440e3`, Tag `regie-nachbesserung`, 100 % Verkehr. Bindings unverändert.
- Rückfallversion: `732bc758-f191-4576-b9b3-d8a1a46b31b8` (Regie und Pager).
- Sicherung vorab:
  - Export der 32 Tabellen (27.367 Zeilen), `integrity_check ok`.
  - Time-Travel-Lesezeichen `00000193-00014324-00005115-340db260d7ed77d46e88193ca42c8a8e`.
  - Dateien privat unter `.local-work/release-regie-fix/`.
- Live-Prüfung ohne Anmeldung:
  - `/anmelden` 200.
  - Spielbereich, SL und `/sl/regie` 307.
  - Bühne (auch `regie=`), Live-Tisch, Nachrichten und Datensätze 401 mit `private, no-store`.
  - Pager-Gehäuse 200.

## Rückfall

Keine Schemaänderung. Neue Felder (Effekte, YouTube, Rundeneinstellungen) sind optional im Bühnen- bzw. Charakterstand gespeichert.

**Vor einem Rollback auf eine ältere Version:** Ein laufender Abend mit neuen Feldern kann dort mit 409 antworten. Fix-forward bevorzugen oder den Abend vorher beenden.

## Offen

- Materialien der Kampagne in der Regie aufräumen (vom Projektinhaber für später vorgesehen).
- Weitere Feinarbeit am Spieler-Dropdown und an der Schadensdarstellung, sobald der Projektinhaber über das Schadensrecht entschieden hat.
- Merges nach `main`.
