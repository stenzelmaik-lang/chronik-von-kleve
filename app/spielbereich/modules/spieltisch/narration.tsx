"use client";
import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import {Eye,EyeOff,Maximize2,Minimize2,Minus,Plus} from 'lucide-react';
import {RichTextView} from '../rich-text';
import styles from './narration.module.css';

type View={scale:number;expanded:boolean;positions:Record<string,number>};
const scales=[.85,1,1.15,1.3,1.5],keep=12;
const fallback:View={scale:1,expanded:false,positions:{}};

/** Reading comfort is personal: size, reading mode and scroll position stay in this browser for this run and person only. */
function readView(key:string):View{
 try{const saved=JSON.parse(window.localStorage.getItem(key)||'null');if(saved&&typeof saved==='object')return {scale:scales.includes(saved.scale)?saved.scale:1,expanded:saved.expanded===true,positions:saved.positions&&typeof saved.positions==='object'?saved.positions:{}};}catch{/* storage unavailable */}
 return fallback;
}

type Props={gm:boolean;actorId:string;runId:string;eventId:string;title:string;narration:string;busy:boolean;onHide:()=>void;onReading?:(expanded:boolean)=>void};
/** Released narration on the shared stage. Nothing here is sent to the server except the GM's explicit removal. */
export function StageNarration({gm,actorId,runId,eventId,title,narration,busy,onHide,onReading}:Props){
 const key='chroniplay:erzaehlung:'+runId+':'+actorId;
 const [view,setViewState]=useState<View>(()=>readView(key));
 const [collapsed,setCollapsed]=useState('');
 const body=useRef<HTMLDivElement>(null),position=useRef(0),shown=useRef(''),timer=useRef(0);
 const store=(next:View)=>{try{window.localStorage.setItem(key,JSON.stringify(next));}catch{/* storage unavailable */}};
 const setView=(patch:Partial<View>)=>setViewState(current=>{const next={...current,...patch};store(next);return next;});
 const open=collapsed!==eventId;
 // A new release starts at its remembered personal position, or at the top. Size and mode
 // changes reflow the text; the reading position follows proportionally.
 useLayoutEffect(()=>{
  if(shown.current!==eventId){shown.current=eventId;position.current=readView(key).positions[eventId]||0;}
  const node=body.current;if(node)node.scrollTop=position.current*Math.max(0,node.scrollHeight-node.clientHeight);
 },[key,eventId,open,view.scale,view.expanded,narration]);
 useEffect(()=>()=>window.clearTimeout(timer.current),[]);
 // The stage hides the personal vitals dock while this person reads in reading mode.
 useEffect(()=>{onReading?.(view.expanded);return()=>onReading?.(false);},[view.expanded,onReading]);
 const onScroll=()=>{
  const node=body.current;if(!node)return;const range=node.scrollHeight-node.clientHeight,ratio=range>0?Math.round(node.scrollTop/range*1e4)/1e4:0;position.current=ratio;
  window.clearTimeout(timer.current);
  timer.current=window.setTimeout(()=>setViewState(current=>{const positions={...current.positions};delete positions[eventId];const next={...current,positions:Object.fromEntries([[eventId,ratio],...Object.entries(positions)].slice(0,keep))};store(next);return next;}),250);
 };
 const step=(direction:number)=>setView({scale:scales[Math.min(scales.length-1,Math.max(0,scales.indexOf(view.scale)+direction))]});
 return <section className={styles.narration} data-expanded={view.expanded} aria-label="Freigegebene Erzählung" style={{'--narration-scale':view.scale} as CSSProperties}>
  <header className={styles.header}>
   <small>{gm?'FÜR DIE ZIELGRUPPE SICHTBAR':'FÜR DICH IM SPIEL'}</small>
   <div className={styles.tools} role="group" aria-label="Persönliche Leseansicht">
    <button aria-label="Erzählschrift verkleinern" disabled={view.scale===scales[0]} onClick={()=>step(-1)}><Minus size={15}/></button>
    <span aria-live="polite" title="Persönliche Schriftgröße">{Math.round(view.scale*100)} %</span>
    <button aria-label="Erzählschrift vergrößern" disabled={view.scale===scales[scales.length-1]} onClick={()=>step(1)}><Plus size={15}/></button>
    <button aria-pressed={view.expanded} aria-label={view.expanded?'Lesemodus verlassen':'Erzählung im Lesemodus vergrößern'} title={view.expanded?'Lesemodus verlassen':'Lesemodus (nur für mich)'} onClick={()=>setView({expanded:!view.expanded})}>{view.expanded?<Minimize2 size={15}/>:<Maximize2 size={15}/>}</button>
    {gm?<button className={styles.labelled} disabled={busy} onClick={onHide}><EyeOff size={15}/> Für alle entfernen</button>:<button className={styles.labelled} aria-expanded={open} onClick={()=>setCollapsed(open?eventId:'')}><Eye size={15}/>{open?'Erzählung nur für mich einklappen':'Erzählung nur für mich aufklappen'}</button>}
   </div>
  </header>
  <h2 className={styles.title}>{title}</h2>
  {open&&<div ref={body} className={styles.body} tabIndex={0} aria-label={'Erzähltext: '+title} onScroll={onScroll}><RichTextView value={narration} readable flowing className={styles.prose}/></div>}
 </section>;
}
