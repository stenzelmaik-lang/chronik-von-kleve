# Sprint 2 – gesicherter Zwischenstand, KEINE Recovery-Abnahme

Dieser Stand ist nicht als vollständig abgeschlossener Sprint gemeldet. Die Entwicklung erfolgt ausschließlich mit Astra. Eine Fortsetzung bleibt auf Auftrag 002 begrenzt; Sprint 3 ist nicht freigegeben.

## IMPLEMENTIERT

Quellenpaket, unveränderte Originale, 649 Referenzen, 2.005 Claims, additive D1/R2-Provenienz, GM-API und CMS-Quellenarchiv. Die Details und Grenzen stehen in SPRINT-2-RECOVERY.md. Alle 67 bestehenden Katalogidentitäten sind anhand ursprünglicher Import-IDs bzw. des unveränderten Baseline-Snapshots erhalten. Knowledge und World Events werden durch Recovery nicht erweitert.

## TEILWEISE IMPLEMENTIERT

Coverage und Konfliktprüfung: Die Mindestmengen sind maschinell nachgewiesen; ein abschließender semantischer Durchgang, insbesondere zusätzliche Konflikte, Medienreferenzen und einzelne Versionszuordnungen, ist noch offen. Die 13 vorgegebenen Konflikte und zwei technischen Konflikte sind erfasst; Stichwort-Zuordnungen sind Prüfkandidaten.

## NICHT IMPLEMENTIERT / nächster Arbeitsschritt

1. Verbleibenden Quellen-/Versions- und Medienverweis-Abgleich abschließen. Technische Hashreferenzen von tatsächlich inhaltlich geprüften Dateien deutlich unterscheiden. Keine vermeintliche vollständige Rohdump-Recovery behaupten.
2. Kandidatenzuordnungen und unbekannte Legacy-IDs gezielt fachlich prüfen; nur belegte Identitäten verbinden. Optional nötige Nachbesserungen am CMS für vollständige Auffindbarkeit innerhalb des Recovery-Scope.
3. Abschließende Browserprüfung des GM-Quellenarchivs durchführen; Mobilansicht wurde in diesem Zwischenstand nicht visuell geprüft.
4. Geprüften Source auf dieselbe Sites-Repository-Identität pushen, Version speichern und deployen. Get_site und Hosting-Skill erneut verwenden. Migration 0002 ist noch NICHT produktiv angewendet.
5. Produktiven GM-Import durchführen und überprüfen. Keine erfundenen Auth-Header gegen die öffentliche Site verwenden. Nur echte angemeldete GM-Sitzung oder dokumentierter autorisierter Kanal. Import zuvor nur gegen isoliertes lokales D1/R2 getestet.
6. Endgültigen Source-Handover und vollständige Prüf-/Coverage-Unterlagen in 01 Site Source & Handover ablegen. Erst dann den Recovery-Sprint als zur Abnahme bereit melden und STOPP.

## PROBLEM / RISIKO

Kein produktiver D1/R2-Snapshot wurde in diesem Zwischenstand abgerufen. Öffentlich läuft weiterhin der abgenommene Sprint-1-Stand (Version 9 beim letzten Get_site). Keine Produktivdaten wurden in diesem Recovery-Lauf geändert. Source-Handover enthält sensible SL-Inhalte, aber keine bewusst übernommenen Zugangsdaten oder .env-Werte. Alte users.json sind nur über Hash/Pfad nachgewiesen.

Die verbleibenden Aufgaben sind keine Aufforderung an den nicht programmierenden Nutzer; der nächste Astra-Lauf soll sie autonom fortsetzen.
