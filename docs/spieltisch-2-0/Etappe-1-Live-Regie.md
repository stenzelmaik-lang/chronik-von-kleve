# Spieltisch 2.0 – Etappe 1: Live-Regie und privater Regieschuber

Entwicklungsstand 30.10.2026 · Branch `claude/spieltisch-2-0-local` auf Basis `origin/main` `e3cce12` (SL-CMS 3.0). Die folgenden Entwicklungsprüfungen waren lokal; die anschließend ausdrücklich freigegebene Live-Veröffentlichung ist unten dokumentiert. Keine Migration.

## Reproduzierte Fehler und Ursachen

| Nr. | Beobachtung | Tatsächliche Ursache | Behebung |
| --- | --- | --- | --- |
| Szenenauswahl / F-04 / F-08 | „Neue Szene“, „Technische Prüfung …“ erscheinen alphabetisch in der Live-Szenenliste | `stageSnapshot` lieferte **alle** nicht archivierten Kampagnenszenen, ohne Bezug zum gestarteten Spielabend | Neue reine Funktion `liveSceneChoice` (nutzt das vorhandene `orderedSessionScenes`): Szenen des Abends in geplanter Reihenfolge, alle übrigen getrennt als „Weitere Szenen · Improvisation“. Nichts wird gelöscht oder umgeschrieben. |
| F-11 | „Privat ansehen“ legt die SL-Vorschau als Karte **auf die gemeinsame Bühne** | Vorschau-State wurde im Bühnenlayer gerendert | Vorschau entfernt; privater Regieschuber rechts. Auf der Bühne liegt nur Freigegebenes. |
| F-10 / F-12 | Nur Erzählung erreichbar, kein Wechsel zwischen Bereichen | Live-Tisch kannte nur `narration`; restliche sieben Bereiche fehlten | Regieschuber mit acht Bereichen (Erzählung … SL-Notizen, Material). Inhalt hängt ausschließlich an Szenen-ID + Bereich; geladene Szenen werden zwischengespeichert. |
| F-09 / F-15 | HTML/Tabellen sehen im Tisch anders aus als in der Editor-Vorschau | Editor-Vorschau nutzt `RichTextView readable flowing`, Live-Flächen nicht → keine Überschriften-, Absatz- und Tabellenstile | Live-Bühne, Lesefassung, Live-Szene und Spieler-Szenenansicht rendern einheitlich mit `readable flowing`. |

Nicht reproduziert (synthetische Daten): F-13 (unverständliche Fragmente). Dafür braucht es einen Blick auf den echten Bühnenstand; nicht blind geändert.

## Änderungen

- `server/live-stage.ts`: Szenen-Scope je Spielabend; neuer SL-Endpunkt `GET /api/live-stage?sessionId=…&regie=<sceneId>` (`gmOnly`, nur bei laufendem Abend) mit Szenentexten, NPC-Akten (Originalporträt über vorhandenen Asset-Pfad), Handouts und Szenenmedien. Kein neues Datenmodell.
- `domain/session-overview.ts`: `liveSceneChoice`.
- `app/spielbereich/modules/spieltisch/regie.tsx` (+CSS): privater Schuber. Lesen veröffentlicht nichts; Freigaben nur über beschriftete Aktionen („Erzählung zeigen · ganze Runde“, „Zeigen · …“, „Privat auf Bühne legen“) mit bestehender Zielgruppenauswahl.
- `stage.tsx`: Rail „Szenen des Abends“ + „Regie (privat)“, Bühnen-Default mit Atmosphäre statt leerer Fläche, Regie-Fokus je Lauf in `localStorage` (überlebt Neuladen, wird nie geteilt).
- `live-session.tsx`: atmosphärische Wartefläche für Spieler vor Spielstart.
- Wiederverwendet: bestehende Freigabepfade `showScene`/`showMedia` (`/api/live-table`), Bühnenobjekte `add`/`visibility`, Whiteboard (`BoardEditor`), Würfel, Teilnehmerleiste, Medien-/Dateiberechtigungen.

## Tests

- `pnpm test`: 146/146 (inkl. neuem Test für `liveSceneChoice`). Typecheck und ESLint der betroffenen Dateien grün. Produktionsbuild grün.
- `tests/spieltisch-regie-integration.mjs` gegen laufende isolierte Instanz mit drei getrennten Sitzungen (SL, Spieler A, Spieler B): Szenen-Scope, Regie nur für SL (Spieler 403/404 ohne Inhalt), Spieler-Snapshot ohne Katalog und ohne private Texte, gezielte Freigabe nur für A (B: 404 auch beim Direktabruf), Gruppenfreigabe nach Neuladen erhalten.
- Browser (SL und Spieler A, 1440×900): Tests 1–10 des Auftrags durchlaufen.

## Bekannte Einschränkungen

- Medienansicht öffnet sich nach Neuladen erneut automatisch (lokaler „geschlossen“-Zustand; vorbestehendes Verhalten).
- Freigegebene Bilder füllen die Bühne als Hintergrund; Bildkarte/Polaroid folgt in Priorität D.
- Regieschuber ist Lesen + Freigeben; Bearbeiten bleibt bewusst in der SL-Vorbereitung.
- Nachrichten-Dock unten und Probe anfordern sind noch nicht im Tisch.
- Tests ausschließlich mit synthetischen Daten. Persönliche Abnahme mit Originalmaterial steht aus.

## Ausprobieren

`Start-Spieltisch-2.cmd` (oder `pnpm demo:spieltisch`) → `http://127.0.0.1:8830/anmelden`. Synthetische Konten `command-gm@`, `command-a@`, `command-b@example.invalid` (Passwort im Fixture `scripts/test-local.mjs`). Daten liegen in `.local-test/spieltisch-2`; Ordner löschen setzt die Demo zurück.

## Tatsächliche Live-Veröffentlichung, 30.10.2026

**Ergebnis: veröffentlicht. Danach STOPP zur persönlichen UX-Abnahme mit Originalmaterial.**

| Releaseangabe | Geprüfter Stand |
| --- | --- |
| Quellbranch / RC | `claude/spieltisch-2-0-local` · `86ac024c8e6d922dfdcc04926db736936ccb9a4f` |
| Code-Integration | [PR #40](https://github.com/stenzelmaik-lang/chronik-von-kleve/pull/40), ohne Force-Push integriert |
| Tatsächlich veröffentlichter Code-Commit | `8200e9a52a067c6d949d51da3452b57b0c0d1444` – Quellbaum identisch mit RC |
| Live-URL | https://chroniplay.cc/spielbereich?bereich=sitzung |
| Deploymentzeit | 30.10.2026, **12:09:43 Europe/Berlin** (`2026-10-30T11:09:43.725477Z`) |
| Worker | `chronik-von-kleve` |
| Worker-Version | `43f601f0-be7e-4fb0-a4d9-b3ac3b84fd15` |
| Deployment-ID | `fb2b3722-45f5-47c3-b2bd-357b259d38d9` |
| Traffic | 100 % auf neuer Version, durch Cloudflare bestätigt |
| Rückfallversion | `78472084-223c-4add-a3a9-2539cc8fcde2` – vorheriger SL-CMS-3.0-Stand |

### Unabhängige Release-Prüfungen

- 146 Unit-/Regressionstests, Typecheck, gezieltes ESLint, Produktionsbuild und Wrangler-Dry-Run bestanden.
- Vollständiger eigener isolierter Lauf: **1.787 HTTP-Integrationsprüfungen + 46 Rollen-/Backfill-/Rollback-Prüfungen** bestanden.
- Drei getrennte synthetische Sitzungen: SL liest Regie, Spieler A/B erhalten keine privaten Regieinhalte oder Kataloge; gezielte Medienfreigabe nur für A, Direktabruf durch B gesperrt; Gruppenfreigabe nach erneutem Laden erhalten.
- Zehn zusätzliche eigene Browserprüfungen auf einer separaten lokalen Instanz bestanden: Szenenreihenfolge/Improvisation, acht private Bereiche, Geheimnisschutz, Tabellen/Listen, private NPC-Platzierung, Szenenmaterial, kein Vermischen beim Szenenwechsel, ausdrückliche Gruppenfreigabe mit zwei Spieleransichten, Wiederherstellung der privaten Auswahl und Mobil/Escape/bestehende Werkzeuge. Es wurden ausschließlich synthetische Daten verwendet.
- [GitHub-CI für den RC](https://github.com/stenzelmaik-lang/chronik-von-kleve/actions/runs/41045323676): beide Jobs einschließlich der bestehenden SL-Browserabläufe und vollständiger Integration erfolgreich.
- Keine fachlichen Codeänderungen am freigegebenen RC für diesen Release erforderlich. Dieser nachfolgende Bericht ergänzt ausschließlich Dokumentation und löst kein weiteres Code-Deployment aus.

### Produktionskonfiguration und Sicherung

Bestehende D1-/R2-Bindings (`chronik-von-kleve-db`, `chronik-von-kleve-r2`), `AUTH_ACCESS_ENVIRONMENT=closed-alpha-production`, Domain, Kompatibilitätsdatum und CPU-Grenze blieben erhalten. Preview-URLs sind deaktiviert. Auto-Builds bleiben über den bestehenden vollständigen Pfadausschluss pausiert; gezieltes Wrangler-Deployment mit erhaltenen Variablen ausgeführt.

Frisches privates **B0** vor Deployment erstellt und unabhängig in SQLite wiederhergestellt: alle **32 regulären Tabellen**, vollständiges Originalschema und Wiederaufbau des abgeleiteten FTS-Indexes. Integrität `ok`, keine Fremdschlüsselverletzungen, FTS-Integrität für **3.520 Abschnitte** bestanden. Keine virtuelle Produktionstabelle wurde für den Export verändert.

- Unabhängige private Sicherungskopie: `C:/Users/Stenz/Documents/Codex-Private-Backups/spieltisch-2-live-regie-20261030/B0/`.
- SHA-256 des Datentabellenexports: `f2ef5c4b18f527dff11f46b07ccea952d6294a80f3da4416e879ec9f618a7995`.
- Time-Travel-Bookmark, Originalschema, geprüfte Wiederherstellung und Quellbundle sind privat gesichert. Keine Backupinhalte oder Originaldaten in Git.
- **Keine Migration, Schemaänderung, neue Abhängigkeit oder produktive Datenübernahme.** Lokale Startskripte und Fixtures wurden nicht produktiv ausgeführt.

### Tatsächlicher Live-Smoke und Datenvergleich

- Panos vorhandener angemeldeter SL-Zugang auf der Hauptdomain funktioniert weiter; keine Abmeldung oder Änderung von Zugangsdaten durchgeführt.
- Laufender Spielabend, zugeordnete Kaserne-Szene und getrennte weitere Kampagnenszenen live lesend geprüft.
- Original-Erzählung und vorhandene Schäfer-Dialoge laden im privaten Regieschuber mit acht Bereichen und formatierter Darstellung. Keine neuen Freigaben, Nachrichten, NPC-Platzierungen oder Änderungen bestehender Spielinhalte für den Live-Test ausgelöst. Die gemeinsame Bühne blieb dabei unverändert.
- Ohne Anmeldung: Spielbereich führt zum Login; `/api/live-stage`, Katalog- und Regieaufruf liefern **401** mit `no-store, private`.
- **Echter Live-Spielertest nicht durchgeführt:** Auf Rückfrage war kein Spieler verfügbar; der Projektleiter wählte ausdrücklich die Dokumentation der isolierten Rollenprüfung. Der Spieler-A/B-Nachweis ist daher ein isolierter Testnachweis und keine behauptete Live-Kontoabnahme. Keine Spielerkonten übernommen oder zusätzlichen Testkonten angelegt.
- **B1 nach Deployment** erneut exportiert und wiederhergestellt: Integrität, Fremdschlüssel und FTS bestanden. Originalschema exakt unverändert. Bestandsvergleich über alle 32 regulären Tabellen ohne unerwartete Änderungen; Konten, Rollen, Charaktere, Kampagnen und fachliche Inhalte erhalten. Unterschiede ausschließlich legitime Session-`last_seen_at`-Werte, laufende Teilnehmer-Heartbeats und deren 74 fortgeschriebene Live-Tisch-Auditereignisse. Kein Restore.

### Rückfall und Abnahmegrenze

Die vorherige Worker-Version `78472084-223c-4add-a3a9-2539cc8fcde2` ist festgehalten. Da dieser Release weder persistierte Datenformate noch Schema oder Bindings verändert, ist eine Rückschaltung auf diesen unmittelbar vorherigen Code vorgesehen, falls ein konkreter technischer Fehler auftritt. Dabei D1/R2 und zwischenzeitliche Nutzerschreibvorgänge erhalten; **kein Datenbank-Restore** als Teil des Code-Rückfalls. Es wurde kein produktiver Rollback ausgeführt.

Die oben genannten bekannten Einschränkungen bleiben bestehen. Die persönliche UX-Abnahme mit echter Kasernenszene und Herrn Schäfer folgt jetzt durch den Projektinhaber. **Keine nächste Entwicklungsetappe begonnen.**
