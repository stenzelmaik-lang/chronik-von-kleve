# Berechtigungs- und Medienmodell – Phase C

| Rolle / Zustand | Orte lesen | Draft schreiben | Einreichen | Prüfen / veröffentlichen | Zielgruppen |
|---|---|---|---|---|---|
| `platform_admin` | durch Plattformrolle allein kein Kampagnenzugriff | nein | nein | nein | keine; kein Admin-CMS in Phase C |
| `campaign_owner` aktiv | bestehende Kampagne | ja | ja | ja | public, group, aktiver player |
| `campaign_gm` aktiv | bestehende Kampagne inkl. SL-Projektion | ja | ja | ja | public, group, aktiver player |
| `campaign_editor` aktiv | sichere CMS-Projektion | ja | ja | nein | group; kein public oder personal release |
| `player` aktiv | veröffentlichte Player-Projektion | nein | nein | nein | eigene persönliche, Gruppen- und explizit öffentliche Inhalte |
| `pending` / `blocked` / fremde Kampagne | nein | nein | nein | nein | keine |

Die Implementierung fragt Rollen über das bestehende `server/access`-/Rollenmodell ab. Das alte GM-Flag erzeugt keine Plattformadministratorrechte. Der Player-Preview-Pfad projiziert weiterhin mit Player-Rechten, auch wenn die anfragende Person Spielleitung ist.

## Inhaltssicherheit

- Neue Bearbeitung ist auf existierende `location_nodes` und dieselbe Kampagne beschränkt. Es gibt keine API zum Erzeugen neuer Ortsidentitäten oder zum Ändern des Elternknotens.
- Payloads für Location, Area, Room und Information sind strikt typisiert und lehnen unbekannte Felder ab.
- `GM_SECRET`, `recoveryOnly` und Recovery-Datensätze werden beim Öffnen, Bearbeiten, Freigeben und Medienabruf serverseitig gesperrt.
- Player-Projektion liest nur genehmigte Revisionen mit einem gültigen Ziel-Grant; vorhandene Knoten allein bilden kein Wissen.
- Ein expliziter Block stoppt niedrigere Zielgruppen. Ein Widerruf kann nur auf eine niedrigere explizite Veröffentlichung zurückfallen; er liest keine veralteten `entities`-/`location_nodes`-Playerfelder für verwaltete Knoten.
- Verborgene Vorfahren werden nötigenfalls als neutraler Container ohne Namen projiziert. Geschwister, geheime Bereiche und GM-Konflikte werden nicht mit übertragen.

## Medien

- Uploads werden als private R2-Objekte unter zufälligem Schlüssel abgelegt; nur erlaubte Bildtypen und begrenzte Dateigröße werden akzeptiert.
- `entity_revision_media` speichert die kampagnen- und revisionsgebundene Referenz, keine öffentliche Objekt-URL.
- `/api/cms/media` prüft bei jedem Abruf entweder die autorisierte CMS-Preview-Rolle und Revision oder die aktuell ausgewählte Live-Freigabe samt konkretem Player-/Gruppenziel.
- Die generische Datei-API erzeugt für Editorial-Medien keine direkte Player-URL. Der bestehende Löschpfad verweigert das Entfernen referenzierter Dateien.
- Produktive R2-Inhalte wurden weder gelesen noch verändert.

## Testnachweise

Die lokale Test-D1/Test-R2-Regression deckt Editor, Publisher, zwei synthetische Spieler, blockierten Spieler, fremde Kampagne, Public, Gruppen-/persönliche Veröffentlichung, Revoke/Block, R2-Preview und Live-Abruf, direkte Datei-URL, Datei-Löschung und Recovery-Entity ab. Die ausführlichen Prüfergebnisse stehen in `Testbericht.md`.
