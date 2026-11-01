'use client';
import {useRef,useState} from 'react';
import {W10_ATTRIBUTE_KEYS,W10_ABILITY_KEYS} from '@/domain/trait-ids';
import type {RegieContext,Snapshot} from './types';
import styles from './live-check-panel.module.css';

type Audience=string[]|null;
type Note=RegieContext['notes'][number];
const attributes=Object.entries(W10_ATTRIBUTE_KEYS),abilities=Object.entries(W10_ABILITY_KEYS);

/** The same private issuing control in the table Regie and its second-screen window. */
export function CheckIssueForm({sceneId,notes,crew,checksEnabled,busy,onIssue}:{sceneId:string;notes:Note[];crew:Snapshot['crew'];checksEnabled:boolean;busy:boolean;onIssue:(body:Record<string,unknown>,audience:Audience)=>Promise<boolean>}){
 const [title,setTitle]=useState(''),[difficulty,setDifficulty]=useState(6),[attributeId,setAttribute]=useState(''),[abilityId,setAbility]=useState(''),[hints,setHints]=useState(''),[audience,setAudience]=useState<Audience>(null),[working,setWorking]=useState(false),[error,setError]=useState(''),[issued,setIssued]=useState('');
 const flight=useRef(false),draft=useRef<{key:string;id:string}|null>(null);
 if(!checksEnabled)return null;
 const available=crew.filter(m=>m.role!=='gm'&&m.role!=='campaign_gm');
 const selected=audience?.filter(id=>available.some(m=>m.id===id))??null;
 const issue=async()=>{
  if(flight.current||!title.trim()||!Number.isInteger(difficulty)||difficulty<2||difficulty>10||selected!==null&&!selected.length)return;
  flight.current=true;setWorking(true);setError('');setIssued('');
  const key=JSON.stringify([sceneId,title.trim(),difficulty,attributeId,abilityId,hints.trim(),selected]);
  if(draft.current?.key!==key)draft.current={key,id:crypto.randomUUID()};
  const body={action:'requestCheck',eventId:draft.current.id,title:title.trim(),difficulty,...(attributeId?{attributeId}:{}),...(abilityId?{abilityId}:{}),...(hints.trim()?{gmHints:hints.trim()}:{}),...(sceneId?{sceneId}:{})};
  try{if(await onIssue(body,selected)){draft.current=null;setIssued(title.trim());setTitle('');setHints('');}else setError('Probe konnte nicht ausgegeben werden.');}
  catch(e){setError((e as Error).message);}finally{flight.current=false;setWorking(false);}
 };
 return <section className={styles.issue} aria-label="Charakterprobe ausgeben"><h3>Charakterprobe ausgeben</h3>
  <label>Vorbereitete Szeneprobe<select value="" onChange={e=>{const note=notes.find(n=>n.id===e.target.value);if(note){setTitle(note.title);setHints(note.text.slice(0,2000));}}}><option value="">Spontane Probe / Vorlage wählen</option>{notes.filter(n=>n.kind==='check').map(n=><option key={n.id} value={n.id}>{n.title}</option>)}</select></label>
  <label>Probe<input value={title} maxLength={160} onChange={e=>setTitle(e.target.value)} placeholder="z. B. Geschick + Handgemenge"/></label>
  <div className={styles.issueGrid}><label>Schwierigkeit<input type="number" min={2} max={10} value={difficulty} onChange={e=>setDifficulty(Number(e.target.value))}/></label><label>Attribut<select value={attributeId} onChange={e=>setAttribute(e.target.value)}><option value="">Spieler wählt</option>{attributes.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>Fähigkeit<select value={abilityId} onChange={e=>setAbility(e.target.value)}><option value="">Spieler wählt</option>{abilities.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label></div>
  <label>SL-Hinweis / mögliche Folge<textarea value={hints} maxLength={2000} onChange={e=>setHints(e.target.value)}/></label>
  <fieldset className={styles.issueAudience}><legend>Zielgruppe bestätigen</legend><label><input type="radio" checked={selected===null} onChange={()=>setAudience(null)}/> Ganze Runde</label><label><input type="radio" checked={selected!==null} onChange={()=>setAudience([])}/> Einzelne Spieler</label>{selected!==null&&available.map(m=><label key={m.id}><input type="checkbox" checked={selected.includes(m.id)} onChange={e=>setAudience(e.target.checked?[...selected,m.id]:selected.filter(id=>id!==m.id))}/>{m.name}</label>)}</fieldset>
  <p className={styles.issueHint}>SG {difficulty} · {selected===null?'ganze Runde':selected.length?selected.length+' Spieler':'keine Spieler'} · {attributeId?W10_ATTRIBUTE_KEYS[attributeId as keyof typeof W10_ATTRIBUTE_KEYS]:'Attributwahl frei'} + {abilityId?W10_ABILITY_KEYS[abilityId as keyof typeof W10_ABILITY_KEYS]:'Fähigkeitswahl frei'}. Hinweise bleiben privat.</p>
  <button type="button" disabled={busy||working||!title.trim()||!Number.isInteger(difficulty)||difficulty<2||difficulty>10||selected!==null&&!selected.length} onClick={()=>void issue()}>Probe ausgeben</button>
  {issued&&<p role="status">„{issued}“ ausgegeben.</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
