# Spieltisch 2.0 – Etappe 1: gezielte UX-Nachbesserungen

30.10.2026 · Branch `codex/spieltisch-regie-ux` · Basis `main` `5ff8571a6310da913aae2a1b752682d64227a46e` mit veröffentlichtem Code `8200e9a52a067c6d949d51da3452b57b0c0d1444`.

**Status: lokal implementiert und geprüft; zur Veröffentlichungsfreigabe vorgelegt. Kein Push, Merge oder Live-Deployment.** Keine neue Migration, Abhängigkeit oder Datenstruktur. Keine produktiven Konten, Charaktere oder Kampagnendaten angefasst oder für Tests kopiert.

## 1. Erzählung von der gemeinsamen Bühne entfernen

Die SL kann direkt an der veröffentlichten Erzählung **„Für alle entfernen“** verwenden. Dieselbe Aktion steht unter **„Szenen des Abends“** zur Verfügung, auch wenn Bühnenobjekte den Text verdecken.

Die vorhandene Live-Ereignis-/Freigabelogik erhält `hideScene`. Wie bei Medien wird das bestehende `hidden`-Kennzeichen verwendet. Es werden ausschließlich die veröffentlichten Erzählereignisse des aktuellen Kampagnen-/Spielabend-Laufs ausgeblendet, einschließlich früherer individueller Freigaben. Dadurch bleiben nach dem globalen Entfernen auch bei unterschiedlichen vorherigen Zielgruppen keine alten Erzählungen stehen. Vorbereitung, Originaltexte, Medien, Würfel, Whiteboard und NPC-Originale werden nicht verändert. Eine erneute bewusste Veröffentlichung erfolgt unverändert über `showScene` mit neuem Ereignis.

Die Aktion ist serverseitig SL-geschützt. Veraltete Ereigniskennungen, andere Läufe und unpassende Medienereignisse werden abgelehnt; der Schreibzugriff ist gegen neuere Veröffentlichungen abgesichert. Bestehende Snapshot-Abfragen übernehmen den neuen Zustand für alle verbundenen Teilnehmer.

Spieler können die Erzählung **nur für sich** ein- oder aufklappen. Dies ist rein persönlicher Browserzustand ohne Schreibaufruf. Eine neue Veröffentlichung öffnet deren Inhalt wieder. Die SL-Aktion bleibt ausdrücklich global beschriftet.

## 2. Breite von Regie und Kontext

Beide vorhandenen rechten Schuber verwenden `useDrawerWidth`:

- Ziehen an der linken Kante; die Bühne selbst bleibt unverändert positioniert.
- Desktop-Breite 320–960 px, zusätzlich durch die verfügbare Fensterbreite begrenzt.
- Tastatur: Links verbreitert, Rechts verkleinert; Umschalt vergrößert den Schritt; Pos1/Ende setzen Minimum/Maximum. Escape während des Ziehens verwirft die laufende Größenänderung, außerhalb einer Größenänderung schließt Escape wie bisher den Schuber.
- Persönliche Breite getrennt je Konto und Schubertyp in `localStorage`. Es wird keine Servereinstellung verändert und keine andere Teilnehmeransicht beeinflusst.
- Vorübergehend kleinere Fenster begrenzen die Anzeige, ohne die für größere Fenster gemerkte Breite zu verwerfen.
- Bis 700 px verwendet der Schuber die verfügbare mobile Breite; die Ziehkante entfällt dort.
- Vorhandener Rich-Text-Renderer und Tabellen-Scrollcontainer bleiben erhalten. Ergänzte Mindestbreitenregeln verhindern, dass breite Tabellen das äußere Schuberlayout aufweiten. Tabellen scrollen im eigenen Inhaltsbereich.

## Geänderte Komponenten

- `server/live-commands.ts`: `hideScene` im bestehenden Live-Befehlspfad.
- `app/spielbereich/modules/spieltisch/stage.tsx`: globale Entfernen-Aktionen, persönliches Einklappen, Anbindung der Schuberkante.
- `app/spielbereich/modules/spieltisch/stage.module.css`: Kante, Breitenbegrenzung, innere Tabellenbreite, Erzählungssteuerung.
- `app/spielbereich/modules/spieltisch/use-drawer-width.ts`: gemeinsamer persönlicher Breitenmechanismus.
- `tests/spieltisch-regie-integration.mjs`: Rollen-, Entfernen-, Wiederanzeigen-, Zielgruppen- und Bestandsschutzprüfungen.
- `tests/spieltisch-regie-ux-browser.mjs`: reproduzierbare lokale Prüfung mit drei getrennten authentifizierten synthetischen Sitzungen.
- Dieser Bericht.

## Prüfungen

- **146 Unit-/Regressionstests bestanden.**
- **1.787 vollständige isolierte HTTP-Integrationsprüfungen + 46 Rollen-/Backfill-/Rollback-Prüfungen bestanden.**
- Typecheck, gezieltes ESLint einschließlich beider geänderter/neuer Tests und Build bestanden.
- Erweiterte Regie-Integration: Spieler dürfen nicht global entfernen; ungültiger Lauf, Medienereignis und veraltete Schließaktion abgewiesen; globale Entfernung für alle, wiederholte Entfernung, erneute Veröffentlichung, verschiedene A-/B-Freigaben, unveränderte Original-Szenen und unberührte Medien bestanden.
- **Elf Browser-Prüfgruppen bestanden:** persönliches Einklappen; globale Entfernung; erneute Veröffentlichung; Schließen direkt an der Erzählung; Mausverstellung ohne Bühnenverschiebung; Tastaturgrenzen und Tabellen-Scrollen; Escape-Abbruch beim Ziehen; Breite/Szene/Bereich nach Neuladen; Szenenwechsel ohne Inhaltsverlust; persönliche Kontextbreite ohne Auswirkungen auf andere Ansichten; Desktop-/Mobilgrenzen und bestehende Werkzeuge.
- Browsergrößen: 1920, 1440, 800 und 390 px. Keine JavaScript-Seitenfehler im Browserlauf. Kein nativer Zoomtest behauptet.
- Sichtprüfung der Desktop- und Mobilaufnahmen durchgeführt. Mechanischer Designcheck meldet zwei bereits vorhandene Akzentrahmen im bisherigen Stylesheet; keine hierfür sachfremde Gestaltung geändert.

Private lokale Nachweise: `.local-work/ux-check/` einschließlich Logs, `browser/result.json`, `browser/regie-desktop.png` und `browser/regie-mobile.png`. Sie werden nicht versioniert.

## Lokale Ansicht und Wiederholung

Die separate synthetische QA-Anwendung läuft unter **http://127.0.0.1:8834/spielbereich?bereich=sitzung**. Der Spielabend ist als **„SYNTHETISCH – Regie UX“** bezeichnet. Bestehende Abnahmeinstanzen anderer Arbeitskopien wurden nicht verändert. Lokale Daten gehören ausschließlich zu dieser Arbeitskopie (`.local-test/spieltisch-2`).

Die vorhandene Demo startet mit `node --experimental-strip-types scripts/test-local.mjs --spieltisch-2`; für Port 8834 vorher `CVK_TEST_PORT=8834` setzen. Einen ausdrücklich synthetisch bezeichneten Abend starten. Dann mit `CVK_TEST_URL=http://127.0.0.1:8834` die Skripte `tests/spieltisch-regie-integration.mjs` und `tests/spieltisch-regie-ux-browser.mjs` ausführen. Für den Browserlauf muss die bestehende Testinstallation von Playwright verfügbar sein; optional über `CVK_PLAYWRIGHT_MODULE` angeben. Keine neue Anwendungsabhängigkeit erforderlich.

## Einschränkungen / Abnahmegrenze

- Breiten bleiben browser-/gerätebezogen. Bei blockiertem lokalem Speicher funktioniert die Verstellung, aber die Einstellung überlebt kein Neuladen.
- Spieler-Einklappen wird bei Neuladen zurückgesetzt; es ist keine globale Freigabeänderung.
- Gemeinsame Änderungen erreichen verbundene Ansichten über die vorhandene Abfragefrequenz (üblicherweise 750 ms; Hintergrund-Tabs und langsame Verbindungen können verzögern).
- Die vorhandene Teilnehmer-Kopfleiste ist bei 390 px weiterhin eng; sie gehört nicht zu diesen beiden Schuber-/Erzählungsänderungen und wurde nicht umgebaut. Der mobile Schuber selbst bleibt lesbar, scrollbar und schließbar.
- Ausschließlich synthetische lokale Tests, kein neuer Live-Spielertest. **Kein automatisches Veröffentlichen: Freigabe abwarten.**
