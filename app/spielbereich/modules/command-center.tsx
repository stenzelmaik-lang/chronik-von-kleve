"use client";
import { useEffect, useState } from 'react';
import { Clapperboard, MapPin, Users, NotebookPen, ScrollText, RefreshCw, Eye, Dices, PanelsTopLeft, ArrowUpRight } from 'lucide-react';
import type { Actor, Entity } from '@/domain/types';
import type { Entry } from '@/domain/legacy';
import { commandCenterAllowed } from '@/domain/command-center';
import { api } from './api-client';
import { SessionPanel } from './session';
import { CommandPlace } from './command-place';
import { DicePanel } from './dice';
import { CommandCharacter } from './command-character';
import { CommandNotes } from './command-notes';
import styles from './command-center.module.css';

type Snapshot={campaignId:string;members:{id:string;name:string}[];characters:{id:string;title:string;ownerId:string}[];handouts:{id:string;title:string;text:string;revocable:boolean;legacy:boolean}[];grants:{entity_id:string;audience:string;subject_id:string;state:string}[]};
type PlayerData={sessions:Entry[];handouts:{id:string;title:string;text:string}[]};
const tools=[{id:'scene',label:'Szene',icon:Clapperboard},{id:'places',label:'Ort',icon:MapPin},{id:'character',label:'Spieler',icon:Users},{id:'handouts',label:'Handouts',icon:ScrollText},{id:'notes',label:'Notizen',icon:NotebookPen},{id:'dice',label:'Würfel',icon:Dices}] as const;
type Tool=typeof tools[number]['id'];
type Props={entries:Entry[];a:Actor;onRefresh:()=>void};
export function CommandCenter(props:Props) {
  return commandCenterAllowed(props.a)?<GMCommandCenter {...props}/>:<PlayerSession {...props}/>;
}
function PlayerSession({entries,a,onRefresh,preview}:Props&{preview?:PlayerData}) {
  const [data,setData]=useState<PlayerData>({sessions:entries,handouts:[]}),[error,setError]=useState('');
  useEffect(()=>{
    if(preview)return;
    let live=true,busy=false;
    const load=async()=>{
      if(busy)return;busy=true;
      try{const [records,entities]=await Promise.all([api<{records:Entry[]}>('/api/records?kind=sitzungen'),api<{entities:Entity[]}>('/api/entities')]);if(live){setData({sessions:records.records,handouts:entities.entities.filter(e=>e.type==='HANDOUT').map(e=>({id:e.id,title:e.title,text:typeof e.content.text==='string'?e.content.text:''}))});setError('');}}
      catch(e){if(live){setData({sessions:[],handouts:[]});setError((e as Error).message);}}finally{busy=false;}
    };
    void load();window.addEventListener('focus',load);
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},10000);
    return()=>{live=false;window.removeEventListener('focus',load);window.clearInterval(timer);};
  },[a.id,a.campaignId,preview]);
  const visible=preview||data;
  return <div className={styles.player}>
    {!preview&&<header className={styles.playerTitle}><p className="eyebrow">DEIN SPIELTISCH</p><h1>Die aktuelle Nacht</h1><span>Szene, Reihenfolge und freigegebene Hinweise an einem Ort.</span></header>}
    {error&&<p role="alert" className={styles.notice}>Der Spielstand konnte nicht aktualisiert werden: {error}</p>}
    <SessionPanel key={visible.sessions.map(e=>e.id+':'+e.version).join(',')} entries={visible.sessions} a={{...a,gm:false,role:'player'}} onRefresh={onRefresh} compact/>
    <section className={styles.playerHandouts}><p className="eyebrow">FÜR DICH FREIGEGEBEN</p><h2>Hinweise & Handouts</h2>{visible.handouts.map(h=><article className={styles.handout} key={h.id}><h3>{h.title}</h3><p>{h.text||'Dieses Handout enthält keinen Text. Zugehörige Dateien findest du im Dokumentbereich.'}</p></article>)}{!error&&visible.handouts.length===0&&<p className={styles.muted}>Noch keine Hinweise freigegeben. Neue Freigaben erscheinen hier automatisch.</p>}</section>
    {!preview&&<p className={styles.sync}>Der sichtbare Spielstand wird alle zehn Sekunden und bei Rückkehr zum Fenster abgeglichen.</p>}
  </div>;
}
function GMCommandCenter({entries,a,onRefresh}:Props) {
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[error,setError]=useState('');
  const [open,setOpen]=useState<Tool[]>(['scene']),[parallel,setParallel]=useState(false),[selected,setSelected]=useState(''),[target,setTarget]=useState('group');
  const [sceneDirty,setSceneDirty]=useState(false);
  const [notesDirty,setNotesDirty]=useState(false),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
  const [preview,setPreview]=useState<PlayerData|null>(null),[sessionId,setSessionId]=useState('');
  const session=entries.find(e=>e.id===sessionId)||entries[0];
  async function reload(){try{setSnapshot(await api<Snapshot>('/api/command-center'));setError('');}catch(e){setError((e as Error).message);}}
  async function refresh(){onRefresh();await reload();if(preview){try{setPreview(await api<PlayerData>('/api/command-center?view=player'));}catch(e){setPreview(null);setError((e as Error).message);}}}
  async function showPreview(){if(preview){setPreview(null);return;}try{setPreview(await api<PlayerData>('/api/command-center?view=player'));setError('');}catch(e){setError((e as Error).message);}}
  useEffect(()=>{let live=true;api<Snapshot>('/api/command-center').then(data=>{if(live)setSnapshot(data);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[a.id,a.campaignId]);
  function focus(id:Tool){setOpen(current=>parallel?(current.includes(id)?current:[...current,id].slice(-2)):[id]);}
  async function grant(id:string,enabled:boolean){setSaving(true);setError('');try{await api('/api/knowledge','POST',{entityId:id,audience:target==='group'?'group':'player',...(target==='group'?{}:{playerId:target}),state:enabled?'DISCOVERED':'UNKNOWN'});await reload();setMessage(enabled?'Für die gewählte Zielgruppe freigegeben.':'Freigabe für die gewählte Zielgruppe zurückgezogen. Andere Freigaben bleiben bestehen.');}catch(e){setError((e as Error).message);}finally{setSaving(false);}}
  return <div className={styles.root}>
    <header className={styles.bar}><div><p className="eyebrow">{preview?'GRUPPENVORSCHAU':'SPIELLEITUNG · PRIVAT'}</p><h1>{preview?'Blick der Spielgruppe':'Regie der Nacht'}</h1><span>{preview?'Nur der serverseitig freigegebene Gruppenstand.':'Leite die Sitzung. Öffne nur, was du gerade brauchst.'}</span></div><div className={styles.actions}><button className="button" onClick={()=>void showPreview()}><Eye size={16}/>{preview?'Zur SL-Regie':'Gruppenansicht'}</button><button className="button" aria-label="Spielstand aktualisieren" onClick={()=>void refresh()}><RefreshCw size={16}/></button><a className={styles.prepare} href="/spielbereich?bereich=ortscms">Inhalte vorbereiten <ArrowUpRight size={15}/></a></div></header>
    {error&&<p role="alert" className={styles.notice}>{error}</p>}
    <div hidden={!preview}>{preview&&<><p className={styles.notice}>Gruppenvorschau · Private SL-Inhalte und persönliche Freigaben sind ausgeschlossen. Dies ersetzt keinen unabhängigen Spielerlogin.</p><PlayerSession entries={[]} a={a} onRefresh={onRefresh} preview={{...preview,sessions:preview.sessions.filter(e=>e.id===session?.id)}}/></>}</div>
    <div hidden={!!preview}>
      <div className={styles.roster}><span className={styles.rosterLabel}><Users size={16}/>Spielgruppe</span>{snapshot?.members.map(m=><button key={m.id} aria-pressed={selected===m.id} onClick={()=>{setSelected(m.id);focus('character');}}>{m.name}<small>{snapshot.characters.some(c=>c.ownerId===m.id)?'Charakter ansehen':'Kein geteilter Charakter'}</small></button>)}{snapshot?.members.length===0&&<span>Keine aktiven Mitglieder.</span>}</div>
      <div className={styles.toolbar}><nav className={styles.tools} aria-label="Regiewerkzeuge">{tools.map(t=><button key={t.id} aria-pressed={open.includes(t.id)} onClick={()=>focus(t.id)}><t.icon size={18}/><span>{t.label}</span>{t.id==='notes'&&notesDirty&&<span aria-label="Ungespeicherte Notizen">●</span>}</button>)}</nav><button className={styles.parallel} aria-pressed={parallel} onClick={()=>{setParallel(!parallel);if(parallel)setOpen(current=>current.slice(-1));}}><PanelsTopLeft size={16}/>Zwei Werkzeuge</button></div>
      <div className={`${styles.work} ${open.length===2?styles.split:''}`}>
        {tools.map(t=><section key={t.id} hidden={!open.includes(t.id)} className={styles.toolPanel} aria-label={t.label}>
          <div className={styles.heading}><h2><t.icon size={18}/>{t.label}</h2>{open.length>1&&<button aria-label={t.label+' schließen'} onClick={()=>setOpen(current=>current.filter(id=>id!==t.id))}>×</button>}</div>
          {t.id==='scene'&&<><label className={styles.sessionChoice}><span>Aktive Sitzung</span><select value={session?.id||''} onChange={e=>{if((notesDirty||sceneDirty)&&!confirm('Ungespeicherte Eingaben dieser Sitzung verwerfen?'))return;setNotesDirty(false);setSceneDirty(false);setSessionId(e.target.value);}}>{entries.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label><SessionPanel key={session?.id||'new'} entries={session?[session]:[]} a={a} onRefresh={onRefresh} compact onDraftChange={setSceneDirty}/></>}
          {t.id==='places'&&<CommandPlace key={session?.id||'new'} session={session} a={a} onRefresh={onRefresh}/>}
          {t.id==='dice'&&<DicePanel/>}
          {t.id==='character'&&<>{!selected?<p>Wähle oben ein Mitglied der Spielgruppe.</p>:<><div className={styles.context}><strong>{snapshot?.members.find(m=>m.id===selected)?.name}</strong><button className="button" onClick={()=>window.dispatchEvent(new CustomEvent('chroniplay:compose-message',{detail:selected}))}>Persönliche Nachricht</button><button className="button" onClick={()=>{setTarget(selected);focus('handouts');}}>Persönliches Handout</button></div>{snapshot?.characters.filter(c=>c.ownerId===selected).length?snapshot.characters.filter(c=>c.ownerId===selected).map(c=><CommandCharacter key={c.id} id={c.id}/>):<p>Kein für dich lesbarer Charakter zugeordnet. Private Charakterdaten bleiben geschützt.</p>}</>}</>}
          {t.id==='notes'&&<CommandNotes key={session?.id||'new'} session={session} onRefresh={onRefresh} onDirty={setNotesDirty}/>}
          {t.id==='handouts'&&<><label className="field"><span>Zielgruppe</span><select value={target} onChange={e=>setTarget(e.target.value)}><option value="group">Aktive Kampagnengruppe</option>{snapshot?.members.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</select></label><p className={styles.muted}>Freigaben gelten für die Kampagne, unabhängig von der Sitzung. Veröffentlichung und Rücknahme erfolgen ausdrücklich.</p>{snapshot?.handouts.map(h=>{const released=snapshot.grants.some(g=>g.entity_id===h.id&&g.subject_id===(target==='group'?a.campaignId:target)&&g.audience===(target==='group'?'group':'player')&&g.state!=='UNKNOWN');return <article key={h.id} className={styles.handout}><h3>{h.title}</h3><p>{h.text||'Kein Text hinterlegt. Medien verbleiben in der Dokumentverwaltung.'}</p><div className={styles.release}><span>{released?'Für diese Zielgruppe freigegeben':'Für diese Zielgruppe gesperrt'}</span>{h.revocable?<button className={released?'button':'button primary'} disabled={saving} onClick={()=>{if(released&&!confirm('Diese Wissensfreigabe für die ausgewählte Zielgruppe zurückziehen?'))return;void grant(h.id,!released);}}>{saving?'Wird aktualisiert …':released?'Freigabe zurückziehen':'Jetzt freigeben'}</button>:<span>Andere Sichtbarkeitsregeln können Zugriff erlauben. Im CMS verwalten.</span>}</div></article>;})}{snapshot?.handouts.length===0&&<p>Keine geeigneten Handouts vorhanden.</p>}</>}
        </section>)}
      </div>
      <footer className={styles.footer}><span role="status" aria-live="polite">{message||'Private Regie · Spieler sehen ausschließlich freigegebene Inhalte.'}</span></footer>
    </div>
  </div>;
}
