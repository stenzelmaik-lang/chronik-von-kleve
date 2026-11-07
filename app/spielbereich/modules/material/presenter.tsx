"use client";
/* eslint-disable @next/next/no-img-element -- Session-authorized media must bypass public image proxies. */
import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {X,Minus,Plus,ArrowLeft,ArrowRight,Volume2,VolumeX,Lock,Layers,BookOpen,Info,Backpack,Image as ImageIcon,Music,Film,Mail,FolderClosed,Package} from 'lucide-react';
import {effectiveEffect,effectProblem,materialSpeedFactor,materialTypeInfo,type MaterialCloseEffect,type MaterialDisplay,type MaterialEffectId,type MaterialType} from '@/domain/material-system';
import {RichTextView} from '../rich-text';
import {LivePdf} from '../live-pdf';
import {RetroScreen} from '../spieltisch/media-objects';
import {AudioDeviceCover,UltioAudioPlayer,type AudioTrack} from './ultio-audio';
import {useViewerState,useEffectSound,prefersReducedMotion} from './viewer-state';
import {ownClose} from './file-picker';
import styles from './presenter.module.css';

/** Everything a viewer needs to show one material: resolved URLs only, never ids or GM notes. */
export type PresentedMaterial={
 title:string;type:MaterialType;display:MaterialDisplay;
 effect:{open:MaterialEffectId;close:MaterialCloseEffect;speed:'slow'|'normal'|'fast';afterClose:'closed'|'open'};
 states:{key:string;src:string}[];pages:{title:string;src:string;mime:string}[];caption?:string;soundSrc?:string;
};
const noDrag={onPointerDown:()=>{},onPointerMove:()=>{},onPointerUp:()=>{},onPointerCancel:()=>{}};
export const typeIcon:Record<MaterialType,typeof ImageIcon>={image:ImageIcon,letter:Mail,dossier:FolderClosed,audio:Music,video:Film,pager:Mail,backdrop:ImageIcon,other:Package};
const baseDuration:Partial<Record<MaterialEffectId,number>>={instant:0,fade:650,unfold:1100,'open-book':1200,unseal:1400,'slide-out':1100,fan:1100,'page-turn':900,'lay-out':1200};
/** Duration of an opening or closing effect at a speed, without the reduced-motion rule (the viewer applies that). */
export function effectDuration(id:MaterialEffectId|MaterialCloseEffect,speed:'slow'|'normal'|'fast'){return Math.round((id==='close'?900:id==='instant'?0:id==='fade'?500:baseDuration[id as MaterialEffectId]??700)*materialSpeedFactor[speed]);}

/** The closed look of a material: its closed state image, otherwise a drawn fallback per type. */
/** Covers are small: protected library files use their stored preview (see file-thumb.tsx), stage assets stay as they are. */
const smallSrc=(src:string)=>src.startsWith('/api/files?id=')&&!src.includes('&size=')?src+'&size=thumb':src;
export function MaterialCover({material,showOpen=false,className,full=false}:{material:Pick<PresentedMaterial,'type'|'states'|'pages'|'title'>;showOpen?:boolean;className?:string;full?:boolean}){
 const small=full?(src:string)=>src:smallSrc;
 const state=(showOpen&&material.states.find(s=>s.key==='open'))||material.states.find(s=>s.key==='closed');
 const firstImage=material.pages.find(p=>p.mime.startsWith('image/'));
 const Icon=typeIcon[material.type];
 if(material.type==='image'&&firstImage)return <span className={`${styles.cover} ${styles.photoCover} ${className||''}`} data-framed={!!state}>
  <img src={small(firstImage.src)} alt="" loading="lazy" decoding="async" draggable={false}/>{state&&<img className={styles.frame} src={small(state.src)} alt="" loading="lazy" draggable={false}/>}
  {material.pages.length>1&&<b className={styles.count}><Layers size={12}/> {material.pages.length}</b>}
 </span>;
 if(state)return <span className={`${styles.cover} ${className||''}`}><img src={small(state.src)} alt="" loading="lazy" decoding="async" draggable={false}/>{material.pages.length>1&&<b className={styles.count}><Layers size={12}/> {material.pages.length}</b>}</span>;
 if(material.type==='audio')return <span className={`${styles.cover} ${className||''}`}><AudioDeviceCover title={material.title}/></span>;
 return <span className={`${styles.cover} ${styles.fallback} ${className||''}`} data-type={material.type}><Icon size={30} aria-hidden="true"/><small>{materialTypeInfo[material.type].label}</small>{material.pages.length>1&&<b className={styles.count}><Layers size={12}/> {material.pages.length}</b>}</span>;
}

/**
 * Personal material viewer (table, private Regie view and the editor's "Privat testen"). Opening, the page, zoom
 * and volume stay with this viewer; nothing here changes the shared table. Effects respect reduced motion and a
 * sound only plays after the viewer's own click and only if they did not switch effect sounds off.
 */
export function MaterialPresenter({material,personalKey,onClose,badge,onTake,audioTracks}:{material:PresentedMaterial;personalKey:string;onClose:()=>void;badge?:string;onTake?:()=>void;audioTracks?:AudioTrack[]}){
 const dialog=useRef<HTMLDialogElement>(null),timer=useRef(0),swipe=useRef<number|null>(null);
 const [view,setView]=useViewerState(personalKey),[soundOn,toggleSound]=useEffectSound();
 const stateKeys=material.states.map(s=>s.key);
 const effect=effectiveEffect(material.effect.open,{states:stateKeys,files:material.pages.length});
 const problem=effectProblem(material.effect.open,{states:stateKeys,files:material.pages.length});
 const hasCover=material.states.length>0||effect!=='instant'&&effect!=='fade';
 const [phase,setPhase]=useState<'closed'|'opening'|'open'|'closing'>(hasCover?'closed':'open');
 const [turn,setTurn]=useState(0);
 const pages=material.pages,spread=material.display==='spread',step=spread?2:1;
 const page=Math.min(view.page,Math.max(0,pages.length-1)),shown=spread?page-page%2:page;
 const duration=(id:MaterialEffectId|MaterialCloseEffect)=>prefersReducedMotion()?0:effectDuration(id,material.effect.speed);
 useEffect(()=>{const d=dialog.current;if(d&&!d.open)d.showModal();return()=>window.clearTimeout(timer.current);},[]); useEffect(()=>{if(phase==='open'&&!view.opened)setView({opened:true});},[phase,view.opened,setView]);
 // Neighbouring pages are fetched ahead, large media only when shown.
 useEffect(()=>{if(phase!=='open')return;for(const i of [shown-step,shown+step,shown+step+1]){const p=pages[i];if(p?.mime.startsWith('image/')){const img=new Image();img.decoding='async';img.src=p.src;}}},[phase,shown,step,pages]);
 function open(){
  if(material.soundSrc&&soundOn){const a=new Audio(material.soundSrc);a.volume=view.volume;void a.play().catch(()=>{});}
  const d=duration(effect);if(!d){setPhase('open');return;}
  setPhase('opening');timer.current=window.setTimeout(()=>setPhase('open'),d);
 }
 function close(){
  const d=duration(material.effect.close);
  if(!d){finish();return;}
  setPhase('closing');timer.current=window.setTimeout(finish,d);
 }
 function finish(){if(hasCover&&material.effect.afterClose==='closed'){setPhase('closed');}dialog.current?.close();}
 function go(delta:number){const next=Math.max(0,Math.min(pages.length-1,shown+delta*step));if(next===shown)return;setView({page:next});setTurn(t=>t+1);}
 // The click on the table already means "open": the closed object appears in the middle and opens by itself.
 const autoOpen=useRef(open);
 useEffect(()=>{autoOpen.current=open;});
 useEffect(()=>{if(!hasCover)return;const t=window.setTimeout(()=>autoOpen.current(),prefersReducedMotion()?0:420);return()=>window.clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the viewer appears
 },[]);
 const style={'--dur':duration(effect)+'ms','--close':duration(material.effect.close)+'ms'} as CSSProperties;
 const openState=material.states.find(s=>s.key==='open'),closedState=material.states.find(s=>s.key==='closed');
 const single=pages.length===1?pages[0]:undefined;

 const content=useMemo(()=>{
  if(material.type==='audio')return null;
  if(material.type==='video'&&single)return <div className={styles.device} data-video=""><RetroScreen title={material.title} src={single.src} drag={noDrag} skin={openState?.src||closedState?.src} onEnlarge={()=>setView({zoom:view.zoom>1?1:1.6})}/></div>;
  if(single?.mime==='application/pdf')return <LivePdf url={single.src} name={material.title}/>;
  if(!pages.length)return null;
  if(material.display==='grid')return <ul className={styles.grid}>{pages.map((p,i)=><li key={p.src} style={{'--i':i} as CSSProperties}><button type="button" aria-label={'Öffnen: '+(p.title||'Seite '+(i+1))} onClick={()=>setView({page:i})} aria-pressed={i===page}><img src={p.src} alt={p.title||'Seite '+(i+1)} loading="lazy" decoding="async"/></button><small>{p.title}</small></li>)}</ul>;
  if(material.display==='stack')return <div className={styles.stack} aria-label="Stapel">{pages.map((p,i)=>({p,i})).filter(({i})=>i>=page&&i<page+4).reverse().map(({p,i})=><figure key={p.src} className={styles.stackCard} data-top={i===page} style={{'--d':i-page,'--i':i} as CSSProperties}><img src={p.src} alt={i===page?(p.title||'Bild '+(i+1)):''} loading={i===page?'eager':'lazy'} decoding="async" style={{maxHeight:Math.round(62*view.zoom)+'vh'}}/><figcaption>{i===page?p.title:''}</figcaption></figure>)}</div>;
  const visible=spread?pages.slice(shown,shown+2):[pages[shown]];
  return <div key={turn} className={styles.book} data-display={material.display} data-turn={turn>0}>{visible.map((p,i)=><figure key={p.src} style={{'--i':i} as CSSProperties}><img src={p.src} alt={p.title||'Seite '+(shown+i+1)} decoding="async" style={{width:Math.round((spread?460:760)*view.zoom),maxWidth:view.zoom>1?'none':'100%'}}/>{p.title&&<figcaption>{p.title}</figcaption>}</figure>)}</div>;
 },[material,pages,single,page,shown,spread,turn,view.zoom,setView,openState,closedState]);

 const paged=pages.length>1&&material.display!=='grid'&&material.type!=='audio'&&material.type!=='video';
 // Without a window: the object lies on the darkened table, a click beside it or Escape closes it again.
 return <dialog ref={dialog} className={styles.presenter} aria-label={audioTracks?'Audiogerät':'Material: '+material.title} style={style}
  onCancel={e=>{if(e.target!==e.currentTarget)return;e.preventDefault();close();}} onClose={ownClose(onClose)}
  onClick={e=>{const t=e.target as HTMLElement;if(phase!=='closing'&&(t===e.currentTarget||t.dataset.backdrop!==undefined))close();}}
  onKeyDown={e=>{if(phase!=='open'||!paged)return;if(e.key==='ArrowRight'){e.preventDefault();go(1);}else if(e.key==='ArrowLeft'){e.preventDefault();go(-1);}}}
  onTouchStart={e=>{swipe.current=e.touches[0]?.clientX??null;}} onTouchEnd={e=>{const x=swipe.current;swipe.current=null;const end=e.changedTouches[0]?.clientX;if(x===null||end===undefined||!paged||phase!=='open')return;if(Math.abs(end-x)>60)go(end<x?1:-1);}}>
  <div className={styles.chrome}>
   <div className={styles.title}><small>{badge?<><Lock size={11}/> {badge}</>:materialTypeInfo[material.type].label}</small><h2 title={material.title}>{material.title}</h2>
    {material.caption&&<span className={styles.info}><button type="button" aria-label="Info zum Material" aria-describedby="material-info"><Info/></button><span id="material-info" role="tooltip" className={styles.infoTip}><RichTextView value={material.caption} readable flowing/></span></span>}
   </div>
   <div className={styles.tools}>
    {phase==='open'&&material.type!=='audio'&&material.type!=='video'&&!!pages.length&&<><button type="button" aria-label="Verkleinern" onClick={()=>setView({zoom:Math.max(.6,Math.round((view.zoom-.2)*10)/10)})}><Minus/></button><span aria-live="polite">{Math.round(view.zoom*100)} %</span><button type="button" aria-label="Vergrößern" onClick={()=>setView({zoom:Math.min(2.4,Math.round((view.zoom+.2)*10)/10)})}><Plus/></button></>}
    {onTake&&<button type="button" className={styles.take} onClick={onTake}><Backpack/> Einstecken</button>}
    {material.soundSrc&&<button type="button" aria-pressed={soundOn} aria-label={soundOn?'Effektton für mich ausschalten':'Effektton für mich einschalten'} onClick={toggleSound}>{soundOn?<Volume2/>:<VolumeX/>}</button>}
    <button type="button" aria-label="Schließen (nur für mich)" onClick={close}><X/></button>
   </div>
  </div>
  {problem&&badge&&<p className={styles.notice} role="note">{problem}</p>}
  <div className={styles.stage} data-backdrop="" data-phase={phase} data-effect={phase==='closing'?'close-'+material.effect.close:effect}>
   {(phase==='closed'||phase==='opening'||phase==='closing')&&<div className={styles.coverLayer} data-backdrop="">
    {closedState?<img className={styles.closedImage} src={closedState.src} alt={material.title+' (geschlossen)'} decoding="async"/>:<MaterialCover material={material} className={styles.closedImage} full/>}
    {openState&&<img className={styles.openImage} src={openState.src} alt="" decoding="async"/>}
   </div>}
   {phase==='closed'&&!hasCover&&<button type="button" className={styles.openButton} onClick={open} autoFocus><BookOpen size={18}/> Öffnen</button>}
   {phase!=='closed'&&<div className={styles.content} data-display={material.display} data-backdrop="">{material.type==='audio'&&single?<div className={styles.audioDevice}><UltioAudioPlayer key={audioTracks?'playlist':single.src} title={material.title} src={single.src} tracks={audioTracks} initialVolume={view.volume} onVolume={volume=>setView({volume})} onStop={close} suspended={phase==='closing'}/></div>:content}</div>}
  </div>
  {phase==='open'&&paged&&<>
   <button type="button" className={styles.prev} disabled={shown===0} aria-label={material.display==='stack'?'Vorheriges Bild':'Vorherige Seite'} onClick={()=>go(-1)}><ArrowLeft/></button>
   <button type="button" className={styles.next} disabled={shown+step>=pages.length} aria-label={material.display==='stack'?'Nächstes Bild':'Nächste Seite'} onClick={()=>go(1)}><ArrowRight/></button>
   <span className={styles.pageCount} aria-live="polite">{spread&&shown+1<pages.length?'Seiten '+(shown+1)+'–'+(shown+2):(material.display==='stack'?'Bild ':'Seite ')+(shown+1)} / {pages.length}</span>
  </>}
 </dialog>;
}
