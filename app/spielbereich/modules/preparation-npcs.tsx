/* eslint-disable @next/next/no-img-element -- Existing NPC image references only. */
"use client";
import {useState} from 'react';
import {UserRound,Check,X} from 'lucide-react';
import type {CommandReference} from '@/domain/command-workspace';
import {PreparationPanel} from './preparation-panel';
import panel from './preparation-panel.module.css';
import s from './story-workspace.module.css';

export function PreparationNPCs({references,values,onChange}:{references:CommandReference[];values:string[];onChange:(ids:string[])=>void}) {
  const [search,setSearch]=useState(''),[open,setOpen]=useState(false);
  const npcs=references.filter(ref=>ref.type==='NPC');
  const visible=npcs.filter(ref=>ref.title.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de')));
  const selected=npcs.filter(npc=>values.includes(npc.id));
  const toggle=(id:string)=>onChange(values.includes(id)?values.filter(value=>value!==id):[...values,id]);
  return <fieldset className={s.npcPicker}><legend>NPCs dieser Szene</legend>
    <div className={s.materialActions}><PreparationPanel label="NPCs auswählen" icon={<UserRound size={17} aria-hidden="true"/>} open={open} onOpenChange={setOpen} wide>
      <label>NPC suchen<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name …"/></label>
      <p>{values.length}/30 ausgewählt · Originalakten bleiben verknüpft.</p>
      <ul className={panel.choiceGrid}>{visible.map(npc=><li key={npc.id}><button type="button" aria-label={npc.title} aria-pressed={values.includes(npc.id)} disabled={!values.includes(npc.id)&&values.length>=30} onClick={()=>toggle(npc.id)}>{npc.imagePrimary?<img loading="lazy" src={npc.imagePrimary} alt=""/>:<UserRound size={26} aria-hidden="true"/>}<span>{npc.title}<small>{values.includes(npc.id)?'Ausgewählt':'Zur Szene hinzufügen'}</small></span>{values.includes(npc.id)&&<Check size={17} aria-hidden="true"/>}</button></li>)}</ul>
      {!visible.length&&<p>{npcs.length?'Kein passender NPC gefunden.':'Noch keine NPC-Akten vorhanden.'}</p>}
      <div className={panel.actions}><button type="button" onClick={()=>setOpen(false)}>Auswahl übernehmen</button></div>
    </PreparationPanel><small>{values.length}/30 ausgewählt</small></div>
    {!!selected.length&&<ul className={s.selectedPeople}>{selected.map(npc=><li key={npc.id}>{npc.imagePrimary?<img loading="lazy" src={npc.imagePrimary} alt=""/>:<UserRound size={22} aria-hidden="true"/>}<span>{npc.title}</span><button type="button" aria-label={'NPC entfernen: '+npc.title} onClick={()=>toggle(npc.id)}><X size={15} aria-hidden="true"/></button></li>)}</ul>}
    {!values.length&&<p>Wähle die NPCs, die an dieser Szene beteiligt sind.</p>}
    {values.filter(id=>!npcs.some(npc=>npc.id===id)).map(id=><p key={id}>Bestehender NPC-Verweis derzeit nicht verfügbar. Die Zuordnung bleibt erhalten. <button type="button" onClick={()=>onChange(values.filter(value=>value!==id))}>Zuordnung entfernen</button></p>)}
  </fieldset>;
}
