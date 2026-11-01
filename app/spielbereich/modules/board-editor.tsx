"use client";
import {memo,useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {MousePointer2,Pencil,MoveUpRight,Minus,Square,Circle,Type,Eraser,Undo2,Redo2,Trash2,Lock,LockOpen,X,RotateCcw} from 'lucide-react';
import type {Actor} from '@/domain/types';
import type {BoardElement,BoardPoint} from '@/domain/live-table';
import {addStrokePoint,arrowHead,boardBounds,boardTextLines,boardUsage,canChangeBoard,finishStroke,mergeBoard,moveBoardElement,opReflected,strokePath,type BoardOp} from '@/domain/board-editor';
import styles from './board-editor.module.css';

type Tool='select'|'pen'|'line'|'shape'|'text'|'erase';
/** One user step; a long freehand stroke stored in pieces is still one step. */
type Change={before?:BoardElement;after?:BoardElement};
/** Calm table colours: gold, blood, bone, teal, ash, violet. */
const palette=[['#d6b36f','Gold'],['#c4524a','Blutrot'],['#ece4d2','Knochenweiß'],['#5fb3b0','Türkis'],['#9a958a','Asche'],['#a993e0','Violett']] as const;
const widths=[[2,'fein'],[4,'mittel'],[8,'kräftig']] as const;
const tools=[
 {id:'select',label:'Auswählen und verschieben',key:'V',Icon:MousePointer2},
 {id:'pen',label:'Stift',key:'P',Icon:Pencil},
 {id:'line',label:'Pfeil oder Linie',key:'A',Icon:MoveUpRight},
 {id:'shape',label:'Form: Rechteck oder Kreis',key:'R',Icon:Square},
 {id:'text',label:'Notiz schreiben',key:'T',Icon:Type},
 {id:'erase',label:'Radierer',key:'E',Icon:Eraser},
] as const;
const clamp=(p:BoardPoint):BoardPoint=>[Math.max(0,Math.min(1000,p[0])),Math.max(0,Math.min(600,p[1]))];
const rounded=(p:BoardPoint):BoardPoint=>[Math.round(p[0]),Math.round(p[1])];

/** One sketch element. Thin strokes get a wide invisible hit line, so they are grabbed or erased only where they really are. */
const Shape=memo(function Shape({element,sessionId,sx,sy,hit,failed}:{element:BoardElement;sessionId:string;sx:number;sy:number;hit:boolean;failed:boolean}){
 const first=element.points[0],last=element.points.at(-1)!,box=boardBounds(element),width=(element.width||4)*sy,flat=sy/sx;
 const paint={stroke:element.color,strokeWidth:width,fill:'none',strokeLinecap:'round' as const,strokeLinejoin:'round' as const,vectorEffect:'non-scaling-stroke' as const,pointerEvents:'none' as const};
 const catcher={stroke:'transparent',strokeWidth:Math.max(18,width+12),fill:'none',vectorEffect:'non-scaling-stroke' as const,pointerEvents:hit?'stroke' as const:'none' as const};
 let body;
 if(element.fileId)body=<image x={first[0]} y={first[1]} width="320" height="240" preserveAspectRatio="xMidYMid meet" pointerEvents={hit?'auto':'none'} href={'/api/live-table/media?sessionId='+encodeURIComponent(sessionId)+'&elementId='+element.id}/>;
 // Notes keep upright letters on every screen: the text is squeezed back by the stretch of the frame.
 else if(element.text)body=<g transform={`translate(${first[0]} ${first[1]}) scale(${flat} 1) translate(${-first[0]} ${-first[1]})`}><rect x={first[0]-8} y={first[1]-5} width={box.width+16} height={box.height+10} rx="5" fill="#0a1316" fillOpacity=".62" pointerEvents={hit?'auto':'none'}/><text x={first[0]} y={first[1]+20} fill={element.color} fontSize="20" fontFamily="Georgia, 'Times New Roman', serif" pointerEvents="none">{boardTextLines(element.text).map((line,i)=><tspan key={i} x={first[0]} dy={i?26:0}>{line||' '}</tspan>)}</text></g>;
 else if(element.shape==='rectangle')body=<><rect {...catcher} x={box.x} y={box.y} width={box.width} height={box.height}/><rect {...paint} x={box.x} y={box.y} width={box.width} height={box.height}/></>;
 else if(element.shape==='ellipse')body=<><ellipse {...catcher} cx={box.x+box.width/2} cy={box.y+box.height/2} rx={box.width/2} ry={box.height/2}/><ellipse {...paint} cx={box.x+box.width/2} cy={box.y+box.height/2} rx={box.width/2} ry={box.height/2}/></>;
 else if(element.shape==='arrow'){const [l,r]=arrowHead(first,last,10+width*2.2,sx,sy);body=<><line {...catcher} x1={first[0]} y1={first[1]} x2={last[0]} y2={last[1]}/><line {...paint} x1={first[0]} y1={first[1]} x2={last[0]} y2={last[1]}/><polyline {...paint} points={`${l.join(',')} ${last.join(',')} ${r.join(',')}`}/></>;}
 else if(element.points.length===1)body=<ellipse cx={first[0]} cy={first[1]} rx={Math.max(1.5,width/2)/sx} ry={Math.max(1.5,width/2)/sy} fill={element.color} pointerEvents={hit?'auto':'none'}/>;
 else {const d=strokePath(element.points);body=<><path {...catcher} d={d}/><path {...paint} d={d}/></>;}
 return <g data-element-id={element.id} data-failed={failed||undefined} opacity={failed?.45:1}><title>{element.name}</title>{body}</g>;
});

/**
 * The shared sketch of the evening. Every change shows at once and is sent in order; each viewer sees the server
 * state plus their own changes still on the way, so strokes neither vanish nor jump back while polling.
 * On the table the sketch lies exactly over the backdrop (the same crop as the image), otherwise over the whole surface.
 */
export function BoardEditor({a,sessionId,elements,epoch,enabled,locked=false,color,onColor,onAction,onDirty,backdrop,onClose,variant='panel'}:{a:Actor;sessionId:string;elements:BoardElement[];epoch:number;enabled:boolean;locked?:boolean;color:string;onColor:(value:string)=>void;onAction:(action:string,extra:Record<string,unknown>)=>Promise<boolean|string>;onDirty?:(dirty:boolean)=>void;backdrop?:string|null;onClose?:()=>void;variant?:'stage'|'panel'}){
 const viewer={id:a.id,gm:a.gm};
 const [tool,setTool]=useState<Tool>('pen'),[lineKind,setLineKind]=useState<'arrow'|'line'>('arrow'),[shapeKind,setShapeKind]=useState<'rectangle'|'ellipse'>('rectangle'),[width,setWidth]=useState<number>(4);
 const [ops,setOps]=useState<BoardOp[]>([]),[draft,setDraft]=useState<BoardElement|null>(null),[selectedId,setSelected]=useState(''),[undo,setUndo]=useState<Change[][]>([]),[redo,setRedo]=useState<Change[][]>([]);
 const [note,setNote]=useState<{before?:BoardElement;at:BoardPoint;value:string}|null>(null),[notice,setNotice]=useState(''),[box,setBox]=useState({w:0,h:0}),[image,setImage]=useState({src:'',aspect:0});
 const surface=useRef<HTMLDivElement>(null),svg=useRef<SVGSVGElement>(null),confirm=useRef<HTMLDialogElement>(null),noteInput=useRef<HTMLTextAreaElement>(null),sending=useRef(false),opsRef=useRef(ops),serverRef=useRef(elements);
 const gesture=useRef<{pointer:number;start:BoardPoint;raw:BoardPoint[];before?:BoardElement;element?:BoardElement;erased?:Set<string>}|null>(null);
 const mayDraw=enabled&&(!locked||a.gm);
 useLayoutEffect(()=>{opsRef.current=ops;serverRef.current=elements;});

 // Frame: the backdrop's visible crop (object-fit: cover) or the whole surface. Everybody draws in the same 1000 × 600 frame.
 useEffect(()=>{const el=surface.current;if(!el)return;const measure=()=>{const r=el.getBoundingClientRect();setBox({w:r.width,h:r.height});};measure();const o=new ResizeObserver(measure);o.observe(el);return()=>o.disconnect();},[]);
 useEffect(()=>{if(!backdrop)return;let live=true;const probe=new Image();probe.onload=()=>{if(live&&probe.naturalWidth&&probe.naturalHeight)setImage({src:backdrop,aspect:probe.naturalWidth/probe.naturalHeight});};probe.src=backdrop;return()=>{live=false;};},[backdrop]);
 const aspect=backdrop&&image.src===backdrop?image.aspect:0;
 const frame=useMemo(()=>{if(!aspect||!box.w||!box.h)return {left:0,top:0,width:box.w,height:box.h};const height=Math.max(box.w/aspect,box.h),width=height*aspect;return {left:(box.w-width)/2,top:(box.h-height)/2,width,height};},[aspect,box.w,box.h]);
 const sx=frame.width/1000||1,sy=frame.height/600||1;

 // Own changes leave the queue once a newer server state arrived after saving; a cleared sketch drops what was still on its way.
 useEffect(()=>{queueMicrotask(()=>setOps(old=>{const next=old.filter(op=>op.epoch===epoch&&!(op.state==='sent'&&(op.seen!==elements||opReflected(op,elements))));return next.length===old.length?old:next;}));},[elements,epoch]);
 useEffect(()=>{gesture.current=null;queueMicrotask(()=>{setUndo([]);setRedo([]);setSelected('');setDraft(null);setNote(null);});},[epoch]);
 const busy=ops.some(op=>op.state==='queued'||op.state==='sending');
 useEffect(()=>{onDirty?.(busy||!!draft||!!note);},[busy,draft,note,onDirty]);

 // One change at a time, in the order they were made. A refused change stays visible and can be sent again.
 useEffect(()=>{
  if(sending.current)return;const op=ops.find(o=>o.state==='queued');if(!op)return;sending.current=true;
  queueMicrotask(()=>setOps(old=>old.map(o=>o.key===op.key&&o.state==='queued'?{...o,state:'sending'}:o)));
  const e=op.element,payload=op.kind==='draw'?{element:e,epoch:op.epoch}:{elementId:e.id,expectedRevision:op.expectedRevision||1,epoch:op.epoch,...(op.kind==='edit'?{element:e}:{})};
  void onAction(op.kind,payload).then(result=>{
   sending.current=false;
   setOps(old=>old.flatMap(o=>o.key!==op.key?[o]:result===true?(opReflected(o,serverRef.current)?[]:[{...o,state:'sent' as const,seen:serverRef.current}]):[{...o,state:'failed' as const,error:typeof result==='string'?result:'Nicht gespeichert.'}]));
  });
 },[ops,onAction]);

 const shown=useMemo(()=>{const merged=mergeBoard(elements,ops);if(!draft)return merged;return merged.some(e=>e.id===draft.id)?merged.map(e=>e.id===draft.id?draft:e):[...merged,draft];},[elements,ops,draft]);
 const failed=ops.filter(op=>op.state==='failed');
 const selected=shown.find(e=>e.id===selectedId&&canChangeBoard(e,viewer,locked));
 const usage=boardUsage(elements);

 /** Base revision of the next change: the server's, or the one our own unsent change will produce. */
 function baseRevision(id:string){const own=opsRef.current.filter(o=>o.element.id===id&&o.state!=='failed').at(-1);if(own)return own.kind==='draw'?1:(own.expectedRevision||1)+1;return serverRef.current.find(e=>e.id===id)?.revision||1;}
 function queue(changes:Change[],remember=true){
  const next:BoardOp[]=[];
  for(const {before,after} of changes){
   const key=crypto.randomUUID();
   if(before&&after){const expected=baseRevision(before.id);next.push({key,kind:'edit',element:{...after,id:before.id,memberId:before.memberId,name:before.name,revision:expected+1},expectedRevision:expected,epoch,state:'queued'});}
   else if(after)next.push({key,kind:'draw',element:{...after,revision:1},epoch,state:'queued'});
   else if(before)next.push({key,kind:'remove',element:before,expectedRevision:baseRevision(before.id),epoch,state:'queued'});
  }
  if(!next.length)return;opsRef.current=[...opsRef.current,...next];setOps(opsRef.current);setNotice('');
  if(remember){setUndo(old=>[...old.slice(-49),changes]);setRedo([]);}
 }
 function history(back:boolean){
  const source=back?undo:redo,group=source.at(-1);if(!group||!mayDraw)return;
  // The inverse applies to what is there now. If someone removed the object in between, the step is dropped.
  const steps=(back?[...group].reverse().map(c=>({before:c.after,after:c.before})):group).map(t=>{const current=t.before&&shown.find(e=>e.id===t.before!.id);return t.before&&!current?null:{before:current||undefined,after:t.after&&{...t.after,revision:undefined}};});
  if(steps.some(s=>!s)){setNotice('Das Objekt gibt es nicht mehr; dieser Schritt lässt sich nicht zurücknehmen.');(back?setUndo:setRedo)(old=>old.slice(0,-1));return;}
  queue(steps as Change[],false);
  if(back){setUndo(old=>old.slice(0,-1));setRedo(old=>[...old,group]);}else{setRedo(old=>old.slice(0,-1));setUndo(old=>[...old,group]);}
 }
 const point=(clientX:number,clientY:number):BoardPoint=>{const m=svg.current?.getScreenCTM();const p=m?new DOMPoint(clientX,clientY).matrixTransform(m.inverse()):new DOMPoint();return [p.x,p.y];};
 const hitAt=(clientX:number,clientY:number)=>{const id=window.document.elementFromPoint(clientX,clientY)?.closest('[data-element-id]')?.getAttribute('data-element-id');const e=id?shown.find(x=>x.id===id):undefined;return e&&canChangeBoard(e,viewer,locked)?e:undefined;};
 function erase(clientX:number,clientY:number){const g=gesture.current,hit=hitAt(clientX,clientY);if(!g?.erased||!hit||g.erased.has(hit.id))return;g.erased.add(hit.id);queue([{before:hit}]);}
 function openNote(at:BoardPoint,before?:BoardElement){setNote({before,at,value:before?.text||''});queueMicrotask(()=>noteInput.current?.focus());}
 function saveNote(){if(!note)return;const value=note.value.trim().slice(0,500);if(value&&value!==note.before?.text)queue([{before:note.before,after:{...(note.before||{id:crypto.randomUUID(),memberId:a.id,name:a.name,color,points:[rounded([Math.min(note.at[0],880),Math.min(note.at[1],560)])]}),text:value}}]);setNote(null);}

 function down(event:React.PointerEvent<SVGSVGElement>){
  if(!mayDraw||gesture.current||event.button>0)return;event.preventDefault();event.currentTarget.focus({preventScroll:true});
  if(note){saveNote();return;}
  const p=clamp(point(event.clientX,event.clientY)),hit=hitAt(event.clientX,event.clientY);
  if(tool==='text'){openNote(hit?.text?hit.points[0]:p,hit?.text?hit:undefined);return;}
  if(tool==='select'&&!hit){setSelected('');return;}
  event.currentTarget.setPointerCapture(event.pointerId);
  if(tool==='erase'){gesture.current={pointer:event.pointerId,start:p,raw:[],erased:new Set()};erase(event.clientX,event.clientY);return;}
  if(tool==='select'){setSelected(hit!.id);gesture.current={pointer:event.pointerId,start:p,raw:[],before:hit};return;}
  const base={id:crypto.randomUUID(),memberId:a.id,name:a.name,color,width};
  const element:BoardElement=tool==='pen'?{...base,points:[rounded(p)]}:{...base,points:[rounded(p),rounded(p)],shape:tool==='line'?lineKind:shapeKind};
  gesture.current={pointer:event.pointerId,start:p,raw:[p],element};setDraft(element);setSelected('');
 }
 function move(event:React.PointerEvent<SVGSVGElement>){
  const g=gesture.current;if(!g||g.pointer!==event.pointerId)return;
  const samples=event.nativeEvent.getCoalescedEvents?.().length?event.nativeEvent.getCoalescedEvents():[event.nativeEvent];
  if(g.erased){for(const e of samples)erase(e.clientX,e.clientY);return;}
  const p=clamp(point(event.clientX,event.clientY));
  if(g.before){g.element=moveBoardElement(g.before,p[0]-g.start[0],p[1]-g.start[1]);setDraft(g.element);return;}
  if(!g.element)return;
  if(g.element.shape){g.element={...g.element,points:[g.element.points[0],rounded(p)]};setDraft(g.element);return;}
  // Freehand: every sample the browser delivers, kept by distance only. Nothing already drawn is thinned while drawing.
  for(const e of samples)g.raw=addStrokePoint(g.raw,clamp(point(e.clientX,e.clientY)),1.2/sx);
  g.element={...g.element,points:g.raw};setDraft(g.element);
 }
 function up(event:React.PointerEvent<SVGSVGElement>){
  const g=gesture.current;if(!g||g.pointer!==event.pointerId)return;gesture.current=null;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  setDraft(null);const element=g.element;if(!element)return;
  if(g.before){if(JSON.stringify(g.before.points)!==JSON.stringify(element.points))queue([{before:g.before,after:element}]);return;}
  if(element.shape){const [s,e]=element.points;if(Math.hypot((e[0]-s[0])*sx,(e[1]-s[1])*sy)>=6)queue([{after:element}]);return;}
  // Long strokes are stored as consecutive pieces; they stay one step for undo.
  queue(finishStroke(g.raw).map((points,i)=>({after:{...element,id:i?crypto.randomUUID():element.id,points}})));
 }
 function cancel(){gesture.current=null;setDraft(null);}
 const keys=(event:React.KeyboardEvent)=>{
  if((event.target as HTMLElement).closest('input,textarea,select')||!mayDraw)return;
  const key=event.key.toLowerCase();
  if((event.ctrlKey||event.metaKey)&&key==='z'){event.preventDefault();history(!event.shiftKey);return;}
  if((event.ctrlKey||event.metaKey)&&key==='y'){event.preventDefault();history(false);return;}
  if(key==='escape'&&(selected||gesture.current)){event.preventDefault();cancel();setSelected('');return;}
  if(selected&&(key==='delete'||key==='backspace')){event.preventDefault();queue([{before:selected}]);setSelected('');return;}
  if(selected&&key==='enter'&&selected.text){event.preventDefault();openNote(selected.points[0],selected);return;}
  if(selected&&key.startsWith('arrow')){event.preventDefault();const step=event.shiftKey?20:4;queue([{before:selected,after:moveBoardElement(selected,key==='arrowleft'?-step:key==='arrowright'?step:0,key==='arrowup'?-step:key==='arrowdown'?step:0)}]);return;}
  if(!event.ctrlKey&&!event.metaKey&&!event.altKey){const choice=tools.find(t=>t.key.toLowerCase()===key);if(choice){event.preventDefault();setTool(choice.id);setSelected('');}}
 };
 const retry=useCallback(()=>setOps(old=>old.map(o=>o.state==='failed'?{...o,state:'queued',error:undefined}:o)),[]);
 const discard=useCallback(()=>setOps(old=>old.filter(o=>o.state!=='failed')),[]);
 async function run(operation:string,extra:Record<string,unknown>,done:string){const result=await onAction(operation,{epoch,...extra});setNotice(result===true?done:typeof result==='string'?result:'Nicht ausgeführt.');}
 const mine=elements.some(e=>e.memberId===a.id);
 const chrome=enabled||variant==='panel';
 const selBox=selected&&boardBounds(selected),selWidth=selBox&&(selected.text?selBox.width*sy/sx:selBox.width);
 const drawing=['pen','line','shape','text'].includes(tool);

 return <div className={styles.editor} data-variant={variant} data-active={enabled} onKeyDown={keys}>
  <div ref={surface} className={styles.surface}>
   <svg ref={svg} className={styles.board} data-tool={tool} style={{left:frame.left,top:frame.top,width:frame.width||'100%',height:frame.height||'100%'}} viewBox="0 0 1000 600" preserveAspectRatio="none" role="application" aria-label="Gemeinsame Skizze: P Stift, A Pfeil, R Form, T Notiz, E Radierer, V Auswahl; Strg+Z macht rückgängig" tabIndex={enabled?0:-1} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onDoubleClick={event=>{if(!mayDraw)return;const hit=hitAt(event.clientX,event.clientY);if(hit?.text)openNote(hit.points[0],hit);}}>
    {variant==='panel'&&<rect width="1000" height="600" fill="#0b161c" pointerEvents="none"/>}
    {shown.map(e=><Shape key={e.id} element={e} sessionId={sessionId} sx={sx} sy={sy} hit={mayDraw&&(tool==='select'||tool==='erase'||tool==='text')&&canChangeBoard(e,viewer,locked)} failed={failed.some(o=>o.element.id===e.id)}/>)}
    {enabled&&selBox&&<rect className={styles.selection} x={selBox.x-6} y={selBox.y-6} width={(selWidth||0)+12} height={selBox.height+12} vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
   </svg>
   {note&&<div className={styles.note} style={{left:frame.left+note.at[0]*sx,top:frame.top+note.at[1]*sy}}><textarea ref={noteInput} aria-label="Notiz auf der Skizze" rows={3} maxLength={500} value={note.value} placeholder="Notiz …" style={{color}} onChange={e=>setNote({...note,value:e.target.value})} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();saveNote();}if(e.key==='Escape'){e.preventDefault();setNote(null);}}}/><span><button type="button" onClick={saveNote}>Notiz setzen</button><button type="button" onClick={()=>setNote(null)}>Abbrechen</button></span></div>}
  </div>
  {chrome&&<>
   <header className={styles.head}>
    <strong>Gemeinsame Skizze</strong>
    {locked&&<span className={styles.chip}><Lock size={13}/> {a.gm?'Für Spieler gesperrt':'Von der SL gesperrt'}</span>}
    {usage>=.7&&<span className={styles.chip} title="Belegung der Skizze">{Math.round(usage*100)} % belegt</span>}
    <span className={styles.headActions}>
     <button type="button" disabled={!mayDraw||!mine} title="Löscht alle eigenen Striche für die ganze Runde" onClick={()=>void run('clearMine',{},'Deine Striche wurden für alle gelöscht.')}><Eraser size={16}/><span>Meine löschen</span></button>
     {a.gm&&<button type="button" aria-pressed={locked} title={locked?'Spieler dürfen wieder zeichnen':'Nur noch die SL zeichnet'} onClick={()=>void run('lock',{locked:!locked},locked?'Skizze für alle freigegeben.':'Skizze gesperrt: nur die SL zeichnet.')}>{locked?<LockOpen size={16}/>:<Lock size={16}/>}<span>{locked?'Freigeben':'Sperren'}</span></button>}
     {a.gm&&<button type="button" className={styles.danger} disabled={!elements.length} onClick={()=>confirm.current?.showModal()}><Trash2 size={16}/><span>Für alle löschen</span></button>}
     {onClose&&<button type="button" className={styles.close} aria-label="Zeichenmodus schließen" title="Zeichenmodus schließen (Esc)" onClick={onClose}><X size={18}/></button>}
    </span>
   </header>
   <div className={styles.dock} role="toolbar" aria-label="Zeichenwerkzeuge" aria-orientation={variant==='stage'?'vertical':'horizontal'}>
    {tools.map(({id,label,key,Icon},i)=><span key={id} className={styles.slot}>{(i===1||i===5)&&<i className={styles.rule} aria-hidden="true"/>}<button type="button" disabled={!mayDraw} aria-label={label} aria-pressed={tool===id} title={`${label} (${key})`} onClick={()=>{setTool(id);setSelected('');}}>{id==='shape'&&shapeKind==='ellipse'?<Circle size={20}/>:id==='line'&&lineKind==='line'?<Minus size={20}/>:<Icon size={20}/>}</button></span>)}
    <i className={styles.rule} aria-hidden="true"/>
    <button type="button" disabled={!mayDraw||!undo.length} aria-label="Rückgängig" title="Rückgängig (Strg+Z)" onClick={()=>history(true)}><Undo2 size={20}/></button>
    <button type="button" disabled={!mayDraw||!redo.length} aria-label="Wiederholen" title="Wiederholen (Strg+Umschalt+Z)" onClick={()=>history(false)}><Redo2 size={20}/></button>
   </div>
   <div className={styles.style} role="group" aria-label="Farbe und Strich">
    {tool==='line'&&<span className={styles.segment}><button type="button" aria-pressed={lineKind==='arrow'} onClick={()=>setLineKind('arrow')}><MoveUpRight size={16}/> Pfeil</button><button type="button" aria-pressed={lineKind==='line'} onClick={()=>setLineKind('line')}><Minus size={16}/> Linie</button></span>}
    {tool==='shape'&&<span className={styles.segment}><button type="button" aria-pressed={shapeKind==='rectangle'} onClick={()=>setShapeKind('rectangle')}><Square size={16}/> Rechteck</button><button type="button" aria-pressed={shapeKind==='ellipse'} onClick={()=>setShapeKind('ellipse')}><Circle size={16}/> Kreis</button></span>}
    {tool==='select'&&<span className={styles.hint}>{selected?<>Ziehen verschiebt · Entf löscht{selected.text?' · Doppelklick bearbeitet':''}<button type="button" className={styles.danger} onClick={()=>{queue([{before:selected}]);setSelected('');}}><Trash2 size={15}/> Löschen</button></>:a.gm?'Ein Objekt anklicken, um es zu verschieben oder zu löschen.':'Eigene Striche anklicken, um sie zu verschieben oder zu löschen.'}</span>}
    {tool==='erase'&&<span className={styles.hint}>{a.gm?'Über Striche ziehen löscht sie für alle.':'Über eigene Striche ziehen löscht sie für alle.'}</span>}
    {drawing&&<span className={styles.swatches}>{palette.map(([value,name])=><button key={value} type="button" className={styles.swatch} style={{'--swatch':value} as React.CSSProperties} aria-label={'Farbe '+name} aria-pressed={color.toLowerCase()===value} title={name} disabled={!mayDraw} onClick={()=>onColor(value)}/>)}</span>}
    {drawing&&tool!=='text'&&<span className={styles.widths}>{widths.map(([value,name])=><button key={value} type="button" aria-label={'Strich '+name} aria-pressed={width===value} title={'Strich '+name} disabled={!mayDraw} onClick={()=>setWidth(value)}><i style={{width:value+4,height:value+4,background:color}}/></button>)}</span>}
   </div>
   {(notice||failed.length>0)&&<div className={styles.toast} role={failed.length?'alert':'status'}>{failed.length?<><span>{failed.length===1?'1 Änderung':failed.length+' Änderungen'} nicht gespeichert: {failed[0].error}</span><button type="button" onClick={retry}><RotateCcw size={14}/> Erneut senden</button><button type="button" onClick={discard}>Verwerfen</button></>:<><span>{notice}</span><button type="button" aria-label="Hinweis schließen" onClick={()=>setNotice('')}><X size={14}/></button></>}</div>}
   <dialog ref={confirm} className={styles.confirm} aria-label="Skizze für alle löschen"><form method="dialog" onSubmit={event=>{if((event.nativeEvent as SubmitEvent).submitter?.getAttribute('value')==='clear')void run('clear',{},'Die Skizze wurde für alle geleert.');}}><h3>Skizze für alle löschen?</h3><p>Alle {elements.length} Striche, Pfeile und Notizen verschwinden für die ganze Runde. Das lässt sich nicht rückgängig machen.</p><div><button value="cancel" autoFocus>Abbrechen</button><button value="clear" className={styles.danger}>Für alle löschen</button></div></form></dialog>
  </>}
 </div>;
}
