// Run only on a separate, disposable loopback QA instance. Never clears existing data.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
const port=Number(process.env.CVK_PROTOTYPE_PORT||8814);
assert.notEqual(port,8812,'Use a separate QA server, not the personal review instance.');
const base='http://127.0.0.1:'+port,checks=[],times=[];
const check=(ok,name)=>{assert.ok(ok,name);checks.push(name);};
async function get(viewer){const start=performance.now(),r=await fetch(base+'/prototype/state?viewer='+viewer),d=await r.json();times.push({viewer,ms:+(performance.now()-start).toFixed(2),bytes:Buffer.byteLength(JSON.stringify(d))});assert.equal(r.status,200);return d;}
async function act(viewer,c,revision){const current=await get(viewer),r=await fetch(base+'/prototype/state?viewer='+viewer,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({...c,...(revision===undefined?{}:{expectedRevision:revision}),expectedVersion:current.version})});return {r,d:await r.json()};}
const before=await get('gm');
const aBefore=await get('a'),existing=new Set(aBefore.objects.map(o=>o.id));
let result=await act('a',{action:'add',kind:'note',content:'STICKY-HTTP-PRIVATE\n\nAbsatz äöü'});
const note=result.d.objects.find(o=>o.kind==='note'&&!existing.has(o.id)),id=note?.id;
check(result.r.ok&&!!id&&note.visibility==='private'&&note.ownerId==='a','Player creates private owned note');
for(const viewer of ['b']){const d=await get(viewer);check(!JSON.stringify(d).includes('STICKY-HTTP-PRIVATE')&&!d.objects.some(o=>o.id===id),'Private note absent from '+viewer+' JSON');}
check((await get('gm')).objects.some(o=>o.id===id&&o.content===note.content),'SL reads private note');
for(const viewer of ['b','gm'])for(const c of [{action:'edit',content:'foreign'},{action:'move',rect:{x:0,y:0,w:.2,h:.3}},{action:'visibility',visibility:'group'},{action:'remove'}])check((await act(viewer,{...c,id},note.revision)).r.status===403,viewer+' cannot '+c.action+' another author note');
result=await act('a',{action:'visibility',id,visibility:'group'},note.revision);check(result.r.ok,'Explicit publication succeeds');
let current=result.d.objects.find(o=>o.id===id);for(const viewer of ['b','gm'])check((await get(viewer)).objects.some(o=>o.id===id),'Group note delivered to '+viewer);
const oldRevision=current.revision;
result=await act('a',{action:'edit',id,content:'Gruppennotiz\n\nAktualisiert <b>nur Text</b>'},current.revision);check(result.r.ok,'Creator edits group note');current=result.d.objects.find(o=>o.id===id);
result=await act('a',{action:'move',id,rect:{x:.45,y:.3,w:.16,h:.27}},current.revision);check(result.r.ok,'Creator moves group note');current=result.d.objects.find(o=>o.id===id);
const b=(await get('b')).objects.find(o=>o.id===id);check(b.rect.x===.45&&b.content===current.content,'Group receives text and position update');
check((await act('b',{action:'edit',id,content:'foreign'},current.revision)).r.status===403,'Other player cannot edit a group note');
check((await act('a',{action:'edit',id,content:'stale'},oldRevision)).r.status===409,'Stale draft rejected');
await act('gm',{action:'scene',id:'taberna'});check((await get('a')).objects.find(o=>o.id===id).rect.x===.45,'Scene switch preserves note');
result=await act('a',{action:'visibility',id,visibility:'private'},current.revision);current=result.d.objects.find(o=>o.id===id);check(!(await get('b')).objects.some(o=>o.id===id),'Revocation removes note from new player projection');
check((await fetch(base+'/.local-work/spieltisch-2/state-'+port+'.json')).status===404,'Local snapshot cannot be downloaded');
check((await fetch(base+'/prototype/state?viewer=outsider')).status===400,'Unknown simulated participant rejected');
check((await fetch(base+'/prototype/state?viewer=a',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status===403,'Missing origin mutation rejected');
check((await act('a',{action:'remove',id},current.revision)).r.ok,'Creator deletes only the generated note');
await act('gm',{action:'scene',id:before.scene,preview:false});
const after=await get('gm');check(JSON.stringify(after.objects)===JSON.stringify(before.objects)&&JSON.stringify(after.board)===JSON.stringify(before.board),'Existing stage objects and board unchanged');
mkdirSync('.local-work/spieltisch-2/evidence/sticky-notes',{recursive:true});writeFileSync('.local-work/spieltisch-2/evidence/sticky-notes/http.json',JSON.stringify({at:new Date().toISOString(),checks,times,scope:'Synthetic loopback simulation only; no production authentication'},null,2));
console.log(JSON.stringify({checks:checks.length,passed:true,requestsMeasured:times.length}));
