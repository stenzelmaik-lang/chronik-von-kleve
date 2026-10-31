# Spieltisch aufgeräumt – Dokumente, Figuren, Zustände, Pager

Stand: 31.10.2026. Branch `claude/spieltisch-aufraeumen` auf `origin/main` `02af145`. Diese Änderungen waren Rückmeldungen des Projektinhabers nach der Live-Sichtung.

## Änderungen

- **Dokumente-Schuber am Tisch:** Der Schuber dient nur noch dem Ausspielen. Er zeigt „Vorbereitet zum Auflegen“, die Zielgruppe, „Auf den Tisch“ bzw. „Vom Tisch“ und die Liste „Auf dem Tisch“.
  - Kein Editor, kein „Neu“, kein Bearbeiten oder Löschen. Vorbereitet wird im Archiv (Spieler) bzw. im Command Center unter „Material“ (SL).
  - Ein offener Entwurf aus dem Archiv erscheint nicht mehr im Schuber.
  - Der Schuber scrollt nicht mehr seitlich, Inhalte brechen innerhalb der Breite um.
  - Dasselbe gilt für den Material-Reiter der Regie am Tisch. Das eigene Regie-Fenster behält „Neu“ für spontane Vorlagen.
- **Figuren:** Der Reiter „Figuren“ ist vom Tisch entfernt. NSC kommen über die Regie auf den Tisch.
- **Zustände:** Am Tisch steuert nur der Spieler seinen eigenen Zustand („Mein Zustand“). Die SL steuert die Zustände der Runde in der Regie. Die Übersicht unten links bleibt für alle sichtbar.
- **Pager-Spiegel der SL:** Er steht frei wie der Spieler-Pager. Es gibt keinen Fensterrahmen, keine Kopfzeile und keine Liste mehr.
  - Über dem Gerät sitzt eine schmale Statuszeile mit Zeit, Empfängern, bei „an alle“ dem Text und dem Lesestatus.
  - Dazu kommt ein kleiner Schließen-Knopf.
  - Zugeklappt liegt wie bei den Spielern ein kleiner Pager mit Zähler da.
  - Pager und Spiegel liegen jetzt oberhalb der Zustandsanzeige unten rechts statt darüber.
- **Test repariert:** `tests/preparation-guide-browser.mjs` suchte die Szenenbausteine noch in Szenenschritt 4. Seit PR #48 liegen sie unter Material → Szenenbausteine.
  - Der Test prüft jetzt, dass Schritt 4 nur den Einsatzplan enthält.
  - Die beiden Bausteine legt er wie der Materialbereich an derselben Szene an.
  - Alle übrigen Prüfungen bleiben unverändert: Botschaft mit übernommenem Handout, gespeicherte Elemente.

## Tests

- Typecheck, ESLint und Build fehlerfrei.
- Integrationsregression: 1.976 PASS, 0 FAIL.
- Der CI-Browserdurchlauf ist lokal gegen `--spieltisch-release` (Port 8820) grün: `story-browser-smoke` und `preparation-guide-browser`.
- Gegen `--ultio-pager`:
  - Browser grün: Pager am Tisch, Pager, Regie-Nachbesserung, Zustände der Runde, Ambiente.
  - Integration grün: Pager, Zustände der Runde, Spieltisch-Regie, Medien.
- Browser von Hand:
  - SL-Werkzeugleiste ohne Figuren und Zustände.
  - Spielerleiste mit „Mein Zustand“.
  - Dokumente-Schuber ohne Editor und ohne seitlichen Überlauf.
  - Freigestellter Pager-Spiegel oberhalb der Druck-Anzeige.

Keine Daten- oder Schemaänderung.

## Live-Release 31.10.2026

- Freigegeben durch den Projektinhaber („Ja, live und mergen“).
- Worker-Version `a4f7982e-ec27-4e34-bc3e-af297f6d4a5b`, Tag `spieltisch-aufraeumen`, 100 % Verkehr. Bindings unverändert.
- Rückfallversion: `88d5f0a6-39ab-413c-b34a-a725803acf99`. Sie ist voll kompatibel, denn es handelt sich nur um Oberfläche und Tests.
- Sicherung vorab:
  - 32 Tabellen, 28.547 Zeilen, `integrity_check ok`.
  - Lesezeichen `00000198-00000bf6-00005115-2b4f9d48dcb8e2c3a761311a88cab2e4`.
  - Ablage: privat unter `.local-work/release-spieltisch-aufraeumen/`.
- Live-Prüfung ohne Anmeldung:
  - `/anmelden` antwortet mit 200.
  - Spielbereich, SL und Regie leiten mit 307 weiter.
  - Bühne, Dateien, Material und Datensätze antworten mit 401 und `private, no-store`.
  - Pager-Gehäuse und Ton antworten mit 200.
