# Feature Recovery – Produktideen, keine Wiederverwendung der alten Runtime

Entscheidungen für spätere Planung. „Neu bauen“ ist ausdrücklich kein in diesem Sprint gebautes Feature.

| Alte Produktidee | Entscheidung | Grundlage / Behandlung in Sprint 2 |
|---|---|---|
| Places Unlock / Discovery | behalten | Bestehendes Knowledge-System bleibt. Alte discovered/content_unlocked/rules_unlocked/encounters_unlocked nur im Quellenoriginal. Keine automatische Freigabe. |
| Persönliche Ortsnotizen | neu bauen | Leere player-notes-Sammlung nachgewiesen; sensible Zuordnung erforderlich. |
| Archiv / Knowledge Base | behalten | Index, Container und Einzelrecords erhalten, auch nicht mehr im Index vorkommende Dateien. Rohes HTML/Markdown nur als Text im GM-Viewer. |
| Character Hub / Profile | neu bauen | Bestehende neue Charakteransicht behalten; alte Profile als Fundus, kein PHP/Client-Auth übernehmen. |
| Galerie / Medien | behalten | Bestehende R2-Galerie bleibt; Legacy-Medienverweise noch separat zu prüfen. |
| SL-Plotbereich | behalten | Status quo und nie gespielte S3-Vorbereitung getrennt archiviert. Keine Weltereignisse daraus erzeugt. |
| Nachrichten | neu bauen | 25 DB-Nachrichten nur als Mengenbeleg; kein neues Messaging im Sprint. |
| Regelwerksuche | neu bauen | Regel-JSONs und bestehende Regel-Katalogentitäten miteinander verknüpft. Keine neue Suchmaschine für Gameplay. |
| XP / Gefallen | nur Fundus | Bestehende Funktion bleibt; leere boons/ledger/threads ausdrücklich dokumentiert. Keine neuen Regeln. |
| Händler / Wirtschaft | nur Fundus | 68 Items plus zwei Händlercontainer erhalten. Preise, Werte und Bestände nicht normalisiert oder neu balanciert. |
| Encounter | nur Fundus | 23 Vorlagen und 22 Ortsreferenzen; kein Überschreiben aktueller NSC-Dossiers. |
| Alte PHP-/MariaDB-Runtime, Client-Auth | verwerfen | Nur technische Referenz und Hash. Kein Ausführen, Einbinden oder Deployen alter Skripte. |

Die 490 nicht als Inhaltspaket übernommenen Dateien sind in der Source Registry einzeln mit Pfad, Hash und Entscheidung referenziert. Darunter technische Dateien und zwei ausgeschlossene users.json. Dies ist keine vollständige Codeprüfung aller alten Runtime-Dateien. Die Produktideen richten sich nach Auftrag und Website Recovery Master; die alte Runtime wird nicht rekonstruiert.
