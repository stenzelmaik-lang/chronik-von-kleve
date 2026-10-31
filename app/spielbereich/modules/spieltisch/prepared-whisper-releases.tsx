"use client";
import {CloudFog,Mail,EyeOff} from 'lucide-react';
import type {SceneWhisper} from '@/domain/story-scene';
import type {StageObject,Snapshot} from './types';
import {RichTextView} from '../rich-text';
import styles from './regie.module.css';

export function PreparedWhisperReleases({items,sceneId,version,objects,crew,busy,onCommand}:{items:SceneWhisper[];sceneId:string;version:number;objects:StageObject[];crew:Snapshot['crew'];busy:boolean;onCommand:(body:Record<string,unknown>)=>unknown}){
 return <section aria-label="Vorbereitete Visionen und Botschaften"><h3>Visionen &amp; persönliche Botschaften</h3>{!items.length&&<p className={styles.empty}>Noch keine einzelnen Inhalte vorbereitet. Anlegen in Szenenschritt 6.</p>}{items.map(w=>{
  const sourceId='scene-whisper:'+sceneId+':'+w.id,placed=objects.find(o=>o.kind==='document'&&o.sourceId===sourceId),missing=w.recipientIds.some(id=>!crew.some(m=>m.id===id));
  return <article key={w.id} className={styles.note}><h4>{w.kind==='vision'?<CloudFog size={16}/>:<Mail size={16}/>} {w.title}</h4><p>Nur für: {w.recipientIds.map(id=>crew.find(m=>m.id===id)?.name||'Nicht in dieser Runde').join(', ')||'Noch niemand'}</p><RichTextView value={w.text} readable flowing/>{!!w.fileIds.length&&<p>{w.fileIds.length} vorbereitete Bilder</p>}
   {missing&&<p role="status">Mindestens ein Empfänger ist nicht in dieser Runde. Bitte die Vorbereitung anpassen.</p>}
   <button type="button" className={styles.release} disabled={busy||!w.recipientIds.length||missing||!!placed} onClick={()=>onCommand({action:'add',kind:'document',sourceKind:'record',sourceId,sourceVersion:version})}>{w.kind==='vision'?<CloudFog size={16}/>:<Mail size={16}/>} {placed?'Bereits auf dem Tisch':w.kind==='vision'?'Vision ausspielen':'Brief zustellen'}</button>
   {placed&&<button type="button" disabled={busy} onClick={()=>onCommand({action:'remove',id:placed.id})}><EyeOff size={15}/> Zurückziehen</button>}
  </article>;
 })}</section>;
}
