"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from '../api-client';
import {visionFragments,presetById,type PlayerDelivery} from '@/domain/personal-delivery';
import {richTextFileIds,richTextToPlainText} from '@/domain/location-rich-text';
import type {SceneWhisper} from '@/domain/story-scene';
import {VisionPlayer,MessagePlayer} from './delivery-players';

/**
 * A player's own deliveries arrive with the stage snapshot. One at a time, in order; a vision takes the whole screen,
 * a message slides in beside the table. "seen" is reported when it starts, "ack" when the player confirms.
 * Reload or a short disconnect: the server still lists an unconfirmed delivery, so it simply starts again.
 */
export function DeliveryStage({deliveries,sessionId,recipientName}:{deliveries:PlayerDelivery[];sessionId:string;recipientName:string}){
 const [current,setCurrent]=useState<PlayerDelivery|null>(null),[withdrawn,setWithdrawn]=useState(false),[notice,setNotice]=useState('');
 const done=useRef(new Set<string>()),seen=useRef(new Set<string>());
 // pick the next one; keep showing the current one until its own exit animation has finished
 useEffect(()=>{
  if(current){if(!withdrawn&&!deliveries.some(d=>d.id===current.id))queueMicrotask(()=>setWithdrawn(true));return;}
  const next=deliveries.find(d=>!done.current.has(d.id));
  if(next)queueMicrotask(()=>{setWithdrawn(false);setCurrent(next);});
 },[deliveries,current,withdrawn]);
 const asset=useCallback((fileId:string)=>current?'/api/live-deliveries/asset?sessionId='+encodeURIComponent(sessionId)+'&runId='+encodeURIComponent(current.id)+'&fileId='+encodeURIComponent(fileId):'',[current,sessionId]);
 const onSeen=useCallback(()=>{const d=current;if(!d||seen.current.has(d.id)||d.seen)return;seen.current.add(d.id);void api('/api/live-deliveries','POST',{action:'seen',sessionId,runId:d.id}).catch(()=>seen.current.delete(d.id));},[current,sessionId]);
 const onDone=useCallback(()=>{
  const d=current;if(!d)return;done.current.add(d.id);setCurrent(null);
  if(withdrawn)return;
  // confirmation: retried quietly; until the server has it, this tab does not show the same delivery again
  const send=(attempt:number)=>{void api('/api/live-deliveries','POST',{action:'ack',sessionId,runId:d.id}).then(()=>setNotice('')).catch(()=>{if(attempt<4)window.setTimeout(()=>send(attempt+1),1500*(attempt+1));else setNotice('Deine Bestätigung konnte noch nicht gespeichert werden. Sie wird beim nächsten Laden erneut angezeigt.');});};
  send(0);
 },[current,sessionId,withdrawn]);
 return <>
  {current?.kind==='vision'&&<VisionPlayer key={current.id} delivery={current} assetUrl={asset} onSeen={onSeen} onDone={onDone} withdrawn={withdrawn}/>}
  {current?.kind==='letter'&&<MessagePlayer key={current.id} delivery={current} assetUrl={asset} recipientName={recipientName} onSeen={onSeen} onDone={onDone} withdrawn={withdrawn}/>}
  {notice&&<p role="status" style={{position:'fixed',left:16,bottom:16,zIndex:80,margin:0,padding:'8px 12px',background:'rgba(0,0,0,.75)',color:'#fff',borderRadius:4,fontSize:13}}>{notice}</p>}
 </>;
}

/** The prepared entry as a player would get it. Used for the GM preview only; nothing is sent. */
export function previewDelivery(w:SceneWhisper):PlayerDelivery{
 const images=[...new Set([...w.fileIds,...richTextFileIds(w.text)])].slice(0,20);
 return {id:'00000000-0000-4000-8000-'+w.id.replace(/-/g,'').slice(0,12).padEnd(12,'0'),kind:w.kind,preset:presetById(w.preset).id,layout:w.layout||'fax',sender:w.sender||'',
  fragments:w.kind==='vision'?visionFragments(w.fragments,richTextToPlainText(w.text)):[],html:w.text,images,audio:!!w.audioFileId,audioFileId:w.audioFileId||null,createdAt:new Date().toISOString(),seen:true};
}

/** GM preview of a prepared vision or message. Only local rendering with the GM's own file access; no delivery, no receipt. */
export function DeliveryPreview({whisper,onClose}:{whisper:SceneWhisper;onClose:()=>void}){
 const [delivery]=useState(()=>previewDelivery(whisper));
 const url=useCallback((fileId:string)=>'/api/files?id='+encodeURIComponent(fileId),[]);
 return delivery.kind==='vision'
  ?<VisionPlayer delivery={delivery} assetUrl={url} onDone={onClose} preview/>
  :<MessagePlayer delivery={delivery} assetUrl={url} recipientName="Empfänger (Vorschau)" onDone={onClose} preview/>;
}
