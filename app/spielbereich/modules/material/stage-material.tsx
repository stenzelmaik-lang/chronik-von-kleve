"use client";
import {useEffect,useRef,useState,type PointerEvent as PE} from 'react';
import {Backpack} from 'lucide-react';
import type {StageObject} from '../spieltisch/types';
import {MaterialCover,type PresentedMaterial} from './presenter';
import {wasOpened} from './viewer-state';
import styles from './stage-material.module.css';
import {richTextToPlainText} from '@/domain/location-rich-text';

type TableObject=Exclude<StageObject,{kind:'note'}>;
type Drag={onPointerDown:(e:PE<HTMLElement>)=>void;onPointerMove:(e:PE<HTMLElement>)=>void;onPointerUp:(e:PE<HTMLElement>)=>void;onPointerCancel:()=>void};
const mimeOf=(media:TableObject['media'])=>media==='image'?'image/*':media==='audio'?'audio/*':media==='video'?'video/*':media==='pdf'?'application/pdf':'';

/** Viewer data of a released material, resolved through the session-authorized stage asset route only. */
export function stagePresented(o:TableObject,asset:(id:string)=>string):PresentedMaterial|null{
 const m=o.material;if(!m)return null;
 const base=asset(o.id);
 const pages=o.pages?.length?o.pages.map((p,i)=>({title:p.title,src:base+'&page='+i,mime:'image/*'})):o.sourceFileId&&o.media?[{title:o.title,src:base,mime:mimeOf(o.media)}]:[];
 return {title:o.title,type:m.type,display:m.display,effect:{open:m.effect.open,close:m.effect.close,speed:m.effect.speed,afterClose:m.effect.afterClose},
  states:m.states.map(s=>({key:s.key,src:base+'&state='+encodeURIComponent(s.key)})),pages,...(o.documentContent?{caption:o.documentContent}:{}),...(m.soundFileId?{soundSrc:base+'&sound=1'}:{})};
}
/**
 * A material lying on the table: only the object itself, its display asset as the closed look. A click opens it
 * personally; pressing and dragging moves it (for whoever may arrange it). The title and caption appear as a tooltip.
 */
export function MaterialToken({o,asset,onOpen,drag,arrange,onAspect,onTake}:{o:TableObject;asset:(id:string)=>string;onOpen:()=>void;drag:Drag;arrange?:{selected:boolean;onSelect:()=>void};onAspect?:(ratio:number)=>void;onTake?:()=>void}){
 const presented=stagePresented(o,asset);
 const [opened,setOpened]=useState(false);
 const press=useRef<{x:number;y:number}|null>(null),face=useRef<HTMLButtonElement>(null);
 useEffect(()=>{queueMicrotask(()=>setOpened(wasOpened(o.id)));},[o.id]);
 // The object's field takes the shape of its picture, so outline, handles and tooltip sit on the object itself.
 useEffect(()=>{const img=face.current?.querySelector('img');if(!img||!onAspect)return;const report=()=>{if(img.naturalWidth&&img.naturalHeight)onAspect(img.naturalWidth/img.naturalHeight);};if(img.complete)report();else img.addEventListener('load',report,{once:true});return()=>img.removeEventListener('load',report);},[onAspect,o.id]);
 if(!presented)return null;
 const showOpen=opened&&presented.effect.afterClose==='open';
 const hint=plainText(o.documentContent||'');
 return <div className={styles.token} data-material-type={presented.type}>
  <button ref={face} type="button" className={styles.face} aria-label={o.title+' öffnen'} aria-describedby={'tip-'+o.id}
   onPointerDown={e=>{press.current={x:e.clientX,y:e.clientY};drag.onPointerDown(e);}} onPointerMove={drag.onPointerMove} onPointerUp={drag.onPointerUp} onPointerCancel={drag.onPointerCancel}
   onClick={e=>{e.stopPropagation();const p=press.current;press.current=null;if(p&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>=5)return;
    // Whoever arranges the table selects with the first click (handles for size and tilt) and opens with the second.
    if(arrange&&!arrange.selected){arrange.onSelect();return;}onOpen();queueMicrotask(()=>setOpened(true));}}>
   <MaterialCover material={presented} showOpen={showOpen}/>
  </button>
  {onTake&&<button type="button" className={styles.take} onClick={e=>{e.stopPropagation();onTake();}}><Backpack size={14}/> Einstecken</button>}
  <span id={'tip-'+o.id} role="tooltip" className={styles.tip}><strong>{o.title}</strong>{hint&&<small>{hint.length>220?hint.slice(0,220)+' …':hint}</small>}</span>
 </div>;
}
const plainText=(value:string)=>richTextToPlainText(value).replace(/\s+/g,' ').trim();
