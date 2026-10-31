"use client";
import {useEffect,useRef,useState} from 'react';
import {Music,Play,Pause,Volume2,VolumeX} from 'lucide-react';
import {stageEffects,type StageEffect} from '@/domain/live-stage';
import styles from './atmosphere.module.css';

export const effectLabels:Record<StageEffect,string>={rain:'Regen',fog:'Nebel',storm:'Gewitter',snow:'Schnee',embers:'Funken & Glut',darkness:'Dunkelheit',flicker:'Flackerlicht'};
/** Fade-out time of a leaving effect; it stays mounted this long so the change blends instead of cutting. */
const fadeOutMs=2200;

/** One effect's markup. Every layer animates transform or opacity only, so laptops keep a steady frame rate. */
function Effect({effect,leaving}:{effect:StageEffect;leaving:boolean}){
 const common={'data-effect':effect,'data-leaving':leaving||undefined,'aria-hidden':true} as const;
 if(effect==='rain')return <div className={`${styles.layer} ${styles.rain}`} {...common}><span/><span/></div>;
 if(effect==='fog')return <div className={`${styles.layer} ${styles.fog}`} {...common}><span/><span/><span/></div>;
 if(effect==='storm')return <div className={`${styles.layer} ${styles.storm}`} {...common}><span className={styles.stormRain}/><span className={styles.flash}/></div>;
 if(effect==='snow')return <div className={`${styles.layer} ${styles.snow}`} {...common}><span/><span/></div>;
 if(effect==='embers')return <div className={`${styles.layer} ${styles.embers}`} {...common}><i/><span/><span/></div>;
 if(effect==='darkness')return <div className={`${styles.layer} ${styles.darkness}`} {...common}/>;
 return <div className={`${styles.layer} ${styles.flicker}`} {...common}/>;
}

/**
 * Weather and light over the backdrop, under all table objects. New effects fade in, ended ones fade out, so a change
 * of atmosphere blends over. Reduced motion keeps calm still images (no flashes, no flicker).
 */
export function StageEffects({effects}:{effects:StageEffect[]}){
 const [shown,setShown]=useState<{effect:StageEffect;leaving:boolean}[]>(()=>effects.map(effect=>({effect,leaving:false})));
 const active=effects.join(',');
 useEffect(()=>{
  const now=active?active.split(',') as StageEffect[]:[];
  queueMicrotask(()=>setShown(old=>stageEffects.filter(e=>now.includes(e)||old.some(o=>o.effect===e)).map(effect=>({effect,leaving:!now.includes(effect)}))));
  const t=window.setTimeout(()=>setShown(old=>old.filter(o=>!o.leaving)),fadeOutMs);
  return()=>window.clearTimeout(t);
 },[active]);
 if(!shown.length)return null;
 return <div className={styles.effects} data-layer="atmosphere">
  {shown.map(s=><Effect key={s.effect} effect={s.effect} leaving={s.leaving}/>)}
  <span className={styles.srOnly} role="status">{effects.length?'Atmosphäre: '+effects.map(e=>effectLabels[e]).join(', '):''}</span>
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
