'use client';
import {useEffect,useRef,useState} from 'react';
import {Droplets,Flame,Heart,Activity,EyeOff,Eye,Moon,RotateCcw,Minus,Plus,ChevronRight,ShieldAlert,User,Users} from 'lucide-react';
import {vitalHealthLevels,damageLabels,damageMarks,controlProfiles,stressBands,stressMaximum,personalStressEffect,masqueradeViews,masqueradeViewLabels,roundViews,roundViewLabels,damageModes,damageModeLabels,type DamageType,type ControlProfile,type MasqueradeView} from '@/domain/character-vitals';
import type {VitalsSnapshot,TableCharacter,Snapshot} from './types';
import styles from './vitals.module.css';

/** Payload for POST /api/live-vitals without session and run, which the stage adds. */
export type VitalsAction={characterId:string;command:Record<string,unknown>}|{expectedVersion:number;table:Record<string,unknown>}|{group:'night'|'willpower'};
type Run=(action:VitalsAction)=>Promise<boolean>;
const statusLabel={active:'',torpor:'Starre',['final-death']:'Endgültiger Tod'} as const;

/** Paper-sheet boxes: filled up to the current value, faded above the reachable maximum. */
function Boxes({total,filled,reachable=total,label,shape='box',tone}:{total:number;filled:number;reachable?:number;label:string;shape?:'box'|'dot';tone?:string}){
 return <span className={styles.boxes} data-shape={shape} data-tone={tone} role="img" aria-label={label}>{Array.from({length:total},(_,i)=><i key={i} data-on={i<filled} data-off={i>=reachable}/>)}</span>;
}
function BloodBoxes({c}:{c:TableCharacter}){
 const b=c.vitals.blood;if(b.current===null||b.max===null)return <span className={styles.missing}>nicht erfasst</span>;
 return <Boxes total={b.max} filled={b.current} label={`Blutvorrat ${b.current} von ${b.max}`} tone="blood"/>;
}
function WillpowerRows({c}:{c:TableCharacter}){
 const w=c.vitals.willpower;if(w.permanent===null)return <span className={styles.missing}>nicht erfasst</span>;
 return <span className={styles.willpower}><Boxes total={10} filled={w.permanent} shape="dot" label={`Willenskraft permanent ${w.permanent}`}/><Boxes total={10} filled={w.temporary??0} reachable={w.permanent} label={`Willenskraft Vorrat ${w.temporary} von ${w.permanent}`} tone="will"/></span>;
}
/** The V20 health chart: one box per level, marked / X * like on paper. */
function HealthChart({c}:{c:TableCharacter}){
 const h=c.vitals.health;
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

type Tone='ok'|'hurt'|'wounded'|'critical'|'torpor'|'dead';
type Health=TableCharacter['vitals']['health'];
/** How badly a character is hurt, for colour and the table vignette. */
function healthTone(h:Health):Tone{
 if(h.status==='final-death')return 'dead';if(h.status==='torpor')return 'torpor';
 const n=h.track.length;return n===0?'ok':n<=3?'hurt':n<=5?'wounded':'critical';
}
const penaltyText=(p:number|null)=>p===null?'handlungsunfähig':p===0?'kein Abzug':`${p} Würfel`;
function conditionLabel(h:Health){return h.status!=='active'?statusLabel[h.status]:h.track.length?h.level:'Unverletzt';}

/** Seven boxes of the V20 health chart as a wide bar: / Wucht, X Tödlich, * Schwer. */
function HealthBar({h,size='large'}:{h:Health;size?:'large'|'small'}){
 return <span className={styles.healthBar} data-size={size} role="img" aria-label={`Gesundheit: ${conditionLabel(h)}, ${penaltyText(h.penalty)}${h.track.length?', '+h.track.map(t=>damageLabels[t as DamageType]).join(', '):''}`}>
  {vitalHealthLevels.map((l,i)=>{const t=h.track[i] as DamageType|undefined;return <i key={l.name} data-type={t||''} title={l.name}>{t?damageMarks[t]:''}</i>;})}
 </span>;
}
function BloodBar({b}:{b:TableCharacter['vitals']['blood']}){
 if(b.current===null||b.max===null)return <span className={styles.missing}>nicht erfasst</span>;
 const ratio=b.max?b.current/b.max:0;
 return <span className={styles.bloodBar} data-low={b.current===0?'empty':ratio<=.25?'low':''} style={{'--fill':`${Math.round(ratio*100)}%`,'--n':Math.min(b.max,25)} as React.CSSProperties} role="img" aria-label={`Blutvorrat ${b.current} von ${b.max}`}><i/></span>;
}
function WillDots({w}:{w:TableCharacter['vitals']['willpower']}){
 if(w.permanent===null)return <span className={styles.missing}>nicht erfasst</span>;
 return <span className={styles.willDots} role="img" aria-label={`Willenskraft ${w.temporary} von ${w.permanent}`}>{Array.from({length:w.permanent},(_,i)=><i key={i} data-on={i<(w.temporary??0)}/>)}</span>;
}
const stressLevel=(value:number)=>Math.max(0,stressBands.findIndex(b=>value>=b.from&&value<=b.to));
/** Pressure meter: faint zones show the bands, filled steps glow in the colour of their band. */
function Meter({value,total=stressMaximum,label,level}:{value:number;total?:number;label:string;level:number}){
 return <span className={styles.meter} data-level={level} role="img" aria-label={label}>{Array.from({length:total},(_,i)=><i key={i} data-on={i<value} data-zone={total===stressMaximum?stressLevel(i+1):Math.min(3,Math.floor((i+1)/total*3))}/>)}</span>;
}
function PressureRow({icon,name,value,label,level,total,detail}:{icon:React.ReactNode;name:string;value:number;label:string;level:number;total?:number;detail?:string}){
 return <span className={styles.pressureRow} data-level={level}>
  <span className={styles.pressureName}>{icon}<span>{name}</span></span><b className={styles.chip} data-level={level}>{label}</b>
  <Meter value={value} total={total} level={level} label={`${name}: ${label}${detail?' · '+detail:''}`}/>
 </span>;
}

/** Red edges on the player's own view while the character is hurt: the table is seen through their eyes. */
function WoundVignette({c}:{c:TableCharacter}){
 const tone=healthTone(c.vitals.health),hungry=c.vitals.blood.current===0;
 if(tone==='ok'&&!hungry)return null;
 return <div className={styles.vignette} data-tone={tone} data-aggravated={c.vitals.health.track.includes('aggravated')} data-hungry={hungry} aria-hidden="true"/>;
}

type RoundEntry=VitalsSnapshot['round'][number];
type Crew=Snapshot['crew'];
/** Ids whose damage grew since the last snapshot: they flash briefly for everyone at the table. */
function useHits(round:RoundEntry[]){
 const previous=useRef<Map<string,number>|null>(null),[hits,setHits]=useState<string[]>([]);
 const key=round.map(r=>r.id+':'+r.health.track.length+':'+r.health.status).join('|');
 useEffect(()=>{
  const now=new Map(round.map(r=>[r.id,r.health.track.length+(r.health.status==='active'?0:10)]));
  const before=previous.current;previous.current=now;if(!before)return;
  const hit=[...now].filter(([id,n])=>n>(before.get(id)??n)).map(([id])=>id);if(!hit.length)return;
  queueMicrotask(()=>setHits(old=>[...new Set([...old,...hit])]));
  const t=window.setTimeout(()=>setHits(old=>old.filter(id=>!hit.includes(id))),2200);return()=>window.clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to damage changes only
 },[key]);
 return hits;
}
/** Live overview of the round: who is at the table, blood, willpower and damage. Values only; changes run elsewhere. */
function RoundRows({round,crew,hits,limit}:{round:RoundEntry[];crew:Crew;hits:string[];limit:number}){
 return <>{round.slice(0,limit).map(r=>{const presence=crew.find(m=>m.id===r.ownerId)?.presence||'offline',hit=hits.includes(r.id);return <span key={r.id} className={styles.roundRow} data-round-character={r.id} data-tone={healthTone({...r.health,penalty:r.health.penalty})} data-hit={hit||undefined}>
  <span className={styles.roundName}><span className={styles.presenceDot} data-state={presence} title={presence}/>{r.title}{hit&&<b className={styles.hitLabel} role="status">Schaden!</b>}</span>
  <HealthBar h={{...r.health,penalty:r.health.penalty}} size="small"/>
  <small aria-label={`Blut ${r.blood.current??'–'} von ${r.blood.max??'–'}`}><Droplets size={11}/>{r.blood.current??'–'}/{r.blood.max??'–'}</small>
  <small aria-label={`Willenskraft ${r.willpower.temporary??'–'} von ${r.willpower.permanent??'–'}`}><Flame size={11}/>{r.willpower.temporary??'–'}/{r.willpower.permanent??'–'}</small>
  {(r.health.track.length>0||r.health.status!=='active')&&<small className={styles.roundLevel}>{conditionLabel({...r.health,penalty:r.health.penalty})}</small>}
 </span>;})}{round.length>limit&&<small className={styles.more}>+{round.length-limit} weitere</small>}</>;
}

/** Part 1 on the table: body, blood and willpower of the own character plus the live round (players) or the whole round (SL). */
/**
 * The live overview makes the body box taller. The released narration keeps its bottom edge above it: the box
 * publishes its height as --vitals-reserve on the stage host (distance from the narration's top edge included).
 */
function useReserve(){
 const ref=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const el=ref.current,host=el?.closest<HTMLElement>('[data-chroniplay-stage]');if(!el||!host)return;
  const set=()=>{const h=el.offsetHeight;host.style.setProperty('--vitals-reserve',(h+96)+'px');host.style.setProperty('--vitals-reserve-mobile',(h+164)+'px');};
  set();const o=new ResizeObserver(set);o.observe(el);return()=>{o.disconnect();host.style.removeProperty('--vitals-reserve');host.style.removeProperty('--vitals-reserve-mobile');};});
 return ref;
}
function BodyHud({vitals,gm,crew,onOpen,hidden,panelOpen}:{vitals:VitalsSnapshot;gm:boolean;crew:Crew;onOpen:()=>void;hidden:boolean;panelOpen:boolean}){
 const round=vitals.round||[],hits=useHits(round),reserve=useReserve();
 if(gm){
  return <button ref={reserve} type="button" className={`${styles.hudBox} ${styles.bodyHud}`} data-hidden={hidden} data-panel={panelOpen} onClick={onOpen} aria-label="Zustände der Runde öffnen">
   <span className={styles.hudTitle}><Heart size={14}/><span className={styles.hudName}>Runde · {round.length} Figur{round.length===1?'':'en'}</span><ChevronRight size={14}/></span>
   <RoundRows round={round} crew={crew} hits={hits} limit={6}/>
   {!round.length&&<small className={styles.more}>Noch keine spielbereite Figur</small>}
  </button>;
 }
 const c=vitals.characters.find(x=>x.own),others=round.filter(r=>!r.own);
 if(!c)return others.length?<button ref={reserve} type="button" className={`${styles.hudBox} ${styles.bodyHud}`} data-hidden={hidden} data-panel={panelOpen} onClick={onOpen} aria-label="Zustände der Runde öffnen"><span className={styles.hudTitle}><Users size={14}/><span className={styles.hudName}>Am Tisch</span><ChevronRight size={14}/></span><RoundRows round={others} crew={crew} hits={hits} limit={5}/></button>:null;
 const b=c.vitals.blood,w=c.vitals.willpower,h=c.vitals.health,tone=healthTone(h);
 return <button ref={reserve} type="button" className={`${styles.hudBox} ${styles.bodyHud}`} data-hidden={hidden} data-panel={panelOpen} data-tone={tone} onClick={onOpen} aria-label={`Zustand von ${c.title}: ${conditionLabel(h)}. Öffnen`}>
  <span className={styles.hudTitle}><Heart size={15} className={styles.heart}/><span className={styles.hudName}>{c.title}</span><ChevronRight size={14}/></span>
  <span className={styles.condition} data-tone={tone}><b>{conditionLabel(h)}</b>{h.status==='active'&&<small>{penaltyText(h.penalty)}</small>}</span>
  <HealthBar h={h}/>
  <span className={styles.bodyRow}><Droplets size={14} aria-hidden="true"/><span className={styles.resourceName}>Blut</span><BloodBar b={b}/><small>{b.current??'–'}/{b.max??'–'}</small></span>
  <span className={styles.bodyRow}><Flame size={14} aria-hidden="true"/><span className={styles.resourceName}>Willenskraft</span><WillDots w={w}/><small>{w.temporary??'–'}/{w.permanent??'–'}</small></span>
  {!!others.length&&<span className={styles.roundBlock} role="group" aria-label="Am Tisch"><RoundRows round={others} crew={crew} hits={hits} limit={5}/></span>}
 </button>;
}

/** Part 2 on the table: personal stress, group stress and masquerade risk, kept apart from the body. */
function PressureHud({vitals,gm,onOpen,hidden,panelOpen}:{vitals:VitalsSnapshot;gm:boolean;onOpen:()=>void;hidden:boolean;panelOpen:boolean}){
 const own=vitals.characters.find(c=>c.own),risk=vitals.masqueradeRisk,m=vitals.masquerade;
 const top=gm?[...vitals.characters].sort((x,y)=>y.stress.value-x.stress.value)[0]:undefined;
 return <button type="button" className={`${styles.hudBox} ${styles.pressureHud}`} data-hidden={hidden} data-panel={panelOpen} onClick={onOpen} aria-label="Stress und Maskerade öffnen">
  <span className={styles.hudTitle}><Activity size={14}/><span className={styles.hudName}>Druck</span><ChevronRight size={14}/></span>
  {!gm&&own&&<PressureRow icon={<User size={13}/>} name="Ich" value={own.stress.value} label={own.stress.label} level={stressLevel(own.stress.value)}/>}
  {gm&&top&&top.stress.value>0&&<PressureRow icon={<User size={13}/>} name={top.title} value={top.stress.value} label={top.stress.label} level={stressLevel(top.stress.value)} detail="höchster persönlicher Stress"/>}
  <PressureRow icon={<Users size={13}/>} name="Gruppe" value={vitals.stress.value} label={vitals.stress.label} level={stressLevel(vitals.stress.value)}/>
  {risk&&<PressureRow icon={<ShieldAlert size={13}/>} name="Maskerade" value={m?m.value:risk.level} total={m?m.max:3} label={risk.label} level={risk.level} detail={m?`Stufe ${m.value} von ${m.max}`:risk.hint}/>}
 </button>;
}

/** Always visible on the table: two separate parts, body and pressure, plus the wound vignette for the own view. */
export function VitalsHud({vitals,gm,crew=[],onOpen,panelOpen,hideBody,hidePressure}:{vitals:VitalsSnapshot;gm:boolean;crew?:Crew;onOpen:()=>void;panelOpen:boolean;hideBody:boolean;hidePressure:boolean}){
 const own=gm?undefined:vitals.characters.find(c=>c.own);
 return <>
  {own&&<WoundVignette c={own}/>}
  <BodyHud vitals={vitals} gm={gm} crew={crew} onOpen={onOpen} hidden={hideBody} panelOpen={panelOpen}/>
  <PressureHud vitals={vitals} gm={gm} onOpen={onOpen} hidden={hidePressure} panelOpen={panelOpen}/>
 </>;
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
   {allowed('damage')&&<form className={styles.damage} onSubmit={e=>{e.preventDefault();act({op:'damage',...damage});}}><label>Art<select value={damage.type} onChange={e=>setDamage(d=>({...d,type:e.target.value as typeof d.type}))}><option value="bashing">Wucht (/)</option><option value="lethal">Tödlich (X)</option><option value="aggravated">Schwer (*)</option></select></label><label>Stufen<input type="number" min={1} max={10} value={damage.levels} onChange={e=>setDamage(d=>({...d,levels:Math.max(1,Math.min(10,Number(e.target.value)||1))}))}/></label><button type="submit" disabled={lock}>Schaden eintragen</button><small>Nach dem Aufsaugen; Wucht bei Vampiren bereits halbiert.</small></form>}
  </div>
  <div className={styles.trait}><h4><Activity size={15}/>Persönlicher Stress <small>{c.stress.value} / {stressMaximum} · {c.stress.label}</small></h4><StressBar value={c.stress.value}/>
   <p className={styles.hint}>{personalStressEffect}</p>
   {gm&&<div className={styles.actions}><button type="button" disabled={busy||c.stress.value===0} onClick={()=>void run({expectedVersion:vitals.version,table:{op:'personalStress',characterId:c.id,delta:-1}})}><Minus size={14}/>Stress −1</button><button type="button" disabled={busy||c.stress.value===stressMaximum} onClick={()=>void run({expectedVersion:vitals.version,table:{op:'personalStress',characterId:c.id,delta:1}})}><Plus size={14}/>Stress +1</button></div>}
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
   {vitals.masqueradeRisk&&!vitals.masquerade&&<><h3><ShieldAlert size={15}/>Maskerade-Risiko <small>{vitals.masqueradeRisk.label}</small></h3><Boxes total={3} filled={vitals.masqueradeRisk.level} label={`Maskerade-Risiko: ${vitals.masqueradeRisk.label}`} tone="masq"/><p className={styles.hint}>{vitals.masqueradeRisk.hint}</p></>}
   {vitals.masquerade&&<><h3><ShieldAlert size={15}/>Maskerade-Stufe <small>{vitals.masquerade.value} / {vitals.masquerade.max} · {vitals.masqueradeRisk?.label}{gm&&vitals.settings?` · ${masqueradeViewLabels[vitals.settings.masqueradeView]}`:''}</small></h3><Boxes total={vitals.masquerade.max} filled={vitals.masquerade.value} label={`Maskerade-Stufe ${vitals.masquerade.value} von ${vitals.masquerade.max}`} tone="masq"/>
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
   <fieldset><legend>Maskerade für Spieler</legend>{masqueradeViews.map((id:MasqueradeView)=><label key={id}><input type="radio" name="vitals-masquerade" checked={vitals.settings!.masqueradeView===id} disabled={busy} onChange={()=>table({op:'settings',masqueradeView:id})}/><span>{masqueradeViewLabels[id]}{id==='risk'?' (Gewahrt, Aufmerksamkeit, In Gefahr, Bruch droht)':''}</span></label>)}</fieldset>
   <label className={styles.check}>Maskerade-Skala bis<select value={vitals.masquerade?.max??5} disabled={busy} onChange={e=>table({op:'settings',masqueradeMax:Number(e.target.value)})}>{[3,4,5,6,7,8,9,10].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
   <fieldset><legend>Blut, Willenskraft und Schaden der Runde</legend>{roundViews.map(id=><label key={id}><input type="radio" name="vitals-round" checked={vitals.roundView===id} disabled={busy} onChange={()=>table({op:'settings',roundView:id})}/><span>{roundViewLabels[id]}{id==='all'?' (Übersicht unten links; alles andere bleibt privat)':''}</span></label>)}</fieldset>
   <fieldset><legend>Wer trägt Schaden ein?</legend>{damageModes.map(id=><label key={id}><input type="radio" name="vitals-damage" checked={vitals.damageBy===id} disabled={busy} onChange={()=>table({op:'settings',damageBy:id})}/><span>{damageModeLabels[id]}{id==='player'?' – die SL kann immer korrigieren':''}</span></label>)}</fieldset>
   <label className={styles.check}><input type="checkbox" checked={vitals.settings.nightlyWillpower} disabled={busy} onChange={e=>table({op:'settings',nightlyWillpower:e.target.checked})}/>Neue Nacht: +1 Willenskraft (V20-Option der SL)</label>
  </details>}
  {gm&&(!!vitals.history?.length||!!vitals.log?.length)&&<details className={styles.settings}><summary>Verlauf</summary><ol className={styles.log}>
   {[...(vitals.history||[]).map(h=>({id:h.id,at:h.at,text:`${h.character}: ${h.text}`,actor:h.actor})),...(vitals.log||[]).map(l=>({id:l.id,at:l.at,text:l.text,actor:l.actor}))].sort((x,y)=>y.at.localeCompare(x.at)).slice(0,25).map(e=><li key={e.id}><time dateTime={e.at}>{new Date(e.at).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</time> {e.text}<small> · {e.actor}</small></li>)}
  </ol></details>}
 </div>;
}

/** Simple own-value actions for the player menu in the header: one choice, one button. */
export type QuickAction={value:string;label:string;command:Record<string,unknown>};
export function quickActions(vitals:VitalsSnapshot|undefined):{characterId:string;title:string;actions:QuickAction[]}|null{
 const c=vitals?.characters.find(x=>x.own);if(!vitals||!c)return null;
 const ops=vitals.operations as string[],b=c.vitals.blood,w=c.vitals.willpower,h=c.vitals.health,active=h.status==='active';
 const list:QuickAction[]=[];
 if(ops.includes('willpower.spend')&&w.temporary&&active)list.push({value:'will',label:'Willenskraft einsetzen (−1)',command:{op:'willpower.spend'}});
 if(ops.includes('blood.spend')&&b.current)list.push({value:'blood',label:'1 Blut ausgeben',command:{op:'blood.spend',amount:1}});
 if(ops.includes('blood.gain')&&b.current!==null&&b.current!==b.max)list.push({value:'drink',label:'1 Blut trinken',command:{op:'blood.gain',amount:1}});
 if(ops.includes('heal.blood')&&b.current&&active&&h.track.some(t=>t!=='aggravated'))list.push({value:'heal',label:'Normalschaden heilen (1 Blut)',command:{op:'heal.blood'}});
 if(ops.includes('damage'))for(const [type,label] of [['bashing','Wucht'],['lethal','Tödlich'],['aggravated','Schwer']] as const)list.push({value:'damage-'+type,label:'Schaden: 1 '+label,command:{op:'damage',type,levels:1}});
 return {characterId:c.id,title:c.title,actions:list};
}
