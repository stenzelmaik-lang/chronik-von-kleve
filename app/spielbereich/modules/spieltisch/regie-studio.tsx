"use client";

import {Children,isValidElement,useCallback,useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft,ArrowRight,BookOpen,ChevronRight,Dices,EyeOff,Layers,LayoutGrid,Maximize2,Minimize2,PanelRightClose,Radio,RotateCcw,StretchHorizontal,Volume2,X,Zap,Keyboard,Pencil,Users} from 'lucide-react';
import {regieGroups,regieAreaLabels,regieAreaOf,regieGroupOf,type RegieGroup} from '@/domain/regie-studio';
import {Block,type TileProps,type useRegieLayout} from './regie-tiles';
import styles from './regie-studio.module.css';

const groupIcons={scene:BookOpen,interaction:Layers,mood:Volume2,checks:Dices,players:Users,table:LayoutGrid};
const quickTools=[['Szenenmaterial','Material',Layers,'M'],['effects','Effekte',Zap,'E'],['Pager · spontan','Pager',Radio,'P']] as const;
const readingAreas=regieGroups[0].areas as readonly string[];

/** One mounted instance per existing module: drawers never copy forms or recreate release state. */
function StudioPane({id,title,children,active,drawer,focus,wide,contextKey,onFocus,onWide,onHide,onClose,move,readingTools}:TileProps&{
 id:string;active:boolean;drawer:boolean;focus:boolean;wide:boolean;contextKey:string;
 onFocus:()=>void;onWide:()=>void;onHide:()=>void;onClose:()=>void;move:(offset:number)=>void;readingTools?:ReactNode;
}){
 const scroll=useRef<HTMLDivElement>(null);
 const positionKey='chroniplay:regie-lesestelle:'+contextKey+':'+id;
 useLayoutEffect(()=>{
  const element=scroll.current;if(!element)return;
  try{element.scrollTop=Number(sessionStorage.getItem(positionKey)||0);}catch{/* Optional personal storage. */}
 },[positionKey]);
 return <section id={'regie-bereich-'+id} data-area={id} data-wide={wide} data-slot={drawer?'drawer':'primary'} data-reading={readingAreas.includes(id)}
  className={styles.pane} hidden={!active} aria-label={title}>
  <header className={styles.paneHeader}>
   <h3>{title}</h3>
   <div role="group" aria-label={'Ansicht: '+title}>
    {readingAreas.includes(id)&&readingTools}
    <details className={styles.paneMenu}><summary aria-label={title+' anordnen'}><LayoutGrid size={16}/></summary><div>
     <button type="button" onClick={()=>move(-1)}><ArrowLeft size={15}/> Weiter nach vorne</button>
     <button type="button" onClick={()=>move(1)}><ArrowRight size={15}/> Weiter nach hinten</button>
     <button type="button" onClick={onHide}><EyeOff size={15}/> Ausblenden</button>
    </div></details>
    <button type="button" aria-label={title+' breiter anzeigen'} aria-pressed={wide} onClick={onWide} title="Breite Ansicht"><StretchHorizontal size={17}/></button>
    <button type="button" aria-label={title+(focus?' Vollbild schließen':' im Vollbild öffnen')} aria-pressed={focus} onClick={onFocus} title={focus?'Fokus beenden':'Lesefokus · ganze Arbeitsfläche'}>{focus?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button>
    {drawer&&<button type="button" aria-label="Werkzeug schließen und Text fortsetzen" onClick={onClose}><X size={18}/></button>}
   </div>
  </header>
  <div className={styles.paneBody} ref={scroll} tabIndex={0} aria-label={title+' Inhalt'} onScroll={event=>{try{sessionStorage.setItem(positionKey,String(event.currentTarget.scrollTop));}catch{/* Optional. */}}}>{children}</div>
 </section>;
}

export function RegieStudio({children,area,onArea,state,toolbar,contextKey,sceneTitle,place,prepared,status,pending=0,readingTools,editUrl,presence}:{
 children:ReactNode;area:string;onArea:(area:string)=>void;state:ReturnType<typeof useRegieLayout>;toolbar:HTMLDivElement|null;
 contextKey:string;sceneTitle:string;place?:string;prepared:{id:string;title:string;area:string}[];status:ReactNode;pending?:number;readingTools?:ReactNode;editUrl:string;
 /** Always visible: who is at the table and whether they are online. */ presence?:ReactNode;
}){
 const elements=Children.toArray(children).filter(isValidElement<TileProps>).filter(item=>item.type===Block);
 const blocks=new Map(elements.map(item=>[item.props.area||item.props.title,item.props]));
 const ids=[...new Set([...state.layout.order,...blocks.keys()])].filter(id=>blocks.has(id));
 const group=regieGroupOf(area);
 const active=blocks.has(area)?area:regieAreaOf(group,ids)||ids[0];
 const [quick,setQuick]=useState<string|null>(null),[focus,setFocus]=useState<string|null>(null),[help,setHelp]=useState(false);
 const remembered=useRef<Partial<Record<RegieGroup,string>>>({scene:'narration'});
 const returnFocus=useRef<HTMLElement|null>(null),lastReader=useRef('narration');
 const root=useRef<HTMLDivElement>(null);
 const reveal=state.reveal;
 const select=useCallback((id:string)=>{reveal(id);onArea(id);setQuick(null);setFocus(null);},[onArea,reveal]);
 useEffect(()=>{remembered.current[group]=active;if(readingAreas.includes(active))lastReader.current=active;},[group,active]);
 const closeQuick=useCallback(()=>{setQuick(null);requestAnimationFrame(()=>returnFocus.current?.focus({preventScroll:true}));},[]);
 const openQuick=useCallback((id:string)=>{
  if(!ids.includes(id))return;
  returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  reveal(id);setQuick(old=>old===id?null:id);
 },[reveal,ids]);
 useEffect(()=>{
  if(!quick)return;
  requestAnimationFrame(()=>root.current?.querySelector<HTMLElement>('[data-slot="drawer"] button')?.focus({preventScroll:true}));
 },[quick]);
 const goGroup=useCallback((next:RegieGroup)=>{const id=regieAreaOf(next,ids,remembered.current[next]);if(id)select(id);},[ids,select]);
 useEffect(()=>{
  const key=(event:KeyboardEvent)=>{
   if(event.defaultPrevented)return;
   if(event.key==='Escape'){
    // Private previews own their native dialog's Escape, not the workspace below it.
    if(document.querySelector('dialog:modal'))return;
    if(help){event.preventDefault();setHelp(false);}else if(quick){event.preventDefault();closeQuick();}else if(focus){event.preventDefault();setFocus(null);}
    return;
   }
   if(!event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.isComposing)return;
   if(event.target instanceof HTMLElement&&event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
   const n=Number(event.key),tool=quickTools.find(item=>item[3].toLowerCase()===event.key.toLowerCase());
   if(n>=1&&n<=regieGroups.length){event.preventDefault();goGroup(regieGroups[n-1].id);}
   else if(tool){event.preventDefault();openQuick(tool[0]);}
   else if(event.key.toLowerCase()==='f'){event.preventDefault();setFocus(old=>old?null:active);}
  };
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[active,goGroup,openQuick,quick,focus,help,closeQuick]);
 // Focus and drawers are workspace states, not native fullscreen. Their quick tools stay available.
 const tabs=ids.filter(id=>(regieGroups.find(item=>item.id===group)!.areas as readonly string[]).includes(id));
 const hidden=ids.filter(id=>state.layout.hidden.includes(id));
 function move(id:string,offset:number){
  const peers=ids.filter(other=>regieGroupOf(other)===regieGroupOf(id)),target=peers[peers.indexOf(id)+offset];if(!target)return;
  const order=ids.filter(other=>other!==id);order.splice(ids.indexOf(target),0,id);state.change(old=>({...old,order}));
 }
 function hide(id:string){
  state.change(old=>({...old,hidden:[...new Set([...old.hidden,id])]}));
  if(quick===id)closeQuick();
  else if(active===id){const next=tabs.find(other=>other!==id&&!state.layout.hidden.includes(other));if(next)select(next);else select('narration');}
  setFocus(null);
 }
 return <div ref={root} className={styles.studio} data-regie-studio="true" data-focus={!!focus} data-drawer={!!quick} data-wide={state.layout.wide.includes(focus||active)}>
  {toolbar&&createPortal(<details className={styles.settings}><summary aria-label="Layout einstellen" title="Layout einstellen"><LayoutGrid size={15}/> Layout</summary><div>
   {hidden.map(id=><button type="button" key={id} onClick={()=>select(id)}>{regieAreaLabels[id]||blocks.get(id)!.title} einblenden</button>)}
   <button type="button" onClick={()=>state.change(()=>({order:['narration','dialogue','atmosphere'],hidden:[],wide:[]}))}><RotateCcw size={15}/> Layout zurücksetzen</button>
  </div></details>,toolbar)}
  <nav className={styles.navigation} aria-label="Arbeitsansichten der Regie">
   {regieGroups.map((item,index)=>{const Icon=groupIcons[item.id];return <button type="button" key={item.id} aria-current={group===item.id?'page':undefined} title={'Alt+'+(index+1)} onClick={()=>goGroup(item.id)}><Icon size={19}/><span>{item.title}</span>{item.id==='checks'&&pending>0?<b aria-label={pending+' Würfe ausstehend'}>{pending}</b>:<kbd aria-hidden="true">{index+1}</kbd>}</button>;})}
   {presence}
   <button type="button" className={styles.helpButton} aria-expanded={help} onClick={()=>setHelp(value=>!value)}><Keyboard size={18}/><span>Tastenkürzel</span></button>
  </nav>
  <div className={styles.work}>
   <header className={styles.workHeader}><div><span className={styles.place}>{place||sceneTitle}</span><h2>{regieGroups.find(item=>item.id===group)!.title}</h2></div><div className={styles.workActions}><span className={styles.private}>Privat · nur SL</span><a href={editUrl} target="_blank" rel="noopener noreferrer"><Pencil size={15}/> Vorbereitung bearbeiten</a></div></header>
   <nav className={styles.tabs} aria-label={'Werkzeuge: '+regieGroups.find(item=>item.id===group)!.title}>
    {tabs.map(id=><button type="button" key={id} data-area-button={id} data-hidden={state.layout.hidden.includes(id)||undefined} aria-current={active===id?'true':undefined} onClick={()=>select(id)}>{regieAreaLabels[id]||blocks.get(id)!.title}{state.layout.hidden.includes(id)&&<EyeOff size={13}/>}</button>)}
   </nav>
   <div className={styles.content}>
    {ids.map(id=>{const props=blocks.get(id)!;return <StudioPane key={id} {...props} id={id} contextKey={contextKey} readingTools={readingTools} active={focus?id===focus||id===quick:id===active||id===quick} drawer={id===quick}
     focus={id===focus} wide={state.layout.wide.includes(id)} onFocus={()=>{if(quick===id)setQuick(null);setFocus(old=>old===id?null:id);}}
     onWide={()=>state.change(old=>({...old,wide:old.wide.includes(id)?old.wide.filter(x=>x!==id):[...old.wide,id]}))} onHide={()=>hide(id)} onClose={closeQuick} move={offset=>move(id,offset)}/>;})}
    <aside className={styles.context} aria-label="Szenenkontext"><h3>{sceneTitle}</h3>{place&&<p>{place}</p>}
     <div className={styles.prepared}><h4>Bereit zum Ausspielen</h4>{prepared.length?prepared.slice(0,8).map(item=><button type="button" key={item.id} onClick={()=>{openQuick(item.area);requestAnimationFrame(()=>{
       const pane=document.getElementById('regie-bereich-'+item.area);const target=pane?.querySelector<HTMLElement>('[data-material="'+CSS.escape(item.id)+'"]');target?.scrollIntoView({block:'nearest'});
      });}}><Layers size={16}/><span>{item.title}</span><ChevronRight size={15}/></button>):<p>Für diese Szene ist noch kein Material vorbereitet.</p>}</div>
     <p className={styles.contextHint}><Zap size={17}/> Material und Effekte öffnen sich seitlich. Deine Textstelle bleibt erhalten.</p>
    </aside>
   </div>
  </div>
  <footer className={styles.quickbar} role="region" aria-label="Schnellwerkzeuge">
   <div>{quickTools.map(([id,title,Icon,key])=><button type="button" key={id} aria-pressed={quick===id} onClick={()=>openQuick(id)}><Icon size={17}/>{title}<kbd>Alt {key}</kbd></button>)}
    <button type="button" onClick={()=>{if(quick)closeQuick();else{setFocus(null);select(lastReader.current);}}}><PanelRightClose size={17}/> Text fortsetzen <kbd>Esc</kbd></button>
   </div><div className={styles.status}>{status}</div>
  </footer>
  {help&&<aside className={styles.help} aria-label="Tastenkürzel"><header><h3>Schnell durch die Regie</h3><button type="button" aria-label="Tastenkürzel schließen" onClick={()=>setHelp(false)}><X size={18}/></button></header><p><kbd>Alt 1–5</kbd> Arbeitsansicht wechseln</p><p><kbd>Alt M / E / P</kbd> Material, Effekte oder Pager</p><p><kbd>Alt F</kbd> Fokus öffnen / schließen</p><p><kbd>Esc</kbd> Werkzeug schließen, dann Fokus beenden</p><small>Kürzel öffnen Werkzeuge. Ausgespielt wird erst mit deiner Freigabe.</small></aside>}
 </div>;
}
