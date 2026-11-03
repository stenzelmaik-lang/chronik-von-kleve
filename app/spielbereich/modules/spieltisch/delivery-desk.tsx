"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {CloudFog,Mail,Eye,Send,EyeOff,RotateCcw} from 'lucide-react';
import {api} from '../api-client';
import type {SceneWhisper} from '@/domain/story-scene';
import {deliveryStatus,statusLabel,presetById,MESSAGE_LAYOUTS,type DeliveryRun,type RecipientChoice} from '@/domain/personal-delivery';
import type {StageObject,Snapshot} from './types';
import {DeliveryPreview} from './delivery-stage';
import styles from './delivery-desk.module.css';

type Choice={mode:'prepared'|'all'|'players';ids:string[]};
type Props={items:SceneWhisper[];sceneId:string;version:number;sessionId:string;crew:Snapshot['crew'];objects:StageObject[];onCommand:(body:Record<string,unknown>)=>unknown};

/** Regie: prepared visions and messages of this scene, the trigger with its recipients, and every run with its receipts. */
export function DeliveryDesk({items,sceneId,version,sessionId,crew,objects,onCommand}:Props){
 const [runs,setRuns]=useState<DeliveryRun[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [choices,setChoices]=useState<Record<string,Choice>>({}),[preview,setPreview]=useState<SceneWhisper|null>(null);
 const requests=useRef(new Map<string,string>());
 const players=crew.filter(m=>!m.gm);
 const name=(id:string)=>crew.find(m=>m.id===id)?.name||'Nicht in dieser Runde';
 const load=useCallback(async()=>{try{setRuns((await api<{runs:DeliveryRun[]}>('/api/live-deliveries?sessionId='+encodeURIComponent(sessionId))).runs);setError('');}catch(e){setError((e as Error).message);}},[sessionId]);
 useEffect(()=>{queueMicrotask(()=>void load());const t=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},2500);return()=>window.clearInterval(t);},[load]);
 async function post(body:Record<string,unknown>,done:string){
  setBusy(true);
  try{const r=await api<{runs?:DeliveryRun[]}>('/api/live-deliveries','POST',{sessionId,...body});if(r.runs)setRuns(r.runs);setError('');setNotice(done);return true;}
  catch(e){setError((e as Error).message);return false;}finally{setBusy(false);}
 }
 // one request id per trigger intent: a double click or a retry after a lost answer never delivers twice
 async function deliver(w:SceneWhisper,recipients:RecipientChoice,key:string,done:string){
  if(!requests.current.has(key))requests.current.set(key,crypto.randomUUID());
  if(await post({action:'deliver',requestId:requests.current.get(key),sceneId,whisperId:w.id,sceneVersion:version,recipients},done))requests.current.delete(key);
 }
 const choiceOf=(w:SceneWhisper):Choice=>choices[w.id]||{mode:w.recipientIds.length?'prepared':'all',ids:[]};
 const setChoice=(w:SceneWhisper,c:Choice)=>setChoices(old=>({...old,[w.id]:c}));
 const toChoice=(c:Choice):RecipientChoice=>c.mode==='players'?{mode:'players',playerIds:c.ids}:{mode:c.mode};
 return <section className={styles.desk} aria-label="Visionen und persönliche Botschaften">
  <h3>Visionen &amp; persönliche Botschaften</h3>
  {error&&<p className={styles.error} role="alert">{error}</p>}
  {notice&&!error&&<p className={styles.notice} role="status">{notice}</p>}
  {!items.length&&<p className={styles.empty}>Noch nichts vorbereitet. Anlegen in Szenenschritt 6.</p>}
  {items.map(w=>{
   const c=choiceOf(w),own=runs.filter(r=>r.whisperId===w.id).slice(-5).reverse();
   const missing=w.recipientIds.filter(id=>!players.some(p=>p.id===id));
   const ready=c.mode==='all'?players.length>0:c.mode==='prepared'?w.recipientIds.length>0&&!missing.length:c.ids.length>0;
   const legacy=objects.find(o=>o.kind==='document'&&o.sourceId==='scene-whisper:'+sceneId+':'+w.id);
   const look=w.kind==='vision'?presetById(w.preset).label:(MESSAGE_LAYOUTS.find(l=>l.id===(w.layout||'fax'))?.label||'Fax / Dokument');
   return <article key={w.id} className={styles.item} data-kind={w.kind}>
    <header><span className={styles.icon}>{w.kind==='vision'?<CloudFog size={17}/>:<Mail size={17}/>}</span><div><h4>{w.title}</h4><small>{look}{w.recipientIds.length?' · vorgesehen für '+w.recipientIds.map(name).join(', '):''}</small></div></header>
    {w.note&&<p className={styles.note}>{w.note}</p>}
    <fieldset className={styles.choice}><legend>Empfänger</legend>
     <label><input type="radio" name={'to-'+w.id} checked={c.mode==='prepared'} disabled={!w.recipientIds.length} onChange={()=>setChoice(w,{...c,mode:'prepared'})}/> Vorgesehene</label>
     <label><input type="radio" name={'to-'+w.id} checked={c.mode==='all'} onChange={()=>setChoice(w,{...c,mode:'all'})}/> Ganze Gruppe ({players.length})</label>
     <label><input type="radio" name={'to-'+w.id} checked={c.mode==='players'} onChange={()=>setChoice(w,{...c,mode:'players'})}/> Auswahl</label>
     {c.mode==='players'&&<div className={styles.players}>{players.map(p=><label key={p.id}><input type="checkbox" checked={c.ids.includes(p.id)} onChange={()=>setChoice(w,{...c,ids:c.ids.includes(p.id)?c.ids.filter(x=>x!==p.id):[...c.ids,p.id]})}/> {p.name}</label>)}{!players.length&&<span>Keine Spieler am Tisch.</span>}</div>}
    </fieldset>
    {c.mode==='prepared'&&!!missing.length&&<p className={styles.error}>Nicht in dieser Runde: {missing.length} vorgesehene Person(en). Wähle „Auswahl“ oder passe die Vorbereitung an.</p>}
    <div className={styles.actions}>
     <button type="button" onClick={()=>setPreview(w)}><Eye size={15}/> Vorschau</button>
     <button type="button" className={styles.primary} disabled={busy||!ready} onClick={()=>void deliver(w,toChoice(c),w.id+':'+JSON.stringify(c),w.kind==='vision'?'Vision ausgelöst.':'Botschaft zugestellt.')}><Send size={15}/> {w.kind==='vision'?'Vision auslösen':'Botschaft zustellen'}</button>
     {legacy&&<button type="button" disabled={busy} onClick={()=>onCommand({action:'remove',id:legacy.id})}><EyeOff size={15}/> Ältere Tisch-Zustellung zurückziehen</button>}
    </div>
    {!!own.length&&<ol className={styles.runs} aria-label={'Zustellungen: '+w.title}>{own.map(r=>{const open=!r.withdrawnAt&&r.recipients.some(id=>!r.receipts[id]?.ackAt);return <li key={r.id} data-withdrawn={!!r.withdrawnAt||undefined}>
     <span className={styles.when}>{new Date(r.createdAt).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</span>
     <ul className={styles.receipts}>{r.recipients.map(id=>{const s=deliveryStatus(r,id);return <li key={id} data-status={s}><span>{name(id)}: {statusLabel[s]}</span>{(s==='acknowledged'||s==='withdrawn')&&players.some(p=>p.id===id)&&<button type="button" disabled={busy} aria-label={'Erneut an '+name(id)} onClick={()=>void deliver(w,{mode:'players',playerIds:[id]},w.id+':again:'+r.id+':'+id,'Erneut an '+name(id)+' gesendet.')}><RotateCcw size={13}/> erneut</button>}</li>;})}</ul>
     {open&&<button type="button" disabled={busy} onClick={()=>void post({action:'withdraw',runId:r.id},'Zurückgezogen. Die Vorbereitung bleibt erhalten.')}><EyeOff size={14}/> Zurückziehen</button>}
    </li>;})}</ol>}
   </article>;
  })}
  {preview&&<DeliveryPreview key={preview.id} whisper={preview} onClose={()=>setPreview(null)}/>}
 </section>;
}
