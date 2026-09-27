# Cloudflare Preview-Status und Isolation – Phase C

Lesende Prüfung am 25.09.2026. Keine Cloudflare-Einstellungen, Worker, Datenbank, Buckets, Preview-Builds oder Deployments wurden verändert oder ausgelöst.

## Ressourcen und Build-Konfiguration
- Preview-D1 chronik-von-kleve-phase-c-db, ID 93863382-2046-4efc-a5b7-7eb1306955f9; API meldet null Tabellen.
- Preview-R2 chronik-von-kleve-phase-c-r2 ist vorhanden; Objekte wurden nicht aufgelistet.
- Produktion bleibt chronik-von-kleve-db / a4bc79e6-3f33-4b03-b240-9c341bd1d4d7 und chronik-von-kleve-r2.
- Cloudflare Build-Variablenabfrage liefert keine benutzerdefinierten Variablen; die vier PHASE_C-Werte fehlen.
- Workers Preview für codex/pre-alpha-v0.1.037-phase-c steht auf auto_build=true und auto_delete=true. Die zwei letzten Build-Datensätze stehen auf stopped. In dieser Aufgabe wurde kein Preview-Build gestartet.
- Main-Build-Trigger weist npm run build und npx wrangler deploy aus.
- Eine Access-Anwendung für preview_worker ist vorhanden. Die Allow-Regel „Cloudflare Workers Preview URLs“ erlaubt Cloudflare-Kontomitglieder. Echter Zugriffstest steht aus.

## Lokale Konfigurationsprüfung
Wrangler 4.137.0, @cloudflare/vite-plugin 1.58.0 und @cloudflare/workers-types 5.20260925.2 sind fixiert. Wrangler 4.137.0 liegt über dem Cloudflare-Minimum 4.135.0 für Previews.

vite.config.ts belässt Production-Bindings unverändert und erzeugt einen separaten previews-Block. Ein lokaler Workers-CI-Build mit den vorgegebenen Phase-C-Werten ergab getrennte Preview-D1/R2-Ressourcen, keine legacy_env-Sektion und keine Runtime-Variablen. Kein Worker wurde deployed oder remote ausgeführt.

Der Fail-Closed-Resolver verlangt in Nicht-main-Builds alle vier Werte: PHASE_C_WORKER, PHASE_C_D1_DATABASE_ID, PHASE_C_D1_DATABASE_NAME und PHASE_C_R2_BUCKET_NAME. Fehlende, partielle, ungültige, falsche oder produktionsgleiche Werte brechen den Build ab. WORKERS_CI und WORKERS_CI_BRANCH sind Cloudflare-Systemwerte.

## Nächster Schritt
Der Worker ergänzt die vier benutzerdefinierten Buildwerte, prüft die wirksamen Preview-Bindings und testet Access mit erlaubtem sowie abgewiesenem Zugriff. Migrationen 0004/0005 dürfen nach separater Freigabe manuell nur auf Preview-D1 laufen. Erst danach Push-Freigabe einholen; ein Push kann aufgrund auto_build=true Preview auslösen.

Cloudflare-Dokumentation: https://developers.cloudflare.com/workers/previews/ , https://developers.cloudflare.com/workers/previews/configuration/ , https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
