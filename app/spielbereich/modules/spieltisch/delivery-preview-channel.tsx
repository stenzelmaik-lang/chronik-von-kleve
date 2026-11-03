"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import type {PlayerDelivery} from '@/domain/personal-delivery';
import type {Snapshot} from './types';
import {VisionPlayer,MessagePlayer} from './delivery-players';

/**
 * GM preview on the GM's own table, with exactly the player's presentation. Two ways in, one preview:
 * - instantly through a BroadcastChannel when Regie and table run in the same browser,
 * - through the GM-only preview value of the stage snapshot (any window, any device), picked up on the next poll.
 * Both carry the same id, so a preview plays once. No run, no receipt, nothing ever reaches a player.
 */
const NAME='chroniplay:delivery-preview';
type Show={type:'show';id:string;sessionId:string;delivery:PlayerDelivery;recipientName:string};
type Reply={type:'ack'|'done';id:string};

/** Resolves true when a table of this evening in this browser took the preview; false if none is open. */
export function previewOnTable(sessionId:string,delivery:PlayerDelivery,recipientName:string,id:string=crypto.randomUUID(),onDone?:()=>void):Promise<boolean>{
 if(typeof BroadcastChannel==='undefined')return Promise.resolve(false);
 const channel=new BroadcastChannel(NAME);
 return new Promise(resolve=>{
  let taken=false;
  const stop=window.setTimeout(()=>channel.close(),15*60*1000);
  const none=window.setTimeout(()=>{if(!taken){window.clearTimeout(stop);channel.close();resolve(false);}},800);
  channel.onmessage=e=>{
   const m=e.data as Reply;if(!m||m.id!==id)return;
   if(m.type==='ack'&&!taken){taken=true;window.clearTimeout(none);resolve(true);}
   if(m.type==='done'){window.clearTimeout(stop);channel.close();onDone?.();}
  };
  channel.postMessage({type:'show',id,sessionId,delivery,recipientName} satisfies Show);
 });
}

const valid=(d:unknown):d is PlayerDelivery=>{const x=d as PlayerDelivery;return !!x&&(x.kind==='vision'||x.kind==='letter')&&Array.isArray(x.fragments)&&Array.isArray(x.images)&&typeof x.html==='string';};

const PLAYED='chroniplay-previews-played';
/** Mounted on the GM's table: plays a preview from the Regie on top of the current table, which stays as it is. */
export function TablePreview({sessionId,relay}:{sessionId:string;relay?:Snapshot['tablePreview']}){
 const [current,setCurrent]=useState<Show|null>(null);
 const channel=useRef<BroadcastChannel|null>(null),played=useRef<Set<string>|null>(null);
 // ids already shown in this tab, also across a reload: a preview never plays twice
 const once=useCallback((id:string)=>{
  if(!played.current){try{played.current=new Set(JSON.parse(sessionStorage.getItem(PLAYED)||'[]'));}catch{played.current=new Set();}}
  if(played.current.has(id))return false;
  played.current.add(id);try{sessionStorage.setItem(PLAYED,JSON.stringify([...played.current].slice(-30)));}catch{/* preference only */}
  return true;
 },[]);
 useEffect(()=>{
  if(typeof BroadcastChannel==='undefined')return;
  const c=new BroadcastChannel(NAME);channel.current=c;
  c.onmessage=e=>{const m=e.data as Show;if(m?.type!=='show'||m.sessionId!==sessionId||!valid(m.delivery))return;c.postMessage({type:'ack',id:m.id} satisfies Reply);if(once(m.id))setCurrent(m);};
  return()=>{c.close();channel.current=null;};
 },[sessionId,once]);
 useEffect(()=>{
  if(!relay||!valid(relay.delivery)||!once(relay.id))return;
  queueMicrotask(()=>setCurrent({type:'show',id:relay.id,sessionId,delivery:relay.delivery,recipientName:relay.recipientName}));
 },[relay,sessionId,once]);
 const id=current?.id;
 const done=useCallback(()=>{if(id)channel.current?.postMessage({type:'done',id} satisfies Reply);setCurrent(null);},[id]);
 const url=useCallback((fileId:string)=>'/api/files?id='+encodeURIComponent(fileId),[]);
 if(!current)return null;
 return current.delivery.kind==='vision'
  ?<VisionPlayer key={current.id} delivery={current.delivery} assetUrl={url} onDone={done} preview/>
  :<MessagePlayer key={current.id} delivery={current.delivery} assetUrl={url} recipientName={current.recipientName} onDone={done} preview/>;
}
