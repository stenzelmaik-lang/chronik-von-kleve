import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
const base='http://127.0.0.1:'+(process.env.CVK_PROTOTYPE_PORT||8812);assert.equal(new URL(base).hostname,'127.0.0.1');
const checks=[],times=[];
async function get(path){const start=performance.now(),r=await fetch(base+path);const text=await r.text();times.push({path,ms:Math.round((performance.now()-start)*100)/100,bytes:Buffer.byteLength(text),status:r.status});return {r,text,data:r.headers.get('content-type')?.includes('json')?JSON.parse(text):null};}
const check=(value,label)=>{assert.ok(value,label);checks.push(label);};
let data=(await get('/prototype/state?viewer=gm')).data;
async function act(c,viewer='gm'){const r=await fetch(base+'/prototype/state?viewer='+viewer,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({...c,expectedVersion:data.version})});const d=await r.json();if(r.ok)data=d;return {r,d};}
// Dispose only the explicitly synthetic loopback server's in-memory test objects.
for(const item of [...data.objects])await act({action:'remove',id:item.id});
for(const item of [...data.board])await act({action:'board',operation:'remove',elementId:item.id,expectedRevision:item.revision,epoch:data.boardEpoch});
await act({action:'scene',id:'campaign'});
check((await get('/')).r.status===200,'Local shell available');
check((await get('/main.js')).text.includes('Gemeinsam zeichnen'),'Existing board bundled');
check(!(await get('/main.js')).text.includes('SL-PROTOTYP-VERTRAULICH'),'Private fixture absent from browser bundle');
await act({action:'add',kind:'npc'});await act({action:'add',kind:'document'});
for(const viewer of ['a','b']){const p=await get('/prototype/state?viewer='+viewer);check(!p.text.includes('Herr Schäfer')&&!p.text.includes('SL-PROTOTYP-VERTRAULICH')&&p.data.objects.length===0,'Private metadata absent for '+viewer);check((await get('/prototype/media/npc?viewer='+viewer)).r.status===404,'Private NPC bytes denied '+viewer);check((await get('/prototype/document?viewer='+viewer)).r.status===404,'Private document denied '+viewer);}
await act({action:'scene',id:'barracks',preview:true});check((await get('/prototype/state?viewer=a')).data.scene==='campaign','Private scene preview never changes player stage');
await act({action:'scene',id:'barracks'});await act({action:'visibility',id:'npc',visible:true});await act({action:'visibility',id:'document',visible:true});
check((await get('/prototype/media/npc?viewer=a')).r.status===200,'Released NPC readable');check((await get('/prototype/document?viewer=b')).r.status===200,'Released handout readable');
const before=JSON.stringify(data.objects);await act({action:'scene',id:'taberna'});check(JSON.stringify(data.objects)===before,'Scene switch preserves object positions and IDs');
check((await act({action:'scene',id:'campaign'},'a')).r.status===403,'Player shared writes denied');
await act({action:'visibility',id:'npc',visible:false});check((await get('/prototype/media/npc?viewer=a')).r.status===404,'Revocation denies new image retrieval');
check((await get('/prototype/media/../../server/catalog.json')).r.status===404,'No arbitrary file serving');check((await get('/api/live-table')).r.status===404,'No production API mounted');
for(const id of ['campaign','barracks','taberna'])check((await get('/prototype/media/'+id+'?viewer=gm')).r.status===200,'Existing scene asset '+id+' readable');
// Leave the review UI on a clean campaign scene with no placed objects.
await act({action:'remove',id:'npc'});await act({action:'remove',id:'document'});await act({action:'scene',id:'campaign'});
mkdirSync('.local-work/spieltisch-2/evidence',{recursive:true});writeFileSync('.local-work/spieltisch-2/evidence/http.json',JSON.stringify({at:new Date().toISOString(),checks,times,scope:'Synthetic loopback HTTP only; not production-auth acceptance'},null,2));
console.log(JSON.stringify({checks:checks.length,passed:true,measurements:times.length}));
