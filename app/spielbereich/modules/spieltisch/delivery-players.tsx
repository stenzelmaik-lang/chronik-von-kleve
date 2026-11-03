/* eslint-disable @next/next/no-img-element -- Recipient-checked delivery media; never a public image proxy. */
"use client";
import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {fragmentDuration,presetById,documentNumber,type PlayerDelivery} from '@/domain/personal-delivery';
import {RichTextView} from '../rich-text';
import {richTextFileIds} from '@/domain/location-rich-text';
import {playArrivalSound} from './delivery-sounds';
import styles from './delivery-players.module.css';

/* ------------------------------------------------------------------ preferences */
const EFFECTS_KEY='chroniplay-vision-effects';
/** Reduced effects: the OS setting or the player's own choice. Same content, calmer presentation. */
export function useReducedEffects(){
 const [os,setOs]=useState(false),[own,setOwn]=useState(false);
 useEffect(()=>{
  const m=window.matchMedia('(prefers-reduced-motion: reduce)');
  const sync=()=>setOs(m.matches);queueMicrotask(sync);m.addEventListener('change',sync);
  queueMicrotask(()=>{try{setOwn(localStorage.getItem(EFFECTS_KEY)==='reduced');}catch{/* preference only */}});
  return()=>m.removeEventListener('change',sync);
 },[]);
 const toggle=useCallback(()=>setOwn(v=>{try{localStorage.setItem(EFFECTS_KEY,v?'full':'reduced');}catch{/* preference only */}return !v;}),[]);
 return {reduced:os||own,own,toggle};
}

/** While a vision runs, everything else on the page is inert: no table actions, no stray focus. Restored afterwards. */
function useIsolate(host:HTMLElement|null,active:boolean,pull:boolean){
 useEffect(()=>{
  if(!host||!active)return;
  const others=[...document.body.children].filter((el):el is HTMLElement=>el!==host&&el instanceof HTMLElement);
  const before=others.map(el=>({el,inert:el.inert,filter:el.style.filter,transform:el.style.transform,transition:el.style.transition}));
  for(const el of others){el.inert=true;if(pull){el.style.transition='filter 2.4s ease, transform 2.8s ease';el.style.filter='blur(5px) saturate(.6)';el.style.transform='scale(1.025)';}}
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{for(const b of before){b.el.inert=b.inert;b.el.style.filter=b.filter;b.el.style.transform=b.transform;b.el.style.transition=b.transition;}document.body.style.overflow=overflow;};
 },[host,active,pull]);
}

/* ------------------------------------------------------------------ vision */
type Phase='enter'|'play'|'end'|'exit';
const IMAGE_SPOTS:CSSProperties[]=[{left:'5%',top:'10%'},{right:'5%',top:'30%'},{left:'9%',bottom:'7%'},{right:'10%',bottom:'10%'},{left:'34%',top:'4%'},{right:'30%',bottom:'4%'}];

export function VisionPlayer({delivery,assetUrl,onSeen,onDone,preview=false,withdrawn=false}:{delivery:PlayerDelivery;assetUrl:(fileId:string)=>string;onSeen?:()=>void;onDone:()=>void;preview?:boolean;withdrawn?:boolean}){
 const [host]=useState(()=>{if(typeof document==='undefined')return null;const el=document.createElement('div');el.className=styles.host;return el;});
 const {reduced,own,toggle}=useReducedEffects();
 const preset=presetById(delivery.preset);
 // Without text the pictures carry the vision: one "fragment" per picture keeps the same pacing and the same end.
 const steps=useMemo(()=>delivery.fragments.length?delivery.fragments:delivery.images.map(()=>''),[delivery]);
 const [phase,setPhase]=useState<Phase>('enter'),[index,setIndex]=useState(0),[fullText,setFullText]=useState(false),[sound,setSound]=useState<'off'|'on'|'blocked'>('off'),[skipped,setSkipped]=useState(false);
 const root=useRef<HTMLDivElement>(null),audio=useRef<HTMLAudioElement>(null),shownAt=useRef(0),seenSent=useRef(false);
 // Parents re-render on every poll; the latest callbacks are read at call time so timers are never restarted by that.
 const doneRef=useRef(onDone),seenRef=useRef(onSeen);
 useEffect(()=>{doneRef.current=onDone;seenRef.current=onSeen;});
 useEffect(()=>{if(!host)return;document.body.appendChild(host);return()=>{host.remove();};},[host]);
 useIsolate(host,phase!=='exit',!reduced&&!preview);
  useEffect(()=>{if(!seenSent.current&&!preview){seenSent.current=true;seenRef.current?.();}},[preview]);
 useEffect(()=>{root.current?.focus({preventScroll:true});},[host]);
 // enter -> play
 useEffect(()=>{if(phase!=='enter')return;const t=window.setTimeout(()=>{setPhase('play');shownAt.current=Date.now();},reduced?500:preset.enterMs);return()=>window.clearTimeout(t);},[phase,reduced,preset.enterMs]);
 // fragment timing: fade in, readable hold, fade out, next. The last one stays and the confirmation appears.
 const inMs=reduced?500:1700,outMs=reduced?400:1300,hold=fragmentDuration(steps[index]||'',delivery.preset,reduced,delivery.tempo);
 useEffect(()=>{
  if(phase!=='play')return;
  const last=index>=steps.length-1;
  const t=window.setTimeout(()=>{if(last)setPhase('end');else{setIndex(i=>i+1);shownAt.current=Date.now();}},inMs+hold+(last?0:outMs));
  return()=>window.clearTimeout(t);
 },[phase,index,steps.length,inMs,hold,outMs]);
 // a withdrawn vision leaves gracefully
 useEffect(()=>{if(withdrawn&&phase!=='exit')queueMicrotask(()=>setPhase('exit'));},[withdrawn,phase]);
 useEffect(()=>{if(phase!=='exit')return;const a=audio.current;if(a){const v=a.volume;let k=0;const f=window.setInterval(()=>{k++;a.volume=Math.max(0,v*(1-k/10));if(k>=10)window.clearInterval(f);},120);}const t=window.setTimeout(()=>doneRef.current(),reduced?350:1500);return()=>window.clearTimeout(t);},[phase,reduced]);
 // sound: starts with the vision if the browser allows it, otherwise one quiet button
 useEffect(()=>{
  const a=audio.current;if(!a||!delivery.audio)return;
  a.volume=0;const p=a.play();
  if(p)p.then(()=>{setSound('on');let k=0;const f=window.setInterval(()=>{k++;a.volume=Math.min(.6,k*.06);if(k>=10)window.clearInterval(f);},150);}).catch(()=>setSound('blocked'));
 },[delivery.audio]);
 // a short guard only against double clicks; fast readers may skip ahead right away
 const next=()=>{setSkipped(true);if(phase==='enter'){setPhase('play');shownAt.current=Date.now();return;}if(phase!=='play'||Date.now()-shownAt.current<500)return;if(index>=steps.length-1)setPhase('end');else{setIndex(i=>i+1);shownAt.current=Date.now();}};
 const keys=(e:React.KeyboardEvent)=>{
  if(e.key==='Escape'){e.preventDefault();setFullText(true);return;} // no silent exit: offer the readable full text instead
  if((e.key===' '||e.key==='Enter'||e.key==='ArrowRight')&&e.target===root.current){e.preventDefault();next();}
  if(e.key==='Tab'){const f=[...(root.current?.querySelectorAll<HTMLElement>('button:not([disabled])')||[])];if(!f.length)return;const i=f.indexOf(document.activeElement as HTMLElement);if(e.shiftKey&&i<=0){e.preventDefault();f.at(-1)!.focus();}else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus();}}
 };
 // pictures: each one belongs to a range of fragments and floats in its own spot, never on the text column
 const imageOf=(i:number)=>steps.length?Math.min(delivery.images.length-1,Math.floor(i*delivery.images.length/steps.length)):i;
 const visibleImages=delivery.images.map((id,k)=>({id,k,on:phase!=='enter'&&(phase==='end'?k===imageOf(steps.length-1):k===imageOf(index))||(phase==='end'&&delivery.images.length<=2)}));
 if(!host)return null;
 return createPortal(<div ref={root} tabIndex={-1} className={styles.vision} data-preset={preset.id} data-phase={phase} data-reduced={reduced||undefined} role="dialog" aria-modal="true" aria-label={preview?'Vorschau einer Vision':'Eine Vision'} onKeyDown={keys} onClick={e=>{if(e.target===e.currentTarget)next();}} style={{'--enter':`${reduced?500:preset.enterMs}ms`} as CSSProperties}>
  <div className={styles.veil} aria-hidden="true"/>
  <div className={`${styles.fog} ${styles.fogBack}`} aria-hidden="true"/>
  <div className={`${styles.fog} ${styles.fogMid}`} aria-hidden="true"/>
  <div className={styles.light} aria-hidden="true"/>
  {preset.id==='threat'&&!reduced&&<Tentacles/>}
  <div className={styles.motes} aria-hidden="true"/>
  <div className={styles.apparitions} aria-hidden="true">{visibleImages.map(img=><img key={img.id} src={assetUrl(img.id)} alt="" draggable={false} data-on={img.on||undefined} data-motion={preset.imageMotion} style={!delivery.fragments.length?{left:'50%',top:'50%',translate:'-50% -50%',width:'min(62vw,720px)'}:IMAGE_SPOTS[img.k%IMAGE_SPOTS.length]}/>)}</div>
  <div className={`${styles.fog} ${styles.fogFront}`} aria-hidden="true"/>
  <div className={styles.grain} aria-hidden="true"/>
  {preview&&<p className={styles.previewBadge}>Vorschau · nichts wird zugestellt</p>}
  <div className={styles.words} aria-live="polite">
   {phase!=='enter'&&!fullText&&steps[index]&&<p key={index} className={styles.fragment} data-last={index===steps.length-1||undefined} style={{'--in':`${inMs}ms`,'--hold':`${hold}ms`,'--out':`${outMs}ms`} as CSSProperties}>{steps[index]}</p>}
   {fullText&&<div className={styles.fullText}>{delivery.fragments.map((f,i)=><p key={i}>{f}</p>)}{!delivery.fragments.length&&<p>Diese Vision besteht aus Bildern.</p>}</div>}
  </div>
  {(phase==='end'||fullText)&&phase!=='exit'&&<div className={styles.closing}><button type="button" autoFocus className={styles.seen} onClick={()=>setPhase('exit')}>Ich habe alles gesehen</button>{!fullText&&<button type="button" className={styles.quiet} onClick={()=>{setIndex(0);setPhase('play');shownAt.current=Date.now();}}>Noch einmal</button>}</div>}
  <div className={styles.tools}>
   {phase==='play'&&<button type="button" className={`${styles.quiet} ${styles.next}`} data-hint={!skipped&&index===0||undefined} aria-keyshortcuts="Space ArrowRight" onClick={next}>Weiter ›</button>}
   {!fullText&&phase!=='exit'&&<button type="button" className={styles.quiet} onClick={()=>setFullText(true)}>Text vollständig anzeigen</button>}
   <button type="button" className={styles.quiet} aria-pressed={own} onClick={toggle}>{own?'Effekte wieder voll':'Effekte ruhiger'}</button>
   {delivery.audio&&sound==='blocked'&&<button type="button" className={styles.quiet} onClick={()=>{const a=audio.current;if(!a)return;a.volume=.6;void a.play().then(()=>setSound('on')).catch(()=>setSound('blocked'));}}>Ton einschalten</button>}
   {delivery.audio&&sound==='on'&&<button type="button" className={styles.quiet} onClick={()=>{audio.current?.pause();setSound('off');}}>Ton aus</button>}
  </div>
  {delivery.audio&&delivery.audioFileId&&<audio ref={audio} src={assetUrl(delivery.audioFileId)} loop preload="auto"/>}
 </div>,host);
}

/** Organic shadow tendrils for the threatening vision. Slow, bounded, behind the text, never in the reading column. */
function Tentacles(){
 const paths=['M-40 900 C 120 760, 60 560, 230 470 S 330 300, 260 160','M1480 860 C 1320 740, 1380 560, 1220 500 S 1110 330, 1190 190','M-60 120 C 120 180, 180 300, 320 290 S 470 200, 520 90','M1500 140 C 1330 210, 1270 330, 1130 320 S 980 230, 930 120','M700 1000 C 690 900, 760 860, 720 780 S 640 700, 690 640'];
 return <svg className={styles.tentacles} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{paths.map((d,i)=><path key={i} d={d} style={{'--i':i} as CSSProperties}/>)}</svg>;
}

/* ------------------------------------------------------------------ personal message (fax / letter) */
export function MessagePlayer({delivery,assetUrl,recipientName,onSeen,onDone,preview=false,withdrawn=false}:{delivery:PlayerDelivery;assetUrl:(fileId:string)=>string;recipientName:string;onSeen?:()=>void;onDone:()=>void;preview?:boolean;withdrawn?:boolean}){
 const [phase,setPhase]=useState<'arrive'|'read'|'leave'>('arrive'),[sound,setSound]=useState<'idle'|'played'|'blocked'>('idle');
 const audio=useRef<HTMLAudioElement>(null),soundStarted=useRef(false);
 // Above every table layer (rails, HUD, dialogs), but not modal: the table stays usable beside the message.
 const [host]=useState(()=>{if(typeof document==='undefined')return null;const el=document.createElement('div');el.className=styles.messageHost;return el;});
 useEffect(()=>{if(!host)return;document.body.appendChild(host);return()=>{host.remove();};},[host]);
 const {reduced}=useReducedEffects(),seenSent=useRef(false),button=useRef<HTMLButtonElement>(null),doneRef=useRef(onDone),seenRef=useRef(onSeen);
 useEffect(()=>{doneRef.current=onDone;seenRef.current=onSeen;});
 useEffect(()=>{if(!seenSent.current&&!preview){seenSent.current=true;seenRef.current?.();}},[preview]);
 // arrival sound once: the built-in fax/letter sound or the GM's own sound; if the browser blocks it, one quiet button
 const playSound=useCallback(()=>{
  if(delivery.arrivalSound){void playArrivalSound(delivery.arrivalSound).then(ok=>setSound(ok?'played':'blocked'));return;}
  const a=audio.current;if(!a)return;a.currentTime=0;a.volume=.7;void a.play().then(()=>setSound('played')).catch(()=>setSound('blocked'));
 },[delivery.arrivalSound]);
 useEffect(()=>{if(soundStarted.current||(!delivery.arrivalSound&&!delivery.audio))return;soundStarted.current=true;playSound();},[delivery.arrivalSound,delivery.audio,playSound]);
 useEffect(()=>{if(phase!=='arrive')return;const t=window.setTimeout(()=>setPhase('read'),reduced?300:delivery.layout==='fax'?3200:1400);return()=>window.clearTimeout(t);},[phase,reduced,delivery.layout]);
 useEffect(()=>{if(phase==='read')button.current?.focus({preventScroll:true});},[phase]);
 useEffect(()=>{if(withdrawn&&phase!=='leave')queueMicrotask(()=>setPhase('leave'));},[withdrawn,phase]);
 useEffect(()=>{if(phase!=='leave')return;const t=window.setTimeout(()=>doneRef.current(),reduced?250:900);return()=>window.clearTimeout(t);},[phase,reduced]);
 const embedded=useMemo(()=>new Set(richTextFileIds(delivery.html)),[delivery.html]);
 const attachments=delivery.images.filter(id=>!embedded.has(id));
 const stamp=new Date(delivery.createdAt);
 const when=Number.isFinite(stamp.getTime())?stamp.toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';
 if(!host)return null;
 return createPortal(<section className={styles.message} data-layout={delivery.layout} data-phase={phase} data-reduced={reduced||undefined} role="dialog" aria-modal="false" aria-label={preview?'Vorschau einer persönlichen Botschaft':'Persönliche Botschaft'} data-sound={delivery.arrivalSound||(delivery.audio?'own':undefined)} data-sound-state={sound}>
  {delivery.layout==='fax'&&<div className={styles.faxSlot} aria-hidden="true"><span className={styles.led}/><span>EMPFANG</span></div>}
  <article className={styles.sheet}>
   {preview&&<p className={styles.previewBadge}>Vorschau · nichts wird zugestellt</p>}
   {delivery.layout==='fax'?<header className={styles.faxHeader}><div><strong>TELEFAX</strong><span>{when}</span></div><div><span>Kennung {documentNumber(delivery.id)}</span><span>Seite 1/1</span></div><dl><dt>Von</dt><dd>{delivery.sender||'Absender unterdrückt'}</dd><dt>An</dt><dd>{recipientName}</dd></dl></header>
    :<header className={styles.letterHeader}>{delivery.sender&&<span>{delivery.sender}</span>}<span>{when}</span></header>}
   <div className={styles.sheetBody}><RichTextView value={delivery.html} readable flowing fileUrl={id=>delivery.images.includes(id)?assetUrl(id):''}/></div>
   {!!attachments.length&&<div className={styles.attachments} aria-label="Beilagen">{attachments.map(id=><img key={id} src={assetUrl(id)} alt="Beilage" draggable={false}/>)}</div>}
   <footer>{sound==='blocked'&&<button type="button" className={styles.soundButton} onClick={playSound}>Geräusch abspielen</button>}<button ref={button} type="button" className={styles.read} disabled={phase==='leave'} onClick={()=>setPhase('leave')}>{delivery.layout==='fax'?'Gelesen · ablegen':'Gelesen · Brief schließen'}</button></footer>
  </article>
  {delivery.audio&&delivery.audioFileId&&<audio ref={audio} src={assetUrl(delivery.audioFileId)} preload="auto"/>}
 </section>,host);
}
