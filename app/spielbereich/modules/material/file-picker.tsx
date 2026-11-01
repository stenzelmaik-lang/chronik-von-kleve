"use client";
/* eslint-disable @next/next/no-img-element -- Protected existing file endpoints. */
import {useEffect,useId,useMemo,useRef,useState} from 'react';
import {X,Check,Upload,Trash2,FileText,Music,Film,Search,AlertTriangle,Ban} from 'lucide-react';
import {mimeFits,type MaterialAccept} from '@/domain/material-system';
import {api,ApiError} from '../api-client';
import type {PreparationFile} from '../protected-image-gallery';
import {ThumbImage} from '../file-thumb';
import styles from './workbench.module.css';

/**
 * React passes the close event of a nested <dialog> up to the dialogs around it. Only the dialog's own close may run
 * its handler, otherwise closing the image choice also closes (and discards) the asset editor around it.
 */
export const ownClose=(handler:()=>void)=>(e:{target:EventTarget;currentTarget:EventTarget})=>{if(e.target===e.currentTarget)handler();};

/** A file as /api/files lists it: own files, group files and (for the GM) SL files. Never other players' private files. */
export type PickerFile=PreparationFile&{owner_id?:string;visibility?:string;size?:number;created_at?:string};
export const fileUrl=(id:string)=>'/api/files?id='+encodeURIComponent(id);
const accepts:Record<MaterialAccept,string>={image:'image/jpeg,image/png,image/webp,image/gif',audio:'audio/mpeg,audio/ogg,audio/wav,audio/mp4',video:'video/mp4,video/webm',document:'application/pdf,image/jpeg,image/png,image/webp',none:''};
const pageSize=48;

/** Origin and access of a file in plain words, so a private file is never released by accident. */
export function fileOrigin(f:PickerFile,actorId:string){
 if(f.owner_id&&f.owner_id!==actorId)return f.visibility==='group'?'Kampagne · für die Gruppe':'Kampagne · SL';
 return f.visibility==='private'?'Eigene Datei · privat':f.visibility==='group'?'Eigene Datei · Gruppe':'Eigene Datei · SL';
}
export function FileThumb({file,size=64}:{file:PickerFile|undefined;size?:number}){
 if(!file)return <span className={styles.thumbMissing} style={{width:size,height:size}} title="Datei fehlt"><Ban size={18}/></span>;
 if(file.mime.startsWith('image/'))return <ThumbImage className={styles.fileThumb} style={{width:size,height:size}} id={file.id}/>;
 const Icon=file.mime.startsWith('audio/')?Music:file.mime.startsWith('video/')?Film:FileText;
 return <span className={styles.fileThumb} style={{width:size,height:size}}><Icon size={22}/></span>;
}

/**
 * Uploads several files one after another into the existing SL file store. Each file reports its own result; a
 * cancelled or failed upload leaves the others untouched and links nothing.
 */
export function MultiUpload({accept,onUploaded,label='Dateien hochladen',multiple=true}:{accept:MaterialAccept;onUploaded:(f:PickerFile)=>void;label?:string;multiple?:boolean}){
 const id=useId(),abort=useRef<AbortController|null>(null);
 const [queue,setQueue]=useState<{name:string;state:'wartet'|'lädt'|'fertig'|'fehler'|'abgebrochen';message?:string}[]>([]);
 const busy=queue.some(q=>q.state==='lädt'||q.state==='wartet');
 async function run(files:File[]){
  setQueue(files.map(f=>({name:f.name,state:'wartet'})));
  for(let i=0;i<files.length;i++){
   const file=files[i];
   if(abort.current?.signal.aborted){setQueue(q=>q.map((x,j)=>j>=i?{...x,state:'abgebrochen'}:x));break;}
   setQueue(q=>q.map((x,j)=>j===i?{...x,state:'lädt'}:x));
   abort.current=new AbortController();
   try{
    const form=new FormData();form.set('file',file);form.set('visibility','sl');
    const r=await fetch('/api/files',{method:'POST',body:form,signal:abort.current.signal});
    const data=await r.json().catch(()=>({})) as {id?:string;error?:string};
    if(!r.ok||!data.id)throw new ApiError(data.error||'Upload fehlgeschlagen.',r.status);
    onUploaded({id:data.id,name:file.name,mime:file.type,visibility:'sl'});
    setQueue(q=>q.map((x,j)=>j===i?{...x,state:'fertig'}:x));
   }catch(e){
    const cancelled=(e as Error).name==='AbortError';
    setQueue(q=>q.map((x,j)=>j===i?{...x,state:cancelled?'abgebrochen':'fehler',message:cancelled?'':(e as Error).message}:cancelled&&j>i?{...x,state:'abgebrochen'}:x));
    if(cancelled)break;
   }
  }
  abort.current=null;
 }
 return <div className={styles.upload}>
  <label htmlFor={id} className={styles.uploadButton} aria-disabled={busy}><Upload size={16}/>{busy?'Wird hochgeladen …':label}</label>
  <input id={id} type="file" multiple={multiple} accept={accepts[accept]} disabled={busy} className={styles.hiddenInput} onChange={e=>{const files=[...e.target.files||[]];e.target.value='';if(files.length)void run(files);}}/>
  {busy&&<button type="button" onClick={()=>abort.current?.abort()}>Upload abbrechen</button>}
  {!!queue.length&&<ul className={styles.uploadQueue} aria-live="polite">{queue.map((q,i)=><li key={i} data-state={q.state}>{q.name} · {q.state}{q.message?' – '+q.message:''}</li>)}</ul>}
  <small>Privat für die SL · wird nur verknüpft, nicht veröffentlicht. Höchstens 10 MB je Datei.</small>
 </div>;
}

type Tab='scene'|'campaign'|'own'|'assets';
const tabLabels:Record<Tab,string>={scene:'Diese Szene',campaign:'Kampagne',own:'Eigene Dateien',assets:'Darstellungs-Assets'};

/**
 * File choice for materials. Sources are kept apart (scene, campaign, own files, display assets). "Aus Auswahl
 * entfernen" only changes this choice; "Original löschen" deletes the stored file after the usage check and a
 * confirmation, and only for files the GM may manage.
 */
export function FilePicker({files,accept,multiple,actorId,sceneFileIds,assetFileIds,initial=[],title,onPick,onClose,onFilesChange}:{files:PickerFile[];accept:MaterialAccept;multiple:boolean;actorId:string;sceneFileIds:string[];assetFileIds:string[];initial?:string[];title:string;onPick:(ids:string[])=>void;onClose:()=>void;onFilesChange:(files:PickerFile[])=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [tab,setTab]=useState<Tab>(sceneFileIds.length?'scene':'own'),[search,setSearch]=useState(''),[chosen,setChosen]=useState<string[]>(initial),[limit,setLimit]=useState(pageSize);
 const [removing,setRemoving]=useState<{file:PickerFile;usage:{label:string;title:string|null}[];history:number}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{const d=dialog.current;if(d&&!d.open)d.showModal();},[]);
 const fitting=useMemo(()=>files.filter(f=>mimeFits(accept,f.mime)),[files,accept]);
 const inTab=useMemo(()=>fitting.filter(f=>tab==='scene'?sceneFileIds.includes(f.id):tab==='assets'?assetFileIds.includes(f.id):tab==='own'?!f.owner_id||f.owner_id===actorId:!!f.owner_id&&f.owner_id!==actorId),[fitting,tab,sceneFileIds,assetFileIds,actorId]);
 const listed=inTab.filter(f=>f.name.toLocaleLowerCase('de').includes(search.trim().toLocaleLowerCase('de')));
 const toggle=(id:string)=>setChosen(old=>old.includes(id)?old.filter(x=>x!==id):multiple?[...old,id]:[id]);
 async function askRemove(file:PickerFile){setError('');setBusy(true);try{const r=await api<{usages:{label:string;title:string|null}[];history:number}>('/api/files?usage='+encodeURIComponent(file.id));setRemoving({file,usage:r.usages,history:r.history});}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function remove(){if(!removing)return;setBusy(true);setError('');try{await api('/api/files','DELETE',{id:removing.file.id});onFilesChange(files.filter(f=>f.id!==removing.file.id));setChosen(old=>old.filter(id=>id!==removing.file.id));setRemoving(null);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const manageable=(f:PickerFile)=>!f.owner_id||f.owner_id===actorId||f.visibility==='sl'||f.visibility==='group';
 return <dialog ref={dialog} className={styles.dialog} aria-label={title} onClose={ownClose(onClose)}>
  <header><h2>{title}</h2><button type="button" aria-label="Dateiauswahl schließen" onClick={()=>dialog.current?.close()}><X/></button></header>
  <div className={styles.dialogBody}>
   <nav className={styles.segmented} aria-label="Quelle">{(Object.keys(tabLabels) as Tab[]).map(t=><button type="button" key={t} aria-pressed={tab===t} onClick={()=>{setTab(t);setLimit(pageSize);}}>{tabLabels[t]} <small>{fitting.filter(f=>t==='scene'?sceneFileIds.includes(f.id):t==='assets'?assetFileIds.includes(f.id):t==='own'?!f.owner_id||f.owner_id===actorId:!!f.owner_id&&f.owner_id!==actorId).length}</small></button>)}</nav>
   <div className={styles.pickerTools}><label className={styles.search}><Search size={16}/><input value={search} onChange={e=>{setSearch(e.target.value);setLimit(pageSize);}} placeholder="Dateien suchen …" aria-label="Dateien suchen"/></label>
    <MultiUpload accept={accept} multiple={multiple} onUploaded={f=>{onFilesChange([{...f,owner_id:actorId},...files.filter(x=>x.id!==f.id)]);setChosen(old=>multiple?[...old,f.id]:[f.id]);setTab('own');}}/></div>
   {error&&<p className={styles.error} role="alert">{error}</p>}
   {removing?<section className={styles.confirm} aria-label="Original löschen">
    <h3><AlertTriangle size={18}/> Original „{removing.file.name}“ löschen?</h3>
    {removing.usage.length?<><p>Die Datei wird noch verwendet und kann deshalb nicht gelöscht werden:</p><ul>{removing.usage.map((u,i)=><li key={i}>{u.label}{u.title?': '+u.title:''}</li>)}</ul><p>Entferne zuerst dort die Verknüpfung. „Verknüpfung entfernen“ im Material löscht nichts.</p></>:<p>Die Datei wird endgültig aus der Medienverwaltung gelöscht.{removing.history?' Ältere Szenenstände verweisen noch darauf; beim Wiederherstellen fehlt sie dann.':''} Das lässt sich nicht rückgängig machen.</p>}
    <div className={styles.row}><button type="button" onClick={()=>setRemoving(null)}>Abbrechen</button>{!removing.usage.length&&<button type="button" className={styles.danger} disabled={busy} onClick={()=>void remove()}><Trash2 size={16}/> Endgültig löschen</button>}</div>
   </section>:<>
    {!listed.length?<p className={styles.muted}>{search?'Keine passende Datei.':tab==='scene'?'Diese Szene nutzt noch keine passende Datei.':tab==='assets'?'Noch keine passenden Bilder in Darstellungs-Assets.':'Keine passenden Dateien.'}</p>:
    <ul className={styles.pickerGrid}>{listed.slice(0,limit).map(f=><li key={f.id} data-chosen={chosen.includes(f.id)}>
     <button type="button" className={styles.pickerItem} aria-pressed={chosen.includes(f.id)} onClick={()=>toggle(f.id)}><FileThumb file={f} size={96}/><span>{f.name}</span><small>{fileOrigin(f,actorId)}</small>{chosen.includes(f.id)&&<Check className={styles.check} size={18}/>}</button>
     {manageable(f)&&<button type="button" className={styles.linkButton} disabled={busy} onClick={()=>void askRemove(f)}>Original löschen …</button>}
    </li>)}</ul>}
    {listed.length>limit&&<button type="button" onClick={()=>setLimit(l=>l+pageSize)}>Weitere {Math.min(pageSize,listed.length-limit)} von {listed.length-limit} anzeigen</button>}
   </>}
  </div>
  <footer className={styles.dialogFooter}>
   {!!chosen.length&&<ul className={styles.chips} aria-label="Auswahl">{chosen.map(id=>{const f=files.find(x=>x.id===id);return <li key={id}>{f?.name||'Datei'}<button type="button" aria-label={'Aus Auswahl entfernen: '+(f?.name||'Datei')} onClick={()=>toggle(id)}><X size={13}/></button></li>;})}</ul>}
   <span className={styles.spacer}/>
   <button type="button" onClick={()=>dialog.current?.close()}>Abbrechen</button>
   <button type="button" className={styles.primary} disabled={!chosen.length} onClick={()=>{onPick(chosen);dialog.current?.close();}}>{multiple?'Übernehmen ('+chosen.length+')':'Übernehmen'}</button>
  </footer>
 </dialog>;
}
