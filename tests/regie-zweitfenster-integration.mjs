// Regie im Zweitfenster against a running isolated instance with a started evening (scripts/start-regie.ps1).
// Three synthetic sessions (SL, Spieler A, Spieler B): rights, pager audiences, effects, music, reload, GM-only route.
// Run: node --experimental-strip-types tests/regie-zweitfenster-integration.mjs
import assert from 'node:assert/strict';

const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8870';
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
const unique='PAGER-'+Date.now();

// The GM-only route: players get no Regie, neither page nor private context.
const gmPage=await gm.get('/sl/regie?sessionId='+encodeURIComponent(sessionId));
assert.equal(gmPage.status,200);assert.ok(!gmPage.text.includes('Nur für die Spielleitung'),'GM gets the Regie page');
const scenes=(await snap(gm)).scenes;assert.ok(scenes.length,'Synthetic evening has scenes');
const regie=JSON.parse((await gm.get(q+'&regie='+encodeURIComponent(scenes[0].id))).text);
assert.match(regie.scene.secrets,/SL_PRIVATE_SECRET/,'Fixture carries a private SL secret');
for(const [name,p] of [['A',a],['B',b]]){
 const page=await p.get('/sl/regie?sessionId='+encodeURIComponent(sessionId));
 assert.equal(page.status,200);assert.ok(page.text.includes('Nur für die Spielleitung'),'Player '+name+' sees the refusal');
 assert.ok(!page.text.includes('SL_PRIVATE_SECRET'),'No SL secret in the player page');
 assert.equal((await p.get(q+'&regie='+encodeURIComponent(scenes[0].id))).status,403,'Player '+name+' cannot load the Regie context');
}
console.log('PASS Regie route and context are GM only');

// Players can neither page, set effects nor start music.
const audioFile=(await snap(gm)).catalog.find(o=>o.sourceKind==='file'&&o.mime?.startsWith('audio/'));assert.ok(audioFile,'Synthetic audio available');
for(const command of [{action:'pager',text:'forged',recipients:null},{action:'effects',effects:['rain']},{action:'music',fileId:audioFile.id},{action:'pagerWithdraw',id:'x'}])
 for(const p of [a,b])await stage(p,command,403);
console.log('PASS players cannot send pagers, effects or music');

// Pager audiences are checked on the server: B never receives A's message, not even its existence.
await stage(gm,{action:'pager',text:unique+' nur A',recipients:['command-a']});
await stage(gm,{action:'pager',text:unique+' an alle',recipients:null});
await stage(gm,{action:'pager',text:unique+' A und B',recipients:['command-a','command-b']});
const pa=await snap(a),pb=await snap(b),pg=await snap(gm);
assert.deepEqual(pa.pagers.filter(p=>p.text.startsWith(unique)).map(p=>p.text),[unique+' nur A',unique+' an alle',unique+' A und B']);
assert.deepEqual(pb.pagers.filter(p=>p.text.startsWith(unique)).map(p=>p.text),[unique+' an alle',unique+' A und B']);
const rawB=(await b.get(q)).text;assert.ok(!rawB.includes(unique+' nur A'),'B snapshot never contains the message for A');
assert.ok(pa.pagers.every(p=>!('recipients' in p)),'Players never see recipient lists');
assert.ok(pg.pagers.some(p=>p.text===unique+' nur A'&&p.recipients[0]==='command-a'),'GM sees recipients');
await stage(gm,{action:'pager',text:'Fremd',recipients:['nobody']},400);
await stage(gm,{action:'pager',text:'Leer',recipients:[]},400);
await stage(gm,{action:'pager',text:'x'.repeat(281),recipients:null},400);
const onlyA=pg.pagers.find(p=>p.text===unique+' nur A');
await stage(gm,{action:'pagerWithdraw',id:onlyA.id});
assert.ok(!(await snap(a)).pagers.some(p=>p.id===onlyA.id),'A withdrawn pager disappears for A');
console.log('PASS pager: exact audiences, no recipient leak, invalid audiences refused, withdrawal');

// Effects reach the whole round and survive a reload (fresh request).
await stage(gm,{action:'effects',effects:['fog','rain']});
for(const p of [a,b,gm])assert.deepEqual((await snap(p)).effects,['rain','fog']);
await stage(gm,{action:'effects',effects:['fog']});
assert.deepEqual((await snap(b)).effects,['fog']);
await stage(gm,{action:'effects',effects:['lightning']},400);
console.log('PASS effects: shared, persistent across reload, unknown refused');

// Music: audio only, everybody can fetch the running track through the stage asset route, never the original id.
const image=(await snap(gm)).catalog.find(o=>o.sourceKind==='file'&&o.mime?.startsWith('image/'));
await stage(gm,{action:'music',fileId:image.id},400);
await stage(gm,{action:'music',fileId:audioFile.id});
const ma=(await snap(a)).music,mg=(await snap(gm)).music;
assert.ok(ma&&ma.key&&!('fileId' in ma),'Players get title and key, not the file id');assert.equal(mg.fileId,audioFile.id);
for(const p of [a,b]){const r=await p.get(asset('music'));assert.equal(r.status,200);assert.match(r.type,/^audio\//);assert.equal((await p.get('/api/files?id='+encodeURIComponent(audioFile.id))).status,404,'Original stays private');}
await stage(gm,{action:'music',fileId:audioFile.id});
assert.notEqual((await snap(a)).music.key,ma.key,'Restarting the same track changes the key');
await stage(gm,{action:'music',fileId:null});
for(const p of [a,b]){assert.equal((await snap(p)).music,null);assert.equal((await p.get(asset('music'))).status,404);}
console.log('PASS music: audio only, shared via stage asset, restart and stop');

// Per-item audiences of the Regie window use the existing release: NPC appears only for B.
const npc=regie.npcs[0];assert.ok(npc,'Synthetic NPC prepared');
await stage(gm,{action:'add',kind:'npc',sourceId:npc.id,sourceKind:'entity',visible:true,recipients:['command-b']});
const npcObject=(await snap(gm)).objects.find(o=>o.kind==='npc'&&o.sourceId===npc.id);
assert.ok((await snap(b)).objects.some(o=>o.id===npcObject.id),'B sees the NPC');
assert.ok(!(await snap(a)).objects.some(o=>o.id===npcObject.id),'A does not see the NPC');
assert.equal((await a.get(asset(npcObject.id))).status,404,'A cannot fetch the NPC image');
assert.equal((await b.get(asset(npcObject.id))).status,200,'B can fetch the NPC image');
await stage(gm,{action:'remove',id:npcObject.id});
console.log('PASS NPC appearance for a chosen player only');

// Two GM windows: an outdated version is refused (409) and not applied; the client retries on the fresh version.
const before=await snap(gm);
await stage(gm,{action:'effects',effects:[]});
const stale=await gm.post('/api/live-stage',{sessionId,runId,expectedVersion:before.version,command:{action:'effects',effects:['rain']}});
assert.equal(stale.status,409);assert.deepEqual((await snap(gm)).effects,[]);
console.log('PASS outdated second-window command is refused, not overwritten');

// No SL secret ever reaches a player snapshot.
for(const p of [a,b]){const raw=(await p.get(q+'&catalog=1')).text;assert.ok(!raw.includes('SL_PRIVATE_SECRET'),'No secret in player snapshot');}
console.log('PASS player snapshots carry no SL texts');

// Leave a calm table for the next suites: withdraw this run's pagers.
for(const p of (await snap(gm)).pagers.filter(p=>p.text.startsWith(unique)))await stage(gm,{action:'pagerWithdraw',id:p.id});
console.log('ALL PASS: Regie im Zweitfenster – rights, audiences, effects, music');
