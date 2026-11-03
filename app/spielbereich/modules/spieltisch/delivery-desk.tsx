"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {CloudFog,Mail,Eye,Send,EyeOff,RotateCcw,ChevronDown,Pencil,Plus,Save,Trash2} from 'lucide-react';
import {api} from '../api-client';
import type {SceneWhisper} from '@/domain/story-scene';
import {deliveryStatus,statusLabel,presetById,MESSAGE_LAYOUTS,type DeliveryRun,type DeliveryStatus,type RecipientChoice} from '@/domain/personal-delivery';
import type {StageObject,Snapshot} from './types';
import {DeliveryPreview,previewDelivery} from './delivery-stage';
import {previewOnTable} from './delivery-preview-channel';
import {DeliveryComposer,blankEntry,type ComposeResult} from './delivery-compose';
import styles from './delivery-desk.module.css';

type Choice={mode:'prepared'|'all'|'players';ids:string[]};
type Props={items:SceneWhisper[];sceneId:string;version:number;sessionId:string;crew:Snapshot['crew'];objects:StageObject[];onCommand:(body:Record<string,unknown>)=>unknown};
type Composer={mode:'new'|'edit';entry:SceneWhisper};

const time=(iso:string)=>new Date(iso).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
const lookOf=(w:{kind:string;preset?:string;layout?:string})=>w.kind==='vision'?presetById(w.preset).label:(MESSAGE_LAYOUTS.find(l=>l.id===(w.layout||'fax'))?.label||'Fax / Dokument');
/** One line for the folded row: when it went out last and how far each recipient got. */
function summary(list:DeliveryRun[]):{text:string;state:'idle'|'active'|'done'|'withdrawn'}{
 const r=list.at(-1);
 if(!r)return {text:'noch nicht ausgespielt',state:'idle'};
 if(r.withdrawnAt)return {text:time(r.createdAt)+' · zurückgezogen',state:'withdrawn'};
 const counts=new Map<DeliveryStatus,number>();for(const id of r.recipients){const s=deliveryStatus(r,id);counts.set(s,(counts.get(s)||0)+1);}
 const text=(['running','pending','acknowledged','withdrawn'] as DeliveryStatus[]).filter(s=>counts.get(s)).map(s=>statusLabel[s]+' '+counts.get(s)).join(' · ');
 return {text:time(r.createdAt)+' · '+text,state:counts.get('running')||counts.get('pending')?'active':'done'};
}
/** A spontaneous run carries its whole content; this turns it back into an entry to resend or to keep. */
function entryOf(r:DeliveryRun):SceneWhisper{
 return {id:r.whisperId,kind:r.kind,title:r.title,text:r.html,recipientIds:r.recipients,fileIds:r.imageFileIds,...(r.audioFileId?{audioFileId:r.audioFileId}:{}),
  ...(r.kind==='vision'?{preset:r.preset,...(r.tempo?{tempo:r.tempo}:{})}:{layout:r.layout,...(r.sender?{sender:r.sender}:{}),...(r.sound?{sound:r.sound}:{})})};
}

/** The last runs of one entry with a status per recipient; resend to one player or withdraw an open run. */
function RunList({list,title,busy,name,canResend,onAgain,onWithdraw}:{list:DeliveryRun[];title:string;busy:boolean;name:(id:string)=>string;canResend:(id:string)=>boolean;onAgain:(r:DeliveryRun,id:string)=>void;onWithdraw:(r:DeliveryRun)=>void}){
 if(!list.length)return null;
 return <ol className={styles.runs} aria-label={'Zustellungen: '+title}>{list.slice(-5).reverse().map(r=>{const active=!r.withdrawnAt&&r.recipients.some(id=>!r.receipts[id]?.ackAt);return <li key={r.id} data-withdrawn={!!r.withdrawnAt||undefined}>
  <span className={styles.when}>{time(r.createdAt)}</span>
  <ul className={styles.receipts}>{r.recipients.map(id=>{const s=deliveryStatus(r,id);return <li key={id} data-status={s}><span>{name(id)}: {statusLabel[s]}</span>{(s==='acknowledged'||s==='withdrawn')&&canResend(id)&&<button type="button" disabled={busy} aria-label={'Erneut an '+name(id)} onClick={()=>onAgain(r,id)}><RotateCcw size={13}/> erneut</button>}</li>;})}</ul>
  {active&&<button type="button" disabled={busy} onClick={()=>onWithdraw(r)}><EyeOff size={14}/> Zurückziehen</button>}
 </li>;})}</ol>;
}

/** Regie: prepared and spontaneous visions and messages, folded to one line each; details, trigger and receipts on demand. */
export function DeliveryDesk({items:prepared,sceneId,version:preparedVersion,sessionId,crew,objects,onCommand}:Props){
 const [runs,setRuns]=useState<DeliveryRun[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [choices,setChoices]=useState<Record<string,Choice>>({}),[preview,setPreview]=useState<{entry:SceneWhisper;names:string}|null>(null);
 const [open,setOpen]=useState<string[]>([]),[composer,setComposer]=useState<Composer|null>(null),[removing,setRemoving]=useState('');
 const [offer,setOffer]=useState<{entry:SceneWhisper;names:string}|null>(null);
 // entries saved from the Regie: newer than the scene context the Regie loaded at the start
 const [local,setLocal]=useState<{sceneId:string;version:number;whispers:SceneWhisper[]}|null>(null);
 const fresh=local&&local.sceneId===sceneId&&local.version>=preparedVersion?local:null;
 const items=fresh?fresh.whispers:prepared,version=fresh?fresh.version:preparedVersion;
 const requests=useRef(new Map<string,string>());
 const players=crew.filter(m=>!m.gm);
 const name=(id:string)=>crew.find(m=>m.id===id)?.name||'Nicht in dieser Runde';
 const load=useCallback(async()=>{try{setRuns((await api<{runs:DeliveryRun[]}>('/api/live-deliveries?sessionId='+encodeURIComponent(sessionId))).runs);setError('');}catch(e){setError((e as Error).message);}},[sessionId]);
 useEffect(()=>{queueMicrotask(()=>void load());const t=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},2500);return()=>window.clearInterval(t);},[load]);
 const isOpen=(id:string)=>open.includes(id);
 const toggle=(id:string)=>setOpen(o=>o.includes(id)?o.filter(x=>x!==id):[...o,id]);
 const fold=(id:string)=>setOpen(o=>o.filter(x=>x!==id));
 function apply(r:ComposeResult){if(r.runs)setRuns(r.runs);if(r.scene&&r.scene.id===sceneId)setLocal({sceneId,version:r.scene.version,whispers:r.scene.whispers});}
 async function post(body:Record<string,unknown>,done:string){
  setBusy(true);
  try{apply(await api<ComposeResult>('/api/live-deliveries','POST',{sessionId,...body}));setError('');setNotice(done);return true;}
  catch(e){setError((e as Error).message);return false;}finally{setBusy(false);}
 }
 // one request id per trigger intent: a double click or a retry after a lost answer never delivers twice
 async function once(key:string,body:Record<string,unknown>,done:string){
  if(!requests.current.has(key))requests.current.set(key,crypto.randomUUID());
  const ok=await post({...body,requestId:requests.current.get(key)},done);
  if(ok)requests.current.delete(key);
  return ok;
 }
 async function deliver(w:SceneWhisper,recipients:RecipientChoice,key:string,done:string){
  if(await once(key,{action:'deliver',sceneId,whisperId:w.id,sceneVersion:version,recipients},done))fold(w.id);
 }
 const resendLoose=(r:DeliveryRun,id:string)=>once(r.whisperId+':again:'+r.id+':'+id,{action:'compose',sceneId,entry:entryOf(r),recipients:{mode:'players',playerIds:[id]},save:false},'Erneut an '+name(id)+' gesendet.');
 // preview on the GM's own table: instantly in the same browser, otherwise via the GM-only preview value on the next poll
 async function showPreview(entry:SceneWhisper,names:string){
  setError('');setOffer(null);
  const id=crypto.randomUUID(),recipientName=names||'Empfänger (Vorschau)';
  const relayed=api('/api/live-deliveries','POST',{action:'preview',sessionId,previewId:id,entry,recipientName}).then(()=>true,(e:Error)=>{setError(e.message);return false;});
  if(await previewOnTable(sessionId,previewDelivery(entry),recipientName,id)){setNotice('Vorschau läuft auf deinem Spieltisch. Niemand sonst sieht sie, nichts wird zugestellt.');return;}
  if(await relayed){setNotice('Vorschau an deinen Spieltisch geschickt – sie erscheint dort in ein bis zwei Sekunden. Niemand sonst sieht sie, nichts wird zugestellt.');setOffer({entry,names});}
  else setPreview({entry,names});
 }
 async function remove(id:string,done:string){if(await post({action:'remove-entry',sceneId,whisperId:id},done)){setRemoving('');fold(id);}}
 const confirmRemove=(id:string,question:string,label:string)=>removing===id&&<div className={styles.confirm} role="group" aria-label="Löschen bestätigen"><span>{question}</span><button type="button" className={styles.danger} disabled={busy} onClick={()=>void remove(id,'Gelöscht.')}><Trash2 size={14}/> {label}</button><button type="button" onClick={()=>setRemoving('')}>Behalten</button></div>;
 const choiceOf=(w:SceneWhisper):Choice=>choices[w.id]||{mode:w.recipientIds.length?'prepared':'all',ids:[]};
 const setChoice=(w:SceneWhisper,c:Choice)=>setChoices(old=>({...old,[w.id]:c}));
 const toChoice=(c:Choice):RecipientChoice=>c.mode==='players'?{mode:'players',playerIds:c.ids}:{mode:c.mode};
 const namesOf=(c:Choice,w:SceneWhisper)=>(c.mode==='all'?players.map(p=>p.id):c.mode==='prepared'?w.recipientIds:c.ids).map(name).join(', ');
 const composed=(r:ComposeResult,message:string)=>{apply(r);setError('');setNotice(message);if(composer)fold(composer.entry.id);setComposer(null);};
 const composerFor=(c:Composer)=><DeliveryComposer key={c.entry.id+':'+c.mode} mode={c.mode} initial={c.entry} players={players} sessionId={sessionId} sceneId={sceneId} onPreview={(e,n)=>void showPreview(e,n)} onDone={composed} onClose={()=>setComposer(null)}/>;
 const known=new Set(items.map(w=>w.id));
 const loose=[...new Set(runs.filter(r=>r.sceneId===sceneId&&!known.has(r.whisperId)).map(r=>r.whisperId))].reverse().slice(0,12).map(id=>runs.filter(r=>r.whisperId===id));
 const canResend=(id:string)=>players.some(p=>p.id===id);
 const withdraw=(r:DeliveryRun)=>void post({action:'withdraw',runId:r.id},'Zurückgezogen. Die Vorbereitung bleibt erhalten.');
 const row=(id:string,kind:string,title:string,look:string,list:DeliveryRun[],extra?:string)=>{const s=summary(list);return <header className={styles.row} onClick={e=>{if(!(e.target as HTMLElement).closest('button'))toggle(id);}}>
  <span className={styles.icon}>{kind==='vision'?<CloudFog size={17}/>:<Mail size={17}/>}</span>
  <div className={styles.head}><h4>{title}</h4><small>{look}{extra||''}</small></div>
  <span className={styles.status} data-state={s.state}>{s.text}</span>
  <button type="button" className={styles.toggle} aria-expanded={isOpen(id)} aria-label={(isOpen(id)?'Einklappen: ':'Aufklappen: ')+title} onClick={()=>toggle(id)}><ChevronDown size={16}/></button>
 </header>;};
 return <section className={styles.desk} aria-label="Visionen und persönliche Botschaften">
  <div className={styles.top}><h3>Visionen &amp; persönliche Botschaften</h3>
   <div className={styles.actions}><button type="button" onClick={()=>setComposer({mode:'new',entry:blankEntry('vision')})}><Plus size={15}/> Neue Vision</button><button type="button" onClick={()=>setComposer({mode:'new',entry:blankEntry('letter')})}><Plus size={15}/> Neue Botschaft</button></div>
  </div>
  {error&&<p className={styles.error} role="alert">{error}</p>}
  {notice&&!error&&<p className={styles.notice} role="status">{notice}{offer&&<> <button type="button" className={styles.inline} onClick={()=>{setPreview(offer);setOffer(null);}}>Stattdessen hier ansehen</button></>}</p>}
  {composer?.mode==='new'&&composerFor(composer)}
  {!items.length&&!loose.length&&<p className={styles.empty}>Noch nichts vorbereitet. Lege spontan etwas an oder bereite es in Szenenschritt 6 vor.</p>}
  {!!items.length&&<div className={styles.group} role="group" aria-label="Vorbereitet in dieser Szene">{items.map(w=>{
   const c=choiceOf(w),own=runs.filter(r=>r.whisperId===w.id);
   const missing=w.recipientIds.filter(id=>!players.some(p=>p.id===id));
   const ready=c.mode==='all'?players.length>0:c.mode==='prepared'?w.recipientIds.length>0&&!missing.length:c.ids.length>0;
   const legacy=objects.find(o=>o.kind==='document'&&o.sourceId==='scene-whisper:'+sceneId+':'+w.id);
   const editing=composer?.mode==='edit'&&composer.entry.id===w.id;
   return <article key={w.id} className={styles.item} data-kind={w.kind} data-open={isOpen(w.id)||undefined}>
    {row(w.id,w.kind,w.title,lookOf(w),own,w.recipientIds.length?' · vorgesehen für '+w.recipientIds.map(name).join(', '):'')}
    {isOpen(w.id)&&(editing?composerFor(composer):<div className={styles.body}>
     {w.note&&<p className={styles.note}>{w.note}</p>}
     <fieldset className={styles.choice}><legend>Empfänger</legend>
      <label><input type="radio" name={'to-'+w.id} checked={c.mode==='prepared'} disabled={!w.recipientIds.length} onChange={()=>setChoice(w,{...c,mode:'prepared'})}/> Vorgesehene</label>
      <label><input type="radio" name={'to-'+w.id} checked={c.mode==='all'} onChange={()=>setChoice(w,{...c,mode:'all'})}/> Ganze Gruppe ({players.length})</label>
      <label><input type="radio" name={'to-'+w.id} checked={c.mode==='players'} onChange={()=>setChoice(w,{...c,mode:'players'})}/> Auswahl</label>
      {c.mode==='players'&&<div className={styles.players}>{players.map(p=><label key={p.id}><input type="checkbox" checked={c.ids.includes(p.id)} onChange={()=>setChoice(w,{...c,ids:c.ids.includes(p.id)?c.ids.filter(x=>x!==p.id):[...c.ids,p.id]})}/> {p.name}</label>)}{!players.length&&<span>Keine Spieler am Tisch.</span>}</div>}
     </fieldset>
     {confirmRemove(w.id,'Diesen Eintrag löschen? Er verschwindet aus der Szene und aus dieser Liste. Noch offene Zustellungen enden bei den Spielern.','Endgültig löschen')}
     {c.mode==='prepared'&&!!missing.length&&<p className={styles.error}>Nicht in dieser Runde: {missing.length} vorgesehene Person(en). Wähle „Auswahl“ oder passe die Vorbereitung an.</p>}
     <div className={styles.actions}>
      <button type="button" onClick={()=>void showPreview(w,namesOf(c,w))}><Eye size={15}/> Vorschau</button>
      <button type="button" className={styles.primary} disabled={busy||!ready} onClick={()=>void deliver(w,toChoice(c),w.id+':'+JSON.stringify(c),w.kind==='vision'?'Vision ausgelöst.':'Botschaft zugestellt.')}><Send size={15}/> {w.kind==='vision'?'Vision auslösen':'Botschaft zustellen'}</button>
      <button type="button" onClick={()=>setComposer({mode:'edit',entry:w})}><Pencil size={15}/> Bearbeiten</button>
      <button type="button" onClick={()=>setRemoving(w.id)}><Trash2 size={15}/> Löschen</button>
      {legacy&&<button type="button" disabled={busy} onClick={()=>onCommand({action:'remove',id:legacy.id})}><EyeOff size={15}/> Ältere Tisch-Zustellung zurückziehen</button>}
     </div>
     <RunList list={own} title={w.title} busy={busy} name={name} canResend={canResend} onWithdraw={withdraw} onAgain={(r,id)=>void deliver(w,{mode:'players',playerIds:[id]},w.id+':again:'+r.id+':'+id,'Erneut an '+name(id)+' gesendet.')}/>
    </div>)}
   </article>;
  })}</div>}
  {!!loose.length&&<div className={styles.group} role="group" aria-labelledby={'loose-'+sceneId}><h4 className={styles.section} id={'loose-'+sceneId}>Spontan ausgespielt</h4>
  {loose.map(list=>{const r=list.at(-1)!,id=r.whisperId;return <article key={id} className={styles.item} data-kind={r.kind} data-open={isOpen(id)||undefined}>
   {row(id,r.kind,r.title,lookOf(r),list,' · nicht gespeichert')}
   {isOpen(id)&&<div className={styles.body}>
    <div className={styles.actions}>
     <button type="button" onClick={()=>void showPreview(entryOf(r),r.recipients.map(name).join(', '))}><Eye size={15}/> Vorschau</button>
     <button type="button" disabled={busy} onClick={()=>void post({action:'save-entry',sceneId,entry:entryOf(r)},'Gespeichert. Der Eintrag steht in dieser Szene bereit.')}><Save size={15}/> In der Szene speichern</button>
     <button type="button" onClick={()=>setRemoving(id)}><Trash2 size={15}/> Entfernen</button>
    </div>
    {confirmRemove(id,'Aus der Liste entfernen? Noch offene Zustellungen enden bei den Spielern.','Entfernen')}
    <RunList list={list} title={r.title} busy={busy} name={name} canResend={canResend} onWithdraw={withdraw} onAgain={(run,pid)=>void resendLoose(run,pid)}/>
   </div>}
  </article>;})}</div>}
  {preview&&<DeliveryPreview key={preview.entry.id+preview.names} whisper={preview.entry} recipientName={preview.names} onClose={()=>setPreview(null)}/>}
 </section>;
}
