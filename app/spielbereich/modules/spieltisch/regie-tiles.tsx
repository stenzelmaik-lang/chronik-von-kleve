"use client";

import {Children, isValidElement, useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {LayoutGrid, RotateCcw, ArrowLeft, ArrowRight, EyeOff, Grip, Maximize2, Minimize2, StretchHorizontal} from 'lucide-react';
import styles from './regie-window.module.css';

type TileProps = {title:string; children:ReactNode; area?:string; open?:boolean};
type Layout = {order:string[]; hidden:string[]; wide:string[]};
const initial:Layout = {order:['narration','atmosphere','dialogue','interactions','material'],hidden:[],wide:[]};
const tileId = (props:TileProps) => props.area || props.title;

export function Block(props:TileProps){return <>{props.children}</>;}

export function useRegieLayout(key:string){
 const [saved,setSaved]=useState<{key:string;layout:Layout}|null>(null);
 useEffect(()=>{
  let layout=initial;
  try {
   const raw=JSON.parse(localStorage.getItem(key)||'null');
   if(raw && ['order','hidden','wide'].every(field=>Array.isArray(raw[field])&&raw[field].every((item:unknown)=>typeof item==='string')))layout=raw;
  } catch {/* A malformed or unavailable preference falls back to the default. */}
  queueMicrotask(()=>setSaved({key,layout}));
 },[key]);
 const change=useCallback((update:(layout:Layout)=>Layout)=>setSaved(current=>({key,layout:update(current?.key===key?current.layout:initial)})),[key]);
 useEffect(()=>{if(saved?.key===key)try{localStorage.setItem(key,JSON.stringify(saved.layout));}catch{/* Storage is optional. */}},[key,saved]);
 const reveal=useCallback((id:string)=>change(layout=>layout.hidden.includes(id)?{...layout,hidden:layout.hidden.filter(item=>item!==id)}:layout),[change]);
 return {layout:saved?.key===key?saved.layout:initial,change,reveal};
}

function Tile({id,title,children,open=true,hidden,wide,move,canMove,toggleWidth,hide,onDrag,onDrop}:TileProps&{
 id:string;hidden:boolean;wide:boolean;move:(offset:number)=>void;canMove:(offset:number)=>boolean;
 toggleWidth:()=>void;hide:()=>void;onDrag:()=>void;onDrop:()=>void;
}){
 const dialog=useRef<HTMLDialogElement>(null);
 const expand=useRef<HTMLButtonElement>(null);
 const [expanded,setExpanded]=useState(false);
 function toggleFull(next:boolean){
  const element=dialog.current;
  if(!element)return;
  element.close();
  if(next)element.showModal();else element.show();
  setExpanded(next);
  expand.current?.focus();
 }
 return <dialog open ref={dialog} hidden={hidden} className={styles.tile} role={expanded?'dialog':'group'} id={'regie-bereich-'+id} data-area={id} data-wide={wide} aria-label={title}
  onCancel={event=>{event.preventDefault();toggleFull(false);}}
  onDragOver={event=>{if(event.dataTransfer.types.includes('application/x-chroniplay-tile'))event.preventDefault();}}
  onDrop={event=>{if(!event.dataTransfer.types.includes('application/x-chroniplay-tile'))return;event.preventDefault();onDrop();}}>
  <header className={styles.tileHeader}>
   <h3>{title}</h3>
   <div role="group" aria-label={'Kachel einstellen: '+title}>
    {!expanded&&<>
     <button type="button" draggable title="Zum Verschieben ziehen" aria-label={title+' ziehen'} onDragStart={event=>{event.dataTransfer.setData('application/x-chroniplay-tile',id);event.dataTransfer.effectAllowed='move';onDrag();}}><Grip size={15}/></button>
     <button type="button" aria-label={title+' nach vorne verschieben'} disabled={!canMove(-1)} onClick={()=>move(-1)}><ArrowLeft size={15}/></button>
     <button type="button" aria-label={title+' nach hinten verschieben'} disabled={!canMove(1)} onClick={()=>move(1)}><ArrowRight size={15}/></button>
     <button type="button" aria-label={title+' breiter anzeigen'} aria-pressed={wide} onClick={toggleWidth}><StretchHorizontal size={15}/></button>
    </>}
    <button type="button" ref={expand} aria-label={title+(expanded?' Vollbild schließen':' im Vollbild öffnen')} onClick={()=>toggleFull(!expanded)}>{expanded?<Minimize2 size={15}/>:<Maximize2 size={15}/>}</button>
    {!expanded&&<button type="button" aria-label={title+' ausblenden'} onClick={hide}><EyeOff size={15}/></button>}
   </div>
  </header>
  <div className={styles.tileBody}>
   {open?children:<details><summary>Inhalt öffnen</summary>{children}</details>}
  </div>
 </dialog>;
}

export function RegieTiles({children,state,toolbar}:{children:ReactNode;state:ReturnType<typeof useRegieLayout>;toolbar:HTMLDivElement|null}){
 const drag=useRef<string|null>(null);
 const elements=Children.toArray(children);
 const blocks=elements.filter(isValidElement<TileProps>).filter(item=>item.type===Block);
 const byId=new Map(blocks.map(item=>[tileId(item.props),item.props]));
 const ids=[...new Set([...state.layout.order,...byId.keys()])].filter(id=>byId.has(id));
 const visible=ids.filter(id=>!state.layout.hidden.includes(id));
 const hidden=ids.filter(id=>state.layout.hidden.includes(id));
 function move(id:string,target:string){
  if(id===target||!ids.includes(id)||!ids.includes(target))return;
  const next=ids.filter(item=>item!==id);
  next.splice(ids.indexOf(target),0,id);
  state.change(layout=>({...layout,order:next}));
 }
 return <>
  {toolbar&&createPortal(<details className={styles.headerMenu}>
   <summary><LayoutGrid size={15}/> Layout{hidden.length>0&&' ('+hidden.length+')'}</summary>
   <div className={styles.menuBody}>
    {hidden.map(id=><button key={id} type="button" onClick={()=>state.reveal(id)}>{byId.get(id)!.title} einblenden</button>)}
    <button type="button" onClick={()=>state.change(()=>initial)}><RotateCcw size={15}/> Layout zurücksetzen</button>
   </div>
  </details>,toolbar)}
  {elements.filter(element=>!isValidElement(element)||element.type!==Block)}
  {ids.map(id=>{
   const index=visible.indexOf(id);
   return <Tile key={id} {...byId.get(id)!} id={id} hidden={index<0} wide={state.layout.wide.includes(id)}
    move={offset=>move(id,visible[index+offset])} canMove={offset=>!!visible[index+offset]}
    toggleWidth={()=>state.change(layout=>({...layout,wide:layout.wide.includes(id)?layout.wide.filter(item=>item!==id):[...layout.wide,id]}))}
    hide={()=>state.change(layout=>({...layout,hidden:[...layout.hidden,id]}))}
    onDrag={()=>{drag.current=id;}} onDrop={()=>{if(drag.current)move(drag.current,id);drag.current=null;}}/>;
  })}
 </>;
}
