'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {Check,Dices,Eye} from 'lucide-react';
import {attributeLabel,abilityLabel,checkProgress,focusCheck,pendingChecks,traitLine,isTablePlayer} from '@/domain/live-checks';
import type {CharacterDetailProjection} from '../character';
import {api} from '../api-client';
import {CharacterReadOnly} from './character-readonly';
import type {DiceEvent,Snapshot} from './types';
import styles from './live-check-panel.module.css';

type Preview={status:'ready'|'blocked';code?:string;message?:string;pool?:{effective:number};difficulty?:{effective:number};provenance?:{label:string;amount:number}[];specialties?:{id:string;name:string;applicable:boolean}[]};
type SheetResponse={projection:CharacterDetailProjection|null};
type Check=NonNullable<Snapshot['checks']>[number];
const signed=(n:number)=>(n>=0?'+':'')+n;
export const rollOutcome=(e:DiceEvent)=>e.result.outcome==='botch'?'Patzer':e.result.outcome==='success'?e.result.netSuccesses+(e.result.netSuccesses===1?' Erfolg':' Erfolge'):'Fehlschlag';

/**
 * The player's character check inside the own character sheet (top bar → own name → Charakterbogen).
 * The player picks or confirms traits in the sheet; the server derives the W10 pool; only then the player rolls.
 * Without an addressed check it renders `fallback`, so the sheet stays the plain read-only sheet.
 */
export function PlayerCheck({snapshot,send,busy,showRoll,onSeen,fallback}:{snapshot:Snapshot;send:(body:Record<string,unknown>)=>Promise<Snapshot>;busy:boolean;showRoll:(id:string)=>void;onSeen?:(checkId:string)=>void;fallback:ReactNode}){
 const me=snapshot.principal.id,checks=snapshot.checks||[],rolls=snapshot.dice.events;
 const open=pendingChecks(me,checks,rolls);
 const [checkId,setCheckId]=useState(''),[selection,setSelection]=useState<{attributeId?:string;abilityId?:string;specialtyId?:string}>({}),[confirmed,setConfirmed]=useState({attributeId:false,abilityId:false});
 const [characterId,setCharacterId]=useState(''),[sheet,setSheet]=useState<CharacterDetailProjection|null>(null),[loaded,setLoaded]=useState(false),[preview,setPreview]=useState<Preview|null>(null),[error,setError]=useState(''),[pending,setPending]=useState<string|null>(null),[working,setWorking]=useState(false);
 const check=checks.find(c=>c.id===checkId)||focusCheck(me,checks,rolls);
 const completed=check?rolls.find(e=>e.checkRef?.requestId===check.id&&e.authorId===me):undefined;
 const attr=completed?.checkRef?.selection.attributeId||check?.attributeId||selection.attributeId,ability=completed?.checkRef?.selection.abilityId||check?.abilityId||selection.abilityId;
 const attrConfirmed=!!completed||(check?.attributeId?confirmed.attributeId:!!selection.attributeId),abilityConfirmed=!!completed||(check?.abilityId?confirmed.abilityId:true);
 const ready=attrConfirmed&&abilityConfirmed;
 // Opening the sheet with a check counts as reading its notice.
 useEffect(()=>{if(check)onSeen?.(check.id);},[check?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- Once per shown check.
 useEffect(()=>{queueMicrotask(()=>{setSelection({});setConfirmed({attributeId:false,abilityId:false});setPreview(null);setPending(null);setError('');});},[check?.id]);
 useEffect(()=>{let active=true;api<{characterId:string|null}>('/api/character-selection').then(async chosen=>{if(!active)return;setCharacterId(chosen.characterId||'');setSheet(null);if(chosen.characterId){const result=await api<SheetResponse>('/api/live-participants?sessionId='+encodeURIComponent(snapshot.sessionId)+'&memberId='+encodeURIComponent(me)+'&view=sheet&characterId='+encodeURIComponent(chosen.characterId));if(active)setSheet(result.projection);}if(active)setLoaded(true);}).catch(e=>{if(active){setError(e.message);setLoaded(true);}});return()=>{active=false;};},[snapshot.sessionId,me]);
 useEffect(()=>{if(!check||!characterId||!attr||completed||!ready){queueMicrotask(()=>setPreview(null));return;}let active=true;const selected={attributeId:attr,...(ability?{abilityId:ability}:{}),...(selection.specialtyId?{specialtyId:selection.specialtyId}:{})};api<Preview>('/api/live-table','POST',{action:'previewCheck',sessionId:snapshot.sessionId,runId:snapshot.runId,requestId:check.id,characterId,selection:selected}).then(p=>{if(active)setPreview(p);}).catch(e=>{if(active){setPreview(null);setError(e.message);}});return()=>{active=false;};},[check,characterId,attr,ability,selection.specialtyId,snapshot.sessionId,snapshot.runId,completed,ready]);
 if(!check)return <>{fallback}</>;
 const select=(part:'attributeId'|'abilityId',id:string)=>{if(completed)return;if(check[part]){if(id===check[part])setConfirmed(s=>({...s,[part]:!s[part]}));return;}setSelection(s=>({...s,[part]:s[part]===id?undefined:id,specialtyId:undefined}));setPending(null);};
 const roll=async()=>{if(completed||!characterId||!attr||!ready||preview?.status!=='ready')return;const eventId=pending||crypto.randomUUID();setPending(eventId);setWorking(true);setError('');try{const next=await send({action:'rollCheck',eventId,requestId:check.id,characterId,selection:{attributeId:attr,...(ability?{abilityId:ability}:{}),...(selection.specialtyId?{specialtyId:selection.specialtyId}:{})}});setPending(null);showRoll(eventId);if(!next.dice.events.some(e=>e.id===eventId))setError('Wurf gespeichert; Anzeige wird aktualisiert.');}catch(e){setError((e as Error).message);}finally{setWorking(false);}};
 const step=(label:string,value:string,done:boolean)=><li data-done={done}>{done?<Check size={14} aria-hidden/>:<span aria-hidden className={styles.dot}/>}<span>{label}</span><b>{value||'im Bogen wählen'}</b></li>;
 const pool=completed?completed.roll.pool:preview?.status==='ready'?preview.pool?.effective:undefined,target=completed?completed.roll.target:preview?.status==='ready'?preview.difficulty?.effective:check.difficulty;
 const specialties=!completed&&preview?.status==='ready'?preview.specialties?.filter(s=>s.applicable)||[]:[];
 return <section className={styles.panel} aria-label="Charakterprobe" data-state={completed?'done':'pending'}>
  <div className={styles.checkBar} role="group" aria-label="Aktive Charakterprobe">
   <p className={styles.kicker}>{completed?'Wurf abgeschlossen':'Probe ausstehend'}{open.length>1?' · '+open.length+' Proben offen':''}</p>
   {checks.length>1&&<label className={styles.checkChoice}><span>Charakterprobe</span><select value={check.id} onChange={e=>setCheckId(e.target.value)}>{[...checks].reverse().map(c=><option key={c.id} value={c.id}>{c.title}{open.some(o=>o.id===c.id)?' · ausstehend':' · abgeschlossen'}</option>)}</select></label>}
   <strong>{check.title}</strong>
   <ol className={styles.steps}>{step('Attribut',attributeLabel(attr),attrConfirmed)}{step('Fähigkeit',abilityLabel(ability)||(attrConfirmed&&!check.abilityId&&!completed?'keine oder im Bogen wählen':''),abilityConfirmed&&!!ability||!!completed)}</ol>
   <p className={styles.pool}><span>{pool!==undefined?<><b>{pool} W10</b> · SG {target}</>:<>SG {check.difficulty}{preview?.status==='blocked'?' · kein Wurf möglich':ready?' · Pool wird berechnet':''}</>}</span>{!completed&&preview?.status==='ready'&&<small>{preview.provenance?.map(p=>p.label+' '+signed(p.amount)).join(' · ')}</small>}{completed&&<small>{rollOutcome(completed)} · {completed.roll.dice.join(' · ')}</small>}</p>
   {specialties.length>0&&<label className={styles.checkChoice}><span>Spezialisierung</span><select value={selection.specialtyId||''} onChange={e=>setSelection(s=>({...s,specialtyId:e.target.value||undefined}))}><option value="">Keine</option>{specialties.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
   {preview?.status==='blocked'&&<p role="status" className={styles.blocked}>{preview.message||'Mit diesem Bogen ist die Probe so nicht möglich.'}</p>}
   <button className={styles.rollButton} disabled={busy||working||!completed&&(!ready||preview?.status!=='ready')} onClick={()=>completed?showRoll(completed.id):void roll()}>{completed?<><Eye size={16}/> Ergebnis ansehen</>:<><Dices size={16}/> {ready?'Würfeln':'Werte im Bogen wählen'}</>}</button>
   {error&&<p role="alert">{error}</p>}
  </div>
  {!completed&&<p className={styles.selectionHint}>{check.attributeId||check.abilityId?'Tippe die markierten Werte im Bogen an, um sie zu bestätigen.':'Wähle Attribut und Fähigkeit im Bogen.'}</p>}
  {!loaded?<p role="status">Charakterbogen wird geladen …</p>:!characterId?<p>Bitte zuerst eine aktive Figur wählen.</p>:sheet?<CharacterReadOnly projection={sheet} checkSelection={{attributeId:attrConfirmed?attr:undefined,abilityId:abilityConfirmed?ability:undefined}} checkPreset={{attributeId:check.attributeId,abilityId:check.abilityId}} onCheckSelect={select} selectionLocked={!!completed}/>:<p>Kein berechtigter Charakterbogen vorhanden.</p>}
 </section>;
}

/** The GM's synchronous view of issued checks: who still has to roll, who rolled with which result. */
export function CheckProgressList({checks,events,crew,figures,onShow,limit=6}:{checks:Check[];events:DiceEvent[];crew:Snapshot['crew'];figures?:{id?:string;ownerId:string;title:string}[];onShow?:(id:string)=>void;limit?:number}){
 const players=crew.filter(isTablePlayer);
 if(!checks.length)return <p className={styles.emptyState}>Noch keine Probe ausgegeben.</p>;
 return <ol className={styles.progress} aria-label="Ausgegebene Proben">{[...checks].reverse().slice(0,limit).map(c=>{const p=checkProgress(c,events,players.map(m=>m.id));return <li key={c.id} data-done={p.done}>
  <header><strong>{c.title}</strong><span>{p.done?'Wurf abgeschlossen':p.targets.length?p.rolled+' von '+p.targets.length+' gewürfelt':'Keine Spieler am Tisch'}</span></header>
  <small>{traitLine(c)} · SG {c.difficulty}</small>
  <ul>{p.targets.map(t=>{const roll=events.find(e=>e.id===t.rollId),name=crew.find(m=>m.id===t.playerId)?.name||'Spieler',own=figures?.filter(f=>f.ownerId===t.playerId)||[],fig=(own.find(f=>f.id&&f.id===(roll?.checkRef?.characterId||c.targetCharacterIds?.find(id=>own.some(o=>o.id===id))))||own[0])?.title,follow=roll&&c.consequences?.[roll.result.outcome];return <li key={t.playerId} data-rolled={!!roll}><span>{name}{fig?' · '+fig:''}</span>{roll?onShow?<button type="button" onClick={()=>onShow(roll.id)}>{rollOutcome(roll)} · ansehen</button>:<b>{rollOutcome(roll)}</b>:<em>Probe ausstehend</em>}{follow&&<p className={styles.consequence}>Folge: {follow}</p>}</li>;})}</ul>
 </li>;})}</ol>;
}
