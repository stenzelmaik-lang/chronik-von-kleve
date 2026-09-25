"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronRight,
  Clock3,
  Coins,
  HeartHandshake,
  Plus,
  Radio,
  Shield,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Entry } from "@/domain/legacy";
import type { Actor } from "@/domain/types";

import { api } from "./api-client";
import {
  describeDataError,
  readPlayerData,
  requestPlayerData,
  storePlayerData,
} from "./player-data-cache";

type CharacterChoice = { id: string; name: string; clan: string; concept: string };
type DashboardData = {
  character: Entry | null;
  characters: CharacterChoice[];
  characterCount: number;
  nextSession: Entry | null;
  lastSession: Entry | null;
  economy: Entry | null;
  favors: Entry | null;
  notes: Entry[];
  message: Entry | null;
};
type Result = { key: string; data?: DashboardData; error: Error | null; loading: boolean; refreshing: boolean };

function keyFor(characterId: string | null) {
  return characterId
    ? `/api/dashboard?characterId=${encodeURIComponent(characterId)}`
    : "/api/dashboard";
}

export function DashboardPanel({
  a,
  onNavigate,
  dataScope,
  activeCharacterId,
  onActiveCharacterChange,
}: {
  a: Actor;
  onNavigate: (id: string) => void;
  dataScope: string;
  activeCharacterId: string | null;
  onActiveCharacterChange: (id: string | null) => void;
}) {
  const key = keyFor(activeCharacterId);
  const resultKey = `${dataScope}\u0000${key}`;
  const cached = readPlayerData<DashboardData>(dataScope, key);
  const [result, setResult] = useState<Result>({ key: "", error: null, loading: true, refreshing: false });
  const [refreshVersion, setRefreshVersion] = useState(0);
  const forceNext = useRef(false);
  const requestVersion = useRef(0);
  const current = result.key === resultKey;
  const data = current ? result.data : cached?.value;
  const error = current ? result.error : null;
  const loading = !data && (current ? result.loading : true);
  const refreshing = current ? result.refreshing : !!cached && !cached.fresh;

  useEffect(() => {
    let alive = true;
    const requestId = ++requestVersion.current;
    const force = forceNext.current;
    forceNext.current = false;
    const currentCache = readPlayerData<DashboardData>(dataScope, key);
    setResult({ key: resultKey, data: currentCache?.value, error: null, loading: !currentCache, refreshing: !!currentCache && (force || !currentCache.fresh) });
    requestPlayerData(dataScope, key, () => api<DashboardData>(key), { force })
      .then((next) => {
        if (!alive || requestId !== requestVersion.current) return;
        if (!activeCharacterId && next.characterCount === 1 && next.character?.id) {
          storePlayerData(dataScope, keyFor(next.character.id), next);
          onActiveCharacterChange(next.character.id);
        }
        setResult({ key: resultKey, data: next, error: null, loading: false, refreshing: false });
      })
      .catch((issue: unknown) => {
        if (!alive || requestId !== requestVersion.current) return;
        const status = describeDataError(issue);
        setResult({
          key: resultKey,
          data: status.permission ? undefined : currentCache?.value,
          error: issue instanceof Error ? issue : new Error(status.detail),
          loading: false,
          refreshing: false,
        });
      });
    return () => {
      alive = false;
    };
  }, [activeCharacterId, dataScope, key, onActiveCharacterChange, refreshVersion, resultKey]);

  const retry = () => {
    forceNext.current = true;
    setRefreshVersion((version) => version + 1);
  };

  if (loading)
    return (
      <div className="dashboard-loading" aria-live="polite" aria-busy="true">
        <Skeleton className="h-48 w-full" />
        <div className="entry-grid">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      </div>
    );

  if (error && !data) {
    const status = describeDataError(error);
    return (
      <section role="alert" className="error-box">
        <strong>{status.title}</strong>
        <p>{status.detail}</p>
        <button className="button" onClick={retry}>Erneut versuchen</button>
      </section>
    );
  }

  const view = data!;
  const char = view.character;
  const eco = view.economy?.body || {};
  const hasEconomy = !!view.economy;
  const favors = Array.isArray(view.favors?.body?.favors)
    ? view.favors.body.favors
    : [];
  const openFavors = favors.filter(
    (favor) => favor.status !== "eingelöst" && Number(favor.value) !== 0,
  ).length;
  const nextDate = view.nextSession;
  return (
    <div className="dashboard-stack">
      {refreshing && <p className="muted" role="status">Wird aktualisiert …</p>}
      {error && <div role="alert" className="error-box"><strong>{describeDataError(error).title}</strong><p>{error.message}</p><button className="button" onClick={retry}>Erneut versuchen</button></div>}
      <section className="dashboard-banner">
        <div>
          <p className="eyebrow">
            <Zap size={14} /> NACHTPROTOKOLL · {new Date().toLocaleDateString("de-DE")}
          </p>
          <h2>
            {char
              ? `Guten Abend, ${char.title}.`
              : view.characterCount > 1
                ? "Wähle deinen Charakter."
                : `Willkommen in der Domäne, ${a.name}.`}
          </h2>
          <p>
            {char
              ? "Die letzten Signale warten auf deine Entscheidung."
              : view.characterCount > 1
                ? "Deine Charaktere bleiben getrennt; wähle den aktiven Bogen."
                : "Erstelle deinen ersten Charakter und betrete die Chronik."}
          </p>
          {view.characterCount > 1 && (
            <label className="dashboard-character-select">
              <span>Aktiver Charakter</span>
              <select
                aria-label="Aktiver Charakter"
                value={activeCharacterId || ""}
                onChange={(event) => onActiveCharacterChange(event.target.value || null)}
              >
                <option value="">Charakter auswählen …</option>
                {view.characters.map((character) => (
                  <option key={character.id} value={character.id}>{character.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <button
          className="button primary"
          onClick={() => onNavigate(char ? "sitzung" : view.characterCount > 1 ? "charaktere" : "charaktere")}
        >
          {char ? <><Radio size={16} /> Sitzungen öffnen</> : view.characterCount > 1 ? "Charaktere öffnen" : <><Plus size={16} /> Charakter anlegen</>}
        </button>
      </section>
      <div className="dashboard-grid">
        <button className="dash-card character" onClick={() => onNavigate("charaktere")}>
          <span className="dash-card-icon"><Shield size={22} /></span>
          <span className="eyebrow">DEIN BLATT</span>
          <h3>{char?.title || (view.characterCount > 1 ? "Charakter auswählen" : "Noch kein Charakter")}</h3>
          <p>
            {char
              ? [char.body?.clan, char.body?.concept].filter(Boolean).join(" · ") || "Konzept offen"
              : view.characterCount > 1
                ? `${view.characterCount} Charaktere verfügbar.`
                : "Lege dein Kainskind an und halte jede Spur fest."}
          </p>
          {char && <span className="dash-metric">{char.body?.humanity ?? "–"} <small>Menschlichkeit</small></span>}
        </button>
        <button className="dash-card wealth" onClick={() => onNavigate("wirtschaft")}>
          <span className="dash-card-icon"><Coins size={22} /></span>
          <span className="eyebrow">LEDGER</span>
          <h3>{hasEconomy && eco.money_euro !== undefined ? `${Number(eco.money_euro).toLocaleString("de-DE")} €` : "Noch keine Daten"}</h3>
          <p>{hasEconomy ? "Verfügbares Vermögen und Ressourcen." : "Keine Finanzdaten hinterlegt."}</p>
          {hasEconomy && <span className="dash-metric">+{(Number(eco.resources ?? 0) * 600 + Number(eco.finances_successes ?? 0) * 100).toLocaleString("de-DE")} € <small>Monatlich</small></span>}
        </button>
        <button className="dash-card social" onClick={() => onNavigate("gefallen")}>
          <span className="dash-card-icon"><HeartHandshake size={22} /></span>
          <span className="eyebrow">BEZIEHUNGEN</span>
          <h3>{openFavors} offene Gefallen</h3>
          <p>Schulden und Versprechen behalten Gewicht.</p>
          <span className="dash-metric">{favors.reduce((sum: number, favor) => sum + Number(favor.value || 0), 0) > 0 ? "+" : ""}{favors.reduce((sum: number, favor) => sum + Number(favor.value || 0), 0)} <small>Token-Saldo</small></span>
        </button>
      </div>
      <section className="panel dashboard-next">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">NÄCHSTER EINTRAG</p>
            <h3>{nextDate?.title || "Die nächste Zusammenkunft"}</h3>
            <p className="muted">{nextDate?.body?.date || "Aktuell ist keine kommende Sitzung eingetragen."}</p>
          </div>
          <Clock3 size={24} className="text-primary" />
        </div>
        <p>{nextDate?.body?.summary || "Sobald ein kommender Termin freigegeben ist, erscheint er hier."}</p>
        <button className="button" onClick={() => onNavigate(nextDate ? "termine" : "sitzung")}>
          {nextDate ? "Alle Termine ansehen" : "Sitzungszentrale öffnen"} <ChevronRight size={16} />
        </button>
      </section>
      <div className="dashboard-detail-grid">
        <section className="panel dashboard-info-panel"><p className="eyebrow">ERFAHRUNG & FORTSCHRITT</p><h3>{char?.body?.xp !== undefined ? `${char.body.xp} XP` : "Noch keine XP-Daten vorhanden."}</h3><p className="muted">{char?.body?.xp !== undefined ? "Dein aktueller Fortschritt." : "Sobald belastbare Charakterdaten vorliegen, erscheint der Fortschritt hier."}</p></section>
        <section className="panel dashboard-info-panel"><p className="eyebrow">LETZTES SITZUNGSPROTOKOLL</p><h3>{view.lastSession?.title || "Noch kein Protokoll"}</h3><p className="muted">{view.lastSession?.body?.summary || "Es ist noch kein freigegebenes Sitzungsprotokoll vorhanden."}</p>{view.lastSession && <button className="button" onClick={() => onNavigate("sitzung")}>Protokoll lesen <ChevronRight size={16}/></button>}</section>
        <section className="panel dashboard-info-panel"><p className="eyebrow">SL-MITTEILUNG</p><h3>{view.message?.title || "Aktuell liegt keine Mitteilung vor."}</h3><p className="muted">{view.message?.body?.summary || view.message?.body?.text || "Die Spielleitung hat noch keine aktuelle Nachricht freigegeben."}</p></section>
        <section className="panel dashboard-info-panel"><p className="eyebrow">AKTUELLE NOTIZEN</p>{view.notes.length ? view.notes.map((note) => <p className="dashboard-note" key={note.id}>{note.title}</p>) : <p className="muted">Keine persönlichen Hinweise vorhanden.</p>}<button className="button" onClick={() => onNavigate("notizen")}>Notizen öffnen <ChevronRight size={16}/></button></section>
      </div>
      <div className="dashboard-quick-actions"><span className="eyebrow">SCHNELLAKTIONEN</span><button className="button" onClick={() => onNavigate("wuerfel")}><Radio size={15}/> Wurf starten</button><button className="button" onClick={() => onNavigate("notizen")}><Plus size={15}/> Notiz anlegen</button><button className="button" onClick={() => onNavigate("charaktere")}><Shield size={15}/> Charakterbogen</button><button className="button" onClick={() => onNavigate("inventar")}><Coins size={15}/> Inventar</button><button className="button" onClick={() => onNavigate("gefallen")}><HeartHandshake size={15}/> Beziehungen</button></div>
    </div>
  );
}
