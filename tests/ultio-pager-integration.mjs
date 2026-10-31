// ULTIO pager R-03 against a running isolated instance with a started evening (scripts/start-ultio-pager.ps1).
// Three synthetic sessions (SL, Spieler A, Spieler B): prepare in the Command Center, play from the Regie,
// spontaneous messages, audiences, acknowledgement, foreign access (403/404), deduplication and reload.
// Run: node --experimental-strip-types tests/ultio-pager-integration.mjs
import assert from 'node:assert/strict';

const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8874';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only local isolated instances are allowed.');
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'})});assert.equal(r.status,200,'login '+id);return r.headers.get('set-cookie').split(';')[0];}
const client=cookie=>({
 get:async(path)=>{const r=await fetch(base+path,{headers:{Cookie:cookie},redirect:'manual'});const type=r.headers.get('content-type')||'';const text=type.includes('json')||type.includes('html')?await r.text():(await r.arrayBuffer(),'');return {status:r.status,type,text};},
 post:async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:JSON.stringify(body)});return {status:r.status,text:await r.text()};},
});
const gm=client(await login('command-gm')),a=client(await login('command-a')),b=client(await login('command-b'));
const active=JSON.parse((await gm.get('/api/live-table?view=active')).text);
const sessionId=active.room?.sessionId,runId=active.room?.runId;assert.ok(sessionId&&active.room.started,'Start the synthetic evening first.');
const q='/api/live-stage?sessionId='+encodeURIComponent(sessionId),asset=id=>q.replace('/api/live-stage?','/api/live-stage/asset?')+'&objectId='+encodeURIComponent(id);
const snap=async c=>JSON.parse((await c.get(q+'&catalog=1')).text);
async function stage(c,command,expected=200){const s=await snap(c);const r=await c.post('/api/live-stage',{sessionId,runId,expectedVersion:s.version,command});assert.equal(r.status,expected,command.action+': '+r.text);return r.status===200?JSON.parse(r.text):null;}
const unique='ULTIO-'+Date.now();

// 1. Preparation in the Command Center: pager messages are scene material (GM only).
const sceneId=(await snap(gm)).scenes[0].id;
const read=async()=>JSON.parse((await gm.get('/api/command-center/scenes?id='+encodeURIComponent(sceneId))).text).scene;
const pagerElement=(title,sender,text,priority,recipientIds)=>({id:crypto.randomUUID(),kind:'pager',title,text:'<p>Einsatz: wenn die Wache wechselt.</p>',referenceId:'',fileId:'',pager:{sender,text,priority,recipientIds}});
const forA=pagerElement('SÜDTOR',unique+'-SCHAEFER',unique+' vorbereitet nur A','hoch',['command-a']);
const forAll=pagerElement('LAGE','ZENTRALE',unique+' vorbereitet alle','normal',[]);
let scene=await read();
const save=(c,elements,expected=200)=>c.post('/api/command-center/scenes',{action:'save',id:scene.id,version:scene.version,document:{...scene.document,elements}}).then(r=>{assert.equal(r.status,expected,'scene save: '+r.text);return r;});
await save(gm,[...scene.document.elements,{...forA,pager:{...forA.pager,recipientIds:['nobody']}}],400);
await save(gm,[...scene.document.elements,{...forA,pager:{...forA.pager,text:'x'.repeat(281)}}],400);
for(const p of [a,b]){await save(p,[...scene.document.elements,forA],403);assert.equal((await p.get('/api/command-center/scenes?id='+encodeURIComponent(sceneId))).status,403,'Players cannot read the scene');}
await save(gm,[...scene.document.elements,forA,forAll]);
scene=await read();assert.deepEqual(scene.document.elements.find(e=>e.id===forA.id).pager,forA.pager,'Prepared pager stored with the scene');
console.log('PASS preparation: pager messages are scene material, validated, GM only');

// 2. The Regie lists the prepared messages; nothing reaches players before it is played.
const regie=JSON.parse((await gm.get(q+'&regie='+encodeURIComponent(sceneId))).text);
const prepared=regie.pagers.find(p=>p.id===forA.id);
assert.deepEqual({...prepared,cue:undefined},{id:forA.id,title:'SÜDTOR',sender:forA.pager.sender,text:forA.pager.text,priority:'hoch',recipientIds:['command-a'],cue:undefined});
assert.ok(!regie.notes.some(n=>n.id===forA.id),'Pager elements are not listed as plain notes');
for(const p of [a,b]){
 assert.equal((await p.get(q+'&regie='+encodeURIComponent(sceneId))).status,403,'Players get no Regie context');
 assert.ok(!(await p.get(q+'&catalog=1')).text.includes(unique),'Prepared, unsent pager text never reaches a player');
}
console.log('PASS Regie lists prepared pagers for the GM only; unsent text stays private');

// 3. Play the prepared message to A: its element id is the message id; B learns nothing, not even by id.
const play=p=>({action:'pager',id:p.id,origin:'vorbereitet',text:p.pager.text,title:p.title,sender:p.pager.sender,...(p.pager.priority==='hoch'?{priority:'hoch'}:{}),recipients:p.pager.recipientIds.length?p.pager.recipientIds:null});
for(const p of [a,b])await stage(p,play(forA),403);
await stage(gm,play(forA));
let mine=(await snap(a)).pagers.find(p=>p.id===forA.id);
assert.deepEqual([mine.title,mine.sender,mine.text,mine.priority,mine.acknowledged],['SÜDTOR',forA.pager.sender,forA.pager.text,'hoch',false]);
assert.ok(!('recipients' in mine)&&!('origin' in mine)&&!('acks' in mine),'Players get neither recipients, origin nor acknowledgements');
const rawB=(await b.get(q+'&catalog=1')).text;
assert.ok(!rawB.includes(forA.id)&&!rawB.includes(unique+' vorbereitet nur A'),'B snapshot holds neither id nor text of the message for A');
assert.equal((await b.get(asset(forA.id))).status,404,'B cannot fetch the message by id');
assert.equal((await a.get(asset(forA.id))).status,404,'Pagers are no table assets, not even for A');
await stage(b,{action:'pagerAck',id:forA.id},404);
await stage(a,{action:'pagerAck',id:crypto.randomUUID()},404);
await stage(gm,{action:'pagerAck',id:forA.id},404);
console.log('PASS prepared pager reaches A only; B gets 404 by id; players cannot send (403)');

// 4. Deduplication: the same id is sent once; a withdrawn message may be played again with the same id.
await stage(gm,play(forA),409);
assert.equal((await snap(a)).pagers.filter(p=>p.id===forA.id).length,1,'No duplicate after a repeated play');
await stage(gm,{action:'pager',origin:'vorbereitet',text:'ohne id',recipients:null},400);
await stage(gm,play(forAll));
assert.ok((await snap(b)).pagers.some(p=>p.id===forAll.id),'The round-wide prepared message reaches B');
console.log('PASS deduplication by id; prepared messages need their id');

// 5. Spontaneous messages from the Regie: one, several or all players; a client retry with the same id is refused.
const spontaneous=crypto.randomUUID();
await stage(gm,{action:'pager',id:spontaneous,origin:'regie',text:unique+' spontan A+B',sender:'UNBEKANNT',recipients:['command-a','command-b']});
await stage(gm,{action:'pager',id:spontaneous,origin:'regie',text:unique+' spontan A+B',sender:'UNBEKANNT',recipients:['command-a','command-b']},409);
await stage(gm,{action:'pager',text:unique+' spontan nur B',recipients:['command-b']});
await stage(gm,{action:'pager',text:unique+' spontan alle',recipients:null});
const texts=async c=>(await snap(c)).pagers.filter(p=>p.text.startsWith(unique)).map(p=>p.text);
assert.deepEqual(await texts(a),[unique+' vorbereitet nur A',unique+' vorbereitet alle',unique+' spontan A+B',unique+' spontan alle']);
assert.deepEqual(await texts(b),[unique+' vorbereitet alle',unique+' spontan A+B',unique+' spontan nur B',unique+' spontan alle']);
await stage(gm,{action:'pager',text:'Fremd',recipients:['nobody']},400);
await stage(gm,{action:'pager',text:'Leer',recipients:[]},400);
console.log('PASS spontaneous pagers: exact audiences, retry deduplicated, invalid audiences refused');

// 6. Acknowledgement: only the logged-in recipient, once, for a real id; the GM sees who confirmed.
await stage(a,{action:'pagerAck',id:forA.id});
await stage(a,{action:'pagerAck',id:forA.id});
await stage(a,{action:'pagerAck',id:spontaneous});
const gmView=(await snap(gm)).pagers;
assert.deepEqual(gmView.find(p=>p.id===forA.id).acks.map(x=>x.id),['command-a'],'One acknowledgement, even when sent twice');
assert.equal(gmView.find(p=>p.id===forA.id).origin,'vorbereitet');
assert.deepEqual(gmView.find(p=>p.id===spontaneous).acks.map(x=>x.id),['command-a']);
assert.equal((await snap(b)).pagers.find(p=>p.id===spontaneous).acknowledged,false,'B does not see that A confirmed');
console.log('PASS acknowledgement per recipient, idempotent, visible to the GM only');

// 7. Reload: a fresh request restores the state from the real ids.
const reloadA=(await snap(a)).pagers,reloadB=(await snap(b)).pagers;
assert.equal(new Set(reloadA.map(p=>p.id)).size,reloadA.length,'No duplicate ids after reload');
assert.equal(reloadA.find(p=>p.id===forA.id).acknowledged,true);assert.equal(reloadA.find(p=>p.id===forAll.id).acknowledged,false);
assert.ok(!reloadB.some(p=>p.id===forA.id));
console.log('PASS reload restores ids and acknowledgements');

// 8. Withdrawal removes the message everywhere; afterwards the prepared message can be played again.
await stage(gm,{action:'pagerWithdraw',id:forA.id});
assert.ok(!(await snap(a)).pagers.some(p=>p.id===forA.id),'Withdrawn for A');
await stage(a,{action:'pagerAck',id:forA.id},404);
await stage(gm,play(forA));
assert.equal((await snap(a)).pagers.find(p=>p.id===forA.id).acknowledged,false,'A replay starts unacknowledged');
console.log('PASS withdrawal and replay');

// Leave a calm table and scene for the next suites.
for(const p of (await snap(gm)).pagers.filter(p=>p.text.startsWith(unique)))await stage(gm,{action:'pagerWithdraw',id:p.id});
scene=await read();await save(gm,scene.document.elements.filter(e=>e.id!==forA.id&&e.id!==forAll.id));
console.log('ALL PASS: ULTIO pager – preparation, play, spontaneous, audiences, acknowledgement, dedupe, reload');
