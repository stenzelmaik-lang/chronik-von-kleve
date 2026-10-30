"use client";
/* eslint-disable @next/next/no-img-element -- Session-authorized media must bypass public image proxies. */
import {useEffect,useRef,useState,type PointerEvent as PE} from 'react';
import {Play,Pause,RotateCcw,Volume2,VolumeX,Expand} from 'lucide-react';
import styles from './media-objects.module.css';

type Drag={onPointerDown:(e:PE<HTMLElement>)=>void;onPointerMove:(e:PE<HTMLElement>)=>void;onPointerUp:(e:PE<HTMLElement>)=>void;onPointerCancel:()=>void};

/** Stable small tilt per object, so every viewer sees the same card angle. */
export function tiltOf(id:string){let h=0;for(const c of id)h=(h*31+c.charCodeAt(0))|0;return ((Math.abs(h)%9)-4)*.9;}

/** Photo card. Opening the detail view is personal and never changes the shared table. */
export function Polaroid({id,title,src,onOpen,drag}:{id:string;title:string;src:string;onOpen:()=>void;drag:Drag}){
 return <figure className={styles.polaroid} style={{rotate:tiltOf(id)+'deg'}} {...drag}>
  <button type="button" className={styles.photo} aria-label={title+' vergrößern'} onClick={e=>{e.stopPropagation();onOpen();}} onPointerDown={e=>e.stopPropagation()}><img draggable={false} src={src} alt={title} loading="lazy"/></button>
  <figcaption>{title}</figcaption>
 </figure>;
}

function time(s:number){if(!Number.isFinite(s))return '0:00';const m=Math.floor(s/60);return m+':'+String(Math.floor(s%60)).padStart(2,'0');}

/** Cassette recorder. Playback, volume and mute stay local to each viewer; nothing autoplays. */
export function CassettePlayer({title,src,drag}:{title:string;src:string;drag:Drag}){
 const audio=useRef<HTMLAudioElement>(null);
 const [playing,setPlaying]=useState(false),[progress,setProgress]=useState({at:0,length:0}),[volume,setVolume]=useState(.8),[muted,setMuted]=useState(false),[blocked,setBlocked]=useState('');
 useEffect(()=>{const el=audio.current;if(el){el.volume=volume;el.muted=muted;}},[volume,muted]);
 useEffect(()=>{const el=audio.current;return()=>el?.pause();},[]);
 async function play(){const el=audio.current;if(!el)return;try{await el.play();setBlocked('');}catch{setBlocked('Der Browser hat die Wiedergabe blockiert. Bitte erneut auf Abspielen tippen.');}}
 const stop=(e:PE<HTMLElement>)=>e.stopPropagation();
 return <div className={styles.cassette} {...drag}>
  <audio ref={audio} src={src} preload="none" onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onTimeUpdate={e=>setProgress({at:e.currentTarget.currentTime,length:e.currentTarget.duration})} onLoadedMetadata={e=>setProgress({at:e.currentTarget.currentTime,length:e.currentTarget.duration})}/>
  <div className={styles.tape} data-playing={playing} aria-hidden="true"><span/><span/></div>
  <strong className={styles.label}>{title}</strong>
  <div className={styles.progress} role="progressbar" aria-label="Wiedergabefortschritt" aria-valuemin={0} aria-valuemax={Math.round(progress.length||0)} aria-valuenow={Math.round(progress.at)}><span style={{width:(progress.length?progress.at/progress.length*100:0)+'%'}}/></div>
  <small className={styles.time}>{time(progress.at)} / {time(progress.length)}</small>
  <div className={styles.keys} onPointerDown={stop}>
   {playing?<button type="button" aria-label="Pause" onClick={()=>audio.current?.pause()}><Pause/></button>:<button type="button" aria-label="Abspielen" onClick={()=>void play()}><Play/></button>}
   <button type="button" aria-label="Von vorn abspielen" onClick={()=>{if(audio.current){audio.current.currentTime=0;void play();}}}><RotateCcw/></button>
   <button type="button" aria-label={muted?'Ton einschalten':'Stummschalten'} aria-pressed={muted} onClick={()=>setMuted(m=>!m)}>{muted?<VolumeX/>:<Volume2/>}</button>
   <input type="range" aria-label="Eigene Lautstärke" min={0} max={1} step={.05} value={volume} onChange={e=>setVolume(Number(e.target.value))}/>
  </div>
  {blocked&&<p role="status" className={styles.blocked}>{blocked}</p>}
 </div>;
}

type Layer={id:string;key:string;src:string;title:string;leaving:boolean};
/** Scene backdrop with a slow crossfade: the new place fades in over the old one, which then fades out. */
export function StageBackdrop({image,className}:{image:{key:string;src:string;title:string}|null;className:string}){
 const [layers,setLayers]=useState<Layer[]>(()=>image?[{...image,id:crypto.randomUUID(),leaving:false}]:[]);
 const current=image?.key||'';
 useEffect(()=>{queueMicrotask(()=>setLayers(old=>{
  if((old.findLast(l=>!l.leaving)?.key||'')===current)return old;
  return [...old.map(l=>({...l,leaving:true})),...(image?[{...image,id:crypto.randomUUID(),leaving:false}]:[])];
 }));},[current,image]);
 useEffect(()=>{if(!layers.some(l=>l.leaving))return;const t=window.setTimeout(()=>setLayers(old=>old.filter(l=>!l.leaving)),1500);return()=>window.clearTimeout(t);},[layers]);
 return <>{layers.map(l=><img key={l.id} className={className} data-leaving={l.leaving} src={l.src} alt={l.leaving?'':'Schauplatz: '+l.title} decoding="async"/>)}</>;
}

/** Old CRT-style screen around the native video player. */
export function RetroScreen({title,src,onEnlarge,drag}:{title:string;src:string;onEnlarge:()=>void;drag:Drag}){
 const video=useRef<HTMLVideoElement>(null);
 useEffect(()=>{const el=video.current;return()=>el?.pause();},[]);
 return <div className={styles.screen} {...drag}>
  <div className={styles.glass} onPointerDown={e=>e.stopPropagation()}><video ref={video} src={src} preload="none" controls playsInline aria-label={title}/></div>
  <div className={styles.panel}><strong>{title}</strong><button type="button" aria-label={title+' vergrößern'} onPointerDown={e=>e.stopPropagation()} onClick={()=>{video.current?.pause();onEnlarge();}}><Expand/></button></div>
 </div>;
}
