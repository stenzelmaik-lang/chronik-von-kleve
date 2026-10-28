/* eslint-disable @next/next/no-img-element -- Character portraits use the existing private authenticated media endpoint. */
"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, CalendarDays, CheckSquare, BookOpen, FolderArchive, Mail, Shield, ShoppingBag, TrendingUp, UserRound, Repeat2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Entry } from "@/domain/legacy";
import type { Actor } from "@/domain/types";

import { api } from "./api-client";
import styles from "./dashboard.module.css";
import { RichTextView } from "./rich-text";
import {DashboardCalendar} from "./dashboard-calendar";
import { safeImage } from "./shared";
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
  portrait: string | null;
  campaignName: string;
  calendarEntries: {id?:string;title:string;date:string}[];
  openPoll: Entry | null;
  inbox: {unread:number;latest:{title:string;senderName:string;createdAt:string}|null};
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
  const portrait = safeImage(view.portrait);
  return (
    <div className={styles.overview}>
      {refreshing && <p role="status" className="muted">Wird aktualisiert …</p>}
      {error && <div role="alert" className="error-box"><strong>{describeDataError(error).title}</strong><p>{error.message}</p><button className="button" onClick={retry}>Erneut versuchen</button></div>}
      <header className={styles.heading}><h1>Deine Chronik</h1><p>Dein Platz in der Nacht.</p></header>
      <div className={styles.top}>
        <section className={styles.character} aria-labelledby="overview-character">
          {view.characterCount>1&&<label className={styles.characterSwitch}><Repeat2 size={15} aria-hidden="true"/><span className="sr-only">Charakter wechseln</span><select aria-label="Aktiver Charakter" value={activeCharacterId||''} onChange={event=>onActiveCharacterChange(event.target.value||null)}><option value="">Charakter wechseln …</option>{view.characters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
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
          <button type="button" className={styles.enter} onClick={()=>onNavigate('sitzung')}><BookOpen size={20} aria-hidden="true"/>Spieltisch betreten<ArrowRight size={18} aria-hidden="true"/></button>
        </section>
        <section className={styles.next} aria-labelledby="overview-next">
          <h2 id="overview-next"><CalendarDays size={19} aria-hidden="true"/>Nächster Abend</h2>
          <DashboardCalendar entries={view.calendarEntries} onOpen={()=>onNavigate('termine')}/>
          {next ? <><h3>{next.title}</h3>{typeof next.body.date==='string'&&Number.isFinite(Date.parse(next.body.date))&&<time dateTime={next.body.date}>{new Date(next.body.date).toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'short'})}</time>}</> : <p>Noch kein Spieltermin festgelegt.</p>}
          {view.openPoll && <p className={styles.pollTitle}>{view.openPoll.title}</p>}
          <div className={styles.calendarLinks}>{view.openPoll&&<button type="button" onClick={()=>onNavigate('termine')}><CheckSquare size={16} aria-hidden="true"/>An Abstimmung teilnehmen</button>}<button type="button" onClick={()=>onNavigate('termine')}><CalendarDays size={16} aria-hidden="true"/>Kalender öffnen<ArrowRight size={14} aria-hidden="true"/></button></div>
        </section>
      </div>
      <div className={styles.information}>
        <section className={styles.info} aria-labelledby="overview-xp"><h2 id="overview-xp"><TrendingUp size={18} aria-hidden="true"/>Erfahrung & Fortschritt</h2><h3>{xpTitle}</h3><p>{xpDescription}</p><button type="button" onClick={()=>onNavigate('charaktere')}>Entwicklung ansehen<ArrowRight size={15} aria-hidden="true"/></button></section>
        <section className={styles.info} aria-labelledby="overview-last"><h2 id="overview-last"><BookOpen size={18} aria-hidden="true"/>Letzter Spielabend</h2><h3>{view.lastSession?.title || 'Die Chronik wartet'}</h3>{view.lastSession?.body.summary ? <div className={styles.summary}><RichTextView value={String(view.lastSession.body.summary)}/></div> : <p>{view.lastSession ? 'Noch keine Zusammenfassung freigegeben.' : 'Noch kein vergangener Spielabend freigegeben.'}</p>}{view.lastSession&&<a className={styles.recapLink} href={`/spielbereich?bereich=rueckblick&session=${encodeURIComponent(view.lastSession.id!)}${activeCharacterId?'&character='+encodeURIComponent(activeCharacterId):''}`}>Zusammenfassung lesen<ArrowRight size={15} aria-hidden="true"/></a>}</section>
        <section className={`${styles.info} ${styles.reserved}`} aria-labelledby="overview-reserved"><h2 id="overview-reserved">Weitere Chronik-Informationen</h2><p>Für diesen Bereich wurde noch kein Inhalt festgelegt.</p></section>
      </div>
      <section className={styles.preparation} aria-labelledby="overview-preparation">
        <h2 id="overview-preparation">Meine Vorbereitung</h2>
        <div className={styles.preparationLinks}>
          <button type="button" onClick={()=>onNavigate('charaktere')}><Shield size={24} aria-hidden="true"/><strong>Charakter</strong><span>{char ? 'Bogen & Entwicklung' : 'Auswählen oder erstellen'}</span></button>
          <button type="button" onClick={()=>onNavigate('inventar')}><ShoppingBag size={24} aria-hidden="true"/><strong>Inventar</strong><span>Ausrüstung & Besitz</span></button>
          <button type="button" onClick={openInbox}><Mail size={24} aria-hidden="true"/><strong>Postfach</strong><span>Persönliche Nachrichten</span></button>
          <button type="button" onClick={()=>onNavigate('notizen')}><FolderArchive size={24} aria-hidden="true"/><strong>Persönliches Archiv</strong><span>Eigene Notizen</span></button>
        </div>
      </section>
    </div>
  );
}
