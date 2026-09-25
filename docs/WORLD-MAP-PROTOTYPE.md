# Chronikkarte: MapLibre-Prototyp

Die Spielwelt-Karte lädt MapLibre GL JS nur beim Öffnen der Weltübersicht. Sie verwendet den dunklen OpenFreeMap-Stil auf OpenStreetMap-Grundlage. MapLibre und die Basemap werden nur für diese Ansicht geladen; bei fehlendem Netzwerk oder einem nicht ladenden Stil bleibt die schematische Chronikkarte sichtbar.

Chronikmarker werden ausschließlich aus einer spielerseitigen Ortsprojektion erzeugt. Die API liefert eine Testposition nur für die bereits bekannte Electric Taberna und nur bei Discovery `known`, `visited` oder `investigated`. GM-Projektionen, verborgene/gerüchtete Orte und unbekannte Orts-IDs erhalten keine Koordinaten. Diese Position wird nicht in D1, Ortsdaten oder Lore gespeichert. Sie ist ein UI-Prototypwert und muss beim späteren Geo-Domain-Schritt durch geprüfte, provenance-belegte Geo-Daten ersetzt werden.

Der Startausschnitt wird über regionale Bounds für Kleve, Elten/Rhein, Goch/A57 und Kalkar angepasst. Er begrenzt die Karte nicht; Nutzer können weltweit navigieren. MapLibre zeigt die Stil-Attribution aus dem OpenFreeMap-Stil sichtbar an. Die Anwendung lädt oder veröffentlicht keine eigenen Tile-Kopien.

Der öffentliche OpenFreeMap-Dienst wird ohne API-Schlüssel verwendet. Die Kartenansicht benötigt daher keinen Google-Dienst, API-Schlüssel, Karten-ID oder nutzungsabhängige Google-Abrechnung. Der Kartenabruf bleibt von Netzwerk und Verfügbarkeit des öffentlichen OpenFreeMap-Dienstes abhängig.
