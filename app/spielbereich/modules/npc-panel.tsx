/* eslint-disable @next/next/no-img-element -- Authenticated file images. */
"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Entity } from '@/domain/types';
import { api } from './api-client';
import { describeDataError, requestPlayerData } from './player-data-cache';
import { loadNPCList, npcListPath } from './npc-data';
import { safeImage } from './shared';
import { NPCDossier } from './npc-dossier';
import dossierStyles from './npc-dossier.module.css';
import { npcCardData } from './npc-card-data';
import cards from './npc-cards.module.css';

export function NPCPanel({ dataScope, gm }: { dataScope: string; gm: boolean }) {
  const [entities, setEntities] = useState<Entity[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [refreshing, setRefreshing] = useState(true);
  const [search, setSearch] = useState('');
  const [frames, setFrames] = useState<{id:string;title:string;scroll:number}[]>([]);
  const selected=frames.at(-1);
  const dialogRef=useRef<HTMLDivElement>(null),opener=useRef<HTMLButtonElement|null>(null),pendingScroll=useRef(0),overviewScroll=useRef(0);
  const onReady=useCallback(()=>{requestAnimationFrame(()=>{if(dialogRef.current)dialogRef.current.scrollTop=pendingScroll.current;});},[]);
  function openRelated(id:string,title:string) {
    pendingScroll.current=0;
    setFrames(previous=>[...previous.map((f,index)=>index===previous.length-1?{...f,scroll:dialogRef.current?.scrollTop??0}:f),{id,title,scroll:0}]);
  }
  function back() {
    pendingScroll.current=frames.at(-2)?.scroll??0;
    setFrames(previous=>previous.slice(0,-1));
  }
  useEffect(() => {
    let alive = true;
    requestPlayerData(dataScope, npcListPath, () => loadNPCList(api), { force: refresh > 0 })
      .then(value => { if (alive) { setEntities(value); setError(null); } })
      .catch(e => { if (alive) { setError(e); if (describeDataError(e).permission) { setEntities(null); setFrames([]); } } })
      .finally(() => { if (alive) setRefreshing(false); });
    return () => { alive = false; };
  }, [dataScope, refresh]);
  const list = (entities ?? []).filter(e => (e.title + ' ' + JSON.stringify(e.content)).toLowerCase().includes(search.toLowerCase()));
  return <>
    {entities && refreshing && <p className="muted" role="status">Wird aktualisiert …</p>}
    {error && <section role="alert" className="error-box"><h2>{describeDataError(error).title}</h2><p>{error.message}</p><button className="button" onClick={() => { setError(null); setRefreshing(true); setRefresh(n => n + 1); }}>Erneut versuchen</button></section>}
    {!entities && !error ? <div className="entry-grid">{[1, 2, 3].map(i => <Skeleton key={i} className="h-56 w-full" />)}</div> : entities && <>
      <div className="search-row"><Search size={18} /><input aria-label="NPC durchsuchen" placeholder="Persönlichkeiten durchsuchen …" value={search} onChange={e => setSearch(e.target.value)} /><span>{list.length} Einträge</span></div>
      {!list.length ? <Empty className="empty-night"><EmptyHeader><EmptyTitle>{search ? 'Keine passenden Einträge' : 'Hier beginnt die nächste Geschichte.'}</EmptyTitle><EmptyDescription>{search ? 'Versuche einen anderen Suchbegriff.' : gm ? 'Noch keine NPC-Originalobjekte vorhanden.' : 'Die Spielleitung hat hier noch keine Inhalte freigegeben.'}</EmptyDescription></EmptyHeader></Empty> : <div className={cards.grid}>{list.map(e => {
        const image = safeImage(e.content.image);
        const card = npcCardData(e);
        return <button key={e.id} className={cards.card} aria-label={`${e.title}${card.alias ? ` · ${card.alias}` : ''} – Akte öffnen`} onClick={event => {opener.current=event.currentTarget;overviewScroll.current=window.scrollY;pendingScroll.current=0;setFrames([{id:e.id,title:e.title,scroll:0}]);}}>
          <span className={cards.portrait} aria-hidden="true">{gm && (e.defaultVisibility === 'sl_secret' || e.canonStatus === 'GM_SECRET') && <span className={cards.secret}>SL-INTERN</span>}{image ? <img src={image} alt="" loading="lazy" /> : <><span className={cards.placeholder}>{card.initials}</span><span className={cards.noPortrait}>Kein Bild hinterlegt</span></>}</span>
          <span className={cards.body}><span className={cards.name}>{e.title}</span>{card.alias && <span className={cards.alias}>{card.alias}</span>}<span className={cards.facts}>{card.facts.map(fact => <span key={fact.label} className={cards.fact}><span className={cards.factLabel}>{fact.label}</span><span className={cards.factValue}>{fact.value}</span></span>)}</span><span className={cards.open}>Akte öffnen <span aria-hidden="true">↗</span></span></span>
        </button>;
      })}</div>}
    </>}
    <Dialog open={!!selected} onOpenChange={open => {if(!open)setFrames([]);}}><DialogContent ref={dialogRef} className={`!max-w-5xl max-h-[90vh] overflow-y-auto ${dossierStyles.dialog}`} onCloseAutoFocus={event=>{event.preventDefault();opener.current?.focus({preventScroll:true});window.scrollTo({top:overviewScroll.current,behavior:'instant'});}}><DialogHeader className="sr-only"><DialogTitle>{selected?.title??'Originalakte'}</DialogTitle><DialogDescription>Für dich freigegebene Inhalte der Originalakte.</DialogDescription></DialogHeader><div className={dossierStyles.toolbar}><button type="button" className="button" onClick={back}>{frames.length>1?`← Zurück zu ${frames.at(-2)?.title}`:'← Zur NPC-Übersicht'}</button></div>{selected && <NPCDossier key={selected.id} id={selected.id} gm={gm} onOpen={openRelated} onReady={onReady} onDenied={()=>{setFrames([]);setEntities(null);setRefresh(n=>n+1);}} />}</DialogContent></Dialog>
  </>;
}
