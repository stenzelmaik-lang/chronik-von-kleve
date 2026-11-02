# CP2-03D – lokaler Abschluss und offene Abnahme

Stand: 02.11.2026. Zielbasis für einen späteren PR: `main` bei `4195929`.

## Abgegrenzter Stand

- CP2-03B liegt als eigener lokaler Commit `a33b86f` auf der Zielbasis. Der Vergleich `main...HEAD` enthält keine Änderung aus `568e241` an `tests/preparation-guide-browser.mjs`.
- Der CP2-03B-Dateistand ist nach dem Umsetzen auf die Zielbasis in allen 16 betroffenen Dateien inhaltlich identisch mit dem zuvor geprüften Stand. Kampagnenrolle und gespeicherte eigene Charakterwahl wurden nicht geändert.
- Vorhandene CP2-03B-Prüfungen: 6 Cache-Tests, 1.946 isolierte Integrationsprüfungen einschließlich der CP2-03B-Rollenfälle, 46 isolierte Rollenfundament-Prüfungen sowie Typprüfung, betroffenes Lint und Build erfolgreich. Für CP2-03D wurde keine Testserie erneut gestartet.

## Übernommene Browserbelege

Der unveränderte [CP2-03C-Prüfbericht](CP2-03C-PRUEFBERICHT.md) und das zugehörige Prüfskript dokumentieren **einen** isolierten Browserlauf auf Windows 11 mit Edge bei 1440 × 950. Die fünf nach Sichtprüfung übernommenen Bilder belegen nur die jeweils sichtbare Oberfläche:

- [SL im Spielerbereich](cp2-03c/1-sl-im-spielerbereich.png): persönlicher Start mit eigener aktiver Figur und Link zum Command Center.
- [SL-Spielabendplanung](cp2-03c/3-sl-verwaltung-spielabend-anlegen.png): Command Center mit geöffneter Planung und Kampagnenexport.
- [Chronik-CMS](cp2-03c/4-chronik-cms-sl-inhalte.png): SL-Oberfläche des historischen Quellenarchivs; das Bild belegt **keine** Liste der SL-Sitzungen.
- [Rückkehr zum Spielerbereich](cp2-03c/5-zurueck-im-spielerbereich.png): persönlicher Start nach dem Wechsel; kein Ersatz für den offenen Sammelpunkt 3b.
- [Spieler am Command Center](cp2-03c/7-spieler-command-center-verwehrt.png): keine SL-Inhalte sichtbar. Der Seitenaufruf antwortete laut Prüfbericht mit HTTP 200; die gesonderte API-Prüfung von `view=sl` ergab 403.

Das übernommene Prüfskript enthält die drei im Bericht erläuterten fehlerhaften Prüfannahmen und einen temporären lokalen Fixture-Pfad. Es bleibt als Herkunftsnachweis erhalten und wird nicht als grüner Test gewertet.

## Offen

- **CP2-03C, Sammelpunkt 3b:** fehlgeschlagen; welche Teilbedingung den Ausschlag gab, wurde im einmaligen Lauf nicht einzeln festgestellt. Die übrigen Einzelbelege schließen diesen Punkt nicht formal ab.
- **Geräteprüfungen:** echte Smartphone- und Tablet-Prüfungen, weitere Viewport- und Eingabegeräte sowie Linux/Chromium sind nicht durchgeführt. Der Desktop-Browserlauf ist keine Gerätefreigabe.
- Kein Push, Merge, Deployment oder Produktionsabgleich ist Bestandteil dieses Abschlusses.
