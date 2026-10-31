"use client";
/* eslint-disable @next/next/no-img-element -- Protected existing file endpoints. */
import {useEffect,useMemo,useRef,useState} from 'react';
import {X,Check,Plus,Search,Pencil,Trash2,ImagePlus,Ban} from 'lucide-react';
import {displayAssetKindLabels,displayAssetKinds,displayAssetStateLabels,displayAssetStateMax,emptyDisplayAsset,type DisplayAsset,type DisplayAssetDraft,type DisplayAssetKind} from '@/domain/material-system';
import {api} from '../api-client';
import {FilePicker,fileUrl,type PickerFile} from './file-picker';
import styles from './workbench.module.css';

/** Closed-state preview of an asset; a missing image says so instead of breaking the card. */
export function AssetPreview({asset,files,size=88}:{asset:DisplayAsset|undefined;files:PickerFile[];size?:number}){
 const closed=asset?.states.find(s=>s.key==='closed');
 if(!asset||!closed)return <span className={styles.thumbMissing} style={{width:size,height:size}} title="Darstellung fehlt"><Ban size={18}/></span>;
 const known=files.some(f=>f.id===closed.fileId);
 return <img className={styles.assetThumb} style={{width:size,height:size}} src={fileUrl(closed.fileId)} alt="" loading="lazy" decoding="async" data-unlisted={!known}/>;
}

/** Create or change one display asset: name, kind and one image per state. Changing it changes every material using it. */
function AssetEditor({asset,files,actorId,usage,onSaved,onCancel,onFilesChange}:{asset:DisplayAsset|null;files:PickerFile[];actorId:string;usage:number;onSaved:(a:DisplayAsset)=>void;onCancel:()=>void;onFilesChange:(f:PickerFile[])=>void}){
 const [draft,setDraft]=useState<DisplayAssetDraft>(asset?{title:asset.title,kind:asset.kind,states:asset.states,tags:asset.tags}:emptyDisplayAsset());
 const [picking,setPicking]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const states=[...(draft.states.some(s=>s.key==='closed')?[]:[{key:'closed',label:'Geschlossen',fileId:''}]),...(draft.states.some(s=>s.key==='open')?[]:[{key:'open',label:'Geöffnet',fileId:''}]),...draft.states].sort((x,y)=>(x.key==='closed'?0:x.key==='open'?1:2)-(y.key==='closed'?0:y.key==='open'?1:2));
 const setState=(key:string,fileId:string,label?:string)=>setDraft(d=>({...d,states:fileId?[...d.states.filter(s=>s.key!==key),{key,label:label??(displayAssetStateLabels[key]||key),fileId}]:d.states.filter(s=>s.key!==key)}));
 async function save(){setBusy(true);setError('');try{const r=await api<{asset:DisplayAsset}>('/api/display-assets','POST',{...(asset?{id:asset.id,version:asset.version}:{}),asset:{...draft,states:draft.states.filter(s=>s.fileId)}});onSaved(r.asset);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const extra=draft.states.filter(s=>s.key!=='closed'&&s.key!=='open').length;
 return <section className={styles.assetEditor} aria-label={asset?'Darstellung bearbeiten':'Neue Darstellung'}>
  <h3>{asset?'Darstellung bearbeiten':'Neue Darstellung'}</h3>
  {asset&&usage>0&&<p className={styles.hint}>Wird in {usage===1?'einer Szene':usage+' Szenen'} genutzt. Änderungen gelten überall, die Bilder werden nicht kopiert.</p>}
  <div className={styles.fieldRow}>
   <label>Name<input value={draft.title} maxLength={120} placeholder="z. B. Brauner Umschlag mit Siegel" onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
   <label>Art<select value={draft.kind} onChange={e=>setDraft({...draft,kind:e.target.value as DisplayAssetKind})}>{displayAssetKinds.map(k=><option key={k} value={k}>{displayAssetKindLabels[k]}</option>)}</select></label>
  </div>
  <ul className={styles.stateList}>{states.map(s=>{const file=files.find(f=>f.id===s.fileId);return <li key={s.key}>
   {s.fileId?<img className={styles.assetThumb} src={fileUrl(s.fileId)} alt="" loading="lazy"/>:<span className={styles.thumbMissing}><ImagePlus size={18}/></span>}
   <div><strong>{s.key==='closed'?'Geschlossen (Pflicht)':s.key==='open'?'Geöffnet (optional)':<input aria-label="Name des Zustands" value={s.label} maxLength={60} onChange={e=>setState(s.key,s.fileId,e.target.value)}/>}</strong><small>{file?file.name:s.fileId?'Bild nicht in deiner Liste':'Noch kein Bild'}</small></div>
   <button type="button" onClick={()=>setPicking(s.key)}>{s.fileId?'Ersetzen':'Bild wählen'}</button>
   {s.fileId&&s.key!=='closed'&&<button type="button" onClick={()=>setState(s.key,'')}>Entfernen</button>}
  </li>;})}</ul>
  {draft.states.length<displayAssetStateMax&&<button type="button" onClick={()=>setPicking('extra-'+(extra+1))}><Plus size={16}/> Weiteren Zustand hinzufügen</button>}
  {error&&<p className={styles.error} role="alert">{error}</p>}
  <div className={styles.row}><button type="button" onClick={onCancel}>Abbrechen</button><button type="button" className={styles.primary} disabled={busy||!draft.title.trim()||!draft.states.some(s=>s.key==='closed'&&s.fileId)} onClick={()=>void save()}>{busy?'Wird gespeichert …':'Darstellung speichern'}</button></div>
  {picking&&<FilePicker title={'Bild für „'+(displayAssetStateLabels[picking]||'Zustand')+'“'} files={files} accept="image" multiple={false} actorId={actorId} sceneFileIds={[]} assetFileIds={[]} initial={draft.states.find(s=>s.key===picking)?.fileId?[draft.states.find(s=>s.key===picking)!.fileId]:[]} onFilesChange={onFilesChange} onClose={()=>setPicking('')} onPick={([id])=>{if(id)setState(picking,id,picking.startsWith('extra-')?'Zustand '+picking.slice(6):undefined);}}/>}
 </section>;
}

/**
 * The GM's asset gallery: search, filter by kind, choose, upload/create, replace (edit) and delete unused assets.
 * Choosing only links the asset to the material; it never copies a file.
 */
export function AssetGallery({assets,files,actorId,kinds,selected,onSelect,onAssetsChange,onFilesChange,onClose}:{assets:DisplayAsset[];files:PickerFile[];actorId:string;kinds:DisplayAssetKind[];selected:string;onSelect:(id:string)=>void;onAssetsChange:(a:DisplayAsset[])=>void;onFilesChange:(f:PickerFile[])=>void;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [search,setSearch]=useState(''),[kind,setKind]=useState<'recommended'|'all'|DisplayAssetKind>(kinds.length?'recommended':'all'),[editing,setEditing]=useState<DisplayAsset|null|'new'>(null);
 const [usage,setUsage]=useState<Record<string,{id:string;title:string}[]>>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{const d=dialog.current;if(d&&!d.open)d.showModal();},[]);
 const listed=useMemo(()=>assets.filter(a=>(kind==='all'||(kind==='recommended'?kinds.includes(a.kind):a.kind===kind))&&(a.title+' '+a.tags.join(' ')).toLocaleLowerCase('de').includes(search.trim().toLocaleLowerCase('de'))),[assets,kind,kinds,search]);
 async function loadUsage(a:DisplayAsset){try{const r=await api<{usage:{id:string;title:string}[]}>('/api/display-assets?usage='+encodeURIComponent(a.id));setUsage(u=>({...u,[a.id]:r.usage}));return r.usage;}catch{return [];}}
 async function remove(a:DisplayAsset){setError('');setBusy(true);try{const used=usage[a.id]||await loadUsage(a);if(used.length){setError('„'+a.title+'“ wird noch in '+used.map(s=>s.title).join(', ')+' genutzt. Entferne dort zuerst die Zuordnung.');return;}if(!window.confirm('Darstellung „'+a.title+'“ löschen? Die Bilddateien bleiben in der Medienverwaltung.'))return;await api('/api/display-assets','DELETE',{id:a.id,version:a.version});onAssetsChange(assets.filter(x=>x.id!==a.id));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <dialog ref={dialog} className={styles.dialog} aria-label="Darstellungs-Assets" onClose={onClose}>
  <header><h2>Darstellungs-Assets</h2><button type="button" aria-label="Asset-Galerie schließen" onClick={()=>dialog.current?.close()}><X/></button></header>
  <div className={styles.dialogBody}>
   {editing?<AssetEditor asset={editing==='new'?null:editing} files={files} actorId={actorId} usage={editing!=='new'?usage[editing.id]?.length||0:0} onFilesChange={onFilesChange} onCancel={()=>setEditing(null)} onSaved={a=>{onAssetsChange([a,...assets.filter(x=>x.id!==a.id)]);setEditing(null);if(!selected)onSelect(a.id);}}/>:<>
    <p className={styles.muted}>Eigene Umschläge, Mappen, Rahmen, Geräte und Bildschirme. Jedes Bild wird nur einmal gespeichert und kann in beliebig vielen Materialien genutzt werden.</p>
    <div className={styles.pickerTools}>
     <label className={styles.search}><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Darstellungen suchen …" aria-label="Darstellungen suchen"/></label>
     <label>Art<select value={kind} onChange={e=>setKind(e.target.value as typeof kind)}>{kinds.length>0&&<option value="recommended">Passend zur Materialart</option>}<option value="all">Alle Arten</option>{displayAssetKinds.map(k=><option key={k} value={k}>{displayAssetKindLabels[k]}</option>)}</select></label>
     <button type="button" className={styles.primary} onClick={()=>setEditing('new')}><Plus size={16}/> Neue Darstellung</button>
    </div>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {!listed.length?<p className={styles.muted}>{assets.length?'Keine passende Darstellung. Wähle „Alle Arten“ oder lege eine neue an.':'Noch keine Darstellungen. Lege mit „Neue Darstellung“ die erste an.'}</p>:
    <ul className={styles.assetGrid}>{listed.map(a=><li key={a.id} data-selected={selected===a.id}>
     <button type="button" className={styles.pickerItem} aria-pressed={selected===a.id} onClick={()=>{onSelect(a.id);dialog.current?.close();}}><AssetPreview asset={a} files={files} size={110}/><span>{a.title}</span><small>{displayAssetKindLabels[a.kind]} · {a.states.map(s=>s.label||displayAssetStateLabels[s.key]||s.key).join(', ')}</small>{selected===a.id&&<Check className={styles.check} size={18}/>}</button>
     <div className={styles.row}><button type="button" className={styles.linkButton} onClick={()=>{void loadUsage(a);setEditing(a);}}><Pencil size={14}/> Bearbeiten / Ersetzen</button><button type="button" className={styles.linkButton} disabled={busy} onClick={()=>void remove(a)}><Trash2 size={14}/> Löschen</button></div>
    </li>)}</ul>}
   </>}
  </div>
  <footer className={styles.dialogFooter}><span className={styles.spacer}/>{selected&&!editing&&<button type="button" onClick={()=>{onSelect('');dialog.current?.close();}}>Zuordnung entfernen</button>}<button type="button" onClick={()=>dialog.current?.close()}>Schließen</button></footer>
 </dialog>;
}
