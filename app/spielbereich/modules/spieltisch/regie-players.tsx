'use client';
import {lazy,Suspense,useState} from 'react';
import {Backpack,Link2,ScrollText} from 'lucide-react';
import {ConnectionDesk} from '../connection-requests';
import type {Actor} from '@/domain/types';
import type {VitalsSnapshot} from './types';
import {CharacterCard,type VitalsAction} from './vitals';
import styles from './vitals.module.css';

const Content=lazy(()=>import('./participant-content').then(m=>({default:m.ParticipantContent})));

/**
 * Regie · Spieler am Tisch: every character of the round with the full SL controls (blood, willpower, damage,
 * healing, personal stress, resets, sharing), plus the player's inventory and sheet on demand. Rights stay on the server.
 */
export function RegiePlayers({a,sessionId,vitals,busy,run}:{a:Actor;sessionId:string;vitals?:VitalsSnapshot;busy:boolean;run:(action:VitalsAction)=>Promise<boolean>}){
 const [open,setOpen]=useState<Record<string,'inventory'|'sheet'|'connections'|null>>({});
 if(!vitals)return <p className={styles.hint}>Zustandswerte werden geladen …</p>;
 const hidden=vitals.settings?.hideGmCharacters!==false;
 const gmSwitch=vitals.settings&&<label className={styles.gmSwitch}><input type="checkbox" checked={!hidden} disabled={busy} onChange={e=>void run({expectedVersion:vitals.version,table:{op:'settings',hideGmCharacters:!e.target.checked}})}/><span><strong>SL-Charaktere am Tisch zeigen</strong><small>{hidden?'Ausgeblendet: Niemand sieht sie am Tisch, auch du nicht.':'Eingeblendet: Sie stehen in der Runde wie alle anderen.'}</small></span></label>;
 if(!vitals.characters.length)return <div className={styles.panel}>{gmSwitch}<p className={styles.hint}>Noch kein spielbereiter Charakter an diesem Tisch. Entwürfe in Prüfung erscheinen erst nach Bestätigung.</p></div>;
 return <div className={styles.panel}>
  {gmSwitch}
  {vitals.characters.map(c=><div key={c.id} className={styles.playerBlock}>
   <p className={styles.playerOwner}>{c.ownerName}</p>
   <CharacterCard c={c} vitals={vitals} gm busy={busy} run={run}/>
   <div className={styles.actions}>
    <button type="button" aria-pressed={open[c.id]==='inventory'} onClick={()=>setOpen(o=>({...o,[c.id]:o[c.id]==='inventory'?null:'inventory'}))}><Backpack size={14}/>Inventar</button>
    <button type="button" aria-pressed={open[c.id]==='sheet'} onClick={()=>setOpen(o=>({...o,[c.id]:o[c.id]==='sheet'?null:'sheet'}))}><ScrollText size={14}/>Charakterbogen</button>
    <button type="button" aria-pressed={open[c.id]==='connections'} onClick={()=>setOpen(o=>({...o,[c.id]:o[c.id]==='connections'?null:'connections'}))}><Link2 size={14}/>Verbindungen</button>
   </div>
   {open[c.id]==='connections'&&<div className={styles.playerDetail}><ConnectionDesk characterId={c.id}/></div>}
   {(open[c.id]==='inventory'||open[c.id]==='sheet')&&<div className={styles.playerDetail}><Suspense fallback={<p className={styles.hint}>Wird geladen …</p>}><Content key={open[c.id]} a={a} sessionId={sessionId} memberId={c.ownerId} initialCharacterId={c.id} liveCharacters={vitals.characters} action={open[c.id] as 'inventory'|'sheet'}/></Suspense></div>}
  </div>)}
 </div>;
}
