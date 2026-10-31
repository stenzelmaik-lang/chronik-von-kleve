"use client";
/* eslint-disable @next/next/no-img-element -- Static device artwork from /public; no optimization proxy needed. */
import {useEffect,useRef,useState,type KeyboardEvent,type ReactNode} from 'react';
import {Volume2,VolumeX,ChevronDown} from 'lucide-react';
import {pagerBaseMenu,pagerDeviceMessages,pagerUnread,pagerKeyOf,pressPagerKey,pagerArrivals,settlePagerDevice,initialPagerDevice,type PagerKey,type PagerDeviceMessage,type PagerDeviceState} from '@/domain/ultio-pager';
import type {PagerMessage} from './types';
import styles from './ultio-pager.module.css';

/**
 * ULTIO pager R-03. The black housing is an image layer; the LCD is live HTML on top of the cleared display area,
 * so content, colours and views change at runtime without touching the artwork. Five transparent key areas sit
 * exactly over the keys in the image. Coordinates: percent of the 1448 x 1086 artwork (see ultio-pager.module.css).
 */
export const ULTIO_ASSETS={shell:'/spieltisch/pager/ultio-shell.webp',ping:'/spieltisch/pager/ping-normal.wav',alarm:'/spieltisch/pager/alarm-urgent.wav'};
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
 return <div className={styles.device} data-shell="ultio" data-theme={theme} tabIndex={0} role="group" aria-roledescription="Pager" aria-label="Pager ULTIO R-03. Bedienung über die fünf Tasten oder mit Pfeiltasten, Enter, Escape und M." onKeyDown={keydown}>
  <img className={styles.shell} src={ULTIO_ASSETS.shell} alt="" draggable={false}/>
  <div className={styles.screen} aria-live="polite">{view.render({messages,device,unread:pagerUnread(messages),receiver,muted,now})}</div>
  <div className={styles.keys}>{(['menu','up','down','ok','back'] as const).map(k=><button type="button" key={k} className={styles.key} data-key={k} aria-label={keyLabels[k]} onClick={e=>{e.stopPropagation();onKey(k);}}/>)}</div>
 </div>;
}

/**
 * A player's pager on the table: a prop that floats in when a message arrives and folds away into a small button.
 * Only the viewer's own messages arrive here (server filtered). OK on an open message acknowledges it to the GM.
 */
export function UltioPager({pagers,runId,actorId,receiver,onAcknowledge}:{pagers:PagerMessage[];runId:string;actorId:string;receiver:string;onAcknowledge:(id:string)=>void}){
 const openedKey='chroniplay:pager:'+runId+':'+actorId,muteKey='chroniplay:pager-ton:'+actorId;
 const [opened,setOpened]=useState<string[]>(()=>readList(openedKey));
 const [acked,setAcked]=useState<string[]>([]);
 const [muted,setMuted]=useState(()=>{try{return window.localStorage.getItem(muteKey)==='1';}catch{return false;}});
 const [expanded,setExpanded]=useState(false),[device,setDevice]=useState<PagerDeviceState>(initialPagerDevice),[announce,setAnnounce]=useState('');
 const known=useRef<string[]|null>(null),deviceRef=useRef<HTMLDivElement>(null),launcher=useRef<HTMLButtonElement>(null);
 const messages=pagerDeviceMessages(pagers,opened,acked),unread=pagerUnread(messages);
 const ids=messages.map(m=>m.id).join('|');
 const urgentOpen=messages.some(m=>m.urgent&&!m.acknowledged);
 const selected=messages.find(m=>m.id===device.selectedId);

 // New ids float the pager in and ring once (if not muted and the browser allows sound). A reload restores
 // the badge from the real ids without ringing again.
 useEffect(()=>{
  const list=ids?ids.split('|'):[];
  const arrivals=pagerArrivals(known.current,messages);known.current=list;
  queueMicrotask(()=>setDevice(old=>settlePagerDevice(old,messages)));
  if(!arrivals.length)return;
  const newest=arrivals[0];
  // Someone reading an open message keeps it; a folded pager opens on the inbox with the newest message selected.
  queueMicrotask(()=>{setDevice(old=>expanded&&old.view==='message'?old:{...old,view:'inbox',inboxIndex:0});setExpanded(true);setAnnounce('Neue Pager-Nachricht'+(newest.sender?' von '+newest.sender:'')+(newest.urgent?', dringend':''));});
  if(!muted){try{const sound=new Audio(arrivals.some(m=>m.urgent)?ULTIO_ASSETS.alarm:ULTIO_ASSETS.ping);sound.volume=.6;void sound.play().catch(()=>{/* blocked until the player interacts; the badge still shows */});}catch{/* no audio support */}}
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs per change of the message ids only
 },[ids]);
 useEffect(()=>{try{window.localStorage.setItem(muteKey,muted?'1':'0');}catch{/* storage unavailable */}},[muted,muteKey]);

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
 return <section className={styles.pager} aria-label="Pager" data-expanded={expanded} data-alert={urgentOpen}>
  <span className={styles.srOnly} role="status">{announce}</span>
  {expanded?<div ref={deviceRef} className={styles.window}>
   <div className={styles.toolbar}>
    <button type="button" aria-pressed={muted} aria-label={muted?'Pager-Ton einschalten':'Pager stummschalten'} onClick={()=>setMuted(m=>!m)}>{muted?<VolumeX size={14}/>:<Volume2 size={14}/>} {muted?'Stumm':'Ton an'}</button>
    <button type="button" aria-label="Pager zuklappen" onClick={collapse}><ChevronDown size={14}/> Zuklappen</button></div>
   <UltioPagerDevice messages={messages} device={device} receiver={receiver} muted={muted} theme={device.view==='message'&&selected?.urgent?'red':'green'} onKey={key}/>
  </div>:
  <button ref={launcher} type="button" className={styles.launcher} aria-label={'Pager öffnen'+(unread?', '+unread+(unread===1?' neue Meldung':' neue Meldungen'):'')} onClick={expand}>
   <img src={ULTIO_ASSETS.shell} alt="" draggable={false}/>{unread>0&&<span className={styles.badge} data-pager-badge="">{unread>99?'99+':unread}</span>}
  </button>}
 </section>;
}
