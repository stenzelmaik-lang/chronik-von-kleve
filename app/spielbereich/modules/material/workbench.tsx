"use client";
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Plus,Search,Pencil,Eye,Copy,Trash2,MoreHorizontal,ArrowUp,ArrowDown,ArrowLeft,AlertTriangle,CheckCircle2,Save,FolderOpen,Palette,Sparkles,X,Layers} from 'lucide-react';
import {defaultMaterial,displayAssetStateLabels,effectProblem,effectSupport,effectiveEffect,isMaterialElement,materialAfterClose,materialAfterCloseLabels,materialCloseEffects,materialCloseLabels,materialDisplayLabels,materialEffects,materialFilesMax,materialOf,materialSpeedLabels,materialSpeeds,materialSummary,materialTypeInfo,materialTypeOf,materialTypes,withMaterial,type DisplayAsset,type MaterialType,type SceneMaterial} from '@/domain/material-system';
import {emptyScenePager,scenePagerMax,type SceneElement} from '@/domain/story-scene';
import type {PreparationRecipient} from '@/domain/personal-message';
import {api} from '../api-client';
import {PagerFields} from '../preparation-materials';
import {MaterialCover,MaterialPresenter,typeIcon,type PresentedMaterial} from './presenter';
import {FilePicker,FileThumb,MultiUpload,fileOrigin,fileUrl,type PickerFile} from './file-picker';
import {AssetGallery,AssetPreview} from './asset-gallery';
import styles from './workbench.module.css';

type Step='content'|'design'|'behavior'|'preview'|'save';
const steps:[Step,string,typeof Pencil][]=[['content','Inhalt',Pencil],['design','Gestaltung',Palette],['behavior','Verhalten & Effekte',Sparkles],['preview','Vorschau',Eye],['save','Speichern',Save]];
export type SaveState='clean'|'dirty'|'saving'|'saved'|'error';
const saveText:Record<SaveState,string>={clean:'Alles gespeichert',dirty:'Ungespeicherte Änderungen',saving:'Wird gespeichert …',saved:'Gespeichert · nicht veröffentlicht',error:'Nicht gespeichert – Entwurf bleibt erhalten'};
const textTypes:MaterialType[]=['letter','dossier','other'];
const plain=(html:string)=>html.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();

/** Status of one material for the card: missing files or asset, effect fallback, or ready. Never shows ids. */
function status(e:SceneElement,files:PickerFile[],assets:DisplayAsset[],loadedAssets:boolean){
 const m=materialOf(e),problems:string[]=[];
 if(m.type==='pager'){if(!e.pager?.text.trim())problems.push('Noch kein Pager-Text');return problems;}
 const missing=m.files.filter(f=>!f.fileId||!files.some(x=>x.id===f.fileId)).length;
 if(missing)problems.push(missing===1?'Eine Datei fehlt':missing+' Dateien fehlen');
 if(!m.files.length&&!(textTypes.includes(m.type)&&plain(e.text)))problems.push('Noch kein Inhalt');
 const asset=assets.find(a=>a.id===m.assetId);
 if(m.assetId&&loadedAssets&&!asset)problems.push('Darstellung fehlt');
 const p=effectProblem(m.effect.open,{states:asset?.states.map(s=>s.key)||[],files:m.files.filter(f=>f.fileId).length});
 if(p)problems.push('Effekt-Ersatz aktiv');
 return problems;
}
/** Private preview with the GM's own file access; nothing is laid on the table or released. */
function presented(e:SceneElement,assets:DisplayAsset[],files:PickerFile[]):PresentedMaterial{
 const m=materialOf(e),asset=assets.find(a=>a.id===m.assetId);
 return {title:e.title,type:m.type,display:m.display,effect:{open:m.effect.open,close:m.effect.close,speed:m.effect.speed,afterClose:m.effect.afterClose},
  states:asset?.states.map(s=>({key:s.key,src:fileUrl(s.fileId)}))||[],
  pages:m.files.filter(f=>f.fileId).map((f,i)=>({title:f.title||materialTypeInfo[m.type].label+' '+(i+1),src:fileUrl(f.fileId),mime:files.find(x=>x.id===f.fileId)?.mime||'image/*'})),
  ...(textTypes.includes(m.type)&&plain(e.text)?{caption:e.text}:{}),...(m.effect.soundFileId?{soundSrc:fileUrl(m.effect.soundFileId)}:{})};
}

function Card({element,index,count,files,assets,loadedAssets,onEdit,onTest,onDuplicate,onRemove,onMove}:{element:SceneElement;index:number;count:number;files:PickerFile[];assets:DisplayAsset[];loadedAssets:boolean;onEdit:()=>void;onTest:()=>void;onDuplicate:()=>void;onRemove:()=>void;onMove:(d:number)=>void}){
 const [menu,setMenu]=useState(false);
 const m=materialOf(element),problems=status(element,files,assets,loadedAssets),view=presented(element,assets,files);
 const Icon=typeIcon[m.type];
 return <li className={styles.card} data-material-card={element.id} data-type={m.type}>
  <button type="button" className={styles.cardPreview} aria-label={'Bearbeiten: '+element.title} onClick={onEdit}>{m.type==='pager'?<span className={styles.pagerPreview}><Icon size={26}/><small>{element.pager?.text.slice(0,60)||'Noch kein Text'}</small></span>:<MaterialCover material={view}/>}</button>
  <div className={styles.cardBody}>
   <h4 title={element.title}>{element.title}</h4>
   <p className={styles.cardMeta}><Icon size={13}/> {materialSummary(m,m.files.filter(f=>f.fileId).length)}</p>
   {problems.length?<p className={styles.cardWarn}><AlertTriangle size={13}/> {problems.join(' · ')}</p>:<p className={styles.cardOk}><CheckCircle2 size={13}/> Bereit · nicht veröffentlicht</p>}
   <div className={styles.cardActions}>
    <button type="button" onClick={onEdit}><Pencil size={15}/> Bearbeiten</button>
    {m.type!=='pager'&&<button type="button" onClick={onTest} disabled={!view.pages.length&&!view.caption}><Eye size={15}/> Privat testen</button>}
    <button type="button" aria-label={'Weitere Aktionen: '+element.title} aria-expanded={menu} onClick={()=>setMenu(!menu)}><MoreHorizontal size={16}/></button>
   </div>
   {menu&&<ul className={styles.menu} role="menu" onMouseLeave={()=>setMenu(false)}>
    <li><button type="button" role="menuitem" onClick={()=>{setMenu(false);onDuplicate();}}><Copy size={14}/> Duplizieren</button></li>
    <li><button type="button" role="menuitem" disabled={index===0} onClick={()=>{setMenu(false);onMove(-1);}}><ArrowUp size={14}/> Nach vorn</button></li>
    <li><button type="button" role="menuitem" disabled={index===count-1} onClick={()=>{setMenu(false);onMove(1);}}><ArrowDown size={14}/> Nach hinten</button></li>
    <li><button type="button" role="menuitem" className={styles.dangerText} onClick={()=>{setMenu(false);onRemove();}}><Trash2 size={14}/> Aus Szene entfernen</button></li>
   </ul>}
  </div>
 </li>;
}

/** Ordered file list of one material: rename, reorder, replace, remove the link. Removing never deletes the file. */
function FileList({material,files,onChange,onReplace}:{material:SceneMaterial;files:PickerFile[];onChange:(m:SceneMaterial)=>void;onReplace:(entryId:string)=>void}){
 const set=(list:SceneMaterial['files'])=>onChange({...material,files:list});
 const move=(i:number,d:number)=>{const n=[...material.files];[n[i],n[i+d]]=[n[i+d],n[i]];set(n);};
 if(!material.files.length)return <p className={styles.muted}>Noch keine Datei verknüpft.</p>;
 return <ol className={styles.fileList} aria-label="Dateien in fester Reihenfolge">{material.files.map((f,i)=>{const file=files.find(x=>x.id===f.fileId);return <li key={f.id} data-missing={!file}>
  <span className={styles.order}>{i+1}</span><FileThumb file={file}/>
  <div className={styles.fileFields}>
   <label>Bezeichnung<input value={f.title} maxLength={200} placeholder={file?file.name.replace(/\.[^.]+$/,''):'Datei fehlt'} onChange={e=>set(material.files.map(x=>x.id===f.id?{...x,title:e.target.value}:x))}/></label>
   <small>{file?file.name:'Datei nicht verfügbar – ersetzen oder Verknüpfung entfernen'}</small>
  </div>
  <div className={styles.fileButtons}>
   <button type="button" aria-label={'Nach oben: '+(f.title||file?.name||'Datei')} disabled={i===0} onClick={()=>move(i,-1)}><ArrowUp size={15}/></button>
   <button type="button" aria-label={'Nach unten: '+(f.title||file?.name||'Datei')} disabled={i===material.files.length-1} onClick={()=>move(i,1)}><ArrowDown size={15}/></button>
   <button type="button" onClick={()=>onReplace(f.id)}>Ersetzen</button>
   <button type="button" onClick={()=>set(material.files.filter(x=>x.id!==f.id))}>Verknüpfung entfernen</button>
  </div>
 </li>;})}</ol>;
}

function Section({title,children,open=true}:{title:string;children:ReactNode;open?:boolean}){return <details className={styles.section} open={open}><summary>{title}</summary><div>{children}</div></details>;}

/** One material in the common flow: content → design → behaviour/effects → preview → save. Saving never publishes. */
function Editor({element,files,assets,players,actorId,sceneFileIds,editor,saveState,onChange,onClose,onSave,onFilesChange,onAssetsChange}:{element:SceneElement;files:PickerFile[];assets:DisplayAsset[];players:PreparationRecipient[];actorId:string;sceneFileIds:string[];editor:(value:string,onChange:(value:string)=>void,label:string,key:string)=>ReactNode;saveState:SaveState;onChange:(e:SceneElement)=>void;onClose:()=>void;onSave?:()=>void;onFilesChange:(f:PickerFile[])=>void;onAssetsChange:(a:DisplayAsset[])=>void}){
 const [step,setStep]=useState<Step>('content'),[picker,setPicker]=useState<{replace?:string;sound?:boolean}|null>(null),[gallery,setGallery]=useState(false),[testing,setTesting]=useState(false);
 const m=materialOf(element),info=materialTypeInfo[m.type],asset=assets.find(a=>a.id===m.assetId);
 const setMaterial=(next:SceneMaterial)=>onChange(withMaterial(element,next));
 const states=asset?.states.map(s=>s.key)||[],count=m.files.filter(f=>f.fileId).length;
 const assetFileIds=[...new Set(assets.flatMap(a=>a.states.map(s=>s.fileId)))];
 function addFiles(ids:string[]){
  const fresh=ids.filter(id=>!m.files.some(f=>f.fileId===id)).map(fileId=>({id:crypto.randomUUID(),fileId,title:''}));
  const list=info.multiple?[...m.files,...fresh].slice(0,materialFilesMax):fresh.slice(0,1).length?fresh.slice(0,1):m.files;
  const first=files.find(f=>f.id===list[0]?.fileId);
  onChange({...withMaterial(element,{...m,files:list}),title:element.title===info.label&&first?first.name.replace(/\.[^.]+$/,''):element.title});
 }
 const view=presented(element,assets,files);
 return <section className={styles.editor} aria-label={'Material bearbeiten: '+element.title}>
  <header className={styles.editorHead}>
   <button type="button" onClick={onClose}><ArrowLeft size={16}/> Zur Übersicht</button>
   <div><small>{info.label}</small><h3>{element.title||info.label}</h3></div>
   <p className={styles.saveState} data-state={saveState} role="status">{saveText[saveState]}</p>
  </header>
  <nav className={styles.steps} aria-label="Arbeitsschritte">{steps.filter(([id])=>m.type!=='pager'||id!=='design'&&id!=='behavior').map(([id,label,StepIcon],i)=><button type="button" key={id} aria-current={step===id?'step':undefined} onClick={()=>setStep(id)}><span>{i+1}</span><StepIcon size={15}/> {label}</button>)}</nav>
  <div className={styles.editorBody}>
   {step==='content'&&<>
    <label className={styles.wide}>{m.type==='pager'?'Titel / Betreff':'Titel'}<input value={element.title} maxLength={m.type==='pager'?scenePagerMax.title:200} onChange={e=>onChange({...element,title:e.target.value})}/></label>
    {m.type==='pager'?<PagerFields pager={element.pager||emptyScenePager()} players={players} onChange={pager=>onChange({...element,pager})}/>:<>
     <Section title={info.multiple?'Dateien ('+m.files.length+'/'+materialFilesMax+')':'Datei'}>
      <FileList material={m} files={files} onChange={setMaterial} onReplace={id=>setPicker({replace:id})}/>
      <div className={styles.row}>
       <button type="button" onClick={()=>setPicker({})} disabled={info.multiple&&m.files.length>=materialFilesMax}><FolderOpen size={16}/> {info.multiple?'Vorhandene Dateien wählen':m.files.length?'Andere Datei wählen':'Vorhandene Datei wählen'}</button>
       <MultiUpload accept={info.accept} multiple={info.multiple} label={info.multiple?'Mehrere Dateien hochladen':'Datei hochladen'} onUploaded={f=>{onFilesChange([{...f,owner_id:actorId},...files.filter(x=>x.id!==f.id)]);addFiles([f.id]);}}/>
      </div>
      {m.files.some(f=>{const file=files.find(x=>x.id===f.fileId);return file?.visibility==='private';})&&<p className={styles.hint}><AlertTriangle size={14}/> Mindestens eine Datei ist eine private Datei. Spieler sehen sie erst, wenn du dieses Material am Tisch freigibst.</p>}
      {info.multiple&&m.files.length>1&&<p className={styles.muted}>Auf der Bühne bleibt es ein Objekt mit {m.files.length} Inhalten in dieser Reihenfolge.</p>}
     </Section>
     {textTypes.includes(m.type)&&<Section title="Text für Spieler (optional)">{editor(element.text,text=>onChange({...element,text}),'Text, den Spieler beim Öffnen lesen',element.id+':text')}</Section>}
     {!textTypes.includes(m.type)&&<Section title="Einsatz – wann zeigen? (nur SL)" open={!!plain(element.text)}>{editor(element.text,text=>onChange({...element,text}),'Einsatz (nur SL)',element.id+':cue')}</Section>}
     <Section title="SL-Notiz (wird nie gezeigt)" open={!!m.note}><label className={styles.wide}>Notiz<textarea value={m.note} maxLength={3000} rows={3} onChange={e=>setMaterial({...m,note:e.target.value})}/></label></Section>
    </>}
   </>}
   {step==='design'&&m.type!=='pager'&&<>
    <Section title={'Darstellung · '+info.assetRole}>
     <div className={styles.assetChoice}>
      <AssetPreview asset={asset} files={files} size={120}/>
      <div>
       <strong>{asset?asset.title:m.assetId?'Darstellung fehlt':'Standarddarstellung'}</strong>
       <small>{asset?asset.states.map(s=>s.label||displayAssetStateLabels[s.key]||s.key).join(' · '):m.assetId?'Die gewählte Darstellung gibt es nicht mehr. Es wird die einfache Darstellung gezeigt.':'Ohne eigenes Asset zeigt der Tisch eine einfache, passende Darstellung.'}</small>
       <div className={styles.row}><button type="button" onClick={()=>setGallery(true)}><Palette size={16}/> {m.assetId?'Andere Darstellung wählen':'Darstellung wählen'}</button>{m.assetId&&<button type="button" onClick={()=>setMaterial({...m,assetId:''})}>Zuordnung entfernen</button>}</div>
      </div>
     </div>
    </Section>
    {info.displays.length>1&&<Section title="Anzeigeform"><div className={styles.choiceGrid} role="radiogroup" aria-label="Anzeigeform">{info.displays.map(d=><button type="button" role="radio" key={d} aria-checked={m.display===d} onClick={()=>setMaterial({...m,display:d})}><Layers size={16}/> {materialDisplayLabels[d]}</button>)}</div></Section>}
   </>}
   {step==='behavior'&&m.type!=='pager'&&<>
    <Section title={m.type==='backdrop'?'Übergang':'Öffnen'}>
     <div className={styles.choiceGrid} role="radiogroup" aria-label="Öffnungseffekt">{info.effects.map(id=>{const s=effectSupport(id,{states,files:count});return <button type="button" role="radio" key={id} aria-checked={m.effect.open===id} data-needs={!s.ok} onClick={()=>setMaterial({...m,effect:{...m.effect,open:id}})} title={materialEffects[id].hint}><strong>{materialEffects[id].label}</strong><small>{s.ok?materialEffects[id].hint:s.missing.length?'Braucht Zustand '+s.missing.map(k=>displayAssetStateLabels[k]).join(' + '):'Braucht mehrere Inhalte'}</small></button>;})}</div>
     {effectProblem(m.effect.open,{states,files:count})&&<p className={styles.hint}><AlertTriangle size={14}/> {effectProblem(m.effect.open,{states,files:count})} <button type="button" className={styles.linkButton} onClick={()=>setMaterial({...m,effect:{...m.effect,open:effectiveEffect(m.effect.open,{states,files:count})}})}>Ersatz übernehmen</button></p>}
    </Section>
    <div className={styles.fieldRow}>
     <label>Geschwindigkeit<select value={m.effect.speed} onChange={e=>setMaterial({...m,effect:{...m.effect,speed:e.target.value as SceneMaterial['effect']['speed']}})}>{materialSpeeds.map(s=><option key={s} value={s}>{materialSpeedLabels[s]}</option>)}</select></label>
     {m.type!=='backdrop'&&<label>Schließen<select value={m.effect.close} onChange={e=>setMaterial({...m,effect:{...m.effect,close:e.target.value as SceneMaterial['effect']['close']}})}>{materialCloseEffects.map(c=><option key={c} value={c}>{materialCloseLabels[c]}</option>)}</select></label>}
     {m.type!=='backdrop'&&<label>Nach dem Schließen<select value={m.effect.afterClose} onChange={e=>setMaterial({...m,effect:{...m.effect,afterClose:e.target.value as SceneMaterial['effect']['afterClose']}})}>{materialAfterClose.map(c=><option key={c} value={c}>{materialAfterCloseLabels[c]}</option>)}</select></label>}
    </div>
    {m.type!=='backdrop'&&<Section title="Effektton (optional)" open={!!m.effect.soundFileId}>
     <p className={styles.muted}>Spielt nur nach dem eigenen Klick auf „Öffnen“. Jede Person kann Effekttöne für sich abschalten.</p>
     <div className={styles.row}>{m.effect.soundFileId?<><FileThumb file={files.find(f=>f.id===m.effect.soundFileId)} size={40}/><span>{files.find(f=>f.id===m.effect.soundFileId)?.name||'Ton nicht verfügbar'}</span><button type="button" onClick={()=>setMaterial({...m,effect:{...m.effect,soundFileId:''}})}>Verknüpfung entfernen</button></>:null}<button type="button" onClick={()=>setPicker({sound:true})}>{m.effect.soundFileId?'Anderen Ton wählen':'Ton wählen'}</button></div>
    </Section>}
   </>}
   {step==='preview'&&<>
    <p className={styles.muted}>Die Vorschau nutzt die echten Dateien und Darstellungen und bleibt privat. Es wird nichts auf den Tisch gelegt oder freigegeben.</p>
    <div className={styles.previewCard}>{m.type==='pager'?<p>{element.pager?.text||'Noch kein Pager-Text.'}</p>:<MaterialCover material={view}/>}<div><strong>{element.title}</strong><small>{materialSummary(m,count)}</small>{status(element,files,assets,true).map(p=><p key={p} className={styles.cardWarn}><AlertTriangle size={13}/> {p}</p>)}</div></div>
    {m.type!=='pager'&&<button type="button" className={styles.primary} disabled={!view.pages.length&&!view.caption} onClick={()=>setTesting(true)}><Eye size={16}/> Privat testen</button>}
   </>}
   {step==='save'&&<>
    <p>Speichern sichert die Szene mit diesem Material. Es wird <strong>nicht veröffentlicht</strong>; freigeben kannst du es nur am Spieltisch oder in der Regie.</p>
    <p className={styles.saveState} data-state={saveState} role="status">{saveText[saveState]}</p>
    {onSave&&<button type="button" className={styles.primary} disabled={saveState==='saving'||saveState==='clean'||saveState==='saved'} onClick={onSave}><Save size={16}/> Szenenmaterial speichern</button>}
   </>}
  </div>
  <footer className={styles.editorFoot}>
   <button type="button" disabled={step===steps[0][0]} onClick={()=>{const list=steps.filter(([id])=>m.type!=='pager'||id!=='design'&&id!=='behavior');const i=list.findIndex(([id])=>id===step);if(i>0)setStep(list[i-1][0]);}}>Zurück</button>
   <span className={styles.spacer}/>
   {step!=='save'&&<button type="button" className={styles.primary} onClick={()=>{const list=steps.filter(([id])=>m.type!=='pager'||id!=='design'&&id!=='behavior');const i=list.findIndex(([id])=>id===step);setStep(list[Math.min(list.length-1,i+1)][0]);}}>Weiter</button>}
  </footer>
  {picker&&<FilePicker title={picker.sound?'Effektton wählen':picker.replace?'Datei ersetzen':info.multiple?'Dateien wählen':'Datei wählen'} files={files} accept={picker.sound?'audio':info.accept} multiple={!picker.sound&&!picker.replace&&info.multiple} actorId={actorId} sceneFileIds={sceneFileIds} assetFileIds={assetFileIds} onFilesChange={onFilesChange} onClose={()=>setPicker(null)}
   onPick={ids=>{if(picker.sound)setMaterial({...m,effect:{...m.effect,soundFileId:ids[0]||''}});else if(picker.replace)setMaterial({...m,files:m.files.map(f=>f.id===picker.replace?{...f,fileId:ids[0]||f.fileId}:f)});else addFiles(ids);}}/>}
  {gallery&&<AssetGallery assets={assets} files={files} actorId={actorId} kinds={info.assetKinds} selected={m.assetId} onSelect={id=>setMaterial({...m,assetId:id})} onAssetsChange={onAssetsChange} onFilesChange={onFilesChange} onClose={()=>setGallery(false)}/>}
  {testing&&<MaterialPresenter material={view} personalKey={'test:'+element.id} badge="Privater Test – nur für dich" onClose={()=>setTesting(false)}/>}
 </section>;
}

/**
 * Interaktionen & Spielmaterial: one overview of all materials of a scene as compact cards with search, type filter
 * and sorting, and one editor flow for every type. Other scene building blocks keep their existing editor below.
 */
export function MaterialWorkbench({elements,onChange,files,onFilesChange,players,actorId,editor,saveState,onSave,others}:{elements:SceneElement[];onChange:(elements:SceneElement[])=>void;files:PickerFile[];onFilesChange:(files:PickerFile[])=>void;players:PreparationRecipient[];actorId:string;editor:(value:string,onChange:(value:string)=>void,label:string,key:string)=>ReactNode;saveState:SaveState;onSave?:()=>void;others?:ReactNode}){
 const [assets,setAssets]=useState<DisplayAsset[]>([]),[assetsLoaded,setAssetsLoaded]=useState(false),[assetError,setAssetError]=useState('');
 const [search,setSearch]=useState(''),[filter,setFilter]=useState<'all'|MaterialType>('all'),[sort,setSort]=useState<'scene'|'title'|'type'>('scene');
 const [editing,setEditing]=useState(''),[choosing,setChoosing]=useState(false),[testing,setTesting]=useState(''),[removing,setRemoving]=useState<SceneElement|null>(null);
 const confirm=useRef<HTMLDialogElement>(null);
 useEffect(()=>{api<{assets:DisplayAsset[]}>('/api/display-assets').then(r=>{setAssets(r.assets);setAssetsLoaded(true);}).catch(e=>setAssetError((e as Error).message));},[]);
 useEffect(()=>{if(removing&&!confirm.current?.open)confirm.current?.showModal();},[removing]);
 const materials=elements.filter(isMaterialElement);
 const sceneFileIds=useMemo(()=>[...new Set(elements.flatMap(e=>[e.fileId,...(e.material?.files.map(f=>f.fileId)||[])]).filter(Boolean))],[elements]);
 const listed=useMemo(()=>{
  const q=search.trim().toLocaleLowerCase('de');
  const found=materials.filter(e=>(filter==='all'||materialTypeOf(e)===filter)&&(!q||(e.title+' '+materialTypeInfo[materialTypeOf(e)].label+' '+plain(e.text)).toLocaleLowerCase('de').includes(q)));
  return sort==='title'?[...found].sort((x,y)=>x.title.localeCompare(y.title,'de')):sort==='type'?[...found].sort((x,y)=>materialTypes.indexOf(materialTypeOf(x))-materialTypes.indexOf(materialTypeOf(y))||x.title.localeCompare(y.title,'de')):found;
 },[materials,filter,search,sort]);
 const update=(next:SceneElement)=>onChange(elements.map(e=>e.id===next.id?next:e));
 function add(type:MaterialType){
  const id=crypto.randomUUID(),info=materialTypeInfo[type];
  const element:SceneElement=withMaterial({id,kind:'object',title:info.label,text:'',referenceId:'',fileId:'',...(type==='pager'?{pager:emptyScenePager()}:{})},defaultMaterial(type));
  onChange([...elements,element]);setChoosing(false);setEditing(id);
 }
 function duplicate(e:SceneElement){
  const id=crypto.randomUUID(),m=materialOf(e);
  const copy=withMaterial({...e,id,title:(e.title+' (Kopie)').slice(0,e.kind==='pager'?scenePagerMax.title:200)},{...m,files:m.files.map(f=>({...f,id:crypto.randomUUID()}))});
  const i=elements.findIndex(x=>x.id===e.id);onChange([...elements.slice(0,i+1),copy,...elements.slice(i+1)]);
 }
 function move(e:SceneElement,d:number){
  const order=materials.map(x=>x.id),i=order.indexOf(e.id),j=i+d;if(j<0||j>=order.length)return;
  const a=elements.findIndex(x=>x.id===order[i]),b=elements.findIndex(x=>x.id===order[j]),next=[...elements];[next[a],next[b]]=[next[b],next[a]];onChange(next);
 }
 const current=elements.find(e=>e.id===editing);
 const test=elements.find(e=>e.id===testing);
 if(current)return <Editor element={current} files={files} assets={assets} players={players} actorId={actorId} sceneFileIds={sceneFileIds} editor={editor} saveState={saveState} onChange={update} onClose={()=>setEditing('')} onSave={onSave} onFilesChange={onFilesChange} onAssetsChange={setAssets}/>;
 return <section className={styles.workbench} aria-label="Interaktionen & Spielmaterial">
  <header className={styles.head}>
   <div><h3>Interaktionen & Spielmaterial</h3><p>Alles, was du zeigst oder übergibst – als je ein Objekt mit Dateien, Darstellung und Effekt. Speichern veröffentlicht nie; freigegeben wird nur am Tisch oder in der Regie.</p></div>
   <p className={styles.saveState} data-state={saveState} role="status">{saveText[saveState]}</p>
  </header>
  <div className={styles.toolbar}>
   <label className={styles.search}><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Material suchen …" aria-label="Material suchen"/></label>
   <label>Art<select aria-label="Nach Art filtern" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option value="all">Alle Arten</option>{materialTypes.map(t=><option key={t} value={t}>{materialTypeInfo[t].label}</option>)}</select></label>
   <label>Sortierung<select aria-label="Sortierung" value={sort} onChange={e=>setSort(e.target.value as typeof sort)}><option value="scene">Reihenfolge der Szene</option><option value="title">Titel</option><option value="type">Art</option></select></label>
   <button type="button" className={styles.primary} disabled={elements.length>=100} aria-expanded={choosing} onClick={()=>setChoosing(!choosing)}><Plus size={16}/> Material hinzufügen</button>
  </div>
  {assetError&&<p className={styles.error} role="alert">Darstellungen konnten nicht geladen werden: {assetError}</p>}
  {choosing&&<section className={styles.typeChooser} aria-label="Art des Materials wählen"><header><h4>Welche Art von Material?</h4><button type="button" aria-label="Auswahl schließen" onClick={()=>setChoosing(false)}><X size={16}/></button></header>
   <ul>{materialTypes.map(t=>{const Icon=typeIcon[t];return <li key={t}><button type="button" onClick={()=>add(t)}><Icon size={22}/><strong>{materialTypeInfo[t].label}</strong><span>{materialTypeInfo[t].hint}</span></button></li>;})}</ul></section>}
  {!materials.length?<div className={styles.empty}><Layers size={30}/><p>Noch kein Spielmaterial in dieser Szene. Beginne mit „Material hinzufügen“.</p></div>:
   !listed.length?<p className={styles.muted}>Kein Material passt zu Suche oder Filter.</p>:
   <ul className={styles.cards}>{listed.map(e=><Card key={e.id} element={e} index={materials.indexOf(e)} count={materials.length} files={files} assets={assets} loadedAssets={assetsLoaded} onEdit={()=>setEditing(e.id)} onTest={()=>setTesting(e.id)} onDuplicate={()=>duplicate(e)} onRemove={()=>setRemoving(e)} onMove={d=>move(e,d)}/>)}</ul>}
  <small className={styles.muted}>{materials.length} Materialien · {elements.length}/100 Bausteine der Szene{sort!=='scene'?' · Reihenfolge ändern nur in der Sortierung „Reihenfolge der Szene“ sinnvoll':''}</small>
  {others}
  {test&&<MaterialPresenter material={presented(test,assets,files)} personalKey={'test:'+test.id} badge="Privater Test – nur für dich" onClose={()=>setTesting('')}/>}
  <dialog ref={confirm} className={styles.confirmDialog} aria-label="Aus Szene entfernen" onClose={()=>setRemoving(null)}>{removing&&<>
   <h3>„{removing.title}“ aus der Szene entfernen?</h3>
   <p>Das Material verschwindet aus dieser Szene. Die Dateien und Darstellungen bleiben in der Medienverwaltung erhalten. Wirksam wird es erst beim Speichern.</p>
   <div className={styles.row}><button type="button" onClick={()=>confirm.current?.close()}>Abbrechen</button><button type="button" className={styles.danger} onClick={()=>{onChange(elements.filter(e=>e.id!==removing.id));confirm.current?.close();}}><Trash2 size={16}/> Aus Szene entfernen</button></div>
  </>}</dialog>
 </section>;
}
export {fileOrigin};
