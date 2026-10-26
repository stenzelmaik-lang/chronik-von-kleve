"use client";
import { useEffect,useRef,useState } from 'react';
import { MonitorUp,SquarePen,Users,X } from 'lucide-react';
import type { Actor } from '@/domain/types';
import type { BoardPoint,BoardElement } from '@/domain/live-table';
import { api } from './api-client';
import { useTableScreen,type TableResult } from './use-table-screen';
import {BoardEditor} from './board-editor';
import styles from './live-table.module.css';
function TableVideo({stream,label}:{stream:MediaStream;label:string}) {
  const video=useRef<HTMLVideoElement>(null);
  useEffect(()=>{const element=video.current;if(!element)return;element.srcObject=stream;void element.play().catch(()=>{});return()=>{element.srcObject=null;};},[stream]);
  return <figure className={styles.video}><video ref={video} autoPlay playsInline muted controls aria-label={label}/><figcaption>{label}</figcaption></figure>;
}
export function LiveTable({a,selectedSessionId,onDirty,managed=false,snapshot,onRefresh}:{a:Actor;selectedSessionId?:string;onDirty?:(dirty:boolean)=>void;managed?:boolean;snapshot?:TableResult|null;onRefresh?:()=>Promise<void>}) {
  const [sessions,setSessions]=useState<{id:string;title:string;open:boolean}[]>([]),[chosenSessionId,setSessionId]=useState(''),[localResult,setResult]=useState<TableResult|null>(null);
  const external=!!onRefresh,result=external?snapshot:localResult;
  const sessionId=selectedSessionId??chosenSessionId;
  const [listLoading,setListLoading]=useState(true),[listRevision,setListRevision]=useState(0);
  const [joined,setJoined]=useState(false),[peerId]=useState(()=>crypto.randomUUID()),[error,setError]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
  const [color,setColor]=useState('#d6b36f'),[draft,setDraft]=useState<BoardPoint[]>([]),[pending,setPending]=useState<BoardElement|null>(null),[text,setText]=useState('');
  const [editorDirty,setEditorDirty]=useState(false);
  const points=useRef<BoardPoint[]>([]),drawEpoch=useRef(0),activePointer=useRef<number|null>(null);
  const dirtyCallback=useRef(onDirty);dirtyCallback.current=onDirty;
  const dirty=busy||!!pending||!!text.trim()||draft.length>0||editorDirty;
  useEffect(()=>{dirtyCallback.current?.(dirty);const leave=(event:BeforeUnloadEvent)=>{if(dirty)event.preventDefault();};window.addEventListener('beforeunload',leave);return()=>window.removeEventListener('beforeunload',leave);},[dirty]);
  useEffect(()=>()=>dirtyCallback.current?.(false),[]);
  useEffect(()=>{points.current=[];activePointer.current=null;queueMicrotask(()=>setDraft([]));},[sessionId,joined]);
  const screen=useTableScreen(sessionId,joined?peerId:null);
  const receive=screen.receive,disconnect=screen.disconnect,mediaFailure=screen.fail;
  useEffect(()=>{let alive=true;if(external){queueMicrotask(()=>{if(alive){setListLoading(false);setSessions(selectedSessionId?[{id:selectedSessionId,title:snapshot?.room?.title||'Spielabend',open:true}]:[]);}});return()=>{alive=false;};}queueMicrotask(()=>{if(alive)setListLoading(true);});api<{sessions:typeof sessions}>('/api/live-table').then(data=>{if(alive){setSessions(data.sessions);setSessionId(data.sessions.find(session=>session.open)?.id||data.sessions[0]?.id||'');setError('');}}).catch(issue=>alive&&setError(issue.message)).finally(()=>{if(alive)setListLoading(false);});return()=>{alive=false;};},[a.id,a.campaignId,listRevision,external,selectedSessionId,snapshot?.room?.title]);
  useEffect(()=>{
    if(external||!sessionId||listLoading||!sessions.some(session=>session.id===sessionId))return;
    let alive=true,loading=false;
    const load=async()=>{if(loading)return;loading=true;try{const data=await api<TableResult>('/api/live-table?sessionId='+encodeURIComponent(sessionId)+(joined?'&peerId='+peerId:''));if(alive){setResult(data);setError('');await receive(data).catch(mediaFailure);if(joined&&!data.room?.open)setJoined(false);}}catch(issue){if(alive){setError((issue as Error).message);disconnect();}}finally{loading=false;}};
    void load();const timer=window.setInterval(()=>void load(),2000);
    return()=>{alive=false;window.clearInterval(timer);};
  },[sessionId,joined,peerId,refresh,receive,disconnect,mediaFailure,listLoading,sessions,external]);
  useEffect(()=>{
    if(!joined||!sessionId)return;
    const pulse=()=>{void api('/api/live-table','POST',{action:'pulse',sessionId,peerId}).catch(issue=>{setError(issue.message);setJoined(false);disconnect();});};
    const timer=window.setInterval(pulse,10000);
    return()=>{window.clearInterval(timer);void api('/api/live-table','POST',{action:'leave',sessionId,peerId}).catch(()=>{});};
  },[joined,peerId,sessionId,disconnect]);
  async function action(action:string,extra:Record<string,unknown>={}) {
    setBusy(true);setError('');
    try{await api('/api/live-table','POST',{action,sessionId,peerId,...extra});setError('');setRefresh(old=>old+1);await onRefresh?.();return true;}catch(issue){setError((issue as Error).message);await onRefresh?.();return false;}finally{setBusy(false);}
  }
  const submitElement=async(element:BoardElement,epoch:number)=>{setPending(element);if(await action('draw',{element,epoch})){setPending(null);setText('');}};
  const room=result?.room;
  useEffect(()=>{if(!managed||joined||busy||!room?.open)return;let alive=true;api('/api/live-table','POST',{action:'join',sessionId,peerId}).then(()=>{if(alive){setJoined(true);void onRefresh?.();}}).catch(issue=>{if(alive)setError(issue.message);});return()=>{alive=false;};},[managed,joined,busy,room?.open,sessionId,peerId,onRefresh]);
  async function addImage(file:File){
    if(!joined||busy||pending)return;
    setBusy(true);setError('');try{const form=new FormData();form.set('file',file);form.set('visibility','private');const uploaded=await api<{id:string}>('/api/files','POST',form);const slot=(room?.elements.filter(e=>e.fileId).length||0)%6;await submitElement({id:crypto.randomUUID(),memberId:a.id,name:a.name,color,points:[[30+(slot%3)*320,30+Math.floor(slot/3)*250]],fileId:uploaded.id},room?.epoch||0);}catch(issue){setError((issue as Error).message);}finally{setBusy(false);}
  }
  function position(event:React.PointerEvent<SVGSVGElement>):BoardPoint {const matrix=event.currentTarget.getScreenCTM();const point=matrix?new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()):new DOMPoint();return [Math.round(Math.max(0,Math.min(1000,point.x))),Math.round(Math.max(0,Math.min(600,point.y)))];}
  const elementView=(element:BoardElement)=>element.fileId?<image key={element.id} x={element.points[0][0]} y={element.points[0][1]} width="320" height="240" preserveAspectRatio="xMidYMid meet" href={'/api/live-table/media?sessionId='+encodeURIComponent(sessionId)+'&elementId='+element.id}><title>{element.name}: geteiltes Bild</title></image>:element.text?<text key={element.id} x={element.points[0][0]} y={element.points[0][1]} fill={element.color} fontSize="20"><title>{element.name}: {element.text}</title>{element.text.length>70?element.text.slice(0,70)+'…':element.text}</text>:element.points.length===1?<circle key={element.id} cx={element.points[0][0]} cy={element.points[0][1]} r="2" fill={element.color}><title>{element.name}</title></circle>:<polyline key={element.id} points={element.points.map(point=>point.join(',')).join(' ')} fill="none" stroke={element.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><title>{element.name}</title></polyline>;
  if(listLoading)return <section className={styles.table}><h2>Gemeinsames Whiteboard</h2><p role="status">Spielraum wird geprüft …</p></section>;
  const unavailable=!sessions.some(session=>session.id===sessionId);
  return <section id="live-whiteboard" className={styles.table} aria-label="Gemeinsamer Live-Spieltisch" onPaste={event=>{const file=event.clipboardData.files[0];if(file?.type.startsWith('image/')&&joined){event.preventDefault();void addImage(file);}}}><header><div><p className="eyebrow"><SquarePen size={16}/> GEMEINSAMER SPIELRAUM</p><h2>Gemeinsames Whiteboard</h2><p>{sessions.find(session=>session.id===sessionId)?.title||'Noch keine gemeinsame Sitzung verfügbar.'}</p></div>{selectedSessionId===undefined&&<label>Sitzung<select aria-label="Sitzung für gemeinsamen Spielraum" value={sessionId} disabled={joined||busy} onChange={event=>{setSessionId(event.target.value);setResult(null);setPending(null);setText('');}}>{sessions.map(session=><option key={session.id} value={session.id}>{session.title}</option>)}</select></label>}</header>
    {error&&<p role="alert">{error} <button className="button" onClick={()=>{if(!sessionId)setListRevision(old=>old+1);else setRefresh(old=>old+1);}}>Erneut verbinden</button></p>}
    {!managed&&<div className={styles.actions}>{a.gm&&<button className="button" disabled={busy||!sessionId||unavailable} onClick={()=>void action(room?.open?'close':'open')}>{room?.open?'Whiteboard schließen':'Whiteboard öffnen'}</button>}{room?.open&&!joined&&<button className="button primary" disabled={busy} onClick={async()=>{if(await action('join'))setJoined(true);}}><Users size={16}/> Zum Zeichnen beitreten</button>}{joined&&<button className="button" disabled={busy} onClick={()=>{void screen.stop();setJoined(false);}}><X size={16}/> Zeichnen verlassen</button>}</div>}
    {managed&&room?.open&&!joined&&<p role="status">Whiteboard wird verbunden … {error&&<button className="button" onClick={async()=>{if(await action('join'))setJoined(true);}}>Erneut beitreten</button>}</p>}
    {joined&&<label>Bild für die gesamte Runde einfügen<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy||!!pending} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void addImage(file);}}/><small>Oder ein kopiertes Bild hier mit Strg+V einfügen. Whiteboard-Inhalte sieht die gesamte Runde.</small></label>}
    {!room?.open&&<div className={styles.closedBoard} role="status"><SquarePen size={32}/><p>{unavailable?'Für diese Sitzung ist noch kein gemeinsamer Spielraum freigegeben.':a.gm?'Öffne das Whiteboard bewusst für die Spielrunde.':'Die SL hat das Whiteboard noch nicht geöffnet.'}</p>{unavailable&&a.gm&&<p>Sitzung zuerst in der Vorbereitung ausdrücklich für die Gruppe freigeben. Eine Szenenfreigabe allein gibt die Sitzung nicht frei.</p>}<small>Geschlossen: keine gespeicherten Zeichnungen sichtbar.</small></div>}
    {room?.open&&<><p className={styles.peers} aria-live="polite">Im Raum: {room.peers.map(peer=>peer.name).join(' · ')||'Noch niemand beigetreten.'}</p><div className={styles.actions}>{!managed&&<label>Stiftfarbe<input aria-label="Whiteboard-Stiftfarbe" type="color" value={color} onChange={event=>setColor(event.target.value)}/></label>}{a.gm&&joined&&<button className="button" disabled={busy||!!error} onClick={()=>{if(window.confirm('Das gemeinsame Whiteboard wirklich leeren?'))void action('clear',{epoch:room.epoch});}}>Whiteboard leeren</button>}{!managed&&<button className="button" disabled={!joined||screen.busy||!!error||!!pending||!!result?.mediaError||!!(room.screen&&room.screen.peerId!==peerId)} onClick={()=>{if(screen.local)void screen.stop();else void screen.start();}}><MonitorUp size={16}/>{screen.local?'Bildschirmfreigabe stoppen':'Bildschirm freigeben'}</button>}</div>
    {!managed&&joined&&!result?.relayConfigured&&<p className={styles.warning}>Bildschirmfreigabe ist noch nicht verfügbar. Das Whiteboard funktioniert unabhängig davon.</p>}
    {screen.error&&<p role="alert">{screen.error}</p>}{screen.local&&<TableVideo stream={screen.local} label="Deine bewusst freigegebene Bildschirmansicht"/>}{screen.remote&&<TableVideo stream={screen.remote} label="Geteilter Bildschirm der Spielrunde"/>}{room.screen&&!screen.remote&&!screen.local&&<p role="status">Bildschirmverbindung wird aufgebaut …</p>}
    {managed&&<BoardEditor a={a} sessionId={sessionId} elements={room.elements} epoch={room.epoch} enabled={joined&&!busy&&!pending} color={color} onColor={setColor} onAction={action} onDirty={setEditorDirty}/>}
    {!managed&&<svg className={styles.board} viewBox="0 0 1000 600" role="img" aria-label="Gemeinsames Whiteboard; alternativ Texteingabe unter dem Board" onPointerDown={event=>{if(!joined||busy||error||pending||activePointer.current!==null)return;activePointer.current=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);drawEpoch.current=room.epoch;points.current=[position(event)];setDraft(points.current);}} onPointerMove={event=>{if(activePointer.current!==event.pointerId||!points.current.length)return;const point=position(event);points.current=[...(points.current.length>=128?points.current.filter((_,index)=>index%2===0):points.current),point];setDraft(points.current);}} onPointerUp={event=>{if(activePointer.current!==event.pointerId||!points.current.length)return;activePointer.current=null;const element:BoardElement={id:crypto.randomUUID(),memberId:a.id,name:a.name,color,points:points.current};points.current=[];setDraft([]);void submitElement(element,drawEpoch.current);}} onPointerCancel={event=>{if(activePointer.current===event.pointerId){activePointer.current=null;points.current=[];setDraft([]);}}}>
      <rect width="1000" height="600" fill="#0b161c"/>{room.elements.map(elementView)}{pending&&elementView(pending)}{draft.length>0&&<polyline points={draft.map(point=>point.join(',')).join(' ')} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"/>}
    </svg>}<small>{managed?'Änderungen werden automatisch geteilt. Nur geänderte Zustände werden übertragen; bei Verbindungsproblemen bleiben Entwürfe erhalten.':'Zeichnen mit Maus, Stift oder Finger; andere Teilnehmende sehen gespeicherte Einträge beim nächsten Abgleich (etwa zwei Sekunden).'}</small>
    {room.elements.some(element=>element.text)&&<div className={styles.sharedTexts} aria-label="Geteilte Whiteboard-Texte">{room.elements.filter(element=>element.text).map(element=><p key={element.id}><strong>{element.name}: </strong>{element.text}</p>)}</div>}
    {joined&&<form className={styles.textForm} onSubmit={event=>{event.preventDefault();void submitElement({id:crypto.randomUUID(),memberId:a.id,name:a.name,color,points:[[30,40+room.elements.filter(element=>element.text).length*30%500]],text},room.epoch);}}><label>Text auf dem Whiteboard<input aria-label="Text auf dem Whiteboard" maxLength={500} required value={text} disabled={busy||!!pending} onChange={event=>setText(event.target.value)}/></label><button className="button" disabled={busy||!!pending||!!error}>Text teilen</button></form>}
    {pending&&<div className={styles.actions}><p>Ein lokaler Entwurf ist noch nicht übertragen.</p><button className="button" disabled={busy} onClick={()=>void submitElement(pending,room.epoch)}>Entwurf erneut senden</button><button className="button" disabled={busy} onClick={()=>setPending(null)}>Entwurf verwerfen</button></div>}</>}
  </section>;
}
