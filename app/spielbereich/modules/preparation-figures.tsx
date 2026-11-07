/* eslint-disable @next/next/no-img-element -- Protected existing file endpoints. */
"use client";
import {useState} from 'react';
import {CATEGORIES,FIGURE_TYPES,TIERS,resolveFigure,tierById,typeById,type PreparedFigure,type TierId} from '@/domain/standard-figures';
import {ProtectedImageGallery,type PreparationFile} from './protected-image-gallery';
import {PreparationUpload} from './preparation-upload';
import {FigureTemplateLibrary} from './figure-template-library';
import type {FigureTemplate} from '@/domain/figure-templates';
import s from './story-workspace.module.css';

/** Scene preparation, step "NPCs und Dialoge": pick standard figures (type, tier, count) and attach a picture to each.
 * They are only a plan; the GM inserts them in the Live-Regie and shows them on the table like any NPC. */
export function PreparationFigures({values,onChange,files,onUploaded}:{values:PreparedFigure[];onChange:(next:PreparedFigure[])=>void;files:PreparationFile[];onUploaded:(file:PreparationFile)=>void}){
 const [cat,setCat]=useState<string>(CATEGORIES[0].id),[typeId,setTypeId]=useState<string>(FIGURE_TYPES[0].id),[tierId,setTierId]=useState<TierId>('standard'),[count,setCount]=useState(1);
 const [template,setTemplate]=useState<FigureTemplate|null>(null),[templates,setTemplates]=useState<FigureTemplate[]>([]);
 const selectTemplate=(next:FigureTemplate|null)=>{setTemplate(next);if(next){setTypeId(next.typeId);setTierId(next.tierId);setCat(typeById(next.typeId)!.category);}};
 const types=FIGURE_TYPES.filter(t=>t.category===cat),type=typeById(typeId),stats=resolveFigure(typeId,tierId);
 const add=()=>{if(values.length>=30)return;onChange([...values,{id:crypto.randomUUID(),typeId,tierId,count,...(template?{templateId:template.id}:{})}]);};
 const setImage=(id:string,imageFileId:string)=>onChange(values.map(x=>x.id===id?{...x,imageFileId:imageFileId||undefined}:x));
 return <fieldset className={s.npcPicker}><legend>Standardfiguren dieser Szene</legend>
  <p>Namenlose Alltagsfiguren wie Türsteher, Passanten oder Tiere. Die Auswahl erzeugt keine NPC-Akte; eingesetzt wird erst in der Live-Regie, dort spielst du sie wie jeden NPC auf den Tisch. Die Werte sind Entwurfswerte, noch nicht gegen V20 geprüft.</p>
  <FigureTemplateLibrary typeId={typeId} tierId={tierId} selected={template} onSelect={selectTemplate} onLoaded={setTemplates}/>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:8,alignItems:'end'}}>
   <label>Gruppe<select value={cat} onChange={e=>{setTemplate(null);setCat(e.target.value);setTypeId(FIGURE_TYPES.find(t=>t.category===e.target.value)!.id);}}>{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
   <label>Figur<select value={typeId} onChange={e=>{setTemplate(null);setTypeId(e.target.value);}}>{types.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
   <label>Stufe<select value={tierId} onChange={e=>{setTemplate(null);setTierId(e.target.value as TierId);}}>{TIERS.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
   <label>Anzahl<input type="number" min={1} max={10} value={count} onChange={e=>setCount(Math.max(1,Math.min(10,Number(e.target.value)||1)))}/></label>
   <button type="button" onClick={add} disabled={values.length>=30}>Hinzufügen</button>
  </div>
  {type&&<small>{type.description} {stats?.encounter?stats.encounterHint:''}</small>}
  {!!values.length&&<ul className={s.selectedPeople}>{values.map(v=>{const t=typeById(v.typeId),tier=tierById(v.tierId),image=files.find(f=>f.id===v.imageFileId);return <li key={v.id} style={{display:'grid',gap:8,alignItems:'stretch'}}>
   <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
    {image?<img loading="lazy" src={'/api/files?id='+encodeURIComponent(image.id)} alt={'Bild: '+image.name} style={{width:44,height:44,objectFit:'cover',borderRadius:4,background:'#0f161d'}}/>:null}
    <strong style={{flex:'1 1 200px'}}>{v.templateId?(templates.find(item=>item.id===v.templateId)?.name||"Eigene Vorlage"):t?.name||v.typeId} · {tier?.label||v.tierId} · ×{v.count}{v.imageFileId&&!image?' · Bild derzeit nicht verfügbar':''}</strong>
    <select disabled={!!v.templateId} aria-label={`Stufe ändern: ${t?.name||v.typeId}`} value={v.tierId} onChange={e=>onChange(values.map(x=>x.id===v.id?{...x,tierId:e.target.value as TierId}:x))}>{TIERS.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select>
    <button type="button" aria-label={`${t?.name||v.typeId} entfernen`} onClick={()=>onChange(values.filter(x=>x.id!==v.id))}>Figur entfernen</button>
   </div>
   <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'flex-start'}}>
    <ProtectedImageGallery label={v.imageFileId?'Anderes Bild wählen':'Bild wählen'} files={files} selected={v.imageFileId||''} onSelect={id=>setImage(v.id,id)}/>
    <PreparationUpload kind="image" label="Neues Bild hochladen" onUploaded={f=>{onUploaded(f);setImage(v.id,f.id);}}/>
    {v.imageFileId&&<button type="button" onClick={()=>setImage(v.id,'')}>Bild entfernen</button>}
   </div></li>;})}</ul>}
  {!values.length&&<p>Noch keine Standardfigur gewählt.</p>}
  {!!values.length&&<small>Bild entfernen löst nur die Zuordnung; die Datei bleibt in der Medienverwaltung.</small>}
 </fieldset>;
}
