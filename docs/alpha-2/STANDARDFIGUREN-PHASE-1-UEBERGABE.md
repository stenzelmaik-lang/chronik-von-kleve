# Standardfiguren – erster lauffähiger Schnitt (Phase 1)

Stand: 02.11.2026 · Branch `claude/standardfiguren-1` · Grundlage: `ChroniPlay_Alpha_2_0_Standardfiguren_Phase_1_Konzept.md`

## Was jetzt funktioniert

- **Katalog** (`domain/standard-figures.ts`, fest im Code, keine Datenbank): 30 Typen in 5 Gruppen × 5 Stufen = 150 Varianten. Ratte und Rabe sind ab „Schwer“ als **Begegnungsstufe, nicht Einzelstärke** gekennzeichnet; ihre Einzelwerte bleiben unverändert.
- **Szenenvorbereitung, Schritt 3 „NPCs und Dialoge“:** neuer Block „Standardfiguren dieser Szene“ (Gruppe, Figur, Stufe, Anzahl). Gespeichert im Szenendokument (`standardFigures`, Standard leer, alte Szenen bleiben gültig).
- **Live-Regie, Spalte „Material“, darunter Block „Standardfiguren“** (Sprungmarke „Figuren“ oben): vorbereitete Figuren mit „Einsetzen“, weitere Figur frei einsetzbar. Jede Figur ist eine **eigene Instanz** (Gesundheit mit V20-Wundabzug, Willenskraft, Blut bei passenden Wesen, Notiz, Bild).
- **Würfelpool sichtbar:** jede Schnellaktion zeigt Pool (Attribut + Fähigkeit), nach Wunden reduziert, und würfelt über die **bestehenden gemeinsamen Würfel** („nur SL“ oder „Für alle“). Schwierigkeit 2–10 wählbar.
- **Bilder anbinden wie bei NPCs:** Bild je Instanz aus der Galerie wählbar; „Bild für diese Figurenart merken“ legt eine Verknüpfung Typ ↔ Galerie-Datei an (Mehrfachbilder je Typ möglich). Entfernen einer Verknüpfung löscht nie die Galerie-Datei.
- **Rechte:** alles nur Spielleitung. Spieler und nicht Angemeldete bekommen 403/404/401; Figurendaten tauchen nicht im Spieler-Bühnenstand auf.
- **Speicher:** vorhandene Tabelle `settings` (Schlüssel `live-figures:<Kampagne>:<Abend>` und `standard-figure-assets:<Kampagne>`), Compare-and-Swap gegen gleichzeitige Änderungen, Doppelklick-Schutz per Anfrage-ID. **Keine Migration.**

## Ausdrücklich Entwurf

Alle Werte sind **Entwurfswerte** („entwurf-1“), plausibel gewählt, aber **nicht gegen V20 geprüft**; die UI sagt das. Die Stufen steigen über feste Eigenschaftslisten je Typ, keine pauschale Multiplikation. Die geprüften Statblöcke (Konzept Phase 2) ersetzen diese Tabellen später. Instanzen behalten einen Werte-Snapshot (`stats`), spätere Katalogänderungen verändern laufende Figuren nicht.

## Noch nicht enthalten (bewusst)

- Anzeige einer Figur **auf dem Spieltisch** („Auf Tisch zeigen“) und Beförderung zur Weltakte.
- Automatische Angriffs-, Schaden- und Initiativeketten (alles SL-gesteuert).
- Eigener Upload-Dialog im Figurenblock (es wird die bestehende Galerie genutzt).
- Begegnungsvorschläge mit automatischem Mehrfachspawn.

## Prüfungen

- Unit: `tests/standard-figures.test.mjs` (30/5/150, Stufenordnung, Tiere, Blut nur bei passenden Wesen, Wundabzüge, Labels, Szenenschema), im Standardlauf: 348/348.
- Integration: 29 `FIGURES`-Prüfungen (Rechte, Instanzen, Doppelklick, Zustand je Instanz, Bildverknüpfung, kein Spielerdatenabfluss), Gesamtlauf 2040 Prüfungen + 46 Rollenprüfungen.
- Browser (einmal, lokale Testinstanz): Auswahl in Schritt 3 → Speichern → Regie → zwei Figuren einsetzen → Wunde → Wurf mit reduziertem Pool.
- Nicht geprüft: echte Geräte, Zweitfenster auf einem anderen Gerät, Produktion.
