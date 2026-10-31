// Zustandswerte der Runde (Regie-Nachbesserung) against a running isolated instance with a started evening.
// Three synthetic sessions (SL, Spieler A, Spieler B): round visibility setting, own control, foreign control (403),
// damage mode, live update and that nothing beyond blood, willpower and damage reaches other players.
// Run: node --experimental-strip-types tests/zustandswerte-runde-integration.mjs
import assert from 'node:assert/strict';

const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8881';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only local isolated instances are allowed.');
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'})});assert.equal(r.status,200,'login '+id);return r.headers.get('set-cookie').split(';')[0];}
const client=cookie=>({
 get:async(path)=>{const r=await fetch(base+path,{headers:{Cookie:cookie}});return {status:r.status,text:await r.text()};},
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

await table(gm,{op:'settings',roundView:'all',damageBy:'player',profile:'empfohlen'});
const [gv,av,bv]=[await snap(gm),await snap(a),await snap(b)];
const ca=av.characters.find(c=>c.own),cb=bv.characters.find(c=>c.own);assert.ok(ca&&cb,'A and B have characters');
if(ca.vitals.health.track.length)await op(gm,ca.id,{op:'reset',target:'health'});

// Visibility „für alle“: everyone gets the round with blood, willpower and damage only.
for(const [name,v] of [['SL',gv],['A',av],['B',bv]]){
 assert.equal(v.roundView,'all');assert.ok(v.round.some(r=>r.id===ca.id)&&v.round.some(r=>r.id===cb.id),name+' sees A and B in the round');
 for(const r of v.round)assert.deepEqual(Object.keys(r).sort(),['blood','health','id','own','ownerId','ownerName','title','willpower'],name+': round entries carry nothing else');
}
assert.ok(!bv.characters.some(c=>c.id===ca.id),'The full condition sheet of A stays private to A and the SL');
const bRaw=await raw(b);for(const secret of ['generation','perTurn'])assert.ok(!JSON.stringify(JSON.parse(bRaw).vitals.round).includes(secret),'No '+secret+' of others');
console.log('PASS round visible for all: only blood, willpower and damage of others');

// Own control vs. foreign control.
const blood=(await snap(b)).round.find(r=>r.id===ca.id).blood.current;
await op(a,ca.id,{op:'blood.spend',amount:1});
assert.equal((await snap(b)).round.find(r=>r.id===ca.id).blood.current,blood-1,'B sees A\'s blood live');
await op(b,ca.id,{op:'blood.spend',amount:1},403);await op(b,ca.id,{op:'damage',type:'lethal',levels:1},403);
await op(a,cb.id,{op:'willpower.spend'},403);
await table(a,{op:'settings',roundView:'shared'},403);
console.log('PASS own values self-controlled; foreign control refused with 403; settings SL-only');

// Damage mode „Spieler trägt selbst ein“ (default): A enters own damage, everyone sees the level; SL corrects.
await op(a,ca.id,{op:'damage',type:'lethal',levels:1});
for(const p of [gm,b])assert.equal((await snap(p)).round.find(r=>r.id===ca.id).health.track.length,1,'Damage visible to all');
assert.ok(av.operations.includes('damage'),'Players are offered damage in this mode');
await op(a,ca.id,{op:'heal',levels:1},403);await op(gm,ca.id,{op:'heal',levels:1});
// „Nur SL“: players can no longer enter damage, the SL still can.
await table(gm,{op:'settings',damageBy:'sl'});
assert.ok(!(await snap(a)).operations.includes('damage'));await op(a,ca.id,{op:'damage',type:'bashing',levels:1},403);
await op(gm,ca.id,{op:'damage',type:'bashing',levels:1});assert.equal((await snap(b)).round.find(r=>r.id===ca.id).health.track[0],'bashing');
await op(gm,ca.id,{op:'reset',target:'health'});
console.log('PASS damage mode switchable: player enters own damage or SL only; SL always corrects');

// Visibility „nur eigene/freigegebene“: B no longer receives A at all.
await table(gm,{op:'settings',roundView:'shared'});
assert.ok(!(await raw(b)).includes(ca.id),'Not visible means not sent');
await op(b,ca.id,{op:'blood.spend',amount:1},404);
await table(gm,{op:'settings',roundView:'all',damageBy:'player'});
await op(gm,ca.id,{op:'reset',target:'blood'});
console.log('ALL PASS: Zustandswerte der Runde – visibility setting, own control, 403, damage mode, live update');
