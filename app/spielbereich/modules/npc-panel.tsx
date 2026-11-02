/* eslint-disable @next/next/no-img-element -- Authenticated file images. */
"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Eye } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { api } from './api-client';
import { describeDataError, requestPlayerData, invalidatePlayerData } from './player-data-cache';
import { loadNPCList, npcListPath,isRedactedNPC,type NPCListEntry } from './npc-data';
import {npcTopSecretImage} from './npc-top-secret';
import { safeImage } from './shared';
import { NPCDossier } from './npc-dossier';
import { NPCEditor } from './npc-editor';
import dossierStyles from './npc-dossier.module.css';
import { npcCardData } from './npc-card-data';
import cards from './npc-cards.module.css';

export function NPCPanel({ dataScope, gm }: { dataScope: string; gm: boolean }) {
  const listPath=npcListPath(gm);
  const [entities, setEntities] = useState<NPCListEntry[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [refreshing, setRefreshing] = useState(true);
  const [search, setSearch] = useState('');
  const [frames, setFrames] = useState<{id:string;title:string;scroll:number;redacted?:boolean}[]>([]);
  const selected=frames.at(-1);
  const [preview,setPreview]=useState(false);
  const slScroll=useRef(0);
  const [editing,setEditing]=useState<{id?:string}|null>(null),[saving,setSaving]=useState(false),[detailRevision,setDetailRevision]=useState(0);
  const dialogRef=useRef<HTMLDivElement>(null),opener=useRef<HTMLButtonElement|null>(null),pendingScroll=useRef(0),overviewScroll=useRef(0);
  const onReady=useCallback(()=>{requestAnimationFrame(()=>{if(dialogRef.current)dialogRef.current.scrollTop=pendingScroll.current;});},[]);
  function openRelated(id:string,title:string) {
    pendingScroll.current=0;
    setFrames(previous=>[...previous.map((f,index)=>index===previous.length-1?{...f,scroll:dialogRef.current?.scrollTop??0}:f),{id,title,scroll:0}]);
  }
  function back() {
    setPreview(false);pendingScroll.current=frames.at(-2)?.scroll??0;
    setFrames(previous=>previous.slice(0,-1));
  }
  function cancelEdit(){setEditing(null);if(!selected)setFrames([]);}
  function saved(id:string,title:string){
    setEditing(null);pendingScroll.current=0;
    setFrames(previous=>previous.length?previous.map((f,i)=>i===previous.length-1?{id,title,scroll:0}:f):[{id,title,scroll:0}]);
    setDetailRevision(n=>n+1);invalidatePlayerData(dataScope,listPath);setRefreshing(true);setRefresh(n=>n+1);
  }
  useEffect(() => {
    let alive = true;
    requestPlayerData(dataScope, listPath, () => loadNPCList(api,gm), { force: refresh > 0 })
      .then(value => { if (alive) { setEntities(value); setError(null); } })
      .catch(e => { if (alive) { setError(e); if (describeDataError(e).permission) { setEntities(null); setFrames([]); } } })
      .finally(() => { if (alive) setRefreshing(false); });
    return () => { alive = false; };
  }, [dataScope, listPath, gm, refresh]);
  const list = (entities ?? []).filter(e => (e.title + ' ' + JSON.stringify(e.content)).toLowerCase().includes(search.toLowerCase()));
  return <>
    {gm&&<button type="button" className="button" onClick={event=>{opener.current=event.currentTarget;overviewScroll.current=window.scrollY;pendingScroll.current=0;setEditing({});}}>NPC anlegen</button>}
    {entities && refreshing && <p className="muted" role="status">Wird aktualisiert …</p>}
    {error && <section role="alert" className="error-box"><h2>{describeDataError(error).title}</h2><p>{error.message}</p><button className="button" onClick={() => { setError(null); setRefreshing(true); setRefresh(n => n + 1); }}>Erneut versuchen</button></section>}
    {!entities && !error ? <div className="entry-grid">{[1, 2, 3].map(i => <Skeleton key={i} className="h-56 w-full" />)}</div> : entities && <>
      <div className="search-row"><Search size={18} /><input aria-label="NPC durchsuchen" placeholder="Persönlichkeiten durchsuchen …" value={search} onChange={e => setSearch(e.target.value)} /><span>{list.length} Einträge</span></div>
      {!list.length ? <Empty className="empty-night"><EmptyHeader><EmptyTitle>{search ? 'Keine passenden Einträge' : 'Hier beginnt die nächste Geschichte.'}</EmptyTitle><EmptyDescription>{search ? 'Versuche einen anderen Suchbegriff.' : gm ? 'Noch keine NPC-Originalobjekte vorhanden.' : 'Die Spielleitung hat hier noch keine Inhalte freigegeben.'}</EmptyDescription></EmptyHeader></Empty> : <div className={cards.grid}>{list.map(e => {
        if(isRedactedNPC(e))return <button key={e.id} className={cards.card} aria-label="TOP SECRET – anonyme Akte öffnen" onClick={event=>{opener.current=event.currentTarget;overviewScroll.current=window.scrollY;pendingScroll.current=0;setFrames([{id:e.id,title:'TOP SECRET',scroll:0,redacted:true}]);}}><span className={cards.portrait} aria-hidden="true"><img src={npcTopSecretImage} alt="" loading="lazy"/></span><span className={cards.body}><span className={cards.name}>TOP SECRET</span><span className={cards.redaction} aria-hidden="true"><span/><span/><span/></span><span className={cards.open}>Versiegelte Akte</span></span></button>;
        const image = safeImage(e.content.image_secondary)||safeImage(e.content.image_primary)||safeImage(e.content.image);
        const card = npcCardData(e,gm);
        return <button key={e.id} className={cards.card} aria-label={`${e.title}${card.alias ? ` · ${card.alias}` : ''} – Akte öffnen`} onClick={event => {opener.current=event.currentTarget;overviewScroll.current=window.scrollY;pendingScroll.current=0;setPreview(false);setFrames([{id:e.id,title:e.title,scroll:0}]);}}>
          <span className={cards.portrait} aria-hidden="true">{gm && (e.defaultVisibility === 'sl_secret' || e.canonStatus === 'GM_SECRET') && <span className={cards.secret}>SL-INTERN</span>}{image ? <img src={image} alt="" loading="lazy" /> : <><span className={cards.placeholder}>{card.initials}</span><span className={cards.noPortrait}>Kein Bild hinterlegt</span></>}</span>
          <span className={cards.body}><span className={cards.name}>{e.title}</span>{card.alias && <span className={cards.alias}>{card.alias}</span>}<span className={cards.facts}>{card.facts.map(fact => <span key={fact.label} className={cards.fact}><span className={cards.factLabel}>{fact.label}</span><span className={cards.factValue}>{fact.value}</span></span>)}</span><span className={cards.open}>Akte öffnen <span aria-hidden="true">↗</span></span></span>
        </button>;
      })}</div>}
    </>}
    <Dialog open={!!selected||!!editing} onOpenChange={open => {if(!open&&!saving){setEditing(null);setPreview(false);setFrames([]);}}}><DialogContent ref={dialogRef} className={`!max-w-5xl max-h-[90vh] overflow-y-auto ${dossierStyles.dialog}`} onEscapeKeyDown={e=>{if(saving)e.preventDefault();}} onInteractOutside={e=>{if(saving)e.preventDefault();}} onCloseAutoFocus={event=>{event.preventDefault();opener.current?.focus({preventScroll:true});window.scrollTo({top:overviewScroll.current,behavior:'instant'});}}><DialogHeader className="sr-only"><DialogTitle>{editing?'NPC bearbeiten':preview?'Spieleransicht':selected?.title??'Originalakte'}</DialogTitle><DialogDescription>{editing?'Änderungen erst beim Speichern übernehmen.':'Für dich freigegebene Inhalte der Originalakte.'}</DialogDescription></DialogHeader><div className={dossierStyles.toolbar}><button type="button" className="button" disabled={saving} onClick={editing?cancelEdit:back}>{editing?'← Bearbeitung abbrechen':frames.length>1?`← Zurück zu ${frames.at(-2)?.title}`:'← Zur NPC-Übersicht'}</button>{gm&&!editing&&selected&&!selected.redacted&&<button type="button" className={dossierStyles.previewSwitch} aria-label={preview?'Zur SL-Ansicht wechseln':'Spieleransicht anzeigen'} aria-pressed={preview} title={preview?'Zur SL-Ansicht wechseln':'Spieleransicht · allgemeine Freigaben, ohne persönliches Charakterwissen'} onClick={()=>{if(!preview)slScroll.current=dialogRef.current?.scrollTop??0;pendingScroll.current=preview?slScroll.current:0;setPreview(value=>!value);}}><Eye size={18} aria-hidden="true"/></button>}</div>{editing&&gm?<NPCEditor key={editing.id??'new'} id={editing.id} onCancel={cancelEdit} onSaved={saved} onBusy={setSaving}/>:selected&&<NPCDossier key={selected.id+':'+detailRevision+':'+preview} id={selected.id} gm={gm} preview={preview} onOpen={openRelated} onReady={onReady} onEdit={gm&&!preview?id=>{pendingScroll.current=dialogRef.current?.scrollTop??0;setEditing({id});if(dialogRef.current)dialogRef.current.scrollTop=0;}:undefined} onDenied={()=>{setFrames([]);setEditing(null);setEntities(null);setRefresh(n=>n+1);}} />}</DialogContent></Dialog>
  </>;
}
