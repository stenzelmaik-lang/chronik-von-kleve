import assert from 'node:assert/strict';
const base='http://127.0.0.1:5196';
const html=await(await fetch(base)).text();const key=html.match(/const key='([^']+)'/)[1];
const get=()=>fetch(base+'/api/gm',{headers:{'x-demo-key':key}}).then(r=>r.json());
const write=body=>fetch(base+'/api/gm',{method:'POST',headers:{'x-demo-key':key,Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)});
const before=await get();let s=before;
try{
 assert.equal((await fetch(base+'/api/gm')).status,403);
 let r=await write({action:'release',id:'note',target:'a',enabled:true,revision:s.revision});assert.equal(r.status,200);s=await r.json();
 for(const id of ['a','b']){const p=await(await fetch(base+'/api/player?id='+id)).json();assert.ok(!JSON.stringify(p).includes('private'));assert.ok(!('notes' in p));assert.equal(p.handouts.some(h=>h.id==='note'),id==='a');}
 const competing=await Promise.all([write({action:'notes',value:'QA concurrency',revision:s.revision}),write({action:'notes',value:'QA concurrency 2',revision:s.revision})]);assert.deepEqual(competing.map(r=>r.status).sort(),[200,409]);s=await get();
 r=await write({action:'release',id:'note',target:'a',enabled:false,revision:s.revision});assert.equal(r.status,200);s=await r.json();assert.equal((await(await fetch(base+'/api/player?id=a')).json()).handouts.some(h=>h.id==='note'),false);
 console.log('PASS: SL endpoint denied without key; targeted handout; no private projection; concurrent update conflict; withdrawal.');
}finally{
 s=await get();for(const [action,value] of [['notes',before.notes],['scene',before.active],['phase',before.phase]]){s=await(await write({action,value,revision:s.revision})).json();}
 for(const h of before.handouts)for(const target of ['a','b','group'])s=await(await write({action:'release',id:h.id,target,enabled:h.targets.includes(target),revision:s.revision})).json();
}
