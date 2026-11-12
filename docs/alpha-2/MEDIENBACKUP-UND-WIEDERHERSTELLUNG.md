# ChroniPlay – Medienbackup und Wiederherstellung

## Was gesichert wird

Der produktive Worker liest hochgeladene Medien aus dem privaten R2-Bucket `chronik-von-kleve-r2` über die Bindung `BUCKET`. Sicherungen müssen den ganzen Bucket erfassen. Dazu gehören registrierte Uploads, abgeleitete Vorschaubilder, Codex-Originale und -Seiten sowie Objekte ohne direkten Datenbankverweis.

D1 speichert Dateischlüssel, Besitzer, Sichtbarkeit und Zuordnungen. Die Tabelle `files` registriert Uploads. Charaktere, NSC, Szenen, Orte, Inventar, Briefe und Spieltisch verweisen auf Datei-IDs. Codex-Seitenschlüssel ergeben sich aus Quellhash und Seitennummer. Materialisierte Quellen des Recovery-Archivs verwenden `recovery_sources.r2_key`. Die Kampagnenexport-Funktion sichert Metadaten. Die Mediendateien brauchen eine eigene Sicherung.

Dateien unter `public/` liegen in Git und werden als Worker-Assets ausgeliefert. Beim Sichern die zugehörige Git-Version oder das verifizierte Build-Artefakt festhalten. Die Regie speichert bei YouTube-Ambiente die Video-ID in D1. Wiedergabe und Kartenkacheln bezieht die App bei YouTube beziehungsweise OpenFreeMap. Diese externen Dienste haben eigene Sicherungs- und Verfügbarkeitsbedingungen.

## Sicherung anlegen und prüfen

1. Node.js 24 und die Projektabhängigkeiten aus dem Lockfile verwenden. Einen vorhandenen, privaten Elternordner außerhalb des Repositorys wählen. Der Zielordner für jeden Lauf erhält einen neuen Namen mit Datum und Uhrzeit.
2. Den D1-Abzug möglichst zeitnah zum Medienlauf sichern. Beide Zeitpunkte und die passende Git-Version privat zusammen dokumentieren. Uploads zwischen den Abzügen können Abweichungen verursachen. Bei Bedarf beide Abzüge im selben vereinbarten Zeitfenster wiederholen.
3. Ein Cloudflare-API-Token mit `Workers R2 Storage Read` für das betroffene Konto lokal als `CLOUDFLARE_API_TOKEN` bereitstellen. R2-Schreibrechte sind für den Sicherungslauf entbehrlich. Bei Windows mit PowerShell 7 lässt sich ein vorhandenes Token maskiert eingeben. Zugangsdaten gehören in die lokale Geheimnisverwaltung. [Cloudflare-R2-Zugriffsrechte](https://developers.cloudflare.com/r2/api/tokens/)

   ```powershell
   $env:CLOUDFLARE_API_TOKEN = Read-Host 'R2-Lesetoken' -MaskInput
   try {
       node scripts/media-backup.mjs backup <Konto-ID> chronik-von-kleve-r2 <neuer-privater-Archivordner>
   } finally {
       Remove-Item Env:\CLOUDFLARE_API_TOKEN
   }
   ```

   Die Platzhalter vor dem Aufruf durch die Konto-ID und den lokalen, bei Leerzeichen in Anführungszeichen gesetzten Pfad ersetzen. Die Downloads erfolgen per GET. Das Skript liest alle Listenseiten, vergleicht die übertragene Größe und prüft bei Einzelteil-Uploads den MD5-Wert aus dem ETag. Bei mehrteiligen Objekten prüft es die übermittelte ETag-Version. Das Archiv enthält pro Objekt einen SHA-256-Wert sowie den ursprünglichen Schlüssel, Typ, Größe und verfügbare Metadaten. Eine zweite Bestandsliste muss mit der ersten übereinstimmen. [Cloudflare zu R2-Objekten und ETags](https://developers.cloudflare.com/r2/objects/upload-objects/)
4. Die Ausgabe muss mit Exitcode 0 enden. Danach das Archiv ohne Cloudflare-Zugang prüfen.

   ```powershell
   node scripts/media-backup.mjs verify <Archivordner>
   ```

   Zum vollständigen Archiv gehören `manifest.json`, `complete.sha256` und der gesamte Ordner `objects/`. Der Abschlussmarker enthält den SHA-256-Wert des Manifests. Dateinamen unter `objects/` werden aus dem Schlüssel gehasht, damit auch ungewöhnliche R2-Schlüssel sicher auf Windows gespeichert werden können. Der Klartextschlüssel steht im privaten Manifest.
5. Eine zweite verschlüsselte Kopie von Medienarchiv und D1-Abzug auf einem getrennten Speichermedium ablegen. Die Prüfung auch gegen diese Kopie ausführen. Archivordner und Schlüssel müssen auf einem zugriffsgeschützten Datenträger liegen. Das Skript ersetzt vorhandene Ordner und Sicherungen nicht.

Der lokale Ablauf legt keine Cloud-Ressourcen an. Bei 3.176 Standard-Objekten umfasst ein voller Lauf 3.176 GETs und acht Listenseiten bei Seitengröße 1.000. Diese Vorgänge zählen zum Monatskontingent für Standard-Speicher. Cloudflare berechnet darüber 4,50 USD je Million Listenoperationen und 0,36 USD je Million GETs und rundet die Monatsnutzung auf Abrechnungseinheiten auf. R2-Downloads sind ohne Egress-Entgelt. Bei anderen Speicherklassen die Abrufkosten vor dem Lauf prüfen. Lokal Platz für Archiv, Test-Restore und Datenbank vorsehen. Der Restore hält jeweils eine Datei im Arbeitsspeicher. [Cloudflare-R2-Preise](https://developers.cloudflare.com/r2/pricing/)

## Isoliert wiederherstellen

```powershell
node scripts/media-backup.mjs restore-local <Archivordner> <neuer-privater-Testordner>
```

Der Befehl prüft das Archiv vor dem Restore und startet einen eigenen lokalen Miniflare-Objektspeicher. Jedes Objekt wird unter seinem ursprünglichen R2-Schlüssel gespeichert. Danach liest das Skript alle Objekte aus dem Testspeicher zurück und vergleicht Inhalt, Größe, Metadaten und Gesamtbestand. `restore-verified.json` wird nach erfolgreichem Abschluss geschrieben. Das Wiederherstellungsziel ist immer ein neuer lokaler Ordner.

Den passenden D1-Abzug separat in SQLite beziehungsweise eine isolierte D1-Instanz einspielen. `PRAGMA integrity_check`, Fremdschlüssel und gegebenenfalls den aus den Grundtabellen rekonstruierbaren Codex-Suchindex prüfen. Die lokale App mit genau dieser D1-Kopie und dem Test-Bucket starten. Alle `files.key` und sonstigen aus D1 abgeleiteten R2-Schlüssel gegen den Testspeicher prüfen. Repräsentative Bilder, Codex-Seiten, Dokumente und Audio abrufen. Mit getrennten Rollen prüfen, dass private oder SL-interne Dateien für unberechtigte Spieler und anonyme Anfragen gesperrt bleiben.

## Fehler erkennen

| Befund | Vorgehen |
| --- | --- |
| HTTP 401 oder 403 | Lokale Cloudflare-Anmeldung, Konto und R2-Leserecht prüfen. |
| HTTP 404 beim Sichern | Prüfen, ob ein Schlüssel seit der Bestandsliste entfernt wurde. Den gesamten Lauf in einem neuen Archivordner neu starten. |
| Verbindungsabbruch, Zeitlimit, HTTP 429 oder 5xx | Das Skript versucht den betroffenen Lesevorgang bis zu dreimal. Bei dauerhaftem Fehler einen neuen Lauf anlegen. |
| Inventar verändert oder Abschlussmarker fehlt | Den Lauf als unvollständig behandeln und einen neuen Lauf anlegen. |
| SHA-256 oder Größe weicht ab | Eine zweite Kopie prüfen. Bei beschädigtem Archiv den Restore abbrechen. |
| Datei im Test vorhanden, App liefert 404 oder 403 | Zuerst D1-Zuordnung, Rolle und Freigabe prüfen. Die Zugriffskontrolle gehört zur Abnahme. |

Nach größeren Uploads und vor einer Veröffentlichung einen aktuellen D1- und Medienstand gemeinsam prüfen. In regelmäßigen Abständen von der zweiten Kopie wiederherstellen. Datum, Objektzahl, Größe, fehlende Verweise und die geprüften Rollen protokollieren. Dateinamen, personenbezogene Daten und Zugangsdaten privat halten. Objekte ohne direkten Verweis bleiben Teil der Sicherung.

## Wiederherstellung im Ernstfall

Die Spielleitung und der Betreiber legen zuerst den Wiederherstellungszeitpunkt fest. Den betroffenen Live-Stand zu Diagnosezwecken sichern und Änderungen während des Abgleichs koordinieren. Den ausgewählten D1-Abzug und das Medienarchiv nach diesem Ablauf lokal prüfen. Für einen freigegebenen Produktions-Restore zunächst einen separaten privaten R2-Bucket und eine getrennte D1-Instanz vorbereiten. Schreibrechte nur für die freigegebenen Wiederherstellungsziele erteilen. Die ursprünglichen Schlüssel und Sichtbarkeitsregeln übernehmen, den Stand in einer abgeschotteten Vorschau mit mehreren Rollen abnehmen und erst nach Betreiberfreigabe den Worker auf die geprüften Bindungen umstellen. Die bisherige Umgebung als Rückkehrmöglichkeit aufbewahren und nach dem Umschalten die öffentlich erreichbaren Wege erneut prüfen.
