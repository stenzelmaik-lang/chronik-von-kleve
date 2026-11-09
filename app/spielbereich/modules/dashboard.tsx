/* eslint-disable @next/next/no-img-element -- Character portraits use the existing private authenticated media endpoint. */
"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, CalendarDays, CheckSquare, BookOpen, UserRound, Repeat2, Images, Scale, Coins } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Entry } from "@/domain/legacy";
import type { Actor } from "@/domain/types";

import { api } from "./api-client";
import styles from "./dashboard.module.css";
import { RichTextView } from "./rich-text";
import {DashboardCalendar} from "./dashboard-calendar";
import { clanSymbolFor } from "./clan-symbol";
import { useLive } from "./live-state";
import { GalleryPreview } from "./gallery-preview";
import { DashboardPoll } from "./dashboard-poll";
import { safeImage } from "./shared";
import { xpBalance } from "@/domain/character-engine";
import { characterLedger, ledgerDelta } from "@/domain/character-management";
import {
  describeDataError,
  readPlayerData,
  requestPlayerData,
  storePlayerData,
} from "./player-data-cache";

type CharacterChoice = { id: string; name: string; clan: string; concept: string };
type DashboardData = {
  character: Entry | null;
  portrait: string | null;
  campaignName: string;
  calendarEntries: {id?:string;title:string;date:string}[];
  openPoll: Entry | null;
  inbox: {unread:number;latest:{title:string;senderName:string;createdAt:string}|null};
  characters: CharacterChoice[];
  characterCount: number;
  nextSession: Entry | null;
  lastSession: Entry | null;
  latestRecap?: Entry | null;
  economy: Entry | null;
  favors: Entry | null;
  notes: Entry[];
  message: Entry | null;
};
type Result = { key: string; data?: DashboardData; error: Error | null; loading: boolean; refreshing: boolean };

function Portrait({ src, name }: {src:string|undefined;name:string}) {
  const [failed,setFailed]=useState(false);
  return <div className={styles.portrait}>{src&&!failed?<img src={src} alt={`Porträt von ${name}`} onError={()=>setFailed(true)}/>:<UserRound size={38} aria-hidden="true"/>}</div>;
}

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
  const live = useLive();
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
        if (!activeCharacterId && next.character?.id) {
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
  const next = view.nextSession;
  const engineXp = char?.body.engineVersion === 1 && Array.isArray(char.body.xpLedger);
  const xpTitle = engineXp ? `${xpBalance(char!.body)} freie XP` : char?.body.xp !== undefined ? `${char.body.xp} XP · Bestandsangabe` : char ? "Noch keine XP-Angabe" : "Kein Charakter ausgewählt";
  const xpDescription = engineXp ? "Verfügbar für deine Entwicklung." : char?.body.xp !== undefined ? "Bestandsangabe; kein bestätigter XP-Ledger-Saldo." : "Deine vorhandenen Erfahrungswerte erscheinen hier.";
  const openInbox = () => window.dispatchEvent(new CustomEvent('chroniplay:open-inbox'));
  // XP at a glance: received, spent and free, from the confirmed ledger.
  const ledger = engineXp ? characterLedger(char!.body) : [];
  const xpBar = engineXp ? { earned: ledger.reduce((t, r) => t + Math.max(0, ledgerDelta(r)), 0), spent: ledger.reduce((t, r) => t + Math.max(0, -ledgerDelta(r)), 0), free: xpBalance(char!.body) } : null;
  // Straight to the development tab of the character, not to the sheet.
  const openDevelopment = () => { const url = new URL(window.location.href); url.searchParams.set('ansicht', 'entwicklung'); history.replaceState(null, '', url); onNavigate('charaktere'); };
  const portrait = safeImage(view.portrait);
  const clanName = typeof char?.body.clan === "string" ? char.body.clan.trim() : "";
  const clanSymbol = clanSymbolFor(clanName);
  return (
    <div className={styles.overview}>
      {refreshing && <p role="status" className="muted">Wird aktualisiert …</p>}
      {error && <div role="alert" className="error-box"><strong>{describeDataError(error).title}</strong><p>{error.message}</p><button className="button" onClick={retry}>Erneut versuchen</button></div>}
      <header className={styles.heading}><h1>Zuflucht</h1><p>Dein Platz in der Nacht.</p></header>
      <div className={styles.top}>
        <section className={styles.character} aria-labelledby="overview-character">
          {view.characterCount>1&&<label className={styles.characterSwitch}><Repeat2 size={15} aria-hidden="true"/><span className="sr-only">Charakter wechseln</span><select aria-label="Aktiver Charakter" value={activeCharacterId||''} onChange={event=>onActiveCharacterChange(event.target.value||null)}><option value="">Charakter wechseln …</option>{view.characters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
          {clanName && <div className={styles.clanBanner} aria-label={`Clan ${clanName}`}>{clanSymbol && <img src={clanSymbol} alt="" aria-hidden="true" width={48} height={48}/>}<span>{clanName}</span></div>}
          <div className={styles.identity}>
            <Portrait key={portrait || 'neutral'} src={portrait} name={char?.title || 'deinem Charakter'}/>
            <div className={styles.characterCopy}>
              <p className={styles.greeting}>Willkommen zurück in deiner Chronik.</p>
              <h2 id="overview-character">{char?.title || (view.characterCount > 1 ? 'Wähle deinen Charakter' : 'Deine Geschichte beginnt hier')}</h2>
              {char ? <p className={styles.concept}>{[char.body.clan,char.body.concept].filter(v=>typeof v==='string'&&v.trim()).join(' · ') || 'Deine Geschichte wartet.'}</p> : <p className={styles.concept}>{view.characterCount > 1 ? 'Wähle deinen aktiven Bogen für diesen Abend.' : 'Lege deinen Charakter an und finde deinen Platz in der Chronik.'}</p>}

              {char&&<dl className={styles.identityFacts}>{[['Generation',char.body.generation],['Wesen',char.body.nature],['Verhalten',char.body.demeanor],['Erzeuger',char.body.sire],['Chronik',view.campaignName]].filter(([,value])=>value!==undefined&&value!==null&&value!=='').map(([label,value])=><div key={String(label)}><dt>{String(label)}</dt><dd>{String(value)}</dd></div>)}</dl>}
              {typeof char?.body.text==='string'&&char.body.text.trim()&&<details className={styles.characterBackground}><summary>Charakterhintergrund</summary><RichTextView value={char.body.text}/></details>}
            </div>
          </div>
          <button type="button" className={styles.enter} data-live={live||undefined} onClick={()=>onNavigate('sitzung')}><BookOpen size={20} aria-hidden="true"/>Spieltisch betreten{live!==null&&<small className={styles.liveState}>{live?'live':'nicht live'}</small>}<ArrowRight size={18} aria-hidden="true"/></button>
        </section>
        <section className={styles.next} aria-labelledby="overview-next">
          <h2 id="overview-next"><img className={styles.moduleIcon} src="/graphics/spielerzentrale-v01/12-icon-kalender.svg" alt="" aria-hidden="true"/>{view.openPoll?"Terminabstimmung":"Nächster Abend"}</h2>
          {view.openPoll?<DashboardPoll a={a} pollId={view.openPoll.id!} onChanged={retry}/>:<>
          <DashboardCalendar entries={view.calendarEntries} onOpen={()=>onNavigate('termine')}/>
          {next ? <><h3>{next.title}</h3>{typeof next.body.date==='string'&&Number.isFinite(Date.parse(next.body.date))&&<time dateTime={next.body.date}>{new Date(next.body.date).toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'short'})}</time>}</> : <p>Noch kein Spieltermin festgelegt.</p>}
                    <div className={styles.calendarLinks}>{view.openPoll&&<button type="button" onClick={()=>onNavigate('termine')}><CheckSquare size={16} aria-hidden="true"/>An Abstimmung teilnehmen</button>}<button type="button" onClick={()=>onNavigate('termine')}><CalendarDays size={16} aria-hidden="true"/>Kalender öffnen<ArrowRight size={14} aria-hidden="true"/></button></div>
</>}
        </section>
      </div>
      <div className={styles.information}>
        <section className={styles.info} aria-labelledby="overview-xp"><h2 id="overview-xp"><img className={styles.moduleIcon} src="/graphics/spielerzentrale-v01/13-icon-entwicklung.svg" alt="" aria-hidden="true"/>Erfahrung & Fortschritt</h2><h3>{xpTitle}</h3>{xpBar?<div className={styles.xpBar} role="img" aria-label={`${xpBar.earned} XP erhalten, ${xpBar.spent} verbraucht, ${xpBar.free} frei`}><div className={styles.xpTrack}><span className={styles.xpSpent} style={{width:`${xpBar.earned?Math.min(100,xpBar.spent/xpBar.earned*100):0}%`}}/><span className={styles.xpFree} style={{width:`${xpBar.earned?Math.max(0,xpBar.free/xpBar.earned*100):0}%`}}/></div><dl><div><dt>Erhalten</dt><dd>{xpBar.earned}</dd></div><div><dt>Verbraucht</dt><dd>{xpBar.spent}</dd></div><div data-free><dt>Frei</dt><dd>{xpBar.free}</dd></div></dl></div>:<p>{xpDescription}</p>}<button type="button" onClick={openDevelopment}>Entwicklung ansehen<ArrowRight size={15} aria-hidden="true"/></button></section>
        <section className={styles.info} aria-labelledby="overview-last"><h2 id="overview-last"><BookOpen size={18} aria-hidden="true"/>{view.latestRecap?"Letzter Rückblick":"Letzter Spielabend"}</h2>{view.latestRecap?<><h3>{view.latestRecap.title}</h3><p className={styles.recapDate}>{new Date(String(view.latestRecap.body.date||view.latestRecap.updated_at)).toLocaleDateString('de-DE',{dateStyle:'long'})}</p><div className={styles.recapExcerpt}><RichTextView value={String(view.latestRecap.body.text||'')}/></div><a className={styles.recapLink} href={`/spielbereich?bereich=rueckblick&session=${encodeURIComponent(view.latestRecap.id!)}`}>Rückblick lesen<ArrowRight size={15} aria-hidden="true"/></a></>:<><h3>{view.lastSession?.title || 'Die Chronik wartet'}</h3>{view.lastSession?.body.summary ? <div className={styles.summary}><RichTextView value={String(view.lastSession.body.summary)}/></div> : <p>{view.lastSession ? 'Noch keine Zusammenfassung freigegeben.' : 'Noch kein Rückblick freigegeben.'}</p>}</>}<button type="button" className={styles.recapLink} onClick={()=>onNavigate('rueckblick')}>Alle Rückblicke<ArrowRight size={15} aria-hidden="true"/></button></section>
        <section className={styles.info} aria-labelledby="overview-gallery"><h2 id="overview-gallery"><Images size={18} aria-hidden="true"/>Galerie</h2><GalleryPreview onOpen={()=>onNavigate('galerie')}/></section>
      </div>
      <section className={styles.preparation} aria-labelledby="overview-preparation">
        <h2 id="overview-preparation">Meine Vorbereitung</h2>
        <div className={styles.preparationLinks}>
          <button type="button" onClick={()=>onNavigate('charaktere')}><img className={styles.tileIcon} src="/graphics/spielerzentrale-v01/08-icon-charakter.svg" alt="" aria-hidden="true"/><strong>Charakter</strong><span>{char ? 'Bogen & Entwicklung' : 'Auswählen oder erstellen'}</span></button>
          <button type="button" onClick={()=>onNavigate('inventar')}><img className={styles.tileIcon} src="/graphics/spielerzentrale-v01/09-icon-inventar.svg" alt="" aria-hidden="true"/><strong>Inventar</strong><span>Ausrüstung & Besitz</span></button>
          <button type="button" onClick={openInbox}><img className={styles.tileIcon} src="/graphics/spielerzentrale-v01/10-icon-postfach.svg" alt="" aria-hidden="true"/><strong>Postfach</strong><span>Persönliche Nachrichten</span></button>
          <button type="button" onClick={()=>onNavigate('notizen')}><img className={styles.tileIcon} src="/graphics/spielerzentrale-v01/11-icon-archiv.svg" alt="" aria-hidden="true"/><strong>Notizbuch</strong><span>Notizen, Vorbereitung, Archiv</span></button>
          <button type="button" onClick={()=>onNavigate('gefallen')}><Scale className={styles.tileIcon} aria-hidden="true"/><strong>Gefallen</strong><span>Schulden und Versprechen</span></button>
          <button type="button" onClick={()=>onNavigate('wirtschaft')}><Coins className={styles.tileIcon} aria-hidden="true"/><strong>Wirtschaft</strong><span>Vermögen und Ausgaben</span></button>
        </div>
      </section>
    </div>
  );
}
