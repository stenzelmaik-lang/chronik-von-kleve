/* eslint-disable @next/next/no-img-element -- Authenticated location media endpoints. */
'use client';
import {useRef,useState} from 'react';
import type {PublicLocationMedia} from '@/domain/location-library';
import {LivePdf} from './live-pdf';
import styles from './location-library.module.css';
export function LocationMediaGallery({media=[]}:{media?:PublicLocationMedia[]}){
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLElement|null>(null);
  const [selected,setSelected]=useState<PublicLocationMedia|null>(null),[zoom,setZoom]=useState(1);
  if(!media.length)return null;
  return <><div className={styles.gallery}>{media.map(item=><figure key={item.id} data-hero={item.hero}><button type="button" onClick={e=>{trigger.current=e.currentTarget;setSelected(item);setZoom(1);dialog.current?.showModal();}}>{item.mime.startsWith('image/')?<img src={item.url} alt={item.title} loading="lazy"/>:<span>{item.mime==='application/pdf'?'PDF · ': 'Dokument · '}{item.title}</span>}<span>{item.title}</span></button>{item.description&&<figcaption>{item.description}</figcaption>}</figure>)}</div><dialog ref={dialog} className={styles.dialog} onClose={()=>{setSelected(null);trigger.current?.focus();}}><div className={styles.heading}><strong>{selected?.title}</strong><div className={styles.tools}>{selected?.mime.startsWith('image/')&&<><button className="button" type="button" onClick={()=>setZoom(z=>Math.max(.5,z-.25))} aria-label="Verkleinern">−</button><span>{Math.round(zoom*100)} %</span><button className="button" type="button" onClick={()=>setZoom(z=>Math.min(5,z+.25))} aria-label="Vergrößern">+</button></>}<button className="button" type="button" onClick={()=>dialog.current?.close()}>Schließen</button></div></div><div className={styles.viewport}>{selected?.mime.startsWith('image/')?<img src={selected.url} alt={selected.title} style={{width:zoom*100+'%'}}/>:selected?.mime==='application/pdf'?<LivePdf url={selected.url} name={selected.title}/>:selected&&<p>Diese geschützte DOCX-Datei kann in einem Textprogramm geöffnet werden. <a href={selected.url}>Datei öffnen</a></p>}</div>{selected?.description&&<p>{selected.description}</p>}</dialog></>;
}
