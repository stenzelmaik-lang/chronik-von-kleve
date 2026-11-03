"use client";

import {useState} from 'react';
import {Users} from 'lucide-react';
import type {Actor} from '@/domain/types';
import {ParticipantContent} from '@/app/spielbereich/modules/spieltisch/participant-content';
import styles from './campaign-round.module.css';

export function CampaignRound({actor,members}:{actor:Actor;members:{id:string;name:string}[]}){
 const [selected,setSelected]=useState<string|null>(null);
 return <section className={styles.round} aria-labelledby="campaign-round-title" id="deine-runde">
  <header><Users aria-hidden="true" size={23}/><h2 id="campaign-round-title">Deine Runde</h2></header>
  <p>Hier findest du die freigegebenen Figuren und Spielervorstellungen deiner Chronik.</p>
  <ul className={styles.roster}>{members.map(member=><li key={member.id}>
   <button type="button" aria-pressed={selected===member.id} onClick={()=>setSelected(selected===member.id?null:member.id)}>
    <span aria-hidden="true">{member.name.slice(0,1)}</span>{member.name}{member.id===actor.id&&<small>Du</small>}
   </button>
  </li>)}</ul>
  {selected&&<div className={styles.card}><ParticipantContent key={selected} a={actor} memberId={selected} action="profile"/></div>}
 </section>;
}
