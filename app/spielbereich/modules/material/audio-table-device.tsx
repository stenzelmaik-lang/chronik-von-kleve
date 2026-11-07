"use client";
import {useEffect,useRef,useState,type PointerEvent as PE} from 'react';
import {fitAudioDevice,type AudioDeviceLayout} from '@/domain/audio-player';
import {UltioAudioPlayer,type AudioTrack} from './ultio-audio';
import {useViewerState} from './viewer-state';
import s from './audio-table-device.module.css';

/** A personal, movable prop on the existing playfield. Playback and layout never publish stage commands. */
export function AudioTableDevice({tracks,personalKey,bounds,onWithdraw,busy}:{tracks:AudioTrack[];personalKey:string;bounds:{w:number;h:number};onWithdraw?:()=>void;busy?:boolean}){
 const storageKey='chroniplay:audio-device-layout:'+personalKey;
 const [layout,setLayout]=useState<AudioDeviceLayout>({x:.48,y:.24,width:450}),[moving,setMoving]=useState(false),[compact,setCompact]=useState(true);
 const [view,setView]=useViewerState(personalKey);
 const drag=useRef<{pointer:number;x:number;y:number;start:AudioDeviceLayout;last:AudioDeviceLayout}|null>(null);
 const compactWidth=Math.min(450,bounds.w*.72),fitted=fitAudioDevice({...layout,width:compact?compactWidth:layout.width},bounds),first=tracks[0];
 // Each table visit starts compact; the saved position and the separate volume preference are retained.
 useEffect(()=>{let active=true;queueMicrotask(()=>{if(!active)return;try{const raw=JSON.parse(localStorage.getItem(storageKey)||'null');if(raw&&[raw.x,raw.y].every(Number.isFinite))setLayout({x:raw.x,y:raw.y,width:450});}catch{/* Private mode may disable storage. */}});return()=>{active=false;};},[storageKey]);
 function save(next:AudioDeviceLayout){setLayout(next);try{localStorage.setItem(storageKey,JSON.stringify(next));}catch{/* Session-only layout remains usable. */}}
 function start(e:PE<HTMLElement>){
  if(e.button!==0||(e.target as Element).closest('button,input,[role="slider"],[role="listbox"],[data-device-screen]'))return;
  e.preventDefault();e.stopPropagation();e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);
  drag.current={pointer:e.pointerId,x:e.clientX,y:e.clientY,start:fitted,last:fitted};setMoving(true);
 }
 function move(e:PE<HTMLElement>){const d=drag.current;if(!d||d.pointer!==e.pointerId)return;e.stopPropagation();d.last=fitAudioDevice({...d.start,x:d.start.x+(e.clientX-d.x)/bounds.w,y:d.start.y+(e.clientY-d.y)/bounds.h},bounds);setLayout(d.last);}
 function end(e:PE<HTMLElement>){const d=drag.current;if(!d||d.pointer!==e.pointerId)return;drag.current=null;setMoving(false);save(d.last);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}
 function cancel(){const d=drag.current;drag.current=null;setMoving(false);if(d)setLayout(d.start);}
 if(!first)return null;
 return <section className={s.host} data-audio-device="true" data-moving={moving} aria-label="Audiogerät auf dem Tisch" tabIndex={0}
  style={{left:fitted.x*100+'%',top:fitted.y*100+'%',width:fitted.width}}
  onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel} onLostPointerCapture={cancel}
  onKeyDown={e=>{if(e.target!==e.currentTarget)return;const step=e.shiftKey?.05:.01;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key)){e.preventDefault();e.stopPropagation();if(['+','-','='].includes(e.key))setCompact(false);save(fitAudioDevice({...fitted,x:fitted.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),y:fitted.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0),width:fitted.width+(e.key==='-'?-40:['+','='].includes(e.key)?40:0)},bounds));}}}>
  <UltioAudioPlayer title={first.title} src={first.src} tracks={tracks} initialVolume={view.volume} onVolume={volume=>setView({volume})}
   onResize={()=>{const small=fitAudioDevice({...fitted,width:compactWidth},bounds).width,toCompact=!compact&&fitted.width>small+1;setCompact(toCompact);save(fitAudioDevice({...fitted,width:toCompact?compactWidth:760},bounds));}} onWithdraw={onWithdraw} busy={busy}/>
 </section>;
}
