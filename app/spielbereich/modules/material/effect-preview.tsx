"use client";
/* eslint-disable @next/next/no-img-element -- Protected existing file endpoints (previews). */
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {Play} from 'lucide-react';
import type {MaterialCloseEffect,MaterialEffectId} from '@/domain/material-system';
import {effectDuration} from './presenter';
import {prefersReducedMotion} from './viewer-state';
import styles from './effect-preview.module.css';

/**
 * A small stage that plays one opening effect with the material's own pictures: closed look, open look and first
 * page. It loops while `playing`; the editor shows it on every effect card (on hover) and large for the chosen effect.
 * Only previews of library files are used, so this stays light.
 */
type Phase='closed'|'opening'|'open'|'closing';
export function EffectPreview({closed,open,page,effect,close='fade',speed='normal',playing,label}:{closed?:string;open?:string;page?:string;effect:MaterialEffectId;close?:MaterialCloseEffect;speed?:'slow'|'normal'|'fast';playing:boolean;label?:string}){
 const [phase,setPhase]=useState<Phase>('closed');
 const timer=useRef(0);
 useEffect(()=>{
  window.clearTimeout(timer.current);
  if(!playing||prefersReducedMotion()){queueMicrotask(()=>setPhase(playing?'open':'closed'));return;}
  const dur=Math.max(250,effectDuration(effect,speed)),shut=Math.max(250,effectDuration(close,speed));
  const steps:[Phase,number][]=[['closed',650],['opening',dur],['open',1500],['closing',shut]];
  let i=0;const run=()=>{const [p,ms]=steps[i];setPhase(p);i=(i+1)%steps.length;timer.current=window.setTimeout(run,ms);};
  run();return()=>window.clearTimeout(timer.current);
 },[playing,effect,close,speed]);
 const style={'--dur':Math.max(250,effectDuration(effect,speed))+'ms','--close':Math.max(250,effectDuration(close,speed))+'ms'} as CSSProperties;
 const cover=closed||page;
 return <div className={styles.preview} data-phase={phase} data-effect={phase==='closing'?'close-'+close:effect} style={style} aria-label={label} role={label?'img':undefined}>
  {(phase==='closed'||phase==='opening'||phase==='closing')&&cover&&<div className={styles.cover}><img className={styles.closed} src={cover} alt="" draggable={false}/>{open&&<img className={styles.open} src={open} alt="" draggable={false}/>}</div>}
  {phase!=='closed'&&page&&<div className={styles.content}><img src={page} alt="" draggable={false}/><img src={page} alt="" draggable={false} aria-hidden="true"/></div>}
  {!cover&&!page&&<span className={styles.empty}>Noch keine Bilder</span>}
  {!playing&&<span className={styles.play} aria-hidden="true"><Play size={14}/></span>}
 </div>;
}
