// Spielmaterial 3.0 against a running isolated instance with a started evening (scripts/start-material-3.ps1).
// Three synthetic sessions (SL, Spieler A, Spieler B): display assets, scene materials in the Regie, laying on the
// table, targeted release, withdrawal, asset routes, effect fallbacks, pager isolation, backdrop transition, legacy
// material, validation and usage guards. Run: node --experimental-strip-types tests/material-3-integration.mjs
import assert from 'node:assert/strict';

const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8893';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only local isolated instances are allowed.');
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'})});assert.equal(r.status,200,'login '+id);return r.headers.get('set-cookie').split(';')[0];}
const client=cookie=>({
 get:async(path)=>{const r=await fetch(base+path,{headers:{Cookie:cookie},redirect:'manual'});const type=r.headers.get('content-type')||'';const text=type.includes('json')||type.includes('html')?await r.text():(await r.arrayBuffer(),'');return {status:r.status,type,text};},
 send:async(path,body,method='POST')=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:JSON.stringify(body)});return {status:r.status,text:await r.text()};},
});
const gm=client(await login('command-gm')),a=client(await login('command-a')),b=client(await login('command-b'));
const pass=label=>console.log('PASS '+label);
const active=JSON.parse((await gm.get('/api/live-table?view=active')).text);
const sessionId=active.room?.sessionId,runId=active.room?.runId;assert.ok(sessionId&&active.room.started,'Start the synthetic evening first.');
const q='/api/live-stage?sessionId='+encodeURIComponent(sessionId),asset=(id,extra='')=>q.replace('/api/live-stage?','/api/live-stage/asset?')+'&objectId='+encodeURIComponent(id)+extra;
const snap=async c=>JSON.parse((await c.get(q+'&catalog=1')).text);
async function stage(c,command,expected=200){const s=await snap(c);const r=await c.send('/api/live-stage',{sessionId,runId,expectedVersion:s.version,command});assert.equal(r.status,expected,command.action+': '+r.text);return r.status===200?JSON.parse(r.text):null;}
const scenes=(await snap(gm)).scenes;
const kaserne=scenes.find(s=>s.title.includes('Kaserne')).id,keller=scenes.find(s=>s.title.includes('Keller')).id;
const regie=async id=>JSON.parse((await gm.get(q+'&regie='+encodeURIComponent(id))).text);

// 1. Display assets are GM records; players can neither list nor create them.
const {assets}=JSON.parse((await gm.get('/api/display-assets')).text);
assert.ok(assets.length>=6,'synthetic assets present');
const envelope=assets.find(x=>x.title.startsWith('Paketumschlag')),folder=assets.find(x=>x.title.startsWith('Geheimakte'));
assert.deepEqual(envelope.states.map(s=>s.key).sort(),['closed','open']);
assert.equal((await a.get('/api/display-assets')).status,403,'players get no asset list');
assert.equal((await a.send('/api/display-assets',{asset:{title:'x',kind:'envelope',states:[{key:'closed',label:'',fileId:envelope.states[0].fileId}],tags:[]}})).status,403);
pass('display assets are GM only');

// 2. The Regie lists each material as one object with files, asset and effect; legacy media stay in their blocks.
const ctx=await regie(kaserne);
const byTitle=t=>ctx.materials.find(m=>m.title===t);
const anselmus=byTitle('Anselmus-Paket'),letter=byTitle('Brief an Anselmus'),single=byTitle('Foto: Brücke im Nebel'),audio=byTitle('Tonband: Verhör'),video=byTitle('Überwachungsband'),backdrop=byTitle('Hafen bei Nacht'),missing=byTitle('Verschollener Umschlag');
assert.ok(anselmus&&letter&&single&&audio&&video&&backdrop&&missing,'all materials listed');
assert.equal(ctx.materials.some(m=>m.type==='pager'),false,'pager materials stay in the pager block');
assert.equal(anselmus.files.length,6);assert.deepEqual(anselmus.files.map(f=>f.title),['Foto 1','Foto 2','Foto 3','Foto 4','Foto 5','Foto 6'],'fixed order');
assert.equal(anselmus.effective,'unseal');assert.equal(anselmus.problem,'');
assert.equal(missing.assetMissing,true);assert.equal(missing.effective,'fade','missing asset falls back');assert.match(missing.problem,/Entsiegeln/);
assert.ok(ctx.media.some(m=>m.title==='Fundfoto: Silas am Tor'),'legacy single images still listed');
assert.equal(ctx.media.some(m=>m.title==='Anselmus-Paket'),false,'materials are not duplicated in legacy blocks');
pass('Regie context lists materials as single objects');

// 7. The same envelope asset in two materials, the image stored once.
assert.equal(anselmus.asset.title,letter.asset.title);
assert.deepEqual(anselmus.asset.states,letter.asset.states,'both reference the same state files');
const files=JSON.parse((await gm.get('/api/files')).text).files;
assert.equal(files.filter(f=>f.name==='Asset – Paketumschlag geschlossen.png').length,1,'no file duplicate');
pass('one envelope asset reused by two materials without a file copy');

// 3./8. Lay on the table (GM only), release to Player A only, then withdraw.
await stage(a,{action:'add',kind:'document',sourceId:anselmus.id,sourceKind:'record'},403);
await stage(gm,{action:'add',kind:'document',sourceId:anselmus.id,sourceKind:'record'});
let gmObject=(await snap(gm)).objects.find(o=>o.sourceId===anselmus.id);
assert.equal(gmObject.visibility,'sl');
assert.equal((await snap(a)).objects.some(o=>o.sourceId===anselmus.id),false,'laying on the table releases nothing');
assert.equal((await a.get(asset(gmObject.id,'&page=0'))).status,404);
await stage(gm,{action:'add',kind:'document',sourceId:anselmus.id,sourceKind:'record',visible:true,recipients:['command-a']});
const aSnap=await snap(a),aObject=aSnap.objects.find(o=>o.sourceId===anselmus.id);
assert.ok(aObject,'Player A sees the packet');
assert.equal(aObject.pages.length,6);assert.equal(aObject.material.type,'dossier');assert.equal(aObject.material.effect.open,'unseal');assert.equal(aObject.material.display,'stack');
assert.equal(aObject.material.states.length,2);assert.equal(aObject.material.effect.sound,true);
assert.doesNotMatch(JSON.stringify(aSnap),/SL_PRIVATE/,'no GM note or cue reaches a player');
assert.equal((await snap(b)).objects.some(o=>o.sourceId===anselmus.id),false,'Player B sees nothing');
for(let i=0;i<6;i++)assert.equal((await a.get(asset(aObject.id,'&page='+i))).status,200,'page '+i);
assert.equal((await a.get(asset(aObject.id,'&state=closed'))).status,200);assert.equal((await a.get(asset(aObject.id,'&state=open'))).status,200);
assert.equal((await a.get(asset(aObject.id,'&sound=1'))).status,200);
assert.equal((await a.get(asset(aObject.id,'&state=back'))).status,404,'unknown state');
assert.equal((await a.get(asset(aObject.id,'&state=../x'))).status,400,'state is a slug');
assert.equal((await b.get(asset(aObject.id,'&state=closed'))).status,404,'Player B cannot read the asset');
assert.equal((await b.get(asset(aObject.id,'&page=0'))).status,404);
pass('targeted release: GM and Player A see the packet, Player B nothing');
await stage(gm,{action:'visibility',id:aObject.id,visible:false});
assert.equal((await snap(a)).objects.some(o=>o.sourceId===anselmus.id),false,'withdrawn');
assert.equal((await a.get(asset(aObject.id,'&page=0'))).status,404);
assert.equal((await snap(gm)).objects.filter(o=>o.sourceId===anselmus.id).length,1,'still one object on the GM table');
pass('withdrawal hides the material again');

// Letter with the reused envelope for everyone; its player text is part of the object, the GM note is not.
await stage(gm,{action:'add',kind:'document',sourceId:letter.id,sourceKind:'record',visible:true,recipients:null});
for(const p of [a,b]){const o=(await snap(p)).objects.find(o=>o.sourceId===letter.id);assert.ok(o);assert.match(o.documentContent,/PLAYER_MATERIAL/);assert.equal(o.material.effect.open,'slide-out');}
pass('letter reaches the whole round with its envelope');

// 1. Single image with a freely chosen frame.
await stage(gm,{action:'add',kind:'document',sourceId:single.id,sourceKind:'record',visible:true,recipients:null});
const so=(await snap(b)).objects.find(o=>o.sourceId===single.id);
assert.equal(so.media,'image');assert.equal(so.material.type,'image');assert.equal(so.material.states[0].key,'closed');
assert.equal((await b.get(asset(so.id))).status,200);assert.equal((await b.get(asset(so.id,'&state=closed'))).status,200);
pass('single image with its own frame');

// 4./5. Audio and video with their own assets and effects; the GM cue never leaves the Regie.
await stage(gm,{action:'add',kind:'document',sourceId:audio.id,sourceKind:'record',visible:true,recipients:null});
await stage(gm,{action:'add',kind:'document',sourceId:video.id,sourceKind:'record',visible:true,recipients:['command-b']});
const bSnap=await snap(b);
const ao=bSnap.objects.find(o=>o.sourceId===audio.id),vo=bSnap.objects.find(o=>o.sourceId===video.id);
assert.equal(ao.media,'audio');assert.equal(ao.material.effect.open,'unfold');assert.equal(ao.material.states.length,2);
assert.equal(vo.media,'video');assert.equal(vo.material.effect.close,'close');assert.equal(vo.material.states[0].key,'closed');
assert.doesNotMatch(JSON.stringify(bSnap),/SL_PRIVATE/);
assert.equal((await a.get(asset(vo.id))).status,404,'video only for Player B');
pass('audio and video with own assets and effects');

// Missing asset: the object falls back to the simple look and the fallback effect.
await stage(gm,{action:'add',kind:'document',sourceId:missing.id,sourceKind:'record'});
const mo=(await snap(gm)).objects.find(o=>o.sourceId===missing.id);
assert.deepEqual(mo.material.states,[]);assert.equal(mo.material.effect.open,'fade');assert.equal(mo.material.requested,'unseal');
pass('missing asset falls back without an error');

// 6. Pager message for Player A only, unchanged delivery.
const sceneDoc=JSON.parse((await gm.get('/api/command-center/scenes?id='+encodeURIComponent(kaserne))).text).scene;
const pagerElement=sceneDoc.document.elements.find(e=>e.material?.type==='pager');
assert.ok(ctx.pagers.some(p=>p.id===pagerElement.id),'prepared pager still in the Regie pager list');
if((await snap(gm)).pagers.some(p=>p.id===pagerElement.id))await stage(gm,{action:'pagerWithdraw',id:pagerElement.id});// repeatable run
await stage(gm,{action:'pager',id:pagerElement.id,origin:'vorbereitet',text:pagerElement.pager.text,recipients:['command-a']});
assert.ok((await snap(a)).pagers.some(p=>p.text.includes('MATERIAL3')));
assert.equal((await snap(b)).pagers.some(p=>p.text.includes('MATERIAL3')),false,'Player B gets nothing');
await stage(gm,{action:'add',kind:'document',sourceId:'scene-material:'+kaserne+':'+pagerElement.id,sourceKind:'record'},400);
pass('pager message reaches only Player A');

// Backdrop material: own layer with the chosen transition; weather stays.
await stage(gm,{action:'effects',effects:['rain']});
await stage(gm,{action:'backdrop',fileId:backdrop.files[0].fileId,transition:'slow'});
const pb=(await snap(a));assert.equal(pb.backdrop.transition,'slow');assert.deepEqual(pb.effects,['rain']);assert.equal(pb.backdrop.fileId,undefined,'players get no file id');
await stage(gm,{action:'add',kind:'document',sourceId:backdrop.id,sourceKind:'record'},400);
pass('backdrop material uses its transition and keeps weather');

// 3. Secret dossier in another scene: other asset and effect, same code path.
const kctx=await regie(keller);
const akte=kctx.materials.find(m=>m.title.startsWith('Geheimakte'));
assert.equal(akte.asset.title,folder.title);assert.equal(akte.effective,'open-book');assert.equal(akte.display,'spread');
await stage(gm,{action:'add',kind:'document',sourceId:akte.id,sourceKind:'record',visible:true,recipients:['command-b']});
const ko=(await snap(b)).objects.find(o=>o.sourceId===akte.id);
assert.equal(ko.material.effect.open,'open-book');assert.equal(ko.pages.length,3);assert.equal(ko.material.effect.speed,'slow');
assert.notDeepEqual(ko.material.states,aObject.material.states);
pass('secret dossier in another scene with another asset and effect');

// 9. Legacy single files still go on the table the old way.
const legacy=ctx.media.find(m=>m.title==='Fundfoto: Silas am Tor');
await stage(gm,{action:'add',kind:'document',sourceId:legacy.fileId,sourceKind:'file',title:legacy.title,visible:true,recipients:null});
const lo=(await snap(a)).objects.find(o=>o.sourceId===legacy.fileId);assert.equal(lo.media,'image');assert.equal(lo.material,undefined);
pass('legacy single image still works');

// Scene start clears scene material from the table (existing rule) – including materials.
await stage(gm,{action:'activateScene',sceneId:keller});
assert.equal((await snap(gm)).objects.some(o=>o.sourceId===anselmus.id||o.sourceId===akte.id),false);
await stage(gm,{action:'activateScene',sceneId:kaserne});
pass('scene change clears released materials');

// Validation: wrong file type, non-audio sound, too many files for audio.
const fresh=JSON.parse((await gm.get('/api/command-center/scenes?id='+encodeURIComponent(kaserne))).text).scene;
const save=async elements=>gm.send('/api/command-center/scenes',{action:'save',id:fresh.id,version:fresh.version,document:{...fresh.document,elements}});
const anselmusElement=fresh.document.elements.find(e=>e.title==='Anselmus-Paket');
const audioElement=fresh.document.elements.find(e=>e.title==='Tonband: Verhör');
const tamper=(e,m)=>fresh.document.elements.map(x=>x.id===e.id?{...x,material:{...x.material,...m}}:x);
assert.equal((await save(tamper(anselmusElement,{files:[...anselmusElement.material.files,{id:crypto.randomUUID(),fileId:audioElement.fileId,title:''}]}))).status,400,'audio in a photo packet');
assert.equal((await save(tamper(anselmusElement,{effect:{...anselmusElement.material.effect,soundFileId:anselmusElement.fileId}}))).status,400,'effect sound must be audio');
assert.equal((await save(tamper(audioElement,{files:[...audioElement.material.files,{id:crypto.randomUUID(),fileId:audioElement.fileId,title:''}]}))).status,400,'audio takes one file');
assert.equal((await save(tamper(anselmusElement,{files:[...anselmusElement.material.files,{id:crypto.randomUUID(),fileId:'unbekannt-'+Date.now(),title:''}]}))).status,404,'unknown file');
assert.equal((await save(fresh.document.elements.map(x=>x.id===anselmusElement.id?{...x,kind:'audio'}:x))).status,400,'type and kind must fit');
pass('scene save validates material files');

// Usage guards: a used asset and an asset's file cannot be deleted; an unused asset can.
const del=await gm.send('/api/display-assets',{id:envelope.id,version:envelope.version},'DELETE');
assert.equal(del.status,409);assert.match(del.text,/Kaserne/);
const usage=JSON.parse((await gm.get('/api/display-assets?usage='+encodeURIComponent(envelope.id))).text).usage;
assert.ok(usage.some(s=>s.title.includes('Kaserne')));
assert.equal((await gm.send('/api/files',{id:envelope.states[0].fileId},'DELETE')).status,409,'asset image is in use');
const created=JSON.parse((await gm.send('/api/display-assets',{asset:{title:'Wegwerf-Asset',kind:'other',states:[{key:'closed',label:'Geschlossen',fileId:envelope.states[0].fileId}],tags:[]}})).text).asset;
assert.equal((await gm.send('/api/display-assets',{id:created.id,version:created.version},'DELETE')).status,200);
assert.equal((await gm.send('/api/display-assets',{asset:{title:'Ohne Zu',kind:'other',states:[{key:'open',label:'',fileId:envelope.states[0].fileId}],tags:[]}})).status,400,'closed state required');
pass('usage guards for assets and their files');

// 10. Large file list: the GM file list stays complete for the picker.
assert.ok(files.filter(f=>f.name.startsWith('Archivbild')).length>=80,'long file list available');
pass('long file list available');
console.log('Spielmaterial 3.0 integration: all checks passed.');
