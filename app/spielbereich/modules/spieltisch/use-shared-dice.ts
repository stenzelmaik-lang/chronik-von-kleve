import {useEffect,useRef,useState} from 'react';
import {createInbox,ingestDice,dismissDice,showDice} from './dice-inbox.mjs';
import type {Snapshot,Viewer,DiceEvent} from './types';

function saved(viewer:Viewer){try{return JSON.parse(sessionStorage.getItem('chroniplay-w10-v12-'+viewer)||'{}');}catch{return {};}}
export function useSharedDice(viewer:Viewer,sessionId:string,snapshot:Snapshot|null,send:(body:Record<string,unknown>)=>Promise<Snapshot>){
  const [inbox,setInbox]=useState(()=>({...createInbox(saved(viewer).hidden,saved(viewer).selectedId),viewer}));
  const role=useRef(viewer),pending=useRef<{eventId:string;pool:number;target:number}|null>(null),flight=useRef<Promise<number[]>|null>(null);
  useEffect(()=>{if(role.current!==viewer){role.current=viewer;pending.current=null;flight.current=null;setInbox({...createInbox(saved(viewer).hidden,saved(viewer).selectedId),viewer});}},[viewer]);
  useEffect(()=>{let active=true;const journal=snapshot?.dice;if(journal)queueMicrotask(()=>{if(active)setInbox(old=>ingestDice(old,journal));});return()=>{active=false;};},[snapshot?.dice,viewer]);
  useEffect(()=>{if(inbox.revision<0||inbox.viewer!==viewer)return;try{sessionStorage.setItem('chroniplay-w10-v12-'+viewer,JSON.stringify({hidden:inbox.hidden,selectedId:inbox.selectedId}));}catch{/* Presentation preference only. */}},[inbox,viewer]);
  const selected=inbox.events.find((e:DiceEvent)=>e.id===inbox.selectedId) as DiceEvent|undefined;
  const waiting=inbox.events.filter((e:DiceEvent)=>e.status==='settled_open'&&e.id!==inbox.selectedId&&!inbox.hidden.includes(e.id)) as DiceEvent[];
  const roll=(pool:number,target:number)=>{
    if(flight.current)return flight.current;
    if(!pending.current||pending.current.pool!==pool||pending.current.target!==target)pending.current={eventId:crypto.randomUUID(),pool,target};
    const body={action:'roll',sessionId,...pending.current},initiator=viewer;
    const job=send(body).then(next=>{const event=next.dice.events.find(e=>e.id===body.eventId);if(!event)throw Error('Zentraler Wurf fehlt.');if(role.current===initiator)setInbox(old=>ingestDice(old,next.dice));pending.current=null;return [...event.roll.dice];});
    flight.current=job;void job.finally(()=>{if(flight.current===job)flight.current=null;}).catch(()=>{});return job;
  };
  return {selected,waiting,animate:inbox.animate,events:inbox.events as DiceEvent[],roll,
    dismiss:()=>setInbox(old=>dismissDice(old)),show:(id:string)=>setInbox(old=>showDice(old,id)),
    closeShared:async()=>{if(selected){const next=await send({action:'closeRoll',sessionId,eventId:selected.id,expectedRevision:selected.revision});setInbox(old=>ingestDice(old,next.dice));}}
  };
}
