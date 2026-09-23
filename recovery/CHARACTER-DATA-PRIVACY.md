# Charaktere und sensible Daten – Recovery 2026-09-14

Alle neuen Quellen und Claims sind GM-only. Historische Rollen, Freischaltungen und Besitzerfelder sind Belege, keine aktuellen Zugriffsrechte. Keine Accounts oder Passwörter werden übernommen.

| Kategorie | Belegter Umfang | Materialisierung / Entscheidung | Status |
|---|---:|---|---|
| DB characters | 7: 4 damalige SC, 3 Tests | Kein Rohdump. Vier Beschreibungen im DB-Übersichtsdokument erhalten. Keine sieben erfundenen Datensätze; keine Aktivierung. | TEILWEISE IMPLEMENTIERT |
| DB character_profiles | 4 | Nur Mengenbeleg, Rohzeilen fehlen. Nicht mit profiles.json gleichsetzen. | PROBLEM / RISIKO |
| DB sl_notes | 2 | Nur Mengenbeleg. Kein Transfer in Gruppenwissen. | PROBLEM / RISIKO |
| DB inventory_items | 41 | Nur Mengenbeleg. Kein erfundenes Spielerinventar. | PROBLEM / RISIKO |
| DB messages | 25 | Nur Mengenbeleg. Keine Empfänger oder Texte erfunden. | PROBLEM / RISIKO |
| DB login_history | 192 | Nur Mengenbeleg; technische Auth-Historie nicht importieren. | NICHT IMPLEMENTIERT – bewusst ausgeschlossen |
| Lokale profiles.json | je 3 in zwei Fassungen | Originale getrennt erhalten; Wachmann als Testprofil; Helena/Cat als ungeprüfte Arbeitsfassungen. Kein heutiger Charakterbogen überschrieben. | IMPLEMENTIERT |
| users.json | zwei gefundene Dateien | Byteumfang, Hash und Ursprung erfasst. Rohbytes wegen Zugangsdaten nicht in Source/R2 übernommen. Originale bleiben unverändert am Ursprung. | IMPLEMENTIERT |
| player-notes.json | leere Sammlung im lokalen CVK-LIVE | Komplettes Containerobjekt erhalten; kein Nutzinhalt erfunden. | IMPLEMENTIERT |
| Historische Medien | Verweise in Originalobjekten | Kein automatischer Dateiimport und keine Übernahme alter public/player/admin-ACL. Verlinkte Binärdateien sind nicht durch diese Recovery gesichert. | PROBLEM / RISIKO |

Helena: DB/Spiel- und Romanbehauptungen bleiben widersprüchlich. Corvina: Selene/London gegenüber Vivienne/Berlin bleibt ausdrücklich getrennt. Cat: fehlender Sire wird nicht ausgefüllt. Leopold wird durch Recovery nicht wieder aktiver SC. Soka erhält weder erfundenen Tod noch aktuelle Rolle. Die Konflikttexte stammen aus dem offiziellen Register; ihre Speicherung ist keine neue SL-Entscheidung.

Der Kampagnenexport ist GM-only und enthält persönliche historische Quellenmetadaten. Source-Handover und Recovery-Matrizen sind ebenfalls vertrauliche SL-Unterlagen, keine Spielerdownloads.
