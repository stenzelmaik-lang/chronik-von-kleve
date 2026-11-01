"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated GM media must never use a public optimization proxy. */
import {PreparedWhisperReleases} from './prepared-whisper-releases';
import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {Eye,EyeOff,Lock,Clapperboard,Image as ImageIcon,FileText,Music,Film,Search,X,RotateCcw,CloudRain,CloudFog,CloudLightning,Snowflake,Flame,Moon,Lightbulb,UserPlus,UserMinus,Send,Undo2,MonitorPlay,Minus,Plus,Square,Radio,BookOpen} from 'lucide-react';
import type {Actor} from '@/domain/types';
import {pagerTextMax,pagerTitleMax,pagerSenderMax,stageEffects,type StageEffect} from '@/domain/live-stage';
import {api,ApiError} from '../api-client';
import {RichTextView} from '../rich-text';
import {LivePdf} from '../live-pdf';
import {BackdropChoice,tableState} from './regie';
import {sendStageCommand,type Audience} from './stage-client';
import {effectLabels} from './atmosphere';
import {TableMaterialLibrary} from '../table-material-library';
import {RegieVitals} from './regie-vitals';
import {RegieAmbience} from './regie-ambience';
import {RegieMaterials} from '../material/regie-materials';
import type {RegieContext,Snapshot,StageObject,PreparedPager,PagerMessage} from './types';
import {PagerSelfTest} from './ultio-pager';
import {BellRing} from 'lucide-react';
import regieStyles from './regie.module.css';
import styles from './regie-window.module.css';
import {ThumbImage} from '../file-thumb';
import {CheckIssueForm} from './check-issue-form';

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
const pagerTime=(at:string)=>new Date(at).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
const audienceText=(v:Audience,crew:Crew)=>v===null?'alle':v.map(id=>crew.find(m=>m.id===id)?.name||'?').join(', ')||'niemand';

function Column({title,icon,children,id}:{title:string;icon:ReactNode;children:ReactNode;id:string}){
 return <section className={styles.column} aria-labelledby={id}><h2 id={id}>{icon} {title}</h2><div className={styles.columnBody}>{children}</div></section>;
}
function Block({title,children,open=true,area}:{title:string;children:ReactNode;open?:boolean;area?:RegieArea}){return <details className={styles.block} open={open} id={area?'regie-bereich-'+area:undefined} data-area={area}><summary>{title}</summary><div>{children}</div></details>;}

/**
 * Every area of a scene, always reachable from one menu. Text areas replace each other in the reading column;
 * the other areas live in their own columns and are scrolled into view (and opened) on choice.
 */
const regieAreas=[['narration','Erzählung','text'],['atmosphere','Atmosphäre','text'],['dialogue','Dialoge','text'],['interactions','Interaktion','text'],['whispers','Visionen & Briefe','text'],['secrets','Geheimnisse','text'],['consequences','Folgen','text'],['notes','SL-Notizen','text'],
 ['vitals','Zustände','block'],['material','Material','block'],['sound','Ton & Musik','block'],['effects','Effekte','block'],['npcs','NPCs','block'],['pager','Pager','block'],['table','Tisch','block']] as const;
type RegieArea=typeof regieAreas[number][0];
const areaKey=(actorId:string)=>'chroniplay:regie-bereich:'+actorId;
const effectIcons:Record<StageEffect,typeof CloudRain>={rain:CloudRain,fog:CloudFog,storm:CloudLightning,snow:Snowflake,embers:Flame,darkness:Moon,flicker:Lightbulb};
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
 const [area,setArea]=useState<RegieArea>('narration'),[textArea,setTextArea]=useState<RegieArea>('narration'),[crossfade,setCrossfade]=useState(false);
 const [pagerTest,setPagerTest]=useState<PagerMessage|null>(null);
 const [pagerText,setPagerText]=useState(''),[pagerTitle,setPagerTitle]=useState(''),[pagerSender,setPagerSender]=useState(''),[pagerUrgent,setPagerUrgent]=useState(false),[textSize,setTextSize]=useState(1),[preview,setPreview]=useState<Media|null>(null);
 const latest=useRef<Snapshot|null>(null),flight=useRef(false),saving=useRef(false),previewDialog=useRef<HTMLDialogElement>(null);
 // One id per spontaneous pager draft: a repeated click or a retry after a lost answer never sends it twice.
 const pagerDraftId=useRef('');
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
  let last=0;const tick=window.setInterval(()=>{const gap=window.document.visibilityState==='visible'?1500:5000;if(Date.now()-last>=gap){last=Date.now();void refresh();}},300);
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
 useEffect(()=>{try{const saved=window.localStorage.getItem(areaKey(a.id));const known=regieAreas.find(([id])=>id===saved);if(known)queueMicrotask(()=>{setArea(known[0]);if(known[2]==='text')setTextArea(known[0]);});}catch{/* storage unavailable */}},[a.id]);
 /** Opens one area: a text area in the reading column, any other area by scrolling its block into view. */
 const chooseArea=useCallback((id:RegieArea,scroll=true)=>{
  setArea(id);try{window.localStorage.setItem(areaKey(a.id),id);}catch{/* storage unavailable */}
  const kind=regieAreas.find(([x])=>x===id)?.[2];
  if(kind==='text'){setTextArea(id);if(scroll)queueMicrotask(()=>window.document.getElementById('col-text')?.scrollIntoView({block:'nearest'}));return;}
  if(!scroll)return;
  queueMicrotask(()=>{const el=window.document.getElementById('regie-bereich-'+id);if(!el)return;if(el instanceof HTMLDetailsElement)el.open=true;
   // Jump without smooth scrolling: live updates re-render the columns several times a second and would cancel it.
   el.scrollIntoView({block:'start',behavior:'auto'});
   el.dataset.flash='true';window.setTimeout(()=>{delete el.dataset.flash;},1400);el.querySelector<HTMLElement>('summary')?.focus({preventScroll:true});});
 },[a.id]);
 // Alt+1 … Alt+9 jump to the first nine areas without leaving the keyboard.
 useEffect(()=>{const keys=(e:KeyboardEvent)=>{if(!e.altKey||e.ctrlKey||e.metaKey)return;const n=Number(e.key);if(!Number.isInteger(n)||n<1||n>9)return;e.preventDefault();chooseArea(regieAreas[n-1][0]);};window.addEventListener('keydown',keys);return()=>window.removeEventListener('keydown',keys);},[chooseArea]);
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
 const place=(key:string,sourceId:string,sourceKind:'entity'|'file'|'record',title?:string,kind:'document'|'npc'='document')=>{const target=audienceOf(key);return run({action:'add',kind,sourceId,sourceKind,...(title?{title}:{}),visible:true,recipients:target},null,'Ausgespielt für '+audienceText(target,crew)+'.');};

 const crew=(snapshot?.crew||[]).filter(m=>m.id!==a.id);
 const objects=(snapshot?.objects||[]).filter((o):o is Exclude<StageObject,{kind:'note'}>=>o.kind!=='note');
 const placedFile=(id:string)=>objects.find(o=>o.sourceKind==='file'&&o.sourceId===id);
 const context=contexts[sceneId];
 const sceneMedia=context?.media||[];
 const sceneAudio=sceneMedia.filter(m=>m.mime.startsWith('audio/')),sceneVideo=sceneMedia.filter(m=>m.mime.startsWith('video/'));
 const catalogAudio=(snapshot?.catalog||[]).filter(o=>o.sourceKind==='file'&&o.mime?.startsWith('audio/'));
 const effects=snapshot?.effects||[];
 // Effects combine; with "Überblenden" a choice replaces the running ones in one step, so the table blends over.
 const toggleEffect=(e:StageEffect)=>{const on=effects.includes(e),next=on?effects.filter(x=>x!==e):crossfade?[e]:[...effects,e];return run({action:'effects',effects:next},null,effectLabels[e]+(on?' beendet.':crossfade&&effects.length?' blendet über.':' läuft.'));};

 const pagerTarget=audienceOf('pager');
 const sentPagers=snapshot?.pagers||[];
 // Prepared recipients outside this round are left out; when none remain, the GM chooses before playing it.
 const preparedAudience=(p:PreparedPager):Audience=>{const key='pager:'+p.id;if(key in audiences)return audiences[key];return p.recipientIds.length?p.recipientIds.filter(id=>crew.some(m=>m.id===id)):null;};
 // Read = opened and shown on the pager; acknowledged = confirmed with a second OK. Acknowledging implies reading.
 const ackText=(p:{acks?:{id:string}[];reads?:{id:string}[]})=>{const who=(list:{id:string}[])=>[...new Set(list.map(x=>x.id))].map(id=>crew.find(m=>m.id===id)?.name||'?').join(', ');const read=[...(p.reads||[]),...(p.acks||[])];return read.length?'Gelesen: '+who(read)+(p.acks?.length?' · Quittiert: '+who(p.acks):''):'Noch nicht gelesen';};
 function playPrepared(p:PreparedPager){const target=preparedAudience(p);return run({action:'pager',id:p.id,origin:'vorbereitet',text:p.text,recipients:target,...(p.title.trim()?{title:p.title.trim().slice(0,pagerTitleMax)}:{}),...(p.sender.trim()?{sender:p.sender.trim()}:{}),...(p.priority==='hoch'?{priority:'hoch'}:{})},null,'Pager „'+(p.title||p.text.slice(0,30))+'“ an '+audienceText(target,crew)+' gesendet.');}
 function sendSpontaneous(){const text=pagerText.trim();if(!text)return;if(!pagerDraftId.current)pagerDraftId.current=crypto.randomUUID();const id=pagerDraftId.current;
  void run({action:'pager',id,text,recipients:pagerTarget,origin:'regie',...(pagerTitle.trim()?{title:pagerTitle.trim()}:{}),...(pagerSender.trim()?{sender:pagerSender.trim()}:{}),...(pagerUrgent?{priority:'hoch'}:{})},null,'Pager an '+audienceText(pagerTarget,crew)+' gesendet.').then(ok=>{if(ok||latest.current?.pagers?.some(p=>p.id===id)){pagerDraftId.current='';setPagerText('');setPagerTitle('');setPagerUrgent(false);}});}
 const draft=(f:()=>void)=>{pagerDraftId.current='';f();};

 // A remembered block area is brought into view once its scene has loaded.
 const restored=useRef(false),loaded=!!context;
 useEffect(()=>{if(!loaded||restored.current)return;restored.current=true;const kind=regieAreas.find(([x])=>x===area)?.[2];if(kind==='block')queueMicrotask(()=>chooseArea(area));},[loaded,area,chooseArea]);
 if(!room)return <main className={styles.waiting}><p className={styles.eyebrow}>CHRONIPLAY · REGIE</p><h1>Live-Regie</h1><p role="status">{waiting||'Spielabend wird gesucht …'}</p><p>Starte den Spielabend am Spieltisch. Diese Regie verbindet sich dann von selbst.</p></main>;

 const media=(m:Media,Icon:typeof ImageIcon,kind:'image'|'pdf'|'audio'|'video')=>{const placed=placedFile(m.fileId),key='file:'+m.fileId,target=audienceOf(key);return <article key={m.id} className={styles.item} data-item={m.fileId}>
  {kind==='image'?<button type="button" className={styles.thumb} aria-label={'Vorschau: '+m.title} onClick={()=>setPreview(m)}><ThumbImage id={m.fileId}/></button>:<div className={styles.fileIcon}><Icon/><small>{m.name}</small></div>}
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
 const filled=(v:string|undefined)=>!!v&&!!v.replace(/<[^>]*>/g,'').trim();
 const areaHasText=(id:RegieArea)=>!s||!context?true:id==='narration'?filled(s.narration):id==='atmosphere'?filled(s.atmosphere):id==='dialogue'?filled(s.dialogueNotes)||context.npcs.some(n=>n.cue.trim()):id==='interactions'?filled(s.interactions)||context.notes.length>0:id==='whispers'?!!context.whispers?.length:id==='secrets'?filled(s.secrets)||filled(s.visions):id==='consequences'?filled(s.possibleConsequences)||s.possibilities.length>0:id==='notes'?filled(s.gmNotes):true;

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
  <nav className={styles.areas} aria-label="Bereiche der Szene">{regieAreas.map(([id,label,kind],i)=>{const empty=!!context&&kind==='text'&&!areaHasText(id);return <button type="button" key={id} data-area-button={id} data-kind={kind} data-empty={empty} aria-current={(kind==='text'?textArea===id&&area===id:area===id)?'true':undefined} title={(i<9?'Alt+'+(i+1)+' · ':'')+(empty?'Nichts vorbereitet':label)} onClick={()=>chooseArea(id)}>{label}</button>;})}</nav>
  {!context?<main className={styles.loading}>{snapshot&&<TableMaterialLibrary a={a} compact live={{snapshot,busy,command:body=>run(body)}}/>}{contextError?.id===sceneId?<p role="alert">{contextError.message}</p>:sceneId?<p role="status">Regie wird geladen …</p>:<p>Diesem Spielabend ist noch keine Szene zugeordnet. Wähle oben eine Szene der Kampagne.</p>}</main>:
  <main className={styles.grid} data-scene={s!.id}>
   <Column id="col-material" title="Material" icon={<ImageIcon size={17}/>}>
    <span id="regie-bereich-material" data-area="material" className={styles.anchor} tabIndex={-1}/>
    {!!context.materials?.length&&<Block title="Szenenmaterial"><RegieMaterials heading={false} materials={context.materials} objects={snapshot?.objects||[]} crew={crew} busy={busy} run={(body,done)=>run(body,null,done)}/></Block>}
    {snapshot&&<TableMaterialLibrary a={a} compact live={{snapshot,busy,command:body=>run(body)}}/>}
    {!!sceneMedia.filter(m=>m.mime.startsWith('image/')).length&&<Block title="Bilder · Polaroids">{sceneMedia.filter(m=>m.mime.startsWith('image/')).map(m=>media(m,ImageIcon,'image'))}</Block>}
    {!!sceneMedia.filter(m=>m.mime==='application/pdf').length&&<Block title="Dokumente · PDF">{sceneMedia.filter(m=>m.mime==='application/pdf').map(m=>media(m,FileText,'pdf'))}</Block>}
    {!!context.handouts.length&&<Block title="Handout-Akten">{context.handouts.map(h=>{const placed=objects.find(o=>o.kind==='document'&&o.sourceKind===(h.sourceKind||'entity')&&o.sourceId===h.id),key='entity:'+h.id,target=audienceOf(key);return <article key={h.id} className={styles.item}><div className={styles.fileIcon}><FileText/></div><div className={styles.itemBody}><h3>{h.title}</h3>{h.stageable?<><p className={regieStyles.state} data-placed={!!placed}>{tableState(placed)}</p><AudiencePicker value={target} onChange={setAudience(key)} crew={crew} label={h.title}/><div className={styles.actions}><button type="button" className={styles.primary} disabled={busy||invalid(target)} onClick={()=>void place(key,h.id,h.sourceKind||'entity')}><Eye/> {placed?'Freigabe ändern':'Auf den Tisch'}</button>{placed?<button type="button" disabled={busy} onClick={()=>void run({action:'remove',id:placed.id},null,'Vom Tisch genommen.')}><EyeOff/> Vom Tisch</button>:<button type="button" disabled={busy} onClick={()=>void run({action:'add',kind:'document',sourceId:h.id,sourceKind:h.sourceKind||'entity'},null,'Nur für dich aufgelegt; noch nicht freigegeben.')}><Lock/> Nur SL auflegen</button>}</div></>:<p className={regieStyles.empty}>Hinweisakte – Freigabe über die Spielwelt.</p>}</div></article>;})}</Block>}
    {!sceneMedia.some(m=>m.mime.startsWith('image/')||m.mime==='application/pdf')&&!context.handouts.length&&<p className={regieStyles.empty}>Kein Bild- oder Dokumentmaterial mit dieser Szene verknüpft.</p>}

   </Column>

   <Column id="col-text" title="Texte zum Vorlesen" icon={<BookOpen size={17}/>}>
    <div className={styles.textTools}><h3 className={styles.sceneTitle}>{s!.title}</h3>{context.place&&<small>Schauplatz: {context.place.title}</small>}
     <div role="group" aria-label="Textgröße der Regie"><button type="button" aria-label="Text kleiner" disabled={textSize<=.9} onClick={()=>resize(-1)}><Minus size={14}/></button><span>{Math.round(textSize*100)} %</span><button type="button" aria-label="Text größer" disabled={textSize>=1.5} onClick={()=>resize(1)}><Plus size={14}/></button></div></div>
    <div className={styles.texts} style={{fontSize:textSize+'em'}} data-text-area={textArea}>
     {textArea==='narration'&&<section className={styles.narration} aria-label="Erzählung">
      <header><h3>Erzählung</h3><p className={regieStyles.state} data-placed={shared}>{shared?'Für die Runde freigegeben':'Noch nicht freigegeben'}</p></header>
      <Text value={s!.narration} empty="Kein Erzähltext vorbereitet."/>
      {s!.narration.trim()&&<div className={styles.releaseBar}><AudiencePicker value={audienceOf('narration:'+s!.id)} onChange={setAudience('narration:'+s!.id)} crew={crew} label="Erzählung"/><div className={styles.actions}><button type="button" className={styles.primary} disabled={busy||invalid(audienceOf('narration:'+s!.id))} onClick={()=>void release(s!.id)}><Eye/> {shared?'Erneut freigeben':'Erzählung freigeben'}</button>{snapshot?.sceneEventId&&<button type="button" disabled={busy} onClick={()=>void run({action:'hideScene',eventId:snapshot.sceneEventId},null,'Erzählung zurückgezogen.')}><EyeOff/> Erzählung zurückziehen</button>}</div></div>}
     </section>}
     {textArea==='atmosphere'&&<section className={styles.textArea} aria-label="Atmosphäre"><h3>Atmosphäre</h3><Text value={s!.atmosphere} empty="Keine Atmosphäre vorbereitet."/></section>}
     {textArea==='dialogue'&&<section className={styles.textArea} aria-label="Dialoge"><h3>Dialoge</h3><Text value={s!.dialogueNotes} empty="Keine Dialoghilfen."/>{context.npcs.filter(n=>n.cue.trim()).map(n=><article key={n.id} className={regieStyles.note}><h4>{n.title}</h4><Text value={n.cue} empty=""/></article>)}</section>}
     {textArea==='interactions'&&<section className={styles.textArea} aria-label="Interaktion"><h3>Interaktionen &amp; Notizen</h3><Text value={s!.interactions} empty="Keine Interaktionen beschrieben."/>{context.notes.map(n=><article key={n.id} className={regieStyles.note}><h4>{n.title}</h4><Text value={n.text} empty=""/></article>)}<CheckIssueForm key={s!.id} sceneId={s!.id} notes={context.notes} crew={crew} checksEnabled={!!snapshot?.checksEnabled} busy={busy} onIssue={(body,target)=>run(body,target,'Charakterprobe ausgegeben.')}/></section>}
     {textArea==='whispers'&&<PreparedWhisperReleases items={context.whispers||[]} sceneId={s!.id} version={s!.version} crew={crew} objects={objects} busy={busy} onCommand={body=>run(body,null)}/>}
     {textArea==='secrets'&&<section className={styles.textArea} aria-label="Geheimnisse"><h3>Geheimnisse · nur SL</h3><Text value={s!.secrets} empty="Keine Geheimnisse hinterlegt."/>{s!.visions.trim()&&<><h4>Visionen</h4><Text value={s!.visions} empty=""/></>}</section>}
     {textArea==='consequences'&&<section className={styles.textArea} aria-label="Folgen"><h3>Mögliche Folgen</h3><Text value={s!.possibleConsequences} empty="Keine Folgen vorbereitet."/>{s!.possibilities.map(p=><article key={p.id} className={regieStyles.note}><h4>{p.title}</h4><p>{p.text}</p></article>)}</section>}
     {textArea==='notes'&&<section className={styles.textArea} aria-label="SL-Notizen"><h3>SL-Notizen</h3><Text value={s!.gmNotes} empty="Keine SL-Notizen."/></section>}
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
    <Block title="Ambiente · YouTube" area="sound">
     <RegieAmbience youtube={snapshot?.youtube} sceneTracks={context.youtube||[]} sceneTitle={s!.title} actorId={a.id} busy={busy} run={(body,done)=>run(body,null,done||'')}/>
    </Block>
   </Column>

   <Column id="col-play" title="Spielfeld & Effekte" icon={<Clapperboard size={17}/>}>
    <Block title="Zustände der Runde" area="vitals">{snapshot?.vitals?<RegieVitals vitals={snapshot.vitals} crew={snapshot.crew} busy={busy} run={(body,done)=>run(body,null,done||'')}/>:<p className={regieStyles.empty}>Zustandswerte werden geladen …</p>}</Block>
    <Block title="Atmosphäre auf dem Tisch" area="effects">
     <div className={styles.effects}>{stageEffects.map(e=>{const Icon=effectIcons[e];return <button type="button" key={e} aria-pressed={effects.includes(e)} disabled={busy} onClick={()=>void toggleEffect(e)}><Icon/> {effectLabels[e]}</button>;})}</div>
     <div className={styles.effectRow}><label className={styles.check}><input type="checkbox" checked={crossfade} onChange={e=>setCrossfade(e.target.checked)}/> Überblenden: Wahl ersetzt laufende Effekte</label>{!!effects.length&&<button type="button" disabled={busy} onClick={()=>void run({action:'effects',effects:[]},null,'Alle Effekte blenden aus.')}><Square/> Alle beenden</button>}</div>
     <p className={regieStyles.empty}>Gilt für die ganze Runde. Effekte blenden weich ein und aus. Bei „Bewegung reduzieren“ bleiben sie ruhig stehen; Blitze und Flackern entfallen dann.</p>
    </Block>
    <Block title="Hintergrund">
     <p className={regieStyles.state} data-placed={!!snapshot?.backdrop}>Jetzt: {snapshot?.backdrop?.title||'Standardbühne'}</p>
     <BackdropChoice current={snapshot?.backdrop?.fileId||''} busy={busy} onChoose={fileId=>void run({action:'backdrop',fileId},null,'Hintergrund gewechselt.')}
      sceneImages={context.backdrop?[{id:context.backdrop.fileId,title:'Szenenbild · '+context.backdrop.name}]:[]}/>
     {snapshot?.backdrop&&<button type="button" disabled={busy} onClick={()=>void run({action:'backdrop',fileId:null},null,'Standardbühne.')}><RotateCcw/> Standardbühne</button>}
    </Block>
    <Block title="NPCs der Szene" area="npcs">{context.npcs.length?context.npcs.map(n=>{const placed=objects.find(o=>o.kind==='npc'&&o.sourceId===n.id),key='npc:'+n.id,target=audienceOf(key),onTable=placed&&placed.visibility==='group';return <article key={n.id} className={styles.item} data-npc={n.id}>
     <img className={styles.portrait} src={n.image} alt="" loading="lazy" onError={e=>{e.currentTarget.style.visibility='hidden';}}/>
     <div className={styles.itemBody}><h3>{n.title}</h3>{n.summary&&<p className={styles.summary}>{n.summary}</p>}<p className={regieStyles.state} data-placed={!!onTable}>{tableState(placed)}</p>
      {n.gmBody.trim()&&<details className={styles.secret}><summary>SL-Wissen</summary><Text value={n.gmBody} empty=""/></details>}
      <AudiencePicker value={target} onChange={setAudience(key)} crew={crew} label={n.title}/>
      <div className={styles.actions}><button type="button" className={styles.primary} disabled={busy||invalid(target)} onClick={()=>void place(key,n.id,'entity',undefined,'npc')}><UserPlus/> {onTable?'Freigabe ändern':'Auftreten lassen'}</button>{placed?<button type="button" disabled={busy} onClick={()=>void run({action:'remove',id:placed.id},null,n.title+' tritt ab.')}><UserMinus/> Abtreten</button>:<button type="button" disabled={busy} onClick={()=>void run({action:'add',kind:'npc',sourceId:n.id,sourceKind:'entity'},null,n.title+' liegt nur für dich auf dem Tisch.')}><Lock/> Nur SL auflegen</button>}</div>
     </div></article>;}):<p className={regieStyles.empty}>Keine NPCs mit dieser Szene verknüpft.</p>}</Block>
    <Block title={'Pager · vorbereitet ('+(context.pagers?.length||0)+')'} area="pager">
     {context.pagers?.length?<ul className={styles.preparedPagers} aria-label="Vorbereitete Pager">{context.pagers.map(p=>{const sent=sentPagers.find(x=>x.id===p.id),target=preparedAudience(p),missing=p.recipientIds.filter(id=>!crew.some(m=>m.id===id)).length,ready=!!p.text.trim();return <li key={p.id} data-prepared-pager={p.id} data-sent={!!sent}>
      <div className={styles.pagerCard}><small>{p.priority==='hoch'?'!! DRINGEND · ':''}{p.sender||'Ohne Absender'}</small>{p.title&&<strong>{p.title}</strong>}<p>{p.text||'Noch kein Pager-Text vorbereitet.'}</p></div>
      {p.cue.trim()&&<details className={styles.secret}><summary>Einsatz (nur SL)</summary><Text value={p.cue} empty=""/></details>}
      {sent?<><p className={regieStyles.state} data-placed="true">Gesendet {pagerTime(sent.at)} an {audienceText(sent.recipients??null,crew)}</p><p className={regieStyles.state} data-pager-acks="">{ackText(sent)}</p>
       <div className={styles.actions}><button type="button" disabled={busy} onClick={()=>void run({action:'pagerWithdraw',id:p.id},null,'Pager zurückgezogen. Er kann erneut ausgespielt werden.')}><Undo2/> Zurückziehen</button></div></>
      :<>{missing>0&&<p className={regieStyles.empty} role="note">{missing===1?'Ein vorgesehener Empfänger ist':missing+' vorgesehene Empfänger sind'} nicht in dieser Runde.</p>}
       <AudiencePicker value={target} onChange={setAudience('pager:'+p.id)} crew={crew} label={p.title||'Vorbereiteter Pager'}/>
       <div className={styles.actions}><button type="button" className={styles.primary} disabled={busy||!ready||invalid(target)} onClick={()=>void playPrepared(p)}><Send/> Ausspielen</button><button type="button" disabled={!ready} onClick={()=>setPagerTest({id:'test-'+p.id+'-'+Date.now(),at:new Date().toISOString(),sender:p.sender,title:p.title,text:p.text,priority:p.priority,recipients:null})}><BellRing/> An mich testen</button></div></>}
     </li>;})}</ul>:<p className={regieStyles.empty}>Für diese Szene sind keine Pager vorbereitet. Vorbereiten lassen sie sich im Command Center unter „Material“ → „Szenenbausteine“ → Szene auswählen → „Pager-Nachricht“.</p>}
    </Block>
    <Block title="Pager · spontan">
     <form className={styles.pager} onSubmit={e=>{e.preventDefault();sendSpontaneous();}}>
      <div className={styles.pagerMeta}><label>Absender (im Spiel)<input aria-label="Pager-Absender" maxLength={pagerSenderMax} value={pagerSender} onChange={e=>{const v=e.target.value;draft(()=>setPagerSender(v));}} placeholder="z. B. Unbekannt"/></label><label>Titel<input aria-label="Pager-Titel" maxLength={pagerTitleMax} value={pagerTitle} onChange={e=>{const v=e.target.value;draft(()=>setPagerTitle(v));}} placeholder="optional"/></label></div>
      <label>Nachricht<textarea aria-label="Pager-Nachricht" maxLength={pagerTextMax} rows={3} value={pagerText} onChange={e=>{const v=e.target.value;draft(()=>setPagerText(v));}} placeholder="z. B. RUF MICH AN · 0281-1922"/></label>
      <div className={styles.pagerRow}><label className={styles.check}><input type="checkbox" checked={pagerUrgent} onChange={e=>{const v=e.target.checked;draft(()=>setPagerUrgent(v));}}/> Dringend</label><small>{pagerText.length}/{pagerTextMax}</small></div>
      <AudiencePicker value={pagerTarget} onChange={v=>draft(()=>setAudience('pager')(v))} crew={crew} label="Pager"/>
      <div className={styles.actions}><button type="submit" className={styles.primary} disabled={busy||!pagerText.trim()||invalid(pagerTarget)}><Send/> Pager senden</button>
       <button type="button" disabled={!pagerText.trim()} onClick={()=>setPagerTest({id:'test-'+Date.now(),at:new Date().toISOString(),sender:pagerSender,title:pagerTitle,text:pagerText,priority:pagerUrgent?'hoch':'normal',recipients:null})}><BellRing/> An mich testen</button></div>
     </form>
     {pagerTest&&<PagerSelfTest message={pagerTest} actorId={a.id} onClose={()=>setPagerTest(null)}/>}
     {!!sentPagers.length&&<ul className={styles.compact} aria-label="Gesendete Pager">{[...sentPagers].reverse().map(p=><li key={p.id}><span>{p.priority==='hoch'&&<b>Dringend · </b>}{p.title&&<b>{p.title}: </b>}{p.text}<small>{p.origin==='vorbereitet'?'vorbereitet · ':''}{p.sender?'von '+p.sender+' · ':''}an {audienceText(p.recipients??null,crew)} · {pagerTime(p.at)}</small><small data-pager-acks="">{ackText(p)}</small></span><button type="button" aria-label="Pager zurückziehen" disabled={busy} onClick={()=>void run({action:'pagerWithdraw',id:p.id},null,'Pager zurückgezogen.')}><Undo2/></button></li>)}</ul>}
    </Block>
    <Block title={'Auf dem Tisch ('+objects.length+')'} open={false} area="table">{objects.length?<ul className={styles.compact}>{objects.map(o=><li key={o.id}><span>{o.title}<small>{tableState(o)}</small></span><button type="button" aria-label={o.title+' vom Tisch nehmen'} disabled={busy} onClick={()=>void run({action:'remove',id:o.id})}><EyeOff/></button></li>)}</ul>:<p className={regieStyles.empty}>Der Tisch ist leer.</p>}</Block>
   </Column>
  </main>}
  <dialog ref={previewDialog} className={regieStyles.preview} aria-label="Private Vorschau" onClose={()=>setPreview(null)}>{preview&&<><header><div><small>PRIVATE VORSCHAU · NUR SL</small><h2>{preview.title}</h2></div><button aria-label="Vorschau schließen" onClick={()=>previewDialog.current?.close()}><X/></button></header>
   <div>{preview.mime.startsWith('image/')?<img src={fileUrl(preview.fileId)} alt={preview.title}/>:preview.mime.startsWith('audio/')?<audio controls src={fileUrl(preview.fileId)}/>:preview.mime.startsWith('video/')?<video controls playsInline src={fileUrl(preview.fileId)}/>:<LivePdf url={fileUrl(preview.fileId)} name={preview.name}/>}
   {preview.text.trim()&&<Text value={preview.text} empty=""/>}</div></>}</dialog>
 </div>;
}
