# Chronik von Kleve v0.1.034 – Player Core Performance & State Hardening

## Ergebnis

Ausgangsstand: Sites-Version 36, Source-Commit `f23104384cbdc8079e13d3f1779cc0937d92c110`. Der v0.1.034-Source korrigiert den doppelten Inventar-Initialabruf, teilt die aktive Charakterauswahl zwischen Übersicht, Charakter und Inventar, hält frische Ansichten bei der Rücknavigation wiederverwendbar und schützt Zustände vor verspäteten Antworten. Dashboard und Charakterliste hydratisieren nur noch die für die jeweilige Projektion nötigen Entitäten.

## Messung Übersicht → Charakter → Inventar → Übersicht

Beide Läufe verwendeten eine isolierte lokale Wrangler-/D1-Datenbank und headless Edge unter Windows mit einem synthetischen GM-Testkonto, einem Messcharakter und 120 synthetischen, nicht-kanonischen Fremdentitäten. Viewport: 1440 × 1000. „Benutzbar“ bedeutet: die jeweilige inhaltliche Ansicht war im DOM vorhanden. API-Dauer stammt aus den Browser-Netzwerkereignissen; Werkzeuglaufzeit wurde nicht verwendet. Die Erst- und Rückmessungen sind getrennte Läufe, weshalb Millisekundenwerte schwanken können.

| Ansicht | Vorher: benutzbar | Vorher: API | Nachher: benutzbar | Nachher: API |
|---|---:|---|---:|---|
| Übersicht, Erstaufruf | 217 ms | 1 × `GET /api/dashboard` (15 ms) | 310 ms | 1 × `GET /api/dashboard` (18 ms) |
| Charakter | 67 ms | `GET /api/records` (19 ms), `GET /api/character-detail` (19 ms) | 86 ms | `GET /api/records` (14 ms), `GET /api/character-detail` (21 ms) |
| Inventar | 62 ms | 2 × `GET /api/inventory` (17 ms, 12 ms) | 65 ms | 1 × `GET /api/inventory` (22 ms) |
| Übersicht, Rücknavigation | 61 ms | 1 × `GET /api/dashboard` (18 ms) | 8 ms | 0 API-Aufrufe |

Der Inventar-Doppelabruf ist beseitigt; die zweite Navigation zur Übersicht verwendet die noch frischen Daten. Laufzeitwerte sind lokale Messwerte und keine Produktionsladezeiten.

Ein zusätzlicher lokaler Browsertest verzögerte absichtlich die Inventarantwort für Charakter A, wählte währenddessen Charakter B und ließ danach die alte Antwort eintreffen. Die Inventaransicht blieb bei B. Clientseitige Ansichten wurden außerdem bei 1440 × 1000, 820 × 1000, 390 × 844 und 360 × 844 geprüft; keine horizontale Überbreite.

## Datenfluss, Cache und Sicherheit

- Der Browsercache ist nur im Speicher des jeweiligen Tabs und nach Kampagne, Nutzer, Rolle sowie Endpunkt/Charakter/Filter abgegrenzt. Es gibt keinen geteilten Servercache.
- Frische Daten gelten 30 Sekunden. Änderungen im aktuellen Client invalidieren die betroffenen Ansichten sofort; Änderungen der Spielleitung von einem anderen Gerät werden spätestens nach Ablauf dieser Frist beim erneuten Öffnen abgerufen.
- Identitäts-/Kampagnenwechsel, Abmeldung/Seitenwechsel und HTTP 401/403/404 verwerfen geschützte Cacheinhalte. Fehler erscheinen mit verständlicher Meldung und „Erneut versuchen“; ein Abruffehler wird nicht als leeres Inventar angezeigt.
- Übersicht und Charakterliste laden passende Entity-IDs gebündelt statt den gesamten Entity- und Legacy-Record-Bestand. Character-Session-Projektion lädt nur die begrenzten jüngsten Sitzungs-IDs. Die anschließende serverseitige Berechtigungs-, Knowledge- und Player-Projektion bleibt erhalten.
- Die serverseitige Charakterauswahl enthält für Spieler nur eigene lesbare Charaktere. Fremde private Charakter-IDs werden vom Dashboard abgewiesen.
- Inventarbesitz-Beziehungen `character.owns` und Ziele vom Typ `ITEM` erscheinen nicht mehr unter „Beziehungen & Kontakte“.
- Beschriftungen nennen Finanzdaten bei fehlendem Eintrag korrekt. Die Übersicht verspricht keine laufende Sitzung; die Schaltfläche heißt neutral „Sitzungen öffnen“.

## Prüfungen

- Build: bestanden.
- Typecheck: bestanden.
- Lint: bestanden.
- Fachtests: 17 bestanden, inklusive fünf gezielter Cachetests.
- Isolierte Integration: 293 Prüfungen bestanden, einschließlich Rollen, privater Charaktere und Notizen, Inventarbesitz, Recovery-Regression und Character-Projection.
- Diese Tests liefen ausschließlich mit lokalen temporären Datenbanken und synthetischen Identitäten. Es wurden keine produktiven Testdaten angelegt.
- Desktop-, Tablet- und Mobil-Viewport-Prüfung: bestanden, keine horizontale Überbreite.
- Echter Spieleraccount: nicht verfügbar. Produktionsbrowser und lokale Messung liefen mit einer GM-Identität; das ist kein echter Spielerlogin und ersetzt diesen nicht. Die Integration prüft Spieler A/B mit isolierten Testidentitäten.

## Grenzen und unveränderte Bereiche

- Produktionsmigration: keine.
- Produktiver Recovery-Import oder Recovery-Datenänderung: keiner.
- Neue Lore oder produktive Mockup-/Testdaten: keine.
- Authentifizierung wurde nicht verändert oder umgangen.
- Bekannter Cloudflare-Loginfehler: bleibt ein separater, nicht reproduzierter offener Punkt. Der im Prüfzeitpunkt bereits angemeldete Browser zeigt eine GM-Sitzung; der Anmeldeablauf selbst wurde nicht abgemeldet oder erneut durchlaufen. Ursache und Behebung liegen außerhalb von v0.1.034.
