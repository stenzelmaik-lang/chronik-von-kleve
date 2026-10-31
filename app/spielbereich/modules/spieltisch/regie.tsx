"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated GM media must never use a public optimization proxy. */
import {useEffect,useRef,useState} from 'react';
import {Eye,EyeOff,UserPlus,FilePlus2,Lock,Clapperboard,Image as ImageIcon,FileText,Music,Film,Search,X,RotateCcw} from 'lucide-react';
import {api} from '../api-client';
import {RichTextView} from '../rich-text';
import {LivePdf} from '../live-pdf';
import type {RegieContext,StageObject} from './types';
import styles from './regie.module.css';

export const regieTabs=[['narration','Erzählung'],['atmosphere','Atmosphäre'],['dialogue','Dialoge'],['interactions','Interaktionen'],['secrets','Geheimnisse'],['consequences','Folgen'],['notes','SL-Notizen'],['material','Material']] as const;
export type RegieTab=typeof regieTabs[number][0];

type Props={sessionId:string;sceneId:string;tab:RegieTab;onTab:(tab:RegieTab)=>void;busy:boolean;audience:string;
 onShowScene:(id:string)=>void;onShowMedia:(fileId:string)=>void;onStage:(kind:'npc'|'document',sourceId:string)=>void;
 table:{objects:StageObject[];backdrop:string;backdropFileId:string;activeScene:string};images:{id:string;title:string}[];
 onPlace:(sourceId:string,sourceKind:'entity'|'file',title?:string)=>void;onRemove:(objectId:string)=>void;onBackdrop:(fileId:string|null)=>void;onActivate:(sceneId:string)=>void};
type Media=RegieContext['media'][number];
const groups:[string,string,(m:Media)=>boolean,typeof ImageIcon][]=[
 ['Bilder · Polaroids','Fotos, die du als Bildkarte auf den Tisch legst.',m=>m.mime.startsWith('image/'),ImageIcon],
 ['Handouts & Dokumente','Briefe, Befehle, Akten als Lesefassung.',m=>m.mime==='application/pdf',FileText],
 ['Audio','Erscheint als Kassettenrekorder; jeder regelt seine Lautstärke.',m=>m.mime.startsWith('audio/'),Music],
 ['Video','Erscheint auf einem alten Bildschirm.',m=>m.mime.startsWith('video/'),Film],
];

/** Where an item currently is: prepared only, SL-only on the table, or released to whom. */
export function tableState(o:StageObject|undefined){if(!o||o.kind==='note')return 'Vorbereitet · nicht auf dem Tisch';if(o.visibility==='sl')return 'Auf dem Tisch · nur SL';return o.recipients===null?'Auf dem Tisch · ganze Runde':'Auf dem Tisch · '+o.recipients.length+' Spieler';}

function Text({value,empty}:{value:string;empty:string}){return value.trim()?<RichTextView value={value} readable flowing className={styles.prose}/>:<p className={styles.empty}>{empty}</p>;}

/** Private direction drawer. Reading never publishes; every release is a separate, labelled action. */
/** Live backdrop choice: scene images first, every campaign image on demand. Choosing never touches the prepared scene. */
export function BackdropChoice({current,sceneImages,images,busy,onChoose}:{current:string;sceneImages:{id:string;title:string}[];images:{id:string;title:string}[];busy:boolean;onChoose:(fileId:string)=>void}){
 const [search,setSearch]=useState('');
 const tile=(img:{id:string;title:string})=><li key={img.id}><button type="button" disabled={busy||current===img.id} aria-pressed={current===img.id} aria-label={'Als Hintergrund: '+img.title} onClick={()=>onChoose(img.id)}><img src={'/api/files?id='+encodeURIComponent(img.id)} alt="" loading="lazy"/><span>{current===img.id?'Aktiv · ':''}{img.title}</span></button></li>;
 const others=images.filter(i=>!sceneImages.some(s=>s.id===i.id)&&i.title.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de')));
 return <>
  {!!sceneImages.length&&<ul className={styles.backdropGrid} aria-label="Bilder dieser Szene">{sceneImages.map(tile)}</ul>}
  <details className={styles.moreImages}><summary>Anderes Bild wählen ({images.length})</summary><input aria-label="Bilder durchsuchen" placeholder="Bild suchen …" value={search} onChange={e=>setSearch(e.target.value)}/>{others.length?<ul className={styles.backdropGrid}>{others.slice(0,60).map(tile)}</ul>:<p className={styles.empty}>Keine passenden Bilder.</p>}</details>
 </>;
}

export function Regie({sessionId,sceneId,tab,onTab,busy,audience,onShowScene,onShowMedia,onStage,table,images,onPlace,onRemove,onBackdrop,onActivate}:Props){
 const [preview,setPreview]=useState<Media|null>(null),previewDialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(preview&&!previewDialog.current?.open)previewDialog.current?.showModal();},[preview]);
 // Loaded scenes stay cached for the evening: switching back costs no request.
 const [contexts,setContexts]=useState<Record<string,RegieContext>>({}),[failed,setFailed]=useState<{id:string;message:string}|null>(null);
 const known=!!contexts[sceneId];
 useEffect(()=>{
  if(!sceneId||known)return;
  let current=true;
  api<RegieContext>('/api/live-stage?sessionId='+encodeURIComponent(sessionId)+'&regie='+encodeURIComponent(sceneId))
   .then(context=>{if(current)setContexts(old=>({...old,[sceneId]:context}));})
   .catch(issue=>{if(current)setFailed({id:sceneId,message:(issue as Error).message});});
  return()=>{current=false;};
 },[sessionId,sceneId,known]);
 if(!sceneId)return <p className={styles.empty}>Wähle unter „Szenen“ eine Szene dieses Spielabends und öffne ihre Regie. Hier liest du privat – die Spieler sehen nichts davon.</p>;
 // Content derives only from the requested scene id, never from a previously open scene.
 const context=contexts[sceneId];
 if(failed?.id===sceneId&&!context)return <p role="alert">{failed.message}</p>;
 if(!context)return <p role="status">Regie wird geladen …</p>;
 const s=context.scene;
 return <div className={styles.regie} data-scene={s.id}>
  <div className={styles.privacy}><Lock size={14}/> Privat · nur Spielleitung</div>
  <h2 className={styles.title}>{s.title}</h2>
  {context.place&&<p className={styles.place}>Schauplatz: {context.place.title}</p>}
  <div className={styles.activate}>
   {table.activeScene===s.id?<><p><Clapperboard size={15}/> Läuft auf dem Tisch · Hintergrund: {table.backdrop||'Standardbühne'}</p><button className={styles.secondary} onClick={()=>onTab('material')}><ImageIcon/> Hintergrund wechseln</button></>:<button className={styles.release} disabled={busy} onClick={()=>onActivate(s.id)}><Clapperboard/> Szene starten</button>}
   <small>{table.activeScene===s.id?'Medien legst du unter „Material“ einzeln auf.':'Blendet das Szenenbild für die ganze Runde ein und räumt Material der vorigen Szene ab. Notizzettel bleiben.'}</small>
  </div>
  <div className={styles.tabs} role="tablist" aria-label="Regiebereiche">{regieTabs.map(([id,label])=><button key={id} role="tab" id={'regie-tab-'+id} aria-selected={tab===id} aria-controls="regie-panel" onClick={()=>onTab(id)}>{label}</button>)}</div>
  <section id="regie-panel" role="tabpanel" aria-labelledby={'regie-tab-'+tab} className={styles.panel} key={s.id+':'+tab}>
   {tab==='narration'&&<><Text value={s.narration} empty="Kein Erzähltext vorbereitet."/>{s.narration.trim()&&<button className={styles.release} disabled={busy} onClick={()=>onShowScene(s.id)}><Eye/> Erzählung zeigen · {audience}</button>}</>}
   {tab==='atmosphere'&&<Text value={s.atmosphere} empty="Keine Atmosphäre vorbereitet."/>}
   {tab==='dialogue'&&<>{context.npcs.map(n=><article key={n.id} className={styles.npc}><img src={n.image} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display='none';}}/><div><h3>{n.title}</h3>{n.summary&&<p>{n.summary}</p>}{n.cue&&<Text value={n.cue} empty=""/>}<button disabled={busy} onClick={()=>onStage('npc',n.id)}><UserPlus/> Privat auf Bühne legen</button></div></article>)}
    <Text value={s.dialogueNotes} empty={context.npcs.length?'Keine zusätzlichen Dialoghilfen.':'Keine NPCs oder Dialoge vorbereitet.'}/></>}
   {tab==='interactions'&&<><Text value={s.interactions} empty="Keine Interaktionen beschrieben."/>{context.notes.map(n=><article key={n.id} className={styles.note}><h3>{n.title}</h3><Text value={n.text} empty=""/></article>)}</>}
   {tab==='secrets'&&<><Text value={s.secrets} empty="Keine Geheimnisse hinterlegt."/>{s.visions.trim()&&<><h3>Visionen</h3><Text value={s.visions} empty=""/></>}</>}
   {tab==='consequences'&&<><Text value={s.possibleConsequences} empty="Keine Folgen vorbereitet."/>{s.possibilities.map(p=><article key={p.id} className={styles.note}><h3>{p.title}</h3><p>{p.text}</p></article>)}</>}
   {tab==='notes'&&<Text value={s.gmNotes} empty="Keine SL-Notizen."/>}
   {tab==='material'&&<>
    <section className={styles.backdrop} aria-label="Szenenbild">
     <h3>Szenenbild / Bühnenhintergrund</h3>
     <p className={styles.state} data-placed={!!table.backdropFileId}>Jetzt auf dem Tisch: {table.backdrop||'Standardbühne'}</p>
     {!context.backdrop&&<p className={styles.empty}>Für diese Szene ist kein Szenenbild vorbereitet (SL-Vorbereitung › Atmosphäre). Du kannst trotzdem jedes Bild wählen.</p>}
     <BackdropChoice current={table.backdropFileId} busy={busy} onChoose={onBackdrop} images={images}
      sceneImages={[...(context.backdrop?[{id:context.backdrop.fileId,title:'Szenenbild · '+context.backdrop.name}]:[]),...context.media.filter(m=>m.mime.startsWith('image/')&&m.fileId!==context.backdrop?.fileId).map(m=>({id:m.fileId,title:m.title}))]}/>
     {table.backdropFileId&&<button disabled={busy} onClick={()=>onBackdrop(null)}><RotateCcw/> Standardbühne</button>}
     <small className={styles.empty}>Der Wechsel gilt sofort für die ganze Runde und blendet weich über. Die vorbereitete Szene bleibt unverändert.</small>
    </section>
    {!context.media.length&&!context.handouts.length&&<p className={styles.empty}>Kein weiteres Material mit dieser Szene verknüpft.</p>}
    {groups.map(([title,hint,match,GroupIcon])=>{const items=context.media.filter(match);return items.length?<section key={title} className={styles.group} aria-label={title}><h3><GroupIcon size={16}/> {title}</h3><p className={styles.empty}>{hint}</p><div className={styles.gallery}>{items.map(m=>{const placed=table.objects.find(o=>o.kind!=='note'&&o.sourceKind==='file'&&o.sourceId===m.fileId);return <article key={m.id}>
     {m.mime.startsWith('image/')?<img src={'/api/files?id='+encodeURIComponent(m.fileId)} alt="" loading="lazy"/>:<div className={styles.fileIcon}><GroupIcon/><small>{m.name}</small></div>}
     <h3>{m.title}</h3><p className={styles.state} data-placed={!!placed}>{tableState(placed)}</p>
     <button onClick={()=>setPreview(m)}><Search/> Vorschau (nur SL)</button>
     <button className={placed?undefined:styles.release} disabled={busy} onClick={()=>onPlace(m.fileId,'file',m.title)}><Eye/> {placed?'Freigabe ändern':'Auf den Tisch'} · {audience}</button>
     {placed&&<button disabled={busy} onClick={()=>onRemove(placed.id)}><EyeOff/> Vom Tisch nehmen</button>}
     {m.mime.startsWith('image/')&&<button disabled={busy} onClick={()=>onShowMedia(m.fileId)}><Eye/> Groß zeigen · {audience}</button>}
    </article>;})}</div></section>:null;})}
    {!!context.handouts.length&&<section className={styles.group} aria-label="Handout-Akten"><h3><FileText size={16}/> Handout-Akten</h3>{context.handouts.map(h=>{const placed=table.objects.find(o=>o.kind==='document'&&o.sourceKind==='entity'&&o.sourceId===h.id);return <article key={h.id} className={styles.note}><h3>{h.title}</h3>{h.stageable?<><p className={styles.state} data-placed={!!placed}>{tableState(placed)}</p><button disabled={busy} onClick={()=>onPlace(h.id,'entity')}><FilePlus2/> {placed?'Freigabe ändern':'Auf den Tisch'} · {audience}</button>{placed?<button disabled={busy} onClick={()=>onRemove(placed.id)}><EyeOff/> Vom Tisch nehmen</button>:<button disabled={busy} onClick={()=>onStage('document',h.id)}><Lock/> Nur für SL auflegen</button>}</>:<p className={styles.empty}>Hinweisakte – Freigabe über die Spielwelt.</p>}</article>;})}</section>}
   </>}
  </section>
  <dialog ref={previewDialog} className={styles.preview} aria-label="Private Vorschau" onClose={()=>setPreview(null)}>{preview&&<><header><div><small>PRIVATE VORSCHAU · NUR SL</small><h2>{preview.title}</h2></div><button aria-label="Vorschau schließen" onClick={()=>previewDialog.current?.close()}><X/></button></header>
   <div>{preview.mime.startsWith('image/')?<img src={'/api/files?id='+encodeURIComponent(preview.fileId)} alt={preview.title}/>:preview.mime.startsWith('audio/')?<audio controls src={'/api/files?id='+encodeURIComponent(preview.fileId)}/>:preview.mime.startsWith('video/')?<video controls playsInline src={'/api/files?id='+encodeURIComponent(preview.fileId)}/>:<LivePdf url={'/api/files?id='+encodeURIComponent(preview.fileId)} name={preview.name}/>}
   {preview.text.trim()&&<Text value={preview.text} empty=""/>}</div></>}</dialog>
 </div>;
}
