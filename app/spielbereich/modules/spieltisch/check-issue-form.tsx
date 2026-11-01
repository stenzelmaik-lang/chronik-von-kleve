'use client';
import {useRef,useState} from 'react';
import {Dices,SlidersHorizontal} from 'lucide-react';
import {W10_ATTRIBUTE_KEYS,W10_ABILITY_KEYS} from '@/domain/trait-ids';
import {parsePreparedCheck,traitLine,isTablePlayer,checkRequestBody,type CheckSpec} from '@/domain/live-checks';
import {CheckProgressList} from './live-check-panel';
import type {DiceEvent,RegieContext,Snapshot} from './types';
import styles from './live-check-panel.module.css';

type Audience=string[]|null;
type Note=RegieContext['notes'][number];
type Figure={id:string;ownerId:string;title:string};
type Checks=NonNullable<Snapshot['checks']>;
const attributes=Object.entries(W10_ATTRIBUTE_KEYS),abilities=Object.entries(W10_ABILITY_KEYS);
const plain=(html:string)=>html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();

/** A prepared scene check as a ready spec: structured fields first, the old free-text wording only as fallback. */
function preparedSpec(note:Note,sceneId:string):CheckSpec{
 const c=note.check,parsed=c?{}:parsePreparedCheck(note.title,plain(note.text));
 return {title:note.title,difficulty:c?.difficulty??parsed.difficulty??6,attributeId:c?.attributeId||parsed.attributeId||'',abilityId:c?.abilityId||parsed.abilityId||'',hints:c?'':plain(note.text).slice(0,2000),targetCharacterIds:c?.targetCharacterIds||[],consequences:c?.consequences,preparedId:note.id,sceneId};
}

/**
 * The one issuing control of the Regie (table and second screen). Prepared and spontaneous checks build the same spec
 * and leave through the same requestCheck; there is no second path.
 */
export function CheckIssueForm({sceneId,notes,crew,figures=[],checks=[],checksEnabled,busy,onIssue}:{sceneId:string;notes:Note[];crew:Snapshot['crew'];figures?:Figure[];checks?:Checks;checksEnabled:boolean;busy:boolean;onIssue:(body:Record<string,unknown>,audience:Audience)=>Promise<boolean>}){
 const [title,setTitle]=useState(''),[difficulty,setDifficulty]=useState(6),[attributeId,setAttribute]=useState(''),[abilityId,setAbility]=useState(''),[hints,setHints]=useState(''),[targets,setTargets]=useState<string[]>([]),[prepared,setPrepared]=useState<CheckSpec|null>(null);
 const [working,setWorking]=useState(false),[error,setError]=useState(''),[issued,setIssued]=useState('');
 const flight=useRef(false),draft=useRef<{key:string;id:string}|null>(null);
 if(!checksEnabled)return null;
 const players=crew.filter(isTablePlayer),atTable=figures.filter(f=>players.some(p=>p.id===f.ownerId));
 const figureName=(id:string)=>figures.find(f=>f.id===id)?.title||'Figur';
 const send=async(spec:CheckSpec)=>{
  if(flight.current)return false;
  const key=JSON.stringify(spec);if(draft.current?.key!==key)draft.current={key,id:crypto.randomUUID()};
  flight.current=true;setWorking(true);setError('');setIssued('');
  try{if(await onIssue(checkRequestBody(spec,draft.current.id),null)){draft.current=null;setIssued(spec.title||traitLine(spec));return true;}setError('Probe konnte nicht ausgegeben werden.');return false;}
  catch(e){setError((e as Error).message);return false;}finally{flight.current=false;setWorking(false);}
 };
 const load=(spec:CheckSpec)=>{setPrepared(spec);setTitle(spec.title);setDifficulty(spec.difficulty);setAttribute(spec.attributeId);setAbility(spec.abilityId);setHints(spec.hints||'');setTargets(spec.targetCharacterIds.filter(id=>atTable.some(f=>f.id===id)));setIssued('');setError('');};
 const toggle=(id:string)=>setTargets(t=>t.includes(id)?t.filter(x=>x!==id):[...t,id]);
 const valid=Number.isInteger(difficulty)&&difficulty>=2&&difficulty<=10;
 const spec:CheckSpec={...(prepared||{}),title:title.trim(),difficulty,attributeId,abilityId,hints:hints.trim(),targetCharacterIds:targets,sceneId,consequences:prepared?.consequences,preparedId:prepared?.preparedId};
 const issueForm=async()=>{if(valid&&await send(spec)){setTitle('');setHints('');setTargets([]);setAttribute('');setAbility('');setPrepared(null);}};
 const preparedChecks=notes.filter(n=>n.kind==='check');
 return <section className={styles.issue} aria-label="Neue Probe">
  {!!preparedChecks.length&&<div className={styles.prepared}><h3>Vorbereitete Proben</h3><ul aria-label="Vorbereitete Proben">{preparedChecks.map(n=>{const p=preparedSpec(n,sceneId),ready=p.targetCharacterIds.filter(id=>atTable.some(f=>f.id===id)),done=checks.some(c=>c.preparedId===n.id);return <li key={n.id} data-issued={done||undefined}>
   <span><strong>{n.title}</strong><small>{traitLine(p)} · SG {p.difficulty}{ready.length?' · '+ready.map(figureName).join(', '):p.targetCharacterIds.length?' · vorgesehene Figur nicht am Tisch':' · Figur live wählen'}{done?' · bereits ausgegeben':''}</small></span>
   <span className={styles.preparedActions}><button type="button" aria-label={'Anpassen: '+n.title} title="In das Formular übernehmen" onClick={()=>load(p)}><SlidersHorizontal size={15}/></button>{ready.length?<button type="button" className={styles.primary} disabled={busy||working} onClick={()=>void send({...p,targetCharacterIds:ready})}>Ausgeben</button>:<button type="button" onClick={()=>load(p)}>Figur wählen</button>}</span>
  </li>;})}</ul></div>}
  <h3>Neue Probe{prepared?<small> · aus „{prepared.title}“</small>:null}</h3>
  <fieldset className={styles.issueAudience}><legend>Wer würfelt?</legend><button type="button" aria-pressed={!targets.length} onClick={()=>setTargets([])}>Ganze Runde</button>{atTable.map(f=><button type="button" key={f.id} aria-pressed={targets.includes(f.id)} onClick={()=>toggle(f.id)}>{f.title}<small>{players.find(p=>p.id===f.ownerId)?.name}</small></button>)}</fieldset>
  <div className={styles.issueGrid}><label>SG<input aria-label="SG" type="number" min={2} max={10} value={difficulty} onChange={e=>setDifficulty(Number(e.target.value))}/></label><label>Attribut<select aria-label="Attribut" value={attributeId} onChange={e=>setAttribute(e.target.value)}><option value="">Spieler wählt</option>{attributes.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>Fähigkeit<select aria-label="Fähigkeit" value={abilityId} onChange={e=>setAbility(e.target.value)}><option value="">Spieler wählt</option>{abilities.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label></div>
  <label>Bezeichnung (optional)<input aria-label="Probe" value={title} maxLength={160} onChange={e=>setTitle(e.target.value)} placeholder={traitLine({attributeId,abilityId})==='Attribut frei + Fähigkeit frei'?'Probe':traitLine({attributeId,abilityId})}/></label>
  <details open={!!hints||undefined}><summary>Privater SL-Hinweis</summary><textarea className={styles.hintField} aria-label="Privater SL-Hinweis" value={hints} maxLength={2000} onChange={e=>setHints(e.target.value)} placeholder="Nur für dich sichtbar"/></details>
  <p className={styles.issueHint}>{traitLine({attributeId,abilityId})} · SG {difficulty} · {targets.length?targets.map(figureName).join(', '):'ganze Runde'}</p>
  <button type="button" className={styles.primary} disabled={busy||working||!valid} onClick={()=>void issueForm()}><Dices size={16}/> Probe ausgeben</button>
  {issued&&<p role="status" className={styles.issueDone}>„{issued}“ ist ausgegeben. Die Würfe erscheinen unter „Laufende Proben“.</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}

/** The check desk of the Regie: prepared and spontaneous checks in one place, and every issued one live. */
export function CheckDesk({sceneId,notes,crew,figures,checks,events,checksEnabled,busy,onIssue,onShow}:{sceneId:string;notes:Note[];crew:Snapshot['crew'];figures?:Figure[];checks:Checks;events:DiceEvent[];checksEnabled:boolean;busy:boolean;onIssue:(body:Record<string,unknown>,audience:Audience)=>Promise<boolean>;onShow?:(id:string)=>void}){
 if(!checksEnabled)return null;
 return <div className={styles.desk}><CheckIssueForm key={sceneId} sceneId={sceneId} notes={notes} crew={crew} figures={figures} checks={checks} checksEnabled={checksEnabled} busy={busy} onIssue={onIssue}/><h3 className={styles.deskTitle}>Laufende Proben</h3><CheckProgressList checks={checks} events={events} crew={crew} figures={figures} onShow={onShow}/></div>;
}
