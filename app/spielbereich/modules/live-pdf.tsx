"use client";
import {useEffect,useRef,useState} from 'react';
import type {PDFDocumentProxy,RenderTask} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import styles from './live-session.module.css';

/** Render only the requested page. PDF scripts, forms and external links are never executed. */
export function LivePdf({url,name}:{url:string;name:string}){
 const canvas=useRef<HTMLCanvasElement>(null),[document,setDocument]=useState<PDFDocumentProxy|null>(null),[page,setPage]=useState(1),[text,setText]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{
  let cancelled=false,task:import('pdfjs-dist').PDFDocumentLoadingTask|undefined;
  void import('pdfjs-dist').then(pdf=>{
   if(cancelled)return;pdf.GlobalWorkerOptions.workerSrc=workerUrl;
   task=pdf.getDocument({url,withCredentials:true,enableXfa:false,disableAutoFetch:true,disableStream:true});
   return task.promise.then(value=>{if(!cancelled)setDocument(value);});
  }).catch(issue=>{if(!cancelled){setError('PDF konnte nicht angezeigt werden: '+(issue as Error).message);setLoading(false);}});
  return()=>{cancelled=true;void task?.destroy();};
 },[url]);
 useEffect(()=>{
  if(!document)return;let cancelled=false,render:RenderTask|undefined;
  queueMicrotask(()=>{setLoading(true);setError('');setText('');});
  void document.getPage(page).then(async value=>{
   if(cancelled||!canvas.current)return;const element=canvas.current,original=value.getViewport({scale:1});
   const scale=Math.min(1000/original.width,2400/original.height,2),viewport=value.getViewport({scale});
   element.width=Math.ceil(viewport.width);element.height=Math.ceil(viewport.height);
   render=value.render({canvas:element,viewport});await render.promise;
   const content=await value.getTextContent();
   if(!cancelled){setText(content.items.map(item=>'str' in item?item.str+(item.hasEOL?'\n':' '):'').join(''));setLoading(false);}
  }).catch(issue=>{if(!cancelled){setError('PDF-Seite konnte nicht angezeigt werden: '+(issue as Error).message);setLoading(false);}});
  return()=>{cancelled=true;render?.cancel();};
 },[document,page]);
 return <section aria-label={name}>
  {loading&&<p role="status">PDF-Seite wird geladen …</p>}{error&&<p role="alert">{error}</p>}
  <canvas ref={canvas} className={styles.pdfPage} role="img" aria-label={`${name}, Seite ${page}`} hidden={!!error}/>
  {document&&<><nav className={styles.tabs} aria-label="PDF-Seiten"><button disabled={loading||page===1} onClick={()=>setPage(n=>n-1)}>Vorherige PDF-Seite</button><span>Seite {page} von {document.numPages}</span><button disabled={loading||page===document.numPages} onClick={()=>setPage(n=>n+1)}>Nächste PDF-Seite</button></nav>{text&&<details><summary>Seitentext barrierefrei lesen</summary><p className={styles.pdfText}>{text}</p></details>}</>}
 </section>;
}
