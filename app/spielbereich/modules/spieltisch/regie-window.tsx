"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated GM media must never use a public optimization proxy. */
import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {Eye,EyeOff,Lock,Clapperboard,Image as ImageIcon,FileText,Music,Film,Search,X,RotateCcw,CloudRain,CloudFog,UserPlus,UserMinus,Send,Undo2,MonitorPlay,Minus,Plus,Square,Radio,BookOpen} from 'lucide-react';
import type {Actor} from '@/domain/types';
import {pagerTextMax,pagerTitleMax,pagerSenderMax,type StageEffect} from '@/domain/live-stage';
import {api,ApiError} from '../api-client';
import {RichTextView} from '../rich-text';
import {LivePdf} from '../live-pdf';
import {BackdropChoice,tableState} from './regie';
import {sendStageCommand,type Audience} from './stage-client';
import {effectLabels} from './atmosphere';
import type {RegieContext,Snapshot,StageObject} from './types';
import regieStyles from './regie.module.css';
import styles from './regie-window.module.css';

type Media=RegieContext['media'][number];
type Crew=Snapshot['crew'];
type Room={sessionId:string;runId:string};
const fileUrl=(id:string)=>'/api/files?id='+encodeURIComponent(id);
const stageUrl=(sessionId:string,catalog=false)=>'/api/live-stage?sessionId='+encodeURIComponent(sessionId)+(catalog?'&catalog=1':'');

/** Who receives one release: the whole round or chosen players. Every item keeps its own choice. */
function AudiencePicker({value,onChange,crew,label}:{value:Audience;onChange:(v:Audience)=>void;crew:Crew;label:string}){
 return <div className={styles.audience} role="group" aria-label={'Empfänger: '+label}>
  <button type="button" aria-pressed={value===null} onClick={()=>onChange(null)}>Alle</button>
  {crew.map(m=><button type="button" key={m.id} aria-pressed={value!==null&&value.includes(m.id)} onClick={()=>onChange(value===null?[m.id]:value.includes(m.id)?value.filter(id=>id!==m.id):[...value,m.id])}>{m.name}</button>)}
  {value!==null&&!value.length&&<small role="status">Niemand gewählt</small>}
 </div>;
}
const audienceText=(v:Audience,crew:Crew)=>v===null?'alle':v.map(id=>crew.find(m=>m.id===id)?.name||'?').join(', ')||'niemand';

function Column({title,icon,children,id}:{title:string;icon:ReactNode;children:ReactNode;id:string}){
 return <section className={styles.column} aria-labelledby={id}><h2 id={id}>{icon} {title}</h2><div className={styles.columnBody}>{children}</div></section>;
}
function Block({title,children,open=true}:{title:string;children:ReactNode;open?:boolean}){return <details className={styles.block} open={open}><summary>{title}</summary><div>{children}</div></details>;}
function Text({value,empty}:{value:string;empty:string}){return value.trim()?<RichTextView value={value} readable flowing className={regieStyles.prose}/>:<p className={regieStyles.empty}>{empty}</p>;}

/**
 * The live direction for a second screen. It steers the same evening as the table through the same stage and
 * table commands; it is only a different view of the private Regie context. GM only (route and API).
 */
export function RegieWindow({a,sessionHint}:{a:Actor;sessionHint:string}){
 const [room,setRoom]=useState<Room|null>(null),[waiting,setWaiting]=useState('');
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[offline,setOffline]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [contexts,setContexts]=useState<Record<string,RegieContext>>({}),[contextError,setContextError]=useState<{id:string;message:string}|null>(null);
 const [chosenScene,setChosenScene]=useState(''),[audiences,setAudiences]=useState<Record<string,Audience>>({});
 const [pagerText,setPagerText]=useState(''),[pagerTitle,setPagerTitle]=useState(''),[pagerSender,setPagerSender]=useState(''),[pagerUrgent,setPagerUrgent]=useState(false),[textSize,setTextSize]=useState(1),[preview,setPreview]=useState<Media|null>(null),[catalogSearch,setCatalogSearch]=useState('');
 const latest=useRef<Snapshot|null>(null),flight=useRef(false),saving=useRef(false),previewDialog=useRef<HTMLDialogElement>(null);
 const [peerId]=useState(()=>crypto.randomUUID());
 const regieKey=room?'chroniplay:regie:'+room.runId:'';

 // Find the running evening. The query only hints; the server decides which evening is active.
 const locate=useCallback(async()=>{
  try{const active=await api<{room?:{sessionId:string;runId?:string;open?:boolean;started?:boolean}|null}>('/api/live-table?view=active');
   const r=active.room;if(r?.open&&r.started&&r.runId){setRoom(old=>old?.runId===r.runId?old:{sessionId:r.sessionId,runId:r.runId!});setWaiting('');}
   else{setRoom(null);setSnapshot(null);latest.current=null;setWaiting(sessionHint?'Dieser Spielabend läuft gerade nicht.':'Es läuft kein Spielabend.');}
  }catch(e){setWaiting((e as Error).message);}
 },[sessionHint]);
 useEffect(()=>{if(room)return;queueMicrotask(()=>void locate());const t=window.setInterval(()=>void locate(),3000);return()=>window.clearInterval(t);},[room,locate]);

 const accept=useCallback((next:Snapshot)=>{
  if(next.principal.id!==a.id||!next.principal.gm){window.location.reload();return;}
  if(room&&next.runId!==room.runId){setRoom(null);return;}
  const merged=next.catalogIncluded?next:{...next,catalog:latest.current?.catalog||[],scenes:latest.current?.scenes||[],moreScenes:latest.current?.moreScenes||[]};
  latest.current=merged;setSnapshot(merged);setOffline(false);
 },[a.id,room]);
 const refresh=useCallback(async(catalog=false)=>{
  if(!room||flight.current||saving.current)return;flight.current=true;
  try{accept(await api<Snapshot>(stageUrl(room.sessionId,catalog||!latest.current?.catalogIncluded&&!latest.current?.catalog.length)));setError('');}
  catch(e){if(e instanceof ApiError&&[403,404,409].includes(e.status)){latest.current=null;setSnapshot(null);setRoom(null);}else setOffline(true);}
  finally{flight.current=false;}
 },[room,accept]);
 // Live sync with the table: fast while visible, slower in the background, at once on focus.
 useEffect(()=>{
  if(!room)return;queueMicrotask(()=>void refresh(true));
  let last=0;const tick=window.setInterval(()=>{const gap=window.document.visibilityState==='visible'?900:4000;if(Date.now()-last>=gap){last=Date.now();void refresh();}},300);
  const focus=()=>void refresh();window.addEventListener('focus',focus);
  return()=>{window.clearInterval(tick);window.removeEventListener('focus',focus);};
 },[room,refresh]);

 // The scene in focus is shared with the table's Regie drawer of this run (same browser).
 useEffect(()=>{
  if(!regieKey)return;
  const read=(raw:string|null)=>{try{const saved=JSON.parse(raw||'null');if(typeof saved?.sceneId==='string')setChosenScene(saved.sceneId);}catch{/* ignore */}};
  try{read(window.localStorage.getItem(regieKey));}catch{/* storage unavailable */}
  const follow=(e:StorageEvent)=>{if(e.key===regieKey)read(e.newValue);};window.addEventListener('storage',follow);return()=>window.removeEventListener('storage',follow);
 },[regieKey]);
 const chooseScene=(id:string)=>{setChosenScene(id);try{const old=JSON.parse(window.localStorage.getItem(regieKey)||'null');window.localStorage.setItem(regieKey,JSON.stringify({sceneId:id,tab:typeof old?.tab==='string'?old.tab:'narration'}));}catch{/* storage unavailable */}};
 const sceneId=chosenScene||snapshot?.stageSceneId||snapshot?.sceneInfo?.id||snapshot?.scenes[0]?.id||'';
 const known=!!contexts[sceneId];
 useEffect(()=>{
  if(!room||!sceneId||known)return;let current=true;
  api<RegieContext>(stageUrl(room.sessionId)+'&regie='+encodeURIComponent(sceneId)).then(c=>{if(current)setContexts(old=>({...old,[sceneId]:c}));}).catch(e=>{if(current)setContextError({id:sceneId,message:(e as Error).message});});
  return()=>{current=false;};
 },[room,sceneId,known]);
 useEffect(()=>{if(preview&&!previewDialog.current?.open)previewDialog.current?.showModal();},[preview]);
 useEffect(()=>{try{const v=Number(window.localStorage.getItem('chroniplay:regie-textgroesse:'+a.id));if([.9,1,1.15,1.3,1.5].includes(v))queueMicrotask(()=>setTextSize(v));}catch{/* storage unavailable */}},[a.id]);
 const resize=(d:number)=>{const steps=[.9,1,1.15,1.3,1.5],next=steps[Math.max(0,Math.min(steps.length-1,steps.indexOf(textSize)+d))];setTextSize(next);try{window.localStorage.setItem('chroniplay:regie-textgroesse:'+a.id,String(next));}catch{/* storage unavailable */}};

 /** Runs one existing stage/table command; outdated versions are retried once, nothing else is guessed. */
 async function run(body:Record<string,unknown>,recipients:Audience=null,done=''){
  const current=latest.current;if(!room||!current||saving.current)return false;saving.current=true;setBusy(true);
  try{accept(await sendStageCommand({sessionId:room.sessionId,runId:room.runId,peerId,current,recipients,body,retry:true}));setError('');setNotice(done);return true;}
  catch(e){setError((e as Error).message);return false;}finally{saving.current=false;setBusy(false);}
 }
 const audienceOf=(key:string):Audience=>key in audiences?audiences[key]:null;
 const setAudience=(key:string)=>(v:Audience)=>setAudiences(old=>({...old,[key]:v}));
 const invalid=(v:Audience)=>v!==null&&!v.length;
 async function activate(id:string){
  if(!await run({action:'activateScene',sceneId:id},null,'Szene läuft auf dem Tisch.'))return;
  const current=latest.current;
  if(current?.media&&!current.media.hidden)await run({action:'hideMedia',eventId:current.media.id});
  if(current?.sceneInfo&&current.sceneInfo.id!==id&&current.sceneEventId)await run({action:'hideScene',eventId:current.sceneEventId});
 }
 async function release(id:string){const target=audienceOf('narration:'+id);if(latest.current?.stageSceneId!==id)await activate(id);await run({action:'scene',id},target,'Erzählung freigegeben für '+audienceText(target,crew)+'.');}
 const place=(key:string,sourceId:string,sourceKind:'entity'|'file',title?:string,kind:'document'|'npc'='document')=>{const target=audienceOf(key);return run({action:'add',kind,sourceId,sourceKind,...(title?{title}:{}),visible:true,recipients:target},null,'Ausgespielt für '+audienceText(target,crew)+'.');};

 const crew=(snapshot?.crew||[]).filter(m=>m.id!==a.id);
 const objects=(snapshot?.objects||[]).filter((o):o is Exclude<StageObject,{kind:'note'}>=>o.kind!=='note');
 const placedFile=(id:string)=>objects.find(o=>o.sourceKind==='file'&&o.sourceId===id);
 const images=(snapshot?.catalog||[]).filter(o=>o.sourceKind==='file'&&o.mime?.startsWith('image/')).map(o=>({id:o.id,title:o.title}));
 const context=contexts[sceneId];
 const sceneMedia=context?.media||[];
 const sceneAudio=sceneMedia.filter(m=>m.mime.startsWith('audio/')),sceneVideo=sceneMedia.filter(m=>m.mime.startsWith('video/'));
 const catalogAudio=(snapshot?.catalog||[]).filter(o=>o.sourceKind==='file'&&o.mime?.startsWith('audio/'));
 const effects=snapshot?.effects||[];
 const toggleEffect=(e:StageEffect)=>run({action:'effects',effects:effects.includes(e)?effects.filter(x=>x!==e):[...effects,e]},null,effectLabels[e]+(effects.includes(e)?' beendet.':' läuft.'));
 const pagerTarget=audienceOf('pager');

 if(!room)return <main className={styles.waiting}><p className={styles.eyebrow}>CHRONIPLAY · REGIE</p><h1>Live-Regie</h1><p role="status">{waiting||'Spielabend wird gesucht …'}</p><p>Starte den Spielabend am Spieltisch. Diese Regie verbindet sich dann von selbst.</p></main>;

 const media=(m:Media,Icon:typeof ImageIcon,kind:'image'|'pdf'|'audio'|'video')=>{const placed=placedFile(m.fileId),key='file:'+m.fileId,target=audienceOf(key);return <article key={m.id} className={styles.item} data-item={m.fileId}>
  {kind==='image'?<button type="button" className={styles.thumb} aria-label={'Vorschau: '+m.title} onClick={()=>setPreview(m)}><img src={fileUrl(m.fileId)} alt="" loading="lazy"/></button>:<div className={styles.fileIcon}><Icon/><small>{m.name}</small></div>}
  <div className={styles.itemBody}><h3>{m.title}</h3><p className={regieStyles.state} data-placed={!!placed}>{tableState(placed)}</p>
   <AudiencePicker value={target} onChange={setAudience(key)} crew={crew} label={m.title}/>
   <div className={styles.actions}>
    <button type="button" className={styles.primary} disabled={busy||invalid(target)} onClick={()=>void place(key,m.fileId,'file',m.title)}><Eye/> {placed?'Freigabe ändern':kind==='audio'?'Kassette ausspielen':kind==='video'?'Bildschirm ausspielen':'Auf den Tisch'}</button>
    {placed&&<button type="button" disabled={busy} onClick={()=>void run({action:'remove',id:placed.id},null,'Vom Tisch genommen.')}><EyeOff/> Vom Tisch</button>}
    {(kind==='image'||kind==='video')&&<button type="button" disabled={busy||invalid(target)} onClick={()=>void run({action:'showMedia',eventId:crypto.randomUUID(),fileIds:[m.fileId]},target,'Groß eingespielt für '+audienceText(target,crew)+'.')}><MonitorPlay/> Groß einspielen</button>}
    {kind!=='image'&&<button type="button" onClick={()=>setPreview(m)}><Search/> Vorschau</button>}
   </div></div>
 </article>;};

 const s=context?.scene,running=!!s&&snapshot?.stageSceneId===s.id,shared=!!s&&snapshot?.sceneInfo?.id===s.id;
 const allScenes=[...snapshot?.scenes||[],...snapshot?.moreScenes||[]];
 return <div className={styles.app} data-regie-window="true">
  <header className={styles.header}>
   <div className={styles.brand}><span>CHRONIPLAY</span><strong>Live-Regie</strong><small><Lock size={12}/> nur Spielleitung</small></div>
   <label className={styles.scenePick}>Szene<select aria-label="Szene in der Regie" value={sceneId} onChange={e=>chooseScene(e.target.value)}>
    {!!snapshot?.scenes.length&&<optgroup label="Dieser Spielabend">{snapshot.scenes.map((x,i)=><option key={x.id} value={x.id}>{String(i+1).padStart(2,'0')} · {x.title}{snapshot.stageSceneId===x.id?' · läuft':''}</option>)}</optgroup>}
    {!!snapshot?.moreScenes?.length&&<optgroup label="Weitere Szenen (Improvisation)">{snapshot.moreScenes.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</optgroup>}
    {!allScenes.some(x=>x.id===sceneId)&&<option value={sceneId}>{s?.title||'Szene'}</option>}
   </select></label>
   <div className={styles.sceneState}>{s&&(running?<span className={styles.live}><Clapperboard size={14}/> Läuft auf dem Tisch</span>:<button type="button" className={styles.primary} disabled={busy} onClick={()=>void activate(s.id)}><Clapperboard/> Szene starten</button>)}</div>
   <ul className={styles.crew} aria-label="Runde">{crew.map(m=><li key={m.id} data-presence={m.presence}>{m.name}</li>)}</ul>
   <p className={styles.sync} role="status" data-fresh={!!snapshot&&!offline}><Radio size={13}/> {offline?'Verbindung gestört – versuche erneut':snapshot?'Live verbunden':'Verbinde …'}</p>
   <button type="button" className={styles.tableLink} onClick={()=>{if(window.opener&&!window.opener.closed)window.opener.focus();else window.open('/spielbereich?bereich=sitzung','_blank');}}><BookOpen size={15}/> Zum Spieltisch</button>
  </header>
  {(error||notice)&&<div className={error?styles.error:styles.notice} role={error?'alert':'status'}>{error||notice}<button type="button" aria-label="Meldung schließen" onClick={()=>{setError('');setNotice('');}}><X size={14}/></button></div>}
  {!context?<main className={styles.loading}>{contextError?.id===sceneId?<p role="alert">{contextError.message}</p>:sceneId?<p role="status">Regie wird geladen …</p>:<p>Diesem Spielabend ist noch keine Szene zugeordnet. Wähle oben eine Szene der Kampagne.</p>}</main>:
  <main className={styles.grid} data-scene={s!.id}>
   <Column id="col-material" title="Material" icon={<ImageIcon size={17}/>}>
    {!!sceneMedia.filter(m=>m.mime.startsWith('image/')).length&&<Block title="Bilder · Polaroids">{sceneMedia.filter(m=>m.mime.startsWith('image/')).map(m=>media(m,ImageIcon,'image'))}</Block>}
    {!!sceneMedia.filter(m=>m.mime==='application/pdf').length&&<Block title="Dokumente · PDF">{sceneMedia.filter(m=>m.mime==='application/pdf').map(m=>media(m,FileText,'pdf'))}</Block>}
    {!!context.handouts.length&&<Block title="Handout-Akten">{context.handouts.map(h=>{const placed=objects.find(o=>o.kind==='document'&&o.sourceKind==='entity'&&o.sourceId===h.id),key='entity:'+h.id,target=audienceOf(key);return <article key={h.id} className={styles.item}><div className={styles.fileIcon}><FileText/></div><div className={styles.itemBody}><h3>{h.title}</h3>{h.stageable?<><p className={regieStyles.state} data-placed={!!placed}>{tableState(placed)}</p><AudiencePicker value={target} onChange={setAudience(key)} crew={crew} label={h.title}/><div className={styles.actions}><button type="button" className={styles.primary} disabled={busy||invalid(target)} onClick={()=>void place(key,h.id,'entity')}><Eye/> {placed?'Freigabe ändern':'Auf den Tisch'}</button>{placed&&<button type="button" disabled={busy} onClick={()=>void run({action:'remove',id:placed.id},null,'Vom Tisch genommen.')}><EyeOff/> Vom Tisch</button>}</div></>:<p className={regieStyles.empty}>Hinweisakte – Freigabe über die Spielwelt.</p>}</div></article>;})}</Block>}
    {!sceneMedia.some(m=>m.mime.startsWith('image/')||m.mime==='application/pdf')&&!context.handouts.length&&<p className={regieStyles.empty}>Kein Bild- oder Dokumentmaterial mit dieser Szene verknüpft.</p>}
    <Block title={'Weiteres Material der Kampagne ('+(snapshot?.catalog.filter(o=>o.sourceKind==='file').length||0)+')'} open={false}>
     <input className={styles.search} aria-label="Kampagnenmaterial durchsuchen" placeholder="Material suchen …" value={catalogSearch} onChange={e=>setCatalogSearch(e.target.value)}/>
     <ul className={styles.compact}>{(snapshot?.catalog||[]).filter(o=>o.sourceKind==='file'&&o.title.toLocaleLowerCase('de').includes(catalogSearch.toLocaleLowerCase('de'))).slice(0,40).map(o=>{const placed=placedFile(o.id);return <li key={o.id}><span>{o.title}<small>{tableState(placed)}</small></span><button type="button" disabled={busy} onClick={()=>void run({action:'add',kind:'document',sourceId:o.id,sourceKind:'file',visible:true,recipients:null},null,'Für alle auf den Tisch gelegt.')}><Eye/> Für alle</button>{placed&&<button type="button" aria-label={o.title+' vom Tisch nehmen'} disabled={busy} onClick={()=>void run({action:'remove',id:placed.id})}><EyeOff/></button>}</li>;})}</ul>
    </Block>
   </Column>

   <Column id="col-text" title="Texte zum Vorlesen" icon={<BookOpen size={17}/>}>
    <div className={styles.textTools}><h3 className={styles.sceneTitle}>{s!.title}</h3>{context.place&&<small>Schauplatz: {context.place.title}</small>}
     <div role="group" aria-label="Textgröße der Regie"><button type="button" aria-label="Text kleiner" disabled={textSize<=.9} onClick={()=>resize(-1)}><Minus size={14}/></button><span>{Math.round(textSize*100)} %</span><button type="button" aria-label="Text größer" disabled={textSize>=1.5} onClick={()=>resize(1)}><Plus size={14}/></button></div></div>
    <div className={styles.texts} style={{fontSize:textSize+'em'}}>
     <section className={styles.narration} aria-label="Erzählung">
      <header><h3>Erzählung</h3><p className={regieStyles.state} data-placed={shared}>{shared?'Für die Runde freigegeben':'Noch nicht freigegeben'}</p></header>
      <Text value={s!.narration} empty="Kein Erzähltext vorbereitet."/>
      {s!.narration.trim()&&<div className={styles.releaseBar}><AudiencePicker value={audienceOf('narration:'+s!.id)} onChange={setAudience('narration:'+s!.id)} crew={crew} label="Erzählung"/><div className={styles.actions}><button type="button" className={styles.primary} disabled={busy||invalid(audienceOf('narration:'+s!.id))} onClick={()=>void release(s!.id)}><Eye/> {shared?'Erneut freigeben':'Erzählung freigeben'}</button>{snapshot?.sceneEventId&&<button type="button" disabled={busy} onClick={()=>void run({action:'hideScene',eventId:snapshot.sceneEventId},null,'Erzählung zurückgezogen.')}><EyeOff/> Erzählung zurückziehen</button>}</div></div>}
     </section>
     <Block title="Atmosphäre"><Text value={s!.atmosphere} empty="Keine Atmosphäre vorbereitet."/></Block>
     <Block title="Dialoge"><Text value={s!.dialogueNotes} empty="Keine Dialoghilfen."/>{context.npcs.filter(n=>n.cue.trim()).map(n=><article key={n.id} className={regieStyles.note}><h4>{n.title}</h4><Text value={n.cue} empty=""/></article>)}</Block>
     <Block title="Interaktionen & Notizen"><Text value={s!.interactions} empty="Keine Interaktionen beschrieben."/>{context.notes.map(n=><article key={n.id} className={regieStyles.note}><h4>{n.title}</h4><Text value={n.text} empty=""/></article>)}</Block>
     <Block title="Geheimnisse · nur SL"><Text value={s!.secrets} empty="Keine Geheimnisse hinterlegt."/>{s!.visions.trim()&&<><h4>Visionen</h4><Text value={s!.visions} empty=""/></>}</Block>
     <Block title="Mögliche Folgen" open={false}><Text value={s!.possibleConsequences} empty="Keine Folgen vorbereitet."/>{s!.possibilities.map(p=><article key={p.id} className={regieStyles.note}><h4>{p.title}</h4><p>{p.text}</p></article>)}</Block>
     <Block title="SL-Notizen"><Text value={s!.gmNotes} empty="Keine SL-Notizen."/></Block>
    </div>
   </Column>

   <Column id="col-media" title="Ton & Video" icon={<Music size={17}/>}>
    <Block title="Tonaufnahmen · Kassette">{sceneAudio.length?sceneAudio.map(m=>media(m,Music,'audio')):<p className={regieStyles.empty}>Keine Tonaufnahme mit dieser Szene verknüpft.</p>}</Block>
    <Block title="Video · Röhrenbildschirm">{sceneVideo.length?sceneVideo.map(m=>media(m,Film,'video')):<p className={regieStyles.empty}>Kein Video mit dieser Szene verknüpft.</p>}</Block>
    <Block title="Hintergrundmusik">
     <p className={regieStyles.state} data-placed={!!snapshot?.music}>{snapshot?.music?'Läuft für alle: '+snapshot.music.title:'Keine Musik'}</p>
     <p className={regieStyles.empty}>Jede Person regelt Lautstärke und Stummschaltung selbst. Blockiert ein Browser den Start, erscheint dort „Musik abspielen“.</p>
     <ul className={styles.compact}>{[...sceneAudio.map(m=>({id:m.fileId,title:m.title})),...catalogAudio.filter(o=>!sceneAudio.some(m=>m.fileId===o.id)).map(o=>({id:o.id,title:o.title}))].map(t=><li key={t.id} data-active={snapshot?.music?.fileId===t.id}><span>{t.title}</span><button type="button" disabled={busy} onClick={()=>void run({action:'music',fileId:t.id},null,'Musik läuft: '+t.title)}>{snapshot?.music?.fileId===t.id?<><RotateCcw/> Neu starten</>:<><Music/> Als Musik</>}</button></li>)}</ul>
     {snapshot?.music&&<button type="button" disabled={busy} onClick={()=>void run({action:'music',fileId:null},null,'Musik gestoppt.')}><Square/> Musik stoppen</button>}
    </Block>
   </Column>

   <Column id="col-play" title="Spielfeld & Effekte" icon={<Clapperboard size={17}/>}>
    <Block title="Atmosphäre auf dem Tisch">
     <div className={styles.effects}>{(['rain','fog'] as const).map(e=><button type="button" key={e} aria-pressed={effects.includes(e)} disabled={busy} onClick={()=>void toggleEffect(e)}>{e==='rain'?<CloudRain/>:<CloudFog/>} {effectLabels[e]}</button>)}</div>
     <p className={regieStyles.empty}>Gilt für die ganze Runde. Bei „Bewegung reduzieren“ bleibt der Effekt ruhig stehen.</p>
    </Block>
    <Block title="Hintergrund">
     <p className={regieStyles.state} data-placed={!!snapshot?.backdrop}>Jetzt: {snapshot?.backdrop?.title||'Standardbühne'}</p>
     <BackdropChoice current={snapshot?.backdrop?.fileId||''} busy={busy} images={images} onChoose={fileId=>void run({action:'backdrop',fileId},null,'Hintergrund gewechselt.')}
      sceneImages={[...(context.backdrop?[{id:context.backdrop.fileId,title:'Szenenbild · '+context.backdrop.name}]:[]),...sceneMedia.filter(m=>m.mime.startsWith('image/')&&m.fileId!==context.backdrop?.fileId).map(m=>({id:m.fileId,title:m.title}))]}/>
     {snapshot?.backdrop&&<button type="button" disabled={busy} onClick={()=>void run({action:'backdrop',fileId:null},null,'Standardbühne.')}><RotateCcw/> Standardbühne</button>}
    </Block>
    <Block title="NPCs der Szene">{context.npcs.length?context.npcs.map(n=>{const placed=objects.find(o=>o.kind==='npc'&&o.sourceId===n.id),key='npc:'+n.id,target=audienceOf(key),onTable=placed&&placed.visibility==='group';return <article key={n.id} className={styles.item} data-npc={n.id}>
     <img className={styles.portrait} src={n.image} alt="" loading="lazy" onError={e=>{e.currentTarget.style.visibility='hidden';}}/>
     <div className={styles.itemBody}><h3>{n.title}</h3>{n.summary&&<p className={styles.summary}>{n.summary}</p>}<p className={regieStyles.state} data-placed={!!onTable}>{tableState(placed)}</p>
      {n.gmBody.trim()&&<details className={styles.secret}><summary>SL-Wissen</summary><Text value={n.gmBody} empty=""/></details>}
      <AudiencePicker value={target} onChange={setAudience(key)} crew={crew} label={n.title}/>
      <div className={styles.actions}><button type="button" className={styles.primary} disabled={busy||invalid(target)} onClick={()=>void place(key,n.id,'entity',undefined,'npc')}><UserPlus/> {onTable?'Freigabe ändern':'Auftreten lassen'}</button>{placed&&<button type="button" disabled={busy} onClick={()=>void run({action:'remove',id:placed.id},null,n.title+' tritt ab.')}><UserMinus/> Abtreten</button>}</div>
     </div></article>;}):<p className={regieStyles.empty}>Keine NPCs mit dieser Szene verknüpft.</p>}</Block>
    <Block title="Pager">
     <form className={styles.pager} onSubmit={e=>{e.preventDefault();const text=pagerText.trim();if(!text)return;void run({action:'pager',text,recipients:pagerTarget,origin:'regie',...(pagerTitle.trim()?{title:pagerTitle.trim()}:{}),...(pagerSender.trim()?{sender:pagerSender.trim()}:{}),...(pagerUrgent?{priority:'hoch'}:{})},null,'Pager an '+audienceText(pagerTarget,crew)+' gesendet.').then(ok=>{if(ok){setPagerText('');setPagerTitle('');setPagerUrgent(false);}});}}>
      <div className={styles.pagerMeta}><label>Absender (im Spiel)<input aria-label="Pager-Absender" maxLength={pagerSenderMax} value={pagerSender} onChange={e=>setPagerSender(e.target.value)} placeholder="z. B. Unbekannt"/></label><label>Titel<input aria-label="Pager-Titel" maxLength={pagerTitleMax} value={pagerTitle} onChange={e=>setPagerTitle(e.target.value)} placeholder="optional"/></label></div>
      <label>Nachricht<textarea aria-label="Pager-Nachricht" maxLength={pagerTextMax} rows={3} value={pagerText} onChange={e=>setPagerText(e.target.value)} placeholder="z. B. RUF MICH AN · 0281-1922"/></label>
      <div className={styles.pagerRow}><label className={styles.check}><input type="checkbox" checked={pagerUrgent} onChange={e=>setPagerUrgent(e.target.checked)}/> Dringend</label><small>{pagerText.length}/{pagerTextMax}</small></div>
      <AudiencePicker value={pagerTarget} onChange={setAudience('pager')} crew={crew} label="Pager"/>
      <button type="submit" className={styles.primary} disabled={busy||!pagerText.trim()||invalid(pagerTarget)}><Send/> Pager senden</button>
     </form>
     {!!snapshot?.pagers?.length&&<ul className={styles.compact} aria-label="Gesendete Pager">{[...snapshot.pagers].reverse().map(p=><li key={p.id}><span>{p.priority==='hoch'&&<b>Dringend · </b>}{p.title&&<b>{p.title}: </b>}{p.text}<small>{p.sender?'von '+p.sender+' · ':''}an {audienceText(p.recipients??null,crew)} · {new Date(p.at).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</small><small data-pager-acks="">{p.acks?.length?'Gelesen: '+p.acks.map(x=>crew.find(m=>m.id===x.id)?.name||'?').join(', '):'Noch nicht quittiert'}</small></span><button type="button" aria-label="Pager zurückziehen" disabled={busy} onClick={()=>void run({action:'pagerWithdraw',id:p.id},null,'Pager zurückgezogen.')}><Undo2/></button></li>)}</ul>}
    </Block>
    <Block title={'Auf dem Tisch ('+objects.length+')'} open={false}>{objects.length?<ul className={styles.compact}>{objects.map(o=><li key={o.id}><span>{o.title}<small>{tableState(o)}</small></span><button type="button" aria-label={o.title+' vom Tisch nehmen'} disabled={busy} onClick={()=>void run({action:'remove',id:o.id})}><EyeOff/></button></li>)}</ul>:<p className={regieStyles.empty}>Der Tisch ist leer.</p>}</Block>
   </Column>
  </main>}
  <dialog ref={previewDialog} className={regieStyles.preview} aria-label="Private Vorschau" onClose={()=>setPreview(null)}>{preview&&<><header><div><small>PRIVATE VORSCHAU · NUR SL</small><h2>{preview.title}</h2></div><button aria-label="Vorschau schließen" onClick={()=>previewDialog.current?.close()}><X/></button></header>
   <div>{preview.mime.startsWith('image/')?<img src={fileUrl(preview.fileId)} alt={preview.title}/>:preview.mime.startsWith('audio/')?<audio controls src={fileUrl(preview.fileId)}/>:preview.mime.startsWith('video/')?<video controls playsInline src={fileUrl(preview.fileId)}/>:<LivePdf url={fileUrl(preview.fileId)} name={preview.name}/>}
   {preview.text.trim()&&<Text value={preview.text} empty=""/>}</div></>}</dialog>
 </div>;
}
