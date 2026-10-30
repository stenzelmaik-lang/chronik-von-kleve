/* eslint-disable @next/next/no-img-element -- Existing NPC image references only. */
"use client";
import {useState} from 'react';
import {UserRound,Check,Plus} from 'lucide-react';
import type {CommandReference} from '@/domain/command-workspace';
import s from './story-workspace.module.css';

export function PreparationNPCs({references,values,onChange}:{references:CommandReference[];values:string[];onChange:(ids:string[])=>void}) {
  const [search,setSearch]=useState(''),[open,setOpen]=useState(false);
  const npcs=references.filter(ref=>ref.type==='NPC');
  const visible=npcs.filter(ref=>(open||values.includes(ref.id))&&(!open||ref.title.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de'))));
  return <fieldset className={s.npcPicker}><legend>NPCs dieser Szene</legend>
    <div className={s.materialActions}><button type="button" aria-expanded={open} onClick={()=>setOpen(!open)}><Plus size={16} aria-hidden="true"/>NPCs auswählen</button><small>{values.length}/30 ausgewählt · Originalakten</small></div>
    {open&&<label>NPC suchen<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name …"/></label>}
    <ul>{visible.map(npc=><li key={npc.id}><button type="button" aria-label={npc.title} aria-pressed={values.includes(npc.id)} disabled={!values.includes(npc.id)&&values.length>=30} onClick={()=>onChange(values.includes(npc.id)?values.filter(id=>id!==npc.id):[...values,npc.id])}>{npc.imagePrimary?<img loading="lazy" src={npc.imagePrimary} alt=""/>:<UserRound size={28} aria-hidden="true"/>}<span>{npc.title}</span>{values.includes(npc.id)&&<Check size={17} aria-hidden="true"/>}</button></li>)}</ul>
    {!visible.length&&<p>{!open?'Noch keine NPCs ausgewählt.':npcs.length?'Kein passender NPC gefunden.':'Noch keine NPC-Akten vorhanden. Vorhandene NPCs erscheinen hier, sobald sie in der Kampagne angelegt sind.'}</p>}
    {values.filter(id=>!npcs.some(npc=>npc.id===id)).map(id=><p key={id}>Bestehender NPC-Verweis derzeit nicht verfügbar. Die Zuordnung bleibt erhalten. <button type="button" onClick={()=>onChange(values.filter(value=>value!==id))}>Zuordnung entfernen</button></p>)}
  </fieldset>;
}
