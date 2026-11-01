// Fixes from the live check of 31.10.2026 against a running isolated instance (scripts/start-material-3.ps1):
// file previews (thumbnails) and revalidation instead of no-store, and the stage image only from the running scene.
// Run: node --experimental-strip-types tests/live-befund-integration.mjs
import assert from 'node:assert/strict';

const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8893';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only local isolated instances are allowed.');
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'})});assert.equal(r.status,200,'login '+id);return r.headers.get('set-cookie').split(';')[0];}
const client=cookie=>({
 raw:(path,init={})=>fetch(base+path,{...init,headers:{Cookie:cookie,Origin:base,...(init.headers||{})}}),
 send:async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:JSON.stringify(body)});return {status:r.status,text:await r.text()};},
});
const gm=client(await login('command-gm')),a=client(await login('command-a'));
const pass=label=>console.log('PASS '+label);
const json=async r=>JSON.parse(await r.text());

// A minimal WebP container: the server only stores it next to the original after checking the RIFF/WEBP header.
const webp=new Uint8Array([...new TextEncoder().encode('RIFF'),36,0,0,0,...new TextEncoder().encode('WEBPVP8 '),...new Array(28).fill(0)]);
// A fresh SL image per run, so the preview starts out missing every time.
const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),c=>c.charCodeAt(0));
const form=new FormData();form.set('file',new File([png],'live-befund.png',{type:'image/png'}));form.set('visibility','sl');
const uploaded=await gm.raw('/api/files',{method:'POST',body:form});assert.equal(uploaded.status,200,'upload');
const image={id:(await json(uploaded)).id};
const {files}=await json(await gm.raw('/api/files'));

// 1. Originals and previews are revalidated (no-cache + ETag) instead of being downloaded again every time.
const original=await gm.raw('/api/files?id='+image.id);
assert.equal(original.status,200);assert.equal(original.headers.get('cache-control'),'private, no-cache');
const etag=original.headers.get('etag');assert.equal(etag,'"'+image.id+':o"');await original.arrayBuffer();
const again=await gm.raw('/api/files?id='+image.id,{headers:{'If-None-Match':etag}});
assert.equal(again.status,304,'unchanged file answers 304');
pass('files are revalidated with ETag, not re-sent');

// 2. Without a stored preview the thumb URL serves the original and says so; the access check still applies.
const missing=await gm.raw('/api/files?id='+image.id+'&size=thumb');
assert.equal(missing.status,200);assert.equal(missing.headers.get('x-cvk-thumb'),'missing');await missing.arrayBuffer();
assert.equal((await a.raw('/api/files?id='+image.id+'&size=thumb')).status,404,'players never read SL files, not even as preview');
pass('missing preview falls back to the original, access unchanged');

// 3. Only someone who may manage the file stores a preview, and only a real WebP.
assert.equal((await a.raw('/api/files?thumb='+image.id,{method:'POST',headers:{'Content-Type':'image/webp'},body:webp})).status,404,'players cannot set previews of SL files');
assert.equal((await gm.raw('/api/files?thumb='+image.id,{method:'POST',headers:{'Content-Type':'image/webp'},body:new TextEncoder().encode('<svg/>')})).status,400,'only WebP is accepted');
assert.equal((await gm.raw('/api/files?thumb='+image.id,{method:'POST',headers:{'Content-Type':'image/webp'},body:webp})).status,200);
const thumb=await gm.raw('/api/files?id='+image.id+'&size=thumb');
assert.equal(thumb.headers.get('content-type'),'image/webp');assert.equal(thumb.headers.get('etag'),'"'+image.id+':t"');
assert.equal((await thumb.arrayBuffer()).byteLength,webp.byteLength,'the stored preview is served');
assert.equal((await gm.raw('/api/files?id='+image.id+'&size=thumb',{headers:{'If-None-Match':'"'+image.id+':o"'}})).status,200,'an old cached original is replaced by the new preview');
pass('previews are stored by managers only and served small');

// 4. The stage image always comes from the running scene; other gallery images are refused.
const active=await json(await gm.raw('/api/live-table?view=active'));
const sessionId=active.room?.sessionId,runId=active.room?.runId;assert.ok(sessionId&&active.room.started,'Start the synthetic evening first.');
const q='/api/live-stage?sessionId='+encodeURIComponent(sessionId);
const snap=async()=>json(await gm.raw(q+'&catalog=1'));
async function stage(command){const s=await snap();return gm.send('/api/live-stage',{sessionId,runId,expectedVersion:s.version,command});}
let s=await snap();
if(!s.stageSceneId)assert.equal((await stage({action:'activateScene',sceneId:s.scenes.find(x=>x.title.includes('Kaserne')).id})).status,200);
s=await snap();
const sceneId=s.stageSceneId;assert.ok(sceneId,'a scene runs on the stage');
const ctx=await json(await gm.raw(q+'&regie='+encodeURIComponent(sceneId)));
const own=ctx.backdrop?.fileId;assert.ok(own,'the running scene has a Szenenbild');
const foreign=files.find(f=>f.mime.startsWith('image/')&&f.id!==own&&!JSON.stringify(ctx).includes(f.id));
assert.ok(foreign,'a gallery image outside the scene exists');
const refused=await stage({action:'backdrop',fileId:foreign.id});
assert.equal(refused.status,400,'foreign image refused: '+refused.text);assert.match(refused.text,/laufenden Szene/);
assert.equal((await stage({action:'backdrop',fileId:own})).status,200,'the scene image is allowed');
assert.equal((await stage({action:'backdrop',fileId:null})).status,200,'the default stage is allowed');
assert.equal((await stage({action:'backdrop',fileId:own})).status,200);
s=await snap();assert.equal(s.backdrop?.fileId,own);
pass('stage image only from the running scene');

console.log('Live-Befund integration: all checks passed.');
