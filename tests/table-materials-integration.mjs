import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {emptyScene} from '../domain/story-scene.ts';
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8882';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only isolated local tests');
let checks=0;
const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'})});check(r.status,200,'login '+id);return r.headers.get('set-cookie').split(';')[0];}
const client=cookie=>async(path,method='GET',data)=>{const form=data instanceof FormData;const r=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method!=='GET'?{Origin:base,...(!form?{'Content-Type':'application/json'}:{})}:{})},...(data?{body:form?data:JSON.stringify(data)}:{})});const mime=r.headers.get('content-type')||'',text=mime.includes('json')?await r.text():(await r.arrayBuffer(),'');return {status:r.status,text,data:mime.includes('json')?JSON.parse(text):null};};
const gm=client(await login('command-gm')),a=client(await login('command-a')),b=client(await login('command-b')),anon=client('');
check((await anon('/api/table-materials')).status,401,'Anonymous cannot read templates');
const beforeChars=(await gm('/api/records?kind=charaktere&view=sl')).data;
const active=(await gm('/api/live-table?view=active')).data,sessionId=active.room.sessionId,runId=active.room.runId;
assert.ok(active.room.started&&active.room.title.startsWith('SYNTHETISCH'),'A synthetic --regie evening must be running');
const q='/api/live-stage?sessionId='+encodeURIComponent(sessionId),snapshot=async who=>(await who(q)).data;
const stage=async(who,command,expected=200,version)=>{const current=await snapshot(who),r=await who('/api/live-stage','POST',{sessionId,runId,expectedVersion:version??current.version,command});check(r.status,expected,command.action+': '+r.text);return r.data;};
const title='SYNTHETISCH – Material '+randomUUID();
const create=async(who,patch={})=>{const r=await who('/api/table-materials','POST',{material:{title,kind:'document',text:'Name: …\nHinweise: …',fileId:'',...patch}});check(r.status,200,'create private preparation: '+r.text);return r.data.material;};
const list=async who=>(await who('/api/table-materials')).data.materials;
const m=await create(a),privateText='PRIVATE ONLY '+randomUUID();
const untouched=await create(b,{title:'SYNTHETISCH – nie geteilt',text:privateText});
for(const who of [gm,b]){check((await list(who)).some(x=>x.id===m.id),false,'Private player template absent from other libraries');check((await who('/api/table-materials','POST',{id:m.id,version:m.version,material:{title:'forged',kind:'document',text:'bad',fileId:''}})).status,404,'Cannot edit another author template');check((await who('/api/table-materials','DELETE',{id:m.id,version:m.version})).status,404,'Cannot delete another template');}
for(const who of [gm,b]){check((await who('/api/entities?id='+m.id)).status,404,'Private preparation is not exposed through its companion entity');check((await who('/api/entities?type=NOTE')).text.includes(m.id),false,'Generic NOTE list hides foreign private templates');}
const campaign=(await gm('/api/export?scope=campaign')).data;
check(campaign.records.some(r=>r.id===m.id||r.id===untouched.id),false,'Campaign record export excludes foreign preparations');
check(campaign.entities.some(r=>r.id===m.id||r.id===untouched.id),false,'Campaign companion entity export excludes foreign preparations');
check(JSON.stringify(campaign).includes(privateText),false,'Campaign export does not contain foreign private preparation text');
check((await a('/api/export')).data.records.some(r=>r.id===m.id),true,'Own preparation remains in personal backup');
check((await a('/api/records?kind=notizen')).text.includes(m.id),false,'Dedicated material does not leak through generic notes');
check((await a('/api/records','POST',{id:m.id,version:m.version,kind:'notizen',visibility:'group',title:'forged',body:{context:'table-material'}})).status,403,'Generic records cannot publish a template');
check((await a('/api/records','DELETE',{id:m.id,version:m.version})).status,403,'Generic delete cannot bypass material guard');
await stage(b,{action:'add',kind:'document',sourceKind:'record',sourceId:m.id,visible:true},404);
await stage(a,{action:'add',kind:'document',sourceKind:'record',sourceId:m.id,visible:true,recipients:['command-b']});
let object=(await snapshot(a)).objects.find(o=>o.sourceId===m.id);assert.ok(object);checks++;
const asset=id=>'/api/live-stage/asset?sessionId='+encodeURIComponent(sessionId)+'&objectId='+encodeURIComponent(id);
for(const who of [a,b,gm]){check((await who(asset(object.id))).status,200,'Working copy readable by author, target and SL');check((await snapshot(who)).objects.some(o=>o.id===object.id),true,'Working copy in snapshot');}
check((await gm('/api/table-materials')).text.includes(privateText),false,'SL has no private library bypass');
check((await snapshot(gm)).objects.some(o=>o.sourceId===untouched.id),false,'Never-shared player template absent from SL table');
await stage(b,{action:'documentEdit',id:object.id,content:'unauthorized'},403);
const oldVersion=(await snapshot(a)).version;
await stage(a,{action:'documentEdit',id:object.id,content:'Name: ausgefüllt\nHinweise: gemeinsam sichtbar'});
check((await b(asset(object.id))).data.content,'Name: ausgefüllt\nHinweise: gemeinsam sichtbar','Target sees filled working copy');
check((await list(a)).find(x=>x.id===m.id).text,m.text,'Template unchanged by filling');
const sceneList=(await gm(q+'&catalog=1')).data.scenes;
await stage(gm,{action:'activateScene',sceneId:sceneList[1].id});
check((await b(asset(object.id))).data.content,'Name: ausgefüllt\nHinweise: gemeinsam sichtbar','Personal working copy survives scene change');
await stage(gm,{action:'activateScene',sceneId:sceneList[0].id});
await stage(a,{action:'documentEdit',id:object.id,content:'stale'},409,oldVersion);
await stage(a,{action:'move',id:object.id,rect:{x:.1,y:.2,w:.25,h:.3}});
check((await snapshot(b)).objects.find(o=>o.id===object.id).rect.x,.1,'Owner move synchronized');
check((await a('/api/table-materials','DELETE',{id:m.id,version:m.version})).status,409,'On-table preparation cannot be deleted');
await stage(a,{action:'visibility',id:object.id,visible:false});
check((await b(asset(object.id))).status,404,'Withdrawn material cannot be fetched by old URL');
check((await snapshot(b)).objects.some(o=>o.id===object.id),false,'Withdrawal removed from target snapshot');
await stage(a,{action:'visibility',id:object.id,visible:true,recipients:['not-a-participant']},400);
await stage(a,{action:'visibility',id:object.id,visible:true,recipients:null});
check((await b(asset(object.id))).status,200,'Explicit group release');
await stage(a,{action:'remove',id:object.id});
check((await b(asset(object.id))).status,404,'Removed working copy unavailable');

// Own private images become polaroids through exactly the same release path; file URLs stay private.
const form=new FormData();form.set('visibility','private');form.set('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ZkAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'SYNTHETISCH – Foto.png');
const uploaded=await a('/api/files','POST',form);check(uploaded.status,200,'Own image upload');const fileId=uploaded.data.id;
const photo=await create(a,{title:'SYNTHETISCH – Polaroid',kind:'image',fileId,text:''});
await stage(a,{action:'add',kind:'document',sourceId:photo.id,sourceKind:'record',visible:true,recipients:['command-b']});
object=(await snapshot(a)).objects.find(o=>o.sourceId===photo.id);check(object.media,'image','Private image staged as polaroid');
check((await b('/api/files?id='+fileId)).status,404,'Raw private image remains inaccessible');check((await b(asset(object.id))).status,200,'Target can load stage-authorized image');
check((await a('/api/files','DELETE',{id:fileId})).status,409,'Used image deletion protected');
check((await gm('/api/files','DELETE',{id:fileId})).status,404,'SL cannot delete another player private original');
await stage(a,{action:'remove',id:object.id});check((await a('/api/table-materials','DELETE',{id:photo.id,version:photo.version})).status,200,'Withdrawn template removable');
check((await a('/api/files','DELETE',{id:fileId})).status,200,'Unused image removable');

// SL-authored text templates are playable too, without exposing the library or preparation internals.
const gmDoc=await create(gm,{title:'SYNTHETISCH – SL-Dokument'});
await stage(gm,{action:'add',kind:'document',sourceId:gmDoc.id,sourceKind:'record',visible:true,recipients:['command-a']});
object=(await snapshot(gm)).objects.find(o=>o.sourceId===gmDoc.id);check((await a(asset(object.id))).status,200,'SL template reaches A');check((await b(asset(object.id))).status,404,'SL template stays hidden from B');
await stage(a,{action:'documentEdit',id:object.id,content:'forged'},403);
await stage(gm,{action:'remove',id:object.id});
// A handout written directly in scene preparation is playable without a duplicate template record.
const sceneDraft={...emptyScene(),title:'SYNTHETISCH – Text-Handout-Prüfung',elements:[{id:randomUUID(),kind:'handout',title:'SYNTHETISCH – Formular aus Szene',text:'Formular: noch offen',fileId:'',referenceId:''}]};
const madeScene=await gm('/api/command-center/scenes','POST',{action:'create',clientRequestId:randomUUID(),document:sceneDraft});check(madeScene.status,201,'Create isolated scene-handout fixture');
const scene=madeScene.data.scene,preparedContext=(await gm(q+'&regie='+scene.id)).data,prepared=preparedContext.handouts.find(h=>h.sourceKind==='record');assert.ok(prepared);checks++;
await stage(a,{action:'add',kind:'document',sourceId:prepared.id,sourceKind:'record',visible:true},403);
await stage(gm,{action:'add',kind:'document',sourceId:prepared.id,sourceKind:'record',visible:true,recipients:['command-a']});
object=(await snapshot(gm)).objects.find(o=>o.sourceId===prepared.id);check((await a(asset(object.id))).status,200,'Prepared scene-text handout readable');check((await b(asset(object.id))).status,404,'Scene handout obeys recipients');
await stage(gm,{action:'documentEdit',id:object.id,content:'Formular: ausgefüllt'});
check((await gm('/api/command-center/scenes?id='+scene.id)).data.scene.document,scene.document,'Filling the scene handout leaves all original preparation fields unchanged');
await stage(gm,{action:'remove',id:object.id});check((await gm('/api/command-center/scenes','POST',{action:'delete',id:scene.id,version:scene.version})).status,200,'Synthetic scene-handout fixture cleaned');
for(const [who,item] of [[a,m],[b,untouched],[gm,gmDoc]])check((await who('/api/table-materials','DELETE',{id:item.id,version:item.version})).status,200,'Synthetic template cleaned');
check((await gm('/api/records?kind=charaktere&view=sl')).data,beforeChars,'Character records and versions unchanged');
console.log(`ALL PASS: ${checks} material API / roles / audience / working copy / file protection / integrity checks`);
