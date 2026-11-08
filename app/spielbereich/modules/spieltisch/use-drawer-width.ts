"use client";
import {useEffect,useRef,useState,type PointerEvent,type KeyboardEvent} from 'react';

type Drawer='regie'|'context'|'notebook';
const defaults={regie:460,context:392,notebook:460};
const minimum=320,maximum=960;
const storageKey=(viewer:string,kind:Drawer)=>'chroniplay:drawer-width:'+viewer+':'+kind;
const clamp=(width:number,viewport:number)=>Math.round(Math.min(Math.max(width,minimum),Math.min(maximum,Math.max(minimum,viewport-96))));

/** Personal layout only; shared stage coordinates and server state never change. */
export function useDrawerWidth(viewer:string,kind:Drawer|null){
 const [viewport,setViewport]=useState(()=>typeof window==='undefined'?1440:window.innerWidth);
 const [preferred,setPreferred]=useState<Record<Drawer,number>>(()=>Object.fromEntries((['regie','context','notebook'] as const).map(key=>{
  try{const value=Number(window.localStorage.getItem(storageKey(viewer,key)));if(Number.isFinite(value)&&value>=minimum&&value<=maximum)return [key,value];}catch{/* Optional local storage may be blocked. */}
  return [key,defaults[key]];
 })) as Record<Drawer,number>);
 const drag=useRef<{id:number;x:number;initial:number;current:number;kind:Drawer}|null>(null);
 useEffect(()=>{const resize=()=>setViewport(window.innerWidth);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
 const width=clamp(preferred[kind||'context'],viewport),max=clamp(maximum,viewport);
 const change=(key:Drawer,value:number,persist=false)=>{
  const next=clamp(value,window.innerWidth);setPreferred(old=>({...old,[key]:next}));
  if(persist)try{window.localStorage.setItem(storageKey(viewer,key),String(next));}catch{/* Resizing still works without persistence. */}
 };
 const cancel=()=>{const g=drag.current;drag.current=null;if(g)setPreferred(old=>({...old,[g.kind]:g.initial}));};
 return {width,min:minimum,max,
  onPointerDown:(event:PointerEvent<HTMLElement>)=>{if(!kind||viewport<=700||event.button!==0)return;event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);drag.current={id:event.pointerId,x:event.clientX,initial:width,current:width,kind};},
  onPointerMove:(event:PointerEvent<HTMLElement>)=>{const g=drag.current;if(!g||g.id!==event.pointerId)return;g.current=clamp(g.initial+g.x-event.clientX,window.innerWidth);change(g.kind,g.current);},
  onPointerUp:(event:PointerEvent<HTMLElement>)=>{const g=drag.current;if(!g||g.id!==event.pointerId)return;drag.current=null;change(g.kind,g.current,true);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);},
  onPointerCancel:cancel,onLostPointerCapture:cancel,
  onKeyDown:(event:KeyboardEvent<HTMLElement>)=>{
   if(event.key==='Escape'&&drag.current){event.preventDefault();cancel();return;}
   if(!kind||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();const step=event.shiftKey?40:10;change(kind,event.key==='Home'?minimum:event.key==='End'?max:width+(event.key==='ArrowLeft'?step:-step),true);
  },
 };
}
