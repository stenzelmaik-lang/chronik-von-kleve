// Zustandswerte am Spieltisch against a running isolated --zustandswerte instance (started evening).
// Three independent synthetic sessions (SL, Spieler A, Spieler B): rights, live distribution, reload, audit.
// Run: CVK_TEST_URL=http://127.0.0.1:8852 node --experimental-strip-types tests/zustandswerte-integration.mjs
import assert from 'node:assert/strict';

const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8852';
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
const raw=async c=>(await c.get(q)).text,snap=async c=>JSON.parse(await raw(c)).vitals;
const vitals=(c,body)=>c.post('/api/live-vitals',{sessionId,runId,...body});
async function op(c,characterId,command,expected=200){const r=await vitals(c,{characterId,command});assert.equal(r.status,expected,JSON.stringify(command)+': '+r.text);return r.status===200?JSON.parse(r.text):null;}
async function table(c,command,expected=200){const v=await snap(gm);const r=await vitals(c,{expectedVersion:v.version,table:command});assert.equal(r.status,expected,JSON.stringify(command)+': '+r.text);}

// Visibility: everybody sees exactly their own character; the SL sees the whole table.
const [gv,av,bv]=[await snap(gm),await snap(a),await snap(b)];
assert.ok(av.characters.length>=1&&av.characters.every(c=>c.own),'A sees only own characters');
assert.ok(bv.characters.length>=1&&bv.characters.every(c=>c.own),'B sees only own characters');
const ca=av.characters[0],cb=bv.characters[0];
assert.ok(gv.characters.some(c=>c.id===ca.id)&&gv.characters.some(c=>c.id===cb.id),'SL sees A and B');
assert.ok(!bv.characters.some(c=>c.id===ca.id),'B does not get A');
for(const v of [av,bv]){assert.equal(v.masquerade,undefined,'Masquerade hidden by default');assert.equal(v.settings,undefined);assert.equal(v.log,undefined);assert.equal(v.history,undefined);}
assert.ok(!(await raw(b)).includes(ca.id),'A\'s character id never reaches B');
assert.ok(gv.masquerade&&gv.settings&&Array.isArray(gv.log),'SL gets masquerade, settings and log');
console.log('PASS visibility: own character only, SL overview, masquerade and logs SL-only');

// Rights: in the recommended profile A books own blood and willpower, nothing else; never someone else's character.
const blood=ca.vitals.blood.current,will=ca.vitals.willpower.temporary;
assert.ok(blood>0&&will>0,'Fixture A has blood and willpower');
await op(a,ca.id,{op:'blood.spend',amount:1});await op(a,ca.id,{op:'willpower.spend'});
for(const command of [{op:'damage',type:'lethal',levels:1},{op:'blood.gain',amount:1},{op:'reset',target:'health'},{op:'set',blood:1},{op:'willpower.regain',amount:1}])await op(a,ca.id,command,403);
await op(a,cb.id,{op:'blood.spend',amount:1},404);await op(b,ca.id,{op:'blood.spend',amount:1},404);
await op(a,ca.id,{op:'blood.spend',amount:2},400);
await table(a,{op:'stress',delta:1},403);
assert.equal((await vitals(a,{group:'night'})).status,403,'Players cannot start a new night');
console.log('PASS rights: player books own spending only, server refuses damage, resets, foreign characters and group actions');

// Live distribution: the SL's next snapshot (the 750 ms poll) carries A's booking; a fresh session after reload too.
let g=(await snap(gm)).characters.find(c=>c.id===ca.id);assert.equal(g.vitals.blood.current,blood-1);assert.equal(g.vitals.willpower.temporary,will-1);
const a2=client(await login('command-a'));const reloaded=(await snap(a2)).characters.find(c=>c.id===ca.id);
assert.equal(reloaded.vitals.blood.current,blood-1,'Reload keeps the value');
console.log('PASS live update for SL and persistence across a new login');

// SL damage, healing and reset with V20 ordering.
await op(gm,ca.id,{op:'damage',type:'bashing',levels:1});await op(gm,ca.id,{op:'damage',type:'lethal',levels:2});
let seen=(await snap(a)).characters.find(c=>c.id===ca.id).vitals.health;
assert.deepEqual(seen.track,['lethal','lethal','bashing']);assert.equal(seen.level,'Schwer verletzt');assert.equal(seen.penalty,-1);
await op(a,ca.id,{op:'heal.blood'},403);
await table(gm,{op:'settings',profile:'offen'});
await op(a,ca.id,{op:'heal.blood'});seen=(await snap(a)).characters.find(c=>c.id===ca.id).vitals;
assert.deepEqual(seen.health.track,['lethal','lethal'],'Bashing is healed first');assert.equal(seen.blood.current,blood-2);
await table(gm,{op:'settings',profile:'sl'});await op(a,ca.id,{op:'blood.spend',amount:1},403);
await table(gm,{op:'settings',profile:'empfohlen'});
await op(gm,ca.id,{op:'reset',target:'health'});assert.deepEqual((await snap(a)).characters.find(c=>c.id===ca.id).vitals.health.track,[]);
console.log('PASS SL damage/heal/reset, profile switch enforced server-side');

// Group values: stress is shared with players, masquerade only after explicit release.
const stress=(await snap(gm)).stress.value;
await table(gm,{op:'stress',value:Math.min(10,stress+1)});
for(const c of [a,b])assert.equal((await snap(c)).stress.value,Math.min(10,stress+1),'Players see group stress');
await table(gm,{op:'stress',value:stress});
const masq=(await snap(gm)).masquerade.value;await table(gm,{op:'masquerade',value:masq===0?1:0});
for(const c of [a,b]){assert.equal((await snap(c)).masquerade,undefined);assert.ok(!(await raw(c)).includes('Maskerade-Stufe'),'No masquerade text reaches players');}
await table(gm,{op:'settings',masqueradeVisible:true});assert.equal((await snap(a)).masquerade.value,masq===0?1:0,'Released masquerade reaches players');
await table(gm,{op:'settings',masqueradeVisible:false});await table(gm,{op:'masquerade',value:masq});assert.equal((await snap(b)).masquerade,undefined);
const stale=(await snap(gm)).version-1;assert.equal((await vitals(gm,{expectedVersion:stale,table:{op:'stress',delta:1}})).status,409,'Stale group version refused');
assert.equal((await gm.post('/api/live-vitals',{sessionId,runId:crypto.randomUUID(),characterId:ca.id,command:{op:'blood.spend',amount:1}})).status,409,'Old run refused');
console.log('PASS group stress for all, masquerade SL-only until released, optimistic locking');

// Explicit release of one character to the round.
await table(gm,{op:'settings',share:{characterId:ca.id,shared:true}});
const shared=(await snap(b)).characters.find(c=>c.id===ca.id);assert.ok(shared&&!shared.own&&shared.shared,'B sees released A');
await op(b,ca.id,{op:'blood.spend',amount:1},404);
await table(gm,{op:'settings',share:{characterId:ca.id,shared:false}});assert.ok(!(await snap(b)).characters.some(c=>c.id===ca.id),'Withdrawn again');
console.log('PASS explicit release: B reads A read-only, withdrawal removes it');

// New night and audit trail.
const before=(await snap(gm)).characters.find(c=>c.id===ca.id).vitals.blood.current;
const night=JSON.parse((await vitals(gm,{group:'night'})).text);assert.match(night.message,/Erwachen −1 Blut/);
assert.equal((await snap(a)).characters.find(c=>c.id===ca.id).vitals.blood.current,before-1);
const history=(await snap(gm)).history;assert.ok(history.some(h=>h.character===ca.title&&/Spieler am Spieltisch/.test(h.text)),'Player booking in table history');
const engine=JSON.parse((await gm.get('/api/character-engine?id='+encodeURIComponent(ca.id))).text);
assert.ok(engine.history.some(h=>h.action==='vitals'&&h.changes?.blood),'Character history records the vitals change with before/after');
console.log('PASS new night for the table and character history with before/after values');

// Restore the fixture for the next manual run.
await op(gm,ca.id,{op:'reset',target:'blood'});await op(gm,ca.id,{op:'reset',target:'willpower'});
for(const c of (await snap(gm)).characters){const v=c.vitals;if(v.blood.current!==null&&v.blood.max!==null&&v.blood.current<v.blood.max)await op(gm,c.id,{op:'reset',target:'blood'});}
console.log('PASS zustandswerte integration complete');
