# Spieler- und Charakterverwaltung 3.0 – lokale Abnahme

Stand: 30.10.2026. Basis: `989f26ef752fa6b0ec329034896df46c0fda9207` (enthält den freigegebenen Produktionsstand `0b5c427`). Eigener Worktree `work/charakterverwaltung-3`, Branch `codex/charakterverwaltung-3`. Keine Veröffentlichung, keine Produktionsmigration und keine produktiven Schreibtests.

## Umfang und vorhandene Grundlage

Die Charakterakte bleibt ein bestehender `records`-Datensatz. Die Erweiterung verwendet `/api/character-engine`, `/api/character-detail`, `/api/records`, `/api/members`, den vorhandenen XP-Verlauf, versionsgeschützte D1-Batches und `world_events`. Private Korrespondenz bleibt im vorhandenen Nachrichtensystem. Keine neue Datenbank, keine neue Abhängigkeit und keine zweite Charakter- oder Nachrichtenengine.

### 1. Bestandsvergleich und vollständige Anzeige

Der autorisiert gelesene Referenzbogen wurde einschließlich Formularwerten und beider gerenderter Originalseiten mit einer eng begrenzten, ausschließlich lesenden Produktionsabfrage und der tatsächlichen SL-Ansicht verglichen. Es gab keinen vollständigen Datenbankexport.

Ergebnis: Die Website zeigte die abgefragten Daten weitgehend korrekt; wesentliche Lücken lagen bereits im gespeicherten Bogen. Hintergründe, Tugenden, Moral, Willenskraft und Ressourcen waren unvollständig beziehungsweise abweichend. Unterschiede bei Disziplinen können auch spätere Entwicklung sein und dürfen nicht automatisch zurückgesetzt werden. Historische Gesamt-XP und Verbrauch sind nicht durch eine einzelne handschriftliche Saldenangabe belegt.

Der konkrete Vorher-/Nachher-Vergleich mit Originalwerten liegt ausschließlich im ignorierten privaten Arbeitsverzeichnis `.local-work/character-3/Corvina-Abweichungscheck-PRIVAT.md`; Originalbogen, Formulardaten und Originalscreenshots werden nicht versioniert. Es wurde kein Originalwert in Produktion oder in einen ausführbaren Test übernommen.

Die allgemeine Anzeige bewahrt jetzt gespeicherte Werte über fünf Punkten und zusätzliche Fähigkeits-/Attributnamen sowie alle gespeicherten Tugenden einschließlich Überzeugung und Instinkt. Nicht belegte historische XP werden als unbekannt statt als erfundene Null geführt. Ein eigener Bereich nimmt individuelle Charakterinformationen auf, ohne ein neues Profilmodell zu erzeugen.

### 2. SL-Bearbeitung

Die SL kann die vorhandene Akte ausdrücklich als Bogen bearbeiten: Name, Identität, Clan, Generation, Attribute, Fähigkeiten einschließlich freier und zusätzlicher gespeicherter Fähigkeiten, Disziplinen, Hintergründe, Tugenden, Moral/Pfad, dauerhafte Willenskraft, Blutmaximum/-verbrauch, Vorzüge/Schwächen, Clansschwäche und individuelle Texte. Bestehende unbekannte Legacy-Felder bleiben erhalten. Ein Clanwechsel im Bestandseditor löscht keine Disziplinen.

Diese begründete Korrektur unterliegt Struktur-, Bereichs-, Kampagnen- und Versionsprüfungen, aber keinen Neucharakterbudgets. Werte von 6/7 können bewusst dokumentiert werden. Das ist keine automatische Freigabe solcher Werte für reguläre XP-Steigerungen. Blut, Gesundheit und temporäre Willenskraft behalten ihre vorhandenen Laufzeitpfade. Abbrechen schreibt nichts.

Das Audit enthält Akteur, Zeitpunkt, Grund, Version und geänderte Bogenfelder vorher/nachher. SL-Audit und SL-Notizen bleiben für Spieler gesperrt. Es gibt keinen automatischen Rücksetzknopf, der spätere Entwicklung überschreiben könnte; eine erneute begründete Korrektur ist nachvollziehbar möglich.

### 3. Historische Übernahme und XP

Eine bewusste Bestandsübernahme erhält den aktuellen Bogen und einen historischen Snapshot. Sie erzeugt eine einmalige XP-Eröffnung statt einer neuen Belohnung. Verfügbarer Saldo ist Pflicht; historische Gesamtsumme und Verbrauch können unabhängig voneinander unbekannt bleiben. Nur wenn beide belegt sind, müssen sie mit dem Saldo übereinstimmen. Ein Übernahmebeleg und ein Grund sind Pflicht. Anschließend steht der Bogen zur gesonderten SL-Prüfung; es erfolgt keine automatische Bestätigung.

Neue Vergaben, Ausgaben und signierte Saldenkorrekturen werden im vorhandenen XP-Verlauf angehängt. Buchungskennungen, Versionsvergleich und atomare Speicherung verhindern doppelte oder konkurrierende Buchungen. Eine Gutschrift kann genau einmal gegengebucht werden; die ursprüngliche Buchung bleibt erhalten. Die Korrektur eines Saldos setzt keine gekauften Werte zurück und darf keinen negativen Saldo erzeugen. Historische Gesamtsummen werden durch später bekannte Gutschriften nicht nachträglich erfunden.

Geprüfte Regelquelle: [Erfahrungs- & Belohnungssystem der Kleve-Chronik](https://docs.google.com/document/d/1QcZBBJ2RUvUzev35FEsjf9kaA9pnUSOGRWxwr-rZDXw/edit). Die Willenskraft-XP-Kosten wurden von pauschal 1 auf den aktuellen Wert korrigiert. Der Freebie-Preis bleibt 1. Tugendsteigerungen und vorhandene freie Fähigkeiten nutzen die belegten Kosten, ohne abgeleitete Moral-/Willenskraftwerte erneut zu erhöhen. Für Hintergrundsteigerungen existiert in dieser Quelle kein allgemeiner XP-Preis; der zuvor unbelegte pauschale Preis wurde gesperrt. Neue unbekannte Disziplinen und andere Sonderfälle erhalten keine erfundene Preisregel.

### 4. Freigaben und Eigentum

Charakterbestätigung, ausdrückliche Bogenbearbeitung und Entwicklung sind voneinander getrennt. Die SL kann je Charakter Bearbeitung erlauben/widerrufen und Entwicklung als Direktkauf, Antrag oder gesperrt festlegen. Vorhandene reguläre Direktkäufe bleiben standardmäßig kompatibel. Eine Spielerbearbeitung eines bestätigten Bogens führt zur erneuten SL-Prüfung.

Anträge ändern weder Werte noch XP. Die SL-Entscheidung prüft aktuelle Werte, Kosten und Saldo erneut und schreibt Kauf und Entscheidung zusammen. Widerrufe wirken unmittelbar auf dem Server. Ein Spieler kann weder fremde Charaktere bearbeiten noch sich Rechte, Genehmigungen, historische Snapshots oder XP über manipulierte generische Anfragen geben. Unveränderte Legacy-Werte mit reinen Textänderungen bleiben kompatibel; mechanischer Nachtrag benötigt die ausdrückliche Bearbeitung.

### 5. Spielerprofile und Kommunikation

Die bestehende SL-Navigation führt zu Spielerprofilen mit Kampagne, Status, aktivem Charakter, weiteren zugeordneten Akten, Bestätigung und Anträgen. Charakterakten bleiben eine eigene Ansicht mit Rückweg. Die SL-Auswahl ändert nicht die persönliche Charakterauswahl des Spielers.

Der Profil-Endpunkt liefert keine Passwörter, E-Mail-Adressen oder rohen Kontoeinstellungen. Persönliche und Gruppennachrichten öffnen den vorhandenen Empfänger-geschützten Briefeditor. Es gibt keinen automatischen Versand, keine E-Mail-Infrastruktur und keine echten Testnachrichten.

### 6. Gesamtintegration und Prüfung

Die veröffentlichte SL-CMS-Gestaltung, obere Navigation, Dialoge und Charakterkomponenten werden weiterverwendet. Die Spieleransicht zeigt nur ihre eigenen zulässigen Aktionen. Hintergrundaktualisierung einer geöffneten Charakterakte erhält deren Ansicht; ein Rechtefehler leert weiterhin geschützte Daten.

Die Tests verwenden ausschließlich separate synthetische Konten, Charaktere und lokale D1-/R2-Ressourcen. Der Spieltisch und die parallel bearbeiteten Medienkomponenten wurden nicht verändert. Die gemeinsame Charakteranzeige profitiert lediglich von der korrigierten, wiederverwendeten Rating-Komponente.

Abschließender Prüfstatus:

| Prüfung | Ergebnis |
|---|---|
| Vollständige Einzel-/Regressionstests | 168/168 bestanden |
| Vollständige Integration mit allen vorhandenen Migrationen in frischer lokaler D1 | 1.851/1.851 bestanden |
| Zusätzliche Rollen-/Backfill-/Rollbackprüfungen | 46/46 bestanden |
| SL/Spieler A/Spieler B im echten lokalen Authentifizierungspfad | 15 Browserabläufe bestanden, keine JavaScript-Laufzeitfehler |
| Desktop 1920/1440 und Mobil 390 Pixel | Bestanden, kein horizontaler Überlauf |
| Tastatur, Escape, Abbrechen, erneutes Öffnen und Rücknavigation | Bestanden |
| Typecheck, ESLint aller betroffenen TS/TSX-Dateien, Produktionsbuild | Bestanden |
| Mechanischer Designcheck und visuelle Sichtprüfung | Bestanden, keine Detector-Findings |
| Unabhängiger Codex-Prüflauf der Schreib-/Berechtigungswege | Alle konkreten Findings behoben und nachgeprüft; Zusatzprüfung der Ursprungssicherung bestanden |
| Produktion | Keine Migration, kein Import und kein Schreibtest; keine Veröffentlichung |

Die vollständige Integrationssuite prüft auch die bestehenden Kampagnen-, Sitzungs-, Spieltisch-, Medien-, NPC-, Orts-, Inventar-, Nachrichten- und Kontofunktionen. Erzwungene Fehlerausgaben in den Testlogs gehören zu den geprüften atomaren Fehler-/Rollbackfällen; der Gesamtlauf endet erfolgreich.

Im unabhängigen Prüflauf wurden reale Umgehungen über den generischen Records-Schreibpfad, eine fehlende Snapshot-Prüfung im Antragsweg, unvollständige Rechte-Audits und eine manipulierbare Engine-Zuordnung gefunden. Alle sind geschlossen. Konkrete HTTP-Regressionen prüfen diese Fälle erneut einschließlich freier Fähigkeiten, Titeländerungen, weggelassener/null/falscher Engine-Version, Wiederholungsbuchungen und Kampagnengrenzen. Der unabhängige Prüfer verwendete synthetische Auth-/Datenbank-Stubs; die echte HTTP-/D1- und Browserprüfung wurde zusätzlich im eigenen isolierten Testlauf ausgeführt.

Die Browserabnahme prüft Spielerprofil → dieselbe Originalakte → SL-Bogenbearbeitung → Abbrechen ohne Speicherung → Bestandsübernahme → gesonderte Bestätigung → neue XP → ausdrückliche Spielerbearbeitung → erneute Prüfung → Entwicklungsantrag → SL-Genehmigung → Gegenbuchung → Rücknavigation → privaten vorhandenen Briefeditor öffnen/abbrechen. Es wurden keine echten Nachrichten versendet.

Die gesonderte Ursprungsprüfung älterer bereits bestätigter Engine-Bögen mit vorhandenem XP-Verlauf ist über Domain- und echte HTTP-/D1-Integration nachgewiesen; der 15-teilige Browserablauf verwendet den normalen historischen Übernahmefall. Persönliche UX-Abnahme und eine spätere Produktionsfreigabe bleiben getrennt. Der lokale Stand ist zur persönlichen Prüfung bereit.

## Lokaler persönlicher Test

Adresse: `http://127.0.0.1:8838/sl/command-center?bereich=charaktere`.

Nur lokale synthetische Konten: `command-gm@example.invalid`, `command-a@example.invalid`, `command-b@example.invalid`. Lokales gemeinsames Testkennwort: `ChroniPlay-Demo-2036!`. Diese Konten existieren ausschließlich in der isolierten Testdatenbank.

Start im eigenen Worktree nach einem lokalen Build:

```powershell
node scripts/run-framework.mjs build
$env:CVK_TEST_PORT='8838'
node --experimental-strip-types scripts/test-local.mjs --weekend
```

Vor einem erneuten Build nur diesen lokalen Server beenden; dessen Buildverzeichnis ist unter Windows während des Betriebs gesperrt. Synthetische Teststände bleiben im eigenen Worktree erhalten.

Als SL ein Spielerprofil und dessen Testakte öffnen, `SL-Werte ändern` und `Bogen als SL bearbeiten` verwenden. Bestandswerte nachtragen, Übernahmebeleg und historischen Saldo erfassen, separat bestätigen, XP vergeben, Rechte wählen. Als Spieler A denselben Bogen prüfen/bearbeiten beziehungsweise Entwicklung beantragen. Als Spieler B ist diese fremde Akte nicht verfügbar. Nachrichten nur öffnen und abbrechen, keine echten Empfänger verwenden.

## Grenzen

- Kein automatischer Import oder Abgleich echter Charakterbögen; fachliche Differenzen erfordern bewusste SL-Entscheidung.
- Eine historische Eröffnung wird nicht über bereits vorhandene XP-Buchungen oder einen bestätigten Erschaffungssnapshot gelegt. Für ältere bestätigte Bögen ohne Ursprungssnapshot gibt es stattdessen eine bewusste Ursprungsprüfung mit Beleg: bestehender Saldo und sämtliche Buchungen bleiben unverändert, anschließend ist eine gesonderte SL-Bestätigung notwendig. Eine zweite XP-Eröffnung entsteht dabei nicht.
- Nicht belegte Sonderpreise bleiben gesperrt. Hohe Bestandswerte können dokumentiert werden, ohne allgemeine neue Hausregeln einzuführen.
- Keine Schemaänderung oder Migration notwendig. Die Erweiterungen liegen im vorhandenen Charakter-JSON und bestehenden Audit.
- Kein Push, PR, Merge, Deployment oder produktiver Dateneingriff im Rahmen dieses Auftrags.
