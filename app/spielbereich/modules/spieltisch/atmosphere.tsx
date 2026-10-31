"use client";
import {useEffect,useRef,useState} from 'react';
import {Music,Play,Pause,Volume2,VolumeX,ShieldCheck,Square} from 'lucide-react';
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

/* Minimal typing of the official YouTube IFrame Player API (developers.google.com/youtube/iframe_api_reference). */
type YtPlayer={playVideo():void;pauseVideo():void;loadVideoById(id:string):void;setVolume(v:number):void;mute():void;unMute():void;destroy():void};
type YtNamespace={Player:new(el:HTMLElement,options:Record<string,unknown>)=>YtPlayer};
declare global{interface Window{YT?:YtNamespace;onYouTubeIframeAPIReady?:()=>void}}
let youtubeApi:Promise<YtNamespace>|null=null;
/** Loads the official IFrame API once, and only after consent. Nothing from YouTube is fetched before that. */
function loadYoutubeApi(){
 if(window.YT?.Player)return Promise.resolve(window.YT);
 youtubeApi??=new Promise<YtNamespace>((resolve,reject)=>{
  const previous=window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady=()=>{previous?.();if(window.YT)resolve(window.YT);};
  const script=window.document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.async=true;
  script.onerror=()=>{youtubeApi=null;script.remove();reject(Error('YouTube ist nicht erreichbar.'));};
  window.document.head.appendChild(script);
 });
 return youtubeApi;
}
export const youtubeConsentKey=(actorId:string)=>'chroniplay:youtube-einwilligung:'+actorId;

/**
 * YouTube music of the round through the official embed (youtube-nocookie.com). Before a personal consent nothing is
 * loaded from YouTube; the consent can be remembered for this browser and withdrawn. Volume and pause are personal;
 * start and stop for everyone come from the GM via the stage state. The player stays visible (YouTube's embed rules).
 */
export function YoutubeMusic({music,actorId,offset=false}:{music:{videoId:string;title:string;key:string};actorId:string;offset?:boolean}){
 const consentKey=youtubeConsentKey(actorId),volumeKey='chroniplay:youtube-lautstaerke:'+actorId;
 const [consent,setConsent]=useState(()=>{try{return window.localStorage.getItem(consentKey)==='1';}catch{return false;}});
 const [remember,setRemember]=useState(false),[volume,setVolume]=useState(()=>readNumber(volumeKey,.5)),[muted,setMuted]=useState(false);
 const [playing,setPlaying]=useState(false),[hiddenKey,setHiddenKey]=useState(''),[error,setError]=useState('');
 const hidden=hiddenKey===music.key;
 const host=useRef<HTMLDivElement>(null),player=useRef<YtPlayer|null>(null),ready=useRef(false);
 const settings=useRef({volume,muted});
 useEffect(()=>{settings.current={volume,muted};const p=player.current;if(p&&ready.current){p.setVolume(Math.round(volume*100));if(muted)p.mute();else p.unMute();}try{window.localStorage.setItem(volumeKey,String(volume));}catch{/* storage unavailable */}},[volume,muted,volumeKey]);
 const drop=()=>{player.current?.destroy();player.current=null;ready.current=false;setPlaying(false);};
 // The player is created after consent; a new start (key) of the GM loads the video again from the beginning.
 useEffect(()=>{
  if(!consent||hidden)return;let gone=false;
  if(player.current&&ready.current){player.current.loadVideoById(music.videoId);return;}
  loadYoutubeApi().then(YT=>{
   if(gone||!host.current)return;
   const mount=window.document.createElement('div');host.current.replaceChildren(mount);
   player.current=new YT.Player(mount,{host:'https://www.youtube-nocookie.com',videoId:music.videoId,width:'100%',height:'100%',
    playerVars:{autoplay:1,loop:1,playlist:music.videoId,rel:0,playsinline:1,origin:window.location.origin},
    events:{onReady:(e:{target:YtPlayer})=>{ready.current=true;const {volume:v,muted:m}=settings.current;e.target.setVolume(Math.round(v*100));if(m)e.target.mute();e.target.playVideo();},
     onStateChange:(e:{data:number})=>setPlaying(e.data===1||e.data===3),
     onError:()=>setError('Dieses Video lässt sich nicht einbetten oder ist nicht verfügbar.')}});
  }).catch(e=>{if(!gone)setError((e as Error).message);});
  return()=>{gone=true;};
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a new GM start (key), the consent or reopening decides
 },[consent,hidden,music.key]);
 useEffect(()=>()=>{player.current?.destroy();player.current=null;ready.current=false;},[]);
 function accept(){if(remember){try{window.localStorage.setItem(consentKey,'1');}catch{/* storage unavailable */}}setError('');setConsent(true);}
 function withdraw(){try{window.localStorage.removeItem(consentKey);}catch{/* storage unavailable */}drop();setConsent(false);}
 return <section className={styles.youtube} data-offset={offset} aria-label="Musik von YouTube">
  <header><Music size={15} aria-hidden="true"/><span className={styles.musicTitle} title={music.title}>{music.title}</span><small>YouTube</small></header>
  {!consent?<div className={styles.consent}>
   <p><ShieldCheck size={14} aria-hidden="true"/> Die Spielleitung spielt Musik von YouTube. Erst nach deinem Klick lädt der Browser den Player von YouTube (Google). Dabei werden u. a. deine IP-Adresse und Geräteinformationen übertragen.</p>
   <label className={styles.remember}><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/> Für diesen Browser merken</label>
   <button type="button" className={styles.musicStart} onClick={accept}><Play size={14}/> YouTube laden &amp; abspielen</button>
  </div>:hidden?<div className={styles.consent}><p>Für dich angehalten. Die anderen hören weiter.</p><button type="button" className={styles.musicStart} onClick={()=>setHiddenKey('')}><Play size={14}/> Wieder abspielen</button></div>
  :<>
   <div className={styles.youtubeFrame} ref={host}/>
   <div className={styles.youtubeControls}>
    {playing?<button type="button" aria-label="YouTube-Musik für mich pausieren" onClick={()=>player.current?.pauseVideo()}><Pause size={14}/></button>:<button type="button" aria-label="YouTube-Musik abspielen" onClick={()=>player.current?.playVideo()}><Play size={14}/></button>}
    <button type="button" aria-label={muted?'YouTube-Musik einschalten':'YouTube-Musik stummschalten'} aria-pressed={muted} onClick={()=>setMuted(m=>!m)}>{muted?<VolumeX size={14}/>:<Volume2 size={14}/>}</button>
    <input type="range" aria-label="Eigene YouTube-Lautstärke" min={0} max={1} step={.05} value={volume} onChange={e=>setVolume(Number(e.target.value))}/>
    <button type="button" aria-label="Player für mich schließen" onClick={()=>{drop();setHiddenKey(music.key);}}><Square size={13}/></button>
   </div>
   <button type="button" className={styles.withdraw} onClick={withdraw}>Einwilligung widerrufen</button>
  </>}
  {error&&<p className={styles.youtubeError} role="alert">{error}</p>}
 </section>;
}
