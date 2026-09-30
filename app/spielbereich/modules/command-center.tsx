"use client";
import { useEffect, useState } from 'react';
import { Clapperboard, MapPin, Users, NotebookPen, ScrollText, Radio, RefreshCw, Eye, Dices } from 'lucide-react';
import type { Actor, Entity } from '@/domain/types';
import type { Entry } from '@/domain/legacy';
import { commandCenterAllowed } from '@/domain/command-center';
import { api } from './api-client';
import { SessionPanel } from './session';
import { CommandPlace } from './command-place';
import { DicePanel } from './dice';
import { CommandCharacter } from './command-character';
import styles from './command-center.module.css';

type Snapshot={campaignId:string;members:{id:string;name:string}[];characters:{id:string;title:string;ownerId:string}[];handouts:{id:string;title:string;text:string;revocable:boolean;legacy:boolean}[];grants:{entity_id:string;audience:string;subject_id:string;state:string}[]};
const tools=[{id:'character',label:'Charakterkontext',icon:Users},{id:'scene',label:'Sitzungsregie',icon:Clapperboard},{id:'places',label:'Schauplätze',icon:MapPin},{id:'handouts',label:'Handouts',icon:ScrollText},{id:'notes',label:'Private Notizen',icon:NotebookPen},{id:'dice',label:'Würfel',icon:Dices}] as const;
type Tool=typeof tools[number]['id'];
export function CommandCenter({entries,a,onRefresh}:{entries:Entry[];a:Actor;onRefresh:()=>void}) {
  if(!commandCenterAllowed(a))return <PlayerSession entries={entries} a={a} onRefresh={onRefresh}/>;
  return <GMCommandCenter entries={entries} a={a} onRefresh={onRefresh}/>;
}
function PlayerSession({entries,a,onRefresh}:{entries:Entry[];a:Actor;onRefresh:()=>void}) {
  const [handouts,setHandouts]=useState<Entity[]>([]),[error,setError]=useState('');
  useEffect(()=>{
    let live=true;
    const load=()=>api<{entities:Entity[]}>('/api/entities').then(data=>{if(live){setHandouts(data.entities.filter(e=>e.type==='HANDOUT'));setError('');}}).catch(e=>{if(live){setHandouts([]);setError(e.message);}});
    void load();
    window.addEventListener('focus',load);
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},10000);
    return()=>{live=false;window.removeEventListener('focus',load);window.clearInterval(timer);};
  },[a.id,a.campaignId]);
  return <><SessionPanel entries={entries} a={a} onRefresh={onRefresh}/><section className="panel"><h3>Deine freigegebenen Handouts</h3><p>Aktualisiert bei Rückkehr zum Fenster und während der Sitzung alle zehn Sekunden.</p>{error&&<p role="alert">{error}</p>}{handouts.map(h=><article className={styles.handout} key={h.id}><h4>{h.title}</h4><p>{typeof h.content.text==='string'?h.content.text:'Kein Text verfügbar. Verknüpfte Dateien verbleiben im vorhandenen Dokumentbereich.'}</p></article>)}{!error&&handouts.length===0&&<p>Derzeit keine Handouts für dich freigegeben.</p>}</section></>;
}
function GMCommandCenter({entries,a,onRefresh}:{entries:Entry[];a:Actor;onRefresh:()=>void}) {
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[error,setError]=useState('');
  const [open,setOpen]=useState<Tool[]>(['scene']),[selected,setSelected]=useState(''),[target,setTarget]=useState('group');
  const [notes,setNotes]=useState<string|null>(null),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
  const [preview,setPreview]=useState(false);
  const [previewEntries,setPreviewEntries]=useState<Entry[]>([]);
  const [sessionId,setSessionId]=useState('');
  const session=entries.find(e=>e.id===sessionId)||entries[0];
  const savedNotes=session?.gmBody||'';
  const dirty=notes!==null && notes!==savedNotes;
  async function reload(){try{setSnapshot(await api<Snapshot>('/api/command-center'));setError('');}catch(e){setError((e as Error).message);}}
  async function showPreview(){if(preview){setPreview(false);return;}try{const data=await api<{sessions:Entry[]}>('/api/command-center?view=player');setPreviewEntries(data.sessions);setPreview(true);}catch(e){setError((e as Error).message);}}
  useEffect(()=>{let live=true;api<Snapshot>('/api/command-center').then(data=>{if(live)setSnapshot(data);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[a.id,a.campaignId]);
  function toggle(id:Tool){setOpen(current=>current.includes(id)?current.filter(t=>t!==id):[...current,id].slice(-2));}
  async function saveNotes(){if(!session?.id){setMessage('Bitte zuerst eine Sitzung in der Regie speichern.');return;}setSaving(true);try{await api('/api/records','POST',{id:session.id,version:session.version,kind:'sitzungen',title:session.title,visibility:session.visibility,body:session.body,gmBody:notes??savedNotes});setMessage('Private Notizen dauerhaft gespeichert.');setNotes(null);onRefresh();}catch(e){setMessage((e as Error).message);}finally{setSaving(false);}}
  async function grant(id:string,enabled:boolean){setSaving(true);try{await api('/api/knowledge','POST',{entityId:id,audience:target==='group'?'group':'player',...(target==='group'?{}:{playerId:target}),state:enabled?'DISCOVERED':'UNKNOWN'});await reload();setMessage(enabled?'Für die gewählte Zielgruppe freigegeben.':'Freigabe für die gewählte Zielgruppe zurückgezogen. Andere Freigaben bleiben bestehen.');}catch(e){setMessage((e as Error).message);}finally{setSaving(false);}}
  return <div className={styles.root}>
    <header className={styles.bar}><div><p className="eyebrow">CHRONIK VON KLEVE · SPIELLEITUNG</p><h2>Regie der Nacht</h2><span>{String(session?.body.scene||session?.title||'Noch keine aktive Sitzung')} · {String(session?.body.status||'Vorbereitung')}</span></div><div className={styles.actions}><button className="button" onClick={()=>void showPreview()}><Eye size={16}/>{preview?'Zur SL-Regie':'Spieleransicht'}</button><button className="button" onClick={()=>{void reload();onRefresh();}}><RefreshCw size={16}/>Aktualisieren</button></div></header>
    <div hidden={!preview}><p className={styles.notice}>Spieleransicht: Serverseitig gefilterter Gruppenstand der Sitzung. Persönliche Freigaben hier nicht simuliert.</p><SessionPanel key={previewEntries.map(e=>e.id+':'+e.version).join(',')} entries={previewEntries.filter(e=>e.id===session?.id)} a={{...a,gm:false,role:'player'}} onRefresh={onRefresh}/></div><div hidden={preview}>
    {error&&<p role="alert" className={styles.notice}>{error}</p>}
    <div className={styles.roster}><Users size={18}/><span>Spielgruppe</span>{snapshot?.members.map(m=><button key={m.id} aria-pressed={selected===m.id} onClick={()=>{setSelected(m.id);setOpen(current=>current.includes('character')?current:[...current,'character' as Tool].slice(-2));}}>{m.name}<small>{snapshot.characters.filter(c=>c.ownerId===m.id).map(c=>c.title).join(', ')||'Kein zugeordneter Charakter'}</small></button>)}{snapshot?.members.length===0&&<span>Keine aktiven Mitglieder.</span>}<small>Verbindungsstatus nicht verfügbar</small></div>
    {selected&&<div className={styles.context}><strong>{snapshot?.members.find(m=>m.id===selected)?.name}</strong>{snapshot?.characters.filter(c=>c.ownerId===selected).map(c=><a key={c.id} href={'/spielbereich?bereich=charaktere'} target="_blank" rel="noopener noreferrer">{c.title} · vorhandenen Charakterbereich öffnen ↗</a>)}<button className="button" onClick={()=>{setTarget(selected);setOpen(current=>current.includes('handouts')?current:[...current,'handouts' as Tool].slice(-2));}}>Handout gezielt vorbereiten</button></div>}
    <div className={styles.layout}><nav className={styles.tools} aria-label="Regiewerkzeuge">{tools.map(t=><button key={t.id} aria-pressed={open.includes(t.id)} onClick={()=>toggle(t.id)}><t.icon size={22}/><span>{t.label}</span></button>)}</nav><div className={`${styles.work} ${open.length===2?styles.split:''}`}>
    {open.length===0&&<div className={styles.empty}><Radio size={42}/><h3>Raum für deine Geschichte</h3><p>Öffne links das Werkzeug, das du jetzt brauchst. Zwei Werkzeuge können parallel geöffnet sein.</p></div>}
    {tools.map(t=><section key={t.id} hidden={!open.includes(t.id)} className={styles.toolPanel}><div className={styles.heading}><h3>{t.label}</h3><button aria-label={t.label+' schließen'} onClick={()=>toggle(t.id)}>×</button></div>
      {t.id==='scene'&&<><label className="field"><span>Sitzung auswählen</span><select value={session?.id||''} onChange={e=>{if(dirty&&!confirm('Ungespeicherte private Notizen verwerfen?'))return;setNotes(null);setSessionId(e.target.value);}}>{entries.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label><SessionPanel key={session?.id||'new'} entries={session?[session]:[]} a={a} onRefresh={onRefresh}/></>}
      {t.id==='places'&&<CommandPlace key={session?.id||'new'} session={session} a={a} onRefresh={onRefresh}/>}
      {t.id==='dice'&&<DicePanel/>}
      {t.id==='character'&&<>{!selected?<p>Wähle oben einen Spieler.</p>:snapshot?.characters.filter(c=>c.ownerId===selected).length?<>{snapshot.characters.filter(c=>c.ownerId===selected).map(c=><CommandCharacter key={c.id} id={c.id}/>)}</>:<p>Diesem Spieler ist noch kein Charakter zugeordnet.</p>}</>}
      {t.id==='notes'&&<><p>Nur für die Spielleitung · mit der gewählten Sitzung gespeichert</p><label className="field"><span>Private Regieinformationen</span><textarea rows={12} value={notes??savedNotes} onChange={e=>setNotes(e.target.value)}/></label><p>{dirty?'Ungespeicherte Änderungen':'Gespeicherter Stand'}</p><button className="button primary" disabled={saving||!dirty} onClick={()=>void saveNotes()}>Notizen speichern</button></>}
      {t.id==='handouts'&&<><label className="field"><span>Ausdrückliche Zielgruppe</span><select value={target} onChange={e=>setTarget(e.target.value)}><option value="group">Aktive Kampagnengruppe</option>{snapshot?.members.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</select></label><p>Wissensfreigaben gelten kampagnenweit. Sie sind nicht auf die ausgewählte Sitzung begrenzt.</p>{snapshot?.handouts.map(h=>{const released=snapshot.grants.some(g=>g.entity_id===h.id&&g.subject_id===(target==='group'?a.campaignId:target)&&g.audience===(target==='group'?'group':'player')&&g.state!=='UNKNOWN');return <article key={h.id} className={styles.handout}><h4>{h.title}</h4><p>{h.text||'Kein Text hinterlegt. Medien bleiben in der bestehenden Dokumentverwaltung.'}</p><p>{released?'Zielgruppe hat eine Wissensfreigabe':'Keine Wissensfreigabe für diese Zielgruppe'}</p>{h.revocable?<div className={styles.actions}><button className="button primary" disabled={saving||released} onClick={()=>void grant(h.id,true)}>Freigeben</button><button className="button" disabled={saving||!released} onClick={()=>void grant(h.id,false)}>Zurückziehen</button></div>:<p>Bestehende Sichtbarkeit: Zugriff kann unabhängig von Wissensfreigaben bestehen. Bitte im vorhandenen CMS verwalten.</p>}</article>;})}{snapshot?.handouts.length===0&&<p>Keine geeigneten Handouts vorhanden. Es werden keine Demo-Inhalte angelegt.</p>}</>}
    </section>)}
    </div></div>
    <footer className={styles.footer}><span role="status" aria-live="polite">{message||'Private Regie · vorhandene ChroniPlay-Datenquellen'}</span><details><summary>Sitzungsverlauf</summary>{Array.isArray(session?.body.log)&&session.body.log.map((e:{id:string;text:string;time:string})=><p key={e.id}>{e.time} · {e.text}</p>)}</details></footer>
    </div>
  </div>;
}


