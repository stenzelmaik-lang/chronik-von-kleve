// Spieltisch 2.0 media workflow against a running isolated --spieltisch-2 instance with a started evening.
// Three independent synthetic sessions (SL, Spieler A, Spieler B). Checks real file access, not only rendering.
// Run: node --experimental-strip-types tests/spieltisch-medien-integration.mjs
import assert from 'node:assert/strict';

const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8830';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only local isolated instances are allowed.');
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'})});assert.equal(r.status,200,'login '+id);return r.headers.get('set-cookie').split(';')[0];}
const client=cookie=>({
 get:async(path,headers={})=>{const r=await fetch(base+path,{headers:{Cookie:cookie,...headers}});const type=r.headers.get('content-type')||'';const body=type.includes('json')?await r.text():(await r.arrayBuffer(),'');return {status:r.status,type,text:body};},
 post:async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:JSON.stringify(body)});return {status:r.status,text:await r.text()};},
});
const gm=client(await login('command-gm')),a=client(await login('command-a')),b=client(await login('command-b'));
const active=JSON.parse((await gm.get('/api/live-table?view=active')).text);
const sessionId=active.room?.sessionId,runId=active.room?.runId;assert.ok(sessionId&&active.room.started,'Start the synthetic evening first.');
const q='/api/live-stage?sessionId='+encodeURIComponent(sessionId),asset=id=>q.replace('/api/live-stage?','/api/live-stage/asset?')+'&objectId='+encodeURIComponent(id);
const snap=async c=>JSON.parse((await c.get(q+'&catalog=1')).text);
async function stage(command,expected=200){const s=await snap(gm);const r=await gm.post('/api/live-stage',{sessionId,runId,expectedVersion:s.version,command});assert.equal(r.status,expected,command.action+': '+r.text);return r.status===200?JSON.parse(r.text):null;}

const scenes=(await snap(gm)).scenes,[barracks,cellar]=scenes;
const regie=JSON.parse((await gm.get(q+'&regie='+encodeURIComponent(barracks.id))).text);
assert.ok(regie.backdrop,'Scene backdrop is part of the private direction context');
const photo=regie.media.find(m=>m.mime.startsWith('image/')),audio=regie.media.find(m=>m.mime.startsWith('audio/')),pdf=regie.media.find(m=>m.mime==='application/pdf'),video=regie.media.find(m=>m.mime.startsWith('video/'));
assert.ok(photo&&audio&&pdf,'Synthetic scene has photo, audio and PDF material');

// Players can never direct the table.
for(const command of [{action:'backdrop',fileId:regie.backdrop.fileId},{action:'activateScene',sceneId:barracks.id},{action:'add',kind:'document',sourceId:photo.fileId,sourceKind:'file'}]){
 const s=await snap(a);const r=await a.post('/api/live-stage',{sessionId,runId,expectedVersion:s.version,command});
 assert.equal(r.status,403,'Player refused: '+command.action);
}
console.log('PASS players cannot set backdrops, activate scenes or place material');

// Tests 1–3: scene activation sets the backdrop for everybody; reset returns to the default stage.
await stage({action:'activateScene',sceneId:barracks.id});
for(const [name,p] of [['A',a],['B',b]]){const s=await snap(p);assert.ok(s.backdrop,'Player '+name+' sees a backdrop');assert.equal((await p.get(asset('backdrop'))).status,200,'Player '+name+' loads the backdrop image');}
await stage({action:'backdrop',fileId:null});
for(const p of [a,b]){assert.equal((await snap(p)).backdrop,null);assert.equal((await p.get(asset('backdrop'))).status,404,'No backdrop file after reset');}
await stage({action:'backdrop',fileId:regie.backdrop.fileId});
console.log('PASS backdrop: activation, visible to A and B, reset to default stage');

// Tests 4–6 and 10: a polaroid released to Spieler A only; B can neither see nor fetch it; removal is shared.
await stage({action:'add',kind:'document',sourceId:photo.fileId,sourceKind:'file',title:photo.title,visible:true,recipients:['command-a']});
const card=(await snap(gm)).objects.find(o=>o.sourceId===photo.fileId);
assert.equal(card.media,'image');assert.equal(card.title,photo.title,'Prepared title is used on the table');
assert.ok((await snap(a)).objects.some(o=>o.id===card.id),'A has the polaroid');
assert.ok(!(await snap(b)).objects.some(o=>o.id===card.id),'B does not get the polaroid');
assert.equal((await a.get(asset(card.id))).status,200,'A can open the photo');
assert.equal((await b.get(asset(card.id))).status,404,'B cannot fetch the photo by object id');
for(const p of [a,b])assert.equal((await p.get('/api/files?id='+encodeURIComponent(photo.fileId))).status,404,'The private SL original stays unreachable');
await stage({action:'remove',id:card.id});
assert.ok(!(await snap(a)).objects.some(o=>o.id===card.id),'Removal reaches A');
assert.equal((await a.get(asset(card.id))).status,404,'Removed photo can no longer be fetched');
console.log('PASS polaroid: targeted to A, hidden from B, removal shared and enforced');

// Tests 7–9: audio, PDF and video for the whole round. Audio supports range requests for seeking.
const placed={};
for(const m of [audio,pdf,video].filter(Boolean)){await stage({action:'add',kind:'document',sourceId:m.fileId,sourceKind:'file',title:m.title,visible:true,recipients:null});placed[m.mime]=(await snap(gm)).objects.find(o=>o.sourceId===m.fileId);}
const tape=placed[audio.mime];assert.equal(tape.media,'audio');
for(const [name,p] of [['A',a],['B',b]]){
 const r=await p.get(asset(tape.id),{Range:'bytes=0-99'});assert.equal(r.status,206,'Player '+name+' streams the recording');assert.match(r.type,/^audio\//);
 assert.equal((await p.get(asset(placed[pdf.mime].id))).status,200,'Player '+name+' opens the handout');
 if(video)assert.equal((await p.get(asset(placed[video.mime].id),{Range:'bytes=0-99'})).status,206,'Player '+name+' streams the video');
}
console.log('PASS audio, handout'+(video?' and video':'')+' released to the round'+(video?'':' (no video in fixture – prepared in the browser)'));

// A scene change clears the previous visual material and keeps released audio.
const removed=(await snap(gm)).objects.filter(o=>o.kind!=='note'&&o.media!=='audio').map(o=>o.id);
await stage({action:'activateScene',sceneId:cellar.id});
const after=await snap(a);
assert.deepEqual(after.objects.filter(o=>o.kind!=='note').map(o=>o.id),[tape.id],'Only the released track remains from the previous scene');
for(const id of removed)assert.equal((await a.get(asset(id))).status,404,'Previous visual material is no longer reachable');
assert.ok(after.backdrop&&after.backdrop.title.includes('Keller'),'Backdrop switched to the cellar');
assert.deepEqual(JSON.parse(JSON.stringify(await snap(a))).backdrop,after.backdrop);
console.log('PASS scene change clears old visual material; reload restores the allowed state');

for(const p of [a,b])assert.equal((await p.get(asset(tape.id),{Range:'bytes=0-99'})).status,206,'The released track remains playable across scenes');
const current=await snap(a);
assert.equal((await a.post('/api/live-stage',{sessionId,runId,expectedVersion:current.version,command:{action:'withdrawAudio'}})).status,403);
await stage({action:'withdrawAudio'});
for(const p of [a,b]){
 assert.ok(!(await snap(p)).objects.some(o=>o.id===tape.id),'Withdrawing audio removes it from the player projection');
 assert.equal((await p.get(asset(tape.id))).status,404,'The withdrawn track can no longer be fetched');
}
console.log('PASS audio persists across scenes and only the SL can withdraw it');

// Regression: private direction stays GM-only.
assert.ok([403,404].includes((await a.get(q+'&regie='+encodeURIComponent(barracks.id))).status));
await stage({action:'activateScene',sceneId:barracks.id});
console.log('ALL PASS: Spieltisch 2.0 media workflow and permissions');
