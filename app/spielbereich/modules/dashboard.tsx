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
import styles from "./dashboard.module.css";
import { DashboardScene } from "./dashboard-scene";
import { xpBalance } from "@/domain/character-engine";
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
  const engineXp = char?.body?.engineVersion === 1 && Array.isArray(char.body.xpLedger);
  const xpTitle = engineXp ? `${xpBalance(char!.body)} freie XP` : char?.body?.xp !== undefined ? `${char.body.xp} XP · Bestandsangabe` : char ? "Noch keine XP-Angabe" : "Kein Charakter ausgewählt";
  const xpDescription = engineXp ? "Saldo des vorhandenen Character-Engine-Ledgers." : char?.body?.xp !== undefined ? "Übernommene Anzeige aus dem Charakterdatensatz; kein bestätigter XP-Ledger-Saldo." : "Im ausgewählten Charakterdatensatz nicht erfasst.";
  return (
    <div className={`dashboard-stack ${styles.overview}`}>
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
              ? "Dein Charakter und die freigegebenen Informationen für den Spielabend."
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
      <DashboardScene a={a} characterId={activeCharacterId} onOpen={() => onNavigate("sitzung")}/>
      {nextDate && <section className="panel dashboard-next">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">NÄCHSTER FREIGEGEBENER TERMIN</p>
            <h3>{nextDate?.title || "Die nächste Zusammenkunft"}</h3>
            <p className="muted">{nextDate?.body?.date && Number.isFinite(Date.parse(nextDate.body.date)) ? new Date(nextDate.body.date).toLocaleString("de-DE",{dateStyle:"medium",timeStyle:"short"}) : nextDate?.body?.date}</p>
          </div>
          <Clock3 size={24} className="text-primary" />
        </div>
        {nextDate?.body?.summary && <p>{nextDate.body.summary}</p>}
        <button className="button" onClick={() => onNavigate(nextDate ? "termine" : "sitzung")}>
          {nextDate ? "Alle Termine ansehen" : "Sitzungszentrale öffnen"} <ChevronRight size={16} />
        </button>
      </section>}
      <div className="dashboard-quick-actions"><span className="eyebrow">SCHNELLAKTIONEN</span><button className="button" onClick={() => onNavigate("wuerfel")}><Radio size={15}/> Würfel öffnen</button><button className="button" onClick={() => onNavigate("notizen")}><Plus size={15}/> Meine Notizen</button><button className="button" onClick={() => onNavigate("charaktere")}><Shield size={15}/> Charakterbogen</button>{char && <button className="button" onClick={() => onNavigate("inventar")}><Coins size={15}/> Inventar</button>}{view.favors && openFavors > 0 && <button className="button" onClick={() => onNavigate("gefallen")}><HeartHandshake size={15}/> Gefallen</button>}</div>
      <div className="dashboard-grid">
        {view.characterCount > 0 && <button className="dash-card character" onClick={() => onNavigate("charaktere")}>
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
        </button>}
        {hasEconomy && <button className="dash-card wealth" onClick={() => onNavigate("wirtschaft")}>
          <span className="dash-card-icon"><Coins size={22} /></span>
          <span className="eyebrow">WIRTSCHAFT</span>
          <h3>{hasEconomy && (eco.money_euro !== undefined || eco.money !== undefined) ? `${Number(eco.money_euro ?? eco.money).toLocaleString("de-DE")} €` : "Noch keine Daten"}</h3>
          <p>{hasEconomy ? "Verfügbares Vermögen und Ressourcen." : "Keine Finanzdaten hinterlegt."}</p>
          {hasEconomy && eco.resources !== undefined && <span className="dash-metric">+{(Number(eco.resources ?? 0) * 600 + Number(eco.finances_successes ?? 0) * 100).toLocaleString("de-DE")} € <small>Monatlich</small></span>}
        </button>}
        {view.favors && openFavors > 0 && <button className="dash-card social" onClick={() => onNavigate("gefallen")}>
          <span className="dash-card-icon"><HeartHandshake size={22} /></span>
          <span className="eyebrow">GEFALLEN</span>
          <h3>{view.favors ? `${openFavors} offene Gefallen` : "Noch nicht erfasst"}</h3>
          <p>Schulden und Versprechen behalten Gewicht.</p>
          {view.favors && <span className="dash-metric">{favors.reduce((sum: number, favor) => sum + Number(favor.value || 0), 0) > 0 ? "+" : ""}{favors.reduce((sum: number, favor) => sum + Number(favor.value || 0), 0)} <small>Token-Saldo</small></span>}
        </button>}
      </div>

      <div className="dashboard-detail-grid">
        {char && (engineXp || char.body.xp !== undefined) && <section className="panel dashboard-info-panel"><p className="eyebrow">ERFAHRUNG & FORTSCHRITT</p><h3>{xpTitle}</h3><p className="muted">{xpDescription}</p></section>}
        {view.lastSession && <section className="panel dashboard-info-panel"><p className="eyebrow">LETZTER SICHTBARER SITZUNGSEINTRAG</p><h3>{view.lastSession?.title || "Noch kein Sitzungseintrag"}</h3><p className="muted">{view.lastSession?.body?.summary || (view.lastSession ? "Keine Zusammenfassung hinterlegt." : "Es ist noch kein sichtbarer Sitzungseintrag vorhanden.")}</p>{view.lastSession && <button className="button" onClick={() => onNavigate("sitzung")}>Zur Sitzung <ChevronRight size={16}/></button>}</section>}
        {view.message && <section className="panel dashboard-info-panel"><p className="eyebrow">SL-MITTEILUNG</p><h3>{view.message?.title || "Aktuell liegt keine Mitteilung vor."}</h3><p className="muted">{view.message?.body?.summary || view.message?.body?.text || "Die Spielleitung hat noch keine aktuelle Nachricht freigegeben."}</p></section>}
        {view.notes.length > 0 && <section className="panel dashboard-info-panel"><p className="eyebrow">AKTUELLE NOTIZEN</p>{view.notes.length ? view.notes.map((note) => <p className="dashboard-note" key={note.id}>{note.title}</p>) : <p className="muted">Keine persönlichen Hinweise vorhanden.</p>}<button className="button" onClick={() => onNavigate("notizen")}>Notizen öffnen <ChevronRight size={16}/></button></section>}
      </div>

    </div>
  );
}
