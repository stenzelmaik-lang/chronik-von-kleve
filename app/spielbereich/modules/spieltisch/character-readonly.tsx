'use client';
/* eslint-disable @next/next/no-img-element -- Authenticated portrait endpoint. */
import {useState} from 'react';
import {UserRound,Dumbbell,BookOpen,Sparkles,Heart,ScrollText} from 'lucide-react';
import {CharacterListReadout,attrsGroups,skillGroups,type CharacterDetailProjection} from '../character';
import {RichTextView} from '../rich-text';
import {CharacterSheet} from '../character-sheet/character-sheet';
import styles from './participants.module.css';
import {W10_ATTRIBUTE_KEYS,W10_ABILITY_KEYS} from '@/domain/trait-ids';
import type {TableCharacter} from './types';
const dots=(v:unknown)=>{const n=Math.max(0,Math.min(10,Number(v)||0));return '●'.repeat(n)+'○'.repeat(Math.max(0,5-n));};
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
export function CharacterReadOnly({projection:p,live,checkSelection,checkPreset,onCheckSelect,selectionLocked}:{projection:CharacterDetailProjection;live?:TableCharacter;checkSelection?:{attributeId?:string;abilityId?:string};checkPreset?:{attributeId?:string;abilityId?:string};onCheckSelect?:(part:'attributeId'|'abilityId',id:string)=>void;selectionLocked?:boolean}){
 const [section,setSection]=useState(onCheckSelect?'attributes':'identity'),s=p.sheet;
 const current=live&&live.id===p.identity.id&&live.version>=p.revision.version?live.vitals:undefined;
 const traitButtons=(kind:'attributeId'|'abilityId',groups:readonly (readonly [string,readonly string[]])[],values:Record<string,unknown>)=>{const ids=kind==='attributeId'?W10_ATTRIBUTE_KEYS:W10_ABILITY_KEYS;return <div className={styles.ratingGrid}>{groups.map(([title,names])=><section key={title}><h4>{title}</h4>{names.map(name=>{const id=Object.entries(ids).find(([,label])=>label===name)?.[0];return id?<button key={name} type="button" className={styles.checkTrait} aria-pressed={checkSelection?.[kind]===id} data-preset={checkPreset?.[kind]===id||undefined} disabled={selectionLocked?checkSelection?.[kind]!==id:!!checkPreset?.[kind]&&checkPreset[kind]!==id} aria-label={name+' '+String(values[name]??0)+(checkPreset?.[kind]===id?', von der Spielleitung vorgegeben':'')} onClick={()=>onCheckSelect?.(kind,id)}><span>{name}</span><b aria-hidden>{dots(values[name])}</b></button>:null;})}</section>)}</div>};
 const tabs=[{id:'identity',label:'Identität',icon:UserRound},{id:'attributes',label:'Attribute',icon:Dumbbell},{id:'abilities',label:'Fähigkeiten',icon:BookOpen},{id:'advantages',label:'Vorteile',icon:Sparkles},{id:'resources',label:'Zustände & EP',icon:Heart},{id:'story',label:'Geschichte',icon:ScrollText}];
 return <div className={styles.characterSheet}><p className={styles.caption}>{onCheckSelect?'Charakterbogen · Werte für die Probe':'Charakterbogen · nur lesen'}</p><nav className={styles.sectionTabs} role="tablist" aria-label="Charakterbogenabschnitte" onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const i=tabs.findIndex(t=>t.id===section),next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;setSection(tabs[next].id);e.currentTarget.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();}}>{tabs.map(t=><button role="tab" id={'sheet-tab-'+t.id} aria-controls="sheet-section" aria-selected={section===t.id} tabIndex={section===t.id?0:-1} key={t.id} onClick={()=>setSection(t.id)}><t.icon size={16}/>{t.label}</button>)}</nav>
 <section id="sheet-section" role="tabpanel" aria-labelledby={'sheet-tab-'+section} tabIndex={0} className={styles.sheetSection}>
 {section==='identity'&&<>{typeof p.identity.portraitRef==='string'&&<img className={styles.characterPortrait} src={p.identity.portraitRef} alt={String(p.identity.name||'Charakter')}/>}<CharacterSheet identity={p.identity} sheet={s} progression={p.progression} layout="narrow" section="identity"/></>}
 {section==='attributes'&&(onCheckSelect?<><h3>Attribute</h3>{traitButtons('attributeId',attrsGroups,object(s.attributes))}</>:<CharacterSheet identity={p.identity} sheet={s} progression={p.progression} layout="narrow" section="attributes"/>)}
 {section==='abilities'&&(onCheckSelect?<><h3>Fähigkeiten</h3>{traitButtons('abilityId',skillGroups,object(s.abilities))}<CharacterListReadout label="Freie Fähigkeiten" value={s.customAbilities}/></>:<CharacterSheet identity={p.identity} sheet={s} progression={p.progression} layout="narrow" section="abilities"/>)}
 {section==='advantages'&&<CharacterSheet identity={p.identity} sheet={s} progression={p.progression} layout="narrow" section="advantages"/>}
 {section==='resources'&&<CharacterSheet
  identity={current?{...p.identity,generation:current.generation}:p.identity}
  sheet={current?{...s,blood:{current:current.blood.current,max:current.blood.max,perRound:current.blood.perTurn},willpower:current.willpower,health:current.health}:s}
  progression={p.progression} layout="narrow" section="resources"/>}
 {section==='story'&&<><h3>Geschichte</h3><RichTextView value={String(p.roleplay.backgroundStory||'Noch keine Geschichte hinterlegt.')}/><h4>Spielweise & Ziele</h4><RichTextView value={String(p.roleplay.playGuide||'Keine Angaben.')}/></>}
 </section></div>;
}
