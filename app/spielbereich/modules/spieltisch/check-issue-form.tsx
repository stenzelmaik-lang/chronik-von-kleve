'use client';
import {useRef,useState} from 'react';
import {Dices} from 'lucide-react';
import {W10_ATTRIBUTE_KEYS,W10_ABILITY_KEYS} from '@/domain/trait-ids';
import {parsePreparedCheck,traitLine,isTablePlayer} from '@/domain/live-checks';
import {CheckProgressList} from './live-check-panel';
import type {DiceEvent,RegieContext,Snapshot} from './types';
import styles from './live-check-panel.module.css';

type Audience=string[]|null;
type Note=RegieContext['notes'][number];
type Figure={ownerId:string;title:string};
const attributes=Object.entries(W10_ATTRIBUTE_KEYS),abilities=Object.entries(W10_ABILITY_KEYS);

/** The same private issuing control in the table Regie and its second-screen window. */
export function CheckIssueForm({sceneId,notes,crew,figures,checksEnabled,busy,onIssue}:{sceneId:string;notes:Note[];crew:Snapshot['crew'];figures?:Figure[];checksEnabled:boolean;busy:boolean;onIssue:(body:Record<string,unknown>,audience:Audience)=>Promise<boolean>}){
 const [title,setTitle]=useState(''),[difficulty,setDifficulty]=useState(6),[attributeId,setAttribute]=useState(''),[abilityId,setAbility]=useState(''),[hints,setHints]=useState(''),[audience,setAudience]=useState<Audience>(null),[working,setWorking]=useState(false),[error,setError]=useState(''),[issued,setIssued]=useState(''),[prepared,setPrepared]=useState('');
 const flight=useRef(false),draft=useRef<{key:string;id:string}|null>(null);
 if(!checksEnabled)return null;
 const available=crew.filter(isTablePlayer);
 const selected=audience?.filter(id=>available.some(m=>m.id===id))??null;
 const valid=!!title.trim()&&Number.isInteger(difficulty)&&difficulty>=2&&difficulty<=10&&(selected===null||!!selected.length);
 // A prepared scene check fills title, traits and SG from its own wording; the GM only picks who rolls.
 const applyPrepared=(note:Note)=>{const plain=note.text.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(),parsed=parsePreparedCheck(note.title,plain);setPrepared(note.id);setTitle(note.title);setHints(plain.slice(0,2000));setAttribute(parsed.attributeId||'');setAbility(parsed.abilityId||'');setDifficulty(parsed.difficulty??6);setIssued('');setError('');};
 const toggle=(id:string)=>{const now=selected??[],next=now.includes(id)?now.filter(x=>x!==id):[...now,id];setAudience(next.length?next:null);};
 const issue=async()=>{
  if(flight.current||!valid)return;
  flight.current=true;setWorking(true);setError('');setIssued('');
  const key=JSON.stringify([sceneId,title.trim(),difficulty,attributeId,abilityId,hints.trim(),selected]);
  if(draft.current?.key!==key)draft.current={key,id:crypto.randomUUID()};
  const body={action:'requestCheck',eventId:draft.current.id,title:title.trim(),difficulty,...(attributeId?{attributeId}:{}),...(abilityId?{abilityId}:{}),...(hints.trim()?{gmHints:hints.trim()}:{}),...(sceneId?{sceneId}:{})};
  try{if(await onIssue(body,selected)){draft.current=null;setIssued(title.trim());setTitle('');setHints('');setPrepared('');}else setError('Probe konnte nicht ausgegeben werden.');}
  catch(e){setError((e as Error).message);}finally{flight.current=false;setWorking(false);}
 };
 const preparedChecks=notes.filter(n=>n.kind==='check');
 return <section className={styles.issue} aria-label="Neue Probe">
  <h3>Neue Probe</h3>
  {!!preparedChecks.length&&<fieldset className={styles.issueAudience}><legend>Vorbereitet in dieser Szene</legend>{preparedChecks.map(n=><button type="button" key={n.id} aria-pressed={prepared===n.id} onClick={()=>applyPrepared(n)}>{n.title}</button>)}</fieldset>}
  <label>Probe<input aria-label="Probe" value={title} maxLength={160} onChange={e=>setTitle(e.target.value)} placeholder="z. B. Schloss knacken"/></label>
  <div className={styles.issueGrid}><label>SG<input aria-label="SG" type="number" min={2} max={10} value={difficulty} onChange={e=>setDifficulty(Number(e.target.value))}/></label><label>Attribut<select aria-label="Attribut" value={attributeId} onChange={e=>setAttribute(e.target.value)}><option value="">Spieler wählt</option>{attributes.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>Fähigkeit<select aria-label="Fähigkeit" value={abilityId} onChange={e=>setAbility(e.target.value)}><option value="">Spieler wählt</option>{abilities.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label></div>
  <fieldset className={styles.issueAudience}><legend>Wer würfelt?</legend><button type="button" aria-pressed={selected===null} onClick={()=>setAudience(null)}>Ganze Runde</button>{available.map(m=>{const fig=figures?.find(f=>f.ownerId===m.id)?.title;return <button type="button" key={m.id} aria-pressed={!!selected?.includes(m.id)} onClick={()=>toggle(m.id)}>{m.name}{fig&&<small>{fig}</small>}</button>;})}</fieldset>
  <details open={!!hints||undefined}><summary>Privater SL-Hinweis</summary><textarea className={styles.hintField} aria-label="Privater SL-Hinweis" value={hints} maxLength={2000} onChange={e=>setHints(e.target.value)} placeholder="Nur für dich sichtbar"/></details>
  <p className={styles.issueHint}>{traitLine({attributeId,abilityId})} · SG {difficulty} · {selected===null?'ganze Runde':selected.map(id=>available.find(m=>m.id===id)?.name).join(', ')}</p>
  <button type="button" className={styles.primary} disabled={busy||working||!valid} onClick={()=>void issue()}><Dices size={16}/> Probe ausgeben</button>
  {issued&&<p role="status" className={styles.issueDone}>„{issued}“ ist ausgegeben. Die Würfe erscheinen unter „Laufende Proben“.</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}

/** The check desk of the Regie: issue a new check and follow every issued one live. */
export function CheckDesk({sceneId,notes,crew,figures,checks,events,checksEnabled,busy,onIssue,onShow}:{sceneId:string;notes:Note[];crew:Snapshot['crew'];figures?:Figure[];checks:NonNullable<Snapshot['checks']>;events:DiceEvent[];checksEnabled:boolean;busy:boolean;onIssue:(body:Record<string,unknown>,audience:Audience)=>Promise<boolean>;onShow?:(id:string)=>void}){
 if(!checksEnabled)return null;
 return <div className={styles.desk}><CheckIssueForm key={sceneId} sceneId={sceneId} notes={notes} crew={crew} figures={figures} checksEnabled={checksEnabled} busy={busy} onIssue={onIssue}/><h3 className={styles.deskTitle}>Laufende Proben</h3><CheckProgressList checks={checks} events={events} crew={crew} figures={figures} onShow={onShow}/></div>;
}
