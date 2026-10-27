import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createStage,changeStage,projectStage} from './stage-state.mjs';
import {readStage,writeStage} from './stage-storage.mjs';
import {changeDice,projectDice,validateDiceJournal,DICE_SESSION} from './shared-dice.mjs';
import {createInbox,ingestDice,dismissDice,showDice} from './dice-inbox.mjs';
const command=(extra={})=>({action:'roll',sessionId:DICE_SESSION,eventId:crypto.randomUUID(),pool:5,target:6,...extra});
const options={sample:n=>Array(n).fill(1),seed:()=>[1,2,3,4]};
test('one central result is shared in identical order with every eligible member, with an authoritative author',()=>{
  const state=createStage(),c=command();let calls=0;
  changeDice(state,'a',c,{...options,sample:()=>{calls++;return [9,1,1,8,1];}});
  assert.equal(calls,1);for(const who of ['gm','a','b'])assert.deepEqual(projectDice(state,who),projectDice(state,'a'));
  const e=projectDice(state,'gm').events[0];assert.equal(e.authorId,'a');assert.equal(e.result.outcome,'failure');assert.deepEqual(e.roll.dice,[9,1,1,8,1]);assert.equal(e.sequence,1);assert.equal(e.revision,1);
});
test('retries and duplicate IDs never draw again or reopen globally closed results',()=>{
  const s=createStage(),c=command();let calls=0;const deps={...options,sample:n=>{calls++;return Array(n).fill(1);}};
  changeDice(s,'gm',c,deps);const version=s.version;assert.equal(changeDice(s,'gm',c,deps),false);assert.equal(s.version,version);assert.equal(calls,1);
  changeDice(s,'gm',{action:'closeRoll',sessionId:DICE_SESSION,eventId:c.eventId,expectedRevision:1});
  assert.equal(changeDice(s,'gm',c,deps),false);assert.equal(calls,1);assert.equal(s.diceJournal.events[0].status,'closed_shared');
});
test('ID collisions with a different author or request fail without data loss',()=>{
  const s=createStage(),c=command();changeDice(s,'gm',c,options);const before=JSON.stringify(s);
  for(const [who,body] of [['a',c],['gm',{...c,target:7}],['gm',{...c,pool:4}]])assert.throws(()=>changeDice(s,who,body,options),{status:409});assert.equal(JSON.stringify(s),before);
});
test('foreign sessions, unknown participants and client supplied results are denied centrally',()=>{
  const s=createStage(),before=JSON.stringify(s);
  for(const who of ['outsider','suspended','__proto__']){assert.throws(()=>projectDice(s,who),{status:403});assert.throws(()=>changeDice(s,who,command(),options),{status:403});}
  assert.throws(()=>projectDice(s,'a','foreign'),{status:403});
  for(const c of [command({sessionId:'foreign'}),command({sessionId:undefined}),command({dice:[10]}),command({authorId:'gm'}),command({result:{netSuccesses:5}})])assert.throws(()=>changeDice(s,'a',c,options));
  assert.equal(JSON.stringify(s),before);
});
test('invalid normal probes and broken sources do not publish partial or fabricated rolls',()=>{
  const s=createStage(),before=JSON.stringify(s);
  for(const [pool,target] of [[0,6],[31,6],[2.5,6],['5',6],[5,1],[5,11],[5,NaN]])assert.throws(()=>changeDice(s,'a',command({pool,target}),options));
  assert.throws(()=>changeDice(s,'a',command(),{...options,sample:()=>{throw Error('Entropy unavailable');}}));
  assert.throws(()=>changeDice(s,'a',command(),{...options,sample:()=>[10]}));assert.equal(JSON.stringify(s),before);
});
test('only GM can close exactly the chosen shared roll with its current revision',()=>{
  const s=createStage(),a=command(),b=command();changeDice(s,'a',a,options);changeDice(s,'b',b,options);
  const close={action:'closeRoll',sessionId:DICE_SESSION,eventId:a.eventId,expectedRevision:1},before=JSON.stringify(s);
  assert.throws(()=>changeDice(s,'a',close),{status:403});assert.throws(()=>changeDice(s,'gm',{...close,expectedRevision:0}),{status:409});assert.equal(JSON.stringify(s),before);
  changeDice(s,'gm',close);assert.equal(s.diceJournal.events[0].status,'closed_shared');assert.equal(s.diceJournal.events[1].status,'settled_open');assert.equal(changeDice(s,'gm',close),false);
});
test('new independent requests receive monotone identities and retain previous events',()=>{
  const s=createStage();for(let i=0;i<20;i++)changeDice(s,i%2?'a':'b',command(),options);
  assert.deepEqual(s.diceJournal.events.map(e=>e.sequence),Array.from({length:20},(_,i)=>i+1));assert.equal(new Set(s.diceJournal.events.map(e=>e.id)).size,20);assert.equal(s.diceJournal.events.filter(e=>e.status==='settled_open').length,20);
});
test('old snapshots cannot replay, reorder or overwrite the selected visible result',()=>{
  const s=createStage(),a=command(),b=command();let box=ingestDice(createInbox(),projectDice(s,'a'));changeDice(s,'gm',a,options);box=ingestDice(box,projectDice(s,'a'));
  assert.equal(box.selectedId,a.eventId);assert.equal(box.animate,true);const old=structuredClone(projectDice(s,'a'));
  changeDice(s,'b',b,options);box=ingestDice(box,projectDice(s,'a'));assert.equal(box.selectedId,a.eventId);assert.equal(box.events.length,2);
  assert.equal(ingestDice(box,old),box);assert.equal(ingestDice(box,projectDice(s,'a')),box);
  box=showDice(box,b.eventId);assert.equal(box.selectedId,b.eventId);assert.ok(box.hidden.includes(a.eventId));assert.equal(box.events.length,2);
});
test('local dismissal affects neither the shared journal nor another client and stays dismissed on unrelated updates',()=>{
  const s=createStage(),c=command();changeDice(s,'gm',c,options);const projected=projectDice(s,'a'),server=JSON.stringify(s);
  let a=ingestDice(createInbox(),projected),b=ingestDice(createInbox(),projected);a=dismissDice(a);
  assert.equal(a.selectedId,null);assert.equal(b.selectedId,c.eventId);assert.equal(JSON.stringify(s),server);
  changeStage(s,'gm',{action:'scene',id:'barracks',expectedVersion:s.version});a=ingestDice(a,projectStage(s,'a').dice);assert.equal(a.selectedId,null);
  a=ingestDice(createInbox(a.hidden),projectDice(s,'a'));assert.equal(a.selectedId,null);
});
test('reconnect restores an open result without animation, global close reaches all, history remains readable',()=>{
  const s=createStage(),c=command();changeDice(s,'a',c,options);let a=ingestDice(createInbox(),projectDice(s,'a'));assert.equal(a.selectedId,c.eventId);assert.equal(a.animate,false);
  changeDice(s,'gm',{action:'closeRoll',sessionId:DICE_SESSION,eventId:c.eventId,expectedRevision:1});a=ingestDice(a,projectDice(s,'a'));assert.equal(a.selectedId,null);assert.equal(a.events.length,1);
  a=showDice(a,c.eventId);changeDice(s,'b',command(),options);a=ingestDice(a,projectDice(s,'a'));assert.equal(a.selectedId,c.eventId);assert.equal(a.animate,false);
});
test('journal persistence reuses the existing snapshot without touching scenes, board or notes; corruption fails closed',()=>{
  const root=resolve('.local-work/spieltisch-2/qa');mkdirSync(root,{recursive:true});const dir=mkdtempSync(join(root,'dice-')),path=join(dir,'state.json');
  try{
    const s=createStage();changeStage(s,'a',{action:'add',kind:'note',content:'PRIVATE PRESERVED',expectedVersion:s.version});const objects=JSON.stringify(s.objects),board=JSON.stringify(s.board);
    writeStage(path,s);const original=readFileSync(path);assert.equal(readStage(path).diceJournal,undefined);assert.deepEqual(readFileSync(path),original);
    changeDice(s,'gm',command(),options);writeStage(path,s);const restored=readStage(path);assert.deepEqual(restored,s);assert.equal(JSON.stringify(restored.objects),objects);assert.equal(JSON.stringify(restored.board),board);
    restored.diceJournal.events[0].result.netSuccesses=99;assert.equal(validateDiceJournal(restored.diceJournal),false);writeFileSync(path,JSON.stringify({format:1,state:restored}));const corrupt=readFileSync(path);assert.throws(()=>readStage(path));assert.deepEqual(readFileSync(path),corrupt);
  }finally{assert.ok(resolve(dir).startsWith(root+'\\'));rmSync(dir,{recursive:true,force:true});}
});
test('rate limits reject additional requests without evicting the session history',()=>{
  const s=createStage();for(let i=0;i<30;i++)changeDice(s,'a',command(),options);const before=JSON.stringify(s);assert.throws(()=>changeDice(s,'a',command(),options),{status:429});assert.equal(JSON.stringify(s),before);
});
