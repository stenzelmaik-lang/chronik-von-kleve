"use client";
/* eslint-disable @next/next/no-img-element -- GM-only thumbnails from the protected file store. */
import { authoringTextMax } from '@/domain/authoring-limits';
import {useEffect,useRef,useState} from 'react';
import {CloudFog,Mail,Eye,Send,Save,X} from 'lucide-react';
import {api} from '../api-client';
import type {SceneWhisper} from '@/domain/story-scene';
import {VISION_PRESETS,VISION_TEMPOS,MESSAGE_LAYOUTS,arrivalSoundLabel,mediaSectionOf,mediaSectionLabel,presetById,tempoById,type DeliveryRun} from '@/domain/personal-delivery';
import {richTextToPlainText} from '@/domain/location-rich-text';
import {RichTextView} from '../rich-text';
import type {PreparationFile} from '../protected-image-gallery';
import type {Snapshot} from './types';
import styles from './delivery-desk.module.css';

export type ComposeResult={runs?:DeliveryRun[];scene?:{id:string;version:number;whispers:SceneWhisper[]}};
type Player=Snapshot['crew'][number];

const clock=()=>new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
/** A fresh spontaneous entry; the same shape as a prepared one, so it can be kept in the scene later. */
export function blankEntry(kind:'vision'|'letter'):SceneWhisper{
 return {id:crypto.randomUUID(),kind,title:(kind==='vision'?'Spontane Vision ':'Spontane Botschaft ')+clock(),text:'',recipientIds:[],fileIds:[],...(kind==='vision'?{preset:'classic',tempo:'normal'}:{layout:'fax',sound:'builtin'})} as SceneWhisper;
}

/** Compact editor of the Regie: a new spontaneous entry, or an entry of this scene. Fast to fill during play. */
export function DeliveryComposer({mode,initial,players,sessionId,sceneId,onPreview,onDone,onClose}:{mode:'new'|'edit';initial:SceneWhisper;players:Player[];sessionId:string;sceneId:string;onPreview:(entry:SceneWhisper,names:string)=>void;onDone:(result:ComposeResult,message:string)=>void;onClose:()=>void}){
 const [entry,setEntry]=useState(initial);
 const [to,setTo]=useState<{mode:'all'|'players';ids:string[]}>(()=>{const present=initial.recipientIds.filter(id=>players.some(p=>p.id===id));return present.length?{mode:'players',ids:present}:{mode:'all',ids:[]};});
 const [save,setSave]=useState(mode==='edit');
 const [files,setFiles]=useState<PreparationFile[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const request=useRef('');
 useEffect(()=>{let live=true;void api<{files:PreparationFile[]}>('/api/files').then(r=>{if(live)setFiles(r.files||[]);}).catch(()=>undefined);return()=>{live=false;};},[]);
 // every change is a new intent; a double click or a retry of the same intent reuses its request id
 const change=(patch:Partial<SceneWhisper>)=>{request.current='';setEntry(e=>({...e,...patch}));};
 const choose=(next:{mode:'all'|'players';ids:string[]})=>{request.current='';setTo(next);};
 const section=mediaSectionOf(entry.kind);
 const images=files.filter(f=>f.section===section&&f.mime.startsWith('image/'));
 const sounds=files.filter(f=>f.mime.startsWith('audio/')&&(f.section===section||f.id===entry.audioFileId));
 const rich=entry.text.startsWith('cvk-');
 const recipients=to.mode==='all'?players:players.filter(p=>to.ids.includes(p.id));
 const names=recipients.map(p=>p.name).join(', ');
 const empty=!richTextToPlainText(entry.text).trim()&&!entry.fileIds.length&&!entry.fragments?.some(f=>f.trim());
 const final=():SceneWhisper=>({...entry,title:entry.title.trim()||blankEntry(entry.kind).title,recipientIds:to.mode==='players'?to.ids:[]});
 const soundValue=entry.kind==='vision'?entry.audioFileId||'':entry.audioFileId?'file:'+entry.audioFileId:entry.sound==='none'?'none':'builtin';
 function chooseSound(v:string){
  if(entry.kind==='vision')change({audioFileId:v||undefined});
  else change(v==='none'?{sound:'none',audioFileId:undefined}:v==='builtin'?{sound:'builtin',audioFileId:undefined}:{sound:'builtin',audioFileId:v.slice(5)});
 }
 async function send(action:'deliver'|'save'){
  if(busy)return;setBusy(true);setError('');
  try{
   if(action==='save'){const r=await api<ComposeResult>('/api/live-deliveries','POST',{action:'save-entry',sessionId,sceneId,entry:final()});onDone(r,'Gespeichert. Der Eintrag steht in dieser Szene bereit.');return;}
   if(!request.current)request.current=crypto.randomUUID();
   const r=await api<ComposeResult>('/api/live-deliveries','POST',{action:'compose',sessionId,requestId:request.current,sceneId,entry:final(),recipients:to.mode==='all'?{mode:'all'}:{mode:'players',playerIds:to.ids},save});
   onDone(r,(entry.kind==='vision'?'Vision ausgelöst':'Botschaft zugestellt')+' · '+(to.mode==='all'?'ganze Gruppe':names)+(save?' · in der Szene gespeichert':'')+'.');
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const label=mode==='edit'?'Eintrag bearbeiten':entry.kind==='vision'?'Neue Vision':'Neue Botschaft';
 return <section className={styles.composer} data-kind={entry.kind} aria-label={label}>
  <header><span className={styles.icon}>{entry.kind==='vision'?<CloudFog size={17}/>:<Mail size={17}/>}</span><h4>{label}</h4><button type="button" className={styles.close} aria-label="Editor schließen" onClick={onClose}><X size={16}/></button></header>
  {error&&<p className={styles.error} role="alert">{error}</p>}
  <div className={styles.fields}>
   <label>Titel (nur für dich)<input maxLength={160} value={entry.title} onChange={e=>change({title:e.target.value})}/></label>
   {entry.kind==='vision'?<>
    <label>Visionstyp<select value={presetById(entry.preset).id} onChange={e=>change({preset:e.target.value as SceneWhisper['preset']})}>{VISION_PRESETS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
    <label>Tempo<select value={tempoById(entry.tempo).id} onChange={e=>change({tempo:e.target.value as SceneWhisper['tempo']})}>{VISION_TEMPOS.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
   </>:<>
    <label>Darstellung<select value={entry.layout||'fax'} onChange={e=>change({layout:e.target.value as SceneWhisper['layout']})}>{MESSAGE_LAYOUTS.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
    <label>Absender<input maxLength={120} value={entry.sender||''} placeholder="optional, für Spieler sichtbar" onChange={e=>change({sender:e.target.value})}/></label>
   </>}
  </div>
  <fieldset className={styles.choice}><legend>Empfänger</legend>
   <label><input type="radio" name={'compose-to-'+entry.id} checked={to.mode==='all'} onChange={()=>choose({...to,mode:'all'})}/> Ganze Gruppe ({players.length})</label>
   <label><input type="radio" name={'compose-to-'+entry.id} checked={to.mode==='players'} onChange={()=>choose({...to,mode:'players'})}/> Auswahl</label>
   {to.mode==='players'&&<div className={styles.players}>{players.map(p=><label key={p.id}><input type="checkbox" checked={to.ids.includes(p.id)} onChange={()=>choose({...to,ids:to.ids.includes(p.id)?to.ids.filter(x=>x!==p.id):[...to.ids,p.id]})}/> {p.name}</label>)}{!players.length&&<span>Keine Spieler am Tisch.</span>}</div>}
  </fieldset>
  {rich?<div className={styles.richNote}><RichTextView value={entry.text} readable/><p>Formatierter Text aus der Szenenvorbereitung.</p><button type="button" onClick={()=>change({text:richTextToPlainText(entry.text)})}>Als einfachen Text bearbeiten</button></div>
   :<label className={styles.text}>{entry.kind==='vision'?'Text der Vision':'Text der Botschaft'}<textarea rows={5} maxLength={authoringTextMax} value={entry.text} placeholder={entry.kind==='vision'?'Jeder Absatz erscheint einzeln …':'Was soll der Spieler lesen?'} onChange={e=>change({text:e.target.value})}/></label>}
  {entry.kind==='vision'&&!!entry.fragments?.length&&<p className={styles.note}>Diese Vision nutzt {entry.fragments.length} eigene Textabschnitte aus der Szenenvorbereitung. Sie bleiben unverändert.</p>}
  <div className={styles.mediaPick} role="group" aria-label={'Bilder aus der Galerie '+mediaSectionLabel[section]}>
   {images.length?images.map(f=>{const on=entry.fileIds.includes(f.id);return <button key={f.id} type="button" aria-pressed={on} aria-label={(on?'Bild abwählen: ':'Bild verwenden: ')+f.name} disabled={!on&&entry.fileIds.length>=20} onClick={()=>change({fileIds:on?entry.fileIds.filter(x=>x!==f.id):[...entry.fileIds,f.id]})}><img src={'/api/files?id='+encodeURIComponent(f.id)+'&size=thumb'} alt="" loading="lazy"/></button>;})
    :<span className={styles.note}>Keine Bilder in der Galerie „{mediaSectionLabel[section]}“.</span>}
  </div>
  <label className={styles.sound}>{entry.kind==='vision'?'Ton oder Musik':'Geräusch beim Eintreffen'}<select value={soundValue} onChange={e=>chooseSound(e.target.value)}>
   {entry.kind==='vision'?<option value="">Kein Ton</option>:<><option value="builtin">{arrivalSoundLabel(entry.layout||'fax')+' (eingebaut)'}</option><option value="none">Kein Geräusch</option></>}
   {sounds.map(f=><option key={f.id} value={entry.kind==='vision'?f.id:'file:'+f.id}>{'Eigener Ton: '+f.name}</option>)}
  </select></label>
  {mode==='new'&&<label className={styles.keep}><input type="checkbox" checked={save} onChange={e=>{request.current='';setSave(e.target.checked);}}/> In dieser Szene speichern – später erneut verwendbar</label>}
  <div className={styles.actions}>
   <button type="button" disabled={empty} onClick={()=>onPreview(final(),names)}><Eye size={15}/> Vorschau auf meinem Tisch</button>
   <button type="button" className={styles.primary} disabled={busy||empty||!recipients.length} onClick={()=>void send('deliver')}><Send size={15}/> {(mode==='edit'?'Speichern & ':'Jetzt ')+(entry.kind==='vision'?'ausspielen':'zustellen')}</button>
   {(mode==='edit'||save)&&<button type="button" disabled={busy||empty} onClick={()=>void send('save')}><Save size={15}/> Nur speichern</button>}
   <button type="button" onClick={onClose}>Abbrechen</button>
  </div>
 </section>;
}
