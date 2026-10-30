/* eslint-disable @next/next/no-img-element -- Protected existing file endpoints. */
"use client";
import {useId,useState,type MouseEvent} from 'react';
import {Images,Check} from 'lucide-react';
import s from './rich-text.module.css';

export type PreparationFile={id:string;name:string;mime:string};
export function ProtectedImageGallery({files,onSelect,label='Galerie',selected='',disabled=false,onOpen}:{files:PreparationFile[];onSelect:(id:string)=>void;label?:string;selected?:string;disabled?:boolean;onOpen?:(event:MouseEvent)=>void}) {
  const [open,setOpen]=useState(false),[search,setSearch]=useState('');
  const id=useId();
  const images=files.filter(file=>file.mime.startsWith('image/')&&file.name.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de')));
  return <div className={s.gallery}>
    <button type="button" disabled={disabled} aria-expanded={open} aria-controls={id} onMouseDown={onOpen} onClick={()=>setOpen(!open)}><Images size={17} aria-hidden="true"/>{label}</button>
    {open&&<section id={id} aria-label={label+' Bildauswahl'}><label>Bilder suchen<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Bildname …"/></label>
      <p>Vorhandene Bilder. Die Auswahl ändert keine Freigabe.</p>
      {!images.length&&<p>{search?'Keine passenden Bilder.':'Noch keine Bilder vorhanden.'}</p>}
      <ul className={s.galleryGrid}>{images.map(file=><li key={file.id}><button type="button" disabled={disabled} aria-label={'Bild auswählen: '+file.name} aria-pressed={selected===file.id} onClick={()=>{onSelect(file.id);setOpen(false);}}><img loading="lazy" src={'/api/files?id='+encodeURIComponent(file.id)} alt=""/><span>{file.name}</span>{selected===file.id&&<Check size={16} aria-hidden="true"/>}</button></li>)}</ul>
    </section>}
  </div>;
}
