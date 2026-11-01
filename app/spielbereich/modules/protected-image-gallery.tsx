/* eslint-disable @next/next/no-img-element -- Protected existing file endpoints. */
"use client";
import {useState,type MouseEvent} from 'react';
import {Images,Check} from 'lucide-react';
import {PreparationPanel} from './preparation-panel';
import s from './rich-text.module.css';
import {ThumbImage} from './file-thumb';

export type PreparationFile={id:string;name:string;mime:string};
export function ProtectedImageGallery({files,onSelect,label='Galerie',selected='',disabled=false,onOpen}:{files:PreparationFile[];onSelect:(id:string)=>void;label?:string;selected?:string;disabled?:boolean;onOpen?:(event:MouseEvent)=>void}) {
  const [open,setOpen]=useState(false),[search,setSearch]=useState('');
  const images=files.filter(file=>file.mime.startsWith('image/')&&file.name.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de')));
  return <PreparationPanel label={label} open={open} onOpenChange={setOpen} wide disabled={disabled} icon={<Images size={17} aria-hidden="true"/>} onTriggerMouseDown={onOpen}>
    <label>Bilder suchen<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Bildname …"/></label>
    <p>Vorhandene Bilder · Auswahl ändert keine Freigabe.</p>
    {!images.length&&<p>{search?'Keine passenden Bilder.':'Noch keine Bilder vorhanden.'}</p>}
    <ul className={s.galleryGrid}>{images.map(file=><li key={file.id}><button type="button" disabled={disabled} aria-label={'Bild auswählen: '+file.name} aria-pressed={selected===file.id} onClick={()=>{onSelect(file.id);setOpen(false);}}><ThumbImage id={file.id}/><span>{file.name}</span>{selected===file.id&&<Check size={16} aria-hidden="true"/>}</button></li>)}</ul>
  </PreparationPanel>;

}
