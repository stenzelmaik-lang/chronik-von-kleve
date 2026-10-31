"use client";
/* eslint-disable @next/next/no-img-element -- Private, authenticated page previews. */
import {ArrowUp,ArrowDown,Trash2,Upload} from 'lucide-react';
import {handoutPagesMax,type MaterialDraft} from '@/domain/table-material';
import type {Upload as StoredFile} from '@/domain/legacy';
import {ProtectedImageGallery} from './protected-image-gallery';
import s from './material-library.module.css';

export function HandoutPages({pages,files,onChange,onUpload,disabled=false}:{pages:MaterialDraft['pages'];files:StoredFile[];onChange:(pages:MaterialDraft['pages'])=>void;onUpload:(files:File[])=>void;disabled?:boolean}){
 function move(index:number,offset:number){const next=[...pages];[next[index],next[index+offset]]=[next[index+offset],next[index]];onChange(next);}
 return <section className={s.pages} aria-label="Handoutseiten"><h3>Ein Handout · mehrere Seiten</h3><p>Zum Beispiel das Anselm-Paket: Bilder gemeinsam auswählen, als Seiten ordnen und später in einem Handout durchblättern. Bis zu {handoutPagesMax} Bildseiten; die Dateien bleiben privat.</p>
  <ol>{pages.map((page,index)=><li key={page.id}><img src={'/api/files?id='+encodeURIComponent(page.fileId)} alt={'Vorschau Seite '+(index+1)} loading="lazy"/><div><strong>Seite {index+1}</strong><span>{page.title||files.find(f=>f.id===page.fileId)?.name||'Bildseite'}</span></div><div className={s.pageActions}><button type="button" disabled={disabled||index===0} aria-label={'Seite '+(index+1)+' nach oben'} onClick={()=>move(index,-1)}><ArrowUp size={16}/></button><button type="button" disabled={disabled||index===pages.length-1} aria-label={'Seite '+(index+1)+' nach unten'} onClick={()=>move(index,1)}><ArrowDown size={16}/></button><button type="button" disabled={disabled} aria-label={'Seite '+(index+1)+' entfernen'} onClick={()=>onChange(pages.filter(p=>p.id!==page.id))}><Trash2 size={16}/></button></div></li>)}</ol>
  {!disabled&&pages.length<handoutPagesMax&&<div className={s.materialActions}><label className={s.upload}><Upload size={17}/>Bildseiten gemeinsam hochladen<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" aria-label="Bildseiten gemeinsam hochladen" onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value='';if(files.length)onUpload(files);}}/></label><ProtectedImageGallery label="Seite aus Galerie ergänzen" files={files} onSelect={id=>{const f=files.find(f=>f.id===id);if(f)onChange([...pages,{id:crypto.randomUUID(),fileId:f.id,title:f.name}]);}}/></div>}
  {disabled&&<small>Zum Anlegen eines Seitenpakets zuerst die Einzeldateizuordnung entfernen.</small>}
 </section>;
}
