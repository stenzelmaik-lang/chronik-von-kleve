"use client";
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import type {createAudioKnob} from './audio-knob-renderer.mjs';
import s from './ultio-audio.module.css';

export function AudioKnob({volume}:{volume:number}){
 const canvas=useRef<HTMLCanvasElement>(null),model=useRef<ReturnType<typeof createAudioKnob>|null>(null),currentVolume=useRef(volume);
 const [engine,setEngine]=useState<'css'|'webgl'>('css');
 useEffect(()=>{let active=true;void import('./audio-knob-renderer.mjs').then(({createAudioKnob})=>{if(!active||!canvas.current)return;model.current=createAudioKnob(canvas.current);model.current.update(currentVolume.current);setEngine('webgl');}).catch(()=>{/* The complete CSS cylinder remains operable without WebGL. */});return()=>{active=false;model.current?.dispose();model.current=null;};},[]);
 useEffect(()=>{currentVolume.current=volume;model.current?.update(volume);},[volume]);
 return <span className={s.knobModel} data-engine={engine} data-angle={-135+volume*270} aria-hidden="true">
  <canvas ref={canvas} className={s.knobCanvas}/>
  <span className={s.knobFallbackView}><span className={s.knobFallbackRotor} style={{'--angle':(-135+volume*270)+'deg'} as CSSProperties}><span className={s.knobFallbackCap}/>{Array.from({length:24},(_,i)=><i key={i} style={{'--facet':i*15+'deg'} as CSSProperties}/>)}</span></span>
 </span>;
}
