import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {evaluateNormalV20} from '../../domain/w10.ts';
const port=Number(process.env.CVK_PROTOTYPE_PORT||8818);assert.ok(![8812,8816].includes(port),'Use disposable QA only');
const base='http://127.0.0.1:'+port,sessionId='synthetic-prototype',checks=[],times=[],ids=[];
const check=(value,label)=>{assert.ok(value,label);checks.push(label);};
async function read(who='gm',extra=''){const r=await fetch(base+'/prototype/state?viewer='+who+extra),d=await r.json();return {r,d};}
async function send(who,body,origin=base){const t=performance.now(),r=await fetch(base+'/prototype/state?viewer='+who,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();times.push(+(performance.now()-t).toFixed(2));return {r,d};}
const before=(await read()).d,oldIds=new Set(before.dice.events.map(e=>e.id));
const command=(pool=5,target=6)=>({action:'roll',sessionId,eventId:crypto.randomUUID(),pool,target});
const first=command(),response=await send('gm',first);ids.push(first.eventId);
check(response.r.ok,'SL can create a shared normal V20 roll centrally');
const e=response.d.dice.events.find(e=>e.id===first.eventId);
for(const who of ['gm','a','b']){const next=(await read(who)).d;check(JSON.stringify(next.dice.events.find(x=>x.id===e.id))===JSON.stringify(e),'Identical event/values/order/result/seed for '+who);if(who!=='gm')check(!JSON.stringify(next).includes('SL-PROTOTYP-VERTRAULICH'),'No SL metadata for '+who);}
const duplicates=await Promise.all(Array.from({length:12},()=>send('gm',first)));
check(duplicates.every(v=>v.r.ok&&JSON.stringify(v.d.dice.events.find(x=>x.id===e.id))===JSON.stringify(e)),'Parallel retries return exactly the original event');
check((await read()).d.dice.events.filter(x=>x.id===e.id).length===1,'Retry requests persist exactly one event');
check((await send('a',first)).r.status===409,'Author collision rejected');
check((await send('gm',{...first,target:7})).r.status===409,'Changed request with existing ID rejected');
for(const [who,body,status] of [['outsider',command(),400],['a',command(31),400],['a',command(5,1),400],['a',{...command(),sessionId:'foreign'},403],['a',{...command(),dice:[10,10]},400],['a',{action:'closeRoll',sessionId,eventId:e.id,expectedRevision:1},403]])check((await send(who,body)).r.status===status,'Denied invalid/foreign/spoofed operation '+checks.length);
check((await read('a','&sessionId=foreign')).r.status===403,'Foreign session read denied without journal');
check((await send('gm',command(),'https://example.invalid')).r.status===403,'Foreign-origin write rejected');
const ca=command(),cb=command();const concurrent=await Promise.all([send('a',ca),send('b',cb)]);ids.push(ca.eventId,cb.eventId);
check(concurrent.every(x=>x.r.ok),'Independent players can roll concurrently');
const journal=(await read()).d.dice;check(new Set(journal.events.map(x=>x.sequence)).size===journal.events.length,'Concurrent events remain sequential without overwriting history');
check(journal.events.find(x=>x.id===e.id).status==='settled_open','Later rolls do not close the earlier result');
for(const pool of [1,5,10,20,30]){const c=command(pool),next=await send('a',c);ids.push(c.eventId);check(next.r.ok,'Supported pool '+pool);const roll=next.d.dice.events.find(x=>x.id===c.eventId);check(JSON.stringify(roll.result)===JSON.stringify(evaluateNormalV20(roll.roll.dice,6))&&roll.roll.dice.length===pool,'Pool/result validated '+pool);}
check((await send('gm',{action:'closeRoll',sessionId,eventId:e.id,expectedRevision:0})).r.status===409,'Stale close rejected');
check((await send('gm',{action:'closeRoll',sessionId,eventId:e.id,expectedRevision:1})).r.ok,'Explicit GM global close accepted');
for(const who of ['a','b'])check((await read(who)).d.dice.events.find(x=>x.id===e.id).status==='closed_shared','Shared close projects to '+who);
check((await send('gm',first)).d.dice.events.find(x=>x.id===e.id).status==='closed_shared','Retry cannot reopen closed result');
const after=(await read()).d;check(JSON.stringify(before.objects)===JSON.stringify(after.objects)&&JSON.stringify(before.board)===JSON.stringify(after.board)&&before.scene===after.scene,'Scene, board and all pre-existing objects remain unchanged');
check([...oldIds].every(id=>after.dice.events.some(e=>e.id===id)),'Existing journal entries remain intact');
for(const id of ids){const roll=(await read()).d.dice.events.find(e=>e.id===id);if(roll.status!=='closed_shared')await send('gm',{action:'closeRoll',sessionId,eventId:id,expectedRevision:roll.revision});}
mkdirSync('.local-work/spieltisch-2/evidence/w10-v1.2',{recursive:true});writeFileSync('.local-work/spieltisch-2/evidence/w10-v1.2/shared-http.json',JSON.stringify({at:new Date().toISOString(),scope:'Local simulated membership only; no production auth',checks,times,passed:true},null,2));
console.log(JSON.stringify({passed:true,checks:checks.length,requests:times.length,maxMs:Math.max(...times)}));
