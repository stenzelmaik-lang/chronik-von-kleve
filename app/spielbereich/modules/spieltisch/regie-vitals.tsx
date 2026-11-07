"use client";
import {useState} from 'react';
import {Droplets,Flame,Heart,Activity,ShieldAlert,Moon,Minus,Plus,Settings2,ChevronDown} from 'lucide-react';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import {damageMarks,roundViews,roundViewLabels,damageModes,damageModeLabels,stressMaximum,type DamageType} from '@/domain/character-vitals';
import type {Snapshot} from './types';
import styles from './regie-window.module.css';

type Vitals=NonNullable<Snapshot['vitals']>;
type Run=(body:Record<string,unknown>,done?:string)=>Promise<boolean>;

/**
 * Condition values of the whole round in the Regie window, with quick actions. It only sends the existing
 * /api/live-vitals commands (through the stage client); rights and rules stay on the server.
 */
export function RegieVitals({vitals,crew,busy,run}:{vitals:Vitals;crew:Snapshot['crew'];busy:boolean;run:Run}){
 const [night,setNight]=useState(false);
 const char=(characterId:string,command:Record<string,unknown>,done:string)=>run({action:'vitals',characterId,command},done);
 const table=(t:Record<string,unknown>,done:string)=>run({action:'vitals',expectedVersion:vitals.version,table:t},done);
 return <div className={styles.vitals}>
  <div className={styles.vitalsToolbar}>
   <div className={styles.vitalsResources} role="group" aria-label="Gruppenwerte">
    <div className={styles.vitalsRow}>
     <span><Activity size={14}/> Gruppenstress <b>{vitals.stress.value}/{stressMaximum}</b></span>
     <button type="button" aria-label="Gruppenstress −1" disabled={busy||!vitals.stress.value} onClick={()=>void table({op:'stress',delta:-1},'Gruppenstress −1.')}><Minus/></button>
     <button type="button" aria-label="Gruppenstress +1" disabled={busy||vitals.stress.value===stressMaximum} onClick={()=>void table({op:'stress',delta:1},'Gruppenstress +1.')}><Plus/></button>
    </div>
    {vitals.masquerade&&<div className={styles.vitalsRow}>
     <span><ShieldAlert size={14}/> Maskerade <b>{vitals.masquerade.value}/{vitals.masquerade.max}</b></span>
     <button type="button" aria-label="Maskerade −1" disabled={busy||!vitals.masquerade.value} onClick={()=>void table({op:'masquerade',delta:-1},'Maskerade −1.')}><Minus/></button>
     <button type="button" aria-label="Maskerade +1" disabled={busy||vitals.masquerade.value===vitals.masquerade.max} onClick={()=>void table({op:'masquerade',delta:1},'Maskerade +1.')}><Plus/></button>
    </div>}
   </div>
   <div className={styles.actions}>
    <button type="button" disabled={busy} aria-expanded={night} onClick={()=>setNight(value=>!value)}><Moon/> Neue Nacht</button>
    <Popover>
     <PopoverTrigger asChild><button type="button"><Settings2/> Rundenregeln <ChevronDown size={14}/></button></PopoverTrigger>
     <PopoverContent align="end" sideOffset={8} collisionPadding={10} className={styles.controlPopover} aria-label="Rundenregeln">
      <h3>Rundenregeln</h3>
      <label className={styles.vitalsSetting}>Blut, Willenskraft und Schaden
       <select aria-label="Sichtbarkeit der Rundenwerte" value={vitals.roundView} disabled={busy} onChange={e=>void table({op:'settings',roundView:e.target.value},'Sichtbarkeit geändert.')}>
        {roundViews.map(id=><option key={id} value={id}>{roundViewLabels[id]}</option>)}
       </select>
      </label>
      <label className={styles.vitalsSetting}>Schaden trägt ein
       <select aria-label="Wer trägt Schaden ein" value={vitals.damageBy} disabled={busy} onChange={e=>void table({op:'settings',damageBy:e.target.value},'Schadensrecht geändert.')}>
        {damageModes.map(id=><option key={id} value={id}>{damageModeLabels[id]}</option>)}
       </select>
      </label>
     </PopoverContent>
    </Popover>
   </div>
  </div>
  {night&&<div className={styles.nightConfirm} role="group" aria-label="Neue Nacht bestätigen">
   <span>Alle Figuren verlieren beim Erwachen einen Blutpunkt.</span>
   <div className={styles.actions}>
    <button type="button" className={styles.primary} disabled={busy} onClick={async()=>{if(await run({action:'vitals',group:'night'},'Neue Nacht für alle.'))setNight(false);}}>Neue Nacht beginnen</button>
    <button type="button" onClick={()=>setNight(false)}>Abbrechen</button>
   </div>
  </div>}
  <ul className={styles.vitalsList} aria-label="Zustände der Figuren">{vitals.characters.map(c=>{const b=c.vitals.blood,w=c.vitals.willpower,h=c.vitals.health,presence=crew.find(m=>m.id===c.ownerId)?.presence||'offline';
   return <li key={c.id} data-vitals-character={c.id} data-status={h.status}>
    <header>
     <span className={styles.presence} data-state={presence} aria-hidden="true"/>
     <div><strong>{c.title}</strong><small>{c.ownerName}</small></div>
     <em>{h.status==='active'?h.level+(h.penalty?' · '+h.penalty:''):h.status==='torpor'?'Starre':'Endgültiger Tod'}</em>
    </header>
    <span className={styles.track} role="img" aria-label={'Gesundheit '+h.level}>{Array.from({length:7},(_,i)=><i key={i} data-type={h.track[i]||''}>{h.track[i]?damageMarks[h.track[i] as DamageType]:''}</i>)}</span>
    <div className={styles.vitalsResources}>
     <div className={styles.vitalsRow}>
      <span><Droplets size={14}/> Blut <b>{b.current??'–'}/{b.max??'–'}</b></span>
      <button type="button" aria-label={c.title+': 1 Blut ausgeben'} disabled={busy||!b.current} onClick={()=>void char(c.id,{op:'blood.spend',amount:1},c.title+': −1 Blut.')}><Minus/></button>
      <button type="button" aria-label={c.title+': 1 Blut dazu'} disabled={busy||b.current===null||b.current===b.max} onClick={()=>void char(c.id,{op:'blood.gain',amount:1},c.title+': +1 Blut.')}><Plus/></button>
     </div>
     <div className={styles.vitalsRow}>
      <span><Flame size={14}/> WK <b>{w.temporary??'–'}/{w.permanent??'–'}</b></span>
      <button type="button" aria-label={c.title+': Willenskraft einsetzen'} disabled={busy||!w.temporary} onClick={()=>void char(c.id,{op:'willpower.spend'},c.title+': −1 Willenskraft.')}><Minus/></button>
      <button type="button" aria-label={c.title+': Willenskraft zurück'} disabled={busy||w.temporary===null||w.temporary===w.permanent} onClick={()=>void char(c.id,{op:'willpower.regain',amount:1},c.title+': +1 Willenskraft.')}><Plus/></button>
     </div>
    </div>
    <div className={styles.vitalsRow}>
     <span><Heart size={14}/> Schaden</span>
     {([['bashing','/ Wucht'],['lethal','X Tödlich'],['aggravated','* Schwer']] as const).map(([type,label])=><button type="button" key={type} aria-label={c.title+': 1 '+label.slice(2)} disabled={busy} onClick={()=>void char(c.id,{op:'damage',type,levels:1},c.title+': 1 Stufe '+label.slice(2)+'.')}>+{label}</button>)}
     <button type="button" aria-label={c.title+': 1 Stufe heilen'} disabled={busy||!h.track.length} onClick={()=>void char(c.id,{op:'heal',levels:1},c.title+': 1 Stufe geheilt.')}>Heilen</button>
    </div>
    <div className={styles.vitalsRow}>
     <span><Activity size={14}/> Stress <b>{c.stress.value}/{stressMaximum}</b> <small>{c.stress.label}</small></span>
     <button type="button" aria-label={c.title+': Stress −1'} disabled={busy||!c.stress.value} onClick={()=>void table({op:'personalStress',characterId:c.id,delta:-1},c.title+': Stress −1.')}><Minus/></button>
     <button type="button" aria-label={c.title+': Stress +1'} disabled={busy||c.stress.value===stressMaximum} onClick={()=>void table({op:'personalStress',characterId:c.id,delta:1},c.title+': Stress +1.')}><Plus/></button>
    </div>
   </li>;})}</ul>
  {!vitals.characters.length&&<p className={styles.muted}>Noch keine spielbereite Figur am Tisch.</p>}
 </div>;
}
