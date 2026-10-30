// Spieltisch 2.0 role separation against a running isolated --spieltisch-2 instance.
// Uses three independent synthetic sessions (SL, Spieler A, Spieler B); never production.
// Run: node --experimental-strip-types tests/spieltisch-regie-integration.mjs
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8830';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only local isolated instances are allowed.');
const password='ChroniPlay-Demo-2036!';
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password})});assert.equal(r.status,200,'login '+id);return r.headers.get('set-cookie').split(';')[0];}
const client=cookie=>({
 get:async path=>{const r=await fetch(base+path,{headers:{Cookie:cookie}});return {status:r.status,text:await r.text()};},
 post:async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:JSON.stringify(body)});return {status:r.status,text:await r.text()};},
});
const gm=client(await login('command-gm')),a=client(await login('command-a')),b=client(await login('command-b'));
const json=r=>JSON.parse(r.text);

// The running evening, as the GM's own client sees it.
const active=json(await gm.get('/api/live-table?view=active'));
const sessionId=active.room?.sessionId;assert.ok(sessionId&&active.room.open&&active.room.started,'Start the synthetic evening first.');
const q='/api/live-stage?sessionId='+encodeURIComponent(sessionId);
const gmStage=json(await gm.get(q+'&catalog=1'));
const titles=gmStage.scenes.map(s=>s.title);
assert.deepEqual(titles,['Szene 01 – Spielort Kaserne (Auftakt)','Szene 02 – Der Keller'],'Live-Regie lists only the evening scenes in planned order');
assert.ok(gmStage.moreScenes.some(s=>s.title==='Technische Prüfung Hauptszene')&&gmStage.moreScenes.some(s=>s.title==='Neue Szene'),'Foreign scenes stay available separately');
const barracks=gmStage.scenes[0].id;
console.log('PASS scene scope: evening scenes ordered, test scenes separated');

// Private direction context: GM only.
const regie=await gm.get(q+'&regie='+encodeURIComponent(barracks));
assert.equal(regie.status,200);const context=json(regie);
assert.ok(context.scene.secrets.length&&context.npcs.some(n=>n.title==='Herr Schäfer')&&context.media.length>=2,'Regie carries secrets, NPC and media');
for(const [name,player] of [['A',a],['B',b]]){
 const denied=await player.get(q+'&regie='+encodeURIComponent(barracks));
 assert.ok([403,404].includes(denied.status),'Player '+name+' cannot read Regie ('+denied.status+')');
 assert.ok(!denied.text.includes('SL_PRIVATE'),'Denial leaks nothing');
}
console.log('PASS regie: GM reads private context, players are refused without content');

// Player snapshots never carry scene catalogs or private text.
for(const [name,player] of [['A',a],['B',b]]){
 const r=await player.get(q+'&catalog=1');assert.equal(r.status,200);const s=json(r);
 assert.equal(s.scenes.length,0,'Player '+name+' receives no scene list');assert.equal((s.moreScenes||[]).length,0);assert.equal(s.catalog.length,0);
 assert.ok(!r.text.includes('SL_PRIVATE')&&!r.text.includes('Technische Prüfung'),'Player '+name+' snapshot has no private text');
}
console.log('PASS player snapshot: no scene catalog, no private text');

// Test 8: deliberate release to Spieler A only.
const image=context.media.find(m=>m.mime.startsWith('image/'));
const eventId=randomUUID();
const shown=await gm.post('/api/live-table',{action:'showMedia',sessionId,runId:active.room.runId,eventId,fileIds:[image.fileId],audience:{scope:'players',playerIds:['command-a']}});
assert.equal(shown.status,200,shown.text);
const mediaUrl='/api/live-table/media?sessionId='+encodeURIComponent(sessionId)+'&eventId='+eventId+'&fileId='+image.fileId;
const aStage=json(await a.get(q)),bStage=json(await b.get(q));
assert.equal(aStage.media?.id,eventId,'Spieler A sees the targeted release');
assert.notEqual(bStage.media?.id,eventId,'Spieler B does not see it');
assert.equal((await a.get(mediaUrl)).status,200,'Spieler A can open the image');
assert.equal((await b.get(mediaUrl)).status,404,'Spieler B cannot fetch it directly');
assert.equal((await b.get('/api/files?id='+encodeURIComponent(image.fileId))).status,404,'The SL original file stays private');
console.log('PASS targeted release: only Spieler A can view; direct fetch by B refused');

// Test 7/10: group release survives a fresh read (reload / reconnect).
const groupEvent=randomUUID();
assert.equal((await gm.post('/api/live-table',{action:'showMedia',sessionId,runId:active.room.runId,eventId:groupEvent,fileIds:[image.fileId],audience:{scope:'all'}})).status,200);
for(const [name,player] of [['A',a],['B',b]]){const again=json(await player.get(q));assert.equal(again.media?.id,groupEvent,'Player '+name+' sees the shared image after reload');assert.equal(again.runId,active.room.runId);}
console.log('PASS group release and state recovery after reload');

// Hide uses the same live-event flag as media, never edits the prepared scene.
const original=json(await gm.get('/api/command-center/scenes?id='+barracks));
const originalSecond=json(await gm.get('/api/command-center/scenes?id='+gmStage.scenes[1].id));
const publish=async(scene,audience={scope:'all'})=>{
 const eventId=randomUUID();
 const result=await gm.post('/api/live-table',{action:'showScene',sessionId,runId:active.room.runId,eventId,sceneId:scene.id,sceneVersion:scene.version,audience});
 assert.equal(result.status,200,result.text);return eventId;
};
const remove=eventId=>gm.post('/api/live-table',{action:'hideScene',sessionId,runId:active.room.runId,eventId});
const published=await publish(gmStage.scenes[0]);
for(const player of [a,b])assert.equal(json(await player.get(q)).sceneEventId,published);
assert.equal((await a.post('/api/live-table',{action:'hideScene',sessionId,runId:active.room.runId,eventId:published})).status,403);
assert.equal((await gm.post('/api/live-table',{action:'hideScene',sessionId,runId:randomUUID(),eventId:published})).status,409);
assert.equal((await remove(groupEvent)).status,409,'A media event cannot clear narration');
assert.equal((await remove(published)).status,200);
for(const viewer of [gm,a,b]){const hidden=json(await viewer.get(q));assert.equal(hidden.sceneInfo,undefined);assert.equal(hidden.sceneEventId,undefined);assert.equal(hidden.media.id,groupEvent,'Removing narration leaves media alone');}
assert.equal((await remove(published)).status,200,'Repeated removal is harmless');
console.log('PASS narration removal reaches all viewers; players and wrong/stale commands denied');

const again=await publish(gmStage.scenes[0]);assert.notEqual(again,published);
for(const player of [a,b])assert.equal(json(await player.get(q)).sceneEventId,again);
const onlyA=await publish(gmStage.scenes[0],{scope:'players',playerIds:['command-a']});
const onlyB=await publish(gmStage.scenes[1],{scope:'players',playerIds:['command-b']});
assert.equal(json(await a.get(q)).sceneEventId,onlyA);assert.equal(json(await b.get(q)).sceneEventId,onlyB);
assert.equal((await remove(onlyA)).status,409,'A stale close must not remove a newer release');
assert.equal(json(await b.get(q)).sceneEventId,onlyB);
assert.equal((await remove(onlyB)).status,200);
for(const player of [a,b])assert.equal(json(await player.get(q)).sceneInfo,undefined,'All old targeted releases are cleared as well');
assert.deepEqual(json(await gm.get('/api/command-center/scenes?id='+barracks)),original);
assert.deepEqual(json(await gm.get('/api/command-center/scenes?id='+gmStage.scenes[1].id)),originalSecond);
console.log('PASS re-publication, global clearing of different audiences and unchanged original scenes');
console.log('ALL PASS: Spieltisch 2.0 role separation');
