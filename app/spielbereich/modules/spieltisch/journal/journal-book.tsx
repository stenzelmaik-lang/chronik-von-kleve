'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState,type CSSProperties,type PointerEvent as PE,type ReactNode} from 'react';
import {api,ApiError} from '../../api-client';
import type {CharacterCompanionNote} from '../../character';
import type {Snapshot} from '../types';
import {useJournalData} from './use-journal';
import {EntryEditor,EntryList,type SaveState} from './journal-entries';
import {sheetAdvantages,sheetStory,sheetTraits} from './journal-sheet';
import {DogEar,Hotspot,JournalIcon,Medallion,Ribbon,RibbonLoop,type JournalIconName} from './journal-controls';
import {JOURNAL_REGISTERS,JOURNAL_SPREADS,OWN_BOOKMARK_LIMIT,addBookmark,chronicleEntries,clampPlace,clampSpread,draftDirty,draftRequest,noteEntries,readBookmarks,registerOf,registerStart,removeBookmark,spreadIndex,viewAfterEscape,type JournalBookmark,type JournalDraft,type JournalKind,type JournalView,type TablePlace} from '@/domain/journal';
import styles from './journal.module.css';

// Abenteuerjournal at the live table (AJ-01). The book is an object on the table, not a window: it can be packed away
// (handle at the table edge), lie shut on the table, lie open at reading size, or be enlarged over the stage. Shut and
// open it can be moved freely. Everything happens inside the running round: the table route, the session and its
// connection stay; the stage keeps polling underneath. Texts, controls and values are a sharp HTML layer; the 3D book
// (Three.js) draws leather, brass, paper, tabs, ribbons and the turning leaf. Without WebGL, with reduced motion or by
// choice the same book is drawn with CSS and stays fully usable; on narrow screens the open book fills the screen.

type BookScene={ready:Promise<void>;setSizeIcon:(name:'enlarge'|'shrink')=>void;draw:(f:Frame)=>void;resize:()=>void;printTurn:(a:{title:string;body:string},b:{title:string;body:string})=>void;dispose:()=>void};
type Frame={open:number;index:number;total:number;turn:{forward:boolean;progress:number}|null;activeTab:number};
type Rect={left:number;top:number;width:number;height:number};
type Layout={cover:Rect;left:Rect;right:Rect;previous:Rect;next:Rect;folioLeft:Rect;folioRight:Rect;tabs:Rect[];tools:Rect[];closedTools:Rect[];edgeLeft:Rect;edgeRight:Rect;unit:number};
type Stored={spread:number;drafts:Partial<Record<JournalKind,JournalDraft>>;selected:Partial<Record<JournalKind,string>>};
type Placed={place:TablePlace|null;bookmarks:JournalBookmark[]};
const tabIndex=(spread:number)=>JOURNAL_REGISTERS.findIndex(r=>r.id===registerOf(spread));
const idle:SaveState={kind:'idle'};

/** Per-viewer conveniences only: book position and unsent drafts (this tab), where the book lies (this browser). */
function readStored(key:string):Stored{
 try{const v=JSON.parse(window.sessionStorage.getItem(key)||'null');if(v&&typeof v==='object')return {spread:clampSpread(v.spread),drafts:v.drafts&&typeof v.drafts==='object'?v.drafts:{},selected:v.selected&&typeof v.selected==='object'?v.selected:{}};}catch{/* storage unavailable */}
 return {spread:0,drafts:{},selected:{}};
}
function readPlaced(key:string):Placed{
 try{const v=JSON.parse(window.localStorage.getItem(key)||'null');if(v&&typeof v==='object')return {place:v.place&&Number.isFinite(v.place.cx)&&Number.isFinite(v.place.cy)?v.place:null,bookmarks:readBookmarks(v.bookmarks)};}catch{/* storage unavailable */}
 return {place:null,bookmarks:[]};
}
function animate(ms:number,tick:(p:number)=>void,instant:boolean){
 if(instant){tick(1);return Promise.resolve();}
 return new Promise<void>(resolve=>{let start:number|undefined;const step=(now:number)=>{start??=now;const p=Math.min(1,(now-start)/ms);tick(p*p*(3-2*p));if(p===1)resolve();else requestAnimationFrame(step);};requestAnimationFrame(step);});
}
function put(el:HTMLElement|null,r:Rect|undefined){if(!el||!r)return;el.style.left=r.left+'px';el.style.top=r.top+'px';el.style.width=r.width+'px';el.style.height=r.height+'px';}
/** The play area: right of the rail, below the top bar. */
const playArea=()=>({left:56,top:56,right:window.innerWidth,bottom:window.innerHeight});
function bookSize(view:JournalView,flat:boolean){
 const a=playArea(),w=a.right-a.left,h=a.bottom-a.top;
 if(view==='closed')return flat?{width:210,height:280}:{width:310,height:370};
 const width=Math.round(Math.min(1260,Math.max(540,w*.72),w-24)),height=Math.round(Math.min(width/1.72,h-40));
 return {width:Math.round(Math.min(width,height*1.72)),height};
}

export function JournalBook({actorId,snapshot,pendingCheck,onOpenCheck,inert}:{actorId:string;snapshot:Snapshot|null;pendingCheck:string;onOpenCheck:()=>void;inert?:boolean}){
 const storeKey='chroniplay-journal:v1:'+actorId,placeKey='chroniplay-journal-place:v2:'+actorId;
 const [restored]=useState(()=>readStored(storeKey));
 const [placed,setPlaced]=useState(()=>readPlaced(placeKey));
 const [view,setView]=useState<JournalView>('stored');
 const [spread,setSpread]=useState(restored.spread),[target,setTarget]=useState(restored.spread);
 const [drafts,setDrafts]=useState(restored.drafts),[selected,setSelected]=useState(restored.selected);
 const [save,setSave]=useState<Record<JournalKind,SaveState>>({note:idle,chronicle:idle});
 const [busy,setBusy]=useState(false),[mobilePage,setMobilePage]=useState<0|1>(0);
 const [webgl,setWebgl]=useState<'pending'|'ready'|'failed'>('pending'),[opened,setOpened]=useState(false),[turning,setTurning]=useState(false);
 const [narrow,setNarrow]=useState(false),[reduced,setReduced]=useState(false),[announcement,setAnnouncement]=useState(''),[,setViewport]=useState(0);
 const data=useJournalData(view==='open'||view==='large',snapshot);
 const flat=reduced||webgl==='failed';
 const mobileOpen=narrow&&(view==='open'||view==='large');
 const use3d=view!=='stored'&&!flat&&!mobileOpen;

 const canvas=useRef<HTMLCanvasElement>(null),object=useRef<HTMLDivElement>(null),scene=useRef<BookScene|null>(null);
 const frame=useRef<Frame>({open:0,index:restored.spread,total:JOURNAL_SPREADS.length,turn:null,activeTab:tabIndex(restored.spread)});
 const index=useRef(restored.spread),want=useRef(restored.spread),driving=useRef(false),openedRef=useRef(false),motion=useRef({flat,reduced}),page=useRef<0|1>(0),viewRef=useRef(view);
 motion.current={flat,reduced};viewRef.current=view;
 const left=useRef<HTMLElement>(null),right=useRef<HTMLElement>(null),prev=useRef<HTMLButtonElement>(null),next=useRef<HTMLButtonElement>(null),coverButton=useRef<HTMLButtonElement>(null);
 const tabs=useRef<(HTMLButtonElement|null)[]>([]),tools=useRef<(HTMLElement|null)[]>([]),closedTools=useRef<(HTMLElement|null)[]>([]),folioLeft=useRef<HTMLDivElement>(null),folioRight=useRef<HTMLDivElement>(null),edgeLeft=useRef<HTMLDivElement>(null),edgeRight=useRef<HTMLDivElement>(null);
 const handle=useRef<HTMLButtonElement>(null),scroll=useRef<Record<string,number>>({}),lastView=useRef<JournalView>('stored'),drag=useRef<{pointer:number;x:number;y:number;start:TablePlace;moved:boolean;book:boolean}|null>(null),suppressClick=useRef(false);

 useEffect(()=>{const mq=window.matchMedia('(max-width: 720px)'),rm=window.matchMedia('(prefers-reduced-motion: reduce)');const shell=document.querySelector('[data-chroniplay-stage]');
  const sync=()=>{setNarrow(mq.matches);setReduced(rm.matches||!!shell?.classList.contains('user-reduced-motion'));};sync();mq.addEventListener('change',sync);rm.addEventListener('change',sync);
  const observer=new MutationObserver(sync);if(shell)observer.observe(shell,{attributes:true,attributeFilter:['class']});
  const resize=()=>setViewport(n=>n+1);window.addEventListener('resize',resize);
  return()=>{mq.removeEventListener('change',sync);rm.removeEventListener('change',sync);observer.disconnect();window.removeEventListener('resize',resize);};},[]);
 useEffect(()=>{try{window.sessionStorage.setItem(storeKey,JSON.stringify({spread:target,drafts,selected}));}catch{/* presentation only */}},[storeKey,target,drafts,selected]);
 useEffect(()=>{try{window.localStorage.setItem(placeKey,JSON.stringify(placed));}catch{/* presentation only */}},[placeKey,placed]);

 const onLayout=useCallback((b:Layout)=>{
  put(left.current,b.left);put(right.current,b.right);put(prev.current,b.previous);put(next.current,b.next);put(coverButton.current,b.cover);put(folioLeft.current,b.folioLeft);put(folioRight.current,b.folioRight);
  b.tabs.forEach((r,i)=>put(tabs.current[i],r));b.tools.forEach((r,i)=>put(tools.current[i],r));b.closedTools.forEach((r,i)=>put(closedTools.current[i],r));
  for(const [el,r] of [[edgeLeft.current,b.edgeLeft],[edgeRight.current,b.edgeRight]] as const)if(el){el.style.left=r.left+'px';el.style.top=r.top+'px';el.style.width=r.width+'px';}
  object.current?.style.setProperty('--unit',b.unit.toFixed(2)+'px');
 },[]);
 const animateCover=useCallback(async(to:0|1)=>{
  const s=scene.current;if(!s){frame.current.open=to;return;}
  if(to===0){openedRef.current=false;setOpened(false);}
  const from=frame.current.open;
  await animate(470,p=>{frame.current.open=from+(to-from)*p;s.draw(frame.current);},motion.current.reduced||from===to);
  frame.current.open=to;s.draw(frame.current);
  if(to===1&&(viewRef.current==='open'||viewRef.current==='large')){openedRef.current=true;setOpened(true);}
 },[]);

 // 3D book lifetime: from taking the book out until packing it away (or until the CSS book takes over).
 useEffect(()=>{
  if(!use3d)return;
  let alive=true,observer:ResizeObserver|undefined;const el=canvas.current;
  const lost=(e:Event)=>{e.preventDefault();setWebgl('failed');setAnnouncement('3D-Ansicht unterbrochen. Das Buch wird ohne 3D gezeigt.');};
  el?.addEventListener('webglcontextlost',lost);
  queueMicrotask(()=>{if(alive)setWebgl(w=>w==='failed'?w:'pending');});
  (async()=>{
   try{
    const {createJournalBook}=await import('./book-scene.mjs');
    if(!alive||!el)return;
    const s=createJournalBook(el,onLayout,{tabs:JOURNAL_REGISTERS.map(r=>({color:r.color,icon:r.icon}))}) as BookScene;
    scene.current=s;frame.current={...frame.current,open:0,index:index.current,turn:null,activeTab:tabIndex(index.current)};
    s.resize();observer=new ResizeObserver(()=>s.resize());observer.observe(el);
    await s.ready;if(!alive)return;
    setWebgl('ready');
    if(viewRef.current==='open'||viewRef.current==='large')await animateCover(1);
   }catch(error){console.warn('Abenteuerjournal: 3D-Ansicht nicht verfügbar',error);if(alive)setWebgl('failed');}
  })();
  return()=>{alive=false;observer?.disconnect();el?.removeEventListener('webglcontextlost',lost);scene.current?.dispose();scene.current=null;openedRef.current=false;frame.current.open=0;queueMicrotask(()=>setOpened(false));};
 },[use3d,onLayout,animateCover]);
 // Without 3D the pages are there at once.
 useEffect(()=>{if(!use3d)queueMicrotask(()=>setOpened(view==='open'||view==='large'));},[use3d,view]);
 useEffect(()=>{if(opened)scene.current?.draw(frame.current);},[opened,spread,view]);
 // The first concho shows what it does next: enlarge on the table, shrink back when large.
 useEffect(()=>{if(webgl==='ready')scene.current?.setSizeIcon(view==='large'?'shrink':'enlarge');},[view,webgl]);

 const printOf=(i:number,isRight:boolean)=>{const s=JOURNAL_SPREADS[i],reg=JOURNAL_REGISTERS.find(r=>r.id===s.register);return isRight?{title:s.title,body:''}:{title:reg?.label||'',body:s.title};};
 const drive=useCallback(async()=>{
  if(driving.current)return;driving.current=true;
  try{
   while(want.current!==index.current){
    const dest=want.current,start=index.current,s=scene.current;
    if(s&&openedRef.current&&!motion.current.flat&&!motion.current.reduced){
     const forward=dest>start;s.printTurn(printOf(forward?start:dest,true),printOf(forward?dest:start,false));setTurning(true);
     await animate(Math.abs(dest-start)>1?250:325,p=>{frame.current.index=start+(dest-start)*p;frame.current.turn={forward,progress:p};s.draw(frame.current);},false);
    }
    index.current=dest;frame.current={...frame.current,index:dest,turn:null,activeTab:tabIndex(dest)};scene.current?.draw(frame.current);setTurning(false);setSpread(dest);
    if(want.current===dest)setAnnouncement(JOURNAL_SPREADS[dest].title+', Doppelseite '+(dest+1)+' von '+JOURNAL_SPREADS.length+'.');
   }
  }finally{driving.current=false;}
 },[]);
 const go=useCallback((i:number,side:0|1=0)=>{const t=clampSpread(i);want.current=t;setTarget(t);page.current=side;setMobilePage(side);void drive();},[drive]);
 const setPage=(n:0|1)=>{page.current=n;setMobilePage(n);};
 // Always from the shared target (not the last rendered state): several clicks in one frame add up.
 const step=(dir:1|-1)=>{
  const t=want.current;
  if(narrow){if(dir===1){if(page.current===0)setPage(1);else if(t<JOURNAL_SPREADS.length-1)go(t+1,0);}else{if(page.current===1)setPage(0);else if(t>0)go(t-1,1);}return;}
  go(t+dir);
 };

 // ---- states of the object ----------------------------------------------------------------------------------
 const change=useCallback((next:JournalView)=>{
  const was=viewRef.current;if(next===was)return;
  viewRef.current=next;setView(next);
  if(next==='closed'&&(was==='open'||was==='large'))void animateCover(0);
  if((next==='open'||next==='large')&&was==='closed')void animateCover(1);
 },[animateCover]);
 // Focus follows the object: into the book on opening, to the shut book on closing, to the handle when packed away.
 useEffect(()=>{const was=lastView.current;lastView.current=view;if(was===view)return;
  queueMicrotask(()=>{if(view==='stored')handle.current?.focus();else if(view==='closed')object.current?.querySelector<HTMLElement>('[data-cover]')?.focus();else if(was==='stored'||was==='closed')object.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();});},[view]);
 // Mobile: the visual viewport shrinks with the on-screen keyboard; the open book follows it so the draft and the way
 // back to the table stay visible above the keyboard.
 useEffect(()=>{if(!mobileOpen)return;const vv=window.visualViewport;if(!vv)return;const el=object.current;const sync=()=>{el?.style.setProperty('--vv-top',vv.offsetTop+'px');el?.style.setProperty('--vv-height',vv.height+'px');};sync();vv.addEventListener('resize',sync);vv.addEventListener('scroll',sync);return()=>{vv.removeEventListener('resize',sync);vv.removeEventListener('scroll',sync);};},[mobileOpen]);
 const pageKey=(side:'l'|'r')=>spread+':'+side;
 useLayoutEffect(()=>{if(view!=='open'&&view!=='large')return;if(left.current)left.current.scrollTop=scroll.current[pageKey('l')]||0;if(right.current)right.current.scrollTop=scroll.current[pageKey('r')]||0;},[spread,view,mobilePage,opened]); // eslint-disable-line react-hooks/exhaustive-deps -- restore on page change only

 // Keys: Escape steps back (large → open → closed), arrows turn pages; only inside the book or with loose focus.
 const stepRef=useRef(step);stepRef.current=step;
 const moveRef=useRef<(key:string)=>void>(()=>{});
 useEffect(()=>{
  if(view==='stored')return;
  const onKey=(e:KeyboardEvent)=>{
   const t=e.target as HTMLElement|null,inBook=!!t&&!!object.current?.contains(t),loose=!t||t===document.body||t===document.documentElement;
   if(!inBook&&!loose)return;
   if(document.querySelector('dialog[open]:modal'))return;
   if(e.key==='Escape'&&view!=='closed'){e.preventDefault();e.stopPropagation();change(viewAfterEscape(view));return;}
   if(e.altKey&&inBook&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();moveRef.current(e.key);return;}
   if((view==='open'||view==='large')&&(e.key==='ArrowLeft'||e.key==='ArrowRight')&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!t?.closest('input,textarea,select,[contenteditable="true"],[role="textbox"],[data-grip]')){e.preventDefault();stepRef.current(e.key==='ArrowRight'?1:-1);}
  };
  window.addEventListener('keydown',onKey,true);return()=>window.removeEventListener('keydown',onKey,true);
 },[view,change]);

 // ---- moving the book on the table ---------------------------------------------------------------------------
 const size=bookSize(view,flat);
 const area=playArea();
 const defaultPlace={cx:area.left+(area.right-area.left)*(view==='closed'?.82:.58),cy:area.top+(area.bottom-area.top)*(view==='closed'?.62:.52)};
 const place=clampPlace(placed.place||defaultPlace,size,area);
 const movable=!narrow&&(view==='closed'||view==='open');
 const startDrag=(e:PE<HTMLElement>)=>{
  if(!movable||e.button!==0)return;
  const t=e.target as HTMLElement;
  if(!(t===canvas.current||t.closest('[data-drag]')))return;
  drag.current={pointer:e.pointerId,x:e.clientX,y:e.clientY,start:place,moved:false,book:t===canvas.current||!!t.closest('[data-cover]')};suppressClick.current=false;
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const moveDrag=(e:PE<HTMLElement>)=>{const d=drag.current;if(!d||d.pointer!==e.pointerId)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(!d.moved&&Math.hypot(dx,dy)<5)return;d.moved=true;const p=clampPlace({cx:d.start.cx+dx,cy:d.start.cy+dy},size,playArea());if(object.current){object.current.style.left=(p.cx-size.width/2)+'px';object.current.style.top=(p.cy-size.height/2)+'px';}};
 const endDrag=(e:PE<HTMLElement>)=>{const d=drag.current;if(!d||d.pointer!==e.pointerId)return;drag.current=null;
  // Pointer capture sends the click to the book object, so a press without movement on the shut book opens it here.
  if(!d.moved&&d.book&&viewRef.current==='closed'){suppressClick.current=true;window.setTimeout(()=>{suppressClick.current=false;},0);change('open');return;}
  if(d.moved){suppressClick.current=true;window.setTimeout(()=>{suppressClick.current=false;},0);setPlaced(old=>({...old,place:clampPlace({cx:d.start.cx+e.clientX-d.x,cy:d.start.cy+e.clientY-d.y},size,playArea())}));}};
 const nudge=(key:string)=>{const m:Record<string,[number,number]>={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]};const d=m[key];if(!d||!movable)return;setPlaced(old=>({...old,place:clampPlace({cx:place.cx+d[0],cy:place.cy+d[1]},size,playArea())}));};
 moveRef.current=nudge;
 const clicked=(action:()=>void)=>()=>{if(suppressClick.current){suppressClick.current=false;return;}action();};

 // ---- drafts and saving --------------------------------------------------------------------------------------
 const characterName=String(data.projection?.identity.name||'');
 const notes=data.projection?.companion?.notes||[];
 const changeDraft=(kind:JournalKind,d:JournalDraft)=>{setDrafts(old=>({...old,[kind]:d}));if(save[kind].kind!=='saving')setSave(old=>({...old,[kind]:old[kind].kind==='error'?old[kind]:idle}));};
 const replaceDraft=(kind:JournalKind)=>{const d=drafts[kind];return !draftDirty(d)||window.confirm('Ungespeicherten Entwurf'+(d?.title?' „'+d.title+'“':'')+' verwerfen?');};
 const openEntry=(kind:JournalKind,n:CharacterCompanionNote)=>{
  if(!data.characterId)return;if(drafts[kind]?.noteId===n.id&&drafts[kind]?.characterId===data.characterId){if(narrow)setPage(1);return;}
  if(!replaceDraft(kind))return;
  const base={title:n.title==='Charakternotiz'?'':n.title,text:n.text,playDate:n.playDate||''};
  setDrafts(old=>({...old,[kind]:{characterId:data.characterId!,characterName,kind,noteId:n.id,version:n.version,...base,base}}));setSelected(old=>({...old,[kind]:n.id}));setSave(old=>({...old,[kind]:idle}));if(narrow)setPage(1);
 };
 const newEntry=(kind:JournalKind)=>{
  if(!data.characterId||!replaceDraft(kind))return;
  const last=chronicleEntries(notes).at(-1)?.playDate||'';
  setDrafts(old=>({...old,[kind]:{characterId:data.characterId!,characterName,kind,title:'',text:'',playDate:kind==='chronicle'?last:''}}));setSelected(old=>({...old,[kind]:''}));setSave(old=>({...old,[kind]:idle}));if(narrow)setPage(1);
 };
 const discard=(kind:JournalKind)=>{if(!replaceDraft(kind))return;setDrafts(old=>{const n={...old};delete n[kind];return n;});setSelected(old=>({...old,[kind]:''}));setSave(old=>({...old,[kind]:idle}));};
 const saveDraft=async(kind:JournalKind,asNew=false)=>{
  const d=drafts[kind];if(!d||busy)return;
  const draft=asNew?{...d,noteId:undefined,version:undefined,base:undefined}:d;
  setBusy(true);setSave(old=>({...old,[kind]:{kind:'saving'}}));
  try{
   const result=await api<{id:string;version:number}>('/api/character-companion','PATCH',draftRequest(draft));
   const savedBase={title:draft.title,text:draft.text,playDate:draft.playDate};
   // Text typed while saving stays on top of the saved version.
   setDrafts(old=>{const cur=old[kind];if(!cur||cur.characterId!==d.characterId)return old;const edited=cur.title!==d.title||cur.text!==d.text||cur.playDate!==d.playDate;return {...old,[kind]:edited?{...cur,noteId:result.id,version:result.version,base:savedBase}:{...draft,noteId:result.id,version:result.version,base:savedBase}};});
   setSelected(old=>({...old,[kind]:result.id}));
   setSave(old=>({...old,[kind]:{kind:'saved',at:new Date().toISOString()}}));setAnnouncement((kind==='chronicle'?'Chronikeintrag':'Notiz')+' gespeichert.');
   await data.reload();
  }catch(e){
   const conflict=e instanceof ApiError&&e.status===409;
   setSave(old=>({...old,[kind]:{kind:'error',message:conflict?'Dieser Eintrag wurde inzwischen an anderer Stelle geändert.':e instanceof ApiError?e.message:'Keine Verbindung zum Server.',conflict}}));
  }finally{setBusy(false);}
 };
 const reloadSaved=async(kind:JournalKind)=>{
  const d=drafts[kind];if(!d?.noteId||!window.confirm('Deinen Entwurf verwerfen und die gespeicherte Fassung laden?'))return;
  await data.reload();setDrafts(old=>{const n={...old};delete n[kind];return n;});setSave(old=>({...old,[kind]:idle}));setSelected(old=>({...old,[kind]:''}));setAnnouncement('Entwurf verworfen. Wähle den Eintrag erneut, um die gespeicherte Fassung zu öffnen.');
 };

 // ---- bookmarks: one ribbon per area, plus the player's own ribbons ------------------------------------------
 const currentEntry=():{noteId?:string;kind?:JournalKind;title?:string}=>{const sidNow=JOURNAL_SPREADS[target].id;if(sidNow!=='notes'&&sidNow!=='chronicle')return {};const kind:JournalKind=sidNow==='notes'?'note':'chronicle',d=drafts[kind];return d?.noteId&&d.characterId===data.characterId?{noteId:d.noteId,kind,title:d.title||'Ohne Überschrift'}:{};};
 const layBookmark=()=>{
  const entry=currentEntry(),label=JOURNAL_SPREADS[target].title+(entry.title?' · '+entry.title:'');
  const next=addBookmark(placed.bookmarks,{spread:target,page:page.current,noteId:entry.noteId,kind:entry.kind,label},crypto.randomUUID());
  if(!next){setAnnouncement(placed.bookmarks.length>=OWN_BOOKMARK_LIMIT?'Es liegen schon '+OWN_BOOKMARK_LIMIT+' eigene Lesezeichen im Buch.':'Hier liegt schon ein eigenes Lesezeichen.');return;}
  setPlaced(old=>({...old,bookmarks:next}));setAnnouncement('Lesezeichen eingelegt: '+label+'.');
 };
 const openBookmark=(b:JournalBookmark)=>{
  go(b.spread,b.page);
  if(b.noteId&&b.kind){const n=notes.find(x=>x.id===b.noteId);if(n)openEntry(b.kind,n);}
 };
 const takeBookmark=(b:JournalBookmark)=>{setPlaced(old=>({...old,bookmarks:removeBookmark(old.bookmarks,b.id)}));setAnnouncement('Lesezeichen herausgenommen: '+b.label+'.');};

 // ---- page content ------------------------------------------------------------------------------------------
 const sid=JOURNAL_SPREADS[spread].id;
 const message=(text:string)=>({left:<div className={styles.entries}><p className={styles.folio}>Abenteuerjournal</p><p className={styles.emptyEditor}>{text}</p></div>,right:<div/>});
 const checkHint=pendingCheck?<p className={styles.checkHint}><JournalIcon name="dice" size={16}/> Probe ausstehend: <b>{pendingCheck}</b><button type="button" className={styles.brassButton} onClick={()=>{if(view==='large'||narrow)change('open');onOpenCheck();}}>Zum Würfeln</button></p>:null;
 let pages:{left:ReactNode;right:ReactNode};
 if(data.error&&!data.projection)pages=message('Das Journal konnte nicht geladen werden: '+data.error);
 else if(!data.loaded)pages=message('Journal wird geladen …');
 else if(!data.characterId)pages=message('Keine aktive Figur gewählt. Wähle deine Figur über deinen Namen in der oberen Leiste; danach öffnet sich hier ihr Buch.');
 else if(!data.projection)pages=message('Figur wird geladen …');
 else if(sid==='notes'||sid==='chronicle'){
  const kind:JournalKind=sid==='notes'?'note':'chronicle',entries=kind==='note'?noteEntries(notes):chronicleEntries(notes);
  pages={left:<EntryList kind={kind} entries={entries} unbound={kind==='note'?data.projection.companion?.unboundNotes:undefined} selectedId={selected[kind]||''} draft={drafts[kind]} disabled={busy||data.projection.permissions.canCreateNotes!==true} onSelect={n=>openEntry(kind,n)} onNew={()=>newEntry(kind)} onOtherKind={()=>go(spreadIndex(kind==='note'?'chronicle':'notes'))}/>,
   right:<EntryEditor kind={kind} draft={drafts[kind]} activeCharacterId={data.characterId} state={save[kind]} busy={busy} onChange={d=>changeDraft(kind,d)} onSave={()=>void saveDraft(kind)} onSaveAsNew={()=>void saveDraft(kind,true)} onDiscard={()=>discard(kind)} onReloadSaved={()=>void reloadSaved(kind)}/>};
 }
 else if(sid==='sheet-traits')pages=sheetTraits({p:data.projection});
 else if(sid==='sheet-advantages')pages=sheetAdvantages({p:data.projection,table:data.tableVitals,checkHint});
 else pages=sheetStory({p:data.projection});
 if(checkHint&&sid!=='sheet-advantages')pages={left:pages.left,right:<><div className={styles.checkSlip}>{checkHint}</div>{pages.right}</>};

 const atStart=target===0&&(!narrow||mobilePage===0),atEnd=target===JOURNAL_SPREADS.length-1&&(!narrow||mobilePage===1);
 const register=registerOf(target);
 const pageClass=(side:0|1)=>styles.page+' '+(side?styles.pageRight:styles.pageLeft)+(narrow&&mobilePage!==side?' '+styles.pageHidden:'');
 const dirty=draftDirty(drafts.note)||draftDirty(drafts.chronicle);
 const isOpen=view==='open'||view==='large';
 const objectStyle:CSSProperties=mobileOpen||view==='large'?{}:{left:place.cx-size.width/2,top:place.cy-size.height/2,width:size.width,height:size.height};

 const swipe=useRef<{x:number;y:number}|null>(null);
 const swipeStart=(e:PE<HTMLElement>)=>{const t=e.target as HTMLElement;if(t.closest('input,textarea,select,[contenteditable="true"],button'))return;swipe.current={x:e.clientX,y:e.clientY};};
 const swipeEnd=(e:PE<HTMLElement>)=>{const s0=swipe.current;swipe.current=null;if(!s0)return;const dx=e.clientX-s0.x,dy=e.clientY-s0.y;if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.6)step(dx<0?1:-1);};
 const book3d=!flat&&!mobileOpen;
 // Brass medallions on the strap: open book = size, close, put away; shut book = open, put away (slot 0 stays empty).
 const medallions:{id:string;icon:JournalIconName;label:string;action:()=>void}[]=isOpen?[
  view==='large'?{id:'size',icon:'shrink',label:'Zurück auf den Tisch',action:()=>change('open')}:{id:'size',icon:'enlarge',label:'Groß lesen',action:()=>change('large')},
  {id:'close',icon:'clasp',label:'Zuklappen',action:()=>change('closed')},
  {id:'away',icon:'satchel',label:'Wegpacken',action:()=>change('stored')},
 ]:[
  {id:'size',icon:'enlarge',label:'',action:()=>{}},
  {id:'open',icon:'open',label:'Aufschlagen',action:()=>change('open')},
  {id:'away',icon:'satchel',label:'Wegpacken',action:()=>change('stored')},
 ];
 const shownMedallions=(onBook:boolean)=>onBook
  ?(view==='closed'
   ?[<Hotspot key="buckle" label="Schnalle öffnen – aufschlagen" side="below" dataCover buttonRef={el=>{closedTools.current[0]=el;}} onClick={()=>change('open')}/>,<Hotspot key="tip" label="Wegpacken" side="right" buttonRef={el=>{closedTools.current[1]=el;}} onClick={()=>change('stored')}/>]
   :medallions.map((m,i)=><Hotspot key={m.id} label={m.label} side="below" buttonRef={el=>{tools.current[i]=el;}} onClick={m.action}/>))
  :medallions.filter(m=>m.label).map(m=><Medallion key={m.id} icon={m.icon} label={m.label} side="below" onClick={m.action}/>);
 const registers=(onBook:boolean)=><nav className={onBook?styles.tabs:styles.flatTabs} aria-label="Buchregister">{JOURNAL_REGISTERS.map((r,i)=><button key={r.id} ref={el=>{if(onBook)tabs.current[i]=el;}} type="button" style={{'--tab-color':r.color} as CSSProperties} aria-current={register===r.id?'page':undefined} aria-label={'Register '+r.label} onClick={()=>go(registerStart(r.id))}><JournalIcon name={r.icon} size={onBook?22:18}/><span>{onBook?r.short:r.label}</span></button>)}</nav>;
 const areaRibbons=<div ref={book3d?edgeLeft:undefined} className={styles.ribbonRow} data-row="areas" role="group" aria-label="Lesezeichen der Bereiche">{JOURNAL_REGISTERS.map(r=><Ribbon key={r.id} color={r.color} icon={r.icon} label={'Lesezeichen: '+r.label} current={register===r.id} onClick={()=>go(registerStart(r.id))}/>)}</div>;
 const ownRibbons=<div ref={book3d?edgeRight:undefined} className={styles.ribbonRow} data-row="own" role="group" aria-label="Eigene Lesezeichen">{placed.bookmarks.map(b=><Ribbon key={b.id} color={b.color} icon={b.icon} label={'Eigenes Lesezeichen: '+b.label} current={b.spread===target&&(!narrow||b.page===mobilePage)} onClick={()=>openBookmark(b)} onRemove={()=>takeBookmark(b)} removeLabel={'Lesezeichen „'+b.label+'“ herausnehmen'}/>)}{placed.bookmarks.length<OWN_BOOKMARK_LIMIT&&<RibbonLoop label="Eigenes Lesezeichen hier einlegen" onClick={layBookmark}/>}</div>;
 const folio=(side:0|1)=><div ref={book3d?(side?folioRight:folioLeft):undefined} className={styles.folio2} data-side={side?'right':'left'} aria-hidden><span>{side?JOURNAL_SPREADS[spread].title:JOURNAL_REGISTERS.find(r=>r.id===registerOf(spread))?.label}</span><b>{spread*2+side+1}</b></div>;
 const moveKeys=(e:React.KeyboardEvent)=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();nudge(e.key);}};

 if(view==='stored')return <div className={styles.root} inert={inert||undefined}>
  <button ref={handle} type="button" className={styles.handle} aria-label={'Abenteuerjournal hervorholen'+(dirty?' (ungespeicherter Entwurf)':'')} onClick={()=>change('open')}><span className={styles.handleTitle}>Abenteuerjournal</span>{dirty&&<i className={styles.handleDot} aria-hidden/>}</button>
  <p className={styles.srOnly} role="status">{announcement}</p>
 </div>;

 return <div className={styles.root} inert={inert||undefined}>
  {view==='large'&&!narrow&&<div className={styles.backdrop} aria-hidden onClick={()=>change('open')}/>}
  <div ref={object} className={styles.object} data-view={mobileOpen?'mobile':view} data-flat={flat||undefined} data-turning={turning||undefined} role="region" aria-label={'Abenteuerjournal'+(characterName?' von '+characterName:'')+(movable?' · verschieben: ziehen oder Alt und Pfeiltasten':'')} style={objectStyle} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={()=>{drag.current=null;}}>
   {use3d&&<canvas ref={canvas} className={styles.canvas} aria-hidden/>}
   {use3d&&webgl==='pending'&&<p className={styles.preparing} role="status">Das Journal wird hervorgeholt …</p>}
   {view==='closed'&&(use3d?<>
    <button ref={coverButton} type="button" data-cover data-drag className={styles.coverButton} aria-label="Abenteuerjournal aufschlagen (ziehen zum Verschieben)" onClick={clicked(()=>change('open'))} onKeyDown={moveKeys}/>
    {webgl==='ready'&&<div className={styles.tools}>{shownMedallions(true)}</div>}
   </>:<div className={styles.flatClosed}>
    <button type="button" data-cover data-drag className={styles.flatCover} aria-label="Abenteuerjournal aufschlagen (ziehen zum Verschieben)" onClick={clicked(()=>change('open'))} onKeyDown={moveKeys}><span className={styles.flatCoverEmblem} aria-hidden><JournalIcon name="star" size={46}/></span><strong>Abenteuerjournal</strong><small>ChroniPlay</small>{dirty&&<em>Entwurf offen</em>}</button>
    <div className={styles.flatStrap}>{shownMedallions(false)}</div>
   </div>)}
   {isOpen&&<>
    {book3d&&opened&&<><div className={styles.tools}>{shownMedallions(true)}</div>{registers(true)}{areaRibbons}{ownRibbons}</>}
    {(flat||mobileOpen)&&<div className={styles.flatStrap}>{mobileOpen?medallions.filter(m=>m.id!=='size').map(m=><span key={m.id} className={styles.mobileTool}><Medallion icon={m.icon} label={m.id==='close'?'Zuklappen – zurück zum Tisch':m.label} side="below" onClick={m.action}/><span aria-hidden>{m.id==='close'?'Zum Tisch':m.label}</span></span>):shownMedallions(false)}</div>}
    {(flat||mobileOpen)&&registers(false)}
    <div className={styles.spread} data-drag={flat&&!mobileOpen?'':undefined} hidden={!opened} onPointerDown={mobileOpen?swipeStart:undefined} onPointerUp={mobileOpen?swipeEnd:undefined}>
     <section ref={left} className={pageClass(0)} aria-label={'Linke Seite: '+JOURNAL_SPREADS[spread].title} onScroll={e=>{scroll.current[pageKey('l')]=e.currentTarget.scrollTop;}}>{pages.left}</section>
     <section ref={right} className={pageClass(1)} aria-label={'Rechte Seite: '+JOURNAL_SPREADS[spread].title} onScroll={e=>{scroll.current[pageKey('r')]=e.currentTarget.scrollTop;}}>{pages.right}</section>
     {(!narrow||mobilePage===0)&&folio(0)}{(!narrow||mobilePage===1)&&folio(1)}
     <DogEar buttonRef={book3d?prev:undefined} side="left" label={narrow?'Vorherige Seite':'Zurückblättern'} disabled={atStart} onClick={()=>step(-1)}/>
     <DogEar buttonRef={book3d?next:undefined} side="right" label={narrow?'Nächste Seite':'Weiterblättern'} disabled={atEnd} onClick={()=>step(1)}/>
    </div>
    {(flat||mobileOpen)&&<div className={styles.flatRibbons}>{areaRibbons}{ownRibbons}</div>}
   </>}
   <p className={styles.srOnly} role="status">{announcement}</p>
  </div>
 </div>;
}
