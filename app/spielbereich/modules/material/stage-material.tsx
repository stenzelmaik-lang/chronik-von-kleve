"use client";
import {useEffect,useState,type PointerEvent as PE} from 'react';
import {Expand} from 'lucide-react';
import type {StageObject} from '../spieltisch/types';
import {MaterialCover,type PresentedMaterial} from './presenter';
import {wasOpened} from './viewer-state';
import styles from './stage-material.module.css';

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
/** A material lying on the table: one object, its display asset as the closed look, opened personally by click. */
export function MaterialToken({o,asset,onOpen,drag}:{o:TableObject;asset:(id:string)=>string;onOpen:()=>void;drag:Drag}){
 const presented=stagePresented(o,asset);
 const [opened,setOpened]=useState(false);
 useEffect(()=>{queueMicrotask(()=>setOpened(wasOpened(o.id)));},[o.id]);
 if(!presented)return null;
 const showOpen=opened&&presented.effect.afterClose==='open';
 return <div className={styles.token} data-material-type={presented.type} {...drag}>
  <button type="button" className={styles.face} aria-label={o.title+' öffnen'} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onOpen();queueMicrotask(()=>setOpened(true));}}>
   <MaterialCover material={presented} showOpen={showOpen}/>
  </button>
  <span className={styles.caption}>{o.title}</span>
  <button type="button" className={styles.openMini} aria-label={o.title+' ansehen'} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onOpen();}}><Expand size={14}/></button>
 </div>;
}
