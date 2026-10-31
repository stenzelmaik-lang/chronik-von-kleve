import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {sceneWhisperSchema} from '../domain/story-scene.ts';
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8890';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Synthetic local instances only');
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
const gm=await login('command-gm'),a=await login('command-a'),b=await login('command-b');
async function req(path,cookie,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json',Origin:base}:{})},...(body?{body:JSON.stringify(body)}:{})});const type=r.headers.get('content-type')||'';return {status:r.status,type,data:type.includes('json')?await r.json():null};}
const room=(await req('/api/live-table?view=active',gm)).data.room,{sessionId,runId}=room;
const url='/api/live-stage?sessionId='+encodeURIComponent(sessionId),snap=async who=>(await req(url,who)).data;
const catalog=(await req(url+'&catalog=1',gm)).data,sceneId=catalog.scenes[0].id;
let scene=(await req('/api/command-center/scenes?id='+sceneId,gm)).data.scene;
const image=catalog.catalog.find(f=>f.sourceKind==='file'&&f.mime?.startsWith('image/')).id;
const images=catalog.catalog.filter(f=>f.sourceKind==='file'&&f.mime?.startsWith('image/')).slice(0,2).map(f=>f.id);
const first={id:crypto.randomUUID(),kind:'vision',title:'Vision nur A',text:'cvk-html-v1:<h2>Ein ferner Gedanke</h2><p>SECRET_A_VISION</p>',recipientIds:['command-a'],fileIds:images};
const second={id:crypto.randomUUID(),kind:'letter',title:'Brief nur A',text:'cvk-html-v1:<p>SECRET_A_LETTER</p>',recipientIds:['command-a'],fileIds:[]};
const third={id:crypto.randomUUID(),kind:'vision',title:'Vision nur B',text:'SECRET_B_VISION',recipientIds:['command-b'],fileIds:[]};
async function save(document,expected=200){const r=await req('/api/command-center/scenes',gm,{action:'save',id:sceneId,version:scene.version,document});assert.equal(r.status,expected,JSON.stringify(r.data));if(expected===200)scene=r.data.scene;}
await save({...scene.document,whispers:[first,second,third]});
assert.deepEqual((await req('/api/command-center/scenes?id='+sceneId,gm)).data.scene.document.whispers,[first,second,third].map(w=>sceneWhisperSchema.parse(w)));
await save({...scene.document,whispers:[{...first,recipientIds:['no-such-player']}]},400);
await save({...scene.document,whispers:[{...first,fileIds:[catalog.catalog.find(f=>f.mime==='application/pdf').id]}]},400);
assert.equal((await req('/api/command-center/scenes?id='+sceneId,a)).status,403);
async function command(who,command,expected=200){const state=await snap(who),r=await req('/api/live-stage',who,{sessionId,runId,expectedVersion:state.version,command});assert.equal(r.status,expected,JSON.stringify(r.data));return r.data;}
const source=w=>'scene-whisper:'+sceneId+':'+w.id;
const play=w=>({action:'add',kind:'document',sourceKind:'record',sourceId:source(w),sourceVersion:scene.version});
// Reset only this synthetic run's personal-delivery objects; other table objects and preparation survive.
for(const o of (await snap(gm)).objects.filter(o=>o.presentation))await command(gm,{action:'remove',id:o.id});
await command(a,play(first),403);await command(b,play(first),403);
await command(gm,{...play(first),sourceVersion:scene.version-1},409);
await command(gm,{...play(first),recipients:['command-b']}); // Prepared target wins, never this browser override.
await command(gm,play(second));await command(gm,play(third));
const viewA=await snap(a),viewB=await snap(b),viewG=await snap(gm);
assert.ok(JSON.stringify(viewA).includes('SECRET_A_VISION'));assert.ok(JSON.stringify(viewA).includes('SECRET_A_LETTER'));assert.ok(!JSON.stringify(viewA).includes('SECRET_B_VISION'));
assert.ok(JSON.stringify(viewB).includes('SECRET_B_VISION'));assert.ok(!JSON.stringify(viewB).includes('SECRET_A_'));
const objectA=viewA.objects.find(o=>o.sourceId===source(first)),letter=viewA.objects.find(o=>o.sourceId===source(second));
assert.equal(objectA.presentation,'vision');assert.equal(letter.presentation,'letter');assert.equal(viewG.objects.filter(o=>o.presentation).length,3);
const asset=id=>'/api/live-stage/asset?sessionId='+sessionId+'&objectId='+id;
assert.equal((await req(asset(objectA.id)+'&page=0',a)).status,200);
assert.equal((await req(asset(objectA.id)+'&page=0',b)).status,404);
assert.equal((await req(asset(objectA.id),undefined)).status,401);
assert.equal((await req('/api/files?id='+image,a)).status,404);
await command(gm,{action:'visibility',id:objectA.id,visible:true,recipients:null},400);
await command(a,{action:'remove',id:objectA.id},403);
await command(gm,{action:'remove',id:letter.id});assert.ok(!(await snap(a)).objects.some(o=>o.id===letter.id));
assert.ok((await req('/api/command-center/scenes?id='+sceneId,gm)).data.scene.document.whispers.some(w=>w.id===second.id));
await command(gm,play(second));
mkdirSync('.local-work/whispers',{recursive:true});writeFileSync('.local-work/whispers/fixture.json',JSON.stringify({base,sessionId,runId,sceneId,version:scene.version,image,first,second,third},null,2));
console.log('PASS: preparation/reload, multiple entries per player, invalid recipients/media, SL-only delivery, source version, authoritative audience, secret snapshots/assets, withdrawal, preserved originals and replay.');
