# Sticky Notes v1 – lokale UX-Abnahme

Stand: 26.10.2026. Ausschließlich isolierter Spieltisch-Prototyp, keine Produktivfreigabe.

## Ziel und verbindliche Rollenentscheidung

Eigene Papierzettel auf derselben Spielbühne erstellen, beschriften, bearbeiten, verschieben, löschen und ausdrücklich teilen. Nach der ergänzenden Nutzerentscheidung bedeutet **Privat: Ersteller und SL können lesen; andere Spieler nicht**. **Gruppe: alle Teilnehmer der simulierten Runde können lesen**. Auch die SL kann fremde Zettel nicht verändern, verschieben, löschen oder freigeben. Diese Rechte bleiben beim Ersteller.

Die Oberfläche benennt das als „Privat · du & SL“ beziehungsweise „Privat · SL-Einsicht“. Eigene private Zettel lassen sich auf der persönlichen Bühne ausblenden; das verändert weder Freigaben noch SL-Einsicht. Die SL-Übersicht zeigt fremde private Zettel vollständig, auch wenn sich Zettel auf der Bühne überlagern.

## Stand und Arbeitsbaumschutz

- Grundlage/HEAD unverändert: `d33f4162a7d0d1a1544cbded2c2e2c6b348d6c1b`.
- Isolierter Branch: `codex/spieltisch-2-prototyp` in `work/spieltisch-2-prototyp` unter dem Arbeitsverzeichnis dieses Chats.
- Vorherige UX-abgenommene Prototypdateien gesichert: `.local-work/spieltisch-2/before-sticky-notes-20261026-202757.zip`.
- Vorheriger synthetischer Laufzeitstand separat gesichert: `.local-work/spieltisch-2/before-sticky-state.json`.
- Geschützter Ausgangscheckout `cvk-m1-kernmodell` abschließend weiterhin sauber auf `d33f416`.
- Keine vorhandenen App-/Domain-Dateien geändert, keine echten Konten, Charaktere, Kampagnen oder Sitzungen verwendet. Kein Commit/Push/Merge/Deployment, keine D1-/R2- oder Produktionsmigration.

## Ist-Befund und Integrationsentscheidung

Der bestehende Prototyp besitzt `objects`, normalisierte Bühnenrechtecke, Rollenprojektion, Versionskontrolle und einen gemeinsamen `/prototype/state`-Lese-/Schreibpfad. Das Whiteboard bleibt eine eigene bestehende Annotationsebene. Notizen waren zuvor nur eine synthetische SL-Textanzeige, kein persönlicher Zettelbestand.

Sticky Notes erweitern deshalb **denselben** Objektbestand um `kind: note`, stabile UUID, Ersteller, Klartext, Sichtbarkeit und Revision. Sie nutzen dieselben CRUD-Kommandos, dieselbe Positionsbegrenzung und dieselbe Synchronisierung. Keine zweite Whiteboard-, Nachrichten- oder Notizengine; keine neue Produktionsdatenstruktur.

Gestaltungsvariante: kleine, warme Papierobjekte mit dezentem Schatten und Falzecke statt einer weiteren Fenster-/Drawer-Ansicht zum Lesen. Das bestehende HUD öffnet lediglich Erstellen/Übersicht und Ausblendung. Bearbeitung und Freigabe sitzen direkt am Zettel. Verfügbare Bühne und Szenenbild bleiben erhalten.

## Funktionsumfang und Speicherung

- Neu → zunächst privat, mit direktem Texteingabefokus.
- Absätze und Zeilenwechsel bleiben unverändert; HTML wird als Text dargestellt und nicht ausgeführt.
- Speichern oder Strg+Enter; Abbrechen/Escape verwirft den Textentwurf. Rückfokus auf Bearbeiten.
- Ziehen am Zettelkopf, alternativ Pfeiltasten; Umschalt vergrößert den Schritt.
- Teilen/Wieder privat sind ausdrückliche Aktionen; keine Freigabe aus dem Text abgeleitet.
- Löschen mit Bestätigung direkt am Zettel, ohne nativen Browserdialog. Danach Rückfokus zum HUD.
- Szenenwechsel entfernt weder Notizen noch die übrigen Bühnenobjekte.
- Vorhandenes 1-s-Polling wiederverwendet. Rückkehr in einen sichtbaren Tab löst einen aktuellen Abruf aus. Kein behaupteter WebSocket-/Internet-Echtzeitbetrieb.
- Gesamter synthetischer Bühnenstand liegt atomar unter `.local-work/spieltisch-2/state.json`; nur nach erfolgreichem lokalen Schreiben wird die Änderung im Arbeitsspeicher übernommen. Die Datei ist Git-ignoriert und wird über keine HTTP-Route ausgeliefert.
- Das ist eine bewusste Erweiterung gegenüber dem alten Etappe-1-Bericht: Der Teststand überlebt jetzt auch einen lokalen Serverneustart. Ungültige Dateien werden nicht still durch einen leeren Stand ersetzt.
- Nur die Ausblendungspräferenz wird im Browser gespeichert, getrennt je simuliertem Betrachter. Notiztexte werden dafür nicht in Local Storage kopiert.
- Lokale Grenzen: 3000 Zeichen je Zettel, 30 eigene Zettel je simuliertem Teilnehmer.

## Tatsächlich durchgeführte Prüfungen

| Prüfung | Ergebnis und Beleg |
|---|---|
| A erstellt privat → B erhält nichts | Browser und HTTP-JSON bestanden |
| SL liest A privat | Browser auf Bühne und in der Gesamtübersicht, HTTP-JSON bestanden |
| A teilt → B sieht automatisch | Ohne Seitenneuladen nach Rückkehr in den sichtbaren B-Tab bestanden |
| A verschiebt/bearbeitet → B erhält neuen Stand | Echter Mausdrag, Pfeiltaste, neuer Text mit Absätzen und Gruppenprojektion bestanden |
| B/SL verändern fremde Zettel | Verbotene Edit-/Move-/Share-/Delete-Kommandos abgewiesen; fremde UI bietet keine entsprechenden Aktionen |
| Wieder privat | Neue B-Projektion enthält den Zettel nicht; SL behält Einsicht |
| Eigene private Zettel aus-/einblenden | A-DOM ausgeblendet, SL-Sicht unverändert; Präferenz nach Neuladen erhalten |
| Abbrechen | Nicht gespeicherter Text verworfen, bisheriger Inhalt und Rückfokus erhalten |
| Löschen | B-eigener Testzettel gelöscht; Bestätigung abbrechbar; SL-eigener Testzettel ebenfalls gelöscht, Rückfokus bestätigt |
| Szenenwechsel / Wiederöffnen | Kaserne, gespeicherte Notiz-ID, Inhalt und Position bleiben erhalten |
| Serverneustart | Gespeicherte Datei vor/nach Neustart SHA-256-identisch; wiederhergestellte API-Objekte/Positionen geprüft |
| NPC / Dokument / Whiteboard | Figur auflegen, Dokument lesen/120-%-Zoom/Escape, Linie zeichnen/Undo/Redo bestanden; anschließend nur diese zusätzlichen synthetischen Testobjekte zurückgenommen |
| Full HD | Tatsächlich 1920 × 1080 CSS-Viewport, Bühne 1864 × 1024 gemessen |
| Kleinere Bühne | Tatsächlich 960 × 540 CSS-Viewport, Bühne 904 × 484; 200 × 235 px kleiner Zettel bis zum Rand gezogen, alle Bedienknöpfe sichtbar; gespeicherte Grundgröße unverändert |
| Browserkonsole | Keine Anwendungsfehler in der zuletzt geprüften SL-Ansicht |
| Automatisiert | **72 Tests, 0 Fehler**, einschließlich 9 neuer Notiz-/Speicher-/Layoutprüfungen; **20 bestehende + 26 neue HTTP-Prüfungen** bestanden |
| Typen / Build | TypeScript und lokaler Browserbundle-Build bestanden |

Belege: `.local-work/spieltisch-2/evidence/sticky-notes/`. Enthalten sind `regression.txt`, `typecheck.txt`, `http.json`, `restart-before.json`, `restart-after.json`, Layoutmessungen und Screenshots `01` bis `06`.

Lokale HTTP-Stichprobe: 28 GET-Abrufe, 0,37–29,72 ms, größte gemessene Zustandsantwort 1055 Byte. Browserbundle 254827 Byte unkomprimiert. Das sind Loopback-Laborwerte, keine Internet-, p75-, LCP-/INP- oder produktiven Mehrbenutzermessungen. Der Synchronisierungsrhythmus bleibt 1 Sekunde für sichtbare Clients.

## Geänderte Dateien

Innerhalb `prototypes/spieltisch-2/` geändert: `main.tsx`, `stage.module.css`, `stage-state.mjs`, `server.mjs`, `types.ts`.

Neu: `sticky-note.tsx`, `stage-storage.mjs`, `sticky-notes.test.mjs`, `sticky-http-check.mjs`, dieser Bericht. Vorhandener Whiteboard-Editor, Dokument-Reader und Würfelbestand werden weiterverwendet. Keine neue Abhängigkeit.

## Grenzen und Abnahme

**Simuliert:** Betrachter `gm/a/b` werden frei gewählt. Dies sind keine echten Anmeldungen oder Kampagnenberechtigungen. Die serverseitige Projektion im lokalen Test ist ausdrücklich **kein Nachweis produktiver Zugriffssicherheit**. Vor einer echten Integration müssen Actor-/Mitgliedschaftsprüfung und Zustellung durch den vorhandenen produktiven Autorisierungspfad erfolgen.

**Noch nicht Gegenstand dieser Etappe:** produktive Synchronisierung und Speicherung, native 200-%-Browserzoom-Abnahme, vollständige Mobilabnahme, Lasttests mit vielen Teilnehmern oder 3D-Würfel. Texte, die andere bereits gelesen haben, können durch Widerruf nicht nachträglich vergessen gemacht werden.

Öffnen: `http://127.0.0.1:8812/`; Spieleransichten `?ansicht=a` und `?ansicht=b`. Start bei Bedarf aus diesem Worktree: `node prototypes/spieltisch-2/server.mjs`. Der private Testspielstand wird automatisch geladen. Im Abnahmestand bleibt ein eindeutig synthetischer privater A-Zettel zur SL-Einsichtsprüfung stehen; zusätzliche B-/SL-Löschtests wurden bereinigt.

**Sticky Notes v1 – lokal abnahmebereit: JA.**

**Nächster einzelner Schritt: Pano prüft die Papierzettel und die SL-Einsicht persönlich. Danach STOPP. Keine Live-Freigabe und keine 3D-Würfelarbeit begonnen.**
