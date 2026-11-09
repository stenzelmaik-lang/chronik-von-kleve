import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStage,changeStageObjects,stageCommandSchema,stageSchema} from '../domain/live-stage.ts';

const a={id:'a',name:'A',gm:false},b={id:'b',name:'B',gm:false},gm={id:'gm',name:'SL',gm:true};

test('only the writer changes the colour of a sticky note; unknown colours are refused', () => {
  let s=changeStageObjects(emptyStage(),a,{action:'add',kind:'note'});const n=s.objects[0];
  assert.equal(n.color,undefined,'a new note is yellow by default (no colour stored)');
  for(const actor of [b,gm])assert.throws(()=>changeStageObjects(s,actor,{action:'color',id:n.id,color:'rosa',expectedRevision:1}),e=>e.status===403);
  s=changeStageObjects(s,a,{action:'color',id:n.id,color:'rosa',expectedRevision:1});
  assert.equal(s.objects[0].color,'rosa');assert.equal(s.objects[0].revision,2);
  assert.equal(stageSchema.safeParse(s).success,true);
  assert.throws(()=>changeStageObjects(s,a,{action:'color',id:n.id,color:'blau',expectedRevision:1}),e=>e.status===409,'stale revision');
  assert.equal(stageCommandSchema.safeParse({action:'color',id:n.id,color:'schwarz',expectedRevision:2}).success,false);
});
