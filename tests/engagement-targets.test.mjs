import test from 'node:test';
import assert from 'node:assert/strict';
import { engagementTargetsForDays, engagementProgress } from '../domain/engagement-targets.ts';

test('30-day interval uses 8h and 24h as the two confirmed thresholds',()=>{
  const t=engagementTargetsForDays(30);
  assert.deepEqual([t.firstSeconds,t.fullSeconds],[8*3600,24*3600]);
  assert.deepEqual(engagementProgress(0,t),{percent:0,earnedStages:[],nextStage:1,remainingSeconds:8*3600});
  assert.deepEqual(engagementProgress(8*3600,t),{percent:50,earnedStages:[1],nextStage:2,remainingSeconds:16*3600});
  assert.deepEqual(engagementProgress(24*3600,t),{percent:100,earnedStages:[1,2],nextStage:null,remainingSeconds:0});
});

test('exponential scaling matches the agreed 14/30/60-day examples',()=>{
  for (const [days,hours1,hours2] of [[14,6.2,18.7],[30,8,24],[60,12.8,38.4]]){
    const t=engagementTargetsForDays(days);
    assert.ok(Math.abs(t.firstSeconds/3600-hours1)<0.06);
    assert.ok(Math.abs(t.fullSeconds/3600-hours2)<0.06);
  }
  assert.ok(engagementTargetsForDays(14).firstSeconds<engagementTargetsForDays(30).firstSeconds);
  assert.ok(engagementTargetsForDays(60).fullSeconds>engagementTargetsForDays(30).fullSeconds);
});

test('progress is piecewise linear on the exponential targets, not minutes-only percent',()=>{
  const t=engagementTargetsForDays(30);
  assert.equal(engagementProgress(4*3600,t).percent,25);
  assert.equal(engagementProgress(16*3600,t).percent,75);
  assert.deepEqual(engagementProgress(t.firstSeconds-1,t).earnedStages,[]);
  assert.deepEqual(engagementProgress(t.fullSeconds-1,t).earnedStages,[1]);
  assert.deepEqual(engagementProgress(999*3600,t).earnedStages,[1,2]);
  assert.equal(engagementProgress(999*3600,t).percent,100);
});

test('invalid intervals, tracked seconds and threshold data fail closed',()=>{
  for (const days of [0,-1,Number.NaN,Number.POSITIVE_INFINITY])assert.throws(()=>engagementTargetsForDays(days));
  const t=engagementTargetsForDays(30);
  for (const seconds of [-1,1.5,Number.NaN,Number.POSITIVE_INFINITY])assert.throws(()=>engagementProgress(seconds,t));
  assert.throws(()=>engagementProgress(100,{...t,firstSeconds:0}));
});
