import {useEffect,useRef,useState} from 'react';
import {createInbox,ingestDice,dismissDice,showDice} from './dice-inbox.mjs';
import type {Snapshot,Viewer,DiceEvent} from './types';
import {ApiError} from '../api-client';

const storageKey = (viewer: Viewer) => 'chroniplay-w10-v12-' + viewer;

function loadInbox(viewer: Viewer) {
  let saved: { hidden?: string[]; selectedId?: string | null; statisticsExcludedIds?: string[] } = {};
  try { saved = JSON.parse(sessionStorage.getItem(storageKey(viewer)) || '{}') ?? {}; }
  catch { /* Presentation preferences are optional. */ }

  return {
    ...createInbox(Array.isArray(saved.hidden) ? saved.hidden : []),
    selectedId: typeof saved.selectedId === 'string' ? saved.selectedId : null,
    viewer,
    statisticsExcludedIds: new Set(Array.isArray(saved.statisticsExcludedIds) ? saved.statisticsExcludedIds : []),
  };
}

export function useSharedDice(viewer:Viewer,sessionId:string,snapshot:Snapshot|null,send:(body:Record<string,unknown>)=>Promise<Snapshot>){
  const [inbox,setInbox]=useState(()=>loadInbox(viewer));
  const role=useRef(viewer),pending=useRef<{eventId:string;pool:number;target:number}|null>(null),flight=useRef<Promise<number[]>|null>(null);
  useEffect(()=>{if(role.current!==viewer){role.current=viewer;pending.current=null;flight.current=null;setInbox(loadInbox(viewer));}},[viewer]);
  useEffect(()=>{let active=true;const journal=snapshot?.dice;if(journal)queueMicrotask(()=>{if(active)setInbox(old=>receiveDice(old,journal));});return()=>{active=false;};},[snapshot?.dice,viewer]);
  useEffect(() => {
    if (inbox.revision < 0 || inbox.viewer !== viewer) return;
    try {
      sessionStorage.setItem(storageKey(viewer), JSON.stringify({
        hidden: inbox.hidden, selectedId: inbox.selectedId, statisticsExcludedIds: [...inbox.statisticsExcludedIds],
      }));
    } catch { /* Presentation preferences are optional. */ }
  }, [inbox, viewer]);
  const events: DiceEvent[] = inbox.viewer === viewer ? inbox.events : [];
  const selected=events.find(e=>e.id===inbox.selectedId);
  const waiting=events.filter(e=>e.status==='settled_open'&&e.id!==inbox.selectedId&&!inbox.hidden.includes(e.id));
  const roll=(pool:number,target:number)=>{
    if(flight.current)return flight.current;
    if(!pending.current||pending.current.pool!==pool||pending.current.target!==target)pending.current={eventId:crypto.randomUUID(),pool,target};
    const body={action:'roll',sessionId,...pending.current},initiator=viewer;
    const job=send(body).then(next=>{
      if(role.current===initiator){setInbox(old=>receiveDice(old,next.dice));pending.current=null;}
      const event=next.dice.events.find(e=>e.id===body.eventId);
      if(!event)throw Error('Der Wurf ist im aktuellen Würfelprotokoll nicht mehr verfügbar.');
      return [...event.roll.dice];
    }).catch(error=>{
      if(role.current===initiator&&error instanceof ApiError&&error.status===409)pending.current=null;
      throw error;
    });
    flight.current=job;void job.finally(()=>{if(flight.current===job)flight.current=null;}).catch(()=>{});return job;
  };
  const clearStatistics = (authorId: string) => setInbox(current => {
    if (current.viewer !== viewer) return current;
    const statisticsExcludedIds = new Set(current.statisticsExcludedIds);
    for (const event of current.events as DiceEvent[]) {
      if (!authorId || event.authorId === authorId) statisticsExcludedIds.add(event.id);
    }
    return { ...current, statisticsExcludedIds };
  });

  return {selected,waiting,animate:inbox.animate,events,roll,statisticsExcludedIds:inbox.statisticsExcludedIds,clearStatistics,
    dismiss:()=>setInbox(old=>dismissDice(old)),show:(id:string)=>setInbox(old=>showDice(old,id)),
    closeShared:async()=>{if(selected){const next=await send({action:'closeRoll',sessionId,eventId:selected.id,expectedRevision:selected.revision});setInbox(old=>receiveDice(old,next.dice));}}
  };
}

function receiveDice(inbox:ReturnType<typeof loadInbox>,journal:Snapshot['dice']){
  const next=ingestDice(inbox,journal);
  if(next===inbox)return inbox;
  const currentIds=new Set(journal.events.map(event=>event.id));
  const statisticsExcludedIds=new Set([...inbox.statisticsExcludedIds].filter(id=>currentIds.has(id)));
  return {...next,statisticsExcludedIds};
}
