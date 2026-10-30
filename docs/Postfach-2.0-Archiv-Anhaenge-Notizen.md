# Postfach 2.0 – Archiv, Papierkorb, Anhänge und Übernahme in Notizen

Stand: 30.10.2026 · Branch `claude/nachrichten-archiv` (Basis `origin/main`) · nur lokal, kein Push, kein Deployment, keine Migration.

## Ausgangslage

Wunsch des Projektinhabers: Briefe ließen sich weder löschen noch archivieren, Dokumente konnten nicht in die eigene Story übernommen werden, Dateien/Bilder konnten nur SL-Regiebotschaften tragen. Ziel: ein Postfach, das sich wie ein echtes Mailprogramm (Thunderbird) bedient.

Vorhandenes System (unverändert wiederverwendet):

- Briefe sind Datensätze in `records` (`kind='notizen'`, `body.context='sl-message'`). **Jeder Empfänger besitzt eine eigene Kopie** (`owner_id` = Empfänger), der Absender steht in `body.senderId`.
- API `app/api/messages/route.ts`, Oberfläche `app/spielbereich/modules/message-center.tsx` (Dialog über „Postfach“ bzw. eingebettet im Spieltisch).
- Anhangsfreigabe über `server/personal-message-files.ts` (nur Empfänger und Absender, nie Gruppenfreigabe).
- Das persönliche Story-System der Spieler ist **„Meine Notizen“ / „Persönliches Archiv“** (`records`, `kind='notizen'`, privat). Ein zweites System wurde nicht gebaut.

## Umsetzung

### Ordner pro Person (ohne Migration)

Der Zustand wird als JSON-Felder auf der jeweiligen Briefkopie gespeichert, getrennt nach Rolle:

| Sicht | Archiv | Papierkorb | Aus Postfach entfernt |
|---|---|---|---|
| Empfänger | `archivedAt` | `trashedAt` | `removedAt` |
| Absender | `senderArchivedAt` | `senderTrashedAt` | `senderRemovedAt` |

- Ordner: **Posteingang, Gesendet, Archiv, Papierkorb**. Archiv und Papierkorb zeigen erhaltene und gesendete Briefe gemeinsam.
- **Löschen** legt den Brief in den Papierkorb (wiederherstellbar, kehrt in den vorherigen Ordner zurück).
- **„Aus meinem Postfach entfernen“** geht nur aus dem Papierkorb und mit Bestätigung. Es ist ein Soft-Delete nur für diese Person: die Zeile bleibt bestehen, andere Beteiligte behalten ihre Kopie. Es wird nie eine Zeile gelöscht.
- Gesendete Briefe an mehrere Empfänger erscheinen beim Absender als **eine** Mail mit allen Empfängern; Archivieren/Löschen des Absenders wirkt auf seine Sicht aller Kopien, nie auf die der Empfänger.
- Gelesen/Ungelesen nur für erhaltene Briefe. Der Zähler „ungelesen“ zählt nur den Posteingang.
- Mehrfachauswahl mit Sammelaktionen, Suche im Ordner.
- Logik in `domain/personal-message.ts` (`mailFolder`, `mailActionPatch`, `mailFolderSql`), serverseitig in `PATCH /api/messages` mit `{action, box:'in'|'out', ids}`. Der alte Aufruf `PATCH {id}` (als gelesen markieren) funktioniert weiter.

### Anhänge für alle

- Spieler und SL können jetzt **Dateien, Bilder, PDF, Audio und Video (bis 10 MB)** an normale Briefe hängen: hochladen (als private eigene Datei) oder aus den eigenen Dateien wählen. Auch ein Brief nur mit Anhang ist möglich.
- Serverseitige Prüfung: Jeder Anhang muss für den Absender **aus eigenem Recht** lesbar sein (`validatePreparationMedia`/`canRead`). Formatierte Regiebotschaften bleiben SL-only.
- Die Freigabe für Empfänger entsteht wie bisher nur über den Brief selbst und **endet**, wenn die Person den Brief aus ihrem Postfach entfernt – außer sie hat ihn vorher in ihre Notizen übernommen.

### Antworten und Weiterleiten

- **Antworten** an den Absender mit Zitat und Betreff „Re: …“, **Weiterleiten** mit „Wg: …“ und Kopfzeilen. Die Verknüpfung (`replyToId`/`forwardOfId`) wird nur akzeptiert, wenn der ursprüngliche Brief der Person selbst gehört.
- **SL-Geheimnisse:** Anhänge, die nur über den Brief der SL lesbar sind (z. B. SL-Handouts mit Sichtbarkeit „SL“), werden **nicht** weitergeleitet. Die Oberfläche lässt sie weg und sagt das; der Server lehnt sie zusätzlich ab. Dasselbe gilt für Dateien, die ein anderer Spieler privat geschickt hat.
- „Allen antworten“ wurde bewusst nicht gebaut: Empfänger einer SL-Sendung sehen sich bisher nicht gegenseitig, und das soll so bleiben (siehe Vorschläge).

### In die eigene Story übernehmen

- Aktion **„In meine Notizen“** im geöffneten Brief (`PATCH /api/messages {action:'to-notes', box, id}`).
- Legt einen **privaten** Eintrag in „Meine Notizen“ an: Titel, Text (bei Regiebotschaften als Klartext), Kurzbeschreibung „Brief von … · Datum“, Datum, Verweis `sourceMessageId` und die Anhangsliste. Nie `gm_body`, nie Daten anderer Kopien.
- Idempotent: ein zweiter Klick öffnet keinen Duplikat-Eintrag.
- Die Notiz ist danach normal bearbeitbar; der Notiz-Editor zeigt die übernommenen Anhänge an. Der Dateizugriff bleibt serverseitig geprüft (nur die Person, die den Brief erhalten bzw. gesendet hat).
- Ändert ein Spieler die Sichtbarkeit seiner Notiz auf „Gruppe“, sehen andere den Text, aber **nicht** die SL-Anhänge (Freigabe hängt an der Person, nicht an der Notiz).

### Oberfläche

- Mailprogramm-Aufbau: Ordnerleiste, Briefliste (Absender, Betreff, Vorschau, Datum, Büroklammer, Ungelesen-Punkt), Lesebereich mit Werkzeugleiste (Antworten, Weiterleiten, Archivieren/Zurücklegen, Löschen, Als ungelesen, In meine Notizen; im Papierkorb: Wiederherstellen, Entfernen).
- Breite über Container-Abfragen: ab ~860 px drei Spalten, darunter Ordner als waagrechte Leiste und Liste/Lesebereich im Wechsel mit „Zurück“. Gleiche Darstellung im Dialog, im Spieltisch-Einschub und bei 375 px.
- Farben, Schrift und Bedienelemente aus dem bestehenden Briefe-Design bzw. SL-CMS 3.0 übernommen.

## Sicherheit und Datenschutz

- Keine Schemaänderung, keine Migration; nur JSON-Felder in bestehenden Briefkopien.
- Alle Aktionen prüfen serverseitig, dass die Kopie der handelnden Person gehört (Empfänger: `owner_id`, Absender: `senderId`). Fremde IDs ergeben 404.
- Der allgemeine `records`-Weg kann Briefe weiterhin weder anlegen, ändern noch löschen.
- Keine SL-Inhalte werden per CSS versteckt; was nicht freigegeben ist, liefert der Server nicht aus.

## Tests

- Unit: `tests/personal-message.test.mjs` (Ordnerlogik, Aktionen, Schemas, Betreff/Zitat). Bestehender Test in `tests/story-scene.test.mjs` an die neue Regel „Klartext-Briefe dürfen Anhänge tragen“ angepasst.
- Integration: `tests/messages-mailbox-integration.mjs` mit SL, Spieler A und Spieler B (in `tests/integration.mjs` eingehängt): B sieht nichts von A, kann A-Kopien weder öffnen, archivieren, löschen noch übernehmen; Archiv/Papierkorb/Entfernen wirken nur für die eigene Person; Absender-Gruppierung; Gelesen-Markierungen; Spieler-Anhänge; Weiterleitungs- und Fälschungssperre für SL-Dateien; Antwort-Verknüpfung; Übernahme in Notizen inklusive Sichtbarkeit und Dateizugriff nach dem Entfernen.
- Browser: siehe Abschnitt „Ergebnisse“.

## Ergebnisse

- TypeScript (`tsc --noEmit`) und ESLint für alle geänderten Dateien: ohne Befund.
- Unit-Tests (`pnpm test`): **154/154 bestanden**.
- Integration (`scripts/test-local.mjs`, isolierte Instanz): **1.877 Prüfungen bestanden, Exit 0**, davon 44 neue Postfach-Prüfungen.
- Browser (eingebauter Browser, Testinstanz Port 8850):
  - Desktop 1280 px: dreispaltiges Postfach, Brief mit SL-Anhang öffnen, Sammelauswahl → Archivieren, Archiv-Ordner.
  - Spieler B nach As Aktionen: Einladung weiterhin im Posteingang, keine Briefe oder Notizen von A sichtbar.
  - 375 px (Spieler B): Lesen, Werkzeugleiste umbrechend, kein seitliches Scrollen der Seite; „Antworten“ mit vorbelegtem Empfänger, Betreff „Re: …“ und Zitat; Bild hochgeladen und versendet – A erhält Brief, Anhang und Antwortverweis.
  - Spieler A: Weiterleiten eines SL-Briefs lässt den SL-Anhang weg und weist darauf hin; Löschen → Papierkorb → „Aus meinem Postfach entfernen“ mit Bestätigung; die vorher übernommene Notiz zeigt Text und Bild weiterhin.
  - Konsole: nur 401/Verbindungsfehler aus der Neustartphase des Testservers, keine Skriptfehler.
- Nicht ausgeführt: der Playwright-Durchlauf `tests/preparation-guide-browser.mjs` (öffnet ebenfalls das Postfach). Die von ihm genutzten Bedienelemente (Briefzeile als Schaltfläche mit Titel) sind erhalten.
- Hinweis: Die Test-SL der Integrationssuite hat keine Kampagnenmitgliedschaft und ist daher kein Briefempfänger; der Antworttest nutzt deshalb Spieler A. In echten Kampagnen ist die SL Mitglied und erreichbar (in der Demo geprüft).

## Lokale Testinstanz

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-nachrichten.ps1 -Build
```

- Adresse: http://127.0.0.1:8850/anmelden · Speicher: `.local-test/nachrichten` (bleibt über Neustarts erhalten).
- Synthetische Konten `command-gm@example.invalid`, `command-a@example.invalid`, `command-b@example.invalid`; Passwort im Repo-Fixture (`scripts/test-local.mjs`).
- Vorbelegt: ein Brief der SL an A und B, ein Brief nur an A mit SL-Siegelabdruck, ein Brief von A an B.

## Offene Punkte und Vorschläge (nicht umgesetzt)

1. **SL-Hartlöschen:** Fachlich nicht nötig, solange „Entfernen“ pro Person reicht. Falls gewünscht (z. B. Datenschutzanfrage), als eigene SL-Aktion mit Protokoll und Bestätigung vorschlagen – nur nach Freigabe.
2. **Allen antworten / sichtbare Mitempfänger:** bräuchte eine Entscheidung, ob Spieler sehen dürfen, wer denselben SL-Brief bekommen hat.
3. **Entwürfe** werden noch nicht gespeichert (Text geht beim Schließen des Dialogs verloren).
4. **Übernahme in eine Charakterakte** statt „Meine Notizen“: Notizen haben keinen Charakterbezug. Sobald die Charakterverwaltung 3.0 eine Akte pro Charakter hat, kann die Übernahme dort andocken.
5. Ungelesene Briefe, die archiviert werden, zählen nicht mehr zum Ungelesen-Zähler (nur Posteingang). Falls gewünscht, einen eigenen Zähler am Archiv ergänzen.
6. Weitergeleitete eigene Spieler-Anhänge werden vom Server angenommen (die Datei gehört dem Absender); fremde private Dateien und SL-Dateien nicht.
