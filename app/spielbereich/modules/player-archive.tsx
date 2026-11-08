"use client";
import {useCallback,useEffect,useState,type ReactNode} from 'react';
import {api} from './api-client';
import {FileText,NotebookPen,Images} from 'lucide-react';
import type {Actor} from '@/domain/types';
import type {Upload as StoredFile} from '@/domain/legacy';
import {TableMaterialLibrary} from './table-material-library';
import {MediaLibrary} from './media-library';
import {Notebook,NotebookHelp} from './notebook/notebook';
import {InfoButton} from './info-button';
import s from './material-library.module.css';

type Tab='notizbuch'|'vorbereitung'|'archiv';
const tabs:{id:Tab;label:string;icon:typeof FileText}[]=[{id:'notizbuch',label:'Notizbuch',icon:NotebookPen},{id:'vorbereitung',label:'Spielabendvorbereitung',icon:FileText},{id:'archiv',label:'Persönliches Archiv',icon:Images}];

function PreparationHelp(){
 return <InfoButton title="So funktioniert deine Spielabendvorbereitung">
  <ol>
   <li><strong>Material vorbereiten</strong> legt einen Entwurf an: einen Brief, ein Dokument zum Ausfüllen, ein Bild oder ein mehrseitiges Handout.</li>
   <li>Alles bleibt privat bei dir. Niemand sieht es, auch die Spielleitung nicht.</li>
   <li>Am Spieltisch findest du es unter „Dokumente“. Dort legst du es auf den Tisch, für alle oder für einzelne Mitspieler.</li>
   <li>Für eigene Gedanken und Mitschriften nimm das <strong>Notizbuch</strong>.</li>
  </ol>
 </InfoButton>;
}
function ArchiveHelp(){
 return <InfoButton title="So funktioniert dein persönliches Archiv">
  <ol>
   <li>Hier liegen deine hochgeladenen Bilder, PDFs und Töne und die Dateien, die mit dir geteilt wurden.</li>
   <li>Eigene Dateien, die du nicht mehr brauchst, kannst du löschen.</li>
   <li>Dateien für den Spielabend bereitest du unter <strong>Spielabendvorbereitung</strong> vor.</li>
  </ol>
 </InfoButton>;
}

/** Notizbuch, Spielabendvorbereitung and Persönliches Archiv: three clearly separated tabs, the notebook first. */
export function PlayerArchive({a}:{a:Actor}){
 const [tab,choose]=useState<Tab>('notizbuch'),[files,setFiles]=useState<StoredFile[]>([]),[fileError,setFileError]=useState('');
 // The workspace only loads files for the gallery section; the archive fetches its own list.
 const loadFiles=useCallback(()=>{api<{files:StoredFile[]}>('/api/files').then(r=>{setFiles(r.files);setFileError('');}).catch(e=>setFileError((e as Error).message));},[]);
 useEffect(()=>{if(tab==='archiv')loadFiles();},[tab,loadFiles]);
 let body:ReactNode;
 if(tab==='vorbereitung')body=<TableMaterialLibrary a={a}/>;
 else if(tab==='archiv')body=fileError?<p role="alert" className={s.error}>{fileError}</p>:<MediaLibrary a={a} files={files} onRefresh={loadFiles} title="Persönliches Archiv" intro="Deine hochgeladenen Bilder, PDFs und Töne sowie mit dir geteilte Dateien. Eigene, nicht mehr verwendete Dateien kannst du hier löschen."/>;
 else body=<section aria-labelledby="notebook-title"><header className={s.header}><div><h1 id="notebook-title"><NotebookPen aria-hidden="true"/> Notizbuch</h1><p>Deine Mitschriften zur Chronik: was am Abend geschah, wen ihr getroffen habt, was offen ist. Dasselbe Notizbuch liegt am Spieltisch.</p></div></header><Notebook a={a} layout="wide"/></section>;
 return <>
  <div className={s.navRow}><nav className={s.materialNav} aria-label="Notizbuch, Vorbereitung und Archiv">{tabs.map(t=><button key={t.id} aria-pressed={tab===t.id} onClick={()=>choose(t.id)}><t.icon size={16} aria-hidden="true"/>{t.label}</button>)}</nav>{tab==='notizbuch'?<NotebookHelp/>:tab==='vorbereitung'?<PreparationHelp/>:<ArchiveHelp/>}</div>
  {body}
 </>;
}
