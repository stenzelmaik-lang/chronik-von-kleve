"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated GM media must never use a public optimization proxy. */
import {useEffect,useState} from 'react';
import {Eye,UserPlus,FilePlus2,Image as ImageIcon,Lock} from 'lucide-react';
import {api} from '../api-client';
import {RichTextView} from '../rich-text';
import type {RegieContext} from './types';
import styles from './regie.module.css';

export const regieTabs=[['narration','Erzählung'],['atmosphere','Atmosphäre'],['dialogue','Dialoge'],['interactions','Interaktionen'],['secrets','Geheimnisse'],['consequences','Folgen'],['notes','SL-Notizen'],['material','Material']] as const;
export type RegieTab=typeof regieTabs[number][0];

type Props={sessionId:string;sceneId:string;tab:RegieTab;onTab:(tab:RegieTab)=>void;busy:boolean;audience:string;
 onShowScene:(id:string)=>void;onShowMedia:(fileId:string)=>void;onStage:(kind:'npc'|'document',sourceId:string)=>void};

function Text({value,empty}:{value:string;empty:string}){return value.trim()?<RichTextView value={value} readable flowing className={styles.prose}/>:<p className={styles.empty}>{empty}</p>;}

/** Private direction drawer. Reading never publishes; every release is a separate, labelled action. */
export function Regie({sessionId,sceneId,tab,onTab,busy,audience,onShowScene,onShowMedia,onStage}:Props){
 // Loaded scenes stay cached for the evening: switching back costs no request.
 const [contexts,setContexts]=useState<Record<string,RegieContext>>({}),[failed,setFailed]=useState<{id:string;message:string}|null>(null);
 const known=!!contexts[sceneId];
 useEffect(()=>{
  if(!sceneId||known)return;
  let current=true;
  api<RegieContext>('/api/live-stage?sessionId='+encodeURIComponent(sessionId)+'&regie='+encodeURIComponent(sceneId))
   .then(context=>{if(current)setContexts(old=>({...old,[sceneId]:context}));})
   .catch(issue=>{if(current)setFailed({id:sceneId,message:(issue as Error).message});});
  return()=>{current=false;};
 },[sessionId,sceneId,known]);
 if(!sceneId)return <p className={styles.empty}>Wähle unter „Szenen“ eine Szene dieses Spielabends und öffne ihre Regie. Hier liest du privat – die Spieler sehen nichts davon.</p>;
 // Content derives only from the requested scene id, never from a previously open scene.
 const context=contexts[sceneId];
 if(failed?.id===sceneId&&!context)return <p role="alert">{failed.message}</p>;
 if(!context)return <p role="status">Regie wird geladen …</p>;
 const s=context.scene;
 return <div className={styles.regie} data-scene={s.id}>
  <div className={styles.privacy}><Lock size={14}/> Privat · nur Spielleitung</div>
  <h2 className={styles.title}>{s.title}</h2>
  {context.place&&<p className={styles.place}>Schauplatz: {context.place.title}</p>}
  <div className={styles.tabs} role="tablist" aria-label="Regiebereiche">{regieTabs.map(([id,label])=><button key={id} role="tab" id={'regie-tab-'+id} aria-selected={tab===id} aria-controls="regie-panel" onClick={()=>onTab(id)}>{label}</button>)}</div>
  <section id="regie-panel" role="tabpanel" aria-labelledby={'regie-tab-'+tab} className={styles.panel} key={s.id+':'+tab}>
   {tab==='narration'&&<><Text value={s.narration} empty="Kein Erzähltext vorbereitet."/>{s.narration.trim()&&<button className={styles.release} disabled={busy} onClick={()=>onShowScene(s.id)}><Eye/> Erzählung zeigen · {audience}</button>}</>}
   {tab==='atmosphere'&&<Text value={s.atmosphere} empty="Keine Atmosphäre vorbereitet."/>}
   {tab==='dialogue'&&<>{context.npcs.map(n=><article key={n.id} className={styles.npc}><img src={n.image} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display='none';}}/><div><h3>{n.title}</h3>{n.summary&&<p>{n.summary}</p>}{n.cue&&<Text value={n.cue} empty=""/>}<button disabled={busy} onClick={()=>onStage('npc',n.id)}><UserPlus/> Privat auf Bühne legen</button></div></article>)}
    <Text value={s.dialogueNotes} empty={context.npcs.length?'Keine zusätzlichen Dialoghilfen.':'Keine NPCs oder Dialoge vorbereitet.'}/></>}
   {tab==='interactions'&&<><Text value={s.interactions} empty="Keine Interaktionen beschrieben."/>{context.notes.map(n=><article key={n.id} className={styles.note}><h3>{n.title}</h3><Text value={n.text} empty=""/></article>)}</>}
   {tab==='secrets'&&<><Text value={s.secrets} empty="Keine Geheimnisse hinterlegt."/>{s.visions.trim()&&<><h3>Visionen</h3><Text value={s.visions} empty=""/></>}</>}
   {tab==='consequences'&&<><Text value={s.possibleConsequences} empty="Keine Folgen vorbereitet."/>{s.possibilities.map(p=><article key={p.id} className={styles.note}><h3>{p.title}</h3><p>{p.text}</p></article>)}</>}
   {tab==='notes'&&<Text value={s.gmNotes} empty="Keine SL-Notizen."/>}
   {tab==='material'&&<>{!context.media.length&&!context.handouts.length&&<p className={styles.empty}>Kein Material mit dieser Szene verknüpft.</p>}
    <div className={styles.gallery}>{context.media.map(m=><article key={m.id}>{m.mime.startsWith('image/')?<img src={'/api/files?id='+encodeURIComponent(m.fileId)} alt="" loading="lazy"/>:<div className={styles.fileIcon}><ImageIcon/><small>{m.mime}</small></div>}<h3>{m.title}</h3><button disabled={busy} onClick={()=>onShowMedia(m.fileId)}><Eye/> Zeigen · {audience}</button></article>)}</div>
    {context.handouts.map(h=><article key={h.id} className={styles.note}><h3>{h.title}</h3>{h.stageable?<button disabled={busy} onClick={()=>onStage('document',h.id)}><FilePlus2/> Privat auf Bühne legen</button>:<p className={styles.empty}>Hinweisakte – Freigabe über die Spielwelt.</p>}</article>)}</>}
  </section>
 </div>;
}
