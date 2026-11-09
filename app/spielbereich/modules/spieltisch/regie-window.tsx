"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated GM media must never use a public optimization proxy. */
import {DeliveryDesk} from './delivery-desk';
import {memo,useCallback,useEffect,useRef,useState} from 'react';
import {Eye,EyeOff,Lock,Clapperboard,Image as ImageIcon,FileText,Music,Film,Search,X,RotateCcw,CloudRain,CloudFog,CloudLightning,Snowflake,Flame,Moon,Lightbulb,UserPlus,UserMinus,Send,Undo2,MonitorPlay,Minus,Plus,Square,Radio,BookOpen,Users,LayoutGrid as LayoutGridIcon,ChevronUp,MoonStar,FlameKindling,Sparkles} from 'lucide-react';
import type {Actor} from '@/domain/types';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import {pagerTextMax,pagerTitleMax,pagerSenderMax,stageEffects,type StageEffect} from '@/domain/live-stage';
import {api,ApiError} from '../api-client';
import {RichTextView} from '../rich-text';
import {LivePdf} from '../live-pdf';
import {BackdropChoice,tableState} from './regie';
import {RegieFigures} from './regie-figures';
import {Block,useRegieLayout} from './regie-tiles';
import {RegieStudio} from './regie-studio';
import {regieAreaLabels} from '@/domain/regie-studio';
import type {PreparedFigure} from '@/domain/standard-figures';
import {sendStageCommand,type Audience} from './stage-client';
import {effectLabels} from './atmosphere';
import {TableMaterialLibrary} from '../table-material-library';
import {RegieVitals} from './regie-vitals';
import {RegiePlayers} from './regie-players';
import {presenceLabels} from '@/domain/live-participants';
import {RegieAmbience,RegieScenePlaylist} from './regie-ambience';
import {RegieMaterials} from '../material/regie-materials';
import type {RegieContext,Snapshot,StageObject,PreparedPager,PagerMessage} from './types';
import {PagerSelfTest} from './ultio-pager';
import {BellRing} from 'lucide-react';
import regieStyles from './regie.module.css';
import styles from './regie-window.module.css';
import {ThumbImage} from '../file-thumb';
import {CheckDesk,ChecksSwitch} from './check-issue-form';
import {pendingTargets,isTablePlayer} from '@/domain/live-checks';

type Media=RegieContext['media'][number];
type Crew=Snapshot['crew'];
type Room={sessionId:string;runId:string};
const fileUrl=(id:string)=>'/api/files?id='+encodeURIComponent(id);
const stageUrl=(sessionId:string,catalog=false)=>'/api/live-stage?sessionId='+encodeURIComponent(sessionId)+(catalog?'&catalog=1':'');

/** Who receives one release: the whole round or chosen players. Every item keeps its own choice. */
type CampaignCrew=NonNullable<Snapshot['campaignCrew']>;

function CampaignMenu({members,failed=false}:{members?:CampaignCrew;failed?:boolean}){
 return <details className={styles.headerMenu}>
    <summary aria-label={'Kampagnenmitglieder'+(members?' ('+members.length+')':'')} title="Kampagnenmitglieder"><Users size={15}/> Kampagne{members&&' ('+members.length+')'}</summary>
    <div className={styles.menuBody}>
     {!members?<span>{failed?'Teilnehmende konnten nicht geladen werden.':'Teilnehmende werden geladen …'}</span>:members.length===0?<span>Keine aktiven Mitglieder</span>:
      <ul className={styles.crew} aria-label="Kampagnenmitglieder">
       {members.map(member=><li key={member.id} data-presence={member.presence}>
        <strong>{member.name}</strong><small>{member.gm?'SL · ':''}{member.presence==='connected'?'Am Tisch':member.presence==='afk'?'Am Tisch · abwesend':'Nicht am Tisch'}</small>
       </li>)}
      </ul>}
    </div>
   </details>;
}

function AudiencePicker({value,onChange,crew,label}:{value:Audience;onChange:(v:Audience)=>void;crew:Crew;label:string}){
 return <div className={styles.audience} role="group" aria-label={'Empfänger: '+label}>
  <button type="button" aria-pressed={value===null} onClick={()=>onChange(null)}>Alle</button>
  {crew.map(m=><button type="button" key={m.id} aria-pressed={value!==null&&value.includes(m.id)} onClick={()=>onChange(value===null?[m.id]:value.includes(m.id)?value.filter(id=>id!==m.id):[...value,m.id])}>{m.name}</button>)}
  {value!==null&&!value.length&&<small role="status">Niemand gewählt</small>}
 </div>;
}
const pagerTime=(at:string)=>new Date(at).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
const audienceText=(v:Audience,crew:Crew)=>v===null?'alle':v.map(id=>crew.find(m=>m.id===id)?.name||'?').join(', ')||'niemand';

const spontaneousPagerArea='Pager · spontan';
// Preserve the former title-based tile id so saved hidden/order/width preferences still apply.
const sceneMaterialArea='Szenenmaterial';
type RegieArea=string;
const areaKey=(actorId:string)=>'chroniplay:regie-bereich:'+actorId;
const effectIcons:Record<StageEffect,typeof CloudRain>={
 rain:CloudRain,fog:CloudFog,storm:CloudLightning,snow:Snowflake,embers:Flame,
 darkness:Moon,flicker:Lightbulb,moonlight:MoonStar,candlelight:FlameKindling,ritualglow:Sparkles,
};
const Text=memo(function Text({value,empty}:{value:string;empty:string}){return value.trim()?<RichTextView value={value} readable flowing className={styles.studioProse}/>:<p className={regieStyles.empty}>{empty}</p>;});

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
 const [waitingCrew,setWaitingCrew]=useState<CampaignCrew>();
 const [rosterFailed,setRosterFailed]=useState(false);
 const [toolbar,setToolbar]=useState<HTMLDivElement|null>(null);
 const layout=useRegieLayout('chroniplay:regie-layout:'+a.campaignId+':'+a.id);
 const revealTile=layout.reveal;
 const [area,setArea]=useState<RegieArea>('narration'),[crossfade,setCrossfade]=useState(false);
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

 useEffect(()=>{
  if(room)return;
  let current=true;
  const refreshRoster=()=>void api<{members:Omit<CampaignCrew[number],'presence'>[]}>('/api/members?view=regie-roster').then(({members})=>{
   if(!current)return;
   setWaitingCrew(members.map(member=>({...member,presence:'disconnected'})));
   setRosterFailed(false);
  }).catch(()=>{if(current)setRosterFailed(true);});
  refreshRoster();
  window.addEventListener('focus',refreshRoster);
  return()=>{current=false;window.removeEventListener('focus',refreshRoster);};
 },[room]);

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
  if(!room||!sceneId)return;let current=true,loading=false;
  const load=()=>{if(loading)return;loading=true;void api<RegieContext>(stageUrl(room.sessionId)+'&regie='+encodeURIComponent(sceneId)).then(c=>{if(current){setContexts(old=>({...old,[sceneId]:c}));setContextError(null);}}).catch(e=>{if(current)setContextError({id:sceneId,message:(e as Error).message});}).finally(()=>{loading=false;});};
  if(!known)load();
  // Returning from preparation refreshes the same scene without discarding the reading workspace.
  window.addEventListener('focus',load);
  return()=>{current=false;window.removeEventListener('focus',load);};
 },[room,sceneId,known]);
 useEffect(()=>{if(preview&&!previewDialog.current?.open)previewDialog.current?.showModal();},[preview]);
 useEffect(()=>{try{const v=Number(window.localStorage.getItem('chroniplay:regie-textgroesse:'+a.id));if([.9,1,1.15,1.3,1.5].includes(v))queueMicrotask(()=>setTextSize(v));}catch{/* storage unavailable */}},[a.id]);
 useEffect(()=>{try{const saved=window.localStorage.getItem(areaKey(a.id));if(saved&&Object.hasOwn(regieAreaLabels,saved))queueMicrotask(()=>setArea(saved));}catch{/* storage unavailable */}},[a.id]);
 /** Changes presentation only. Releases still require an explicit existing stage command. */
 const checksOn=!!snapshot?.checksEnabled,checksShown=checksOn||!!snapshot?.checksSwitch;
 const openTargets=checksOn?pendingTargets(snapshot?.checks||[],snapshot?.dice.events||[],(snapshot?.crew||[]).filter(isTablePlayer).map(m=>m.id)):0;
 const chooseArea=useCallback((id:RegieArea)=>{
  setArea(id);try{window.localStorage.setItem(areaKey(a.id),id);}catch{/* storage unavailable */}
  revealTile(id);
 },[a.id,revealTile]);
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

 if(!room)return <main className={styles.waiting}><p className={styles.eyebrow}>CHRONIPLAY · REGIE</p><h1>Live-Regie</h1><p role="status">{waiting||'Spielabend wird gesucht …'}</p><p>Starte den Spielabend am Spieltisch. Diese Regie verbindet sich dann von selbst.</p><CampaignMenu members={waitingCrew} failed={rosterFailed}/></main>;

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
 const sceneTracks=context?.youtube||[];
 const fileTracks=[
  ...sceneAudio.map(m=>({id:m.fileId,title:m.title})),
  ...catalogAudio.filter(o=>!sceneAudio.some(m=>m.fileId===o.id)).map(o=>({id:o.id,title:o.title})),
 ];
 const fileMusic=snapshot?.music;
 const ambience=snapshot?.youtube;
 const hasMusic=Boolean(fileMusic||ambience);
 const musicLabel=fileMusic&&ambience?'2 Musikquellen':fileMusic?.title||ambience?.title||'Keine Musik';
 const effectLabel=effects.length===0?'Keine Effekte':effects.length===1?effectLabels[effects[0]]:effects.length+' Effekte aktiv';
 const musicTracks=<ul className={styles.compact} aria-label="Audiodateien für Hintergrundmusik">
  {fileTracks.map(track=><li key={track.id} data-active={fileMusic?.fileId===track.id}>
   <span>{track.title}</span>
   <button type="button" disabled={busy} onClick={()=>void run({action:'music',fileId:track.id},null,'Musik läuft: '+track.title)}>
    {fileMusic?.fileId===track.id?<><RotateCcw/> Neu starten</>:<><Music/> Als Musik</>}
   </button>
  </li>)}
 </ul>;
 const effectControls=<div className={styles.effectControls}>
  <div className={styles.effects}>{stageEffects.map(effect=>{
   const Icon=effectIcons[effect];
   return <button type="button" key={effect} aria-pressed={effects.includes(effect)} disabled={busy} onClick={()=>void toggleEffect(effect)}>
    <Icon/> {effectLabels[effect]}
   </button>;
  })}</div>
  <div className={styles.effectRow}>
   <label className={styles.check}><input type="checkbox" checked={crossfade} onChange={e=>setCrossfade(e.target.checked)}/> Überblenden statt kombinieren</label>
   <button type="button" disabled={busy||!effects.length} onClick={()=>void run({action:'effects',effects:[]},null,'Alle Effekte blenden aus.')}>
    <Square/> Alle beenden
   </button>
  </div>
 </div>;

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
   {context&&<div ref={setToolbar}/>}
   <CampaignMenu members={snapshot?.campaignCrew||waitingCrew}/>
   <p className={styles.sync} role="status" data-fresh={!!snapshot&&!offline}><Radio size={13}/> {offline?'Verbindung gestört – versuche erneut':snapshot?'Live verbunden':'Verbinde …'}</p>
    <button type="button" className={styles.tableLink} title="Zum Spieltisch" onClick={()=>{if(window.opener&&!window.opener.closed)window.opener.focus();else window.open('/spielbereich?bereich=sitzung','_blank');}}><BookOpen size={15}/> Zum Spieltisch</button>
  </header>
  {(error||notice)&&<div className={error?styles.error:styles.notice} role={error?'alert':'status'}>{error||notice}<button type="button" aria-label="Meldung schließen" onClick={()=>{setError('');setNotice('');}}><X size={14}/></button></div>}
  {!context?<main className={styles.loading}>{snapshot&&<TableMaterialLibrary a={a} compact live={{snapshot,busy,command:body=>run(body)}}/>}{contextError?.id===sceneId?<p role="alert">{contextError.message}</p>:sceneId?<p role="status">Regie wird geladen …</p>:<p>Diesem Spielabend ist noch keine Szene zugeordnet. Wähle oben eine Szene der Kampagne.</p>}</main>:
   <main className={styles.studioHost} data-scene={s!.id}><RegieStudio presence={<section className={styles.presence} aria-label="Spieler am Tisch"><h3>Am Tisch</h3>{(snapshot?.crew||[]).length?<ul>{(snapshot?.crew||[]).map(m=><li key={m.id} data-state={m.presence}><span aria-hidden="true"/>{m.name}<small>{presenceLabels[m.presence]}</small></li>)}</ul>:<p>Noch niemand am Tisch.</p>}</section>} state={layout} toolbar={toolbar} area={area} onArea={chooseArea} contextKey={a.campaignId+':'+a.id+':'+s!.id} sceneTitle={s!.title} place={context.place?.title} pending={openTargets}
    editUrl={'/sl/command-center?bereich=sitzung&scene='+encodeURIComponent(s!.id)}
    readingTools={<div className={styles.textTools}><div role="group" aria-label="Textgröße der Regie"><button type="button" aria-label="Text kleiner" disabled={textSize<=.9} onClick={()=>resize(-1)}><Minus size={14}/></button><span>{Math.round(textSize*100)} %</span><button type="button" aria-label="Text größer" disabled={textSize>=1.5} onClick={()=>resize(1)}><Plus size={14}/></button></div></div>}
    prepared={(context.materials||[]).map(m=>({id:m.elementId,title:m.title,area:sceneMaterialArea}))}
    status={<>
     <div className={styles.quickMusic} role="group" aria-label="Musik am Tisch">
      <Popover>
       <PopoverTrigger asChild><button type="button" title={musicLabel} data-playing={hasMusic}>
        <Music aria-hidden="true"/><span>{musicLabel}</span><ChevronUp aria-hidden="true"/>
       </button></PopoverTrigger>
       <PopoverContent side="top" align="end" sideOffset={8} collisionPadding={10} className={styles.controlPopover} aria-label="Musiksteuerung">
        <h3>Musik am Tisch</h3>
        {fileMusic&&<p>Dateimusik: <strong>{fileMusic.title}</strong></p>}
        {ambience&&<p>{ambience.playing===false?'Ambiente pausiert:':'Ambiente:'} <strong>{ambience.title}</strong></p>}
        {!hasMusic&&<p className={styles.muted}>Am Tisch läuft gerade keine Musik.</p>}
        <RegieScenePlaylist sceneTracks={sceneTracks} sceneTitle={s!.title} busy={busy} run={(body,done)=>run(body,null,done)}/>
        {fileTracks.length>0&&<div className={styles.ambienceGroup}><h4>Hintergrundmusik</h4>{musicTracks}</div>}
        {!sceneTracks.length&&!fileTracks.length&&<p className={styles.muted}>Keine Musikdateien oder Szenenplaylist verfügbar.</p>}
       </PopoverContent>
      </Popover>
      <button type="button" className={styles.quickStop} aria-label="Musik für alle stoppen" title="Musik für alle stoppen" disabled={busy||!hasMusic}
       onClick={()=>void run({action:'stopMusic'},null,'Musik für alle gestoppt.')}><Square aria-hidden="true"/></button>
     </div>
     <Popover>
      <PopoverTrigger asChild><button type="button" title={effects.length?effects.map(effect=>effectLabels[effect]).join(', '):effectLabel}>
       <CloudFog aria-hidden="true"/><span>{effectLabel}</span><ChevronUp aria-hidden="true"/>
      </button></PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={8} collisionPadding={10} className={styles.controlPopover} aria-label="Tischeffekte">
       <h3>Tischeffekte</h3>
       {effectControls}
      </PopoverContent>
     </Popover>
     <span><LayoutGridIcon/>{objects.length} auf dem Tisch</span>
    </>}>

    <Block title="Szenenmaterialien" area={sceneMaterialArea}>
     <p>Aus der Kommandozentrale für die ausgewählte Szene vorbereitet.</p>
     {context.materials?.length?<RegieMaterials heading={false} materials={context.materials} objects={snapshot?.objects||[]} crew={crew} busy={busy} run={(body,done)=>run(body,null,done)}/>:<p className={regieStyles.empty}>Für diese Szene ist noch kein Szenenmaterial vorbereitet.</p>}
    </Block>
    {snapshot&&<Block title="Spontanmaterialien" area="material"><p>Eigene Materialvorlagen für spontane Einsätze, unabhängig von der ausgewählten Szene.</p><TableMaterialLibrary a={a} compact live={{snapshot,busy,command:body=>run(body)}}/></Block>}
    <Block title="Standardfiguren" area="figures"><RegieFigures sessionId={room!.sessionId} prepared={(context.scene.standardFigures||[]) as PreparedFigure[]} busy={busy} dice={snapshot?.dice?.events||[]} actorId={a.id} run={(body,recipients,done)=>run(body,recipients,done)} table={f=>{const sid='standard-figure:'+room!.sessionId+':'+f.id,placed=objects.find(o=>o.kind==='npc'&&o.sourceId===sid),key='npc:'+sid,target=audienceOf(key),onTable=placed&&placed.visibility==='group';return <div style={{display:'grid',gap:6}} data-figure-table={f.id}><p className={regieStyles.state} data-placed={!!onTable}>{tableState(placed)}</p>{!f.imageFileId&&<p className={regieStyles.empty}>Wähle unter „Werte, Verhalten, Bild“ zuerst ein Bild, um die Figur auf den Tisch zu spielen.</p>}<AudiencePicker value={target} onChange={setAudience(key)} crew={crew} label={f.label}/><div className={styles.actions}><button type="button" className={styles.primary} disabled={busy||invalid(target)||!f.imageFileId} onClick={()=>void place(key,sid,'record',undefined,'npc')}><UserPlus/> {onTable?'Freigabe ändern':'Auftreten lassen'}</button>{placed?<button type="button" disabled={busy} onClick={()=>void run({action:'remove',id:placed.id},null,f.label+' tritt ab.')}><UserMinus/> Abtreten</button>:<button type="button" disabled={busy||!f.imageFileId} onClick={()=>void run({action:'add',kind:'npc',sourceId:sid,sourceKind:'record'},null,f.label+' liegt nur für dich auf dem Tisch.')}><Lock/> Nur SL auflegen</button>}</div></div>;}}/></Block>
    {!!sceneMedia.filter(m=>m.mime.startsWith('image/')).length&&<Block title="Bilder · Polaroids" area="images">{sceneMedia.filter(m=>m.mime.startsWith('image/')).map(m=>media(m,ImageIcon,'image'))}</Block>}
    {!!sceneMedia.filter(m=>m.mime==='application/pdf').length&&<Block title="Dokumente · PDF" area="pdfs">{sceneMedia.filter(m=>m.mime==='application/pdf').map(m=>media(m,FileText,'pdf'))}</Block>}
    {!!context.handouts.length&&<Block title="Handout-Akten" area="handouts">{context.handouts.map(h=>{const placed=objects.find(o=>o.kind==='document'&&o.sourceKind===(h.sourceKind||'entity')&&o.sourceId===h.id),key='entity:'+h.id,target=audienceOf(key);return <article key={h.id} className={styles.item}><div className={styles.fileIcon}><FileText/></div><div className={styles.itemBody}><h3>{h.title}</h3>{h.stageable?<><p className={regieStyles.state} data-placed={!!placed}>{tableState(placed)}</p><AudiencePicker value={target} onChange={setAudience(key)} crew={crew} label={h.title}/><div className={styles.actions}><button type="button" className={styles.primary} disabled={busy||invalid(target)} onClick={()=>void place(key,h.id,h.sourceKind||'entity')}><Eye/> {placed?'Freigabe ändern':'Auf den Tisch'}</button>{placed?<button type="button" disabled={busy} onClick={()=>void run({action:'remove',id:placed.id},null,'Vom Tisch genommen.')}><EyeOff/> Vom Tisch</button>:<button type="button" disabled={busy} onClick={()=>void run({action:'add',kind:'document',sourceId:h.id,sourceKind:h.sourceKind||'entity'},null,'Nur für dich aufgelegt; noch nicht freigegeben.')}><Lock/> Nur SL auflegen</button>}</div></>:<p className={regieStyles.empty}>Hinweisakte – Freigabe über die Spielwelt.</p>}</div></article>;})}</Block>}



     <Block title="Erzählung" area="narration"><div style={{fontSize:textSize+'em'}} data-text-area="narration"><section className={styles.narration} aria-label="Erzählung">
      <header><h3>{s!.title}</h3>{context.place&&<small>Schauplatz: {context.place.title}</small>}<p className={regieStyles.state} data-placed={shared}>{shared?'Für die Runde freigegeben':'Noch nicht freigegeben'}</p></header>
      <Text value={s!.narration} empty="Kein Erzähltext vorbereitet."/>
      {s!.narration.trim()&&<div className={styles.releaseBar}><AudiencePicker value={audienceOf('narration:'+s!.id)} onChange={setAudience('narration:'+s!.id)} crew={crew} label="Erzählung"/><div className={styles.actions}><button type="button" className={styles.primary} disabled={busy||invalid(audienceOf('narration:'+s!.id))} onClick={()=>void release(s!.id)}><Eye/> {shared?'Erneut freigeben':'Erzählung freigeben'}</button>{snapshot?.sceneEventId&&<button type="button" disabled={busy} onClick={()=>void run({action:'hideScene',eventId:snapshot.sceneEventId},null,'Erzählung zurückgezogen.')}><EyeOff/> Erzählung zurückziehen</button>}</div></div>}</section></div></Block>
     <Block title="Atmosphäre" area="atmosphere"><div style={{fontSize:textSize+'em'}} data-text-area="atmosphere"><section className={styles.textArea} aria-label="Atmosphäre"><h3>Atmosphäre</h3><Text value={s!.atmosphere} empty="Keine Atmosphäre vorbereitet."/></section></div></Block>
     <Block title="Dialoge" area="dialogue"><div style={{fontSize:textSize+'em'}} data-text-area="dialogue"><section className={styles.textArea} aria-label="Dialoge"><h3>Dialoge</h3><Text value={s!.dialogueNotes} empty="Keine Dialoghilfen."/>{context.npcs.filter(n=>n.cue.trim()).map(n=><article key={n.id} className={regieStyles.note}><h4>{n.title}</h4><Text value={n.cue} empty=""/></article>)}</section></div></Block>
     <Block title="Interaktion" area="interactions"><div style={{fontSize:textSize+'em'}} data-text-area="interactions"><section className={styles.textArea} aria-label="Interaktion"><h3>Interaktionen &amp; Notizen</h3><Text value={s!.interactions} empty="Keine Interaktionen beschrieben."/>{context.notes.map(n=><article key={n.id} className={regieStyles.note}><h4>{n.title}</h4><Text value={n.text} empty=""/></article>)}{snapshot?.checksEnabled&&context.notes.some(n=>n.kind==='check')&&<button type="button" className={styles.primary} onClick={()=>chooseArea('checks')}>Vorbereitete Proben ausgeben</button>}</section></div></Block>
     {checksShown&&<Block title="Proben" area="checks"><div style={{fontSize:textSize+'em'}} data-text-area="checks"><section className={styles.textArea} aria-label="Proben"><h3>Proben</h3>{snapshot?.checksSwitch&&<ChecksSwitch on={snapshot.checksSwitch.on} busy={busy} onSwitch={(body,target)=>run(body,target,snapshot.checksSwitch?.on?'Charakterproben ausgeschaltet.':'Charakterproben eingeschaltet.')}/>}<CheckDesk sceneId={s!.id} notes={context.notes} crew={crew} figures={snapshot?.vitals?.round} checks={snapshot?.checks||[]} events={snapshot?.dice.events||[]} checksEnabled={!!snapshot?.checksEnabled} busy={busy} onIssue={(body,target)=>run(body,target,'Probe ausgegeben.')}/></section></div></Block>}
     <Block title="Visionen & Briefe" area="whispers"><div style={{fontSize:textSize+'em'}} data-text-area="whispers"><DeliveryDesk items={context.whispers||[]} sceneId={s!.id} version={s!.version} sessionId={room!.sessionId} crew={crew} objects={objects} onCommand={body=>run(body,null)}/></div></Block>
     <Block title="Geheimnisse" area="secrets"><div style={{fontSize:textSize+'em'}} data-text-area="secrets"><section className={styles.textArea} aria-label="Geheimnisse"><h3>Geheimnisse · nur SL</h3><Text value={s!.secrets} empty="Keine Geheimnisse hinterlegt."/>{s!.visions.trim()&&<><h4>Visionen</h4><Text value={s!.visions} empty=""/></>}</section></div></Block>
     <Block title="Folgen" area="consequences"><div style={{fontSize:textSize+'em'}} data-text-area="consequences"><section className={styles.textArea} aria-label="Folgen"><h3>Mögliche Folgen</h3><Text value={s!.possibleConsequences} empty="Keine Folgen vorbereitet."/>{s!.possibilities.map(p=><article key={p.id} className={regieStyles.note}><h4>{p.title}</h4><p>{p.text}</p></article>)}</section></div></Block>
     <Block title="SL-Notizen" area="notes"><div style={{fontSize:textSize+'em'}} data-text-area="notes"><section className={styles.textArea} aria-label="SL-Notizen"><h3>SL-Notizen</h3><Text value={s!.gmNotes} empty="Keine SL-Notizen."/></section></div></Block>


    <Block title="Tonaufnahmen · Kassette" area="recordings">{sceneAudio.length?sceneAudio.map(m=>media(m,Music,'audio')):<p className={regieStyles.empty}>Keine Tonaufnahme mit dieser Szene verknüpft.</p>}</Block>
    <Block title="Video · Röhrenbildschirm" area="video">{sceneVideo.length?sceneVideo.map(m=>media(m,Film,'video')):<p className={regieStyles.empty}>Kein Video mit dieser Szene verknüpft.</p>}</Block>
    <Block title="Hintergrundmusik" area="music">
     <p className={regieStyles.state} data-placed={!!snapshot?.music}>{snapshot?.music?'Läuft für alle: '+snapshot.music.title:'Keine Musik'}</p>
     <p className={regieStyles.empty}>Jede Person regelt Lautstärke und Stummschaltung selbst. Blockiert ein Browser den Start, erscheint dort „Musik abspielen“.</p>
     {musicTracks}
     {snapshot?.music&&<button type="button" disabled={busy} onClick={()=>void run({action:'music',fileId:null},null,'Musik gestoppt.')}><Square/> Musik stoppen</button>}
    </Block>
    <Block title="Ambiente · YouTube" area="sound">
     <RegieAmbience youtube={snapshot?.youtube} sceneTracks={context.youtube||[]} sceneTitle={s!.title} actorId={a.id} busy={busy} run={(body,done)=>run(body,null,done||'')}/>
    </Block>


    <Block title="Spieler & Charaktere" area="players"><RegiePlayers a={a} sessionId={room!.sessionId} vitals={snapshot?.vitals} busy={busy} run={payload=>run({action:'vitals',...payload},null,'')}/></Block>
    <Block title="Zustände der Runde" area="vitals">{snapshot?.vitals?<RegieVitals vitals={snapshot.vitals} crew={snapshot.crew} busy={busy} run={(body,done)=>run(body,null,done||'')}/>:<p className={regieStyles.empty}>Zustandswerte werden geladen …</p>}</Block>
    <Block title="Atmosphäre auf dem Tisch" area="effects">
     {effectControls}
     <p className={regieStyles.empty}>Gilt für die ganze Runde. Effekte blenden weich ein und aus. Bei „Bewegung reduzieren“ bleiben sie ruhig stehen; Blitze und Flackern entfallen dann.</p>
    </Block>
    <Block title="Hintergrund" area="backdrop">
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
    <Block title={spontaneousPagerArea} area={spontaneousPagerArea}>
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
    <Block title={'Auf dem Tisch ('+objects.length+')'} area="table"><p>Aktive Szene: {snapshot?.sceneInfo?.title||'Keine Erzählung freigegeben'}. {sentPagers.length} Pager ausgespielt.</p>{objects.length?<ul className={styles.compact}>{objects.map(o=><li key={o.id}><span>{o.title}<small>{o.visibility==='sl'?'Nur SL':o.recipients===null?'Ganze Runde':'Freigegeben für '+audienceText(o.recipients,crew)}</small></span><button type="button" aria-label={o.title+' vom Tisch nehmen'} disabled={busy} onClick={()=>void run({action:'remove',id:o.id})}><EyeOff/></button></li>)}</ul>:<p className={regieStyles.empty}>Der Tisch ist leer.</p>}</Block>

  </RegieStudio></main>}
  <dialog ref={previewDialog} className={regieStyles.preview} aria-label="Private Vorschau" onClose={()=>setPreview(null)}>{preview&&<><header><div><small>PRIVATE VORSCHAU · NUR SL</small><h2>{preview.title}</h2></div><button aria-label="Vorschau schließen" onClick={()=>previewDialog.current?.close()}><X/></button></header>
   <div>{preview.mime.startsWith('image/')?<img src={fileUrl(preview.fileId)} alt={preview.title}/>:preview.mime.startsWith('audio/')?<audio controls src={fileUrl(preview.fileId)}/>:preview.mime.startsWith('video/')?<video controls playsInline src={fileUrl(preview.fileId)}/>:<LivePdf url={fileUrl(preview.fileId)} name={preview.name}/>}
   {preview.text.trim()&&<Text value={preview.text} empty=""/>}</div></>}</dialog>
 </div>;
}
