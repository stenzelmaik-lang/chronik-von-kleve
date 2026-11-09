"use client";
/* eslint-disable @next/next/no-img-element -- Images come from the authenticated gallery endpoint. */
import {useEffect,useState} from 'react';
import {ChevronLeft,ChevronRight,X} from 'lucide-react';
import {api} from './api-client';
import styles from './player-gallery.module.css';

type Gallery={characters:{id:string;name:string;images:{url:string;caption:string;portrait:boolean}[]}[]};

/** Galerie (4c): the images the characters of this round share with the group. Shared in the Charakterprofil under "Porträt & Referenzen". */
export function PlayerGallery(){
 const [data,setData]=useState<Gallery|null>(null),[error,setError]=useState(''),[open,setOpen]=useState<{c:number;i:number}|null>(null);
 useEffect(()=>{let live=true;api<Gallery>('/api/character-gallery').then(d=>{if(live)setData(d);}).catch(e=>{if(live)setError((e as Error).message);});return()=>{live=false;};},[]);
 useEffect(()=>{if(!open||!data)return;const key=(e:KeyboardEvent)=>{const n=data.characters[open.c].images.length;if(e.key==='Escape')setOpen(null);if(e.key==='ArrowRight')setOpen({c:open.c,i:(open.i+1)%n});if(e.key==='ArrowLeft')setOpen({c:open.c,i:(open.i+n-1)%n});};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[open,data]);
 if(error)return <p role="alert">{error}</p>;
 if(!data)return <p role="status">Galerie wird geladen …</p>;
 if(!data.characters.length)return <section className={styles.empty}><p>Noch hat kein Charakter Bilder mit der Runde geteilt.</p><p className={styles.hint}>Bilder teilst du in deinem Charakterprofil unter „Porträt & Referenzen“ mit „Für die Gruppe sichtbar“.</p></section>;
 const current=open?data.characters[open.c]:null,image=current&&open?current.images[open.i]:null;
 return <div className={styles.gallery}>
  {data.characters.map((c,ci)=><section key={c.id} className={styles.character} aria-labelledby={'g-'+c.id}>
   <h2 id={'g-'+c.id}>{c.name}</h2>
   <ul>{c.images.map((img,ii)=><li key={img.url}><button type="button" onClick={()=>setOpen({c:ci,i:ii})} aria-label={(img.caption||(img.portrait?'Porträt':'Bild '+(ii+1)))+' von '+c.name+' groß ansehen'}><img src={img.url} alt="" loading="lazy"/>{(img.caption||img.portrait)&&<span>{img.caption||'Porträt'}</span>}</button></li>)}</ul>
  </section>)}
  {current&&image&&open&&<div className={styles.viewer} role="dialog" aria-modal="true" aria-label={current.name+' · Bild '+(open.i+1)+' von '+current.images.length}>
   <button type="button" className={styles.close} onClick={()=>setOpen(null)} aria-label="Schließen"><X size={20}/></button>
   <figure><img src={image.url} alt={image.caption||current.name}/><figcaption><strong>{current.name}</strong>{image.caption&&<> · {image.caption}</>} <small>{open.i+1} / {current.images.length}</small></figcaption></figure>
   {current.images.length>1&&<><button type="button" className={styles.prev} onClick={()=>setOpen({c:open.c,i:(open.i+current.images.length-1)%current.images.length})} aria-label="Vorheriges Bild"><ChevronLeft size={28}/></button><button type="button" className={styles.next} onClick={()=>setOpen({c:open.c,i:(open.i+1)%current.images.length})} aria-label="Nächstes Bild"><ChevronRight size={28}/></button></>}
  </div>}
 </div>;
}
