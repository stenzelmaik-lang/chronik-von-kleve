"use client";
import {useCallback,useEffect,useState} from 'react';
import type {Actor} from '@/domain/types';
import type {SceneDocument,SceneSummary,SceneView} from '@/domain/story-scene';
import type {CommandReference} from '@/domain/command-workspace';
import type {PreparationRecipient} from '@/domain/personal-message';
import {isMaterialElement} from '@/domain/material-system';
import type {SceneElement} from '@/domain/story-scene';
import {MaterialWorkbench,type SaveState} from './material/workbench';
import type {PickerFile} from './material/file-picker';
import {api} from './api-client';
import {PreparationMaterials} from './preparation-materials';
import {RichTextEditor} from './rich-text';
import {TableMaterialLibrary} from './table-material-library';
import {usePreparationDraft} from './use-preparation-draft';
import s from './material-library.module.css';

/** Replaces the non-material building blocks inside the full element list and keeps every element's position. */
function mergeBlocks(all:SceneElement[],blocks:SceneElement[]){
 const queue=[...blocks],out:SceneElement[]=[];
 for(const e of all){if(isMaterialElement(e)){out.push(e);continue;}const next=queue.shift();if(next)out.push(next);}
 return [...out,...queue];
}
/** Scene materials (Spielmaterial 3.0 workbench) and the other building blocks of one scene, saved with the scene. */
function SceneMaterialPreparation({a,initialScene=''}:{a:Actor;initialScene?:string}){
 const [catalog,setCatalog]=useState<{scenes:SceneSummary[];references:CommandReference[]}>({scenes:[],references:[]}),[files,setFiles]=useState<PickerFile[]>([]),[players,setPlayers]=useState<PreparationRecipient[]>([]);
 const [loaded,setLoaded]=useState<SceneView|null>(null),[draft,setDraft]=usePreparationDraft<SceneView>(a.campaignId+':'+a.id+':scene-material'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const current=draft||loaded;
 const refresh=useCallback(async()=>{const [c,f,p]=await Promise.all([api<typeof catalog>('/api/command-center'),api<{files:PickerFile[]}>('/api/files'),api<{recipients:PreparationRecipient[]}>('/api/messages?recipients=1&context=preparation')]);setCatalog({scenes:c.scenes,references:c.references});setFiles(f.files);setPlayers(p.recipients.filter(p=>p.role==='player'));},[]);
 useEffect(()=>{Promise.resolve().then(refresh).catch(e=>setError((e as Error).message));},[refresh]);
 const [saved,setSaved]=useState(false);
 const saveState:SaveState=busy&&draft?'saving':error&&draft?'error':draft?'dirty':saved?'saved':'clean';
 // A link from the scene editor (step 4) opens the scene directly, unless a draft of another scene is pending.
 useEffect(()=>{if(initialScene&&!draft&&!loaded)void select(initialScene);// eslint-disable-next-line react-hooks/exhaustive-deps
 },[initialScene]);
 async function select(id:string){setError('');setNotice('');if(!id){setLoaded(null);return;}setBusy(true);try{setLoaded((await api<{scene:SceneView}>('/api/command-center/scenes?id='+encodeURIComponent(id))).scene);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 function change(patch:Partial<SceneDocument>){if(current){setSaved(false);setDraft({...current,document:{...current.document,...patch}});}}
 async function save(){if(!draft)return;setBusy(true);setError('');try{const result=await api<{scene:SceneView}>('/api/command-center/scenes','POST',{action:'save',id:draft.id,version:draft.version,document:draft.document});setLoaded(result.scene);setDraft(null);setSaved(true);setNotice('Szenenmaterial gespeichert – nicht veröffentlicht. Erzählung, Einsatzplan und andere Szenenbereiche bleiben erhalten.');await refresh();}catch(e){setError((e as Error).message+' Dein Materialentwurf bleibt erhalten.');}finally{setBusy(false);}}
 return <section className={s.library} aria-label="Szenenmaterial verwalten"><header className={s.header}><div><h1>Szenenmaterial</h1><p>Die bisherigen Bausteine aus der Szenenvorbereitung verwaltest du jetzt hier. Sie bleiben mit ihrer ursprünglichen Szene verknüpft; der Einsatzplan steht weiterhin in der Szene.</p></div></header>
  {error&&<p className={s.error} role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <div className={s.toolbar}><label>Szene auswählen<select aria-label="Szene für Materialvorbereitung" disabled={busy||!!draft} value={current?.id||''} onChange={e=>void select(e.target.value)}><option value="">Szene auswählen …</option>{catalog.scenes.filter(scene=>!scene.archived||scene.id===current?.id).map(scene=><option key={scene.id} value={scene.id}>{scene.title}</option>)}</select></label>{draft&&<><button disabled={busy} onClick={()=>{setDraft(null);setNotice('Ungespeicherte Änderungen am Szenenmaterial verworfen.');}}>Änderungen verwerfen</button><button disabled={busy} onClick={()=>void save()}>Szenenmaterial speichern</button></>}</div>
  {current?<>
   <fieldset disabled={busy} className={s.materialFields} aria-label="Szenenbausteine bearbeiten">
    <MaterialWorkbench elements={current.document.elements} onChange={elements=>change({elements})} files={files} onFilesChange={setFiles} players={players} actorId={a.id} saveState={saveState} onSave={()=>void save()}
     editor={(value,onChange,label,key)=><RichTextEditor key={key} value={value} onChange={onChange} label={label} maximumPlainLength={10000} placeholder="Privater Materialinhalt …" advanced htmlSource compactTools preparationTools files={files} disabled={busy}/>}
     others={<PreparationMaterials variant="blocks" elements={current.document.elements.filter(e=>!isMaterialElement(e))} onChange={blocks=>change({elements:mergeBlocks(current.document.elements,blocks)})} references={catalog.references} files={files} players={players} onUploaded={f=>setFiles(old=>[f,...old.filter(x=>x.id!==f.id)])} editor={(value,onChange,label,key)=><RichTextEditor key={key} value={value} onChange={onChange} label={label} maximumPlainLength={10000} placeholder="Privater Bausteininhalt …" advanced htmlSource compactTools preparationTools files={files} disabled={busy}/>}/>}/>
   <details><summary>Vorhandene Hinweise & Handoutakten ({current.document.clueIds.length})</summary><p>Wähle vorhandene Akten für diese Szene. Die Originale werden nicht kopiert oder verändert.</p>{catalog.references.filter(ref=>['CLUE','HANDOUT'].includes(ref.type)).map(ref=><label className={s.reference} key={ref.id}><input type="checkbox" checked={current.document.clueIds.includes(ref.id)} onChange={e=>change({clueIds:e.target.checked?[...current.document.clueIds,ref.id]:current.document.clueIds.filter(id=>id!==ref.id)})}/>{ref.title}</label>)}</details></fieldset>
   {draft&&<div className={s.actions}><button disabled={busy} onClick={()=>{setDraft(null);setNotice('Ungespeicherte Änderungen verworfen.');}}>Änderungen verwerfen</button><button disabled={busy} onClick={()=>void save()}>{busy?'Wird gespeichert …':'Szenenmaterial speichern'}</button></div>}
  </>:<p>{busy?'Szenenmaterial wird geladen …':'Wähle eine Szene, um ihre vorhandenen Bilder, Handouts, Pager und weiteren Bausteine zu bearbeiten.'}</p>}
 </section>;
}

export function MaterialPreparation({a}:{a:Actor}){
 const [view,setView]=useState<'templates'|'scenes'>('templates'),[initialScene,setInitialScene]=useState('');
 // ?material=szenen&szene=<id> opens the scene materials directly (link from the scene editor).
 useEffect(()=>{const q=new URLSearchParams(window.location.search);if(q.get('material')==='szenen'){queueMicrotask(()=>{setView('scenes');setInitialScene(q.get('szene')||'');});}},[]);
 return <><nav className={s.materialNav} aria-label="Materialbereiche"><button aria-pressed={view==='templates'} onClick={()=>setView('templates')}>Materialvorlagen & Handout-Pakete</button><button aria-pressed={view==='scenes'} onClick={()=>setView('scenes')}>Szenenbausteine</button></nav>{view==='templates'?<TableMaterialLibrary a={a}/>:<SceneMaterialPreparation a={a} initialScene={initialScene}/>}</>;
}
