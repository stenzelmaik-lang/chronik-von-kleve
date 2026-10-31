// Regie-Nachbesserung against a running isolated instance with a started evening (scripts/start-regie-nachbesserung.ps1).
// Three synthetic sessions (SL, Spieler A, Spieler B): new effects, YouTube music, pager to all reaches both players,
// prepared YouTube tracks stay in the GM-only Regie context.
// Run: node --experimental-strip-types tests/regie-nachbesserung-integration.mjs
import assert from 'node:assert/strict';

const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8881';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only local isolated instances are allowed.');
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'})});assert.equal(r.status,200,'login '+id);return r.headers.get('set-cookie').split(';')[0];}
const client=cookie=>({
 get:async(path)=>{const r=await fetch(base+path,{headers:{Cookie:cookie},redirect:'manual'});return {status:r.status,text:await r.text()};},
 post:async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:JSON.stringify(body)});return {status:r.status,text:await r.text()};},
});
const gm=client(await login('command-gm')),a=client(await login('command-a')),b=client(await login('command-b'));
const active=JSON.parse((await gm.get('/api/live-table?view=active')).text);
const sessionId=active.room?.sessionId,runId=active.room?.runId;assert.ok(sessionId&&active.room.started,'Start the synthetic evening first.');
const q='/api/live-stage?sessionId='+encodeURIComponent(sessionId);
const snap=async c=>JSON.parse((await c.get(q)).text);
async function stage(c,command,expected=200){const s=await snap(gm);const r=await c.post('/api/live-stage',{sessionId,runId,expectedVersion:s.version,command});assert.equal(r.status,expected,command.action+': '+r.text);return r.status===200?JSON.parse(r.text):null;}

// New effects: only the GM, shared with everyone, unknown names refused.
for(const p of [a,b])await stage(p,{action:'effects',effects:['snow']},403);
await stage(gm,{action:'effects',effects:['darkness','storm','embers','flicker','snow']});
for(const p of [a,b,gm])assert.deepEqual((await snap(p)).effects,['storm','snow','embers','darkness','flicker']);
await stage(gm,{action:'effects',effects:['fog']});assert.deepEqual((await snap(b)).effects,['fog'],'A replacement arrives as one change (crossfade)');
await stage(gm,{action:'effects',effects:['fire']},400);
await stage(gm,{action:'effects',effects:[]});
console.log('PASS new effects: GM only, shared, one-step replacement, unknown refused');

// YouTube: GM only, link reduced to the id, everyone gets id/title/key, stop for all.
for(const p of [a,b])await stage(p,{action:'youtube',video:'https://youtu.be/dQw4w9WgXcQ'},403);
await stage(gm,{action:'youtube',video:'https://evil.example/watch?v=dQw4w9WgXcQ'},400);
await stage(gm,{action:'youtube',video:'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=x',title:'Kasernenhof'});
const seen=await Promise.all([a,b,gm].map(snap));
for(const s of seen){assert.equal(s.youtube.videoId,'dQw4w9WgXcQ');assert.equal(s.youtube.title,'Kasernenhof');assert.deepEqual(Object.keys(s.youtube).sort(),['index','key','label','playing','title','tracks','videoId','volume'],'Only the play state');}
assert.equal(new Set(seen.map(s=>s.youtube.key)).size,1,'Everyone gets the same start key');
await stage(gm,{action:'youtube',video:'dQw4w9WgXcQ',title:'Kasernenhof'});
assert.notEqual((await snap(a)).youtube.key,seen[0].youtube.key,'Starting again restarts for everyone');
await stage(gm,{action:'youtube',video:null});for(const p of [a,b])assert.equal((await snap(p)).youtube,null);
console.log('PASS YouTube music: GM only, link checked, same start for all, stop for all');

// Pager "an Alle" (sender Schäfer, title Wichtig): both players receive it; the GM sees recipients and read state.
const text='Ruf mich an · '+Date.now();
await stage(gm,{action:'pager',text,title:'Wichtig',sender:'Schäfer',recipients:null});
const forA=(await snap(a)).pagers.find(p=>p.text===text),forB=(await snap(b)).pagers.find(p=>p.text===text),forGm=(await snap(gm)).pagers.find(p=>p.text===text);
assert.ok(forA&&forB&&forGm,'Pager reaches A, B and the GM view');
assert.equal(forA.sender,'Schäfer');assert.equal(forA.title,'Wichtig');
for(const p of [forA,forB]){assert.equal('recipients' in p,false);assert.equal('acks' in p,false);}
assert.equal(forGm.recipients,null);
await stage(a,{action:'pagerAck',id:forA.id});
assert.deepEqual((await snap(gm)).pagers.find(p=>p.id===forA.id).acks.map(x=>x.id),['command-a']);
assert.equal((await snap(b)).pagers.find(p=>p.id===forA.id).acknowledged,false,'B does not learn who confirmed');
await stage(gm,{action:'pagerWithdraw',id:forA.id});
console.log('PASS pager to all reaches A and B; GM sees read state; players learn nothing about others');

// Prepared YouTube tracks are part of the GM-only Regie context, never of a player snapshot.
const scenes=JSON.parse((await gm.get(q+'&catalog=1')).text).scenes;
const context=JSON.parse((await gm.get(q+'&regie='+encodeURIComponent(scenes[0].id))).text);
assert.ok(Array.isArray(context.youtube),'Regie context lists prepared YouTube music');
for(const p of [a,b]){assert.equal((await p.get(q+'&regie='+encodeURIComponent(scenes[0].id))).status,403);const raw=(await p.get(q+'&catalog=1')).text;assert.ok(!raw.includes('SL_PRIVATE_SECRET'));}
console.log('ALL PASS: Regie-Nachbesserung – effects, YouTube, pager reception, GM-only context');
