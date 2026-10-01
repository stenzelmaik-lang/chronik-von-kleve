# Profil, Login und geschlossene Pre-Alpha: Release-Verfahren

## Sicherheitskorrekturen und Prüfung

Der zunächst gestoppte Prüfpunkt ist in `closed-alpha-rollout-gate.md` archiviert.
Die freigegebene Fortsetzung behebt die MapLibre-Attributionslücke durch 6.4.1,
aktualisiert React/DOM/RSC auf 19.2.8, Next/ESLint-Konfiguration auf 16.3.6 und
Vite auf 8.0.16. Weitere gezielte Auflösungen stehen in beiden Paketmanager-
Konfigurationen. Der zuvor fehlende npm-Lockeintrag für `@noble/hashes` ist ergänzt.

MapLibre v6 benötigt einen explizit gebündelten Karten-Worker. Der vorhandene
Kartenausschnitt, die Berechtigungen und unbekannte Taberna-Koordinaten bleiben
erhalten. Drei Integrationstests prüfen die tatsächlich ausgelieferte Worker-Datei.
Bei fehlendem WebGL2 bleibt die schematische Ansicht verfügbar.

Der npm-Lockvertrag wurde mit `npm ci --dry-run` geprüft. Der tatsächlich getestete
Build verwendet die eingefrorene pnpm-Auflösung. Beide Audits enthalten keine
hohen oder kritischen Befunde; übrige Werkzeughinweise werden im Rollout-Protokoll
getrennt aufgeführt. Dies ist keine Behauptung absoluter Sicherheitsfreiheit.

## Kontrollierte Veröffentlichung

1. Aktuelle Worker-Version, D1-/R2-Bindings, deaktivierte Preview-URLs und pausierte
   automatische Builds kontrollieren. Nur den geprüften Release-Branch integrieren.
2. D1-Sicherung und Time-Travel-Bookmark privat sichern. Die vollständige SQL-Kopie
   isoliert wiederherstellen und Migration 0007 auf Daten-/FK-Erhaltung prüfen.
3. Nur die ausstehende additive Migration 0007 produktiv anwenden. Keine alten
   Migrationen wiederholen, Konten importieren oder Spielinhalte neu anlegen.
4. Eingefrorenen geprüften Worker mit `AUTH_ACCESS_ENVIRONMENT=closed-alpha-production`
   veröffentlichen; vorherige CPU-Grenze, Bindings und Preview-Schutz erhalten.
5. Aktive Version und Traffic überprüfen. Öffentliche Registrierung und manipulierte
   Identitätsheader müssen gesperrt bleiben. Konto- und Spielefunktionen live prüfen.

Rückfall: zuerst den gesicherten vorherigen Worker wieder aktivieren; additive
Tabellen und neue Kontodaten bleiben erhalten. Kein unbedachter vollständiger
Datenbankrücksprung nach echten Kontoeinrichtungen. Eine D1-Wiederherstellung benötigt
ein geprüftes Wiederherstellungsfenster und die Entscheidung der Projektleitung.
R2 bleibt derselbe private Bucket; dieser Release ersetzt keine vorhandenen Medien.
Private SQL-/Worker-Sicherungen, Credentials und Laufzeitdateien gehören nicht ins Git
oder in ein Source-Handover.

Der automatische Cloudflare-Build bleibt durch Include `*` und Exclude `*` pausiert.
Sein letzter, alter Lauf scheiterte unter pnpm 10.11.1 an der Workspace-Konfiguration.
Dieser Rollout verwendet den bereits vollständig geprüften pnpm-11-Build und ein
kontrolliertes Wrangler-Deployment. Die automatische CI ist damit ausdrücklich
nicht repariert oder erneut freigegeben; sie benötigt eine separate Prüfung vor
ihrer späteren Reaktivierung.

## Die ersten drei Mitglieder einladen

1. Projektleiter wählt die drei Personen und deren individuelle E-Mail-Adressen.
2. Als Spielleitung `Mein Profil → Spielgruppe & Einladungen` öffnen.
3. `Chronik von Kleve`, `Neues Spielmitglied`, persönliche E-Mail und Gültigkeit
   (1, 3 oder 7 Tage) wählen; persönliche Einladung erstellen.
4. Den nur einmal angezeigten Link vertraulich ausschließlich dieser Person übergeben.
   Kein automatischer E-Mail-Versand. Keine Passwörter im Chat austauschen.
5. Empfänger öffnet den Link, verwendet exakt die eingeladene E-Mail, setzt sein
   eigenes Passwort und meldet sich anschließend regulär an. Rolle ist ausschließlich
   `player` der gewählten Kampagne. Der Link ist einmalig verwendbar.

Falsch adressierte/offene Links lassen sich sperren, Kampagnenzugänge gezielt blockieren.
Eine globale Passwortwiederherstellung benötigt einen ausdrücklich eingerichteten
Plattformadministrator und unabhängige Identitätsprüfung. Spielleitung ist kein
globaler Administrator; dieser Rollout vergibt keine neue Administratorrolle.

Fehlermeldungen zunächst gesammelt an die Spielleitung: Seite, Zeitpunkt, genaue
Schritte, erwartetes/tatsächliches Ergebnis und ein Screenshot ohne Passwörter oder
Einladungslinks. Kein zusätzliches Support- oder SL-Großmodul wird eingeführt.
