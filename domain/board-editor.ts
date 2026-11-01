import {BOARD_MAX_CHARS,BOARD_POINTS,type BoardElement,type BoardPoint} from './live-table.ts';
export function boardTextLines(text:string):string[]{return text.split('\n').flatMap(paragraph=>{const lines:string[]=[];let rest=paragraph;while(rest.length>42){const space=rest.lastIndexOf(' ',42),cut=space>0?space:42;lines.push(rest.slice(0,cut));rest=rest.slice(cut).trimStart();}lines.push(rest);return lines;});}
export function moveBoardElement(element:BoardElement,dx:number,dy:number):BoardElement {
 const box=boardBounds(element);
 const x=Math.max(-box.x,Math.min(1000-box.x-box.width,Math.round(dx))),y=Math.max(-box.y,Math.min(600-box.y-box.height,Math.round(dy)));
 return {...element,points:element.points.map(p=>[p[0]+x,p[1]+y] as BoardPoint)};
}
export function boardBounds(element:BoardElement){
 const xs=element.points.map(p=>p[0]),ys=element.points.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys);
 const lines=element.text?boardTextLines(element.text):[];
 return {x,y,width:element.fileId?320:element.text?Math.max(90,lines.reduce((n,s)=>Math.max(n,s.length),0)*11):Math.max(8,Math.max(...xs)-x),height:element.fileId?240:element.text?Math.max(28,lines.length*26):Math.max(8,Math.max(...ys)-y)};
}

/**
 * Freehand sampling: a point is only kept once the pointer moved far enough. Points already drawn are never
 * thinned or reordered while the stroke grows (the old halving at 128 points deformed the start of long strokes).
 */
export function addStrokePoint(points:BoardPoint[],p:BoardPoint,minDistance=1.5):BoardPoint[]{
 const last=points.at(-1);if(last&&Math.hypot(p[0]-last[0],p[1]-last[1])<minDistance)return points;
 return [...points,p];
}
function distanceToSegment(p:BoardPoint,a:BoardPoint,b:BoardPoint){const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;const t=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
/** Ramer–Douglas–Peucker: drops only points that lie within the tolerance of the remaining path. */
export function simplifyPoints(points:BoardPoint[],tolerance:number):BoardPoint[]{
 if(points.length<3)return points.slice();
 const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;const stack:[number,number][]=[[0,points.length-1]];
 while(stack.length){const [from,to]=stack.pop()!;let index=-1,worst=tolerance;for(let i=from+1;i<to;i++){const d=distanceToSegment(points[i],points[from],points[to]);if(d>worst){worst=d;index=i;}}if(index>0){keep[index]=1;stack.push([from,index],[index,to]);}}
 return points.filter((_,i)=>keep[i]);
}
/**
 * Turns a finished freehand stroke into one or more storable strokes. The visible path keeps its shape:
 * points are rounded, simplified within under one board unit, and a stroke that is still too long is split
 * into consecutive pieces that share their joining point instead of being thinned further.
 */
export function finishStroke(raw:BoardPoint[],max=BOARD_POINTS):BoardPoint[][]{
 const rounded=raw.map(p=>[Math.round(p[0]),Math.round(p[1])] as BoardPoint).filter((p,i,all)=>i===0||p[0]!==all[i-1][0]||p[1]!==all[i-1][1]);
 if(!rounded.length)return [];
 const simple=simplifyPoints(rounded,.75);
 if(simple.length<=max)return [simple];
 const pieces:BoardPoint[][]=[];for(let start=0;start<simple.length-1;start+=max-1)pieces.push(simple.slice(start,start+max));
 return pieces;
}
/** Smooth SVG path through the stored points (rendering only; stored points stay untouched). */
export function strokePath(points:BoardPoint[]):string{
 if(points.length<3)return 'M'+points.map(p=>p.join(' ')).join(' L');
 let d=`M${points[0][0]} ${points[0][1]}`;
 for(let i=1;i<points.length-1;i++)d+=` Q${points[i][0]} ${points[i][1]} ${(points[i][0]+points[i+1][0])/2} ${(points[i][1]+points[i+1][1])/2}`;
 const last=points.at(-1)!;return d+` L${last[0]} ${last[1]}`;
}
/** Arrow head in board units for a surface stretched by sx/sy, so the head looks the same on every screen. */
export function arrowHead(from:BoardPoint,to:BoardPoint,length:number,sx=1,sy=1):[BoardPoint,BoardPoint]{
 const angle=Math.atan2((to[1]-from[1])*sy,(to[0]-from[0])*sx);
 const side=(turn:number):BoardPoint=>[to[0]-length*Math.cos(angle+turn)/sx,to[1]-length*Math.sin(angle+turn)/sy];
 return [side(.45),side(-.45)];
}
/** Share of the sketch budget in use, 0..1. */
export function boardUsage(elements:BoardElement[]){return Math.min(1,JSON.stringify(elements).length/BOARD_MAX_CHARS);}

/** A local change on its way to the server. It stays visible until a newer server state contains it. */
export type BoardOp={key:string;kind:'draw'|'edit'|'remove';element:BoardElement;expectedRevision?:number;epoch:number;state:'queued'|'sending'|'sent'|'failed';error?:string;seen?:unknown};
export function opReflected(op:BoardOp,server:BoardElement[]){
 const current=server.find(e=>e.id===op.element.id);
 if(op.kind==='draw')return !!current;
 if(op.kind==='remove')return !current;
 return !current||(current.revision||1)>(op.expectedRevision||1);
}
/**
 * What this viewer sees: the server state plus its own changes that the server does not show yet.
 * Server elements keep their order; an own new element is drawn on top until it arrives.
 * A refused move or delete falls back to the server state; a refused new stroke stays visible to send again.
 */
export function mergeBoard(server:BoardElement[],ops:BoardOp[]):BoardElement[]{
 let shown=server.slice();
 for(const op of ops){
  if(opReflected(op,server)||op.state==='failed'&&op.kind!=='draw')continue;
  if(op.kind==='remove')shown=shown.filter(e=>e.id!==op.element.id);
  else if(op.kind==='edit')shown=shown.map(e=>e.id===op.element.id?op.element:e);
  else if(!shown.some(e=>e.id===op.element.id))shown.push(op.element);
 }
 return shown;
}
/** Who may change an element: the GM always, players only their own and only while the sketch is not locked. */
export function canChangeBoard(element:Pick<BoardElement,'memberId'>,viewer:{id:string;gm:boolean},locked=false){return viewer.gm||!locked&&element.memberId===viewer.id;}
