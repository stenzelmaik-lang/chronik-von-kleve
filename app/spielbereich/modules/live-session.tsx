"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated contextual media must never use a public optimization proxy. */
import {useCallback,useEffect,useId,useRef,useState} from 'react';
import type {Actor} from '@/domain/types';
import type {LiveAudience,LiveEvent,LiveMedia} from '@/domain/live-game';
import type {SceneView,SceneSummary} from '@/domain/story-scene';
import {api,ApiError} from './api-client';
import {LiveTable} from './live-table';
import type {TableResult} from './use-table-screen';
import {RichTextView} from './rich-text';
import {DicePanel} from './dice';
import {LivePdf} from './live-pdf';
import {LocationQuickAccess} from './location-quick-access';
import styles from './live-session.module.css';
import {Spieltisch} from './spieltisch/stage';
type Snapshot=TableResult&{events:LiveEvent[];members:{id:string;name:string}[];unchanged?:boolean};
function Audience({value,onChange,members,disabled=false}:{value:LiveAudience;onChange:(a:LiveAudience)=>void;members:{id:string;name:string}[];disabled?:boolean}){
 const name=useId();
 return <fieldset className={styles.audience} disabled={disabled}><legend>Wer sieht das?</legend><label><input type="radio" name={name} checked={value.scope==='all'} onChange={()=>onChange({scope:'all'})}/> Alle in dieser Runde</label><label><input type="radio" name={name} checked={value.scope==='players'} onChange={()=>onChange({scope:'players',playerIds:[]})}/> Spieler auswählen</label>{value.scope==='players'&&<div>{members.map(member=><label key={member.id}><input type="checkbox" checked={value.playerIds.includes(member.id)} onChange={e=>onChange({scope:'players',playerIds:e.target.checked?[...value.playerIds,member.id]:value.playerIds.filter(id=>id!==member.id)})}/>{member.name}</label>)}</div>}</fieldset>;
}
function MediaView({file,url}:{file:LiveMedia;url:string}){
 if(file.mime.startsWith('image/'))return <img className={styles.media} src={url} alt={file.name}/>;
 if(file.mime.startsWith('audio/'))return <audio className={styles.media} src={url} controls aria-label={file.name}/>;
 if(file.mime.startsWith('video/'))return <video className={styles.media} src={url} controls playsInline aria-label={file.name}/>;
 return <LivePdf url={url} name={file.name}/>;
}
export function LiveSession({a}:{a:Actor}){
 const [stageOpen,setStageOpen]=useState(true);
 // Leaving the table in the player area goes straight back to the Zuflucht (4c), no in-between page.
 const exitStage=useCallback(()=>{setStageOpen(false);if(window.location.pathname.startsWith('/spielbereich')){const url=new URL(window.location.href);url.searchParams.set('bereich','dashboard');url.searchParams.delete('session');history.pushState(null,'',url);window.dispatchEvent(new PopStateEvent('popstate'));}},[]);
 const [sessionId,setSessionId]=useState(''),[selected,setSelected]=useState(''),[title,setTitle]=useState('Spielabend');
 const [data,setData]=useState<Snapshot|null>(null),[error,setError]=useState(''),[syncError,setSyncError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [catalog,setCatalog]=useState<{sessions:{id:string;title:string}[];scenes:SceneSummary[]}>({sessions:[],scenes:[]}),[sceneId,setSceneId]=useState(''),[scene,setScene]=useState<SceneView|null>(null);
 const [files,setFiles]=useState<LiveMedia[]>([]),[fileIds,setFileIds]=useState<string[]>([]),[mediaSearch,setMediaSearch]=useState('');
 const [scope,setScope]=useState<LiveAudience>({scope:'all'}),[rollScope,setRollScope]=useState<LiveAudience>({scope:'all'});
 const [tool,setTool]=useState<'scene'|'media'|'roll'>('scene'),[dismissed,setDismissed]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),boardDirty=useRef(false),flight=useRef<Promise<void>|null>(null),alive=useRef(true),request=useRef<{signature:string;id:string}|null>(null),newSession=useRef<string|null>(null);
 const latestRoll=useRef<number[]>([]);
 const cursor=useRef(''),activeRoom=useRef(false),lastCheck=useRef(0);
 const loadCatalog=useCallback(async()=>{if(!a.gm)return;const [c,f]=await Promise.all([api<typeof catalog>('/api/command-center'),api<{files:LiveMedia[]}>('/api/files')]);setCatalog(c);setFiles(f.files);},[a.gm]);
 useEffect(()=>{queueMicrotask(()=>void loadCatalog().catch(issue=>setError(issue.message)));},[loadCatalog]);
 const refresh=useCallback(async function update(force=false):Promise<void>{
  if(force)cursor.current='';
  if(flight.current){await flight.current;if(force)return update(true);return;}
  lastCheck.current=Date.now();
  const task=(async()=>{try{const snapshot=await api<Snapshot>('/api/live-table?view=active&cursor='+encodeURIComponent(cursor.current));if(!alive.current)return;if(!snapshot.unchanged){cursor.current=snapshot.cursor||'';activeRoom.current=!!snapshot.room?.open;setData(snapshot.room?snapshot:null);setSessionId(snapshot.room?.sessionId||'');}setSyncError('');}catch(issue){if(alive.current){setSyncError((issue as Error).message);if(issue instanceof ApiError&&[401,403,404].includes(issue.status)){cursor.current='';activeRoom.current=false;setData(null);setSessionId('');setCatalog({sessions:[],scenes:[]});setFiles([]);setScene(null);}}}finally{if(alive.current)setLoading(false);}})();
  flight.current=task;try{await task;}finally{if(flight.current===task)flight.current=null;}
 },[]);
 const refreshShared=useCallback(()=>refresh(true),[refresh]);
 useEffect(()=>{alive.current=true;const check=()=>{if(document.visibilityState==='visible'&&Date.now()-lastCheck.current>=(activeRoom.current?1200:3000))void refresh();};queueMicrotask(()=>void refresh());const timer=window.setInterval(check,100);const focus=()=>void refresh(true);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);return()=>{alive.current=false;window.clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};},[refresh]);
 useEffect(()=>{if(!sceneId)return;let current=true;api<{scene:SceneView}>('/api/command-center/scenes?id='+encodeURIComponent(sceneId)).then(r=>{if(current)setScene(r.scene);}).catch(issue=>current&&setError(issue.message));return()=>{current=false;};},[sceneId]);
 const running=!!(sessionId&&data?.room?.open&&data.room.started),events=data?.events||[],currentScene=events.findLast(e=>e.kind==='scene'),media=events.findLast(e=>e.kind==='media');
 useEffect(()=>{if(running)newSession.current=null;},[running]);
 const selectedFile=media?.files?.[media.index||0];
 useEffect(()=>{const element=dialog.current;if(media&&!media.hidden&&selectedFile&&dismissed!==media.id){if(element&&!element.open)element.showModal();}else if(element?.open)element.close();},[media,selectedFile,dismissed]);
 async function command(action:string,extra:Record<string,unknown>={},id=sessionId){
  if(busy)return false;if(['start','end'].includes(action)&&boardDirty.current&&!window.confirm('Ungespeicherte Whiteboard-Eingaben verwerfen und den Spielabend wechseln/beenden?'))return false;
  setBusy(true);setError('');const signature=JSON.stringify({action,id,...extra});if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()};
  try{const result=await api<{roll?:{dice:number[]}}>('/api/live-table','POST',{action,sessionId:id,runId:data?.room?.runId,eventId:request.current.id,...extra});if(action==='roll')latestRoll.current=result.roll?.dice||[];request.current=null;setNotice(action==='showScene'?'Szene wird den ausgewählten Spielern angezeigt.':action==='showMedia'?'Medien werden für die Zielgruppe eingeblendet.':action==='roll'?'Wurf an die Zielgruppe gesendet.':action==='start'?'Spielabend gestartet – Whiteboard ist offen.':'Live-Stand aktualisiert.');await refresh();return true;}catch(issue){setError((issue as Error).message);return false;}finally{setBusy(false);}
 }
 async function start(){newSession.current||=crypto.randomUUID();const id=selected||newSession.current;const name=selected?(catalog.sessions.find(s=>s.id===selected)?.title||title):title;if(await command('start',{title:name,create:!selected},id))void loadCatalog().catch(issue=>setError(issue.message));}
 async function upload(file:File){setBusy(true);try{const form=new FormData();form.set('file',file);form.set('visibility','private');const r=await api<{id:string}>('/api/files','POST',form);await loadCatalog();setFileIds(old=>[...old,r.id].slice(0,20));setNotice('Privat hochgeladen. Erst „Medien einspielen“ gibt sie der Zielgruppe frei.');}catch(issue){setError((issue as Error).message);}finally{setBusy(false);}}
 const audienceValid=(audience:LiveAudience)=>audience.scope==='all'||audience.playerIds.length>0;
 if(running&&stageOpen)return <Spieltisch key={data!.room!.runId} a={a} sessionId={sessionId} runId={data!.room!.runId!} onExit={exitStage} onEnd={async()=>{await command('end');}}/>;
 if(loading)return <section className={styles.root} aria-busy="true"><p role="status">Dein Spieltisch wird geöffnet …</p></section>;
 return <div className={styles.root}>
  {running&&<button className="button primary" onClick={()=>setStageOpen(true)}>Spieltisch betreten</button>}
  <header className={styles.header}><div><p className="eyebrow">LIVE-SPIELTISCH</p><h1>{running?data.room?.title:'Spielabend'}</h1><p role="status">{loading?'Spielstand wird geladen …':running?'● Abend läuft · Whiteboard offen':'○ Noch kein Spielabend gestartet'}</p></div>{a.gm&&<div className={styles.headerActions}><LocationQuickAccess a={a} initialPlaceId={catalog.scenes.find(item=>item.id===currentScene?.scene?.id)?.placeId||scene?.document.placeId||''}/><a className="button" href="/sl/command-center">SL-Vorbereitung ↗</a></div>}</header>
  {(error||syncError)&&<p role="alert" className={styles.error}>{error||syncError} <button className="button" onClick={async()=>{setError('');await refresh();try{await loadCatalog();if(sceneId&&a.gm)setScene((await api<{scene:SceneView}>('/api/command-center/scenes?id='+encodeURIComponent(sceneId))).scene);}catch(issue){setError((issue as Error).message);}}}>Erneut prüfen</button></p>}{notice&&<p role="status">{notice}</p>}
  {a.gm&&!running&&<section className="panel"><h2>1 · Spielabend starten</h2><label className="field">Sitzung<select aria-label="Spielabend auswählen" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Neuen Spielabend anlegen</option>{catalog.sessions.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>{!selected&&<label className="field">Name<input aria-label="Name des Spielabends" maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/></label>}<p>Start öffnet das Whiteboard für die berechtigte Runde. Von einer bestehenden Sitzung wird nur der Name angezeigt – keine privaten Notizen.</p><button className="button primary" disabled={busy||loading||!title.trim()} onClick={()=>void start()}>Spielabend starten</button></section>}
  {!a.gm&&!running&&!loading&&<section className={styles.waiting} aria-labelledby="waiting-title"><div className={styles.waitingGlow} aria-hidden="true"/><p className="eyebrow">DER SPIELTISCH</p><h2 id="waiting-title">Der Spielabend wird vorbereitet</h2><p>Bleib auf dieser Seite. Sobald die Spielleitung startet, öffnet sich der Spieltisch automatisch.</p><p role="status" className={styles.waitingStatus}><span aria-hidden="true"/> Du bist bereit · Warte auf die Spielleitung</p></section>}
  {running&&<>
   {a.gm&&<section className="panel"><nav className={styles.tabs} aria-label="Live-Aktionen"><button aria-pressed={tool==='scene'} onClick={()=>setTool('scene')}>Szene bespielen</button><button aria-pressed={tool==='media'} onClick={()=>setTool('media')}>Medien einspielen</button><button aria-pressed={tool==='roll'} onClick={()=>setTool('roll')}>Würfeln</button><button disabled={busy} onClick={()=>void command('end')}>Spielabend beenden</button></nav>
    {tool!=='roll'&&<Audience value={scope} onChange={setScope} members={data.members} disabled={busy}/>}
    {tool==='scene'&&<><label className="field">Vorbereitete Szene<select aria-label="Live-Szene auswählen" value={sceneId} onChange={e=>{setScene(null);setSceneId(e.target.value);}}><option value="">Szene wählen</option>{catalog.scenes.filter(s=>!s.archived).map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>{scene&&<div className={styles.preview}><h3>Diese Grundinformation wird gezeigt: {scene.document.title}</h3><RichTextView value={scene.document.narration} readable flowing/><small>Regienotizen, Geheimnisse, Konsequenzen und andere interne Abschnitte bleiben geschützt.</small></div>}<button className="button primary" disabled={busy||!scene||!audienceValid(scope)} onClick={()=>void command('showScene',{sceneId:scene?.id,sceneVersion:scene?.version,audience:scope})}>Szene für Zielgruppe bespielen</button></>}
    {tool==='media'&&<><label className="field">Medium privat hochladen<input aria-label="Live-Medium hochladen" type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,audio/mpeg,audio/ogg,audio/wav,audio/mp4,video/mp4,video/webm" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void upload(file);}}/></label><label className="field">Vorhandene Medien suchen<input value={mediaSearch} onChange={e=>setMediaSearch(e.target.value)}/></label><div className={styles.files}>{files.filter(f=>f.name.toLowerCase().includes(mediaSearch.toLowerCase())).map(f=><label key={f.id}><input type="checkbox" disabled={busy||(!fileIds.includes(f.id)&&fileIds.length>=20)} checked={fileIds.includes(f.id)} onChange={e=>setFileIds(old=>e.target.checked?[...old,f.id]:old.filter(id=>id!==f.id))}/>{f.name}<small>{f.mime}</small></label>)}</div><p>{fileIds.length} Medien ausgewählt · Slider-Reihenfolge entsprechend der Auswahl.</p><button className="button primary" disabled={busy||!fileIds.length||!audienceValid(scope)} onClick={()=>void command('showMedia',{fileIds,audience:scope})}>Medien für Zielgruppe einspielen</button></>}
   </section>}
   {currentScene&&!currentScene.hidden&&<section className="panel" aria-label="Live-Szeneninformation"><p className="eyebrow">FÜR DICH IM SPIEL</p><h2>{currentScene.scene?.title}</h2><RichTextView value={currentScene.scene?.narration||''} readable flowing/></section>}
   {((a.gm&&tool==='roll')||!a.gm)&&<section className="panel"><h2>Gemeinsam würfeln</h2><Audience value={rollScope} onChange={setRollScope} members={data.members} disabled={busy}/><DicePanel disabled={busy||!audienceValid(rollScope)} sharedRoll={async(pool,target)=>{if(!await command('roll',{pool,target,audience:rollScope}))throw new Error('Wurf wurde nicht gesendet. Bitte Fehlermeldung prüfen.');return latestRoll.current;}}/><small>Serverseitiger Rohwurf. Keine automatische Änderung von Charakterwerten.</small></section>}
   {events.some(e=>e.kind==='roll')&&<section className="panel" aria-label="Geteilte Würfelwürfe"><h2>Würfe für dich</h2>{events.filter(e=>e.kind==='roll'&&!e.hidden).slice(-10).reverse().map(e=><article key={e.id}><strong>{e.authorName}</strong><div className="dice-results">{e.roll?.dice.map((die,i)=><span key={i} className={die>=(e.roll?.target||6)?'die success':'die'}>{die}</span>)}</div><p>{e.roll?.dice.filter(d=>d>=e.roll!.target).length} Würfel erreichen Schwelle {e.roll?.target}.</p></article>)}</section>}
   {media&&!media.hidden&&selectedFile&&<button className="button" onClick={()=>setDismissed('')}>Aktuelle Medienansicht öffnen</button>}
   <LiveTable key={`${a.campaignId}:${a.id}:${sessionId}`} a={a} selectedSessionId={sessionId} snapshot={data} onRefresh={refreshShared} managed onDirty={dirty=>{boardDirty.current=dirty;}}/>
  </>}
  <dialog ref={dialog} className={styles.dialog} aria-label="Gemeinsame Medienansicht" onClose={()=>{if(media)setDismissed(media.id);}} onCancel={()=>{if(media)setDismissed(media.id);}}>{media&&!media.hidden&&selectedFile&&<><header><h2>{selectedFile.name}</h2><button className="button" onClick={()=>{setDismissed(media.id);dialog.current?.close();}}>Ansicht schließen</button></header><MediaView key={selectedFile.id} file={selectedFile} url={'/api/live-table/media?sessionId='+encodeURIComponent(sessionId)+'&eventId='+media.id+'&fileId='+selectedFile.id}/><p>Medium {(media.index||0)+1} von {media.files?.length}. Audio/Video bei Bedarf im Browser selbst starten.</p>{a.gm&&<div className={styles.tabs}><button disabled={busy||(media.index||0)===0} onClick={()=>void command('mediaIndex',{eventId:media.id,index:(media.index||0)-1})}>Vorheriges für alle Empfänger</button><button disabled={busy||(media.index||0)>=(media.files?.length||0)-1} onClick={()=>void command('mediaIndex',{eventId:media.id,index:(media.index||0)+1})}>Nächstes für alle Empfänger</button><button disabled={busy} onClick={()=>void command('hideMedia',{eventId:media.id})}>Medien für Zielgruppe ausblenden</button></div>}</>}</dialog>
 </div>;
}
