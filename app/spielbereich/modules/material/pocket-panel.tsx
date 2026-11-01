"use client";
import {useCallback,useEffect,useState} from 'react';
import {Eye,ArrowDownToLine} from 'lucide-react';
import {api} from '../api-client';
import {MaterialCover,MaterialPresenter,type PresentedMaterial} from './presenter';
import styles from './pocket-panel.module.css';

/** A pocketed material as /api/inventory/material lists it: viewer data with URLs authorised by the item. */
export type PocketItem=PresentedMaterial&{id:string;holder:string;own:boolean};

/**
 * The player's pocket at the table: materials they took into their inventory. They can look at them privately or lay
 * them on the table again for the whole round (one object, one holder). The list reloads after taking or laying out.
 */
export function PocketPanel({version,busy,onPlay,actorId}:{version:number;busy:boolean;onPlay:(itemId:string)=>Promise<boolean>;actorId:string}){
 const [items,setItems]=useState<PocketItem[]|null>(null),[error,setError]=useState(''),[viewing,setViewing]=useState<PocketItem|null>(null);
 const load=useCallback(async()=>{try{setItems((await api<{items:PocketItem[]}>('/api/inventory/material')).items.filter(i=>i.own));setError('');}catch(e){setError((e as Error).message);}},[]);
 useEffect(()=>{queueMicrotask(()=>void load());},[load,version]);
 if(error)return <p className={styles.hint} role="alert">{error}</p>;
 if(!items)return <p className={styles.hint}>Wird geladen …</p>;
 return <>
  <p className={styles.hint}>Was du am Tisch eingesteckt hast, liegt in deinem Inventar. Von hier legst du es jederzeit wieder für alle auf den Tisch.</p>
  {!items.length?<p className={styles.empty}>Noch nichts eingesteckt. Fahre über ein Material auf dem Tisch und wähle „Einstecken“.</p>:
  <ul className={styles.list}>{items.map(item=><li key={item.id}>
   <span className={styles.cover}><MaterialCover material={item}/></span>
   <div><strong>{item.title}</strong>
    <div className={styles.actions}><button type="button" onClick={()=>setViewing(item)}><Eye size={15}/> Ansehen</button>
     <button type="button" className={styles.primary} disabled={busy} onClick={()=>void onPlay(item.id).then(ok=>{if(ok)void load();})}><ArrowDownToLine size={15}/> Auf den Tisch legen</button></div>
   </div>
  </li>)}</ul>}
  {viewing&&<MaterialPresenter key={viewing.id} material={viewing} personalKey={actorId+':pocket:'+viewing.id} badge="Aus deinem Inventar – nur für dich" onClose={()=>setViewing(null)}/>}
 </>;
}
