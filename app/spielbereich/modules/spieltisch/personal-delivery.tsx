/* eslint-disable @next/next/no-img-element -- Recipient-authorized media use the stage asset endpoint. */
"use client";
import {useEffect,useRef,useState} from 'react';
import {CloudFog,X,ArrowLeft,ArrowRight} from 'lucide-react';
import type {StageObject} from './types';
import {richTextFileIds} from '@/domain/location-rich-text';
import {RichTextView} from '../rich-text';
import styles from './personal-delivery.module.css';

type Delivery=Extract<StageObject,{kind:'npc'|'document'}>;
export function PersonalDeliveryToken({item,onOpen}:{item:Delivery;onOpen:()=>void}){
 return <button type="button" className={item.presentation==='vision'?styles.visionToken:styles.envelope} aria-label={(item.presentation==='vision'?'Vision ansehen: ':'Brief öffnen: ')+item.title} onClick={onOpen}>
  <img className={styles.tokenArt} src={'/images/personal-delivery/'+(item.presentation==='vision'?'mist-v2.webp':'envelope-v2.webp')} alt="" draggable={false}/><span className={styles.tokenLabel}><strong>{item.title}</strong><small>{item.presentation==='vision'?'Vision ansehen':'Persönlicher Brief · öffnen'}</small></span>
 </button>;
}
function storedSeen(key:string){try{return typeof window==='undefined'?[]:JSON.parse(sessionStorage.getItem(key)||'[]') as string[];}catch{return [];}}

/** Only authorized snapshot objects arrive here. Opening/closing is local presentation state. */
export function PersonalDeliveryReader({objects,viewer,activeId,onSelect,asset,autoOpen=true}:{objects:StageObject[];viewer:string;activeId:string;onSelect:(id:string)=>void;asset:(id:string)=>string;autoOpen?:boolean}){
 const key='chroniplay-personal-seen:'+viewer,seen=useRef(new Set(storedSeen(key))),dialog=useRef<HTMLDialogElement>(null);
 const deliveries=objects.filter((o):o is Delivery=>o.kind==='document'&&!!o.presentation),active=deliveries.find(o=>o.id===activeId);
 useEffect(()=>{
  if(activeId&&!active){onSelect('');return;}
  if(active){if(!seen.current.has(active.id)){seen.current.add(active.id);try{sessionStorage.setItem(key,JSON.stringify([...seen.current].slice(-200)));}catch{/* Only a replay preference. */}}return;}
  const next=deliveries.find(o=>o.presentation==='vision'&&!seen.current.has(o.id));
  if(next&&autoOpen)onSelect(next.id);
 },[active,activeId,deliveries,key,onSelect,autoOpen]);
 useEffect(()=>{if(active&&!dialog.current?.open)dialog.current?.show();else if(!active&&dialog.current?.open)dialog.current.close();},[active]);
 return <dialog ref={dialog} className={`${styles.reader} ${active?.presentation==='vision'?styles.vision:styles.letter}`} aria-modal="false" aria-label={active?.presentation==='vision'?'Persönliche Vision':'Persönlicher Brief'} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onSelect('');}}} onCancel={()=>onSelect('')}>
  {active&&<><header><span>{active.presentation==='vision'&&<CloudFog size={17}/>} {active.presentation==='vision'?'Eine Vision':'Persönliche Botschaft'}</span><button type="button" autoFocus aria-label="Persönliche Ansicht schließen" onClick={()=>onSelect('')}><X size={20}/></button></header><PersonalContent key={active.id} item={active} asset={asset}/><footer>Nur für dich · jederzeit wieder öffnen</footer></>}
 </dialog>;
}
function PersonalContent({item,asset}:{item:Delivery;asset:(id:string)=>string}){
 const [page,setPage]=useState(0),embedded=richTextFileIds(item.documentContent||''),pictures=(item.pages||[]).map((p,i)=>({...p,index:i})).filter(p=>!embedded.includes(p.fileId)),pageIndex=Math.min(page,Math.max(0,pictures.length-1));
 const fileUrl=(id:string)=>{const i=item.pages?.findIndex(p=>p.fileId===id)??-1;return i<0?'':asset(item.id)+'&page='+i;};
 return <article className={styles.body} data-with-image={pictures.length>0}><div className={styles.copy}><h2>{item.title}</h2><RichTextView value={item.documentContent||''} readable flowing fileUrl={fileUrl}/></div>
  {!!pictures.length&&<figure className={styles.picture}><img key={pictures[pageIndex].id} src={asset(item.id)+'&page='+pictures[pageIndex].index} alt={pictures[pageIndex].title||'Bild der Botschaft'}/>{pictures.length>1&&<figcaption><button type="button" disabled={pageIndex===0} aria-label="Vorheriges Bild" onClick={()=>setPage(pageIndex-1)}><ArrowLeft size={18}/></button><span>Bild {pageIndex+1} von {pictures.length}</span><button type="button" disabled={pageIndex===pictures.length-1} aria-label="Nächstes Bild" onClick={()=>setPage(pageIndex+1)}><ArrowRight size={18}/></button></figcaption>}</figure>}
 </article>;
}
