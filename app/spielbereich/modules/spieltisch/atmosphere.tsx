"use client";
/* eslint-disable @next/next/no-img-element -- Static placeholder art; no optimization proxy needed. */
import {useEffect,useRef,useState} from 'react';
import {Music,Play,Pause,Volume2,VolumeX,Check} from 'lucide-react';
import type {StageEffect} from '@/domain/live-stage';
import type {PagerMessage} from './types';
import styles from './atmosphere.module.css';

/**
 * Pager artwork. Replace the file (same name) or point src at the delivered asset, then adjust the display
 * area in percent of the image so the message sits on the LCD. ratio is the image width divided by its height.
 */
export const PAGER_ASSET={src:'/spieltisch/pager-platzhalter.svg',ratio:320/200,screen:{left:12.5,top:18,width:75,height:40}};
export const effectLabels:Record<StageEffect,string>={rain:'Regen',fog:'Nebel'};

/** Weather over the backdrop, under all table objects. Purely visual; reduced motion keeps a calm still image. */
export function StageEffects({effects}:{effects:StageEffect[]}){
 if(!effects.length)return null;
 return <div className={styles.effects} data-layer="atmosphere">
  {effects.includes('fog')&&<div className={styles.fog} data-effect="fog" aria-hidden="true"><span/><span/></div>}
  {effects.includes('rain')&&<div className={styles.rain} data-effect="rain" aria-hidden="true"><span/><span/></div>}
  <span className={styles.srOnly} role="status">Atmosphäre: {effects.map(e=>effectLabels[e]).join(', ')}</span>
 </div>;
}

function readNumber(key:string,fallback:number){try{const v=Number(window.localStorage.getItem(key));return window.localStorage.getItem(key)!==null&&Number.isFinite(v)?Math.min(1,Math.max(0,v)):fallback;}catch{return fallback;}}

/** Shared background music. Each viewer controls volume and mute; when the browser blocks autoplay, a button appears. */
export function BackgroundMusic({music,src,actorId}:{music:{title:string;key:string};src:string;actorId:string}){
 const audio=useRef<HTMLAudioElement>(null),volumeKey='chroniplay:musik-lautstaerke:'+actorId;
 const [volume,setVolume]=useState(()=>readNumber(volumeKey,.5)),[muted,setMuted]=useState(false),[playing,setPlaying]=useState(false),[blocked,setBlocked]=useState(false);
 useEffect(()=>{const el=audio.current;if(el){el.volume=volume;el.muted=muted;}try{window.localStorage.setItem(volumeKey,String(volume));}catch{/* storage unavailable */}},[volume,muted,volumeKey]);
 const play=async()=>{const el=audio.current;if(!el)return;try{await el.play();setBlocked(false);}catch{setBlocked(true);}};
 // A new track (key) is offered once; the browser decides whether it may start on its own.
 useEffect(()=>{queueMicrotask(()=>void play());const el=audio.current;return()=>el?.pause();},[music.key]);
 return <div className={styles.music} role="group" aria-label="Hintergrundmusik">
  <audio ref={audio} src={src} loop preload="auto" onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)}/>
  <Music size={15} aria-hidden="true"/><span className={styles.musicTitle} title={music.title}>{music.title}</span>
  {blocked&&!playing?<button type="button" className={styles.musicStart} onClick={()=>void play()}><Play size={14}/> Musik abspielen</button>
   :playing?<button type="button" aria-label="Musik pausieren" onClick={()=>audio.current?.pause()}><Pause size={14}/></button>:<button type="button" aria-label="Musik abspielen" onClick={()=>void play()}><Play size={14}/></button>}
  <button type="button" aria-label={muted?'Musik einschalten':'Musik stummschalten'} aria-pressed={muted} onClick={()=>setMuted(m=>!m)}>{muted?<VolumeX size={14}/>:<Volume2 size={14}/>}</button>
  <input type="range" aria-label="Eigene Musiklautstärke" min={0} max={1} step={.05} value={volume} onChange={e=>setVolume(Number(e.target.value))}/>
 </div>;
}

function readAcknowledged(key:string):string[]{try{const v=JSON.parse(window.localStorage.getItem(key)||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string'):[];}catch{return [];}}

/** The pager device itself: artwork plus the message on its display. */
export function PagerDevice({text,at,title,sender,priority}:{text:string;at:string;title?:string;sender?:string;priority?:'normal'|'hoch'}){
 const s=PAGER_ASSET.screen,time=new Date(at);
 return <div className={styles.device} data-priority={priority||'normal'} style={{aspectRatio:String(PAGER_ASSET.ratio)}}>
  <img src={PAGER_ASSET.src} alt="" draggable={false}/>
  <div className={styles.screen} style={{left:s.left+'%',top:s.top+'%',width:s.width+'%',height:s.height+'%'}}>
   <small>{[Number.isNaN(time.getTime())?'':time.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}),priority==='hoch'?'!! DRINGEND':'',sender||''].filter(Boolean).join(' · ')}</small>
   {title&&<strong>{title}</strong>}
   <p>{text}</p>
  </div>
 </div>;
}

/**
 * Incoming pager messages for one player. "Gelesen" hides the message at once in this browser and confirms it
 * to the GM (server-side acknowledgement); a failed confirmation never brings the message back.
 */
export function PagerInbox({pagers,runId,actorId,onAcknowledge}:{pagers:PagerMessage[];runId:string;actorId:string;onAcknowledge:(id:string)=>void}){
 const key='chroniplay:pager:'+runId+':'+actorId;
 const [seen,setSeen]=useState<string[]>(()=>readAcknowledged(key));
 // The newest unread message is on top; older unread ones follow after "Gelesen".
 const open=pagers.filter(p=>!p.acknowledged&&!seen.includes(p.id)),current=open.at(-1);
 const acknowledge=(id:string)=>{const next=[...seen,id].slice(-60);setSeen(next);try{window.localStorage.setItem(key,JSON.stringify(next));}catch{/* storage unavailable */}onAcknowledge(id);};
 if(!current)return null;
 return <section key={current.id} className={styles.pager} aria-label="Pager-Nachricht" role="alertdialog" aria-describedby={'pager-'+current.id}>
  <PagerDevice text={current.text} at={current.at} title={current.title} sender={current.sender} priority={current.priority}/>
  <span id={'pager-'+current.id} className={styles.srOnly}>Neue Pager-Nachricht{current.sender?' von '+current.sender:''}{current.priority==='hoch'?', dringend':''}: {current.title?current.title+'. ':''}{current.text}</span>
  <footer>{open.length>1&&<small>{open.length-1} weitere</small>}<button type="button" onClick={()=>acknowledge(current.id)}><Check size={15}/> Gelesen</button></footer>
 </section>;
}
