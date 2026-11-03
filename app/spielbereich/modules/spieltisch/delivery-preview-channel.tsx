"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import type {PlayerDelivery} from '@/domain/personal-delivery';
import {VisionPlayer,MessagePlayer} from './delivery-players';

/**
 * GM preview on the GM's own table. The Regie (second window or the panel inside the table) hands the entry to the
 * table through a BroadcastChannel of this browser; the table plays it with exactly the player's presentation.
 * Nothing goes to the server: no run, no receipt, no event. Other players never receive anything.
 */
const NAME='chroniplay:delivery-preview';
type Show={type:'show';id:string;sessionId:string;delivery:PlayerDelivery;recipientName:string};
type Reply={type:'ack'|'done';id:string};

/** Resolves true when a table of this evening in this browser took the preview; false if none is open. */
export function previewOnTable(sessionId:string,delivery:PlayerDelivery,recipientName:string,onDone?:()=>void):Promise<boolean>{
 if(typeof BroadcastChannel==='undefined')return Promise.resolve(false);
 const channel=new BroadcastChannel(NAME),id=crypto.randomUUID();
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

/** Mounted on the GM's table: plays a preview from the Regie on top of the current table, which stays as it is. */
export function TablePreview({sessionId}:{sessionId:string}){
 const [current,setCurrent]=useState<Show|null>(null);
 const channel=useRef<BroadcastChannel|null>(null);
 useEffect(()=>{
  if(typeof BroadcastChannel==='undefined')return;
  const c=new BroadcastChannel(NAME);channel.current=c;
  c.onmessage=e=>{const m=e.data as Show;if(m?.type!=='show'||m.sessionId!==sessionId||!valid(m.delivery))return;c.postMessage({type:'ack',id:m.id} satisfies Reply);setCurrent(m);};
  return()=>{c.close();channel.current=null;};
 },[sessionId]);
 const id=current?.id;
 const done=useCallback(()=>{if(id)channel.current?.postMessage({type:'done',id} satisfies Reply);setCurrent(null);},[id]);
 const url=useCallback((fileId:string)=>'/api/files?id='+encodeURIComponent(fileId),[]);
 if(!current)return null;
 return current.delivery.kind==='vision'
  ?<VisionPlayer key={current.id} delivery={current.delivery} assetUrl={url} onDone={done} preview/>
  :<MessagePlayer key={current.id} delivery={current.delivery} assetUrl={url} recipientName={current.recipientName} onDone={done} preview/>;
}
