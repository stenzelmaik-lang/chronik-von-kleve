"use client";
import {memo,useEffect,useRef,useState} from 'react';
import {MousePointer2,Hand,Pencil,Type,Minus,ArrowUpRight,Square,Circle,Eraser,Undo2,Redo2,Trash2,ZoomIn,ZoomOut,Maximize} from 'lucide-react';
import type {Actor} from '@/domain/types';
import type {BoardElement,BoardPoint} from '@/domain/live-table';
import {boardBounds,boardTextLines,moveBoardElement} from '@/domain/board-editor';
import styles from './board-editor.module.css';
type Tool='select'|'pan'|'pen'|'text'|'line'|'arrow'|'rectangle'|'ellipse'|'erase';
type Change={before?:BoardElement;after?:BoardElement};
function elementLabel(element:BoardElement){return element.text||(element.shape?{line:'Linie',arrow:'Pfeil',rectangle:'Rechteck',ellipse:'Ellipse'}[element.shape]:element.fileId?'Bild':'Zeichnung');}
const tools=[{id:'select',label:'Auswählen & verschieben',key:'V',Icon:MousePointer2},{id:'pan',label:'Zeichenfläche verschieben',key:'H',Icon:Hand},{id:'rectangle',label:'Rechteck',key:'R',Icon:Square},{id:'ellipse',label:'Ellipse',key:'O',Icon:Circle},{id:'arrow',label:'Pfeil',key:'A',Icon:ArrowUpRight},{id:'line',label:'Linie',key:'L',Icon:Minus},{id:'pen',label:'Freihand',key:'P',Icon:Pencil},{id:'text',label:'Text schreiben',key:'T',Icon:Type},{id:'erase',label:'Objekt entfernen',key:'E',Icon:Eraser}] as const;
const Shape=memo(function Shape({element,sessionId}:{element:BoardElement;sessionId:string}){
 const first=element.points[0],last=element.points.at(-1)!,box=boardBounds(element),stroke={stroke:element.color,strokeWidth:3,fill:'none',strokeLinecap:'round' as const,strokeLinejoin:'round' as const};
 const angle=Math.atan2(last[1]-first[1],last[0]-first[0]),head=(side:number)=>`${last[0]-16*Math.cos(angle+side)} ${last[1]-16*Math.sin(angle+side)}`;
 return <g data-element-id={element.id}><title>{element.name}: {elementLabel(element)}</title><rect x={box.x-5} y={box.y-5} width={box.width+10} height={box.height+10} fill="transparent"/>
  {element.fileId?<image x={first[0]} y={first[1]} width="320" height="240" preserveAspectRatio="xMidYMid meet" href={'/api/live-table/media?sessionId='+encodeURIComponent(sessionId)+'&elementId='+element.id}/>:element.text?<text x={first[0]} y={first[1]+20} fill={element.color} fontSize="20">{boardTextLines(element.text).map((line,i)=><tspan key={i} x={first[0]} dy={i?26:0}>{line||' '}</tspan>)}</text>:element.shape==='rectangle'?<rect {...stroke} x={box.x} y={box.y} width={box.width} height={box.height}/>:element.shape==='ellipse'?<ellipse {...stroke} cx={box.x+box.width/2} cy={box.y+box.height/2} rx={box.width/2} ry={box.height/2}/>:element.shape==='arrow'?<><line {...stroke} x1={first[0]} y1={first[1]} x2={last[0]} y2={last[1]}/><polyline {...stroke} points={`${head(.45)},${last.join(' ')},${head(-.45)}`}/></>:element.points.length===1?<circle cx={first[0]} cy={first[1]} r="2" fill={element.color}/>:<polyline {...stroke} points={element.points.map(p=>p.join(',')).join(' ')}/>}
 </g>;
});
export function BoardEditor({a,sessionId,elements,epoch,enabled,color,onColor,onAction,onDirty}:{a:Actor;sessionId:string;elements:BoardElement[];epoch:number;enabled:boolean;color:string;onColor:(value:string)=>void;onAction:(action:string,extra:Record<string,unknown>)=>Promise<boolean>;onDirty:(dirty:boolean)=>void}){
 const [tool,setTool]=useState<Tool>('select'),[selectedId,setSelected]=useState(''),[preview,setPreview]=useState<BoardElement|null>(null),[pending,setPending]=useState<Change|null>(null),[error,setError]=useState('');
 const [undo,setUndo]=useState<Change[]>([]),[redo,setRedo]=useState<Change[]>([]),[view,setView]=useState({x:0,y:0,width:1000}),[textEdit,setTextEdit]=useState<{before?:BoardElement;after:BoardElement}|null>(null),[text,setText]=useState('');
 const svg=useRef<SVGSVGElement>(null),textDialog=useRef<HTMLDialogElement>(null),gesture=useRef<{pointer:number;point:BoardPoint;before?:BoardElement;element?:BoardElement;client:BoardPoint;view:typeof view;pan?:boolean}|null>(null),saving=useRef(false);
 const selected=elements.find(e=>e.id===selectedId),dirty=!!preview||!!pending||!!textEdit;
 useEffect(()=>{onDirty(dirty);},[dirty,onDirty]);
 useEffect(()=>{queueMicrotask(()=>{setUndo([]);setRedo([]);setSelected('');setPreview(null);setPending(null);setTextEdit(null);});},[epoch]);
 useEffect(()=>{if(textEdit&&!textDialog.current?.open)textDialog.current?.showModal();},[textEdit]);
 async function commit(change:Change,history=true):Promise<Change|null>{
  if(saving.current||!enabled)return null;saving.current=true;setError('');
  const before=change.before,after=change.after?.text?moveBoardElement(change.after,0,0):change.after;setPending({before,after});
  try{
   const ok=await onAction(before?after?'edit':'remove':'draw',before?{elementId:before.id,expectedRevision:before.revision||1,epoch,...(after?{element:after}:{})}:{element:after,epoch});
   if(!ok){setError('Nicht gespeichert. Der Entwurf bleibt hier; nach erneutem Laden kannst du ihn nochmals senden oder verwerfen.');return null;}
   const result:Change={before,after:after?{...after,memberId:before?.memberId||a.id,name:before?.name||a.name,revision:before?(before.revision||1)+1:1}:undefined};
   if(history){setUndo(old=>[...old.slice(-29),result]);setRedo([]);}setPending(null);setPreview(null);setSelected(result.after?.id||'');return result;
  }finally{saving.current=false;}
 }
 async function reverse(change:Change):Promise<Change|null>{
  if(change.after){const current=elements.find(e=>e.id===change.after!.id);if(!current||(current.revision||1)!==(change.after.revision||1)){setError('Rückgängig würde eine neuere Änderung überschreiben und wurde deshalb gestoppt.');return null;}return commit({before:current,after:change.before?{...change.before,id:current.id}:undefined},false);}
  if(change.before)return commit({after:{...change.before,id:crypto.randomUUID()}},false);return null;
 }
 async function history(back:boolean){const source=back?undo:redo,last=source.at(-1);if(!last)return;const result=await reverse(last);if(!result)return;if(back){setUndo(old=>old.slice(0,-1));setRedo(old=>[...old,result]);}else{setRedo(old=>old.slice(0,-1));setUndo(old=>[...old,result]);}}
 function point(event:React.PointerEvent<SVGSVGElement>):BoardPoint {const matrix=event.currentTarget.getScreenCTM(),p=matrix?new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()):new DOMPoint();return [p.x,p.y];}
 function bounded(p:BoardPoint):BoardPoint{return [Math.round(Math.max(0,Math.min(1000,p[0]))),Math.round(Math.max(0,Math.min(600,p[1])))];}
 function editText(before:BoardElement|undefined,after:BoardElement){setText(after.text||'');setTextEdit({before,after});}
 function down(event:React.PointerEvent<SVGSVGElement>){
  if(!enabled||saving.current||pending||gesture.current)return;event.preventDefault();event.currentTarget.focus();
  const p=point(event),hit=elements.find(e=>e.id===(event.target as Element).closest('[data-element-id]')?.getAttribute('data-element-id'));
  if(tool==='erase'){if(hit)void commit({before:hit});return;}
  if(tool==='text'){const after:BoardElement=hit?.text?hit:{id:crypto.randomUUID(),memberId:a.id,name:a.name,color,points:[[Math.min(700,bounded(p)[0]),Math.min(550,bounded(p)[1])]],text:''};editText(hit?.text?hit:undefined,after);return;}
  if(tool==='select'&&!hit){setSelected('');return;}
  const start=bounded(p),element=tool==='select'?hit:tool==='pan'?undefined:{id:crypto.randomUUID(),memberId:a.id,name:a.name,color,points:tool==='pen'?[start]:[start,start],...(tool!=='pen'?{shape:tool as BoardElement['shape']}:{})};
  if(hit&&tool==='select')setSelected(hit.id);gesture.current={pointer:event.pointerId,point:p,client:[event.clientX,event.clientY],view,pan:tool==='pan',before:tool==='select'?hit:undefined,element};event.currentTarget.setPointerCapture(event.pointerId);if(element)setPreview(element);
 }
 function move(event:React.PointerEvent<SVGSVGElement>){
  const g=gesture.current;if(!g||g.pointer!==event.pointerId)return;
  if(g.pan){const width=event.currentTarget.getBoundingClientRect().width;setView({...g.view,x:g.view.x-(event.clientX-g.client[0])*g.view.width/width,y:g.view.y-(event.clientY-g.client[1])*g.view.width/width});return;}
  const p=point(event);if(g.before)g.element=moveBoardElement(g.before,p[0]-g.point[0],p[1]-g.point[1]);else if(g.element){g.element={...g.element,points:tool==='pen'?[...(g.element.points.length>=128?g.element.points.filter((_,i)=>i%2===0):g.element.points),bounded(p)]:[g.element.points[0],bounded(p)]};}if(g.element)setPreview(g.element);
 }
 function up(event:React.PointerEvent<SVGSVGElement>){
  const g=gesture.current;if(!g||g.pointer!==event.pointerId)return;gesture.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  if(g.pan)return;if(!g.element||(g.before&&JSON.stringify(g.before.points)===JSON.stringify(g.element.points))){setPreview(null);return;}void commit({before:g.before,after:g.element});
 }
 function zoom(factor:number){setView(old=>{const width=Math.max(400,Math.min(2400,old.width*factor));return {width,x:old.x+(old.width-width)/2,y:old.y+(old.width-width)*.3};});}
 const shown=preview||(pending?.after),box=shown?boardBounds(shown):selected?boardBounds(selected):null;
 return <div className={styles.editor} onKeyDown={event=>{
  if((event.target as HTMLElement).closest('input,textarea,select')||!enabled)return;
  const key=event.key.toLowerCase();if((event.ctrlKey||event.metaKey)&&key==='z'){event.preventDefault();void history(!event.shiftKey);return;}if((event.ctrlKey||event.metaKey)&&key==='y'){event.preventDefault();void history(false);return;}
  if(key==='escape'){gesture.current=null;setPreview(null);setSelected('');return;}
  if(selected&&(key==='delete'||key==='backspace')){event.preventDefault();void commit({before:selected});return;}
  if(selected&&key==='enter'&&selected.text){event.preventDefault();editText(selected,selected);return;}
  if(selected&&['arrowleft','arrowright','arrowup','arrowdown'].includes(key)){event.preventDefault();const step=event.shiftKey?10:2;void commit({before:selected,after:moveBoardElement(selected,key==='arrowleft'?-step:key==='arrowright'?step:0,key==='arrowup'?-step:key==='arrowdown'?step:0)});return;}
  if(!event.ctrlKey&&!event.metaKey){const choice=tools.find(t=>t.key.toLowerCase()===key);if(choice){event.preventDefault();setTool(choice.id);}}
 }}>
  <div className={styles.toolbar} role="toolbar" aria-label="Whiteboard-Werkzeuge">{tools.map(({id,label,key,Icon})=><button key={id} type="button" disabled={!enabled||!!pending} aria-label={label} aria-pressed={tool===id} title={`${label} (${key})`} onClick={()=>setTool(id)}><Icon size={19}/><span>{key}</span></button>)}<label title="Zeichenfarbe"><span className={styles.sr}>Zeichenfarbe</span><input type="color" value={color} onChange={e=>onColor(e.target.value)} disabled={!enabled}/></label><button disabled={!enabled||!undo.length||!!pending} aria-label="Rückgängig" title="Rückgängig (Strg+Z)" onClick={()=>void history(true)}><Undo2 size={19}/></button><button disabled={!enabled||!redo.length||!!pending} aria-label="Wiederholen" title="Wiederholen (Strg+Umschalt+Z)" onClick={()=>void history(false)}><Redo2 size={19}/></button><button disabled={!enabled||!selected||!!pending} aria-label="Ausgewähltes Objekt löschen" onClick={()=>selected&&void commit({before:selected})}><Trash2 size={19}/></button></div>
  <p className={styles.hint}>{tools.find(t=>t.id===tool)?.label} · Auswahl ziehen zum Verschieben · Text doppelt anklicken zum Bearbeiten.</p>
  {error&&<p role="alert">{error}</p>}
  <svg ref={svg} className={styles.board} viewBox={`${view.x} ${view.y} ${view.width} ${view.width*.6}`} role="application" aria-label="Gemeinsames Whiteboard: V Auswahl, P Stift, T Text, L Linie; Auswahl mit Pfeiltasten verschieben" tabIndex={0} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{gesture.current=null;setPreview(null);}} onDoubleClick={event=>{if(!enabled)return;const hit=elements.find(e=>e.id===(event.target as Element).closest('[data-element-id]')?.getAttribute('data-element-id'));if(hit?.text)editText(hit,hit);}}>
   <defs><pattern id="board-grid" width="25" height="25" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#d6b36f33"/></pattern></defs><rect x={view.x} y={view.y} width={view.width} height={view.width*.6} fill="#0b161c"/><rect width="1000" height="600" fill="url(#board-grid)"/>
   {elements.filter(e=>e.id!==shown?.id).map(e=><Shape key={e.id} element={e} sessionId={sessionId}/>)}{shown&&<Shape element={shown} sessionId={sessionId}/>} {box&&<rect x={box.x-5} y={box.y-5} width={box.width+10} height={box.height+10} fill="none" stroke="#bdb2ff" strokeWidth="2" strokeDasharray="5 4" pointerEvents="none"/>}
  </svg>
  <div className={styles.footer}><label>Objekt auswählen<select aria-label="Whiteboard-Objekt auswählen" value={selectedId} onChange={e=>{setSelected(e.target.value);setTool('select');}}><option value="">Keine Auswahl</option>{elements.map((e,i)=><option key={e.id} value={e.id}>{i+1} · {elementLabel(e).slice(0,40)} · {e.name}</option>)}</select></label>{selected?.text&&<button className="button" disabled={!enabled} onClick={()=>editText(selected,selected)}>Text bearbeiten</button>}<button aria-label="Vergrößern" title="Vergrößern" onClick={()=>zoom(.8)}><ZoomIn size={18}/></button><span>{Math.round(100000/view.width)} %</span><button aria-label="Verkleinern" title="Verkleinern" onClick={()=>zoom(1.25)}><ZoomOut size={18}/></button><button aria-label="Ansicht zurücksetzen" title="Ansicht zurücksetzen" onClick={()=>setView({x:0,y:0,width:1000})}><Maximize size={18}/></button></div>
  {pending&&<div className={styles.footer}><button className="button" disabled={!enabled} onClick={()=>void commit(pending)}>Entwurf erneut senden</button><button className="button" disabled={!enabled} onClick={()=>{setPending(null);setPreview(null);setError('');}}>Entwurf verwerfen</button></div>}
  <dialog ref={textDialog} className={styles.dialog} aria-label="Whiteboard-Text" onCancel={()=>setTextEdit(null)}><form onSubmit={event=>{event.preventDefault();if(!textEdit||!text.trim())return;void commit({before:textEdit.before,after:{...textEdit.after,text:text.trim()}}).then(ok=>{if(ok){setTextEdit(null);textDialog.current?.close();}});}}><h3>Text auf der Zeichenfläche</h3><label>Text<textarea aria-label="Whiteboard-Text bearbeiten" rows={5} maxLength={500} value={text} onChange={e=>setText(e.target.value)}/></label><div className={styles.footer}><button className="button primary" disabled={!enabled||!text.trim()}>Text speichern</button><button type="button" className="button" disabled={!enabled} onClick={()=>{setTextEdit(null);textDialog.current?.close();}}>Abbrechen</button></div></form></dialog>
 </div>;
}
