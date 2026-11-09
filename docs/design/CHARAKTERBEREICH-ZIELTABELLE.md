# Charakterbereich · Zieltabelle zur Neuordnung

Stand 09.11.2026 · **Vorschlag zur Abnahme.** Grundlage sind der Code und die Live-Begehung mit dem Besitzer am 09.11. Gebaut wird erst nach Freigabe.

**Grundregel (Besitzer):** Jede Sache hat genau einen Ort. Wer etwas ändert, weiß, wo es sich auswirkt. Keine doppelten Wege und keine Untermenüs, die fast dasselbe tun.

## Heute (nach den Nachbesserungen vom 09.11.)

| Bestandteil | Inhalt | Bearbeitet in | Taucht auch auf in | Vorschlag |
|---|---|---|---|---|
| Menüleiste oben | Aktive/Archiviert, Charakter archivieren, Weitere Aktionen (Neuer Charakter, Porträt ändern …), Charakterwahl | – | – | **bleibt** (vom Besitzer bestätigt) |
| Charakterkopf | Porträt, Name, Clan, Konzept, Spieler, Chronik, Generation, Wesen, Verhalten, Erzeuger, Clan-Banner | Bogen bearbeiten | Spielerzentrale (Karte), Bogen am Tisch (Reiter Identität) | **bleibt** (bestätigt) |
| Reiter **V20-Bogen** | Seite 1 des Papierbogens | Bogen bearbeiten / Entwicklung | Ingame-Menü (Reiter) | **bleibt** (bestätigt) |
| Reiter **Geschichte & Bilder** → „Vergangenheit & Antrieb“ | Hintergrundgeschichte (`text`) | hier | Ingame „Geschichte“ | → **Charakterprofil** |
| … → „Stimme, Haltung, Reflexe“ | Spielhilfe (`playGuide`) | hier | Ingame „Spielweise & Ziele“ | → **Charakterprofil** |
| … → „Privat und geteilt“ | Figurnotizen (Persönliches Dokument) | hier | **Notizbuch** (dieselben Seiten) | **entfernen**. Die Seiten sind im Notizbuch, wo der Spieler sie schreibt und liest. Hier höchstens ein Verweis „Im Notizbuch öffnen“ |
| … → „Portrait & Referenzen“ | Porträt und Bilder der Figur | hier, zusätzlich „Porträt ändern“ in Weitere Aktionen | Kopf, Charakterprofil-Galerie | → **Charakterprofil** („Bilder“). Doppelter Weg „Porträt ändern“ entfällt |
| … → „Bekannte Verbindungen“ | Beziehungen zu Persönlichkeiten (lesend) | SL im NSC-Bereich | Persönlichkeiten | → **Persönliches Archiv** (Reiter „Verbindungen“) *oder* Persönlichkeiten, Filter „meine Verbindungen“. **Entscheidung des Besitzers** |
| … → „Kontext für die nächste Nacht“ | Zusammenfassung des letzten Spielabends | SL | **Spielerzentrale** („Letzter Spielabend“), Rückblick | **entfernen** (doppelt). Steht in der Spielerzentrale |
| Reiter **Charakterprofil** | Kurzzeile, Vorstellung, Galerie, „veröffentlicht“ | hier | Spielerleiste am Tisch („Profil“) | **ausbauen** zum Ort für Seite 2, siehe unten |
| Reiter **Entwicklung** | Erfahrung, Steigerungen, Anträge | hier | – | **bleibt** |
| Ausrüstung & Inventar | Inventar der Figur | Bereich Inventar | Spielerleiste am Tisch | **bleibt** als Verweis bei den Reitern (bestätigt) |
| Individuelle Angaben (`individualInfo`) | Freitext der SL | Charakterverwaltung | Bogen (unten) | → **Charakterprofil**, Block „Weitere Angaben“ |
| „Aktive / Archivierte Charaktere“ | – | – | – | erledigt: Umschalter in der Menüleiste |

## Ziel: Charakterprofil als Seite 2 des Bogens

Ein Reiter, in dem der Spieler seinen Charakter vorstellt. Er ist gegliedert wie Seite 2 des Papierbogens, im selben Bogenstil wie Seite 1. Am Tisch öffnen andere Spieler über die Spielerleiste („Profil“) die freigegebenen Teile. Das ist der „runde Charakterbogen“, mit dem sich jeder am Tisch vorstellt.

| Block | Felder | Heute vorhanden? | Sichtbar für andere |
|---|---|---|---|
| Auftritt | Kurzzeile, Vorstellung, Galerie | ja (`presentation`) | wenn „veröffentlicht“ |
| Beschreibung | Alter, scheinbares Alter, Todestag, Geschlecht, Herkunft, Nationalität, Haarfarbe, Augenfarbe, Größe, Gewicht, Aussehen (frei) | **nein**, neu | je Block wählbar |
| Geschichte | Hintergrundgeschichte | ja (`text`), heute in „Geschichte & Bilder“ | je Block wählbar |
| Antrieb und Auftreten | Vergangenheit & Antrieb, Stimme/Haltung/Reflexe, Ziele | teilweise (`playGuide`, `goals`) | je Block wählbar |
| Verbündete & Kontakte | Freitext des Spielers | **nein**, neu (unabhängig von den SL-Beziehungen) | je Block wählbar |
| Bilder | Porträt, Referenzen | ja (Medien) | wie heute |
| Weitere Angaben | `individualInfo` | ja | nur Spieler und SL |

**Neu und deshalb freizugeben:** die Felder für Beschreibung und Verbündete & Kontakte und eine Sichtbarkeit je Block. Technisch wäre das eine Erweiterung des Charakter-Bodys und der Charakterprojektion, keine neue Tabelle und keine Migration. Es ist aber eine Änderung am Datenmodell und an der Sichtbarkeit für andere Spieler. Dafür braucht es Rechtetests (Spieler, anderer Spieler, SL, nicht angemeldet).

## Ziel-Reiter

**V20-Bogen · Charakterprofil · Entwicklung** sowie **Ausrüstung & Inventar** als Verweis. Der Reiter „Geschichte & Bilder“ entfällt, sein Inhalt verteilt sich wie oben.

## Zur Entscheidung

1. Charakterprofil ausbauen wie oben (neue Felder und Sichtbarkeit je Block)?
2. Bekannte Verbindungen: ins Persönliche Archiv oder zu den Persönlichkeiten?
3. „Privat und geteilt“ und „Kontext für die nächste Nacht“ aus dem Charakterbereich entfernen (bleiben im Notizbuch bzw. in der Spielerzentrale)?
