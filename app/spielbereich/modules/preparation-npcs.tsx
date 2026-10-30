/* eslint-disable @next/next/no-img-element -- Existing NPC image references only. */
"use client";
import {useState} from 'react';
import {UserRound} from 'lucide-react';
import type {CommandReference} from '@/domain/command-workspace';
import s from './story-workspace.module.css';

export function PreparationNPCs({references,values,onChange}:{references:CommandReference[];values:string[];onChange:(ids:string[])=>void}) {
  const [search,setSearch]=useState('');
  const npcs=references.filter(ref=>ref.type==='NPC');
  const visible=npcs.filter(ref=>ref.title.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de')));
  return <fieldset className={s.npcPicker}><legend>NPCs dieser Szene</legend>
    <p>Wähle alle Beteiligten. Es werden die Originalakten verknüpft; vorhandene Ganzkörperbilder dienen zur Erkennung.</p>
    <label>NPC suchen<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name …"/></label>
    <ul>{visible.map(npc=><li key={npc.id}><label><input type="checkbox" checked={values.includes(npc.id)} disabled={!values.includes(npc.id)&&values.length>=30} onChange={e=>onChange(e.target.checked?[...values,npc.id]:values.filter(id=>id!==npc.id))}/>{npc.imagePrimary?<img loading="lazy" src={npc.imagePrimary} alt=""/>:<UserRound size={40} aria-hidden="true"/>}<span>{npc.title}{values.includes(npc.id)&&<small>Für diese Szene ausgewählt</small>}</span></label></li>)}</ul>
    {!visible.length&&<p>{npcs.length?'Kein passender NPC gefunden.':'Noch keine NPC-Akten vorhanden. Lege NPCs in der vorhandenen NPC-Verwaltung an; danach stehen sie hier zur Auswahl.'}</p>}
    {values.filter(id=>!npcs.some(npc=>npc.id===id)).map(id=><p key={id}>Bestehender NPC-Verweis derzeit nicht verfügbar. Die Zuordnung bleibt erhalten. <button type="button" onClick={()=>onChange(values.filter(value=>value!==id))}>Zuordnung entfernen</button></p>)}
    <small>{values.length}/30 NPCs ausgewählt</small>
  </fieldset>;
}
