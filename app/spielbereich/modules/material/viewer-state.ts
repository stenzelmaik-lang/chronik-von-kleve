"use client";
import {useCallback,useEffect,useState} from 'react';

/**
 * Personal viewer state of one material: page, zoom and volume belong to the person looking at it and are never
 * sent to the table. Kept in this browser only; storage may be unavailable (private windows), then it is session-only.
 */
export type ViewerState={page:number;zoom:number;volume:number;opened:boolean};
const initial:ViewerState={page:0,zoom:1,volume:.8,opened:false};
const key=(id:string)=>'chroniplay:material-viewer:'+id;
function read(id:string):ViewerState{
 try{const raw=window.localStorage.getItem(key(id));if(!raw)return initial;const v=JSON.parse(raw) as Partial<ViewerState>;
  return {page:Number.isInteger(v.page)&&v.page!>=0?v.page!:0,zoom:typeof v.zoom==='number'&&v.zoom>=.5&&v.zoom<=3?v.zoom:1,volume:typeof v.volume==='number'&&v.volume>=0&&v.volume<=1?v.volume:.8,opened:v.opened===true};}
 catch{return initial;}
}
export function useViewerState(id:string){
 const [state,setState]=useState<ViewerState>(initial);
 useEffect(()=>{queueMicrotask(()=>setState(read(id)));},[id]);
 const update=useCallback((patch:Partial<ViewerState>)=>setState(old=>{const next={...old,...patch};try{window.localStorage.setItem(key(id),JSON.stringify(next));}catch{/* storage unavailable */}return next;}),[id]);
 return [state,update] as const;
}
/** Whether this viewer has opened the material before (for "Geöffnet liegen lassen" on the table token). */
export function wasOpened(id:string){return read(id).opened;}

const soundKey='chroniplay:material-effektton';
/** Effect sounds are optional for every viewer and never forced; the choice is remembered in this browser. */
export function useEffectSound(){
 const [on,setOn]=useState(true);
 useEffect(()=>{queueMicrotask(()=>{try{setOn(window.localStorage.getItem(soundKey)!=='aus');}catch{/* storage unavailable */}});},[]);
 const toggle=useCallback(()=>setOn(old=>{const next=!old;try{window.localStorage.setItem(soundKey,next?'an':'aus');}catch{/* storage unavailable */}return next;}),[]);
 return [on,toggle] as const;
}
export function prefersReducedMotion(){try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{return false;}}
