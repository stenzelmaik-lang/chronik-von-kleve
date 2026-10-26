# Live-Ansicht: gezielte Bedienkorrektur

Basis aa21c680, Branch codex/m1-kernmodell. Nur lokal; kein Commit, Push, Deployment, Relay, Import oder Produktionsschreibvorgang.

## Festgestellte Ursachen und Korrekturen

- Whiteboard war vor der eigentlichen Regie montiert und wählte eine eigene Sitzung. Es folgt jetzt der gemeinsamen Sitzungsauswahl unterhalb der Regie. Spieler erhalten die sichtbare Sitzung des aktiven Szenenlaufs, sofern verfügbar; Initiative und Protokoll folgen derselben Sitzung.
- Geschlossener oder nicht verfügbarer Raum zeigte keine erkennbare Boardfläche. Jetzt gibt es eine klar gekennzeichnete, inaktive Whiteboard-Fläche mit Erklärung. Keine gespeicherten Zeichnungen werden dabei offengelegt. Gemeinsame Sitzungsfreigabe bleibt erforderlich; eine Szenenfreigabe ersetzt sie nicht.
- Direkter Sprung zum Whiteboard, eindeutige Öffnen-/Beitreten-Aktionen. Fehlender Relay ist ein Hinweis und kein Whiteboard-Fehler. Produktionssperre der Bildschirmfreigabe bleibt unverändert.
- Zusätzliche SL-Regiewerkzeuge und gespeicherter Expertenarbeitsplatz zunächst geschlossen. Im Szenenfokus nur eine Szenenfläche; bei Expertenspeicherung ohne Szenenpanel rein visuelle Ersatzfläche, ohne die gespeicherte Anordnung zu überschreiben.
- Spieler sehen keine zweite Legacy-Szenenbühne neben freigegebenen modernen Szenen. Legacy-Bühne bleibt für Sitzungen ohne moderne Szene erhalten.
- SL-Regienotizen sind als SL-INTERN abgegrenzt; vorbereiteter SL-Stand und Gruppenblick ausdrücklich unterscheidbar. Leere Szenenbausteine entfallen. Ein bereits aktiver/pausierter Gruppenlauf kann über die einfache Live-Aktion nicht versehentlich nochmals gestartet werden; bestehende Lauf-/Freigabe-APIs unverändert.
- Unübertragene Whiteboard-Eingaben werden beim SL-Sitzungswechsel und beim Wechsel zum Gruppenblick abgefragt; Abbrechen erhält den Entwurf. Browsernavigation erhält den BeforeUnload-Schutz. Kein automatisches Speichern/Veröffentlichen.

## Nachweise

217 Unit-/Regressionstests, Typprüfung, gezieltes ESLint und Build bestanden. 1304 isolierte Integrationprüfungen sowie 46 Rollenfundament-Prüfungen bestanden. Keine Schema- oder API-Änderung.

Browser ausschließlich mit synthetischen Testkonten: SL öffnet Raum, tritt bei und teilt Text; Sitzungswechsel mit Entwurf öffnet Bestätigung, Abbrechen erhält Sitzung und Text. Finaler Szenenstand zeigt getrennte Regienotizen und deaktivierten erneuten Gruppenstart. Getrennter Spieler-B-Login sieht dieselbe aktive Sitzung und das Whiteboard, aber keine SL-Regienotizen, persönliche A-Szene oder SL-Öffnen/Leeren-Aktionen. Spieler kann selbst beitreten und Text teilen. Mobil 390px ohne horizontalen Überlauf (Client/Scrollbreite 375px). Desktopansicht und Whiteboard-Sprungziel geprüft. Gruppenblick-Entwurfsschutz zusätzlich als Quellregression geprüft; kein echter Produktions-Spielerlogin.

Grenzen: kein Relay/Capture-Test, kein vollständiger Accessibility-/Performance-Audit. Tastaturfähige native Schalter und vorhandene Drawer weiterverwendet. Vor einer Veröffentlichung ist dieser Stand gesondert freizugeben.

## Veröffentlichungsfreigabe

Die Projektleitung hat anschließend „Git und live Pushen“ freigegeben. Veröffentlichung ausschließlich der elf Korrekturdateien auf codex/m1-kernmodell; kein neuer Funktionsbereich, keine Migration, kein Import und kein Relay. Frisches B0 mit Originalschema, FTS-Wiederherstellung und Time-Travel-Bookmark bleibt privat unter `.local-work/live-view-release-20261012`. Produktionsbindings, Zugriffsschutz und abgeschaltete Preview-URLs erhalten; Nachprüfung von aktivem Commit und persistenten Datentabellen. Tatsächliche Deploymentkennung und Ergebnis werden nach Ausführung privat protokolliert, nicht vorweggenommen. Kein blindes Datenbank-Restore oder Worker-Rollback.
