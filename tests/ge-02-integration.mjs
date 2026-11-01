// GE-02 against the synthetic --ge-01 instance only: figures as targets, private consequences, one path for both ways.
import assert from 'node:assert/strict';
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8898';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'})});assert.equal(r.status,200,id);return r.headers.get('set-cookie').split(';')[0];}
function client(cookie){return {async get(path){const r=await fetch(base+path,{headers:{Cookie:cookie}});return {status:r.status,body:await r.json()};},async post(path,data){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};},async patch(path,data){const r=await fetch(base+path,{method:'PATCH',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};}};}
const gm=client(await login('command-gm')),a=client(await login('command-a')),b=client(await login('command-b'));
const active=(await gm.get('/api/live-table?view=active')).body.room;assert.ok(active?.started);
const {sessionId,runId}=active,stage=c=>c.get('/api/live-stage?sessionId='+encodeURIComponent(sessionId)).then(r=>r.body);
const charA=(await a.get('/api/records?kind=charaktere')).body.records.find(x=>x.title==='SYNTHETISCH – Regiecharakter A');
const charB=(await b.get('/api/records?kind=charaktere')).body.records.find(x=>x.title==='SYNTHETISCH – Regiecharakter B');
assert.equal((await a.patch('/api/character-selection',{characterId:charA.id})).status,200);assert.equal((await b.patch('/api/character-selection',{characterId:charB.id})).status,200);
const common={action:'requestCheck',sessionId,runId,difficulty:6,attributeId:'dexterity',abilityId:'brawl'};
// Exactly one of audience or figures.
assert.equal((await gm.post('/api/live-table',{...common,eventId:crypto.randomUUID(),title:'x',audience:{scope:'all'},targetCharacterIds:[charB.id]})).status,400,'audience and figures together');
assert.equal((await gm.post('/api/live-table',{...common,eventId:crypto.randomUUID(),title:'x',targetCharacterIds:['no-such-character']})).status,400,'unknown figure');
assert.equal((await a.post('/api/live-table',{...common,eventId:crypto.randomUUID(),title:'x',targetCharacterIds:[charA.id]})).status,403,'only the GM issues');
// Prepared way: figure B, private consequences, prepared origin.
const preparedId=crypto.randomUUID(),prepared={...common,eventId:crypto.randomUUID(),title:'Vorbereitet: Handgemenge',targetCharacterIds:[charB.id],preparedId,consequences:{success:'PRIVATE_FOLGE Erfolg',failure:'',botch:'PRIVATE_FOLGE Patzer'}};
assert.equal((await gm.post('/api/live-table',prepared)).status,200);
// Spontaneous way: same values via the whole round.
const spontaneous={...common,eventId:crypto.randomUUID(),title:'Geschick + Handgemenge',audience:{scope:'all'}};
assert.equal((await gm.post('/api/live-table',spontaneous)).status,200);
const gmView=await stage(gm),p=gmView.checks.find(c=>c.id===prepared.eventId),s=gmView.checks.find(c=>c.id===spontaneous.eventId);
assert.deepEqual(p.recipients,['command-b'],'players derived from the figure owner');assert.deepEqual(p.targetCharacterIds,[charB.id]);assert.equal(p.preparedId,preparedId);assert.equal(p.consequences.botch,'PRIVATE_FOLGE Patzer');
for(const key of ['difficulty','attributeId','abilityId'])assert.equal(p[key],s[key],'same check data for both ways: '+key);
const bView=await stage(b),bRaw=(await b.get('/api/live-table?sessionId='+encodeURIComponent(sessionId))).body;
assert.ok(bView.checks.some(c=>c.id===prepared.eventId));assert.doesNotMatch(JSON.stringify(bView)+JSON.stringify(bRaw),/PRIVATE_FOLGE/,'consequences stay with the GM');
assert.ok(!bView.checks.some(c=>c.targetCharacterIds||c.preparedId),'no figure ids or origin for players');
assert.deepEqual(bView.checks.find(c=>c.id===spontaneous.eventId).recipients,null);
assert.ok(!(await stage(a)).checks.some(c=>c.id===prepared.eventId),'A does not see a check for figure B');
// Pool preview on the gated live path: only the addressed player, only for the issued check.
const pv={action:'previewCheck',sessionId,runId,requestId:prepared.eventId,characterId:charB.id,selection:{attributeId:'dexterity',abilityId:'brawl'}};
const previewB=await b.post('/api/live-table',pv);assert.equal(previewB.status,200,JSON.stringify(previewB.body));assert.equal(previewB.body.status,'ready');
assert.equal((await a.post('/api/live-table',{...pv,characterId:charA.id})).status,404,'not addressed: no preview');
assert.equal((await gm.post('/api/live-table',pv)).status,403,'the GM does not preview for players');
assert.equal((await b.post('/api/live-table',{...pv,selection:{attributeId:'strength',abilityId:'brawl'}})).status,400,'GM preset cannot be changed in the preview either');
// Rolling: only the intended figure, then the same server pool path as any check.
assert.equal((await a.post('/api/live-table',{action:'rollCheck',sessionId,runId,eventId:crypto.randomUUID(),requestId:prepared.eventId,characterId:charA.id,selection:{attributeId:'dexterity',abilityId:'brawl'}})).status,404,'A is not addressed');
const rolledP=await b.post('/api/live-table',{action:'rollCheck',sessionId,runId,eventId:crypto.randomUUID(),requestId:prepared.eventId,characterId:charB.id,selection:{attributeId:'dexterity',abilityId:'brawl'}});assert.equal(rolledP.status,200,JSON.stringify(rolledP.body));
const rolledS=await b.post('/api/live-table',{action:'rollCheck',sessionId,runId,eventId:crypto.randomUUID(),requestId:spontaneous.eventId,characterId:charB.id,selection:{attributeId:'dexterity',abilityId:'brawl'}});assert.equal(rolledS.status,200);
const after=(await stage(gm)).dice.events,rp=after.find(e=>e.id===rolledP.body.eventId),rs=after.find(e=>e.id===rolledS.body.eventId);
assert.equal(rp.roll.pool,previewB.body.pool.effective,'roll pool equals the preview pool');
assert.equal(rp.roll.pool,rs.roll.pool,'same pool from both ways');assert.equal(rp.roll.target,rs.roll.target);
assert.deepEqual(Object.keys(rp).sort(),Object.keys(rs).sort(),'same event structure');
// Data protection: no membership roles, scene ids or GM marks reach players.
const aView=await stage(a);
assert.doesNotMatch(JSON.stringify(aView),/membershipRole|"gm":true/,'no roles or GM marks for players');
assert.ok(aView.checks.every(c=>!('sceneId' in c)),'no SL scene ids in player checks');
// Release switch: GM only, per evening, stored rolls untouched.
const rollsBefore=JSON.stringify((await stage(gm)).dice.events);
assert.equal((await a.post('/api/live-table',{action:'setChecks',sessionId,runId,enabled:false})).status,403,'players cannot switch');
assert.equal((await gm.post('/api/live-table',{action:'setChecks',sessionId,runId,enabled:false})).status,200);
const off=await stage(gm);assert.equal(off.checksEnabled,false);assert.deepEqual(off.checksSwitch,{on:false});assert.deepEqual(off.checks,[]);
assert.equal(JSON.stringify(off.dice.events),rollsBefore,'stored rolls unchanged while switched off');
const bOff=await stage(b);assert.equal(bOff.checksSwitch,undefined,'players never see the switch');assert.deepEqual(bOff.checks,[]);
assert.equal((await gm.post('/api/live-table',{...common,eventId:crypto.randomUUID(),title:'aus',audience:{scope:'all'}})).status,409,'no new checks while off');
assert.equal((await b.post('/api/live-table',{action:'rollCheck',sessionId,runId,eventId:crypto.randomUUID(),requestId:spontaneous.eventId,characterId:charB.id,selection:{attributeId:'dexterity'}})).status,409,'no rolls while off');
assert.equal((await b.post('/api/live-table',pv)).status,409,'no preview while off');
assert.equal((await gm.post('/api/live-table',{action:'setChecks',sessionId,runId:crypto.randomUUID(),enabled:true})).status,409,'only the running evening');
assert.equal((await gm.post('/api/live-table',{action:'setChecks',sessionId,runId,enabled:true})).status,200);
const on=await stage(gm);assert.equal(on.checksEnabled,true);assert.ok(on.checks.some(c=>c.id===prepared.eventId),'checks come back');assert.equal(JSON.stringify(on.dice.events),rollsBefore,'stored rolls unchanged after switching on');
console.log('GE-02 PASS: figures as targets, exactly-one target rule, private consequences, identical path and pool, data protection, release switch on/off without touching stored rolls.');
