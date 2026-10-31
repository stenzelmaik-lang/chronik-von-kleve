"use client";
import {useEffect,useRef,useState} from 'react';
import {Music,Play,Pause,Volume2,VolumeX} from 'lucide-react';
import type {StageEffect} from '@/domain/live-stage';
import styles from './atmosphere.module.css';

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
