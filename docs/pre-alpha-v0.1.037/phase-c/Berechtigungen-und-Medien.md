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

Für `campaign_editor` ist die Draftliste serverseitig auf `audience_scope='group'` und `audience_key='@group'` beschränkt. Die Einschränkung geschieht in der D1-Abfrage, bevor persönliche oder Public-Revisionsdaten geladen und zurückgegeben werden. Die konkreten Scope-/Key-Werte werden außerdem beim Speichern, Einreichen und Öffnen der Player-Vorschau geprüft; erratene persönliche und Public-Revisions-IDs ergeben eine opake `404`-Antwort.

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
- `/api/cms/media` prüft bei der CMS-Preview aktive Editor-/Publisher-Rolle, Kampagne, Ortsobjekt, konkrete Revisions-ID, erlaubten Scope-Key, Revisionsstatus sowie den passenden Medienanhang mit identischem Ziel. Bei Player-Liveabruf wird nur die Bild-URL aus der aktuellen sicheren Player-Projektion akzeptiert.
- Die generische Datei-API erzeugt für Editorial-Medien keine direkte Player-URL. Der bestehende Löschpfad verweigert das Entfernen referenzierter Dateien.
- Produktive R2-Inhalte wurden weder gelesen noch verändert.

Ein `block` oder `revoke` wirkt auf Player-Livebilder genauso wie auf den Inhalt: die entzogene Freigabe ist über den Livepfad nicht mehr erreichbar, und ein Fallback folgt ausschließlich einer noch gültigen niedrigeren Veröffentlichung. Eine aktive CMS-Rolle kann weiterhin die konkret zu ihrem erlaubten Gruppenentwurf gehörende Editor-Vorschau abrufen; sie erhält dadurch keinen Player-Livezugriff.

## Public-Lesergrenze

`public` ist derzeit ein explizites Freigabeziel im CMS, aber keine anonyme Webseite. `/api/locations` verlangt weiterhin einen authentifizierten aktiven Kampagnen-Actor. Der Integrationstest veröffentlicht synthetische Public-Testinhalte und bestätigt anschließend `401` beim anonymen Reader-Aufruf. Ein anonymer Visitor-Reader ist **NICHT IMPLEMENTIERT**.

## Testnachweise

Die lokale Test-D1/Test-R2-Regression deckt Editor-Draftlisten mit persönlichen/Public-Gegenproben, erratene Revisions- und Medien-IDs, fremde Kampagne, exakte Gruppen-Bildvorschau, blockierten Spieler, Public-/Gruppen-/persönliche Veröffentlichung, anonymen Public-Reader, Revoke/Block, R2-Liveabruf, direkte Datei-URL, Datei-Löschung und Recovery-Entity ab. Die ausführlichen Prüfergebnisse stehen in `Testbericht.md`.
