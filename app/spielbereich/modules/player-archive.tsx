"use client";
import {useCallback,useEffect,useState,type ReactNode} from 'react';
import {api} from './api-client';
import {FileText,NotebookPen,Images,Plus} from 'lucide-react';
import type {Actor} from '@/domain/types';
import type {Upload as StoredFile} from '@/domain/legacy';
import {TableMaterialLibrary} from './table-material-library';
import {MediaLibrary} from './media-library';
import s from './material-library.module.css';

type Note={id?:string;title:string;body:Record<string,unknown>};
type Tab='vorbereitung'|'notizen'|'dateien';
const tabs:{id:Tab;label:string;icon:typeof FileText}[]=[{id:'vorbereitung',label:'Vorbereitung',icon:FileText},{id:'notizen',label:'Notizen',icon:NotebookPen},{id:'dateien',label:'Meine Dateien',icon:Images}];

/** The player's archive: prepared table material, personal notes and own files as three clearly separated tabs. */
export function PlayerArchive({a,notes,onCreateNote,onOpenNote}:{a:Actor;notes:Note[];onCreateNote:()=>void;onOpenNote:(note:Note)=>void}){
 const [tab,choose]=useState<Tab>('vorbereitung'),[files,setFiles]=useState<StoredFile[]>([]),[fileError,setFileError]=useState('');
 // The workspace only loads files for the gallery section; the archive fetches its own list.
 const loadFiles=useCallback(()=>{api<{files:StoredFile[]}>('/api/files').then(r=>{setFiles(r.files);setFileError('');}).catch(e=>setFileError((e as Error).message));},[]);
 useEffect(()=>{loadFiles();},[loadFiles]);
 const own=files.filter(f=>f.owner_id===a.id);
 let body:ReactNode;
 if(tab==='vorbereitung')body=<TableMaterialLibrary a={a}/>;
 else if(tab==='dateien')body=fileError?<p role="alert" className={s.error}>{fileError}</p>:<MediaLibrary a={a} files={files} onRefresh={loadFiles} title="Meine Dateien" intro="Deine hochgeladenen Bilder, PDFs und Töne sowie mit der Gruppe geteilte Dateien. Eigene, nicht mehr verwendete Dateien kannst du hier löschen."/>;
 else body=<section className={s.library} aria-label="Persönliche Notizen"><header className={s.header}><div><h1><NotebookPen aria-hidden="true"/> Notizen</h1><p>Deine eigenen Mitschriften zur Chronik. Nur du siehst sie.</p></div><button className={s.primary} onClick={onCreateNote}><Plus size={17}/>Notiz anlegen</button></header>
  {notes.length?<ul className={s.noteGrid}>{notes.map((n,i)=><li key={n.id||i}><button onClick={()=>onOpenNote(n)}><strong>{n.title}</strong><span>{String(n.body.summary||'Notiz öffnen')}</span></button></li>)}</ul>:<div className={s.empty}><NotebookPen size={32}/><h2>Noch keine Notizen</h2><p>Halte Namen, Spuren und Gedanken fest – sie bleiben privat.</p></div>}</section>;
 return <>
  <nav className={s.materialNav} aria-label="Archivbereiche">{tabs.map(t=><button key={t.id} aria-pressed={tab===t.id} onClick={()=>choose(t.id)}><t.icon size={16} aria-hidden="true"/>{t.label}{t.id==='notizen'?<span className={s.count}>{notes.length}</span>:t.id==='dateien'?<span className={s.count}>{own.length}</span>:null}</button>)}</nav>
  {body}
 </>;
}
