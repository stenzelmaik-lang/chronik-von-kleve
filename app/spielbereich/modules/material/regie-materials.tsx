"use client";
import {useEffect,useState} from 'react';
import {Eye,EyeOff,Lock,Search,Undo2,ImageDown,AlertTriangle,Backpack} from 'lucide-react';
import {api} from '../api-client';
import {materialEffects,materialSummary,materialTypeInfo} from '@/domain/material-system';
import type {RegieMaterial,Snapshot,StageObject} from '../spieltisch/types';
import {MaterialCover,MaterialPresenter,type PresentedMaterial} from './presenter';
import styles from './regie-materials.module.css';

type Audience=string[]|null;
type Crew=Snapshot['crew'];
const fileUrl=(id:string)=>'/api/files?id='+encodeURIComponent(id);

/** GM preview data: the GM's own file access, never a stage object, so a private look never publishes anything. */
export function previewOf(m:Pick<RegieMaterial,'title'|'type'|'display'|'effect'|'files'|'caption'>&{states:{key:string;fileId:string}[];soundFileId?:string}):PresentedMaterial{
 return {title:m.title,type:m.type,display:m.display,effect:{open:m.effect.open,close:m.effect.close,speed:m.effect.speed,afterClose:m.effect.afterClose},
  states:m.states.filter(s=>s.fileId).map(s=>({key:s.key,src:fileUrl(s.fileId)})),
  pages:m.files.filter(f=>f.fileId&&!('missing' in f&&f.missing)).map(f=>({title:f.title,src:fileUrl(f.fileId),mime:f.mime||'image/*'})),
  ...(m.caption&&m.caption.replace(/<[^>]*>/g,'').trim()?{caption:m.caption}:{}),...(m.soundFileId?{soundSrc:fileUrl(m.soundFileId)}:{})};
}
function tableText(o:Exclude<StageObject,{kind:'note'}>|undefined,crew:Crew){
 if(!o)return 'Vorbereitet · nicht auf dem Tisch';
 if(o.visibility==='sl')return 'Auf dem Tisch · nur SL';
 return o.recipients===null?'Freigegeben · ganze Runde':'Freigegeben · '+o.recipients.map(id=>crew.find(m=>m.id===id)?.name||'?').join(', ');
}

/**
 * Every prepared material of the scene as one object, for the Regie window and the Regie at the table. Each item
 * keeps its own audience. "Privat ansehen" only opens a local view; table actions use the existing stage commands.
 */
export function RegieMaterials({materials,objects,crew,busy,run,heading=true}:{materials:RegieMaterial[];objects:StageObject[];crew:Crew;busy:boolean;run:(body:Record<string,unknown>,done:string)=>unknown;heading?:boolean}){
 const [audiences,setAudiences]=useState<Record<string,Audience>>({}),[preview,setPreview]=useState<RegieMaterial|null>(null);
 // Who carries which material right now: refreshed whenever something leaves or reaches the table.
 const [holders,setHolders]=useState<Record<string,{itemId:string;name:string}>|null>(null),[reload,setReload]=useState(0);
 const tableKey=objects.map(o=>o.id).join('|');
 useEffect(()=>{let live=true;api<{items:{id:string;holder:string;sourceId?:string}[]}>('/api/inventory/material').then(r=>{if(live)setHolders(Object.fromEntries(r.items.filter(i=>i.sourceId).map(i=>[i.sourceId!,{itemId:i.id,name:i.holder||'einem Charakter'}])));}).catch(()=>{});return()=>{live=false;};},[tableKey,reload]);
 const holderOf=(m:RegieMaterial)=>holders?holders[m.id]||null:m.holder;
 const players=crew.filter(m=>m.role!=='Spielleitung');
 const audienceOf=(id:string):Audience=>id in audiences?audiences[id]:null;
 const who=(v:Audience)=>v===null?'alle':v.map(id=>crew.find(m=>m.id===id)?.name||'?').join(', ');
 if(!materials.length)return null;
 return <section className={styles.list} aria-label="Szenenmaterial">
  {heading&&<h3>Szenenmaterial</h3>}
  {materials.map(m=>{
   const placed=objects.find((o):o is Exclude<StageObject,{kind:'note'}>=>o.kind!=='note'&&o.sourceKind==='record'&&o.sourceId===m.id);
   const target=audienceOf(m.id),none=target!==null&&!target.length,available=m.files.filter(f=>!f.missing).length;
   const presented=previewOf({...m,states:m.asset?.states||[],soundFileId:m.sound?m.effect.soundFileId:undefined});
   const holder=placed?null:holderOf(m);
   return <article key={m.id} className={styles.item} data-material={m.elementId} data-placed={!!placed}>
    <button type="button" className={styles.thumb} aria-label={'Privat ansehen: '+m.title} onClick={()=>setPreview(m)}><MaterialCover material={presented}/></button>
    <div className={styles.body}>
     <h4>{m.title}</h4>
     <p className={styles.meta}>{materialSummary(m,available)}{m.asset?' · '+m.asset.title:''}</p>
     {m.type==='backdrop'?<p className={styles.state}>Eigene Bühnenebene · Wetter und Licht bleiben</p>:holder?<p className={styles.state} data-carried="true"><Backpack size={13}/> Im Inventar von {holder.name}</p>:<p className={styles.state} data-placed={!!placed}>{tableText(placed,crew)}{placed&&placed.ownerId&&crew.some(c=>c.id===placed.ownerId&&c.role!=='Spielleitung')?' · ausgelegt von '+(crew.find(c=>c.id===placed.ownerId)?.name||'?'):''}</p>}
     {m.type!=='backdrop'&&!m.takeable&&<p className={styles.meta}>Kann nicht eingesteckt werden</p>}
     {(m.problem||m.assetMissing||available<m.files.length)&&<p className={styles.warn}><AlertTriangle size={13}/> {m.assetMissing?'Darstellung fehlt – es wird die einfache Darstellung gezeigt. ':''}{available<m.files.length?(m.files.length-available)+' Datei(en) fehlen. ':''}{m.problem}</p>}
     {m.type!=='backdrop'&&<div className={styles.audience} role="group" aria-label={'Empfänger: '+m.title}>
      <button type="button" aria-pressed={target===null} onClick={()=>setAudiences(old=>({...old,[m.id]:null}))}>Alle</button>
      {players.map(p=><button type="button" key={p.id} aria-pressed={target!==null&&target.includes(p.id)} onClick={()=>setAudiences(old=>({...old,[m.id]:target===null?[p.id]:target.includes(p.id)?target.filter(id=>id!==p.id):[...target,p.id]}))}>{p.name}</button>)}
     </div>}
     <div className={styles.actions}>
      <button type="button" onClick={()=>setPreview(m)}><Search/> Privat ansehen</button>
      {holder?<button type="button" className={styles.primary} disabled={busy} onClick={()=>void Promise.resolve(run({action:'reclaim',itemId:holder.itemId},'„'+m.title+'“ von '+holder.name+' zurückgeholt.')).then(()=>setReload(v=>v+1))}><Undo2/> Zurückholen</button>:m.type==='backdrop'?<button type="button" className={styles.primary} disabled={busy||!available} onClick={()=>void run({action:'backdrop',fileId:m.files.find(f=>!f.missing)?.fileId,transition:m.effect.open==='instant'?'instant':m.effect.speed==='slow'?'slow':'fade'},'Hintergrund „'+m.title+'“ für die ganze Runde.')}><ImageDown/> Als Hintergrund zeigen</button>:<>
       {!placed&&<button type="button" disabled={busy} onClick={()=>void run({action:'add',kind:'document',sourceId:m.id,sourceKind:'record'},'„'+m.title+'“ liegt auf dem Tisch – nur für dich sichtbar.')}><Lock/> Auf den Tisch legen</button>}
       <button type="button" className={styles.primary} disabled={busy||none} onClick={()=>void run({action:'add',kind:'document',sourceId:m.id,sourceKind:'record',visible:true,recipients:target},'„'+m.title+'“ freigegeben für '+who(target)+'.')}><Eye/> {placed&&placed.visibility!=='sl'?'Freigabe ändern':'Freigeben'} · {who(target)}</button>
       {placed&&placed.visibility!=='sl'&&<button type="button" disabled={busy} onClick={()=>void run({action:'visibility',id:placed.id,visible:false},'„'+m.title+'“ zurückgezogen – liegt nur noch für dich auf dem Tisch.')}><Undo2/> Zurückziehen</button>}
       {placed&&<button type="button" disabled={busy} onClick={()=>void run({action:'remove',id:placed.id},'„'+m.title+'“ vom Tisch genommen.')}><EyeOff/> Vom Tisch nehmen</button>}
      </>}
     </div>
     {m.cue&&m.cue.replace(/<[^>]*>/g,'').trim()&&<details className={styles.cue}><summary>Einsatz (nur SL)</summary>{m.cue.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()}</details>}
     {m.note.trim()&&<details className={styles.cue}><summary>SL-Notiz</summary>{m.note}</details>}
    </div>
   </article>;
  })}
  {preview&&<MaterialPresenter key={preview.id} material={previewOf({...preview,states:preview.asset?.states||[],soundFileId:preview.sound?preview.effect.soundFileId:undefined})} personalKey={'regie:'+preview.id} badge={'Private Vorschau · '+materialTypeInfo[preview.type].label+' · '+materialEffects[preview.effective].label} onClose={()=>setPreview(null)}/>}
 </section>;
}
