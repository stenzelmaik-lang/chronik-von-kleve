"use client";
import {useEffect,useRef,useState} from 'react';
import {Volume2,VolumeX,ChevronRight,Play} from 'lucide-react';
import styles from './ambience-player.module.css';

/* Minimal typing of the official YouTube IFrame Player API (developers.google.com/youtube/iframe_api_reference). */
type YtPlayer={playVideo():void;pauseVideo():void;loadVideoById(id:string):void;seekTo(s:number,allow:boolean):void;setVolume(v:number):void;mute():void;unMute():void;getPlayerState():number;destroy():void};
type YtNamespace={Player:new(el:HTMLElement,options:Record<string,unknown>)=>YtPlayer};
declare global{interface Window{YT?:YtNamespace;onYouTubeIframeAPIReady?:()=>void}}
let youtubeApi:Promise<YtNamespace>|null=null;
/** Loads the official IFrame API once. */
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

export type AmbienceState={videoId:string;title:string;key:string;tracks?:{videoId:string;title:string}[];index?:number;playing?:boolean;volume?:number;label?:string};
const PLAYING=1,BUFFERING=3,ENDED=0,fadeMs=1400;
function readFactor(key:string){try{const raw=window.localStorage.getItem(key);const v=Number(raw);return raw!==null&&Number.isFinite(v)?Math.min(2,Math.max(0,v)):1;}catch{return 1;}}

/**
 * Ambience music of the round through the official YouTube embed (youtube-nocookie.com), loaded at once.
 * A drawer slides out of the stage corner; folded, the music keeps playing and a small record turns in the corner.
 * The GM sets track, play/pause and the base volume for everyone; each viewer scales it for themselves.
 * Tracks change with a soft fade; a playlist loops on its own, even very long tracks.
 */
export function AmbiencePlayer({music,actorId}:{music:AmbienceState;actorId:string}){
 const openKey='chroniplay:ambiente-offen:'+actorId,factorKey='chroniplay:ambiente-lautstaerke:'+actorId;
 const [open,setOpen]=useState(false),[factor,setFactor]=useState(1),[muted,setMuted]=useState(false);
 const [sounding,setSounding]=useState(false),[blocked,setBlocked]=useState(false),[error,setError]=useState(''),[local,setLocal]=useState<{key:string;index:number}|null>(null);
 const host=useRef<HTMLDivElement>(null),player=useRef<YtPlayer|null>(null),ready=useRef(false),fade=useRef(0),watch=useRef(0),keyRef=useRef(music.key);
 const tracks=music.tracks?.length?music.tracks:[{videoId:music.videoId,title:music.title}];
 // The table follows the GM's position; after a track ends it advances on its own until the GM chooses again.
 const index=local?.key===music.key?local.index:Math.min(music.index??0,tracks.length-1),track=tracks[index]||tracks[0];
 const gmPlaying=music.playing??true,base=music.volume??25;
 const target=muted?0:Math.round(Math.min(100,base*factor));
 // Latest values for the player's callbacks (they outlive renders).
 const live=useRef({target,gmPlaying,tracks,index});
 useEffect(()=>{live.current={target,gmPlaying,tracks,index};});
 // Personal settings are restored after mount (no server/client mismatch).
 useEffect(()=>{queueMicrotask(()=>{setFactor(readFactor(factorKey));try{setOpen(window.localStorage.getItem(openKey)==='1');}catch{/* storage unavailable */}});},[factorKey,openKey]);
 const remember=(key:string,value:string)=>{try{window.localStorage.setItem(key,value);}catch{/* storage unavailable */}};
 function rampTo(to:number,then?:()=>void){
  const p=player.current;window.clearInterval(fade.current);if(!p||!ready.current){then?.();return;}
  let step=0;const from=(p as unknown as {getVolume?:()=>number}).getVolume?.()??to,steps=10;
  fade.current=window.setInterval(()=>{step++;p.setVolume(Math.round(from+(to-from)*step/steps));if(step>=steps){window.clearInterval(fade.current);then?.();}},fadeMs/steps);
 }
 // If the browser blocks sound without a gesture, a quiet hint appears instead of failing silently.
 function expectSound(){window.clearTimeout(watch.current);watch.current=window.setTimeout(()=>{const s=player.current?.getPlayerState();if(live.current.gmPlaying&&s!==PLAYING&&s!==BUFFERING)setBlocked(true);},2500);}
 // Create the player once.
 useEffect(()=>{
  let gone=false;
  loadYoutubeApi().then(YT=>{
   if(gone||!host.current)return;
   const mount=window.document.createElement('div');host.current.replaceChildren(mount);
   player.current=new YT.Player(mount,{host:'https://www.youtube-nocookie.com',videoId:live.current.tracks[live.current.index].videoId,width:'100%',height:'100%',
    playerVars:{autoplay:1,rel:0,playsinline:1,origin:window.location.origin},
    events:{onReady:(e:{target:YtPlayer})=>{ready.current=true;e.target.unMute();e.target.setVolume(0);if(live.current.gmPlaying){e.target.playVideo();expectSound();}rampTo(live.current.target);},
     onStateChange:(e:{data:number})=>{
      setSounding(e.data===PLAYING);if(e.data===PLAYING)setBlocked(false);
      if(e.data===ENDED){const {tracks:list,index:i}=live.current;
       // Loop: one track starts again, a playlist moves on and wraps around.
       if(list.length<2){player.current?.seekTo(0,true);player.current?.playVideo();}
       else{const n=(i+1)%list.length;setLocal({key:keyRef.current,index:n});player.current?.loadVideoById(list[n].videoId);}}
     },
     onError:()=>setError('Dieses Video lässt sich nicht einbetten oder ist nicht verfügbar.')}});
  }).catch(e=>{if(!gone)setError((e as Error).message);});
  return()=>{gone=true;window.clearInterval(fade.current);window.clearTimeout(watch.current);player.current?.destroy();player.current=null;ready.current=false;};
 },[]);

 // A new GM choice (key): fade out, load the track, fade in.
 useEffect(()=>{
  if(keyRef.current===music.key)return;keyRef.current=music.key;
  queueMicrotask(()=>{setLocal(null);setError('');});
  const p=player.current;if(!p||!ready.current)return;
  rampTo(0,()=>{p.loadVideoById(track.videoId);if(!live.current.gmPlaying)p.pauseVideo();else expectSound();rampTo(live.current.target);});
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to a new GM start only
 },[music.key]);
 // Play/pause for everyone, softly.
 useEffect(()=>{const p=player.current;if(!p||!ready.current)return;if(gmPlaying){p.playVideo();expectSound();rampTo(live.current.target);}else rampTo(0,()=>p.pauseVideo());
 },[gmPlaying]);
 // Base volume (GM) and personal factor; remembered locally.
 useEffect(()=>{const p=player.current;if(p&&ready.current){window.clearInterval(fade.current);p.setVolume(target);}remember(factorKey,String(factor));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- volume inputs only
 },[target,factor]);
 const toggle=(next:boolean)=>{setOpen(next);remember(openKey,next?'1':'0');};
 const spinning=sounding&&gmPlaying;
 return <aside className={styles.ambience} data-open={open} aria-label="Ambiente-Musik">
  <button type="button" className={styles.record} data-spinning={spinning} aria-expanded={open} aria-label={(open?'Ambiente-Player einklappen':'Ambiente-Player öffnen')+' · '+(spinning?'läuft: ':gmPlaying?'bereit: ':'pausiert: ')+track.title} onClick={()=>toggle(!open)}>
   <span className={styles.disc} aria-hidden="true"><i/></span>
  </button>
  {blocked&&gmPlaying&&<button type="button" className={styles.tap} onClick={()=>{player.current?.playVideo();rampTo(live.current.target);setBlocked(false);expectSound();}}><Play size={13}/> Zum Abspielen tippen</button>}
  <div className={styles.drawer} inert={!open} aria-hidden={!open}>
   <header><span className={styles.label}>{music.label||'Ambiente'}</span><small>{tracks.length>1?`Titel ${index+1}/${tracks.length} · `:''}{gmPlaying?'läuft':'pausiert (SL)'}</small><button type="button" aria-label="Ambiente-Player einklappen" onClick={()=>toggle(false)}><ChevronRight size={16}/></button></header>
   <p className={styles.track} title={track.title}>{track.title}</p>
   <div className={styles.frame} ref={host}/>
   <div className={styles.controls}>
    <button type="button" aria-label={muted?'Ambiente einschalten':'Ambiente stummschalten'} aria-pressed={muted} onClick={()=>setMuted(m=>!m)}>{muted?<VolumeX size={14}/>:<Volume2 size={14}/>}</button>
    <label>Meine Lautstärke<input type="range" aria-label="Eigene Ambiente-Lautstärke" min={0} max={2} step={.1} value={factor} onChange={e=>setFactor(Number(e.target.value))}/></label><output>{target}%</output>
   </div>
   {error&&<p className={styles.error} role="alert">{error}</p>}
  </div>
 </aside>;
}
