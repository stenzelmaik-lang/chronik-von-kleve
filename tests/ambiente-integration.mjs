// Ambience playlist (YouTube) against a running isolated instance with a started evening (--ultio-pager, port 8881).
// Three synthetic sessions (SL, Spieler A, Spieler B): the scene playlist starts with the scene, only the SL controls,
// players get only the play state. No YouTube request is made: only video ids are stored and sent.
// Run: node --experimental-strip-types tests/ambiente-integration.mjs
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
const snap=async c=>JSON.parse((await c.get(q+(c===gm?'&catalog=1':''))).text);
async function stage(c,command,expected=200){const s=await snap(gm);const r=await c.post('/api/live-stage',{sessionId,runId,expectedVersion:s.version,command});assert.equal(r.status,expected,command.action+': '+r.text);return r.status===200?JSON.parse(r.text):null;}

// Prepare the first scene's playlist in the Command Center (two tracks, in order).
const scenes=(await snap(gm)).scenes,[first,second]=scenes;assert.ok(first&&second,'Fixture has two evening scenes');
const loaded=JSON.parse((await gm.get('/api/command-center/scenes?id='+encodeURIComponent(first.id))).text);
const original=loaded.scene.document.youtube;
const playlist=[{id:crypto.randomUUID(),title:'Ambiente-Beispiel',videoId:'l8GAZU4eY7g'},{id:crypto.randomUUID(),title:'Zweiter Titel',videoId:'dQw4w9WgXcQ'}];
const save=await gm.post('/api/command-center/scenes',{action:'save',id:first.id,version:loaded.scene.version,document:{...loaded.scene.document,youtube:playlist}});
assert.equal(save.status,200,save.text);
assert.equal((await a.get('/api/command-center/scenes?id='+encodeURIComponent(first.id))).status>=400,true,'Players never read the prepared scene');
const context=JSON.parse((await gm.get(q+'&regie='+encodeURIComponent(first.id))).text);
assert.deepEqual(context.youtube.map(t=>t.videoId),['l8GAZU4eY7g','dQw4w9WgXcQ']);
console.log('PASS scene playlist prepared in order; GM-only');

// Starting the scene starts its playlist for everyone.
await stage(gm,{action:'stopMusic'});
await stage(gm,{action:'activateScene',sceneId:first.id});
for(const p of [gm,a,b]){const y=(await snap(p)).youtube;assert.equal(y.videoId,'l8GAZU4eY7g');assert.equal(y.tracks.length,2);assert.equal(y.playing,true);assert.equal(y.volume,25);}
for(const p of [a,b]){const y=(await snap(p)).youtube;assert.equal('sceneId' in y,false,'Players get only the play state');}
const startKey=(await snap(a)).youtube.key;
console.log('PASS scene start plays its playlist for SL, A and B');

// Only the GM controls.
for(const p of [a,b])for(const c of [{action:'youtubeControl',op:'pause'},{action:'youtubeControl',op:'volume',volume:90},{action:'youtubeList',tracks:[{video:'dQw4w9WgXcQ'}]},{action:'youtube',video:null},{action:'stopMusic'}])await stage(p,c,403);
await stage(gm,{action:'youtubeControl',op:'pause'});for(const p of [a,b])assert.equal((await snap(p)).youtube.playing,false);
await stage(gm,{action:'youtubeControl',op:'play'});
await stage(gm,{action:'youtubeControl',op:'next'});let y=(await snap(a)).youtube;assert.equal(y.index,1);assert.equal(y.videoId,'dQw4w9WgXcQ');assert.notEqual(y.key,startKey);
await stage(gm,{action:'youtubeControl',op:'select',index:0});assert.equal((await snap(b)).youtube.index,0);
await stage(gm,{action:'youtubeControl',op:'volume',volume:40});for(const p of [a,b])assert.equal((await snap(p)).youtube.volume,40);
await stage(gm,{action:'youtubeList',tracks:[{video:'https://www.youtube.com/watch?v=l8GAZU4eY7g',title:'Wald'}],label:'Wald'});
y=(await snap(b)).youtube;assert.equal(y.label,'Wald');assert.equal(y.volume,40,'Base volume stays with a new playlist');
await stage(gm,{action:'youtubeList',tracks:[{video:'https://example.com/watch?v=l8GAZU4eY7g'}]},400);
console.log('PASS only the SL plays, pauses, skips, selects, sets the base volume and switches playlists');

const file=(await snap(gm)).catalog.find(item=>item.sourceKind==='file'&&item.mime?.startsWith('audio/'));
assert.ok(file,'Fixture has a local audio file');
async function expectSilence(){
 for(const p of [gm,a,b]){
  const {music,youtube}=await snap(p);
  assert.equal(music,null);
  assert.equal(youtube,null);
 }
 assert.equal((await a.get(q.replace('/api/live-stage?','/api/live-stage/asset?')+'&objectId=music')).status,404);
}
await stage(gm,{action:'music',fileId:file.id});
assert.ok((await snap(a)).music&& (await snap(a)).youtube,'Both music sources are running');
await stage(gm,{action:'activateScene',sceneId:second.id});
await expectSilence();
console.log('PASS a scene without music clears both music sources for everyone');

await stage(gm,{action:'music',fileId:file.id});
await stage(gm,{action:'youtube',video:'dQw4w9WgXcQ'});
await stage(gm,{action:'activateScene',sceneId:first.id});
for(const p of [gm,a,b]){
 const {music,youtube}=await snap(p);
 assert.equal(music,null,'File music from the prior scene is gone');
 assert.equal(youtube.videoId,'l8GAZU4eY7g','Only the new scene playlist starts');
}
await stage(gm,{action:'music',fileId:file.id});
await stage(gm,{action:'stopMusic'});
await expectSilence();
console.log('PASS the next scene starts only its own playlist; quick stop clears both sources');

// Restore the scene's original playlist.
const now=JSON.parse((await gm.get('/api/command-center/scenes?id='+encodeURIComponent(first.id))).text);const doc={...now.scene.document};if(original)doc.youtube=original;else delete doc.youtube;
assert.equal((await gm.post('/api/command-center/scenes',{action:'save',id:first.id,version:now.scene.version,document:doc})).status,200);
console.log('ALL PASS: Ambiente-Playlist – scene start, SL-only control, play state for players');
