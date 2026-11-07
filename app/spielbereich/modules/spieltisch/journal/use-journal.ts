'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from '../../api-client';
import type {CharacterDetailProjection} from '../../character';
import type {Snapshot} from '../types';

/**
 * Data of the open book: the own active character (existing selection), its personal projection without view=sl
 * (sheet, private notes, unbound own notes) and the authoritative current values of the running table.
 * Nothing here is cached across characters: a figure change loads the other character and never mixes data.
 */
export function useJournalData(open:boolean,snapshot:Snapshot|null){
 const [characterId,setCharacterId]=useState<string|null>(null),[projection,setProjection]=useState<CharacterDetailProjection|null>(null);
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false);
 const request=useRef(0),current=useRef<string|null>(null);
 const load=useCallback(async()=>{
  const ticket=++request.current;setLoading(true);
  try{
   const chosen=await api<{characterId:string|null}>('/api/character-selection');
   if(ticket!==request.current)return;
   const id=chosen.characterId||null;
   if(id!==current.current){current.current=id;setProjection(null);}
   setCharacterId(id);
   if(id){const p=await api<CharacterDetailProjection>('/api/character-detail?id='+encodeURIComponent(id)+'&journal=1');if(ticket===request.current&&current.current===id)setProjection(p);}
   if(ticket===request.current){setError('');setLoaded(true);}
  }catch(e){if(ticket===request.current){setError((e as Error).message);setLoaded(true);}}
  finally{if(ticket===request.current)setLoading(false);}
 },[]);
 // Load when the book opens; while it is open follow figure changes made elsewhere (profile bar) and window focus.
 useEffect(()=>{if(!open)return;queueMicrotask(()=>void load());const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},20000);const focus=()=>void load();window.addEventListener('focus',focus);return()=>{window.clearInterval(timer);window.removeEventListener('focus',focus);};},[open,load]);
 // Current values come from the table snapshot (the same source as the vitals HUD). A changed character version
 // there means the stored sheet changed too, so the open sheet reloads.
 const tableCharacter=snapshot?.vitals?.characters.find(c=>c.id===characterId&&c.own)||null;
 const tableVersion=tableCharacter?.version;
 const seenVersion=useRef<number|undefined>(undefined);
 useEffect(()=>{if(!open||tableVersion===undefined)return;if(seenVersion.current!==undefined&&seenVersion.current!==tableVersion)queueMicrotask(()=>void load());seenVersion.current=tableVersion;},[open,tableVersion,load]);
 return {characterId,projection,loading,loaded,error,reload:load,tableVitals:tableCharacter?.vitals||null};
}
