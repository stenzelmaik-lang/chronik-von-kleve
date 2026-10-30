'use client';
import {useState} from 'react';
import {Droplets,Flame,Heart,Activity,EyeOff,Eye,Moon,RotateCcw,Minus,Plus,ChevronRight,ShieldAlert} from 'lucide-react';
import {vitalHealthLevels,damageLabels,damageMarks,controlProfiles,stressBands,stressMaximum,type DamageType,type ControlProfile} from '@/domain/character-vitals';
import type {VitalsSnapshot,TableCharacter} from './types';
import styles from './vitals.module.css';

/** Payload for POST /api/live-vitals without session and run, which the stage adds. */
export type VitalsAction={characterId:string;command:Record<string,unknown>}|{expectedVersion:number;table:Record<string,unknown>}|{group:'night'|'willpower'};
type Run=(action:VitalsAction)=>Promise<boolean>;
const statusLabel={active:'',torpor:'Starre',['final-death']:'Endgültiger Tod'} as const;

/** Paper-sheet boxes: filled up to the current value, faded above the reachable maximum. */
function Boxes({total,filled,reachable=total,label,shape='box',tone}:{total:number;filled:number;reachable?:number;label:string;shape?:'box'|'dot';tone?:string}){
 return <span className={styles.boxes} data-shape={shape} data-tone={tone} role="img" aria-label={label}>{Array.from({length:total},(_,i)=><i key={i} data-on={i<filled} data-off={i>=reachable}/>)}</span>;
}
function BloodBoxes({c,compact=false}:{c:TableCharacter;compact?:boolean}){
 const b=c.vitals.blood;if(b.current===null||b.max===null)return <span className={styles.missing}>nicht erfasst</span>;
 return <Boxes total={compact?Math.min(b.max,20):b.max} filled={compact?Math.min(b.current,20):b.current} label={`Blutvorrat ${b.current} von ${b.max}`} tone="blood"/>;
}
function WillpowerRows({c}:{c:TableCharacter}){
 const w=c.vitals.willpower;if(w.permanent===null)return <span className={styles.missing}>nicht erfasst</span>;
 return <span className={styles.willpower}><Boxes total={10} filled={w.permanent} shape="dot" label={`Willenskraft permanent ${w.permanent}`}/><Boxes total={10} filled={w.temporary??0} reachable={w.permanent} label={`Willenskraft Vorrat ${w.temporary} von ${w.permanent}`} tone="will"/></span>;
}
/** The V20 health chart: one box per level, marked / X * like on paper. */
function HealthChart({c,compact=false}:{c:TableCharacter;compact?:boolean}){
 const h=c.vitals.health;
 if(compact)return <span className={styles.healthMini} role="img" aria-label={`Gesundheit: ${h.level}${h.status!=='active'?', '+statusLabel[h.status]:''}`}>{vitalHealthLevels.map((l,i)=><i key={l.name} data-type={h.track[i]||''}>{h.track[i]?damageMarks[h.track[i] as DamageType]:''}</i>)}</span>;
 return <ol className={styles.healthChart} aria-label="Gesundheitsstufen">{vitalHealthLevels.map((l,i)=>{const t=h.track[i] as DamageType|undefined;return <li key={l.name} data-current={h.track.length===i+1}><span>{l.name}</span><small>{l.penalty===null?'':l.penalty===0?'±0':l.penalty}</small><b data-type={t||''} aria-label={t?damageLabels[t]:'frei'}>{t?damageMarks[t]:''}</b></li>;})}</ol>;
}
function StressBar({value}:{value:number}){
 const band=stressBands.findIndex(b=>value>=b.from&&value<=b.to);
 return <Boxes total={stressMaximum} filled={value} label={`Gruppenstress ${value} von ${stressMaximum}`} tone={'stress'+band}/>;
}
/** A destructive SL step asks once more inline instead of a modal. */
function Confirm({label,confirm,busy,onConfirm,icon}:{label:string;confirm:string;busy:boolean;onConfirm:()=>void;icon?:React.ReactNode}){
 const [armed,setArmed]=useState(false);
 return armed?<span className={styles.confirm}><button type="button" disabled={busy} className={styles.danger} onClick={()=>{setArmed(false);onConfirm();}}>{confirm}</button><button type="button" onClick={()=>setArmed(false)}>Abbrechen</button></span>:<button type="button" disabled={busy} onClick={()=>setArmed(true)}>{icon}{label}</button>;
}

/** Compact, always visible state on the table: own character for players, group pressure for the SL. */
export function VitalsDock({vitals,gm,onOpen}:{vitals:VitalsSnapshot;gm:boolean;onOpen:()=>void}){
 const own=vitals.characters.filter(c=>c.own);
 if(gm)return <button type="button" className={styles.dock} onClick={onOpen} aria-label="Zustände der Runde öffnen">
  <span className={styles.dockTitle}>Zustände · {vitals.characters.length} Figur{vitals.characters.length===1?'':'en'}<ChevronRight size={14}/></span>
  <span className={styles.dockRow}><Activity size={14}/><StressBar value={vitals.stress.value}/><small>{vitals.stress.value}</small></span>
  {vitals.masquerade&&<span className={styles.dockRow}><ShieldAlert size={14}/><Boxes total={vitals.masquerade.max} filled={vitals.masquerade.value} label={`Maskerade-Stufe ${vitals.masquerade.value}`} tone="masq"/><small>{vitals.masquerade.value}</small></span>}
 </button>;
 const c=own[0];if(!c)return null;const b=c.vitals.blood,w=c.vitals.willpower,h=c.vitals.health;
 return <button type="button" className={styles.dock} onClick={onOpen} aria-label={'Zustand von '+c.title+' öffnen'}>
  <span className={styles.dockTitle}>{c.title}{h.status!=='active'&&<em>{statusLabel[h.status]}</em>}<ChevronRight size={14}/></span>
  <span className={styles.dockRow}><Droplets size={14}/><BloodBoxes c={c} compact/><small>{b.current??'–'}/{b.max??'–'}</small></span>
  <span className={styles.dockRow}><Flame size={14}/><Boxes total={10} filled={w.temporary??0} reachable={w.permanent??0} label={`Willenskraft ${w.temporary} von ${w.permanent}`} tone="will"/><small>{w.temporary??'–'}/{w.permanent??'–'}</small></span>
  <span className={styles.dockRow}><Heart size={14}/><HealthChart c={c} compact/><small>{h.penalty===null?'–':h.penalty===0?'±0':h.penalty}</small></span>
  <span className={styles.dockRow}><Activity size={14}/><StressBar value={vitals.stress.value}/><small>{vitals.stress.value}</small></span>
 </button>;
}

function CharacterCard({c,vitals,gm,busy,run}:{c:TableCharacter;vitals:VitalsSnapshot;gm:boolean;busy:boolean;run:Run}){
 const allowed=(op:string)=>vitals.operations.includes(op as never)&&(gm||c.own);
 const act=(command:Record<string,unknown>)=>void run({characterId:c.id,command});
 const [damage,setDamage]=useState<{type:'bashing'|'lethal'|'aggravated';levels:number}>({type:'lethal',levels:1});
 const b=c.vitals.blood,w=c.vitals.willpower,h=c.vitals.health,dead=h.status==='final-death';
 const lock=busy||(dead&&!gm);
 return <section className={styles.card} aria-label={'Zustand '+c.title}>
  <header><div><h3>{c.title}</h3><small>{c.own?'Dein Charakter':c.ownerName}{c.vitals.generation?` · ${c.vitals.generation}. Generation`:''}{!c.own&&!gm?' · freigegeben':''}</small></div>{h.status!=='active'&&<em className={styles.state}>{statusLabel[h.status]}</em>}</header>
  <div className={styles.trait}><h4><Droplets size={15}/>Blutvorrat <small>{b.current??'–'} / {b.max??'–'}{b.perTurn?` · ${b.perTurn} pro Runde`:''}{b.maxSource==='generation'?' · Maximum aus Generation':''}</small></h4><BloodBoxes c={c}/>
   {b.current===0&&<p className={styles.warn}>Ausgehungert: Raserei droht. Selbstbeherrschung höchstens so viele Würfel wie Blut im Vorrat.</p>}
   <div className={styles.actions}>{allowed('blood.spend')&&<button type="button" disabled={lock||!b.current} onClick={()=>act({op:'blood.spend',amount:1})}><Minus size={14}/>1 Blut ausgeben</button>}{allowed('blood.gain')&&<button type="button" disabled={lock||b.current===null||b.current===b.max} onClick={()=>act({op:'blood.gain',amount:1})}><Plus size={14}/>Blut trinken</button>}</div></div>
  <div className={styles.trait}><h4><Flame size={15}/>Willenskraft <small>{w.temporary??'–'} / {w.permanent??'–'}</small></h4><WillpowerRows c={c}/>
   <div className={styles.actions}>{allowed('willpower.spend')&&<button type="button" disabled={lock||!w.temporary||(!gm&&h.status!=='active')} onClick={()=>act({op:'willpower.spend'})}><Minus size={14}/>Willenskraft einsetzen</button>}{allowed('willpower.regain')&&<button type="button" disabled={lock||w.temporary===null||w.temporary===w.permanent} onClick={()=>act({op:'willpower.regain',amount:1})}><Plus size={14}/>Zurückgewinnen</button>}</div>
   {c.own&&allowed('willpower.spend')&&<p className={styles.hint}>Vor dem Wurf ansagen: 1 automatischer Erfolg, Zwang oder Wundabzüge eine Runde lang ignorieren.</p>}</div>
  <div className={styles.trait}><h4><Heart size={15}/>Gesundheit <small>{h.level}{h.penalty?` · ${h.penalty} Würfel`:''}</small></h4><HealthChart c={c}/>
   <p className={styles.legend}>/ Wucht · X Tödlich · * Schwer{h.track.includes('unspecified')?' · ■ Art im alten Bogen nicht erfasst':''}</p>
   <div className={styles.actions}>{allowed('heal.blood')&&<button type="button" disabled={lock||!b.current||!h.track.some(t=>t!=='aggravated')||h.status!=='active'} onClick={()=>act({op:'heal.blood'})}>Normalschaden heilen · 1 Blut</button>}
    {gm&&<button type="button" disabled={busy||(b.current??0)<5||!h.track.includes('aggravated')||h.status!=='active'} onClick={()=>act({op:'heal.blood',aggravated:true})}>Schwere Stufe heilen · 5 Blut</button>}
    {gm&&<button type="button" disabled={busy||!h.track.length} onClick={()=>act({op:'heal',levels:1})}><Minus size={14}/>1 Stufe entfernen</button>}</div>
   {gm&&<form className={styles.damage} onSubmit={e=>{e.preventDefault();act({op:'damage',...damage});}}><label>Art<select value={damage.type} onChange={e=>setDamage(d=>({...d,type:e.target.value as typeof d.type}))}><option value="bashing">Wucht (/)</option><option value="lethal">Tödlich (X)</option><option value="aggravated">Schwer (*)</option></select></label><label>Stufen<input type="number" min={1} max={10} value={damage.levels} onChange={e=>setDamage(d=>({...d,levels:Math.max(1,Math.min(10,Number(e.target.value)||1))}))}/></label><button type="submit" disabled={busy}>Schaden eintragen</button><small>Nach dem Aufsaugen; Wucht bei Vampiren bereits halbiert.</small></form>}
  </div>
  {gm&&<footer className={styles.footer}>
   <Confirm label="Gesundheit zurücksetzen" confirm="Wirklich alle Wunden entfernen" busy={busy} icon={<RotateCcw size={14}/>} onConfirm={()=>act({op:'reset',target:'health'})}/>
   <Confirm label="Willenskraft voll" confirm="Vorrat auf permanent setzen" busy={busy} icon={<RotateCcw size={14}/>} onConfirm={()=>act({op:'reset',target:'willpower'})}/>
   <Confirm label="Blut voll" confirm="Blut auf Maximum setzen" busy={busy} icon={<RotateCcw size={14}/>} onConfirm={()=>act({op:'reset',target:'blood'})}/>
   {h.status!=='active'&&<Confirm label="Status: aktiv" confirm="Starre/Tod aufheben" busy={busy} onConfirm={()=>act({op:'set',status:'active'})}/>}
   <button type="button" disabled={busy} aria-pressed={c.shared} onClick={()=>void run({expectedVersion:vitals.version,table:{op:'settings',share:{characterId:c.id,shared:!c.shared}}})}>{c.shared?<Eye size={14}/>:<EyeOff size={14}/>}{c.shared?'Für Runde sichtbar':'Nur Besitzer & SL'}</button>
  </footer>}
 </section>;
}

/** Drawer content: full condition sheet for players, overview with quick actions for the SL. */
export function VitalsPanel({vitals,gm,busy,run}:{vitals:VitalsSnapshot;gm:boolean;busy:boolean;run:Run}){
 const table=(t:Record<string,unknown>)=>void run({expectedVersion:vitals.version,table:t});
 const profile=controlProfiles[vitals.profile as ControlProfile];
 const own=vitals.characters.filter(c=>c.own),others=vitals.characters.filter(c=>!c.own);
 return <div className={styles.panel}>
  <section className={styles.group} aria-label="Gruppenwerte">
   <h3><Activity size={15}/>Gruppenstress <small>{vitals.stress.value} / {stressMaximum} · {vitals.stress.label}</small></h3><StressBar value={vitals.stress.value}/>
   <p className={styles.hint}>{vitals.stress.effect}</p>
   {gm&&<div className={styles.actions}><button type="button" disabled={busy||vitals.stress.value===0} onClick={()=>table({op:'stress',delta:-1})}><Minus size={14}/>Stress −1</button><button type="button" disabled={busy||vitals.stress.value===stressMaximum} onClick={()=>table({op:'stress',delta:1})}><Plus size={14}/>Stress +1</button></div>}
   {vitals.masquerade&&<><h3><ShieldAlert size={15}/>Maskerade-Stufe <small>{vitals.masquerade.value} / {vitals.masquerade.max}{gm&&!vitals.settings?.masqueradeVisible?' · nur SL':''}</small></h3><Boxes total={vitals.masquerade.max} filled={vitals.masquerade.value} label={`Maskerade-Stufe ${vitals.masquerade.value} von ${vitals.masquerade.max}`} tone="masq"/>
    {gm&&<div className={styles.actions}><button type="button" disabled={busy||vitals.masquerade.value===0} onClick={()=>table({op:'masquerade',delta:-1})}><Minus size={14}/>Stufe −1</button><button type="button" disabled={busy||vitals.masquerade.value===vitals.masquerade.max} onClick={()=>table({op:'masquerade',delta:1})}><Plus size={14}/>Stufe +1</button></div>}</>}
   {gm&&<div className={styles.actions}>
    <Confirm label="Neue Nacht" confirm={'Alle: −1 Blut beim Erwachen'+(vitals.settings?.nightlyWillpower?', +1 Willenskraft':'')} busy={busy} icon={<Moon size={14}/>} onConfirm={()=>void run({group:'night'})}/>
    <Confirm label="Alle −1 Willenskraft" confirm="Bruchpunkt anwenden" busy={busy} icon={<Flame size={14}/>} onConfirm={()=>void run({group:'willpower'})}/>
   </div>}
  </section>
  {!vitals.characters.length&&<p className={styles.hint}>{gm?'Noch keine spielbereite Figur an diesem Tisch. Entwürfe in Prüfung erscheinen erst nach Bestätigung.':'Für dich ist an diesem Tisch kein spielbereiter Charakter hinterlegt.'}</p>}
  {own.map(c=><CharacterCard key={c.id} c={c} vitals={vitals} gm={gm} busy={busy} run={run}/>)}
  {others.map(c=><CharacterCard key={c.id} c={c} vitals={vitals} gm={gm} busy={busy} run={run}/>)}
  {!gm&&<p className={styles.hint}>Steuerung „{profile.label}“: {profile.description}</p>}
  {gm&&vitals.settings&&<details className={styles.settings}><summary>Steuerung & Freigaben</summary>
   <fieldset><legend>Wer bucht was?</legend>{(Object.keys(controlProfiles) as ControlProfile[]).map(id=><label key={id}><input type="radio" name="vitals-profile" checked={vitals.profile===id} disabled={busy} onChange={()=>table({op:'settings',profile:id})}/><span><b>{controlProfiles[id].label}</b> {controlProfiles[id].description}</span></label>)}</fieldset>
   <label className={styles.check}><input type="checkbox" checked={vitals.settings.masqueradeVisible} disabled={busy} onChange={e=>table({op:'settings',masqueradeVisible:e.target.checked})}/>Maskerade-Stufe für Spieler sichtbar</label>
   <label className={styles.check}>Maskerade-Skala bis<select value={vitals.masquerade?.max??5} disabled={busy} onChange={e=>table({op:'settings',masqueradeMax:Number(e.target.value)})}>{[3,4,5,6,7,8,9,10].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
   <label className={styles.check}><input type="checkbox" checked={vitals.settings.nightlyWillpower} disabled={busy} onChange={e=>table({op:'settings',nightlyWillpower:e.target.checked})}/>Neue Nacht: +1 Willenskraft (V20-Option der SL)</label>
  </details>}
  {gm&&(!!vitals.history?.length||!!vitals.log?.length)&&<details className={styles.settings}><summary>Verlauf</summary><ol className={styles.log}>
   {[...(vitals.history||[]).map(h=>({id:h.id,at:h.at,text:`${h.character}: ${h.text}`,actor:h.actor})),...(vitals.log||[]).map(l=>({id:l.id,at:l.at,text:l.text,actor:l.actor}))].sort((x,y)=>y.at.localeCompare(x.at)).slice(0,25).map(e=><li key={e.id}><time dateTime={e.at}>{new Date(e.at).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</time> {e.text}<small> · {e.actor}</small></li>)}
  </ol></details>}
 </div>;
}
