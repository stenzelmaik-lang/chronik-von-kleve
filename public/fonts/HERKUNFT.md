# Schriften · Herkunft und Lizenz

Am 08.11.2026 mit Freigabe des Besitzers heruntergeladen. Ebenfalls am 08.11. hat der Besitzer an der Musterseite (Etappe 3) gewählt: **Spectral** für Titel, **IBM Plex Sans** für Fließtext und Notizen. Die vier anderen Probeschriften sind aus dem Repo entfernt.

| Schrift | Paket (Fontsource) | Version | Dateien | Lizenz |
|---|---|---|---|---|
| Spectral | `@fontsource/spectral` | 5.3.0 | latin 400, 700 | SIL OFL 1.1 (`spectral/LICENSE`) |
| IBM Plex Sans | `@fontsource/ibm-plex-sans` | 5.3.0 | latin 400, 700 | SIL OFL 1.1 (`ibm-plex-sans/LICENSE`) |

Quelle: `https://cdn.jsdelivr.net/npm/@fontsource/<name>@<version>/files/<name>-latin-<gewicht>-normal.woff2`. Fontsource verteilt die Originale aus Google Fonts unverändert als woff2. Der Teilsatz „latin“ enthält ä, ö, ü, ß und die üblichen Satzzeichen.

Die Schriften werden selbst gehostet aus `public/fonts/` ausgeliefert und in `app/globals.css` per `@font-face` eingebunden. Kein fremdes CDN zur Laufzeit, keine npm-Abhängigkeit. Die OFL erlaubt Nutzung, Einbettung und Weitergabe, auch kommerziell, solange die Schriften nicht allein verkauft werden und der Lizenztext beiliegt.
