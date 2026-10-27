/* eslint-disable @next/next/no-img-element -- Local prototype uses a bounded loopback-only media allowlist. */

import React,{useCallback,useEffect,useId,useLayoutEffect,useRef,useState,type PointerEvent as ReactPointerEvent,type ReactNode} from 'react';

import {createRoot} from 'react-dom/client';

import {Clapperboard,Users,Files,PenLine,NotebookPen,Dices,Map,Mail,X,Plus,Minus,Eye,EyeOff,ArrowLeft,ArrowRight,ArrowUp,ArrowDown,GripVertical,Expand,RotateCcw,Info,ChevronRight,Shield,FlaskConical,Maximize2,Check,AlertTriangle,MousePointer2} from 'lucide-react';

import {BoardEditor} from '../../app/spielbereich/modules/board-editor';

import {DicePanel} from '../../app/spielbereich/modules/dice';

import type {Actor} from '../../domain/types';

import {constrainRect,fitNoteRect} from './stage-state.mjs';

import type {Rect,Snapshot,StageObject,TestDocument,Viewer} from './types';

import styles from './stage.module.css';

import {StickyNote,noteAuthor} from './sticky-note';

import {StickyNote as StickyIcon} from 'lucide-react';

import {DiceEffect,type DicePresentation} from './dice-effect';

import {useSharedDice} from './use-shared-dice';





type Panel='scenes'|'npcs'|'documents'|'notes'|'sticky'|'context'|'character'|'dice'|'map'|'messages'|'help';

const titles:Record<Panel,string>={scenes:'Szene auflegen',npcs:'Figuren',documents:'Dokumente',notes:'Private SL-Notizen',sticky:'Notizzettel',context:'Kontext',character:'Deine Charakterakte',dice:'Würfel',map:'Chronikkarte',messages:'Nachrichten',help:'So funktioniert der Prototyp'};

const names={campaign:'Kampagnenmotiv',barracks:'Kaserne',taberna:'Electric Taberna'};

const initialViewer=new URLSearchParams(location.search).get('ansicht');

const startViewer:Viewer=initialViewer==='a'||initialViewer==='b'?initialViewer:'gm';



function IconButton({label,children,active=false,onClick,badge}:{label:string;children:ReactNode;active?:boolean;onClick:(e:React.MouseEvent<HTMLButtonElement>)=>void;badge?:number}){

  const id=useId();return <span className={styles.iconWrap}><button type="button" aria-label={label} aria-describedby={id} aria-pressed={active} className={styles.iconButton} onClick={onClick}>{children}{!!badge&&<span className={styles.badge}>{badge}</span>}</button><span id={id} role="tooltip" className={styles.tooltip}>{label}</span></span>;

}

async function request(viewer:Viewer,body?:Record<string,unknown>,version?:number):Promise<Snapshot|null>{

  const response=await fetch(`/prototype/state?viewer=${viewer}${version?'&version='+version:''}`,{method:body?'POST':'GET',cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});

  if(response.status===304)return null;const value=await response.json();if(!response.ok)throw Error(value.error||'Lokaler Prototyp nicht erreichbar.');return value;

}

function App(){

  const [viewer,setViewer]=useState<Viewer>(startViewer),[snapshot,setSnapshot]=useState<Snapshot|null>(null),[panel,setPanel]=useState<Panel|null>(null),[selected,setSelected]=useState(''),[localRects,setLocalRects]=useState<Record<string,Rect>>({}),[notice,setNotice]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[annotation,setAnnotation]=useState(false),[color,setColor]=useState('#d6b36f'),[image,setImage]=useState<string|null>(null),[imageBusy,setImageBusy]=useState(false),[imageError,setImageError]=useState(''),[retry,setRetry]=useState(0),[loadMs,setLoadMs]=useState(0),[document,setDocument]=useState<TestDocument|null>(null),[readZoom,setReadZoom]=useState(1),[mapOpen,setMapOpen]=useState(false);

  const sharedDice=useSharedDice(viewer,snapshot,async body=>{const who=viewer,next=await request(who,body);if(!next)throw Error('Wurfantwort fehlt.');if(activeViewer.current===who){latest.current=next;setSnapshot(next);setPanel(null);}return next;});

  const diceResult=sharedDice.selected;

  const closeDice=()=>{sharedDice.dismiss();queueMicrotask(()=>window.document.querySelector<HTMLButtonElement>('button[aria-label="W\u00fcrfel \u00f6ffnen"]')?.focus());};

  const [boardCommitMs,setBoardCommitMs]=useState(0),[stageSize,setStageSize]=useState({w:1864,h:1024});

  const [editingNoteId,setEditingNoteId]=useState(''),[privateHidden,setPrivateHidden]=useState<Record<string,boolean>>(()=>{try{return JSON.parse(localStorage.getItem('chroniplay-prototype-private-notes-v1')||'{}')||{};}catch{return {};}});

  const latest=useRef<Snapshot|null>(null),stage=useRef<HTMLElement>(null),panelRef=useRef<HTMLElement>(null),trigger=useRef<HTMLElement|null>(null),documentTrigger=useRef<HTMLElement|null>(null),dialog=useRef<HTMLDialogElement>(null),activeViewer=useRef(viewer);

  const gesture=useRef<{id:string;mode:'move'|'resize';pointer:number;startX:number;startY:number;rect:Rect;w:number;h:number;noteRevision?:number;noteSize?:{w:number;h:number}}|null>(null);

  const workingRect=useRef<Rect|null>(null),raf=useRef(0),saving=useRef(false);

  useLayoutEffect(()=>{latest.current=snapshot;},[snapshot]);

  useLayoutEffect(()=>{const update=()=>{const b=stage.current?.getBoundingClientRect();if(b)setStageSize({w:b.width,h:b.height});};update();const observer=new ResizeObserver(update);if(stage.current)observer.observe(stage.current);return()=>observer.disconnect();},[]);

  useEffect(()=>{

    let alive=true,loading=false;

    const load=async()=>{if(loading)return;loading=true;try{const value=await request(viewer,undefined,latest.current?.version);if(alive&&value){latest.current=value;setSnapshot(value);setError('');}}catch(e){if(alive)setError((e as Error).message);}finally{loading=false;}};

    void load();const timer=setInterval(()=>{if(!gesture.current&&!saving.current)void load();},1000);

    const resume=()=>{if(!gesture.current&&!saving.current)void load();};

    window.addEventListener('focus',resume);window.document.addEventListener('visibilitychange',resume);

    return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',resume);window.document.removeEventListener('visibilitychange',resume);};

  },[viewer]);

  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),3800);return()=>clearTimeout(timer);},[notice]);

  useEffect(()=>{

    if(!snapshot)return;let cancelled=false;const start=performance.now(),next=new Image();

    setImageBusy(true);setImageError('');

    next.onload=()=>{void next.decode().catch(()=>{}).then(()=>{if(!cancelled){setImage(next.src);setImageBusy(false);setLoadMs(Math.round(performance.now()-start));}});};

    next.onerror=()=>{if(!cancelled){setImageBusy(false);setImageError('Dieses Bühnenbild konnte nicht geladen werden. Die bisherige Ansicht bleibt erhalten.');}};

    next.src=`/prototype/media/${snapshot.scene}?viewer=${viewer}`;

    return()=>{cancelled=true;next.onload=null;next.onerror=null;};

  },[snapshot?.scene,viewer,retry]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{if(panel)panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();},[panel]);

  const closePanel=useCallback(()=>{setPanel(null);queueMicrotask(()=>trigger.current?.focus());},[]);



  useEffect(()=>{const escape=(event:KeyboardEvent)=>{if(event.defaultPrevented||event.key!=='Escape'||window.document.querySelector('dialog[open]'))return;if(gesture.current){gesture.current=null;workingRect.current=null;setLocalRects(old=>{const next={...old};delete next[selected];return next;});}else if(panel)closePanel();else if(annotation)setAnnotation(false);else setSelected('');};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[panel,annotation,selected,closePanel,diceResult,closeDice]);

  useEffect(()=>{if((document||mapOpen)&&!dialog.current?.open)dialog.current?.showModal();},[document,mapOpen]);

  const openPanel=(value:Panel,event?:React.MouseEvent<HTMLButtonElement>)=>{if(panel===value){closePanel();return;}trigger.current=event?.currentTarget||window.document.activeElement as HTMLElement;setPanel(value);};

  async function command(body:Record<string,unknown>,message?:string){

    if(saving.current||!latest.current)return false;saving.current=true;setBusy(true);const role=viewer;

    try{const next=await request(role,{...body,expectedVersion:latest.current.version});if(next&&activeViewer.current===role){latest.current=next;setSnapshot(next);setError('');if(message)setNotice(message);}return true;}

    catch(e){if(activeViewer.current===role){setError((e as Error).message);const current=await request(role).catch(()=>null);if(current){latest.current=current;setSnapshot(current);}}return false;}

    finally{saving.current=false;setBusy(false);}

  }

  async function noteCommand(body:Record<string,unknown>,message?:string){

    const ok=await command(body,message);

    if(ok&&body.action==='remove'){setSelected('');setEditingNoteId('');window.document.querySelector<HTMLButtonElement>('nav[aria-label="Spieltisch-Werkzeuge"] button[aria-label="Notizzettel"]')?.focus();}

    return ok;

  }

  function changeViewer(value:Viewer){

    if(editingNoteId){setError('Bitte deinen Notizzettel erst speichern oder abbrechen.');return;}

    if(busy||gesture.current)return;activeViewer.current=value;latest.current=null;setSnapshot(null);setLocalRects({});setSelected('');setPanel(null);setAnnotation(false);setDocument(null);setMapOpen(false);dialog.current?.close();setImage(null);setNotice('');setError('');setViewer(value);

  }

  function startGesture(event:ReactPointerEvent<HTMLElement>,object:StageObject,mode:'move'|'resize'){

    if(event.button!==0||annotation||busy||(object.kind==='note'&&(object.ownerId!==viewer||editingNoteId===object.id)))return;event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);setSelected(object.id);

    const bounds=stage.current!.getBoundingClientRect();gesture.current={id:object.id,mode,pointer:event.pointerId,startX:event.clientX,startY:event.clientY,rect:object.kind==='note'?fitNoteRect(localRects[object.id]||object.rect,stageSize):localRects[object.id]||object.rect,w:bounds.width,h:bounds.height,...(object.kind==='note'?{noteRevision:object.revision,noteSize:{w:object.rect.w,h:object.rect.h}}:{})};workingRect.current=gesture.current.rect;

  }

  function moveGesture(event:ReactPointerEvent<HTMLElement>){

    const current=gesture.current;if(!current||current.pointer!==event.pointerId)return;

    const dx=(event.clientX-current.startX)/current.w,dy=(event.clientY-current.startY)/current.h;

    workingRect.current=constrainRect(current.mode==='move'?{...current.rect,x:current.rect.x+dx,y:current.rect.y+dy}:{...current.rect,w:current.rect.w+dx,h:current.rect.h+dy});

    if(!raf.current)raf.current=requestAnimationFrame(()=>{raf.current=0;if(gesture.current&&workingRect.current)setLocalRects(old=>({...old,[gesture.current!.id]:workingRect.current!}));});

  }

  async function endGesture(event:ReactPointerEvent<HTMLElement>){

    const current=gesture.current;if(!current||current.pointer!==event.pointerId)return;

    const next=workingRect.current||current.rect;gesture.current=null;cancelAnimationFrame(raf.current);raf.current=0;setLocalRects(old=>({...old,[current.id]:next}));

    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);

    if(viewer==='gm'||current.noteRevision!==undefined){await command({action:'move',id:current.id,rect:current.noteSize?{...next,...current.noteSize}:next,...(current.noteRevision!==undefined?{expectedRevision:current.noteRevision}:{})});setLocalRects(old=>{const value={...old};delete value[current.id];return value;});}

  }

  function cancelGesture(){const id=gesture.current?.id;gesture.current=null;workingRect.current=null;cancelAnimationFrame(raf.current);raf.current=0;if(id)setLocalRects(old=>{const value={...old};delete value[id];return value;});}

  async function adjust(object:StageObject,change:Partial<Rect>){const rect=constrainRect({...(localRects[object.id]||object.rect),...change});if(object.kind==='note'){if(object.ownerId===viewer)await command({action:'move',id:object.id,rect:{...fitNoteRect(rect,stageSize),w:object.rect.w,h:object.rect.h},expectedRevision:object.revision});}else if(viewer==='gm')await command({action:'move',id:object.id,rect});else setLocalRects(old=>({...old,[object.id]:rect}));}

  function noteKeys(event:React.KeyboardEvent<HTMLButtonElement>,object:StageObject,box:Rect){if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const step=event.shiftKey ? .05 : .01;void adjust(object,{x:box.x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0),y:box.y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)});}}

  function showPrivate(hidden:boolean){const next={...privateHidden,[viewer]:hidden};setPrivateHidden(next);try{localStorage.setItem('chroniplay-prototype-private-notes-v1',JSON.stringify(next));}catch{/* Preference only; note content stays in private local server state. */}}

  async function createNote(){

    if(editingNoteId)return;const previous=new Set(latest.current?.objects.map(o=>o.id));

    if(await command({action:'add',kind:'note'},'Privater Notizzettel erstellt. Sichtbar für dich und die SL.')){const note=latest.current?.objects.find(o=>o.kind==='note'&&o.ownerId===viewer&&!previous.has(o.id));if(note){showPrivate(false);setAnnotation(false);setSelected(note.id);setEditingNoteId(note.id);closePanel();}}

  }

  async function openDocument(event?:React.MouseEvent<HTMLButtonElement>){

    documentTrigger.current=event?.currentTarget||window.document.activeElement as HTMLElement;

    try{const response=await fetch('/prototype/document?viewer='+viewer,{cache:'no-store'});const value=await response.json();if(!response.ok)throw Error(value.error);setReadZoom(1);setDocument(value);}catch(e){setError((e as Error).message);}

  }

  function closeDocument(){dialog.current?.close();setDocument(null);setMapOpen(false);queueMicrotask(()=>documentTrigger.current?.focus());}

  const choice=snapshot?.objects.find(o=>o.id===selected),chosenRect=choice&&(localRects[choice.id]||choice.rect);

  const actor={id:'demo-'+viewer,campaignId:'synthetic-prototype',name:viewer==='gm'?'Demo Spielleitung':'Demo Spieler '+viewer.toUpperCase(),role:viewer==='gm'?'campaign_gm':'player',gm:viewer==='gm',status:'active'} as Actor;

  const boardAction=useCallback(async(operation:string,extra:Record<string,unknown>)=>{const start=performance.now();const ok=await command({action:'board',operation,...extra});setBoardCommitMs(Math.round(performance.now()-start));return ok;},[viewer]); // eslint-disable-line react-hooks/exhaustive-deps

  const boardDirty=useCallback((_dirty:boolean)=>{},[]);

  return <div className={styles.app}>

    <header className={styles.topbar}><div className={styles.brand}>ChroniPlay<span>SPIELTISCH</span></div>

      <div className={styles.crew} aria-label="Synthetische Spielerrunde – keine Onlineanzeige">{snapshot?.crew.map(member=><div className={styles.member} key={member.id}><span className={styles.avatar}>{member.initials}</span><span>{member.name}<small>{member.role}</small></span></div>)}</div>

      <div className={styles.simulation}><span><FlaskConical size={14}/> Lokaler Prototyp</span><label><span className={styles.sr}>Simulierte Ansicht</span><select aria-label="Simulierte Ansicht" disabled={busy} value={viewer} onChange={e=>changeViewer(e.target.value as Viewer)}><option value="gm">Spielleitung</option><option value="a">Spieler A</option><option value="b">Spieler B</option></select></label></div>

    </header>

    <nav className={styles.rail} aria-label="Spieltisch-Werkzeuge">

      {viewer==='gm'?<><IconButton label="Szenen" active={panel==='scenes'} onClick={e=>openPanel('scenes',e)}><Clapperboard/></IconButton><IconButton label="Figuren" active={panel==='npcs'} onClick={e=>openPanel('npcs',e)}><Users/></IconButton></>:<IconButton label="Eigene Charakterakte" active={panel==='character'} onClick={e=>openPanel('character',e)}><Users/></IconButton>}

      <IconButton label="Dokumente" active={panel==='documents'} onClick={e=>openPanel('documents',e)}><Files/></IconButton><span className={styles.railDivider}/>

      <IconButton label={annotation?'Zeichenmodus schließen':'Gemeinsam zeichnen · lokaler Bestand'} active={annotation} onClick={()=>{setAnnotation(old=>!old);setPanel(null);setSelected('');}}><PenLine/></IconButton>

      <IconButton label="Notizzettel" active={panel==='sticky'} onClick={e=>openPanel('sticky',e)}><StickyIcon/></IconButton>

      {viewer==='gm'&&<IconButton label="Private SL-Notizen" active={panel==='notes'} onClick={e=>openPanel('notes',e)}><NotebookPen/></IconButton>}

      <span className={styles.railSpacer}/><IconButton label="Bedienhilfe" active={panel==='help'} onClick={e=>openPanel('help',e)}><Info/></IconButton>

    </nav>

    <main ref={stage} className={styles.stage} aria-label="Dynamische Spielbühne" data-scene={snapshot?.scene} data-load-ms={loadMs} data-board-commit-ms={boardCommitMs} data-displayed-scene={image?.split('/').at(-1)?.split('?')[0]} onPointerDown={event=>{if(event.target===event.currentTarget)setSelected('');}}>

      <div className={styles.background} data-layer="background"/>

      <div className={styles.scene} data-layer="scene">{image&&<img key={image} src={image} alt={names[image.split('/').at(-1)?.split('?')[0] as keyof typeof names]||'Bühnenmotiv'}/>}<div className={styles.scrim}/></div>

      <div className={styles.objects} data-layer="stage_objects">

        {snapshot?.objects.filter(object=>object.kind!=='note'||object.visibility!=='private'||object.ownerId!==viewer||!privateHidden[viewer]).map(object=>{const box=object.kind==='note'?fitNoteRect(localRects[object.id]||object.rect,stageSize):localRects[object.id]||object.rect;

          if(object.kind==='note')return <section key={object.id} className={`${styles.object} ${styles.stickyObject} ${selected===object.id?styles.selected:''}`} data-object={object.id} data-note-owner={object.ownerId} data-visibility={object.visibility} style={{left:box.x*100+'%',top:box.y*100+'%',width:box.w*100+'%',height:box.h*100+'%'}} onClick={()=>setSelected(object.id)}><StickyNote note={object} viewer={viewer} busy={busy} editing={editingNoteId===object.id} onEdit={()=>{if(editingNoteId&&editingNoteId!==object.id){setError('Bitte den geöffneten Notizzettel erst speichern oder abbrechen.');return;}setEditingNoteId(object.id);}} onFinish={()=>setEditingNoteId('')} onAction={noteCommand} onStart={e=>startGesture(e,object,'move')} onMove={moveGesture} onEnd={e=>void endGesture(e)} onCancel={cancelGesture} onKey={e=>noteKeys(e,object,box)}/></section>;

          return <section key={object.id} role="group" aria-label={'Bühnenobjekt: '+object.title} className={`${styles.object} ${object.kind==='npc'?styles.npc:styles.documentObject} ${selected===object.id?styles.selected:''}`} data-object={object.id} style={{left:box.x*100+'%',top:box.y*100+'%',width:box.w*100+'%',height:box.h*100+'%'}} onClick={()=>setSelected(object.id)}>

          <button className={styles.objectGrip} aria-label={object.title+' verschieben'} onPointerDown={e=>startGesture(e,object,'move')} onPointerMove={moveGesture} onPointerUp={e=>void endGesture(e)} onPointerCancel={cancelGesture} onKeyDown={event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();setSelected(object.id);const step=event.shiftKey ? .05 : .01;void adjust(object,{x:box.x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0),y:box.y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)});}}}><GripVertical size={14}/><span>{object.title}</span>{object.visibility==='sl'?<Shield size={13} aria-label="Nur SL"/>:<Eye size={13} aria-label="Für Gruppe sichtbar"/>}</button>

          {object.kind==='npc'?<img draggable={false} src={'/prototype/media/npc?viewer='+viewer} alt={object.title+' · vorhandenes freigestelltes NPC-Bild'} onPointerDown={e=>startGesture(e,object,'move')} onPointerMove={moveGesture} onPointerUp={e=>void endGesture(e)} onPointerCancel={cancelGesture}/>:<div className={styles.paper} onPointerDown={e=>startGesture(e,object,'move')} onPointerMove={moveGesture} onPointerUp={e=>void endGesture(e)} onPointerCancel={cancelGesture}><small>CHRONIPLAY · TESTDOKUMENT</small><h2>Ankunft</h2><div className={styles.paperRule}/><p>Ein Blatt auf dem Spieltisch.</p><p>Öffnen, verschieben, vergrößern.<br/>Ohne die gemeinsame Szene zu verlassen.</p><span>LOKALE DEMONSTRATION · KEIN KANON</span></div>}

          {object.kind==='document'&&<button className={styles.readButton} onClick={e=>void openDocument(e)}><Expand size={15}/> Lesen</button>}

          {selected===object.id&&<button className={styles.resize} aria-label={object.title+' Größe ändern'} onPointerDown={e=>startGesture(e,object,'resize')} onPointerMove={moveGesture} onPointerUp={e=>void endGesture(e)} onPointerCancel={cancelGesture} onKeyDown={event=>{if(event.key==='+'||event.key==='-'||event.key==='='||event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();const d=event.key==='-'||event.key==='ArrowDown'?-.025:.025;void adjust(object,{w:box.w+d,h:box.h+d});}}}><Maximize2 size={15}/></button>}

        </section>;})}

      </div>

      <div className={styles.annotation} data-layer="annotation" data-active={annotation} aria-hidden={!annotation} inert={!annotation}>{snapshot&&<>{annotation&&<div className={styles.annotationLabel}>Gemeinsame Skizze · nur lokale Testdaten<button aria-label="Zeichenmodus schließen" onClick={()=>setAnnotation(false)}><X size={17}/></button></div>}<BoardEditor a={actor} sessionId="synthetic-prototype" elements={snapshot.board} epoch={snapshot.boardEpoch} enabled={annotation&&!busy} color={color} onColor={setColor} onAction={boardAction} onDirty={boardDirty}/></>}</div>

      <div className={styles.effects} data-layer="transient_fx">{diceResult&&<DiceEffect key={diceResult.id} result={{id:diceResult.id,dice:diceResult.roll.dice,target:diceResult.roll.target,motionSeed:diceResult.animationSeed,report:diceResult.result}} author={diceResult.authorName} animate={sharedDice.animate} onClose={closeDice} onCloseShared={viewer==='gm'&&diceResult.status==='settled_open'?sharedDice.closeShared:undefined} pendingCount={sharedDice.waiting.length} onNext={()=>sharedDice.waiting[0]&&sharedDice.show(sharedDice.waiting[0].id)}/>}

        {!diceResult&&sharedDice.waiting.length>0&&<button className={styles.pendingRoll} onClick={()=>sharedDice.show(sharedDice.waiting[0].id)}>Offene Würfe ({sharedDice.waiting.length}) anzeigen</button>}</div>

      <div className={styles.stageStatus}>{snapshot?.preview?<><Shield size={13}/> Private SL-Vorschau · die Runde sieht {names[snapshot.sharedScene as keyof typeof names]}</>:<><Eye size={13}/> {viewer==='gm'?'Rundenbühne':'Gemeinsame Bühne'}</>}</div>

      {!annotation&&<button className={styles.contextTrigger} aria-label="Kontext öffnen" onClick={e=>openPanel('context',e)}><NotebookPen size={18}/><span>Kontext</span></button>}

      {imageBusy&&<span className={styles.loading} role="status">Bühnenbild wird geladen …</span>}

      {imageError&&<div className={styles.imageError} role="alert"><AlertTriangle size={19}/><p>{imageError}</p><button onClick={()=>setRetry(n=>n+1)}>Erneut laden</button></div>}

      {choice&&choice.kind!=='note'&&chosenRect&&!annotation&&<div className={styles.selectionTools} aria-label="Ausgewähltes Bühnenobjekt"><div><strong>{choice.title}</strong><small>{viewer==='gm'?(choice.visibility==='group'?'Für die Runde sichtbar':'Privat · nur SL'):'Deine Position und Größe bleiben persönlich.'}</small></div><div className={styles.positionButtons}>

        <button aria-label="Objekt nach links" disabled={busy} onClick={()=>void adjust(choice,{x:chosenRect.x-.025})}><ArrowLeft/></button><button aria-label="Objekt nach rechts" disabled={busy} onClick={()=>void adjust(choice,{x:chosenRect.x+.025})}><ArrowRight/></button><button aria-label="Objekt nach oben" disabled={busy} onClick={()=>void adjust(choice,{y:chosenRect.y-.025})}><ArrowUp/></button><button aria-label="Objekt nach unten" disabled={busy} onClick={()=>void adjust(choice,{y:chosenRect.y+.025})}><ArrowDown/></button><button aria-label="Objekt vergrößern" disabled={busy} onClick={()=>void adjust(choice,{w:chosenRect.w+.025,h:chosenRect.h+.025})}><Plus/></button><button aria-label="Objekt verkleinern" disabled={busy} onClick={()=>void adjust(choice,{w:chosenRect.w-.025,h:chosenRect.h-.025})}><Minus/></button>

        <button aria-label="Objektkontext öffnen" onClick={e=>openPanel('context',e)}><Info/></button><button aria-label="Objektauswahl schließen" onClick={()=>setSelected('')}><X/></button></div>

        {viewer==='gm'&&<div className={styles.publication}><button disabled={busy} onClick={()=>void command({action:'visibility',id:choice.id,visible:choice.visibility!=='group'},choice.visibility==='group'?'Objekt wieder nur für SL sichtbar.':'Objekt für die simulierte Runde freigegeben.')} >{choice.visibility==='group'?<EyeOff size={16}/>:<Eye size={16}/>} {choice.visibility==='group'?'Wieder nur SL':'Für Runde zeigen'}</button><button disabled={busy} onClick={()=>{void command({action:'remove',id:choice.id},'Von der Bühne entfernt. Original bleibt erhalten.');setSelected('');}}>Von Bühne nehmen</button></div>}

      </div>}

    </main>

    <div data-layer="hud" className={styles.hud}>

      <nav className={styles.dock} aria-label="Spielaktionen"><IconButton label="Würfel öffnen" active={panel==='dice'} onClick={e=>openPanel('dice',e)}><Dices/></IconButton><IconButton label="Karte öffnen" active={panel==='map'} onClick={e=>openPanel('map',e)}><Map/></IconButton><IconButton label="Nachrichten öffnen" active={panel==='messages'} badge={viewer==='a'?1:0} onClick={e=>openPanel('messages',e)}><Mail/></IconButton></nav>

      {panel&&<aside ref={panelRef} aria-label={titles[panel]} className={`${styles.drawer} ${['scenes','npcs','documents'].includes(panel)?styles.leftDrawer:styles.rightDrawer}`}><header><div><small>{viewer==='gm'?'SL · LOKALE SIMULATION':'PERSÖNLICHE ANSICHT'}</small><h1>{titles[panel]}</h1></div><button type="button" aria-label="Werkzeug schließen" onClick={closePanel}><X/></button></header><div className={styles.drawerBody}>

        {panel==='scenes'&&<><p>Eine Kulisse für die Runde. Figuren, Dokumente und Skizzen bleiben beim Szenenwechsel erhalten.</p>{snapshot?.scenes.map(scene=><section className={styles.sceneChoice} key={scene.id}><img loading="lazy" src={`/prototype/media/${scene.image}?viewer=${viewer}`} alt=""/><div><h2>{scene.title}</h2><span>{snapshot.sharedScene===scene.id?'Für Runde aktiv':'Vorhandenes Projektmotiv'}</span><div><button disabled={busy} onClick={()=>{void command({action:'scene',id:scene.id},scene.title+' wird der simulierten Runde angezeigt.');}}>Für Runde anzeigen <ChevronRight size={14}/></button><button className={styles.quiet} disabled={busy} onClick={()=>void command({action:'scene',id:scene.id,preview:true},'Private Vorschau. Kein Szenenwechsel für die Runde.')}><EyeOff size={14}/> Privat ansehen</button></div></div></section>)}</>}

        {panel==='npcs'&&<><p>Bestehendes freigestelltes Originalbild. Auflegen bleibt zunächst privat.</p>{snapshot?.catalog.filter(o=>o.kind==='npc').map(o=><section key={o.id} className={styles.figureChoice}><img src={'/prototype/media/npc?viewer='+viewer} alt="Vorhandenes freigestelltes Bild von Herr Schäfer"/><h2>{o.title}</h2><button disabled={busy} onClick={async()=>{if(await command({action:'add',kind:'npc'},'Figur privat aufgelegt. Freigabe erfolgt getrennt.')){setSelected('npc');closePanel();}}}><Plus size={16}/> Figur auflegen</button></section>)}</>}

        {panel==='documents'&&<><p>Dokumente liegen als eigenständige Objekte auf der Bühne. Die Lesefassung öffnet sich nur für dich.</p>{viewer==='gm'?<section className={styles.documentChoice}><Files size={34}/><div><h2>Ankunft</h2><p>Synthetisches Testdokument · eine Seite</p></div><button disabled={busy} onClick={async()=>{if(await command({action:'add',kind:'document'},'Testdokument privat aufgelegt.')){setSelected('document');closePanel();}}}><Plus size={16}/> Auf die Bühne legen</button></section>:snapshot?.objects.filter(o=>o.kind==='document').map(o=><button key={o.id} onClick={e=>void openDocument(e)}>{o.title} öffnen <Expand size={16}/></button>)}{viewer!=='gm'&&!snapshot?.objects.some(o=>o.kind==='document')&&<p>Noch kein Dokument für dich freigegeben.</p>}</>}

        {panel==='notes'&&viewer==='gm'&&<><span className={styles.privateLabel}><Shield size={14}/> Privat · nur Spielleitung</span><h2>Unveröffentlichte Vorbereitung</h2><p>{snapshot?.privateNote}</p><p>Hier wird keine echte SL-Akte geladen oder verändert.</p></>}

        {panel==='sticky'&&<>

          <p>Ein Gedanke auf Papier. Neue Zettel sind <strong>privat: du &amp; SL</strong>. Andere Spieler sehen sie erst nach deiner Freigabe. Erst „Teilen“ macht sie für die Runde sichtbar.</p>

          <button disabled={busy||!snapshot||!!editingNoteId} onClick={()=>void createNote()}><Plus size={16}/> Neuer Notizzettel</button>

          {editingNoteId&&<p className={styles.muted}>Speichere den geöffneten Zettel oder brich die Bearbeitung ab.</p>}

          <button className={styles.noteToggle} aria-pressed={!!privateHidden[viewer]} disabled={!!editingNoteId} onClick={()=>showPrivate(!privateHidden[viewer])}>{privateHidden[viewer]?<Eye size={16}/>:<EyeOff size={16}/>} Eigene private Zettel {privateHidden[viewer]?'einblenden':'ausblenden'}</button>

          <p className={styles.muted}>Nur auf deiner Bühne ausblenden. Freigaben bleiben unverändert. Ziehe am Zettelkopf oder verschiebe ihn dort mit den Pfeiltasten.</p>

          <h2>Deine Zettel</h2>

          {!snapshot?.objects.some(o=>o.kind==='note'&&o.ownerId===viewer)&&<p className={styles.muted}>Noch kein eigener Zettel.</p>}

          {snapshot?.objects.filter(o=>o.kind==='note'&&o.ownerId===viewer).map(o=><section className={styles.noteListItem} key={o.id}><small>{o.visibility==='private'?'Privat · du & SL':'Gruppe · von dir'}</small><p>{o.kind==='note'?o.content.slice(0,90)||'Noch unbeschriftet':''}</p><button disabled={!!editingNoteId} onClick={()=>{showPrivate(false);setAnnotation(false);setSelected(o.id);closePanel();}}>Auf der Bühne zeigen <ChevronRight size={14}/></button></section>)}

          <h2>{viewer==='gm'?'Zettel der Runde':'Aus der Gruppe'}</h2>{viewer==='gm'&&<p className={styles.muted}>SL-Einsicht: Auch private Zettel sind hier vollständig lesbar. Änderungen bleiben beim Ersteller.</p>}

          {!snapshot?.objects.some(o=>o.kind==='note'&&o.ownerId!==viewer)&&<p className={styles.muted}>Noch keine geteilten Zettel anderer Teilnehmer.</p>}

          {snapshot?.objects.filter(o=>o.kind==='note'&&o.ownerId!==viewer).map(o=><section className={styles.noteListItem} key={o.id}><small>{o.kind==='note'?noteAuthor(o.ownerId):''} · {o.visibility==='private'?'Privat · SL-Einsicht':'Gruppe'}</small><p>{o.kind==='note'?(viewer==='gm'?o.content:o.content.slice(0,90))||'Noch unbeschriftet':''}</p></section>)}

          <p className={styles.muted}>Lokaler Testspielstand mit simulierten Rollen. Keine echte Anmeldung und kein Nachweis produktiver Zugriffssicherheit.</p>

        </>}

        {panel==='context'&&<><h2>{choice?.title||names[snapshot?.scene as keyof typeof names]||'Spielbühne'}</h2><p>{choice?choice.kind==='note'?'Nur die erstellende Person bearbeitet, verschiebt, löscht und teilt diesen Zettel.':choice.kind==='npc'?'Das vorhandene Bild ist eine Bühnenreferenz. Die echte NPC-Akte und ihre Freigaben bleiben unberührt.':'Eine persönliche Lesefassung öffnet sich unabhängig von Position und Größe auf der gemeinsamen Bühne.':'Eine eigenständige Ebene für Szene, Figuren, Dokumente und Skizzen.'}</p><dl><dt>Ansicht</dt><dd>{viewer==='gm'?'SL-Simulation':'Spieler-Simulation'}</dd><dt>Sichtbarkeit</dt><dd>{choice?.visibility==='private'?'Privat · Ersteller & SL':choice?.visibility==='sl'?'Nur SL':snapshot?.preview?'Private Vorschau':'Für simulierte Runde'}</dd></dl>{choice?.kind==='document'&&<button onClick={e=>void openDocument(e)}><Expand size={16}/> Lesefassung öffnen</button>}<p className={styles.muted}>Das Öffnen dieses Kontexts verändert die Bühne nicht.</p></>}

        {panel==='character'&&<><h2>Demo Spieler {viewer.toUpperCase()}</h2><p>Persönlicher Kontext bleibt von der gemeinsamen Bühne getrennt. Echte Charakterdaten werden in Etappe 1 nicht geladen.</p></>}

        {panel==='dice'&&<><p>Gemeinsame normale V20-Probe für diese synthetische Testrunde. Ein zentral erzeugter Wurf, dieselben Werte für SL und Spieler. Weitere Würfe warten auf deine bewusste Auswahl.</p><DicePanel mode="v20-normal" sharedRoll={sharedDice.roll} sharedLabel="Für die Runde würfeln" onShowRoll={sharedDice.show} history={[...sharedDice.events].reverse().map(e=>({id:e.id,at:e.at,report:e.result}))}/></>}

        {panel==='map'&&<><img className={styles.mapPreview} src={'/prototype/media/map?viewer='+viewer} alt="Vorhandene schematische Chronikkarte"/><button onClick={e=>{documentTrigger.current=e.currentTarget;setReadZoom(1);setMapOpen(true);}}><Expand size={16}/> Karte groß öffnen</button><p>Persönliche Testansicht der vorhandenen Karte. Keine unbekannten Ortsmarker oder echten Entdeckungsdaten.</p></>}

        {panel==='messages'&&<><h2>Demo-Postfach</h2><p>{viewer==='a'?'1 ungelesener synthetischer Testhinweis.':'Keine ungelesenen Testnachrichten.'}</p><p>Die produktive Nachrichtenzustellung und echte Postfächer sind nicht angebunden.</p></>}

        {panel==='help'&&<><h2>Die Bühne gehört eurer Runde.</h2><ol><li>Links eine Szene wählen und für die Runde anzeigen.</li><li>Eine Figur oder ein Dokument auflegen. Neue Objekte bleiben zunächst nur für SL sichtbar.</li><li>Das Objekt auswählen und bewusst „Für Runde zeigen“ drücken.</li><li>Per Griff ziehen oder mit Pfeiltasten und den Positionsknöpfen verschieben.</li><li>„Lesen“ öffnet nur deine eigene Ansicht. Escape schließt Werkzeuge.</li></ol><p>Links und rechts öffnet jeweils nur eine Arbeitsfläche. Szenenwechsel löscht keine Objekte. Der lokale Testspielstand wird privat auf diesem Rechner gespeichert; auch Notizzettel bleiben nach Neuladen erhalten.</p></>}

      </div></aside>}

      {(notice||error)&&<div className={`${styles.toast} ${error?styles.error:''}`} role={error?'alert':'status'}>{error?<AlertTriangle size={17}/>:<Check size={17}/>}<span>{error||notice}</span>{error&&<button onClick={()=>setError('')} aria-label="Fehlermeldung schließen"><X size={16}/></button>}</div>}

    </div>

    <dialog ref={dialog} className={styles.reader} aria-label={mapOpen?'Persönliche Kartenansicht':'Persönliche Dokumentansicht'} onCancel={()=>{setDocument(null);setMapOpen(false);}} onClose={()=>{setDocument(null);setMapOpen(false);}}><header><div><small>PERSÖNLICHE ANSICHT</small><h2>{mapOpen?'Chronikkarte':document?.title}</h2></div><div><button aria-label="Lesefassung verkleinern" onClick={()=>setReadZoom(v=>Math.max(.6,v-.2))}><Minus/></button><span>{Math.round(readZoom*100)} %</span><button aria-label="Lesefassung vergrößern" onClick={()=>setReadZoom(v=>Math.min(2.4,v+.2))}><Plus/></button><button aria-label="Lesegröße zurücksetzen" onClick={()=>setReadZoom(1)}><RotateCcw/></button><button aria-label="Zur Bühne zurück" onClick={closeDocument}><X/></button></div></header><div className={styles.readerViewport}>{mapOpen?<img src={'/prototype/media/map?viewer='+viewer} alt="Schematische Chronikkarte" style={{width:760*readZoom}}/>:<article className={styles.readPaper} style={{width:680*readZoom,fontSize:18*readZoom}}><small>{document?.subtitle}</small><h1>{document?.title}</h1>{document?.paragraphs.map(p=><p key={p}>{p}</p>)}<footer>{document?.footer}</footer></article>}</div></dialog>

  </div>;

}

createRoot(window.document.getElementById('root')!).render(<App/>);

