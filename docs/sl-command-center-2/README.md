# SL Command Center 2.0 – erster funktionaler Stand

Stand: 02.10.2026. Grundlage: veröffentlichter Commit `053d85c3bae69237594330f80c86fa10cf304811`. Das Konzept wird hier als benutzbarer erster Ausschnitt umgesetzt; der gesamte Masterauftrag ist damit noch nicht vollständig umgesetzt.

## Tatsächlich benutzbar

- Private SL-Regie unter `/spielbereich?bereich=sitzung`; Spieler behalten ihren bisherigen Sitzungstisch.
- Vorbereiten, Spielabend und Nachbereiten mit je eigener gespeicherter Anordnung; Werkzeuge öffnen, schließen, umordnen, vergrößern, anheften und per Maus oder Tastatur in der Größe verändern.
- Zweites Regiefenster mit eigener Anordnung. Auswahl wird zwischen Fenstern synchronisiert; angeheftete Akten bleiben fest. Offene Eingaben werden vor Kontextwechsel oder Schließen geschützt.
- Privates Storybuch mit sechs formatierten Abschnitten, Verweisen auf bestehende Akten, vorbereiteten Möglichkeiten, automatischer Speicherung und wiederherstellbarem Verlauf.
- Vorhandene Charakterprüfung, XP-Vergabe, Anträge, persönliche SL-Notizen und Briefversand werden wiederverwendet. Bestätigte Charakterwerte bleiben unter der zentralen Character Engine geschützt.
- Vorhandene Ortsakte öffnen und ausdrücklich als aktiven Schauplatz setzen. Die Ortsredaktion bleibt im bestehenden SL-CMS.
- Tatsächlich eingetretene Sitzungsmomente separat von vorbereiteten Möglichkeiten festhalten. Kein automatischer Kanonstatus und keine automatische Erledigung eines Plots.
- Vorhandene Handout-Freigaben mit ausdrücklicher Zielgruppe und Bestätigung; persönliche Briefe mit Empfänger- und Inhaltsprüfung. Öffnen ist kein Versand.
- Gruppenblick verwendet die serverseitige Spielerprojektion; persönliche Freigaben sind dort bewusst nicht enthalten.

## Daten und Sicherheit

Keine neue Datenbank und keine neue Migration. Anordnungen verwenden `settings` mit Kampagne, Benutzer, Arbeitsmodus und Fensterrolle im Schlüssel. Dort liegen ausschließlich Werkzeugdaten und Identitätsreferenzen, keine Texte oder Tokens.

Plotdossiers sind bestehende `entities` vom Typ `CHRONICLE`, `GM_SECRET`, Sichtbarkeit `sl`, ohne Legacy-Verknüpfung. Historie liegt in `world_events`. Sitzungsmomente sind bestehende private `NOTE`-Entities. Orte, Charaktere, Nachrichten und Freigaben behalten ihre vorhandenen Speicher- und Berechtigungswege.

Die neuen APIs `/api/command-center/workspace`, `/story` und `/moments` verlangen serverseitig eine aktive Kampagnen-SL oder Eigentümerrolle. Plattformadministration allein reicht nicht. Fremde Kampagnen, gesperrte und ausstehende Mitglieder sowie private Charaktere anderer Personen bleiben ausgeschlossen. GM_SECRET und Recovery werden nicht durch normale Wissenserteilung veröffentlicht.

Speicherungen verwenden erwartete Versionen. Story-Mutation und Verlaufseintrag erfolgen atomar im D1-Batch. Zwei parallele Änderungen derselben Version ergeben genau einen Erfolg und einen HTTP-409-Konflikt. Wiederholte Erstellung und Momentaufnahme mit derselben Anfrage-ID erzeugen keine Duplikate. Ein Konflikt erhält den lokalen Text; Wiederholung erfolgt erst nach sichtbarem Vergleich.

Browserfenster tauschen ausschließlich validierte Fokus-IDs und Aktualisierungssignale aus. Texte, Passwörter und Sitzungen werden nicht über BroadcastChannel oder Browser-Speicher verteilt. Private API-Antworten sind `no-store`. Bei verlorener Berechtigung wird die private Regie geschlossen.

## Lokal selbst ausprobieren

Im Projekt `Start-Command-Center.ps1` starten. Es nutzt die vorhandene Node-Laufzeit, prüft Port 8798 und baut ausschließlich lokal. Die Testumgebung verwendet eigene lokale D1/R2-Daten; keine Remote-Bindings.

Adresse: `http://127.0.0.1:8798/anmelden`. Synthetische SL: `command-gm@example.invalid`; synthetische Spieler: `command-a@example.invalid` und `command-b@example.invalid`. Nur für diese isolierte Demo gilt das öffentlich dokumentierte Passwort `ChroniPlay-Demo-2036!`; es ist kein produktives Zugangsmittel. Die Anmeldung nutzt den normalen Anwendungspfad. Für getrennte Sitzungen können SL auf `127.0.0.1`, Spieler A auf `localhost` und Spieler B in einem zweiten Browser testen.

## Bewusst noch offen

Kein universeller Audio-/Video-/Visionsversand, keine neue Rätsel-Engine, kein vollständiger NSC-/Fraktionseditor und kein umfassender Storygraph. NSC und andere Akten werden derzeit gelesen und verknüpft. Die bestehenden Rich-Text-Möglichkeiten werden wiederverwendet; ein vollständiger neuer Medieneditor ist nicht enthalten. Synchronisierung gilt für Browserfenster derselben Anmeldung und Herkunft; sie ersetzt keinen geräteübergreifenden Echtzeitdienst. Private Plotdossiers haben in diesem Ausschnitt keine Löschfunktion. Suche und Listen sind begrenzt (500 Referenzen, 200 Plots, 150 Momente, 30 Verlaufsversionen), damit der erste Stand kontrollierbar bleibt.

Produktion und synthetische Demo sind getrennt. Der tatsächliche Release-Commit, Deployment und Live-Nachweise stehen im datierten Abschlussbericht.
