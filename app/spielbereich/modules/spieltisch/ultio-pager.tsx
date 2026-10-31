"use client";
/* eslint-disable @next/next/no-img-element -- Static device artwork from /public; no optimization proxy needed. */
import {useCallback,useEffect,useRef,useState,type KeyboardEvent,type PointerEvent as ReactPointerEvent,type MouseEvent as ReactMouseEvent,type ReactNode} from 'react';
import {Volume2,VolumeX,ChevronDown,Radio,X,BellRing} from 'lucide-react';
import {pagerBaseMenu,pagerDeviceMessages,pagerUnread,pagerKeyOf,pressPagerKey,pagerRing,pagerReadsToSync,settlePagerDevice,initialPagerDevice,type PagerKey,type PagerDeviceMessage,type PagerDeviceState} from '@/domain/ultio-pager';
import {playPagerSound,unlockPagerSound,pagerSoundState,onPagerSoundChange,ULTIO_SOUNDS,type PagerSoundState} from './pager-sound';
import type {PagerMessage} from './types';
import styles from './ultio-pager.module.css';

/**
 * ULTIO pager R-03. The black housing is an image layer; the LCD is live HTML on top of the cleared display area,
 * so content, colours and views change at runtime without touching the artwork. Five transparent key areas sit
 * exactly over the keys in the image. Coordinates: percent of the 1448 x 1086 artwork (see ultio-pager.module.css).
 */
export const ULTIO_ASSETS={shell:'/spieltisch/pager/ultio-shell.webp',...ULTIO_SOUNDS};
export type PagerTheme='green'|'amber'|'ice'|'red';
export type PagerDisplayContext={messages:PagerDeviceMessage[];device:PagerDeviceState;unread:number;receiver:string;muted:boolean;now:number};
export type PagerDisplay={render:(c:PagerDisplayContext)=>ReactNode;menu?:boolean};

const pad=(n:number)=>String(n).padStart(2,'0');
export function pagerTime(value:string|number){const d=new Date(value);return Number.isNaN(d.getTime())?'--:--':pad(d.getHours())+':'+pad(d.getMinutes());}
function Header({label,now}:{label:string;now:number}){return <div className={styles.lcdHeader}><span aria-hidden="true">▮▮▮▯</span><span className={styles.ellipsis}>{label}</span><span>{pagerTime(now)}</span></div>;}
function Footer({left,right}:{left:string;right:string}){return <div className={styles.lcdFooter}><span>{left}</span><span>{right}</span></div>;}

const defaultDisplays:Record<string,PagerDisplay>={
 home:{menu:true,render:({unread,receiver,now})=><div className={styles.lcd} data-view="home"><Header label="SYSTEM BEREIT" now={now}/>
  <div className={styles.home}><small>VERSCHLÜSSELTER KANAL</small><strong>EMPFANG AKTIV</strong><small className={styles.ellipsis}>{receiver}</small></div>
  <div className={styles.count}><b>{unread}</b><span>{unread===1?'NEUE MELDUNG':'NEUE MELDUNGEN'}</span></div>
  <Footer left="MENU = ANSICHT" right="OK = EINGANG"/></div>},
 inbox:{menu:true,render:({messages,device,now})=>{
  const offset=Math.max(0,Math.min(device.inboxIndex-1,messages.length-3));
  return <div className={styles.lcd} data-view="inbox"><Header label={'EINGANG ('+messages.length+')'} now={now}/>
   <ul className={styles.list}>{!messages.length?<li className={styles.empty}>KEINE NACHRICHTEN</li>:messages.slice(offset,offset+3).map((m,i)=><li key={m.id} data-message={m.id} data-selected={offset+i===device.inboxIndex} data-unread={!m.opened} data-acknowledged={m.acknowledged}>
    <span className={styles.ellipsis}>{!m.opened?'● ':''}{m.sender||'UNBEKANNT'}</span><span className={styles.ellipsis}>{m.urgent?'! ':''}{m.title||m.text}</span><time>{m.acknowledged?'✓ ':''}{pagerTime(m.at)}</time></li>)}</ul>
   <Footer left="▲▼ = AUSWAHL" right="OK = LESEN"/></div>;}},
 message:{render:({messages,device,now})=>{
  const m=messages.find(x=>x.id===device.selectedId);
  if(!m)return <div className={styles.lcd} data-view="message"><Header label="MELDUNG" now={now}/><p className={styles.empty}>MELDUNG NICHT GEFUNDEN</p><Footer left="ZURÜCK" right=""/></div>;
  return <div className={styles.lcd} data-view="message" data-urgent={m.urgent}><Header label={m.urgent?'!! DRINGEND':'MELDUNG'} now={now}/>
   <div className={styles.meta}><span className={styles.ellipsis}>{m.sender||'UNBEKANNT'}</span><span>{pagerTime(m.at)}</span></div>
   <div className={styles.body} data-pager-scroll="">{m.title&&<strong>{m.title}</strong>}<p>{m.text}</p></div>
   <Footer left="▲▼ = SCROLLEN" right={m.acknowledged?'QUITTIERT ✓':'OK = QUITTIEREN'}/></div>;}},
 status:{menu:true,render:({messages,receiver,muted,now})=><div className={styles.lcd} data-view="status"><Header label="STATUS" now={now}/>
  <dl className={styles.status}><dt>GERÄT</dt><dd>ULTIO R-03</dd><dt>EMPFÄNGER</dt><dd className={styles.ellipsis}>{receiver}</dd><dt>NACHRICHTEN</dt><dd>{messages.length}</dd><dt>QUITTIERT</dt><dd>{messages.filter(m=>m.acknowledged).length}</dd><dt>TON</dt><dd>{muted?'STUMM':'AKTIV'}</dd></dl>
  <Footer left="SPIELNETZ" right="MENU = WEITER"/></div>},
};
const displays=new Map<string,PagerDisplay>(Object.entries(defaultDisplays));
/** Adds or replaces an LCD view (like registerDisplay in the delivered prototype). With menu:true, MENU reaches it. */
export function registerPagerDisplay(name:string,display:PagerDisplay){
 if(!/^[a-z][a-z\d_-]{1,39}$/i.test(name))throw new TypeError('Display-Name ungültig.');
 displays.set(name,display);
}
const menuViews=()=>[...pagerBaseMenu.filter(v=>displays.get(v)?.menu),...[...displays.entries()].filter(([name,d])=>d.menu&&!pagerBaseMenu.includes(name)).map(([name])=>name)];

const keyLabels:Record<PagerKey,string>={menu:'Menü: Ansicht wechseln',up:'Nach oben',down:'Nach unten',ok:'OK: öffnen oder quittieren',back:'Zurück'};
function readList(key:string){try{const v=JSON.parse(window.localStorage.getItem(key)||'[]');return Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'):[];}catch{return [];}}
function writeList(key:string,list:string[]){try{window.localStorage.setItem(key,JSON.stringify(list.slice(-100)));}catch{/* storage unavailable */}}

/** The device itself: housing, live LCD and five key areas. Clicks outside the keys do nothing. */
export function UltioPagerDevice({messages,device,receiver,muted,theme='green',onKey}:{messages:PagerDeviceMessage[];device:PagerDeviceState;receiver:string;muted:boolean;theme?:PagerTheme;onKey:(key:PagerKey)=>void}){
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const t=window.setInterval(()=>setNow(Date.now()),20000);return()=>window.clearInterval(t);},[]);
 const view=displays.get(device.view)??displays.get('home')!;
 const keydown=(e:KeyboardEvent<HTMLDivElement>)=>{if(e.altKey||e.ctrlKey||e.metaKey)return;const key=pagerKeyOf(e.key);if(!key||(e.target as Element).closest('input,textarea,select'))return;e.preventDefault();onKey(key);};
 return <div className={styles.device} data-shell="ultio" data-drag-handle="" data-theme={theme} tabIndex={0} role="group" aria-roledescription="Pager" aria-label="Pager ULTIO R-03. Bedienung über die fünf Tasten oder mit Pfeiltasten, Enter, Escape und M." onKeyDown={keydown}>
  <img className={styles.shell} src={ULTIO_ASSETS.shell} alt="" draggable={false}/>
  <div className={styles.screen} aria-live="polite">{view.render({messages,device,unread:pagerUnread(messages),receiver,muted,now})}</div>
  <div className={styles.keys}>{(['menu','up','down','ok','back'] as const).map(k=><button type="button" key={k} className={styles.key} data-key={k} aria-label={keyLabels[k]} onClick={e=>{e.stopPropagation();onKey(k);}}/>)}</div>
 </div>;
}

/**
 * The pager lies freely on the table like the other props: dragged by its housing (never by the five keys), with
 * mouse or touch. The position is personal, remembered per person in this browser, as fractions of the free space,
 * so it stays fully visible on any screen size. A short tap (under 6 px of movement) still counts as a click.
 */
function usePagerPosition(ref:{current:HTMLElement|null},storageKey:string,active:boolean,layout:unknown){
 const [pos,setPos]=useState<{x:number;y:number}|null>(null);
 const drag=useRef<{id:number;sx:number;sy:number;left:number;top:number;moved:boolean}|null>(null),swallow=useRef(false);
 const unit=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?Math.min(1,Math.max(0,v)):null;
 useEffect(()=>{queueMicrotask(()=>{try{const v=JSON.parse(window.localStorage.getItem(storageKey)||'null');const x=unit(v?.x),y=unit(v?.y);if(x!==null&&y!==null)setPos({x,y});}catch{/* storage unavailable */}});},[storageKey]);
 const place=useCallback(()=>{
  const el=ref.current,box=el?.offsetParent as HTMLElement|null;if(!el||!box||!pos||drag.current?.moved)return;
  el.style.left=pos.x*Math.max(0,box.clientWidth-el.offsetWidth)+'px';el.style.top=pos.y*Math.max(0,box.clientHeight-el.offsetHeight)+'px';el.style.right='auto';el.style.bottom='auto';
 },[pos,ref]);
 useEffect(()=>{if(!active)return;place();const el=ref.current;if(!el)return;const o=new ResizeObserver(place);o.observe(el);if(el.offsetParent)o.observe(el.offsetParent);return()=>o.disconnect();},[place,active,layout,ref]);
 const handlers={
  onPointerDown:(e:ReactPointerEvent<HTMLElement>)=>{
   const t=e.target as Element,button=t.closest('button');
   if(e.button!==0||t.closest('[data-key]')||(button&&!button.hasAttribute('data-drag-handle'))||!t.closest('[data-drag-handle]'))return;
   const el=ref.current,box=el?.offsetParent as HTMLElement|null;if(!el||!box)return;
   const r=el.getBoundingClientRect(),b=box.getBoundingClientRect();
   drag.current={id:e.pointerId,sx:e.clientX,sy:e.clientY,left:r.left-b.left,top:r.top-b.top,moved:false};
  },
  onPointerMove:(e:ReactPointerEvent<HTMLElement>)=>{
   const d=drag.current,el=ref.current,box=el?.offsetParent as HTMLElement|null;if(!d||d.id!==e.pointerId||!el||!box)return;
   const dx=e.clientX-d.sx,dy=e.clientY-d.sy;
   if(!d.moved){if(Math.hypot(dx,dy)<6)return;d.moved=true;el.setPointerCapture(e.pointerId);el.dataset.dragging='true';}
   e.preventDefault();
   el.style.left=Math.min(Math.max(0,d.left+dx),Math.max(0,box.clientWidth-el.offsetWidth))+'px';
   el.style.top=Math.min(Math.max(0,d.top+dy),Math.max(0,box.clientHeight-el.offsetHeight))+'px';el.style.right='auto';el.style.bottom='auto';
  },
  onPointerUp:(e:ReactPointerEvent<HTMLElement>)=>{
   const d=drag.current,el=ref.current,box=el?.offsetParent as HTMLElement|null;drag.current=null;if(!d||!d.moved||!el||!box)return;
   delete el.dataset.dragging;if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);swallow.current=true;
   const fw=Math.max(1,box.clientWidth-el.offsetWidth),fh=Math.max(1,box.clientHeight-el.offsetHeight);
   const next={x:Math.min(1,Math.max(0,parseFloat(el.style.left)/fw)),y:Math.min(1,Math.max(0,parseFloat(el.style.top)/fh))};
   setPos(next);try{window.localStorage.setItem(storageKey,JSON.stringify(next));}catch{/* storage unavailable */}
  },
  onPointerCancel:()=>{const el=ref.current;if(el)delete el.dataset.dragging;drag.current=null;queueMicrotask(()=>setPos(p=>p?{...p}:p));},
  // A drag ends without the click that would open the folded pager.
  onClickCapture:(e:ReactMouseEvent<HTMLElement>)=>{if(swallow.current){swallow.current=false;e.preventDefault();e.stopPropagation();}},
 };
 return handlers;
}

/**
 * A player's pager on the table: a prop that floats in when a message arrives and folds away into a small button.
 * Only the viewer's own messages arrive here (server filtered). OK on an open message acknowledges it to the GM.
 */
export function UltioPager({pagers,runId,actorId,receiver,onAcknowledge,onRead,onArrival}:{pagers:PagerMessage[];runId:string;actorId:string;receiver:string;onAcknowledge:(id:string)=>void;onRead:(id:string)=>void;onArrival?:()=>void}){
 const openedKey='chroniplay:pager:'+runId+':'+actorId,muteKey='chroniplay:pager-ton:'+actorId,heardKey='chroniplay:pager-gehoert:'+runId+':'+actorId;
 const [sound,setSound]=useState<PagerSoundState>('locked');
 const heard=useRef<Set<string>|null>(null),readsSent=useRef(new Set<string>());
 const [opened,setOpened]=useState<string[]>(()=>readList(openedKey));
 const [acked,setAcked]=useState<string[]>([]);
 const [muted,setMuted]=useState(()=>{try{return window.localStorage.getItem(muteKey)==='1';}catch{return false;}});
 const [expanded,setExpanded]=useState(false),[device,setDevice]=useState<PagerDeviceState>(initialPagerDevice),[announce,setAnnounce]=useState('');
 const deviceRef=useRef<HTMLDivElement>(null),launcher=useRef<HTMLButtonElement>(null);
 const messages=pagerDeviceMessages(pagers,opened,acked),unread=pagerUnread(messages);
 const ids=messages.map(m=>m.id).join('|');
 const urgentOpen=messages.some(m=>m.urgent&&!m.acknowledged);
 const selected=messages.find(m=>m.id===device.selectedId);

 // New ids float the pager in and ring once (if not muted and the browser allows sound). A reload restores
 // the badge from the real ids without ringing again.
 useEffect(()=>{
  // The first look (mount or reload) only remembers what is there; ids heard once never ring again.
  const first=heard.current===null;
  if(first)heard.current=new Set(readList(heardKey));
  const {fresh,kind,heard:next}=pagerRing(first?new Set([...heard.current!,...messages.map(m=>m.id)]):heard.current!,messages);
  heard.current=next;writeList(heardKey,[...next]);
  queueMicrotask(()=>setDevice(old=>settlePagerDevice(old,messages)));
  if(!fresh.length||!kind)return;
  const newest=fresh[0];
  // Someone reading an open message keeps it; a folded pager opens on the inbox with the newest message selected.
  // A personal reader or media view (a modal dialog) would cover the device and make it unusable: the table closes it.
  onArrival?.();
  queueMicrotask(()=>{setDevice(old=>expanded&&old.view==='message'?old:{...old,view:'inbox',inboxIndex:0});setExpanded(true);setAnnounce('Neue Pager-Nachricht'+(newest.sender?' von '+newest.sender:'')+(newest.urgent?', dringend':''));});
  if(!muted)void playPagerSound(kind);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs per change of the message ids only
 },[ids]);
 useEffect(()=>{try{window.localStorage.setItem(muteKey,muted?'1':'0');}catch{/* storage unavailable */}},[muted,muteKey]);
 // Browsers allow sound only after an interaction: any tap, click or key press on the page unlocks it for later rings.
 useEffect(()=>{
  const sync=()=>setSound(pagerSoundState());queueMicrotask(sync);
  const unlock=()=>{if(pagerSoundState()==='locked')void unlockPagerSound();};
  window.addEventListener('pointerdown',unlock,true);window.addEventListener('keydown',unlock,true);
  const off=onPagerSoundChange(sync);
  return()=>{off();window.removeEventListener('pointerdown',unlock,true);window.removeEventListener('keydown',unlock,true);};
 },[]);
 const activateSound=()=>void unlockPagerSound().then(ok=>{setSound(pagerSoundState());if(ok)void playPagerSound('ping');});
 // Read receipts the server is missing (failed request, another tab, opened before a reload) are sent again, once per id
 // until the server has them. Read never goes back to unread: the server keeps it, the local list only grows.
 useEffect(()=>{
  for(const id of pagerReadsToSync(pagers,opened,readsSent.current)){readsSent.current.add(id);onRead(id);window.setTimeout(()=>readsSent.current.delete(id),8000);}
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to fresh snapshots and new local reads only
 },[pagers,opened]);
 const section=useRef<HTMLElement>(null),drag=usePagerPosition(section,'chroniplay:pager-position:'+actorId,pagers.length>0,expanded);

 // Opening a message shows its content: it counts as read at once (badge and counter) and is reported to the server.
 const markOpened=(id:string)=>setOpened(old=>{if(old.includes(id))return old;const next=[...old,id];writeList(openedKey,next);return next;});
 function key(k:PagerKey){
  const {state,effect}=pressPagerKey(device,k,messages,menuViews());
  setDevice(state);
  if(effect?.type==='opened')markOpened(effect.id);
  else if(effect?.type==='acknowledge'){markOpened(effect.id);setAcked(old=>[...old,effect.id]);setAnnounce('Meldung quittiert.');onAcknowledge(effect.id);}
  else if(effect?.type==='collapse')collapse();
  else if(effect?.type==='scroll'){const body=deviceRef.current?.querySelector<HTMLElement>('[data-pager-scroll]');if(body)body.scrollTop+=effect.step*Math.max(24,body.clientHeight*.6);}
 }
 function expand(){setExpanded(true);queueMicrotask(()=>deviceRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus({preventScroll:true}));}
 function collapse(){setExpanded(false);queueMicrotask(()=>launcher.current?.focus({preventScroll:true}));}
 if(!messages.length)return null;
 return <section ref={section} {...drag} className={styles.pager} aria-label="Pager" data-expanded={expanded} data-alert={urgentOpen}>
  <span className={styles.srOnly} role="status">{announce}</span>
  {expanded?<div ref={deviceRef} className={styles.window}>
   <div className={styles.toolbar}>
    {!muted&&sound==='locked'&&<button type="button" className={styles.soundOn} data-sound-unlock="" onClick={activateSound}><BellRing size={14}/> Ton aktivieren</button>}
    <button type="button" aria-pressed={muted} aria-label={muted?'Pager-Ton einschalten':'Pager stummschalten'} onClick={()=>{if(muted)activateSound();setMuted(m=>!m);}}>{muted?<VolumeX size={14}/>:<Volume2 size={14}/>} {muted?'Stumm':'Ton an'}</button>
    <button type="button" aria-label="Pager zuklappen" onClick={collapse}><ChevronDown size={14}/> Zuklappen</button></div>
   <UltioPagerDevice messages={messages} device={device} receiver={receiver} muted={muted} theme={device.view==='message'&&selected?.urgent?'red':'green'} onKey={key}/>
  </div>:
  <button ref={launcher} type="button" className={styles.launcher} data-drag-handle="" aria-label={'Pager öffnen'+(unread?', '+unread+(unread===1?' neue Meldung':' neue Meldungen'):'')} onClick={expand}>
   <img src={ULTIO_ASSETS.shell} alt="" draggable={false}/>{unread>0&&<span className={styles.badge} data-pager-badge="">{unread>99?'99+':unread}</span>}
  </button>}
 </section>;
}

/**
 * The GM's mirror of sent pagers on the table: the same ULTIO device, read-only, so the GM sees what went out and
 * who confirmed it. The table may be on a shared screen: messages to the whole round show their text, targeted ones
 * only the recipients (the content stays in the Regie). It never acknowledges anything.
 */
export function PagerMirror({pagers,crew,actorId}:{pagers:PagerMessage[];crew:{id:string;name:string}[];actorId:string}){
 const [open,setOpen]=useState(false),[announce,setAnnounce]=useState(''),[device,setDevice]=useState<PagerDeviceState>({...initialPagerDevice(),view:'inbox'});
 const known=useRef<string[]|null>(null),fold=useRef(0);
 const list=[...pagers].sort((x,y)=>y.at.localeCompare(x.at)||y.id.localeCompare(x.id));
 const ids=list.map(p=>p.id).join('|');
 const section=useRef<HTMLElement>(null),drag=usePagerPosition(section,'chroniplay:pager-spiegel-position:'+actorId,list.length>0,open);
 useEffect(()=>{
  const now=ids?ids.split('|'):[],previous=known.current;known.current=now;
  if(previous===null||!now.some(id=>!previous.includes(id)))return;
  // A new message unfolds the mirror on the inbox for a moment, then it folds back on its own.
  queueMicrotask(()=>{setOpen(true);setDevice(d=>({...d,view:'inbox',inboxIndex:0}));setAnnounce('Pager gesendet.');});
  window.clearTimeout(fold.current);fold.current=window.setTimeout(()=>setOpen(false),12000);
 },[ids]);
 useEffect(()=>()=>window.clearTimeout(fold.current),[]);
 if(!list.length)return null;
 const name=(id:string)=>crew.find(m=>m.id===id)?.name||'?';
 const total=(p:PagerMessage)=>p.recipients?p.recipients.length:crew.length;
 const readIds=(p:PagerMessage)=>[...new Set([...(p.reads||[]),...(p.acks||[])].map(x=>x.id))];
 const readers=(p:PagerMessage)=>{const read=readIds(p);return read.length?'Gelesen '+read.length+'/'+total(p)+': '+read.map(name).join(', ')+(p.acks?.length?' · quittiert '+p.acks.length:''):'Noch nicht gelesen';};
 const messages:PagerDeviceMessage[]=list.map(p=>({id:p.id,at:p.at,opened:true,urgent:p.priority==='hoch',acknowledged:(p.acks?.length||0)>=total(p)&&total(p)>0,
  ...(p.recipients?{sender:'SL',title:'GEZIELT',text:'An '+p.recipients.map(name).join(', ')+'. Inhalt nur in der Regie.'}:{sender:p.sender||'',title:p.title||'',text:p.text})}));
 const latest=list[0],selected=messages.find(m=>m.id===device.selectedId);
 function key(k:PagerKey){const {state,effect}=pressPagerKey(device,k,messages,menuViews());setDevice(state);if(effect?.type==='collapse')setOpen(false);}
 return <section ref={section} {...drag} className={styles.mirror} aria-label="Pager-Spiegel" data-open={open}>
  <span className={styles.srOnly} role="status">{announce}</span>
  {/* Freestanding device like the players' pager: no window, only a small close button and the read status. */}
  {open?<div className={styles.mirrorFree}>
   <button type="button" className={styles.mirrorClose} aria-label="Pager-Spiegel zuklappen" onClick={()=>{window.clearTimeout(fold.current);setOpen(false);}}><X size={14}/></button>
   <div className={styles.mirrorDevice} data-drag-handle=""><UltioPagerDevice messages={messages} device={device} receiver="SL · SPIEGEL" muted theme={device.view==='message'&&selected?.urgent?'red':'green'} onKey={key}/></div>
   <p style={{order:-1}} className={styles.mirrorStatus} data-mirror-pager={latest.id}><Radio size={12} aria-hidden="true"/>{pagerTime(latest.at)} · {latest.recipients?'an '+latest.recipients.map(name).join(', '):<>an alle · <span className={styles.mirrorText}>{latest.title?latest.title+': ':''}{latest.text}</span></>} · <span className={styles.mirrorAcks}>{readers(latest)}</span></p>
  </div>:
  <button type="button" className={`${styles.launcher} ${styles.mirrorChip}`} data-drag-handle="" title={'Pager-Spiegel · zuletzt '+pagerTime(latest.at)+(latest.recipients?' gezielt':' an alle')} aria-label={'Pager-Spiegel öffnen, '+list.length+(list.length===1?' gesendete Nachricht':' gesendete Nachrichten')} onClick={()=>setOpen(true)}><img src={ULTIO_ASSETS.shell} alt="" draggable={false}/><span className={styles.badge} data-sent="">{list.length}</span></button>}
 </section>;
}
