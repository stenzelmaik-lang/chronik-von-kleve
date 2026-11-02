"use client";
import {useState} from 'react';
import {CATEGORIES,FIGURE_TYPES,TIERS,resolveFigure,tierById,typeById,type PreparedFigure,type TierId} from '@/domain/standard-figures';
import s from './story-workspace.module.css';

/** Scene preparation, step "NPCs und Dialoge": pick standard figures (type, tier, count). They are only a plan; the GM inserts them in the Regie. */
export function PreparationFigures({values,onChange}:{values:PreparedFigure[];onChange:(next:PreparedFigure[])=>void}){
 const [cat,setCat]=useState<string>(CATEGORIES[0].id),[typeId,setTypeId]=useState<string>(FIGURE_TYPES[0].id),[tierId,setTierId]=useState<TierId>('standard'),[count,setCount]=useState(1);
 const types=FIGURE_TYPES.filter(t=>t.category===cat),type=typeById(typeId),stats=resolveFigure(typeId,tierId);
 const add=()=>{if(values.length>=30)return;onChange([...values,{id:crypto.randomUUID(),typeId,tierId,count}]);};
 return <fieldset className={s.npcPicker}><legend>Standardfiguren dieser Szene</legend>
  <p>Namenlose Alltagsfiguren wie Türsteher, Passanten oder Tiere. Die Auswahl erzeugt keine NPC-Akte; eingesetzt wird erst in der Live-Regie. Die Werte sind Entwurfswerte, noch nicht gegen V20 geprüft.</p>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:8,alignItems:'end'}}>
   <label>Gruppe<select value={cat} onChange={e=>{setCat(e.target.value);setTypeId(FIGURE_TYPES.find(t=>t.category===e.target.value)!.id);}}>{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
   <label>Figur<select value={typeId} onChange={e=>setTypeId(e.target.value)}>{types.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
   <label>Stufe<select value={tierId} onChange={e=>setTierId(e.target.value as TierId)}>{TIERS.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
   <label>Anzahl<input type="number" min={1} max={10} value={count} onChange={e=>setCount(Math.max(1,Math.min(10,Number(e.target.value)||1)))}/></label>
   <button type="button" onClick={add} disabled={values.length>=30}>Hinzufügen</button>
  </div>
  {type&&<small>{type.description} {stats?.encounter?stats.encounterHint:''}</small>}
  {!!values.length&&<ul className={s.selectedPeople}>{values.map(v=>{const t=typeById(v.typeId),tier=tierById(v.tierId);return <li key={v.id}><span>{t?.name||v.typeId} · {tier?.label||v.tierId} · ×{v.count}</span>
   <select aria-label="Stufe ändern" value={v.tierId} onChange={e=>onChange(values.map(x=>x.id===v.id?{...x,tierId:e.target.value as TierId}:x))}>{TIERS.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select>
   <button type="button" aria-label={`${t?.name||v.typeId} entfernen`} onClick={()=>onChange(values.filter(x=>x.id!==v.id))}>Entfernen</button></li>;})}</ul>}
  {!values.length&&<p>Noch keine Standardfigur gewählt.</p>}
 </fieldset>;
}
