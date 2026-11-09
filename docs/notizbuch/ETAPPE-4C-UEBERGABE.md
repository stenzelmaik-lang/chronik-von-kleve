# Etappe 4c · Navigation im Spielerbereich · Übergabe

| | |
|---|---|
| Branch | `claude/navigation` (lokal), Basis `main` = `a898355` (Live-Stand `c7cb9a93`) |
| Zieltabelle | [docs/design/4c-ZIELTABELLE.md](../design/4c-ZIELTABELLE.md), **Fassung 3**, vom Besitzer am 09.11. abgenommen, Name der Startseite „Zuflucht“ |
| Status | lokal fertig, wartet auf Abnahme; **nicht gepusht, nicht deployt** |

## Verlauf
Fassung 1 (Seitenmenü links) war gebaut, der Besitzer hat sie vor dem Deploy verworfen („Wir wollten nie ein Seitenmenü haben“). Das Seitenmenü ist vollständig entfernt. Live war es nie.

## Was gebaut ist (Fassung 3)
- **Kopfleiste** (`shell.tsx`): ChroniPlay · Kampagne · **Zuflucht** · **Spieltisch** mit Anzeige „live“ / „nicht live“ · **Die Welt ▾** · Kampagnen · **Command Center ▾** (nur SL) · Kontomenü. Redakteure ohne SL-Rolle: Link „Ortsverwaltung“. Dropdowns schließen bei Auswahl, Esc und Klick daneben.
- **Die Welt ▾** in fester Reihenfolge: Orte · Chronik · Persönlichkeiten · Überlieferungen · Codex Noctis · Neuigkeiten · Händler (die letzten zwei mit „im Aufbau“). Die Welt-Leiste unter der Kopfleiste bleibt in der Welt, jetzt mit Überlieferungen.
- **Command Center ▾**: Übersicht · Spieltisch-Regie · Charaktere · Persönlichkeiten (NSC) · Ortsverwaltung · Materialvorbereitung · Galerie (Dateien) · Chronik-CMS.
- **Zuflucht** (`dashboard.tsx`, bisher „Deine Chronik“/„Spielerzentrale“): Aufbau unverändert. „Spieltisch betreten“ mit Live-Anzeige; Block „Letzter Spielabend“ mit „Alle Rückblicke“; die leere Kachel „Weitere Chronik-Informationen“ ist jetzt die **Galerie-Vorschau** (neueste freigegebene Bilder, „Zur Galerie“); Kachelreihe: Charakter · Inventar · Postfach · Notizbuch · Galerie · Gefallen · Wirtschaft (eine Zeile breit, vier Spalten mittel, zwei Spalten Handy).
- **Spieltisch verlassen** führt im Spielerbereich direkt zur Zuflucht; der Knopf am Tisch heißt dort „Zur Zuflucht“ (in der SL-Kommandozentrale unverändert „Zur Übersicht“).
- **Live-Zustand** (`live-state.ts`): ein offener, gestarteter Tisch gilt als live; Abfrage beim Laden, bei Fokus und alle 30 s.
- Aus Fassung 1 geblieben: Spielergalerie (`player-gallery.tsx`, `GET /api/character-gallery` mit Rechten), Rückblicke-Liste, Glossar-Namen, Würfel und Weltkarte ohne eigenen Eintrag, `?bereich=`-Kennungen unverändert. In der SL-Kommandozentrale bleibt `galerie` die Dateiverwaltung.

## Prüfungen
| Prüfung | Ergebnis |
|---|---|
| Typecheck | sauber |
| ESLint (geänderte und neue Dateien) | 0 Fehler |
| `pnpm test` | 411/411 (`tests/navigation-menu.test.mjs` neu für Fassung 3, `tests/dashboard-ux.test.mjs` angepasst) |
| Gesamtlauf `tests/*.test.mjs` | 525/531, 6 bekannte Altfälle (4 NPC, 2 Ortsdossier) |
| `tests/character-profile-integration.mjs` lokal | 29/29 inkl. Galerie-Rechte |
| Build | grün |
| Browser lokal | Spieler: Kopfleiste, Live-Anzeige (live), Welt-Dropdown, Zuflucht mit Galerie-Vorschau und Kacheln, Spieltisch betreten → „Zur Zuflucht“ → zurück auf der Zuflucht; SL: Command-Center-Dropdown mit acht Einträgen, Ziel-Seite 200; 375 px ohne Überlauf. `.local-test/ge-01` danach gelöscht |

## Grenzen und offen
- Kein echtes Mobilgerät geprüft. Auf dem Handy bricht die Kopfleiste in drei Zeilen um.
- „Nicht live“ ohne laufenden Abend nur über den Code geprüft (Demo hatte einen laufenden Abend).
- Später, nicht in 4c: Rückblicke selbst schreiben (SL und Spieler), Neuaufbau Gefallen und Wirtschaft, Zuflucht gestalten (Bilder, Beschreibung, Käufe beim Händler).
