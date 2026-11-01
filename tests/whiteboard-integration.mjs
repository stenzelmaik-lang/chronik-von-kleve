// Whiteboard 2 against a running isolated instance (scripts/test-local.mjs --ultio-pager, own port via CVK_TEST_PORT).
// Three synthetic sessions: SL, Spieler A, Spieler B. Proves the fixes for the reported defects 1–3
// (docs/spieltisch-2-0/Whiteboard-Fehlerbericht.md) plus rights, lock and "Meine löschen".
// Run: node --experimental-strip-types tests/whiteboard-integration.mjs
import assert from 'node:assert/strict';
import {finishStroke} from '../domain/board-editor.ts';
import {BOARD_MAX_CHARS} from '../domain/live-table.ts';

const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8897';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only local isolated instances are allowed.');
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'})});assert.equal(r.status,200,'login '+id);return r.headers.get('set-cookie').split(';')[0];}
const client=(cookie,name)=>({name,peerId:crypto.randomUUID(),
 get:async path=>{const r=await fetch(base+path,{headers:{Cookie:cookie}});return {status:r.status,body:await r.json()};},
 post:async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:JSON.stringify(body)});return {status:r.status,body:await r.json().catch(()=>null)};},
});
const gm=client(await login('command-gm'),'SL'),a=client(await login('command-a'),'A'),b=client(await login('command-b'),'B');
const active=(await gm.get('/api/live-table?view=active')).body;const sessionId=active.room?.sessionId;assert.ok(sessionId&&active.room.started,'Start the synthetic evening first.');
const stage=async c=>(await c.get('/api/live-stage?sessionId='+encodeURIComponent(sessionId))).body;
const act=async(c,action,extra={})=>c.post('/api/live-table',{action,sessionId,peerId:c.peerId,...extra});
for(const c of [gm,a,b])assert.equal((await act(c,'join')).status,200);
const epoch=async()=>(await stage(gm)).boardEpoch;
const draw=async(c,extra={})=>{const element={id:crypto.randomUUID(),color:'#d6b36f',points:[[100,100],[200,150]],...extra};const r=await act(c,'draw',{element,epoch:await epoch()});return {...r,element};};
const board=async c=>(await stage(c)).board;
const pass=label=>console.log('PASS '+label);

// Start clean so the test does not depend on earlier runs.
assert.equal((await act(gm,'lock',{locked:false})).status,200);
assert.equal((await act(gm,'clear',{epoch:await epoch()})).status,200);

// Defect 1: clearing for everybody works, only for the GM, and only on the current state.
await draw(a);await draw(b);
assert.equal((await act(b,'clear',{epoch:await epoch()})).status,403,'players cannot clear for everybody');
const before=await epoch();assert.equal((await act(gm,'clear',{epoch:before-1})).status,409,'a stale clear is refused');
assert.equal((await act(gm,'clear',{epoch:before})).status,200);
for(const c of [gm,a,b]){const s=await stage(c);assert.equal(s.board.length,0,c.name+' sees an empty sketch');assert.equal(s.boardEpoch,before+1);}
pass('defect 1: GM clears the sketch for SL, A and B; players cannot');

// "Meine löschen": only the own strokes go, the others keep their order.
const a1=await draw(a),b1=await draw(b),a2=await draw(a),b2=await draw(b);
assert.equal((await act(a,'clearMine',{epoch:await epoch()})).status,200);
assert.deepEqual((await board(b)).map(e=>e.id),[b1.element.id,b2.element.id],'only A\'s strokes are gone, B\'s stay in order');void a1;void a2;
pass('own strokes are deleted for everybody, foreign strokes untouched');

// Defect 3 (server side): what is sent is stored exactly – no reordering, no thinning.
const curve=[];for(let i=0;i<=200;i++)curve.push([150+i,180]);for(let i=1;i<=200;i++){const t=i/200*Math.PI;curve.push([350+60*Math.sin(t),240-60*Math.cos(t)]);}for(let i=1;i<=200;i++)curve.push([350-i,300]);
const pieces=finishStroke(curve),sent=[];for(const points of pieces){const r=await draw(a,{points,width:4});assert.equal(r.status,200);sent.push(r.element);}
for(const c of [gm,b]){const stored=await board(c);for(const e of sent)assert.deepEqual(stored.find(x=>x.id===e.id).points,e.points,'stored points equal the drawn ones for '+c.name);}
const again=await board(b);await new Promise(r=>setTimeout(r,1600));assert.deepEqual(await board(b),again,'nothing changes by itself between polls');
pass('defect 3: a straight–curve–straight stroke is stored and served unchanged');

// Rights: players change only their own objects; the GM may change all.
const own=sent[0];
assert.equal((await act(b,'edit',{elementId:own.id,expectedRevision:1,epoch:await epoch(),element:{...own,points:own.points.map(([x,y])=>[x,y+5])}})).status,403,'B cannot move A\'s stroke');
assert.equal((await act(b,'remove',{elementId:own.id,expectedRevision:1,epoch:await epoch()})).status,403,'B cannot delete A\'s stroke');
assert.equal((await act(gm,'edit',{elementId:own.id,expectedRevision:1,epoch:await epoch(),element:{...own,points:own.points.map(([x,y])=>[x,y+5])}})).status,200,'GM can move A\'s stroke');
assert.equal((await board(a)).find(e=>e.id===own.id).memberId,'command-a','creator stays');
pass('players change only their own sketch, the GM everything');

// Lock: the GM freezes the sketch for players, still draws, and players see the lock.
assert.equal((await act(a,'lock',{locked:true})).status,403,'players cannot lock');
assert.equal((await act(gm,'lock',{locked:true})).status,200);
assert.equal((await stage(a)).boardLocked,true,'players see the lock');
assert.equal((await draw(a)).status,423);assert.equal((await act(a,'clearMine',{epoch:await epoch()})).status,423);
assert.equal((await act(a,'remove',{elementId:own.id,expectedRevision:2,epoch:await epoch()})).status,423);
assert.equal((await draw(gm)).status,200,'GM still draws while locked');
assert.equal((await act(gm,'lock',{locked:false})).status,200);assert.equal((await draw(a)).status,200,'unlocked again');
pass('GM locks and unlocks the sketch');

// Defect 2: parallel strokes of A and B never get lost, and a full sketch neither blocks the stage nor loses stored strokes.
const count=(await board(gm)).length;
const parallel=await Promise.all(Array.from({length:12},(_,i)=>draw(i%2?b:a,{points:[[10+i*20,500],[20+i*20,560]]})));
assert.ok(parallel.every(r=>r.status===200));const ids=parallel.map(r=>r.element.id);
for(const c of [gm,a,b]){const s=await board(c);assert.equal(s.length,count+12);assert.ok(ids.every(id=>s.some(e=>e.id===id)),c.name+' sees all parallel strokes');}
pass('defect 2: 12 parallel strokes of A and B all arrive for SL, A and B');
let full=0;for(let i=0;i<400;i++){const points=Array.from({length:128},(_,k)=>[100+k*6,100+(k*37+i*11)%400]);const r=await draw(i%2?b:a,{points});if(r.status!==200){full=r.status;assert.match(r.body.error||'',/voll/i,'clear message when full');break;}}
assert.equal(full,409,'the sketch reports full');const kept=await board(gm);assert.ok(JSON.stringify(kept).length<=BOARD_MAX_CHARS,'own budget respected');
const s=await stage(gm);const note=await gm.post('/api/live-stage',{sessionId,runId:s.runId,expectedVersion:s.version,command:{action:'pager',text:'SKIZZE-VOLL-'+Date.now(),recipients:['command-a']}});
assert.equal(note.status,200,'stage commands still work with a full sketch');
assert.equal((await act(b,'clearMine',{epoch:await epoch()})).status,200,'space is freed by deleting own strokes');assert.equal((await draw(b)).status,200,'drawing works again');
assert.ok((await board(a)).length>=kept.length/2,'A\'s stored strokes stay');
pass('defect 2: a full sketch is reported, keeps everything stored and is freed by "Meine löschen"');

assert.equal((await act(gm,'clear',{epoch:await epoch()})).status,200);
console.log('Whiteboard integration: all checks passed.');
