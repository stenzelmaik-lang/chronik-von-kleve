import test from 'node:test';
import assert from 'node:assert/strict';
import {rollD10Pool,evaluateNormalV20,recordNormalV20,W10_ACCEPTED_WORDS} from '../../domain/w10.ts';

test('rejection sampling accepts exactly an equal number of uint32 words per W10 face',()=>{
  assert.equal(W10_ACCEPTED_WORDS%10,0);assert.equal(W10_ACCEPTED_WORDS/10,429496729);
  const words=[0,1,2,3,4,5,6,7,8,9,4294967280,4294967281,4294967282,4294967283,4294967284,4294967285,4294967286,4294967287,4294967288,4294967289];let calls=0;
  const dice=rollD10Pool(20,out=>{out[0]=words[calls++];});
  assert.deepEqual(dice,[1,2,3,4,5,6,7,8,9,10,1,2,3,4,5,6,7,8,9,10]);assert.equal(calls,20);
});
test('only the six unmappable uint32 words are rejected; no face or failed roll is rerolled',()=>{
  const words=[4294967290,4294967291,4294967292,4294967293,4294967294,4294967295,0,0,0];let calls=0;
  const dice=rollD10Pool(3,out=>{out[0]=words[calls++];});assert.deepEqual(dice,[1,1,1]);assert.equal(calls,9);assert.equal(evaluateNormalV20(dice,6).outcome,'botch');
});
test('successes, complete failures and botches follow the normal V20 rule',()=>{
  const cases=[[[6],6,'success',1,0,0,1],[[5],6,'failure',0,0,0,0],[[1],6,'botch',0,1,0,0],[[1,1,1],6,'botch',0,3,0,0],[[2,3,4,5],6,'failure',0,0,0,0],[[6,1],6,'failure',1,1,1,0],[[6,1,1],6,'failure',1,2,1,0],[[9,1,1,8,1],8,'failure',2,3,2,0],[[1,3,4,3,7],8,'botch',0,1,0,0],[[10,6,1],6,'success',2,1,1,1],[[10],10,'success',1,0,0,1]];
  for(const [values,target,outcome,rawSuccesses,ones,cancelled,netSuccesses] of cases){const r=evaluateNormalV20(values,target);assert.deepEqual({outcome:r.outcome,rawSuccesses:r.rawSuccesses,ones:r.ones,cancelled:r.cancelled,netSuccesses:r.netSuccesses},{outcome,rawSuccesses,ones,cancelled,netSuccesses},JSON.stringify(values));}
});
test('all 1000 three-die outcomes satisfy the rules without a guaranteed success',()=>{
  const counts={success:0,failure:0,botch:0};
  for(let a=1;a<=10;a++)for(let b=1;b<=10;b++)for(let c=1;c<=10;c++){
    const dice=[a,b,c],r=evaluateNormalV20(dice,6);counts[r.outcome]++;
    assert.deepEqual(r.dice,dice);assert.ok(r.netSuccesses>=0);assert.equal(r.rawSuccesses,dice.filter(v=>v>=6).length);
    assert.equal(r.outcome==='botch',r.rawSuccesses===0&&r.ones>0);assert.equal(r.outcome==='success',r.rawSuccesses>r.ones);
  }
  assert.ok(counts.success>0&&counts.failure>0&&counts.botch>0);assert.equal(counts.success+counts.failure+counts.botch,1000);
});
test('result history freezes the actual dice, target and cancellation evidence',()=>{
  const dice=[10,6,1,1],entry=recordNormalV20(dice,6);dice[0]=1;
  assert.deepEqual(entry.report.dice,[10,6,1,1]);assert.deepEqual(entry.report.cancelledSuccessIndices,[0,1]);assert.equal(entry.report.outcome,'failure');assert.ok(!Number.isNaN(Date.parse(entry.at)));assert.throws(()=>entry.report.dice.push(10));
});
test('unsupported inputs fail rather than invoke alternative game rules or a random fallback',()=>{
  for(const pool of [0,31,NaN,Infinity,1.1])assert.throws(()=>rollD10Pool(pool));
  for(const [dice,target] of [[[],6],[[0],6],[[11],6],[[6],1],[[6],11]])assert.throws(()=>evaluateNormalV20(dice,target));
  assert.throws(()=>rollD10Pool(1,out=>{out[0]=4294967295;}));assert.throws(()=>rollD10Pool(1,()=>{throw Error('source unavailable');}),/source unavailable/);
  assert.equal(evaluateNormalV20([10,10],6).netSuccesses,2); // No specialty doubling/explosion.
});
