# Etappe 4c · Navigation im Spielerbereich · Übergabe

| | |
|---|---|
| Branch | `claude/navigation` (lokal), Basis `main` = `a898355` (Live-Stand `c7cb9a93`) |
| Zieltabelle | [docs/design/4c-ZIELTABELLE.md](../design/4c-ZIELTABELLE.md), vom Besitzer am 09.11. „wie vorgeschlagen“ abgenommen (alle sechs Entscheidungen) |
| Status | lokal fertig, wartet auf Abnahme; **nicht gepusht, nicht deployt** |

## Was gebaut ist
- **Ein sichtbares Hauptmenü** (`shell.tsx`, `PlayerMenu`): am Rechner links, auf dem Handy hinter dem Menüknopf (Schublade, Esc und Klick daneben schließen). Gruppen: Mein Abend · Mein Charakter · Meine Seiten · Die Welt · Spielleitung (nur SL bzw. Ortsverwaltung mit CMS-Recht). Aktueller Bereich markiert; „Weltkarte“ markiert „Orte“.
- **Namen nach Glossar** (`navigation.ts`): Spielerzentrale, Spieltisch, Rückblicke, Charakter, Orte, Überlieferungen, Galerie. Kennungen (`?bereich=`) unverändert.
- **Kopfleiste schlank:** Menüknopf, Logo, Kampagnen, Command Center (SL), Kontomenü. Entfernt: „Zur Spielerzentrale“, „Chronik erkunden“, „Ortsredaktion“, Spielwelt-Leiste.
- **Im Aufbau:** Wirtschaft, Neuigkeiten, Händler mit Hinweis im Menü.
- **Würfel und Weltkarte** nicht mehr im Menü, per Link weiter erreichbar (Weltkarte ist dieselbe Ansicht wie Orte).
- **Postfach** als Menüpunkt (öffnet das bestehende Postfach).
- **Galerie = Spielergalerie** (`player-gallery.tsx`, neue Route `GET /api/character-gallery`, `server/character-gallery.ts`): alle Bilder, die Charaktere der Kampagne mit der Gruppe teilen, je Charakter, mit Großansicht (Pfeile, Esc). Nur freigegebene Bilder, nur sichtbare Charaktere (kein GM_SECRET/sl_secret/archiviert), Dateien nur vom Besitzer. **In der SL-Kommandozentrale bleibt `galerie` die Dateiverwaltung** (MediaLibrary).
- **Rückblicke** ohne gewählten Abend: Liste der vergangenen Spielabende (vorher Fehlermeldung).

## Prüfungen
| Prüfung | Ergebnis |
|---|---|
| Typecheck | sauber |
| ESLint (geänderte und neue Dateien) | 0 Fehler |
| `pnpm test` | 411/411 (neu: `tests/navigation-menu.test.mjs`; angepasst: `tests/dashboard-ux.test.mjs`) |
| Gesamtlauf `tests/*.test.mjs` | 525/531, 6 bekannte Altfälle (4 NPC, 2 Ortsdossier) |
| `tests/character-profile-integration.mjs` lokal | 29/29, neu: Galerie zeigt nur Freigegebenes, privates Bild und fremde Datei 404, ohne Anmeldung 401 |
| Build | grün |
| Browser lokal | Spieler: Menü breit, Galerie mit Großansicht; 375 px: Menüknopf, Schublade, Navigation schließt sie, kein Überlauf; SL: fünf Gruppen inkl. Spielleitung; Rückblicke-Liste. `.local-test/ge-01` danach gelöscht |

## Grenzen und offen
- Kein echtes Mobilgerät geprüft.
- Die alte Spielwelt-Leiste (`.world`) und `navGroups`-Altnamen sind entfernt; Stile der früheren Kopfnavigation in `globals.css` (`player-nav-links`) waren schon vorher ungenutzt und bleiben unangetastet.
- Persönliches Archiv: Die Dateien stehen weiter im Notizbuch-Reiter „Persönliches Archiv“; der Bereich `galerie` zeigt für Spieler keine Dateiliste mehr.
