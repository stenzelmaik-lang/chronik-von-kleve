"use client";
/* eslint-disable @next/next/no-img-element -- Static game prop; screen and controls are live HTML. */
import {useCallback,useEffect,useId,useRef,useState,type CSSProperties,type PointerEvent as PE,type ButtonHTMLAttributes} from 'react';
import {Play,Pause,Square,SkipBack,SkipForward,RotateCcw,Volume2,VolumeX,FolderClosed,LoaderCircle,ListMusic,Maximize2,LogOut} from 'lucide-react';
import {audioPosition,audioTime,rotaryPointer,rotaryVolume} from '@/domain/audio-player';
import {recordingPeaks} from './audio-waveform';
import {AudioKnob} from './audio-knob';
import s from './ultio-audio.module.css';

export const audioDeviceImage='/spieltisch/ultio-audio-device-crest.webp';
const audioDeviceShell='/spieltisch/ultio-audio-shell-v2.webp';
// Coordinates measured on the 1671 × 941 source. The cap artwork and glyph share one moving part.
const keyFaces={
 previous:[[380,676],[525,663],[538,774],[392,789]],stop:[[554,663],[715,648],[730,758],[567,774]],
 play:[[744,647],[902,633],[919,742],[756,760]],pause:[[933,632],[1073,620],[1091,729],[944,746]],
 next:[[1099,615],[1237,604],[1256,715],[1111,731]],reset:[[1279,602],[1448,587],[1466,703],[1290,719]],
 size:[[246,147],[390,136],[408,165],[266,183]],withdraw:[[428,141],[628,128],[654,165],[454,180]],
 mute:[[630,129],[774,119],[801,152],[654,165]],menu:[[785,119],[970,104],[1009,139],[808,153]],
} as const;
function DeviceKey({part,children,className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{part:keyof typeof keyFaces}){
 const id=useId(),points=keyFaces[part],xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y,top=['size','withdraw','mute','menu'].includes(part);
 return <button {...props} type="button" data-device-key={part} className={`${s.key} ${top?s.topKey:''} ${className}`} style={{left:(x+w/2)/1671*100+'%',top:(y+h/2)/941*100+'%',width:w/1671*100+'%',height:h/941*100+'%','--cap-width':w/1671*100+'cqw','--cap-height':h/1671*100+'cqw'} as CSSProperties}>
  <span className={s.keyCap} data-key-cap="true"><svg className={s.capArt} viewBox={`${x} ${y} ${w} ${h}`} aria-hidden="true"><defs><clipPath id={id}><polygon points={points.map(p=>p.join(',')).join(' ')}/></clipPath></defs><image href={audioDeviceImage} x="0" y="0" width="1671" height="941" clipPath={`url(#${id})`}/></svg><span className={s.keyGlyph}>{children}</span></span>
 </button>;
}
export function AudioDeviceCover({title}:{title:string}){
 return <span className={s.cover} aria-hidden="true"><img src={audioDeviceImage} alt="" draggable={false} decoding="async"/><span className={s.coverScreen}><FolderClosed/><strong>{title}</strong><span>Audio-Akte</span></span><span className={s.coverLight}/></span>;
}
export type AudioTrack={id:string;title:string;src:string;private?:boolean};
type PlayerProps={title:string;src:string;initialVolume?:number;onVolume?:(value:number)=>void;onStop?:()=>void;suspended?:boolean;onResize?:()=>void;onWithdraw?:()=>void;busy?:boolean};
/** Only the viewer's already authorized stage tracks enter this player. */
export function UltioAudioPlayer({tracks,initialTrackId,...props}:PlayerProps&{tracks?:AudioTrack[];initialTrackId?:string}){
 const list=tracks||[{id:props.src,title:props.title,src:props.src}];
 const [selection,setSelection]=useState(()=>{const first=list.find(t=>t.id===initialTrackId)||list[0];return {id:first?.id,src:first?.src,autoPlay:false,serial:0};});
 const [menu,setMenu]=useState(false),playing=useRef(false);
 const touchKey=useRef<{pointer:number;button:HTMLButtonElement;x:number;y:number;moved:boolean}|null>(null),handledTouch=useRef(0);
 const index=Math.max(0,list.findIndex(t=>t.id===selection.id)),track=list[index];
 const missing=!list.some(t=>t.id===selection.id),firstId=list[0]?.id,firstSrc=list[0]?.src;
 const playback=useCallback((value:boolean)=>{playing.current=value;},[]);
 useEffect(()=>{if(!missing)return;let active=true;queueMicrotask(()=>{if(active)setSelection({id:firstId,src:firstSrc,autoPlay:false,serial:0});});return()=>{active=false;};},[missing,firstId,firstSrc]);
 const choose=(next:number,autoPlay:boolean)=>{const item=list[next];if(item){setMenu(false);setSelection(old=>({id:item.id,src:item.src,autoPlay,serial:old.serial+1}));}};
 if(!track)return null;
 return <div className={s.controlSurface}
  onPointerDownCapture={e=>{if(e.pointerType!=='touch')return;const button=(e.target as Element).closest('button');if(button&&!button.disabled)touchKey.current={pointer:e.pointerId,button,x:e.clientX,y:e.clientY,moved:false};}}
  onPointerMoveCapture={e=>{const d=touchKey.current;if(d?.pointer===e.pointerId&&Math.hypot(e.clientX-d.x,e.clientY-d.y)>8)d.moved=true;}}
  onPointerCancelCapture={()=>{touchKey.current=null;}}
  onPointerUpCapture={e=>{const d=touchKey.current;if(!d||d.pointer!==e.pointerId)return;touchKey.current=null;if(d.moved)return;handledTouch.current=performance.now();e.preventDefault();if(d.button.isConnected&&!d.button.disabled)d.button.click();}}
  onClickCapture={e=>{const native=e.nativeEvent as MouseEvent&{pointerType?:string};if(native.isTrusted&&e.detail>0&&native.pointerType!=='mouse'&&performance.now()-handledTouch.current<600){e.preventDefault();e.stopPropagation();}}}>
  <AudioTrackPlayer key={track.id+'|'+track.src+'|'+(selection.id===track.id?selection.serial:0)} {...props} title={track.title} src={track.src} autoPlay={selection.id===track.id&&selection.src===track.src&&selection.autoPlay}
  index={index} tracks={list} menu={menu} onMenu={()=>setMenu(v=>!v)} onSelect={i=>choose(i,true)} onPrevious={()=>choose(index-1,playing.current)} onNext={()=>choose(index+1,playing.current)} onPlayback={playback}
  onTrackEnded={()=>{if(index+1<list.length)choose(index+1,true);}}/>
 </div>;
}
type TrackProps=PlayerProps&{autoPlay:boolean;index:number;tracks:AudioTrack[];menu:boolean;onMenu:()=>void;onSelect:(index:number)=>void;onPrevious:()=>void;onNext:()=>void;onPlayback:(playing:boolean)=>void;onTrackEnded:()=>void};

function AudioTrackPlayer({title,src,initialVolume=.8,onVolume,onStop,suspended=false,onResize,onWithdraw,busy=false,autoPlay,index,tracks,menu,onMenu,onSelect,onPrevious,onNext,onPlayback,onTrackEnded}:TrackProps){
 const audio=useRef<HTMLAudioElement>(null),menuRoot=useRef<HTMLDivElement>(null),attempt=useRef(0),mounted=useRef(true),dial=useRef<{pointer:number;angle:number|null;volume:number;rect:DOMRect}|null>(null);
 const [playing,setPlaying]=useState(false),[waiting,setWaiting]=useState(false),[ended,setEnded]=useState(false);
 const [at,setAt]=useState(0),[duration,setDuration]=useState(0),[volume,setVolume]=useState(initialVolume),[muted,setMuted]=useState(false);
 const [error,setError]=useState(''),[started,setStarted]=useState(false),[peaks,setPeaks]=useState<number[]>([]);
 const clip=useId().replace(/:/g,''),menuId=useId();
 const percent=duration?audioPosition(at,duration)/duration*100:0;
 useEffect(()=>{const el=audio.current;if(el){el.volume=volume;el.muted=muted;}},[volume,muted]);
 useEffect(()=>{let current=true;queueMicrotask(()=>{if(current)setVolume(initialVolume);});return()=>{current=false;};},[initialVolume]);
 useEffect(()=>{mounted.current=true;const el=audio.current;return()=>{mounted.current=false;el?.pause();onPlayback(false);};},[onPlayback]);
 useEffect(()=>{if(suspended){attempt.current++;audio.current?.pause();}},[suspended]);
 useEffect(()=>{if(menu){const option=menuRoot.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');option?.focus({preventScroll:true});option?.scrollIntoView({block:'nearest'});}},[menu]);
 useEffect(()=>{if(!started||!duration)return;const controller=new AbortController();void recordingPeaks(src,duration,controller.signal).then(values=>{if(!controller.signal.aborted)setPeaks(values);}).catch(()=>{/* Playback does not require waveform analysis. */});return()=>controller.abort();},[src,started,duration]);
 const refresh=(el:HTMLAudioElement)=>{setAt(Number.isFinite(el.currentTime)?el.currentTime:0);setDuration(Number.isFinite(el.duration)?el.duration:0);};
 async function play(){
  const el=audio.current;if(!el||suspended)return;
  const id=++attempt.current;setError('');setWaiting(true);
  if(el.error)el.load();if(el.ended)el.currentTime=0;
  try{await el.play();if(mounted.current&&id===attempt.current){setStarted(true);setWaiting(false);}}
  catch(e){if(!mounted.current||id!==attempt.current)return;setWaiting(false);setError(e instanceof DOMException&&e.name==='NotAllowedError'?'Ton blockiert.\nErneut abspielen.':'Verbindung prüfen.\nErneut abspielen.');}
 }
 useEffect(()=>{let active=true;if(autoPlay)queueMicrotask(()=>{if(active)void play();});return()=>{active=false;};
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Deliberate selection / preceding track's end, once per audio element.
 },[]);
 function pause(){attempt.current++;audio.current?.pause();setWaiting(false);}
 function position(value:number){const el=audio.current;if(!el||!duration)return;el.currentTime=audioPosition(value,duration);setAt(el.currentTime);setEnded(false);}
 function changeVolume(value:number){const next=Math.max(0,Math.min(1,value));setVolume(next);setMuted(false);onVolume?.(next);}
 function stop(){pause();if(audio.current?.readyState)audio.current.currentTime=0;setAt(0);setEnded(false);onStop?.();}
 function dialStart(e:PE<HTMLDivElement>){if(e.button!==0)return;e.preventDefault();e.stopPropagation();e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);const rect=e.currentTarget.getBoundingClientRect();dial.current={pointer:e.pointerId,angle:rotaryPointer(e.clientX,e.clientY,rect),volume,rect};}
 function dialMove(e:PE<HTMLDivElement>){const d=dial.current;if(!d||d.pointer!==e.pointerId)return;e.stopPropagation();const angle=rotaryPointer(e.clientX,e.clientY,d.rect);if(angle===null){d.angle=null;return;}if(d.angle!==null){d.volume=rotaryVolume(d.volume,d.angle,angle,e.shiftKey);changeVolume(d.volume);}d.angle=angle;}
 function dialEnd(e:PE<HTMLDivElement>){if(dial.current?.pointer!==e.pointerId)return;dial.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}
 const status=error?'Datei nicht verfügbar':waiting?'Wird geladen …':playing?'Wiedergabe':ended?'Aufnahme beendet':at>0?'Pause':'Bereit';
 const points=peaks.map((value,i)=>{const x=(i+.5)/peaks.length*1000,h=value*48;return `M${x.toFixed(1)},${(50-h).toFixed(1)}V${(50+h).toFixed(1)}`;}).join('');
 return <section className={s.player} aria-label={'Audiogerät: '+title} data-playing={playing} data-waiting={waiting} data-waveform={peaks.length>0} data-menu={menu} data-error={!!error}
  onKeyDown={e=>{if(menu&&e.key==='Escape'){e.preventDefault();e.stopPropagation();onMenu();e.currentTarget.querySelector<HTMLButtonElement>('button[aria-label="Aufnahmen am Gerät anzeigen"]')?.focus();}}}
  onPointerDownCapture={e=>{if(!(e.target as HTMLElement).closest('button'))return;try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)navigator.vibrate?.(8);}catch{/* Optional hardware feedback. */}}}>
  <audio ref={audio} src={src} preload="metadata" aria-label={'Tonaufnahme: '+title}
   onPlay={()=>{setPlaying(true);setEnded(false);setError('');onPlayback(true);}} onPlaying={()=>setWaiting(false)} onPause={()=>{setPlaying(false);setWaiting(false);onPlayback(false);}}
   onWaiting={()=>setWaiting(true)} onCanPlay={()=>setWaiting(false)} onEnded={()=>{setPlaying(false);setEnded(true);setWaiting(false);onPlayback(false);onTrackEnded();}}
   onLoadedMetadata={e=>refresh(e.currentTarget)} onDurationChange={e=>refresh(e.currentTarget)} onTimeUpdate={e=>refresh(e.currentTarget)} onSeeked={e=>refresh(e.currentTarget)}
   onError={()=>{setPlaying(false);setWaiting(false);setError('Audio nicht verfügbar.\nErneut abspielen.');}}/>
  <div className={s.device}>
   <img className={s.shell} src={audioDeviceShell} alt="" draggable={false} fetchPriority="high"/>
   <div className={s.display} data-device-screen="true">
    <div className={s.displayBar}><span><FolderClosed/> {menu?'AUFNAHMEN':'AUDIO-AKTE'}</span><span className={s.signal}><i/> {String(index+1).padStart(2,'0')} / {String(tracks.length).padStart(2,'0')}</span></div>
    {menu?<div ref={menuRoot} id={menuId} className={s.lcdMenu} role="listbox" aria-label={tracks.some(t=>t.private)?'Verfügbare Aufnahmen':'Freigegebene Aufnahmen'} onKeyDown={e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();const options=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]')),at=options.indexOf(document.activeElement as HTMLButtonElement);options[e.key==='Home'?0:e.key==='End'?options.length-1:Math.max(0,Math.min(options.length-1,at+(e.key==='ArrowDown'?1:-1)))]?.focus();}}>{tracks.map((item,i)=><button key={item.id} type="button" role="option" aria-selected={i===index} aria-label={'Aufnahme abspielen: '+item.title} onClick={()=>onSelect(i)}><span>{String(i+1).padStart(2,'0')}</span><strong>{item.title}</strong>{item.private&&<small>SL</small>}</button>)}</div>:<>
     <strong className={s.track} title={title}>{title}</strong>
     {error?<p role="alert" className={s.error}>{error}</p>:<>
      <span className={s.deviceStatus} role="status">{tracks[index]?.private?'Nur SL · ':''}{status}</span>
      <div className={s.waveform}>
       <svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><defs><clipPath id={clip}><rect width={percent*10} height="100"/></clipPath></defs><path d="M0 50H1000" className={s.baseline}/>{!!peaks.length&&<><path d={points} className={s.wave}/><path d={points} className={s.playedWave} clipPath={'url(#'+clip+')'}/></>}<path d="M0 0V100" className={s.playhead} style={{transform:'translateX('+percent*10+'px)'}}/></svg>
       <input type="range" className={s.seek} aria-label="Position in der Aufnahme" aria-valuetext={audioTime(at)+' von '+audioTime(duration)} min={0} max={duration||1} step={.1} value={audioPosition(at,duration)} disabled={!duration} onChange={e=>position(Number(e.target.value))}/>
      </div>
     </>}
     <div className={s.displayTime}><span>{audioTime(at)} <span>/ {audioTime(duration)}</span></span><span>{muted?<VolumeX aria-hidden="true"/>:<Volume2 aria-hidden="true"/>} {muted?0:Math.round(volume*100)} %</span></div>
    </>}
   </div>
   <DeviceKey part="menu" aria-label="Aufnahmen am Gerät anzeigen" aria-expanded={menu} aria-controls={menu?menuId:undefined} onClick={onMenu} title="Aufnahmen am Gerät"><ListMusic/></DeviceKey>
   <DeviceKey part="mute" aria-label={muted?'Ton einschalten':'Stummschalten'} aria-pressed={muted} onClick={()=>setMuted(v=>!v)} title={muted?'Ton einschalten':'Stummschalten'}>{muted?<VolumeX/>:<Volume2/>}</DeviceKey>
   {onResize&&<DeviceKey part="size" aria-label="Gerätegröße umschalten" onClick={onResize} title="Gerät vergrößern / verkleinern"><Maximize2/></DeviceKey>}
   {onWithdraw&&<DeviceKey part="withdraw" aria-label="Audiogerät mit allen Aufnahmen zurücknehmen" disabled={busy} onClick={onWithdraw} title="SL: Gerät mit allen Aufnahmen zurücknehmen"><LogOut/></DeviceKey>}
   <div className={s.knob} role="slider" tabIndex={0} aria-label="Eigene Lautstärke" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(volume*100)} aria-valuetext={Math.round(volume*100)+' Prozent'} title="Lautstärke drehen: im Kreis ziehen oder Pfeiltasten"
    onPointerDown={dialStart} onPointerMove={dialMove} onPointerUp={dialEnd} onPointerCancel={dialEnd}
    onKeyDown={e=>{if(['ArrowRight','ArrowUp','ArrowLeft','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();changeVolume(e.key==='Home'?0:e.key==='End'?1:volume+(['ArrowRight','ArrowUp'].includes(e.key)?1:-1)*(e.shiftKey?.01:.05));}}}>
    <AudioKnob volume={volume}/>
   </div>
   <div className={s.hardwareKeys} role="group" aria-label="Audiotasten">
    <DeviceKey part="previous" aria-label="Vorherige Aufnahme" title="Vorherige Aufnahme" disabled={index===0} onClick={onPrevious}><SkipBack/></DeviceKey>
    <DeviceKey part="stop" aria-label="Stoppen" title="Stopp" onClick={stop}><Square/></DeviceKey>
    <DeviceKey part="play" className={s.playKey} data-active={playing} aria-label={playing?'Wiedergabe läuft':'Abspielen'} title="Abspielen" aria-pressed={playing} disabled={playing||waiting} onClick={()=>void play()}>{waiting?<LoaderCircle className={s.loading}/>:<Play/>}</DeviceKey>
    <DeviceKey part="pause" data-active={!playing&&at>0&&!ended} aria-label="Pause" title="Pause" disabled={!playing&&!waiting} onClick={pause}><Pause/></DeviceKey>
    <DeviceKey part="next" aria-label="Nächste Aufnahme" title="Nächste Aufnahme" disabled={index+1>=tracks.length} onClick={onNext}><SkipForward/></DeviceKey>
    <DeviceKey part="reset" aria-label="Auf Anfang zurücksetzen" title="Auf Anfang zurücksetzen" disabled={!duration} onClick={()=>position(0)}><RotateCcw/></DeviceKey>
   </div>
  </div>
 </section>;
}
