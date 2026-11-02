# CP2-03C – Browserprüfung am unveränderten CP2-03B-Stand

Stand: 02.11.2026 · Prüfer: Claude Code · Ergebnis: **keine Produktfehler gefunden**; drei automatische Prüfpunkte schlugen an, weil meine Prüfannahmen falsch waren (Abschnitt 4). Ein einziger Lauf, keine Wiederholung, keine Codeänderung.

## 1. Geprüfter Stand

| | |
|---|---|
| Basis-Commit | `568e241` (Branch `claude/cp2-01a-3-editor-uebergang`, Eltern `4195929` = main/PR #69) |
| CP2-03B | **nicht committet**: Arbeitsstand im Codex-Worktree `…\files-pasted-by-the-user-auftrag\work\cp2-03b` (Branch `codex/cp2-03b-player-regie-trennung`, HEAD `568e241`) mit 16 geänderten Dateien (83 Zeilen hinzu, 27 entfernt), Patch `…\outputs\CP2-03B.patch` |
| Identität | Der Patch wurde in einem getrennten Prüfstand (`git worktree`, detached bei `568e241`, später entfernt) angewendet. Alle 16 Dateien stimmen inhaltlich mit dem Codex-Worktree überein (Vergleich ohne Zeilenenden: 0 Abweichungen). Der Codex-Worktree wurde nicht verändert (weiter 16 Einträge in `git status`). |
| Umgebung | Windows 11, Node 24.22.1, Playwright aus dem Codex-Runtime mit Edge, Build `run-framework.mjs build` erfolgreich, Fixture `scripts/test-local.mjs --spieltisch-release` auf `127.0.0.1:8820` (synthetische Konten und Daten, nichts Produktives) |
| Testdaten | wie im CP2-03B-Integrationstest: Notiz `CP2_03B_PRIVATE_PLAYER_NOTE` (Spieler A, sichtbar „sl“), SL-Sitzung `CP2_03B_SL_SESSION`, SL-eigener Charakter „CP2-03B OWN SL CHARACTER“ mit aktiver Auswahl |
| Skript | [pruefskript.mjs](cp2-03c/pruefskript.mjs) (einmal ausgeführt) |

## 2. Ergebnis je Schritt

| Schritt | Erwartet | Beobachtet |
|---|---|---|
| 1 SL im Spielerbereich | Spieleransicht ohne SL-Inhalte, Fuß „Spieler ·“, kein „Kampagne sichern“, Link „Command Center“, eigener Charakter aktiv | **erfüllt** (1b–1f OK). Screenshot zeigt Kopf „Deine Chronik“, den gewählten Charakter und keinen SL-Inhalt. |
| 2 Command Center | Wechsel nach `/sl/command-center`, Kopf „COMMAND CENTER · VORBEREITUNG“, „Kampagne sichern“ und „Mein Spielerbereich ↗“, SL-Verwaltung funktioniert | **erfüllt** (2a–2c OK): „+ Spielabend anlegen“ öffnet die Planung (4 Schritte). Chronik-CMS zeigt SL-Kopf „DIE CHRONIK IN DEINER HAND“. |
| 3 Zurück | Klick „Mein Spielerbereich“ führt nach `/spielbereich`, keine übernommenen SL-Inhalte, Charakterauswahl bleibt | **erfüllt** nach Screenshot und API: URL stimmt (3a), `/api/dashboard` liefert weiter den SL-eigenen Charakter (3c), `kind=sitzungen` ohne SL-Sitzung (3d), `view=sl` mit SL-Sitzung (3e). Automatischer Sammelpunkt 3b schlug an, siehe Abschnitt 4. |
| 4 Normaler Spieler | Spielerbereich mit „Spieler ·“, kein Command-Center-Link, `/sl/command-center` verwehrt, `view=sl` verboten | **erfüllt** (4a–4d OK): Spieler A sieht nur „Nur für die Kampagnenredaktion · Zum persönlichen Spielbereich“. |
| Seitenfehler | keine | keine `pageerror` auf der SL-Seite |

Screenshots in `docs/alpha-2/cp2-03c/`:
1. [1-sl-im-spielerbereich.png](cp2-03c/1-sl-im-spielerbereich.png): SL im Spielerbereich
2. [3-sl-verwaltung-spielabend-anlegen.png](cp2-03c/3-sl-verwaltung-spielabend-anlegen.png): SL-Verwaltung im Command Center
3. [4-chronik-cms-sl-inhalte.png](cp2-03c/4-chronik-cms-sl-inhalte.png): Chronik-CMS mit SL-Kopf
4. [5-zurueck-im-spielerbereich.png](cp2-03c/5-zurueck-im-spielerbereich.png): zurück im Spielerbereich
5. [7-spieler-command-center-verwehrt.png](cp2-03c/7-spieler-command-center-verwehrt.png): normaler Spieler am Command Center

## 3. Beobachtung ohne Fehlerwert

Der verwehrte Zugriff eines Spielers auf `/sl/command-center` antwortet mit HTTP 200 und einer fast leeren, ungestalteten Seite (zwei Textzeilen, Screenshot 5). Die Inhalte sind geschützt. Ob die Antwort bewusst so ist oder ein Statuscode (403) bzw. eine Weiterleitung vorgesehen ist, geht aus dem Code und dem Auftrag nicht hervor. Das gehört nicht zu CP2-03B und wurde nicht verändert.

## 4. Die drei angeschlagenen automatischen Prüfpunkte

| Punkt | Ursache | Bewertung |
|---|---|---|
| 1a | Ich suchte den Text „DEIN ORT IN DER NACHT“. Die Seite zeigt „Deine Chronik“ und „Dein Platz in der Nacht.“ und keinen SL-Kopf „DIE CHRONIK IN DEINER HAND“. | falsche Prüfannahme, Spieleransicht korrekt (Screenshot 1) |
| 2d | Ich erwartete die SL-Sitzung im „Chronik-CMS“. Diese Seite ist das historische Quellenarchiv (0 / 649 Quellen) und listet keine Sitzungen. Die SL-Inhalte sind über `view=sl` (3e) und den Spielabend-Assistenten belegt. | falsche Prüfannahme |
| 3b | Sammelprüfung mit demselben falschen Text wie 1a. Welche Teilbedingung genau fehlschlug, ist ohne zweiten Lauf nicht trennbar. Die Einzelprüfungen 3a, 3c–3e sind grün und Screenshot 4 ist inhaltlich gleich Screenshot 1. | **sehr wahrscheinlich dieselbe Ursache, nicht bewiesen** |

## 5. Prüfgrenzen

- Genau ein Lauf, wie beauftragt. Der Sammelpunkt 3b ist deshalb nicht endgültig aufgeklärt.
- Nur Desktop (1440 × 950), nur Edge unter Windows, kein echtes Telefon, kein Linux-Chromium.
- Die Seiten wurden im sichtbaren Bereich per Screenshot geprüft. Weiter unten liegende Bereiche wurden nur per Text und API geprüft.
- Kein Typ-, Lint- oder Unit-Testlauf (nicht beauftragt, keine Codeänderung).
- Eine Panne bei der Vorbereitung: Ein erster Versuch, den Prüfstand anzulegen, scheiterte an einem zu langen Pfad, und der Patch wurde dabei versehentlich in meinem eigenen Arbeitsbaum angewendet. Ich habe ihn sofort mit `git apply -R` zurückgenommen. HEAD blieb `568e241`, und der Arbeitsbaum war danach wieder wie zuvor (nur die zwei unversionierten Alpha-1.0-Dokumente). Der Browserlauf lief ausschließlich im getrennten Prüfstand.
- Kein Push, kein Merge, kein Deployment, keine Produktionsdaten.
