"use client";
/* eslint-disable @next/next/no-img-element -- Protected existing file endpoints. */
import {useId,useState} from 'react';
import {Upload,ImageOff,Music,Trash2,ArrowUp,ArrowDown} from 'lucide-react';
import {youtubeVideoId} from '@/domain/live-stage';
import {sceneYoutubeMax,type SceneYoutube} from '@/domain/story-scene';
import {api} from './api-client';
import {ProtectedImageGallery,type PreparationFile} from './protected-image-gallery';
import s from './story-workspace.module.css';

const accepts:Record<string,string>={image:'image/jpeg,image/png,image/webp,image/gif',audio:'audio/mpeg,audio/ogg,audio/wav,audio/mp4',video:'video/mp4,video/webm',handout:'application/pdf,image/jpeg,image/png,image/webp'};

/** Uploads into the existing private SL file store. The file is only linked, never published. */
export function PreparationUpload({kind,onUploaded,label}:{kind:keyof typeof accepts;onUploaded:(file:PreparationFile)=>void;label?:string}){
 const id=useId(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function send(file:File){setBusy(true);setError('');try{const form=new FormData();form.set('file',file);form.set('visibility','sl');const r=await api<{id:string}>('/api/files','POST',form);onUploaded({id:r.id,name:file.name,mime:file.type});}catch(issue){setError((issue as Error).message);}finally{setBusy(false);}}
 return <div className={s.uploadField}>
  <label htmlFor={id} className={s.uploadButton} aria-disabled={busy}><Upload size={16} aria-hidden="true"/>{busy?'Wird hochgeladen …':label||'Neue Datei hochladen'}</label>
  <input id={id} type="file" accept={accepts[kind]} disabled={busy} className={s.uploadInput} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void send(file);}}/>
  <small>Privat für die SL · wird nur verknüpft, nicht veröffentlicht.</small>
  {error&&<p role="alert">{error}</p>}
 </div>;
}

/** "Szenenbild / Bühnenhintergrund": one image that becomes the shared table ground when the scene is activated. */
export function SceneBackdropPicker({fileId,files,onChange,onUploaded}:{fileId:string;files:PreparationFile[];onChange:(fileId:string)=>void;onUploaded:(file:PreparationFile)=>void}){
 const file=files.find(f=>f.id===fileId);
 return <section className={s.backdropPicker} aria-label="Szenenbild / Bühnenhintergrund">
  <header><h3>Szenenbild / Bühnenhintergrund</h3><p>Erscheint für die ganze Runde als Schauplatz, sobald du die Szene am Spieltisch auf den Tisch bringst. Fotos für Polaroids bereitest du unter „Interaktionen & Spielmaterial“ vor.</p></header>
  {fileId?file?<img src={'/api/files?id='+encodeURIComponent(file.id)} alt={'Szenenbild: '+file.name}/>:<p className={s.backdropMissing}><ImageOff size={16} aria-hidden="true"/> Das verknüpfte Bild ist derzeit nicht verfügbar.</p>:<p>Noch kein Szenenbild – am Tisch bleibt die Standardbühne.</p>}
  <div className={s.backdropActions}>
   <ProtectedImageGallery label={fileId?'Anderes Bild wählen':'Vorhandenes Bild wählen'} files={files} selected={fileId} onSelect={onChange}/>
   <PreparationUpload kind="image" label="Neues Szenenbild hochladen" onUploaded={f=>{onUploaded(f);onChange(f.id);}}/>
   {fileId&&<button type="button" onClick={()=>onChange('')}>Szenenbild entfernen</button>}
  </div>
  <small>Entfernen löst nur die Zuordnung; die Bilddatei bleibt in der Medienverwaltung.</small>
 </section>;
}

/** The scene's ambience playlist (YouTube): order, titles and checked links reduced to video ids. It starts when the
 * scene is started at the table and loops. Nothing is loaded from YouTube here. */
export function SceneYoutubePicker({tracks,onChange}:{tracks:SceneYoutube[];onChange:(tracks:SceneYoutube[])=>void}){
 const [link,setLink]=useState(''),[title,setTitle]=useState(''),[error,setError]=useState('');
 function add(){const videoId=youtubeVideoId(link);if(!videoId){setError('Das ist kein gültiger YouTube-Link (z. B. https://www.youtube.com/watch?v=… oder https://youtu.be/…).');return;}
  onChange([...tracks,{id:crypto.randomUUID(),title:title.trim()||'YouTube-Musik',videoId}]);setLink('');setTitle('');setError('');}
 return <section className={s.backdropPicker} aria-label="Ambiente-Playlist (YouTube)">
  <header><h3><Music size={16} aria-hidden="true"/> Ambiente-Playlist (YouTube)</h3><p>Startet automatisch, sobald du die Szene am Spieltisch startest, und läuft in Schleife – auch lange Titel. In der Regie steuerst du Pause, Titel und Lautstärke. Gespeichert wird nur die Video-ID.</p></header>
  {tracks.length?<ul className={s.youtubeList}>{tracks.map(t=><li key={t.id}><label>Titel<input maxLength={200} value={t.title} onChange={e=>onChange(tracks.map(x=>x.id===t.id?{...x,title:e.target.value}:x))}/></label><small>{tracks.indexOf(t)+1}. youtu.be/{t.videoId}</small><button type="button" aria-label={t.title+' nach oben'} disabled={tracks.indexOf(t)===0} onClick={()=>{const i=tracks.indexOf(t),n=[...tracks];[n[i-1],n[i]]=[n[i],n[i-1]];onChange(n);}}><ArrowUp size={15}/></button><button type="button" aria-label={t.title+' nach unten'} disabled={tracks.indexOf(t)===tracks.length-1} onClick={()=>{const i=tracks.indexOf(t),n=[...tracks];[n[i+1],n[i]]=[n[i],n[i+1]];onChange(n);}}><ArrowDown size={15}/></button><button type="button" aria-label={t.title+' entfernen'} onClick={()=>onChange(tracks.filter(x=>x.id!==t.id))}><Trash2 size={15}/></button></li>)}</ul>:<p>Noch keine Ambiente-Playlist vorbereitet.</p>}
  {tracks.length<sceneYoutubeMax&&<div className={s.youtubeAdd}><label>YouTube-Link<input inputMode="url" value={link} placeholder="https://youtu.be/…" onChange={e=>{setLink(e.target.value);setError('');}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add();}}}/></label><label>Titel (optional)<input maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/></label><button type="button" disabled={!link.trim()} onClick={add}>Titel hinzufügen</button></div>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
