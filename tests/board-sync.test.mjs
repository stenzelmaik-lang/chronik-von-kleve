// Whiteboard 2: stroke geometry and the local change queue (docs/spieltisch-2-0/Whiteboard-Fehlerbericht.md).
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {boardElement,BOARD_POINTS} from '../domain/live-table.ts';
import {addStrokePoint,finishStroke,simplifyPoints,strokePath,mergeBoard,opReflected,canChangeBoard,arrowHead,boardUsage} from '../domain/board-editor.ts';

// straight → half circle → straight, sampled like a mouse at ~1 px per event
const path=[];for(let i=0;i<=200;i++)path.push([150+i,180]);
for(let i=1;i<=200;i++){const t=i/200*Math.PI;path.push([350+60*Math.sin(t),240-60*Math.cos(t)]);}
for(let i=1;i<=200;i++)path.push([350-i,300]);
const seg=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;const t=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
const deviation=(ideal,stored)=>Math.max(...ideal.map(q=>{let best=Infinity;for(let i=1;i<stored.length;i++)best=Math.min(best,seg(q,stored[i-1],stored[i]));return best;}));
/** The removed client code: append every move, halve at 128 points. */
function legacy(points){let kept=[points[0]];for(const p of points.slice(1))kept=[...(kept.length>=128?kept.filter((_,i)=>i%2===0):kept),p];return kept;}

test('old halving decimation deforms the early curve (defect 3)',()=>{
 const old=legacy(path),curve=old.filter(([x,y])=>y>181&&y<299);
 assert.ok(curve.length<=8,'the half circle keeps only a handful of points: '+curve.length);
 assert.ok(deviation(path,old)>5,'the stored stroke leaves the drawn path by several units');
});
test('finished strokes keep their shape within one board unit and fit the storage limit',()=>{
 const pieces=finishStroke(path);
 for(const piece of pieces){assert.ok(piece.length<=BOARD_POINTS);assert.doesNotThrow(()=>boardElement({id:randomUUID(),color:'#d6b36f',points:piece}));}
 const joined=pieces.flatMap((p,i)=>i?p.slice(1):p);
 assert.ok(deviation(path,joined)<1.3,'shape preserved: '+deviation(path,joined).toFixed(2));
 assert.ok(joined.filter(([x,y])=>y>181&&y<299).length>=10,'the curve keeps enough points to stay round');
 for(let i=1;i<pieces.length;i++)assert.deepEqual(pieces[i][0],pieces[i-1].at(-1),'pieces join without a gap');
});
test('very long strokes are split into pieces instead of being thinned further',()=>{
 const zigzag=Array.from({length:900},(_,i)=>[50+i,i%2?100:140]);const pieces=finishStroke(zigzag);
 assert.ok(pieces.length>1);assert.equal(pieces.flatMap((p,i)=>i?p.slice(1):p).length,900,'every corner survives');
 assert.ok(pieces.every(p=>p.length<=BOARD_POINTS));
});
test('drawing never rewrites points that are already on screen',()=>{
 let points=[];const seen=[];for(const p of path){points=addStrokePoint(points,p);seen.push(points);}
 for(let i=1;i<seen.length;i++)assert.deepEqual(seen[i].slice(0,seen[i-1].length),seen[i-1]);
 assert.equal(addStrokePoint([[10,10]],[10.5,10.5]).length,1,'jitter below the distance is ignored');
});
test('simplification and smooth rendering keep start and end and do not reorder',()=>{
 const simple=simplifyPoints(path,.75);assert.deepEqual(simple[0],path[0]);assert.deepEqual(simple.at(-1),path.at(-1));
 for(let i=1;i<simple.length;i++)assert.ok(path.indexOf(simple[i])>path.indexOf(simple[i-1]));
 const d=strokePath([[0,0],[10,10],[20,0]]);assert.ok(d.startsWith('M0 0')&&d.endsWith('L20 0'));
});
test('stroke width is optional, bounded and only for drawings',()=>{
 const base={id:randomUUID(),color:'#abcdef',points:[[1,1],[5,5]]};
 assert.equal(boardElement({...base,width:8}).width,8);assert.equal(boardElement(base).width,undefined);
 for(const width of [0,13,2.5,'4'])assert.throws(()=>boardElement({...base,width}));
 assert.equal(boardElement({...base,points:[[1,1]],text:'Notiz',width:4}).width,undefined);
});

const el=(id,memberId='a',revision=1,extra={})=>({id,memberId,name:memberId,color:'#d6b36f',points:[[1,1],[9,9]],revision,...extra});
test('own new strokes stay visible over older server states until the server shows them (defect 2)',()=>{
 const mine=el('n'),op={key:'k',kind:'draw',element:mine,epoch:0,state:'sending'};
 assert.deepEqual(mergeBoard([el('x','b')],[op]).map(e=>e.id),['x','n'],'stale poll without the stroke');
 assert.deepEqual(mergeBoard([el('n'),el('x','b')],[op]).map(e=>e.id),['n','x'],'server order wins once it is there');
 assert.ok(opReflected(op,[el('n')]));
 assert.deepEqual(mergeBoard([],[{...op,state:'failed'}]).map(e=>e.id),['n'],'a refused stroke stays to be sent again');
});
test('moves and deletes show at once; refused ones fall back to the server state',()=>{
 const server=[el('s',  'a',2)],moved=el('s','a',3,{points:[[50,50],[60,60]]});
 const edit={key:'e',kind:'edit',element:moved,expectedRevision:2,epoch:0,state:'sending'};
 assert.deepEqual(mergeBoard(server,[edit])[0].points,[[50,50],[60,60]]);
 assert.deepEqual(mergeBoard([el('s','a',3,{points:[[70,70],[80,80]]})],[edit])[0].points,[[70,70],[80,80]],'a newer server revision wins');
 assert.deepEqual(mergeBoard(server,[{...edit,state:'failed'}])[0].points,[[1,1],[9,9]]);
 const remove={key:'r',kind:'remove',element:server[0],expectedRevision:2,epoch:0,state:'sending'};
 assert.equal(mergeBoard(server,[remove]).length,0);assert.equal(mergeBoard(server,[{...remove,state:'failed'}]).length,1);
});
test('players change only their own sketch, the GM everything, and the lock stops players',()=>{
 assert.ok(canChangeBoard({memberId:'a'},{id:'a',gm:false}));assert.ok(!canChangeBoard({memberId:'b'},{id:'a',gm:false}));
 assert.ok(canChangeBoard({memberId:'b'},{id:'gm',gm:true},true));assert.ok(!canChangeBoard({memberId:'a'},{id:'a',gm:false},true));
});
test('arrow heads look the same on stretched frames and usage is reported',()=>{
 const [l,r]=arrowHead([0,0],[100,0],10,2,1);assert.ok(Math.abs(Math.hypot((l[0]-100)*2,l[1])-10)<1e-9&&Math.abs(Math.hypot((r[0]-100)*2,r[1])-10)<1e-9);
 assert.equal(boardUsage([]),2/160000);
});
