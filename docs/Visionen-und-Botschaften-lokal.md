# Visionen und persönliche Botschaften – lokale Umsetzung

Stand: 31.10.2026. Technisch geprüft und zum GitHub-Push freigegeben; kein Merge nach `main` oder Live-Deployment ausgeführt.

**Grafische Weiterentwicklung v2:** Echte Brief-/Nebelassets, Vision oben links, Brief rechts und nichtmodale Leseflächen sind im [Asset- und Prüfbericht](assets/Personal-delivery-v2.md) dokumentiert. Aktueller Standardtest: **230/230 grün**. Die nachstehenden Angaben beschreiben die ursprüngliche Funktionsgrundlage mit ihrem damaligen Teststand.

## Abschlussprüfung für den GitHub-Stand

- Titel und Text sind innerhalb des Nebelassets zentriert, mit und ohne Bild. Bilder erscheinen darunter; lange Visionen bleiben scrollbar.
- CMS für Schritt 6 geprüft: mehrere unabhängige Visionen und Briefe, unterschiedliche Empfänger, Sortieren, bestätigtes Löschen, Speichern, erneutes Öffnen und gezieltes Ausspielen.
- Aktuelles `main` aus PR #51 (`4f3964ffdee057ce75617990adc4f862c45ade45`) integriert, einschließlich der vorhandenen Dokument- und Pager-Korrekturen.
- Erneut bestanden: **230/230 Standardtests**, Typecheck, gezielter ESLint, Produktionsbuild, HTTP-Rollenintegration und vollständiger Browserlauf auf Desktop und Mobilgeräten.
- Automatische Browserprüfungen sichern zusätzlich die tatsächliche Zentrierung, Bildwechsel, Tastaturbedienung, Reconnect, reduzierte Bewegung und den langen CMS-Text ab.
- Prüfungen liefen auf Port 8891 mit getrenntem synthetischem Speicher. Der bestehende lokale Teststand für Port 8890 bleibt erhalten. Keine Produktionsdaten oder echten Spielerkonten verwendet.

## Lokaler Einstieg

- Arbeitszweig: `codex/visionen-botschaften`.
- Worktree: `C:/Users/Stenz/Documents/Codex/2026-10-03/02-entwicklung-code-du-bist-der/work/visionen-botschaften`.
- Basis: `02af1450130a9e332343632d2cd9cd26d570af2c`, aktuelles `main` mit PR #50 beim Start.
- Anmeldung: http://127.0.0.1:8890/anmelden
- Vorbereitung: http://127.0.0.1:8890/sl/command-center?bereich=sitzung
- Spieltisch: http://127.0.0.1:8890/spielbereich?bereich=sitzung
- Regie im eigenen Fenster: http://127.0.0.1:8890/sl/regie

Es laufen ausschließlich synthetische Konten und Daten im worktree-eigenen `.local-test/regie`.

| Testrolle | Konto |
| --- | --- |
| SL | `command-gm@example.invalid` |
| Spieler A | `command-a@example.invalid` |
| Spieler B | `command-b@example.invalid` |

Das ausschließlich lokale Testpasswort lautet für diese synthetischen Konten `ChroniPlay-Demo-2036!`. Es ist kein echtes Kontopasswort. Für getrennte Rollen getrennte Browserprofile verwenden oder abmelden und neu anmelden.

Neustart im oben genannten Worktree, bei vorhandenen Projektabhängigkeiten:

```powershell
$env:CVK_TEST_PORT='8890'
node --experimental-strip-types scripts/test-local.mjs --regie
```

Der Testabend startet automatisch. Vorhandene lokale Testdaten werden wiederverwendet. Ein neuer Build ist nur bei gestopptem Testserver nötig: `node scripts/run-framework.mjs build`.

## Bedienung

1. Szene öffnen, Schritt 6 **Visionen & persönliche Botschaften** wählen.
2. **Vision vorbereiten** oder **Botschaft vorbereiten** erstellt einen eigenen Eintrag mit stabiler ID.
3. Titel, Empfänger und Rich Text unabhängig pro Eintrag bearbeiten; vorhandene Bilder über die Galerie oder im Text hinzufügen. Mehrere Einträge dürfen dieselbe Person oder unterschiedliche Teilgruppen adressieren.
4. Alle Einträge bleiben auswählbar; Reihenfolge lässt sich mit den Pfeilen ändern. Löschen erfordert eine Bestätigung innerhalb des Editors. Nicht verfügbare Empfänger können entfernt werden.
5. **Jetzt speichern** bzw. **Speichern & weiter** speichern nur die Vorbereitung. Es gibt keinen Versand als Nebenwirkung.
6. Im aktiven Spielabend in der Regie **Visionen & Briefe** öffnen. Dort wird jeder Inhalt mit seiner vorbereiteten Zielgruppe einzeln ausgespielt.
7. **Vision ausspielen** öffnet beim adressierten Spieler eine persönliche Nebelansicht mit Text und gegebenenfalls blätterbaren Bildern. Die SL kann dieselbe Ansicht bei Bedarf selbst öffnen; sie wird bei der SL nicht automatisch eingeblendet.
8. **Brief zustellen** lässt einen geschlossenen Brief auf dem adressierten Tisch erscheinen. Klick oder Enter öffnet die Lesefassung. Die kurze Ankunftsbewegung entfällt bei reduzierter Bewegung.
9. Beide Darstellungen bleiben als Bühnenobjekt erneut erreichbar. Escape oder Schließen betrifft nur die eigene Ansicht. Bereits angesehene Visionen öffnen sich im selben Browser-Tab nach einem Reload nicht ungefragt erneut.
10. Die SL kann **Zurückziehen** wählen. Der Inhalt verschwindet bei allen Empfängern; das Original in der Vorbereitung bleibt erhalten. Danach ist erneutes Ausspielen möglich.

## Weiterverwendete Architektur

- Ein bestehendes Szenendokument in der bestehenden `SCENE`-Entity: neues optionales `whispers`-Array. Keine zusätzliche Tabelle oder parallele Nachrichtenhaltung.
- Bestehende Bühnenobjekte: persönliche Inhalte sind Dokumentobjekte mit optionalem `presentation: vision | letter`.
- Bestehende Stage-API, Versionsprüfung, Polling und Rechteprojektion. Es gibt keinen weiteren Eventbus oder Synchronisationsdienst.
- Bestehender Rich-Text-Editor und sichere Darstellung. Der zusätzliche optionale Bild-URL-Resolver gilt nur für diese autorisierte Bühnenlesefassung; alle bisherigen Aufrufer behalten den bisherigen Dateipfad.
- Bestehender geschützter Stage-Asset-Endpunkt für angehängte und eingebettete Bilder. Keine öffentliche Dateifreigabe.
- Bereits gespeicherte gemeinsame Visionstexte, Empfänger und Anhänge bleiben unverändert. Sie sind bei vorhandenen Inhalten unter **Bisherige gemeinsame Vorbereitung** erreichbar; ihr bisheriger Postfachversand bleibt erhalten. Keine automatische Umwandlung oder doppelte Zustellung.

Kompatibilitätsgrenze für eine spätere Veröffentlichung: Der neue Code liest alte Szenen und Bühnen. Ältere Anwendungsversionen mit strikten Schemas kennen `whispers` bzw. `presentation` dagegen nicht. Nach Speicherung solcher Daten wäre ein blindes Zurückschalten auf alten Code ungeeignet; diese Grenze muss bei einer späteren Releasefreigabe berücksichtigt werden.

Grenzen des neuen Vertrags: höchstens 100 Einträge je Szene, jeweils 20 Empfänger, 10.000 sichtbare Textzeichen und maximal 20 Bilder insgesamt beim Ausspielen. Die neuen Einträge unterstützen Text und Bilder; andere Materialtypen bleiben in ihren vorhandenen Funktionen.

## Schutz und Konsistenz

- Speichern: Empfänger müssen aktive Spieler derselben Kampagne sein; Medien werden auf Zugriff und passenden Typ geprüft.
- Ausspielen: nur SL; die tatsächlichen Empfänger kommen aus dem gespeicherten Eintrag. Eine abweichende Empfängerliste aus dem Browser überschreibt sie nicht.
- Alle vorbereiteten Empfänger müssen am laufenden Abend teilnehmen. Fehlende Personen werden benannt; es erfolgt keine stillschweigende Zustellung an eine andere Gruppe.
- Die Regie sendet die geladene Szenenversion. Veraltete Vorbereitung wird mit Konflikt abgelehnt; beim Commit wird die Quellversion zusätzlich atomar geprüft.
- Nicht adressierte Spieler bekommen weder das Objekt noch seinen Text und können seine Bild-URLs nicht öffnen. Ein nicht angemeldeter Aufruf wird abgewiesen.
- Die SL sieht die ausgespielten persönlichen Inhalte. Spieler dürfen fremde Vorbereitungen weder ausspielen, bearbeiten noch zurückziehen.
- Allgemeine Freigabe-/Bearbeitungsaktionen für diese besonderen Dokumentobjekte werden abgelehnt: Empfänger und Inhalt werden in der Szenenvorbereitung festgelegt und bewusst erneut ausgespielt.
- Szenenwechsel räumt die zur Szene gehörenden Visionen und Briefe ab. Bestehende Notizzettel und persönliche Arbeitsunterlagen behalten ihr bisheriges Verhalten.
- Persönliches Schließen ist reine Darstellungspräferenz im `sessionStorage`; keine Freigabe oder globale Löschung. Autorisierung erfolgt weiterhin auf dem Server.

## Geprüft

| Prüfung | Ergebnis |
| --- | --- |
| Vollständiger Standard-Testlauf | **228/228 bestanden** |
| Gezielter Lauf für neue Inhalte, Szenen und bestehende Regie | **23/23 bestanden** |
| Typecheck und ESLint aller geänderten TypeScript-/Testdateien | bestanden |
| Lokaler Produktionsbuild | bestanden; bestehender Hinweis auf große Client-Chunks |
| Neue HTTP-Integration mit drei getrennten synthetischen Konten | bestanden |
| Bestehende Regie-/Pager-/Musik-/Effekt-/NPC-Integration | vollständig bestanden |
| Browser: Vorbereitung mehrerer Einträge, HTML-Text, Empfängerwahl, Speichern, Neuladen | bestanden |
| Browser: neue Einträge aus der Regie an A bzw. B zustellen | bestanden |
| Browser: automatische Vision, Brief per Klick/Enter, persönliches Schließen, Reconnect | bestanden |
| Browser: 1440×900, 375×812, Editor 390×844, reduzierte Bewegung, Bildwechsel | bestanden |

Browser und HTTP verwenden echte Anwendungspfade mit synthetischen Rollen in getrennten Sitzungen. Das ist keine Live- oder Echtspielerabnahme. Die stetig synchronisierende Bühne wird über sichtbare Inhalte statt über dauerhaftes Network-Idle als bereit erkannt.

Reproduzierbare Prüfungen nach Start der lokalen Instanz:

```sh
node --experimental-strip-types --test tests/scene-whispers.test.mjs
node --experimental-strip-types tests/scene-whispers-integration.mjs
node tests/scene-whispers-browser.mjs
```

Für den Browserlauf muss `CVK_PLAYWRIGHT_MODULE` auf eine vorhandene Playwright-Installation zeigen. Es wurde keine neue Anwendungsabhängigkeit hinzugefügt. Lokale Logs, Screenshots und die synthetischen Fixture-IDs liegen unter `.local-work/whispers/`, außerhalb der Versionierung.

## Abnahme und Veröffentlichungsgrenze

Die technische lokale Prüfung einschließlich der gewünschten Textzentrierung ist abgeschlossen. Der Projektinhaber hat die Grafik positiv bewertet und den GitHub-Push nach Abschluss von Textkorrektur und CMS-Prüfung freigegeben. Es wurde keine Produktionsmigration erstellt, kein Live-System verändert und kein echter Spieler-, Charakter- oder Kampagnenbestand übernommen. Der Branch wird zur überprüfbaren Integration bereitgestellt; eine Live-Veröffentlichung ist ein eigener Schritt.
