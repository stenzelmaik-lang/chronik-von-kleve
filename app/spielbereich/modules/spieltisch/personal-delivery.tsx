/* eslint-disable @next/next/no-img-element -- Recipient-authorized media use the stage asset endpoint. */
"use client";
import {useEffect,useRef,useState} from 'react';
import {CloudFog,Mail,MailOpen,X,ArrowLeft,ArrowRight} from 'lucide-react';
import type {StageObject} from './types';
import {richTextFileIds} from '@/domain/location-rich-text';
import {RichTextView} from '../rich-text';
import styles from './personal-delivery.module.css';

type Delivery=Extract<StageObject,{kind:'npc'|'document'}>;
export function PersonalDeliveryToken({item,onOpen}:{item:Delivery;onOpen:()=>void}){
 return <button type="button" className={item.presentation==='vision'?styles.visionToken:styles.envelope} aria-label={(item.presentation==='vision'?'Vision ansehen: ':'Brief öffnen: ')+item.title} onClick={onOpen}>
  {item.presentation==='vision'?<CloudFog size={32}/>:<Mail size={34}/>}<strong>{item.title}</strong><span>{item.presentation==='vision'?'Eine Vision':'Nur für dich · öffnen'}</span>
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
 useEffect(()=>{if(active&&!dialog.current?.open)dialog.current?.showModal();else if(!active&&dialog.current?.open)dialog.current.close();},[active]);
 return <dialog ref={dialog} className={`${styles.reader} ${active?.presentation==='vision'?styles.vision:styles.letter}`} aria-label={active?.presentation==='vision'?'Persönliche Vision':'Persönlicher Brief'} onCancel={()=>onSelect('')} onClose={()=>onSelect('')}>
  {active&&<><header><span>{active.presentation==='vision'?<CloudFog size={20}/>:<MailOpen size={20}/>} {active.presentation==='vision'?'Vision':'Persönliche Botschaft'}</span><button type="button" autoFocus aria-label="Persönliche Ansicht schließen" onClick={()=>onSelect('')}><X size={22}/></button></header><PersonalContent key={active.id} item={active} asset={asset}/><footer>Diese Ansicht gehört nur dir. Schließen verändert nichts bei anderen Spielern.</footer></>}
 </dialog>;
}
function PersonalContent({item,asset}:{item:Delivery;asset:(id:string)=>string}){
 const [page,setPage]=useState(0),embedded=richTextFileIds(item.documentContent||''),pictures=(item.pages||[]).map((p,i)=>({...p,index:i})).filter(p=>!embedded.includes(p.fileId));
 const fileUrl=(id:string)=>{const i=item.pages?.findIndex(p=>p.fileId===id)??-1;return i<0?'':asset(item.id)+'&page='+i;};
 return <article className={styles.body}><h2>{item.title}</h2><RichTextView value={item.documentContent||''} readable flowing fileUrl={fileUrl}/>
  {!!pictures.length&&<figure className={styles.picture}><img key={pictures[page].id} src={asset(item.id)+'&page='+pictures[page].index} alt={pictures[page].title||'Bild der Botschaft'}/>{pictures.length>1&&<figcaption><button type="button" disabled={page===0} aria-label="Vorheriges Bild" onClick={()=>setPage(page-1)}><ArrowLeft size={18}/></button><span>Bild {page+1} von {pictures.length}</span><button type="button" disabled={page===pictures.length-1} aria-label="Nächstes Bild" onClick={()=>setPage(page+1)}><ArrowRight size={18}/></button></figcaption>}</figure>}
 </article>;
}
