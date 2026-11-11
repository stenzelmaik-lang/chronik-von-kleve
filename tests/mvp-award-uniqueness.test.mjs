import test from 'node:test';
import assert from 'node:assert/strict';
import { setupRewardDb, campaignId, now } from './fixtures/xp-reward-db.mjs';
import { bookSessionXpReward, XpRewardServiceError } from '../server/xp-reward-service.ts';
import { bookSessionSettlement } from '../server/xp-settlement-service.ts';
import { xpBalance } from '../domain/character-engine.ts';

const mvp=(characterId,sessionId='abend-1',amount=2)=>({
  campaignId, actorId:'gm', characterId, sessionId, type:'mvp',amount,now,reason:'MVP der Runde'
});
const conflict=error=>error instanceof XpRewardServiceError && error.status===409;

test('MVP is globally unique per played evening, not once per character',async()=>{
  const {db,body,rows}=setupRewardDb();
  const a=await bookSessionXpReward(db,mvp('char-a'));
  assert.equal(a.duplicate,false);
  await assert.rejects(bookSessionXpReward(db,mvp('char-b')),conflict);
  assert.deepEqual([xpBalance(body('char-a')),xpBalance(body('char-b'))],[11,9]);
  assert.equal((await bookSessionXpReward(db,mvp('char-a'))).duplicate,true);
  const markers=rows('settings',"key LIKE 'mvp-award:%'");
  assert.equal(markers.length,1);
  assert.deepEqual(JSON.parse(markers[0].value),{characterId:'char-a',amount:2});
});

test('The same player can receive MVP in another played evening, with a distinct award',async()=>{
  const {db,body,rows}=setupRewardDb();
  await bookSessionXpReward(db,mvp('char-a','abend-1',1));
  await bookSessionXpReward(db,mvp('char-b','abend-2',2));
  assert.equal(rows('settings',"key LIKE 'mvp-award:%'").length,2);
  assert.deepEqual([xpBalance(body('char-a')),xpBalance(body('char-b'))],[10,11]);
});

test('Simultaneous different winners cannot both book MVP on the same evening',async()=>{
  const {db,body,rows}=setupRewardDb();
  const results=await Promise.allSettled([bookSessionXpReward(db,mvp('char-a')),
    bookSessionXpReward(db,mvp('char-b'))]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.filter(x=>x.status==='rejected'&&conflict(x.reason)).length,1);
  assert.equal([xpBalance(body('char-a')),xpBalance(body('char-b'))].filter(x=>x===11).length,1);
  assert.equal(rows('settings',"key LIKE 'mvp-award:%'").length,1);
});

test('An invalid draft character does not reserve the MVP winner slot',async()=>{
  const {db,rows}=setupRewardDb();
  await assert.rejects(bookSessionXpReward(db,mvp('char-draft')),conflict);
  assert.equal(rows('settings',"key LIKE 'mvp-award:%'").length,0);
  await bookSessionXpReward(db,mvp('char-a'));
});

test('A failed character write is safely retryable for the reserved winner',async()=>{
  const {db,rows,body}=setupRewardDb();
  let once=true;
  const failing={...db,batch:async batch=>{
    if(once){once=false;throw new Error('injected outage');}
    return db.batch(batch);
  }};
  await assert.rejects(bookSessionXpReward(failing,mvp('char-a')), /injected outage/);
  assert.equal(xpBalance(body('char-a')),9);
  await assert.rejects(bookSessionXpReward(db,mvp('char-b')),conflict);
  assert.equal((await bookSessionXpReward(db,mvp('char-a'))).duplicate,false);
  assert.equal(rows('settings',"key LIKE 'mvp-award:%'").length,1);
});

test('One settlement may not nominate different characters as MVP simultaneously',async()=>{
  const {db,rows,body}=setupRewardDb();
  const result=bookSessionSettlement(db,{
    campaignId,actorId:'gm',sessionId:'abend-1',now,entries:[
      {characterId:'char-a',attended:true,rewards:[{type:'mvp',amount:1,reason:'Toller Auftritt'}]},
      {characterId:'char-b',attended:true,rewards:[{type:'mvp',amount:2,reason:'Beste Szene'}]},
    ]
  });
  await assert.rejects(result,e=>e instanceof XpRewardServiceError&&e.status===400);
  assert.equal(rows('xp_settlements').length,0);
  assert.equal(rows('settings',"key LIKE 'mvp-award:%'").length,0);
  assert.deepEqual([xpBalance(body('char-a')),xpBalance(body('char-b'))],[9,9]);
});
