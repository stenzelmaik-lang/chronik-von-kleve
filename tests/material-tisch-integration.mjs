// Material on the table and in the inventory against a running isolated instance (scripts/start-material-3.ps1):
// only the GM (or the owner) arranges and tilts objects; players pocket a released material into their inventory,
// lay it out again and only one person holds it; the GM can take it back. Run:
// node --experimental-strip-types tests/material-tisch-integration.mjs
import assert from 'node:assert/strict';

const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8893';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only local isolated instances are allowed.');
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'})});assert.equal(r.status,200,'login '+id);return r.headers.get('set-cookie').split(';')[0];}
const client=cookie=>({
 get:async path=>{const r=await fetch(base+path,{headers:{Cookie:cookie}});const type=r.headers.get('content-type')||'';return {status:r.status,type,text:type.includes('json')?await r.text():(await r.arrayBuffer(),'')};},
 send:async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:JSON.stringify(body)});return {status:r.status,text:await r.text()};},
});
const gm=client(await login('command-gm')),a=client(await login('command-a')),b=client(await login('command-b'));
const pass=label=>console.log('PASS '+label);
const active=JSON.parse((await gm.get('/api/live-table?view=active')).text);
const sessionId=active.room?.sessionId,runId=active.room?.runId;assert.ok(sessionId&&active.room.started,'Start the synthetic evening first.');
const q='/api/live-stage?sessionId='+encodeURIComponent(sessionId);
const snap=async c=>JSON.parse((await c.get(q+'&catalog=1')).text);
async function stage(c,command,expected=200){const s=await snap(c);const r=await c.send('/api/live-stage',{sessionId,runId,expectedVersion:s.version,command});assert.equal(r.status,expected,command.action+': '+r.text);return r;}
const pocket=async c=>JSON.parse((await c.get('/api/inventory/material')).text).items;

let s=await snap(gm);
const kaserne=s.scenes.find(x=>x.title.includes('Kaserne')).id;
if(s.stageSceneId!==kaserne)await stage(gm,{action:'activateScene',sceneId:kaserne});
for(const item of await pocket(gm))await stage(gm,{action:'reclaim',itemId:item.id});
const ctx=JSON.parse((await gm.get(q+'&regie='+encodeURIComponent(kaserne))).text);
const packet=ctx.materials.find(m=>m.title==='Anselmus-Paket');
assert.equal(packet.takeable,true,'materials are pocketable by default');assert.equal(packet.holder,null);
await stage(gm,{action:'add',kind:'document',sourceId:packet.id,sourceKind:'record',visible:true,recipients:null});
const object=()=>snap(gm).then(x=>x.objects.find(o=>o.sourceId===packet.id));
let o=await object();assert.ok(o,'the packet lies on the table');

// 1. Arranging: the GM moves and tilts; players can neither move nor tilt the GM's object.
await stage(gm,{action:'move',id:o.id,rect:{...o.rect,x:.3,r:12.5}});
o=await object();assert.equal(o.rect.r,12.5,'tilt is stored');
await stage(a,{action:'move',id:o.id,rect:{...o.rect,x:.1}},403);
assert.equal((await stage(gm,{action:'move',id:o.id,rect:{...o.rect,r:90}},400)).status,400,'tilt is limited');
pass('only the GM arranges and tilts table objects');

// 2. Player A pockets the packet: it leaves the table for everyone, the round gets a notice.
await stage(gm,{action:'take',id:o.id},403);
await stage(a,{action:'take',id:o.id});
assert.equal(await object(),undefined,'gone from the table');
const forB=await snap(b);assert.equal(forB.objects.some(x=>x.sourceId===packet.id),false);assert.match(forB.notice?.text||'',/eingesteckt/);
const own=await pocket(a);assert.equal(own.length,1);assert.equal(own[0].title,'Anselmus-Paket');assert.equal(own[0].pages.length,6,'all six pages travel with it');
assert.equal((await pocket(b)).length,0,'Player B carries nothing');
const page=await a.get(own[0].pages[2].src.replace(/^\//,'/'));assert.equal(page.status,200,'A opens a page from the inventory');
assert.equal((await b.get(own[0].pages[2].src)).status,404,'B cannot open A\'s item');
const forGm=await pocket(gm);assert.equal(forGm.find(i=>i.id===own[0].id)?.sourceId,packet.id,'the GM sees who carries it');
pass('pocketing moves the material into exactly one inventory');

// 3. Only once: the GM cannot lay it out a second time; the Regie shows the holder.
await stage(gm,{action:'add',kind:'document',sourceId:packet.id,sourceKind:'record'},409);
const holder=JSON.parse((await gm.get(q+'&regie='+encodeURIComponent(kaserne))).text).materials.find(m=>m.id===packet.id).holder;
assert.ok(holder?.itemId===own[0].id,'holder listed in the Regie');
pass('a carried material is unique');

// 4. A lays it out again: on the table for everyone, owned by A; then B pockets it.
await stage(b,{action:'play',itemId:own[0].id},404);
await stage(a,{action:'play',itemId:own[0].id});
o=await object();assert.ok(o&&o.visibility==='group'&&o.recipients===null,'back on the table for the whole round');
assert.equal((await pocket(a)).length,0,'no longer in A\'s inventory');
assert.equal((await a.get('/api/live-stage/asset?sessionId='+encodeURIComponent(sessionId)+'&objectId='+encodeURIComponent(o.id)+'&page=1')).status,200,'pages served from the laid-out object');
await stage(a,{action:'move',id:o.id,rect:{...o.rect,x:.5}});
await stage(b,{action:'move',id:o.id,rect:{...o.rect,x:.2}},403);
pass('the holder lays it out again and arranges what they laid out');
await stage(b,{action:'take',id:o.id});
const bItems=await pocket(b);assert.equal(bItems.length,1);
// A scene change keeps what players laid out from their inventory (here: nothing on the table any more).
await stage(gm,{action:'reclaim',itemId:bItems[0].id});
assert.equal((await pocket(b)).length,0,'the GM took it back');
await stage(gm,{action:'add',kind:'document',sourceId:packet.id,sourceKind:'record'});
pass('the GM takes a carried material back and can lay it out again');
o=await object();await stage(gm,{action:'remove',id:o.id});

console.log('Material am Tisch und im Inventar: all checks passed.');
