# Phase A – Tatsächlicher Bestand

Geprüft am 02.10.2026 in `C:\Users\Stenz\Documents\Codex\cvk-phase-c-remote-test\.review-work\live-release-git`. Keine Behauptung über einen neu verifizierten Live-Stand.

## Quellen und Git

- Ausgangsbranch `codex/inventory-2.0`, sauberer Stand `bb6bc07b1b404165bfc9765d7937d4dfe653ef59`.
- Tatsächlich vorhandener Character-Branch `codex/ce2-b1a-engine`: `bbf296995114101d236ae336ffe000bccda27825`.
- Historischer Command-Center-Branch `codex/sl-command-center-v2`: `24f5b22`.
- Beide sind laut erfolgreicher Git-Ancestry-Prüfung bereits Vorfahren des Inventar-Ausgangsstands. **Kein blinder Merge und kein zweiter Import erforderlich.**
- Neue Konzeptarbeitskopie: derselbe Checkout, neuer Branch `codex/sl-command-center-2-concept`. Bestehender Anwendungsquellcode bleibt unverändert.
- Das vorhandene kombinierte Grundlagenpapier **„Der echte Pen-&-Paper-Spielabend“, Version 2.0 vom 30.09.2026**, wurde vollständig gelesen. Es enthält die allgemeinen Grundlagen und die V20-Erweiterung: Gespräch statt Ablaufautomat, Wissenstrennung, Ort versus Plot, freie Entscheidungen, Laufzeitwerte, gezielte persönliche Inhalte und Nachbereitung. Quelle: `1-ChroniPlay_Paper_Analoges_Pen_and_Paper_V20_v2.docx` im vorhandenen lokalen Attachment-Ordner. Keine fehlenden Grundlagenpapiere als Blocker.

## Vorhandene Module und Grenzen

| Bereich | Tatsächlich vorhanden | Status gegenüber dem neuen Auftrag / wiederzuverwenden |
|---|---|---|
| SL-Arbeitsfläche | `app/spielbereich/modules/command-center.tsx`, sechs Werkzeuge, Fokusperson, zwei parallele Werkzeuge | **TEILWEISE IMPLEMENTIERT.** Kein freies Docking, keine Größenänderung, kein Pin, keine gespeicherte persönliche Anordnung, keine Mehrfachinstanzen. |
| Sitzungsregie | `session.tsx`, `session-stage.tsx`, Szene, Status, Runde, Initiative, gemeinsames Protokoll | **IMPLEMENTIERT als bestehende Funktion.** Szene ist Text im Session-Record, kein vollständiges Storysystem. Ungespeicherter Szenentext überlebt vollständigen Reload nicht. |
| SL-Notizen | `command-notes.tsx`, bestehendes `gm_body`, Speichern beim Verlassen, Fehler behalten Eingabe | **IMPLEMENTIERT, begrenzt.** Versionsschutz auf gesamtem Session-Record; keine automatische Zusammenführung konkurrierender Änderungen. |
| Gruppenansicht | `/api/command-center?view=player`, sichere reduzierte Sitzungs-/Handoutdaten | **IMPLEMENTIERT als Gruppenpreview.** Kein persönlicher unabhängiger Spielerlogin und kein vollständiger Medienreader. |
| Charaktere | `command-character.tsx`, `character-detail.tsx`, `server/character-projection.ts`, `/api/character-detail`, CharacterDetailProjection | **IMPLEMENTIERT.** Bestehende Zugriffe und Datenschutz bleiben maßgeblich; auch die SL darf fremde private Charakterdaten nicht pauschal lesen. |
| Regel-/XP-Engine | `domain/character-engine.ts`, `/api/character-engine`, bestehende Progression/Review-Komponenten | **IMPLEMENTIERT als bestehendes Fundament.** Permanenter Bestätigungsstatus, Laufzeitwerte, atomare XP-Operationen und Ausnahmen dürfen nicht durch neue Arbeitsplatzformulare umgangen werden. |
| Inventar 2.0 | vorhandene Inventar-Domäne/API/UI; Link aus der Charakterakte mit konkreter Charakter-ID | **IMPLEMENTIERT lokal im Ausgangsstand.** Der Arbeitsplatz integriert diese Quelle, keine zweite Inventarverwaltung. Live-Release dieses Branches hier nicht geprüft. |
| Ortsakten / Spielwelt | `domain/location-*`, `server/location-repository.ts`, CMS-Service/Projektor, vorhandenes Ortsdossier/MapLibre | **IMPLEMENTIERT im Bestand.** Ortshierarchie, Discovery, konkrete Revisionsfreigaben und private Medien wiederverwenden. Keine neuen Electric-Taberna-Daten. |
| Ortskontext der Sitzung | `command-place.tsx`, aktive Orts-ID in privatem Session-Kontext | **IMPLEMENTIERT.** Auswahl speichert derzeit sofort. Künftiges bloßes Blättern darf nicht unbemerkt den aktiven Sitzungsort ändern. |
| Chronik | `modules/chronicle.tsx`, chronologisch angeordnete Records mit Summary/Text, Gruppenfilter | **TEILWEISE IMPLEMENTIERT gegenüber Storybuch.** Historisches Lesearchiv, kein strukturiertes Plotdossier mit Möglichkeiten, Motiven und getrennten tatsächlichen Ereignissen. |
| NSC/Fraktionen | Entity-Typen NPC/FACTION, generische Records-/CMS-Oberflächen, Beziehungen | **TEILWEISE IMPLEMENTIERT.** Kein vollständiger zentraler NSC-Lebenslauf mit kontrollierten Zustandsänderungen als eigener Arbeitsplatzbaustein nachgewiesen. |
| Entitäten / Beziehungen / Wissen | `db/schema.ts`, `domain/types.ts`, `server/entities.ts`, stabile IDs, Kampagnen-ID, Knowledge-Grants, Beziehungen | **IMPLEMENTIERT.** Grundlage für Verknüpfungen. Generischer Player-Filter und Legacy-Übergänge sind kein ausreichender Freigabeautomat für neue beliebig strukturierte Plotdossiers. |
| Revisionen / Freigaben | `entity_revisions`, Releases, Medienreferenzen und Revisionsereignisse | **IMPLEMENTIERT für Orts-CMS.** SQL-Revisionstabellen selbst sind generisch; aktuelle Service-/Validierungs-/Medienpfade sind an `location_nodes` gebunden. Keine universelle Story-CMS-API behaupten. |
| Rich Text | `location-rich-text.ts`, `modules/rich-text.tsx`, erlaubte JSON-Blöcke v1 | **TEILWEISE IMPLEMENTIERT.** Absätze, H2/H3, Listen, Marks/Links; keine Tabellen, eingebetteten Dateien, internen Entity-Verweise oder privaten Inline-Kommentare. `contentEditable`/`execCommand` benötigt einen belastbaren Editor-Pilot. |
| Persönliche SL-Briefe | `/api/messages`, Empfängerprüfung, idempotentes Senden, Lesequittung, bis 20 Empfänger | **IMPLEMENTIERT als Textnachricht.** Keine Attachments, Audio-/Videoversendung oder tatsächliche Wissensvergabe allein durch Empfang. |
| Dateien / R2 | `/api/files`, `/api/cms/media`, private Auslieferung, Bild-/PDF-Katalog | **IMPLEMENTIERT für vorhandene Zwecke.** Ortsvorschau prüft Rolle, Zielgruppe und konkrete Revision. Noch keine gemeinsame vollwertige Audio-/Video-Delivery-Pipeline mit Range-Zugriffen. |
| Audit | `world_events`, Revision-/Rollenereignisse | **IMPLEMENTIERT als technische Nachvollziehbarkeit.** Darin können auch XP- und Redaktionsoperationen stehen. Das ist kein automatisch wahrer fiktionaler Sitzungsverlauf. |
| Anmeldung / Rollen | `server/platform-auth.ts`, `access.ts`, `role-resolver.ts`, Plattformrollen und Mitgliedschaften | **IMPLEMENTIERT im Bestand.** SL-Zugriff nur aktive Owner/GM; `platform_admin` ist keine automatische SL-Rolle. Gesperrt/Pending und fremde Kampagnen bleiben ausgeschlossen. |
| Kampagnenkontext | Daten tragen Kampagnen-IDs; Actor-Resolver verwendet derzeit Kleve-Kontext | **TEILWEISE IMPLEMENTIERT für spätere Mandantenfähigkeit.** Noch kein frei wechselbarer sicherer Multi-Kampagnen-Arbeitsplatz. |
| Andockbarkeit | `components/ui/resizable.tsx`, installiertes `react-resizable-panels` | **WIEDERVERWENDBARE KOMPONENTE.** Noch kein persönlicher Docking-Manager. |
| Suche / Favoriten / letzte Akten | Kein kampagnenweiter berechtigungsgefilterter Command-Center-Suchdienst vorgefunden | **NICHT IMPLEMENTIERT in dieser Form.** Neues kleines Modul auf vorhandenen Entitäten vor externem Suchdienst. |
| Rätselsteuerung | Keine vollständige Rätsel-Engine/Phaser-Integration im geprüften Bestand | **NICHT IMPLEMENTIERT.** Erst Konzept, spätere gesonderte Freigabe. |

## Wichtige Architekturprobleme

1. **Zwei starre Werkzeuge sind kein konfigurierbarer Arbeitsplatz.** Eine Komponenteninstanz pro Tool verhindert zugleich Helena und Corvina. Der Personenfokus und der Storykontext müssen unabhängig werden.
2. **Parallele Ganzdatensatz-Saves können kollidieren.** Vorhandener Versionsschutz ist richtig. Neue Notiz-/Layout-/Storyänderungen benötigen passende getrennte Revisionseinheiten statt immer den ganzen Session-Record zu ändern.
3. **Gemeinsam bedeutet heute aktive Kampagnengruppe.** Eine zusätzliche freie Empfängergruppe braucht ein ausdrücklich geprüftes Modell. Nicht behaupten, beliebige benannte Gruppen seien bereits verfügbar.
4. **Die Ortsrevisionen sind nur teilweise generisch wiederverwendbar.** Einen kleinen gemeinsamen Repository-Kern isolieren, Fachvalidierung und Projektionen separat halten. Keine Story nach `location_nodes` zwingen.
5. **Legacy-Freigabe und Schlüsselwortfilter eignen sich nicht für neue Geheimnisdokumente.** Neue Dokumenttypen brauchen erlaubte Reader-Felder und überprüfte explizite Releases; Widerruf darf keinen Legacy-Fallback öffnen.
6. **Polling skaliert schlecht mit vielen Werkzeugen.** Der bisherige 10-Sekunden-Abgleich darf nicht pro neuer Panelinstanz vervielfacht werden.
7. **Lesequittung ist kein Charakterwissen; technischer Audit ist kein Kanon.** Diese Begriffe in Daten und Oberfläche voneinander trennen.
8. **Ältere Übergaben enthalten historische Testergebnisse.** Deren Zahlen sind keine neuen Nachweise für diesen Konzeptstand. Der aktuelle Prüfbericht nennt ausschließlich hier durchgeführte Prüfungen.

## Rahmen

Cloudflare Workers, D1, R2 und bestehende Git-Struktur bleiben erhalten. Keine neue Abhängigkeit, kein Cloudflare-Aufruf, keine Migration, kein Remote-Push oder Deployment für diese Phasen. Produktions-Secrets wurden weder gelesen noch in Konzeptdateien übernommen.
