"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated GM media must never use a public optimization proxy. */
import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from '../api-client';
import type {DiceEvent} from './types';
import type {Audience} from './stage-client';
import {CATEGORIES,FIGURE_TYPES,HEALTH_LEVELS,TIERS,effectivePool,resolveFigure,tierById,typeById,woundPenalty,type FigureStatePatch,type LiveFigure,type PreparedFigure} from '@/domain/standard-figures';
import styles from './regie-figures.module.css';

type Asset={id:string;typeId:string;tierId:string|null;fileId:string;label:string;role:string};
type GalleryFile={id:string;name:string;mime:string};
type Listing={figures:LiveFigure[];assets:Asset[]};
type Props={sessionId:string;prepared:PreparedFigure[];busy:boolean;dice:DiceEvent[];actorId:string;run:(body:Record<string,unknown>,recipients:Audience,done:string)=>Promise<boolean>};

/** SL tool below the material column: prepared figures of the scene, ad-hoc insertion, live state, quick-action dice pools. */
export function RegieFigures({sessionId,prepared,busy,dice,actorId,run}:Props){
 const [data,setData]=useState<Listing>({figures:[],assets:[]}),[error,setError]=useState(''),[working,setWorking]=useState(false);
 const [files,setFiles]=useState<GalleryFile[]>([]),[rolls,setRolls]=useState<Record<string,string>>({});
 const [cat,setCat]=useState<string>(CATEGORIES[0].id),[typeId,setTypeId]=useState<string>(FIGURE_TYPES[0].id),[tierId,setTierId]=useState<string>('standard'),[count,setCount]=useState(1);
 const request=useRef<string|null>(null);
 const types=FIGURE_TYPES.filter(t=>t.category===cat);
 const load=useCallback(async()=>{try{setData(await api<Listing>('/api/live-figures?sessionId='+encodeURIComponent(sessionId)));setError('');}catch(e){setError((e as Error).message);}},[sessionId]);
 useEffect(()=>{queueMicrotask(()=>void load());const t=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},4000);return()=>window.clearInterval(t);},[load]);
 useEffect(()=>{let live=true;api<{files:GalleryFile[]}>('/api/files').then(r=>{if(live)setFiles((r.files||[]).filter(f=>f.mime?.startsWith('image/')));}).catch(()=>{});return()=>{live=false;};},[]);
 async function post(body:Record<string,unknown>){
  setWorking(true);
  try{const r=await api<Partial<Listing>>('/api/live-figures','POST',{sessionId,...body});setData(old=>({figures:r.figures??old.figures,assets:r.assets??old.assets}));setError('');return true;}
  catch(e){setError((e as Error).message);return false;}finally{setWorking(false);}
 }
 // One request id per click intent: a double click or retry cannot create the figures twice.
 const spawn=async(t:string,tier:string,n:number)=>{request.current??=crypto.randomUUID();if(await post({action:'spawn',requestId:request.current,typeId:t,tierId:tier,count:n}))request.current=null;};
 const patch=(id:string,p:FigureStatePatch)=>post({action:'update',id,patch:p});
 const roll=async(f:LiveFigure,action:{id:string;label:string},pool:number,target:number,shared:boolean)=>{
  const eventId=crypto.randomUUID();
  const ok=await run({action:'roll',eventId,pool,target},shared?null:[actorId],`${f.label}: ${action.label} gewürfelt (${shared?'für alle':'nur SL'}).`);
  if(ok)setRolls(old=>({...old,[f.id]:eventId}));
 };
 const lock=busy||working;
 return <div className={styles.wrap}>
  <p className={styles.draft}>Entwurfswerte: Die Figurenwerte sind plausible Startwerte der SL, noch nicht gegen das V20-Regelwerk geprüft. Gewürfelt wird mit den bestehenden gemeinsamen Würfeln. Nichts erscheint automatisch am Tisch.</p>
  {!!prepared.length&&<ul className={styles.list} aria-label="Vorbereitete Figuren dieser Szene">{prepared.map(p=>{const t=typeById(p.typeId),tier=tierById(p.tierId);return <li key={p.id} className={styles.prepared}><span>{t?.name||p.typeId} · {tier?.label||p.tierId} · ×{p.count}</span><button type="button" className={`${styles.btn} ${styles.primary}`} disabled={lock||!t} onClick={()=>void spawn(p.typeId,p.tierId,p.count)}>Einsetzen</button></li>;})}</ul>}
  <details className={styles.details}><summary>Weitere Figur einsetzen</summary>
   <div className={styles.picker}>
    <label>Gruppe<select value={cat} onChange={e=>{setCat(e.target.value);setTypeId(FIGURE_TYPES.find(t=>t.category===e.target.value)!.id);}}>{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
    <label>Figur<select value={typeId} onChange={e=>setTypeId(e.target.value)}>{types.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <label>Stufe<select value={tierId} onChange={e=>setTierId(e.target.value)}>{TIERS.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
    <label>Anzahl<input type="number" min={1} max={10} value={count} onChange={e=>setCount(Math.max(1,Math.min(10,Number(e.target.value)||1)))}/></label>
    <button type="button" className={`${styles.btn} ${styles.primary}`} disabled={lock} onClick={()=>void spawn(typeId,tierId,count)}>Einsetzen</button>
   </div>
   {typeById(typeId)?.note&&<p className={styles.note}>{typeById(typeId)!.note}</p>}
  </details>
  {error&&<p className={styles.warn} role="alert">{error}</p>}
  {!data.figures.length?<p className={styles.empty}>Noch keine Figur eingesetzt. Eingesetzte Figuren sind nur für dich sichtbar.</p>:<ul className={styles.list} aria-label="Eingesetzte Standardfiguren">{data.figures.map(f=><FigureCard key={f.id} f={f} assets={data.assets} files={files} rollEvent={dice.find(e=>e.id===rolls[f.id])} lock={lock} onPatch={p=>void patch(f.id,p)} onRetire={()=>void post({action:'retire',id:f.id})} onRoll={(a,pool,target,shared)=>void roll(f,a,pool,target,shared)} onLink={(fileId,label)=>void post({action:'linkAsset',typeId:f.typeId,tierId:null,fileId,label,role:'fullbody'})}/>)}</ul>}
 </div>;
}

function FigureCard({f,assets,files,rollEvent,lock,onPatch,onRetire,onRoll,onLink}:{f:LiveFigure;assets:Asset[];files:GalleryFile[];rollEvent?:DiceEvent;lock:boolean;onPatch:(p:FigureStatePatch)=>void;onRetire:()=>void;onRoll:(a:{id:string;label:string},pool:number,target:number,shared:boolean)=>void;onLink:(fileId:string,label:string)=>void}){
 const [target,setTarget]=useState(6),[note,setNote]=useState(f.note),[label,setLabel]=useState(f.label);
 const tier=tierById(f.tierId),penalty=woundPenalty(f.hurt),level=f.hurt>0?HEALTH_LEVELS[Math.min(f.hurt,7)-1].label:'Unverletzt';
 const own=assets.filter(a=>a.typeId===f.typeId&&(a.tierId===null||a.tierId===f.tierId));
 const image=f.imageFileId?'/api/files?id='+encodeURIComponent(f.imageFileId):'';
 const fresh=resolveFigure(f.typeId,f.tierId);
 return <li className={styles.card} aria-label={f.label}>
  <div className={styles.head}>{image?<img className={styles.portrait} src={image} alt="" loading="lazy"/>:<span className={styles.portrait} aria-hidden="true">kein Bild</span>}
   <div className={styles.title}><strong>{f.label}</strong><small>{typeById(f.typeId)?.name} · {tier?.label} · {level}{penalty?` (−${penalty} Würfel)`:''}</small></div>
   <button type="button" className={styles.btn} disabled={lock} onClick={onRetire} aria-label={`${f.label} entfernen`}>Entfernen</button></div>
  {f.stats.encounter&&<p className={styles.warn}>{f.stats.encounterHint}</p>}
  <div className={styles.track} role="group" aria-label={`Gesundheit ${f.label}`}>{HEALTH_LEVELS.map((h,i)=><button key={h.label} type="button" className={styles.box} aria-pressed={f.hurt>i} title={`${h.label}${h.penalty===null?'':` (−${h.penalty})`}`} aria-label={`${h.label}${f.hurt>i?' (verletzt)':''}`} disabled={lock} onClick={()=>onPatch({hurt:f.hurt===i+1?i:i+1})}>{i+1}</button>)}
   <span className={styles.note}>Willenskraft</span><button type="button" className={styles.btn} disabled={lock||f.willpower<=0} onClick={()=>onPatch({willpower:f.willpower-1})} aria-label="Willenskraft senken">−</button><strong>{f.willpower}/{f.stats.willpower}</strong><button type="button" className={styles.btn} disabled={lock||f.willpower>=10} onClick={()=>onPatch({willpower:f.willpower+1})} aria-label="Willenskraft erhöhen">+</button>
   {f.blood!==null&&f.stats.bloodMax!==null&&<><span className={styles.note}>Blut</span><button type="button" className={styles.btn} disabled={lock||f.blood<=0} onClick={()=>onPatch({blood:f.blood!-1})} aria-label="Blut senken">−</button><strong>{f.blood}/{f.stats.bloodMax}</strong><button type="button" className={styles.btn} disabled={lock||f.blood>=f.stats.bloodMax} onClick={()=>onPatch({blood:f.blood!+1})} aria-label="Blut erhöhen">+</button></>}
  </div>
  <div className={styles.tools}><label className={styles.note}>Schwierigkeit <select value={target} onChange={e=>setTarget(Number(e.target.value))} aria-label="Schwierigkeit der Probe">{[2,3,4,5,6,7,8,9,10].map(n=><option key={n} value={n}>{n}</option>)}</select></label></div>
  <ul className={styles.actions} aria-label={`Schnellaktionen ${f.label}`}>{f.stats.actions.map(a=>{const pool=effectivePool(a.pool,f.hurt);return <li key={a.id} className={styles.action}><span>{a.label} <small className={styles.note}>({a.attribute}{a.ability?` + ${a.ability}`:''})</small></span><span className={styles.pool}>{pool} Würfel{pool!==a.pool?` (statt ${a.pool})`:''}</span>
   <button type="button" className={styles.btn} disabled={lock||pool<1} onClick={()=>onRoll(a,pool,target,false)}>Würfeln (nur SL)</button><button type="button" className={styles.btn} disabled={lock||pool<1} onClick={()=>onRoll(a,pool,target,true)}>Für alle</button></li>;})}</ul>
  {rollEvent&&<p className={styles.result} role="status">Letzter Wurf: {rollEvent.roll.pool} Würfel gegen {rollEvent.roll.target}: [{rollEvent.roll.dice.join(', ')}] → {rollEvent.result.netSuccesses} Erfolge ({rollEvent.result.outcome})</p>}
  <details className={styles.details}><summary>Werte, Verhalten, Bild und Notiz</summary>
   <p className={styles.note}>{typeById(f.typeId)?.behavior}</p><p className={styles.note}>{fresh?.explanation}</p>
   <div className={styles.grid}>{Object.entries(f.stats.attributes).map(([k,v])=><span key={k}><em>{k}</em><b>{v}</b></span>)}{Object.entries(f.stats.skills).filter(([,v])=>v>0).map(([k,v])=><span key={k}><em>{k}</em><b>{v}</b></span>)}</div>
   <div className={styles.picker}>
    <label>Name<input value={label} maxLength={60} onChange={e=>setLabel(e.target.value)} onBlur={()=>{if(label.trim()&&label!==f.label)onPatch({label});}}/></label>
    <label>Bild<select value={f.imageFileId} onChange={e=>onPatch({imageFileId:e.target.value})}><option value="">kein Bild</option>{!!own.length&&<optgroup label="Bilder dieser Figur">{own.map(a=><option key={a.id} value={a.fileId}>{a.label}</option>)}</optgroup>}<optgroup label="Galerie">{files.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</optgroup></select></label>
    {f.imageFileId&&!own.some(a=>a.fileId===f.imageFileId)&&<button type="button" className={styles.btn} disabled={lock} onClick={()=>onLink(f.imageFileId,files.find(x=>x.id===f.imageFileId)?.name||'Bild')}>Bild für diese Figurenart merken</button>}
   </div>
   <label className={styles.note}>SL-Notiz<textarea value={note} maxLength={2000} rows={2} onChange={e=>setNote(e.target.value)} onBlur={()=>{if(note!==f.note)onPatch({note});}}/></label>
  </details>
 </li>;
}
