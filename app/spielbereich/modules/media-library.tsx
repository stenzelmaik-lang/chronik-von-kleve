"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated private image endpoints. */
import {useEffect,useMemo,useRef,useState,type DragEvent} from 'react';
import {Images,Search,Upload,Trash2,X,FileText,Music,Film,Image as ImageIcon,Lock,Users,ShieldCheck,Link2,Loader2,Eye} from 'lucide-react';
import type {Actor} from '@/domain/types';
import type {Upload as StoredFile} from '@/domain/legacy';
import {api} from './api-client';
import {LivePdf} from './live-pdf';
import s from './material-library.module.css';

type File_=StoredFile&{created_at?:string};
type Usage={kind:string;label:string;title:string|null};
type UsageReport={usages:Usage[];history:number};
type Kind='all'|'image'|'pdf'|'audio'|'video';
const kinds:{id:Kind;label:string;icon:typeof Images}[]=[{id:'all',label:'Alle',icon:Images},{id:'image',label:'Bilder',icon:ImageIcon},{id:'pdf',label:'PDF',icon:FileText},{id:'audio',label:'Audio',icon:Music},{id:'video',label:'Video',icon:Film}];
const kindOf=(mime:string):Kind=>mime.startsWith('image/')?'image':mime==='application/pdf'?'pdf':mime.startsWith('audio/')?'audio':mime.startsWith('video/')?'video':'all';
const visibilityText={private:'Privat',sl:'SL-intern',group:'Gruppe'} as const;
const VisibilityIcon=({v}:{v:string})=>v==='group'?<Users size={13} aria-hidden="true"/>:v==='sl'?<ShieldCheck size={13} aria-hidden="true"/>:<Lock size={13} aria-hidden="true"/>;
const accept='image/jpeg,image/png,image/webp,image/gif,application/pdf,audio/mpeg,audio/ogg,audio/wav,audio/mp4,video/mp4,video/webm';
const megabytes=(n:number)=>(n/1024/1024).toLocaleString('de',{maximumFractionDigits:n<1024*1024?2:1})+' MB';
const date=(iso?:string)=>iso?new Date(iso).toLocaleDateString('de',{day:'2-digit',month:'2-digit',year:'numeric'}):'';

/** Campaign gallery for the SL and the player's own files. Deletion is checked against current uses first. */
export function MediaLibrary({a,files,onRefresh,title='Galerie',intro}:{a:Actor;files:StoredFile[];onRefresh:()=>void;title?:string;intro?:string}){
 const all=files as File_[];
 const [search,setSearch]=useState(''),[sort,setSort]=useState('newest'),[kind,setKind]=useState<Kind>('all'),[scope,setScope]=useState<'all'|'mine'|'private'|'sl'|'group'>('all');
 const [busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[visibility,setVisibility]=useState(a.gm?'sl':'private'),[dragging,setDragging]=useState(false);
 const [open,setOpen]=useState<File_|null>(null),[usage,setUsage]=useState<UsageReport|null>(null),[usageError,setUsageError]=useState(''),[confirming,setConfirming]=useState(false);
 const root=useRef<HTMLElement>(null),dialog=useRef<HTMLDialogElement>(null),picker=useRef<HTMLInputElement>(null);
 useEffect(()=>{root.current?.closest('main')?.scrollTo({top:0});},[]);
 useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();},[open]);
 const manageable=(f:File_)=>f.owner_id===a.id||(a.gm&&f.visibility!=='private');
 const counts=useMemo(()=>{const c:Record<Kind,number>={all:all.length,image:0,pdf:0,audio:0,video:0};for(const f of all){const k=kindOf(f.mime);if(k!=='all')c[k]++;}return c;},[all]);
 const items=useMemo(()=>{const q=search.trim().toLocaleLowerCase('de');return all.filter(f=>(kind==='all'||kindOf(f.mime)===kind)&&(scope==='all'||(scope==='mine'?f.owner_id===a.id:f.visibility===scope))&&(!q||f.name.toLocaleLowerCase('de').includes(q))).sort((x,y)=>sort==='name'?x.name.localeCompare(y.name,'de',{numeric:true}):sort==='size'?y.size-x.size:sort==='oldest'?all.indexOf(y)-all.indexOf(x):all.indexOf(x)-all.indexOf(y));},[all,kind,scope,search,sort,a.id]);
 const url=(f:File_)=>'/api/files?id='+encodeURIComponent(f.id);

 async function upload(selected:File[]){
  const usable=selected.filter(f=>accept.split(',').includes(f.type));
  if(!usable.length){setError('Erlaubt sind Bilder, PDF, MP3/OGG/WAV/M4A und MP4/WebM bis 10 MB.');return;}
  setBusy(true);setError('');setNotice('');let done=0;const failed:string[]=[];
  for(const file of usable){setProgress(`Lade ${done+1} von ${usable.length} hoch …`);try{if(file.size>10*1024*1024)throw new Error('größer als 10 MB');const form=new FormData();form.set('file',file);form.set('visibility',visibility);await api('/api/files','POST',form);done++;}catch(e){failed.push(file.name+' ('+(e as Error).message+')');}}
  setProgress('');setBusy(false);onRefresh();
  if(done)setNotice(`${done} ${done===1?'Datei':'Dateien'} gespeichert · ${visibilityText[visibility as keyof typeof visibilityText]}.`);
  if(failed.length||selected.length>usable.length)setError([failed.length?'Nicht hochgeladen: '+failed.join(', '):'',selected.length>usable.length?(selected.length-usable.length)+' Datei(en) mit nicht unterstütztem Format übersprungen.':''].filter(Boolean).join(' '));
 }
 function drop(e:DragEvent){e.preventDefault();setDragging(false);if(!busy)void upload([...e.dataTransfer.files]);}

 async function show(f:File_){setOpen(f);setUsage(null);setUsageError('');setConfirming(false);if(manageable(f))try{setUsage(await api<UsageReport>('/api/files?usage='+encodeURIComponent(f.id)));}catch(e){setUsageError((e as Error).message);}}
 function close(){dialog.current?.close();}
 async function changeVisibility(next:string){if(!open)return;setBusy(true);setError('');try{await api('/api/files','PATCH',{id:open.id,visibility:next});setOpen({...open,visibility:next as File_['visibility']});setNotice('Sichtbarkeit geändert: '+visibilityText[next as keyof typeof visibilityText]+'.');onRefresh();}catch(e){setUsageError((e as Error).message);}finally{setBusy(false);}}
 async function destroy(){if(!open)return;setBusy(true);try{await api('/api/files','DELETE',{id:open.id});setNotice('„'+open.name+'“ gelöscht.');close();onRefresh();}catch(e){setUsageError((e as Error).message);setConfirming(false);}finally{setBusy(false);}}
 const blocked=!!usage?.usages.length;

 return <section ref={root} className={s.library} aria-label="Galerieverwaltung" onDragOver={e=>{e.preventDefault();if(!busy)setDragging(true);}} onDragLeave={e=>{if(e.currentTarget===e.target)setDragging(false);}} onDrop={drop}>
  <header className={s.header}><div><h1><Images aria-hidden="true"/> {title}</h1><p>{intro||(a.gm?'Alle Bilder, PDFs, Töne und Videos der Kampagne. Vor dem Löschen siehst du, wo eine Datei noch verwendet wird.':'Deine hochgeladenen Bilder und Dateien sowie alles, was mit der Gruppe geteilt ist.')}</p></div></header>
  <div className={`${s.dropzone} ${dragging?s.dropActive:''}`}>
   <Upload size={22} aria-hidden="true"/><div><strong>{busy?progress||'Wird gespeichert …':'Dateien hierher ziehen'}</strong><small>oder auswählen · mehrere gleichzeitig · bis 10 MB je Datei</small></div>
   <label className={s.inline}>Sichtbar für<select aria-label="Sichtbarkeit neuer Dateien" value={visibility} disabled={busy} onChange={e=>setVisibility(e.target.value)}><option value="private">Nur mich</option>{a.gm&&<option value="sl">SL-intern</option>}<option value="group">Die Gruppe</option></select></label>
   <button className={s.primary} disabled={busy} onClick={()=>picker.current?.click()}>{busy?<Loader2 size={17} className={s.spin}/>:<Upload size={17}/>}Hochladen</button>
   <input ref={picker} hidden aria-label="Datei hochladen" type="file" multiple accept={accept} onChange={e=>{const list=[...(e.target.files||[])];e.target.value='';if(list.length)void upload(list);}}/>
  </div>
  {error&&<p className={s.error} role="alert">{error}<button aria-label="Hinweis schließen" onClick={()=>setError('')}><X size={15}/></button></p>}{notice&&<p className={s.notice} role="status">{notice}</p>}
  <div className={s.chips} role="group" aria-label="Dateiart">{kinds.map(k=><button key={k.id} aria-pressed={kind===k.id} onClick={()=>setKind(k.id)}><k.icon size={15} aria-hidden="true"/>{k.label}<span>{counts[k.id]}</span></button>)}</div>
  <div className={s.toolbar}><label className={s.search}><Search size={18} aria-hidden="true"/><input aria-label="Galerie durchsuchen" placeholder="Name suchen …" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <label>Zeigen<select value={scope} onChange={e=>setScope(e.target.value as typeof scope)}><option value="all">Alle zugänglichen</option><option value="mine">Nur meine</option><option value="private">Privat</option>{a.gm&&<option value="sl">SL-intern</option>}<option value="group">Gruppe</option></select></label>
   <label>Sortieren<select value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Neueste zuerst</option><option value="oldest">Älteste zuerst</option><option value="name">Name A–Z</option><option value="size">Größte zuerst</option></select></label>
   <span aria-live="polite">{items.length} {items.length===1?'Datei':'Dateien'}</span></div>
  {!items.length?<div className={s.empty}><Images size={36}/><h2>{search||kind!=='all'||scope!=='all'?'Keine passenden Dateien':'Noch keine Dateien'}</h2><p>{search||kind!=='all'||scope!=='all'?'Ändere Suche oder Filter.':'Ziehe Bilder oder Dokumente hierher, um zu beginnen.'}</p></div>
  :<ul className={s.gallery}>{items.map(f=>{const k=kindOf(f.mime);return <li key={f.id}><button className={s.thumbnail} onClick={()=>void show(f)} aria-label={'Öffnen: '+f.name}>{k==='image'?<img loading="lazy" decoding="async" src={url(f)} alt=""/>:k==='audio'?<Music/>:k==='video'?<Film/>:<FileText/>}<span className={s.pill} data-visibility={f.visibility}><VisibilityIcon v={f.visibility}/>{visibilityText[f.visibility as keyof typeof visibilityText]}</span><span className={s.hover}><Eye size={16}/>Öffnen</span></button><div className={s.caption}><strong title={f.name}>{f.name}</strong><small>{megabytes(f.size)}{f.created_at?' · '+date(f.created_at):''}{f.owner_id===a.id?' · von dir':''}</small></div></li>;})}</ul>}

  <dialog ref={dialog} className={s.preview} aria-label="Datei" onClose={()=>{setOpen(null);setConfirming(false);}}>
   {open&&<><header><h2>{open.name}</h2><button aria-label="Schließen" onClick={close}><X/></button></header>
   <div className={s.previewBody}><div className={s.previewMedia}>{kindOf(open.mime)==='image'?<img src={url(open)} alt={open.name}/>:open.mime==='application/pdf'?<LivePdf url={url(open)} name={open.name}/>:open.mime.startsWith('audio/')?<audio controls src={url(open)}/>:<video controls playsInline src={url(open)}/>}</div>
    <aside className={s.details}>
     <dl><dt>Größe</dt><dd>{megabytes(open.size)}</dd>{open.created_at&&<><dt>Hochgeladen</dt><dd>{date(open.created_at)}</dd></>}<dt>Eigentum</dt><dd>{open.owner_id===a.id?'Deine Datei':'Geteilt'}</dd></dl>
     {manageable(open)?<label className={s.field}>Sichtbarkeit<select value={open.visibility} disabled={busy} onChange={e=>void changeVisibility(e.target.value)}>{open.owner_id===a.id&&<option value="private">Privat – nur ich</option>}{a.gm&&<option value="sl">SL-intern</option>}<option value="group">Für die Gruppe</option></select></label>:<p className={s.muted}><VisibilityIcon v={open.visibility}/> {visibilityText[open.visibility as keyof typeof visibilityText]} · nur ansehen</p>}
     {manageable(open)&&<section className={s.usage} aria-label="Verwendung"><h3><Link2 size={15}/> Verwendung</h3>
      {usageError?<p role="alert" className={s.errorText}>{usageError}</p>:!usage?<p className={s.muted}><Loader2 size={14} className={s.spin}/> Wird geprüft …</p>:usage.usages.length?<><p>Wird noch verwendet und ist deshalb geschützt:</p><ul>{usage.usages.map((u,i)=><li key={i}><strong>{u.label}</strong>{u.title?' · '+u.title:' · nicht für dich einsehbar'}</li>)}</ul><p className={s.muted}>Entferne die Datei dort, dann kannst du sie hier löschen.</p></>:<p>Nirgends mehr in Gebrauch.{usage.history?' Ältere Szenenstände im Verlauf verweisen noch darauf; dort erscheint sie nach dem Löschen nicht mehr.':''}</p>}
     </section>}
     {manageable(open)&&(!confirming?<button className={s.danger} disabled={busy||!usage||blocked} onClick={()=>setConfirming(true)}><Trash2 size={16}/>Löschen</button>
      :<div className={s.confirmBox} role="group" aria-label="Löschen bestätigen"><p>„{open.name}“ endgültig löschen? Das kann nicht rückgängig gemacht werden.</p><div className={s.actions}><button disabled={busy} onClick={()=>setConfirming(false)}>Abbrechen</button><button className={s.danger} disabled={busy} onClick={()=>void destroy()}><Trash2 size={16}/>Endgültig löschen</button></div></div>)}
    </aside></div></>}
  </dialog>
 </section>;
}
