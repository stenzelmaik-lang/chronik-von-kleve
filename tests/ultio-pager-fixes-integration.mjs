// Read state of the ULTIO pager on the server (live acceptance defect 2) against a running isolated instance
// (scripts/start-ultio-pager.ps1). Three synthetic sessions: SL, Spieler A, Spieler B.
// Run: node --experimental-strip-types tests/ultio-pager-fixes-integration.mjs
import assert from 'node:assert/strict';

const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8884';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only local isolated instances are allowed.');
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'})});assert.equal(r.status,200,'login '+id);return r.headers.get('set-cookie').split(';')[0];}
const client=cookie=>({
 get:async path=>{const r=await fetch(base+path,{headers:{Cookie:cookie}});return {status:r.status,text:await r.text()};},
 post:async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:JSON.stringify(body)});return {status:r.status,text:await r.text()};},
});
const gm=client(await login('command-gm')),a=client(await login('command-a')),b=client(await login('command-b'));
const active=JSON.parse((await gm.get('/api/live-table?view=active')).text);
const sessionId=active.room?.sessionId,runId=active.room?.runId;assert.ok(sessionId&&active.room.started,'Start the synthetic evening first.');
const q='/api/live-stage?sessionId='+encodeURIComponent(sessionId);
const snap=async c=>JSON.parse((await c.get(q)).text);
async function stage(c,command,expected=200){const s=await snap(c);const r=await c.post('/api/live-stage',{sessionId,runId,expectedVersion:s.version,command});assert.equal(r.status,expected,command.action+': '+r.text);return r.status===200?JSON.parse(r.text):null;}
const unique='LESEN-'+Date.now(),find=async(c,text)=>(await snap(c)).pagers.find(p=>p.text===text);

await stage(gm,{action:'pager',text:unique+' nur A',recipients:['command-a']});
await stage(gm,{action:'pager',text:unique+' alle',recipients:null});
const onlyA=(await find(gm,unique+' nur A')).id,all=(await find(gm,unique+' alle')).id;
assert.equal((await find(a,unique+' nur A')).read,false,'New messages start unread');

// Only the logged-in recipient marks a real message as read; nobody else, nothing foreign.
await stage(b,{action:'pagerRead',id:onlyA},404);
await stage(gm,{action:'pagerRead',id:onlyA},404);
await stage(a,{action:'pagerRead',id:crypto.randomUUID()},404);
await stage(a,{action:'pagerRead',id:onlyA});
assert.equal((await find(a,unique+' nur A')).read,true,'A sees it as read');
assert.ok(!(await b.get(q)).text.includes(onlyA),'B learns nothing about the message for A');
const gmView=await find(gm,unique+' nur A');assert.deepEqual(gmView.reads.map(x=>x.id),['command-a'],'The GM sees who read it');
assert.equal(gmView.acks,undefined,'Reading is not acknowledging');
console.log('PASS read receipt: recipient only, real id, visible to the GM');

// Shared message: A reads, B stays unread; nobody else is marked along.
await stage(a,{action:'pagerRead',id:all});
assert.equal((await find(b,unique+' alle')).read,false,'B is not marked by A');
assert.ok(!('reads' in (await find(b,unique+' alle'))),'Players never get the read list');
console.log('PASS foreign messages are never marked along');

// Repeated and late events: idempotent and monotonic.
const firstAt=(await find(gm,unique+' alle')).reads[0].at;
await stage(a,{action:'pagerRead',id:all});
await stage(a,{action:'pagerAck',id:all});
const after=await find(gm,unique+' alle');
assert.deepEqual(after.reads,[{id:'command-a',at:firstAt}],'A repeated read and a later acknowledgement keep the first read');
assert.deepEqual(after.acks.map(x=>x.id),['command-a']);
await stage(a,{action:'pagerRead',id:all});
assert.equal((await find(a,unique+' alle')).acknowledged,true,'A late read never undoes the acknowledgement');
await stage(b,{action:'pagerAck',id:all});
assert.deepEqual((await find(gm,unique+' alle')).reads.map(x=>x.id),['command-a','command-b'],'Acknowledging counts as read for B too');
console.log('PASS repeated and late events never reset the state');

// Reload: a fresh session of A (no browser storage) gets the read state from the server.
const a2=client(await login('command-a'));
assert.equal((await find(a2,unique+' nur A')).read,true,'Read survives a new login and a reload');
console.log('PASS read state persists on the server');

for(const id of [onlyA,all])await stage(gm,{action:'pagerWithdraw',id});
console.log('ALL PASS: ULTIO pager read state');
