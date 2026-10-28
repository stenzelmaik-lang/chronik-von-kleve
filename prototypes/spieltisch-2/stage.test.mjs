import test from 'node:test';
import assert from 'node:assert/strict';
import {createStage,projectStage,changeStage,constrainRect,canSee} from './stage-state.mjs';
test('private preparation and asset metadata never occur in either player projection',()=>{
  const state=createStage();changeStage(state,'gm',{action:'add',kind:'npc',expectedVersion:1});changeStage(state,'gm',{action:'add',kind:'document',expectedVersion:2});
  for(const role of ['a','b']){const data=projectStage(state,role),encoded=JSON.stringify(data);assert.equal(data.objects.length,0);assert.equal(data.catalog.length,0);assert.ok(!encoded.includes('Herr Schäfer'));assert.ok(!encoded.includes('SL-PROTOTYP-VERTRAULICH'));assert.equal(data.scenes.length,1);}
  assert.match(projectStage(state,'gm').privateNote,/SL-PROTOTYP-VERTRAULICH/);assert.equal(projectStage(state,'gm').objects.length,2);
});
test('scene preview is private, explicit publication shared; other layers and object IDs survive',()=>{
  const s=createStage(),act=c=>changeStage(s,'gm',{...c,expectedVersion:s.version});
  act({action:'add',kind:'npc'});act({action:'add',kind:'document'});act({action:'move',id:'npc',rect:{x:.3,y:.1,w:.2,h:.7}});const before=JSON.stringify(s.objects);
  act({action:'scene',id:'barracks',preview:true});assert.equal(projectStage(s,'gm').scene,'barracks');assert.equal(projectStage(s,'a').scene,'campaign');
  act({action:'scene',id:'taberna'});assert.equal(projectStage(s,'gm').scene,'taberna');assert.equal(projectStage(s,'a').scene,'taberna');assert.equal(JSON.stringify(s.objects),before);
  act({action:'visibility',id:'npc',visible:true});assert.equal(projectStage(s,'a').objects.length,1);assert.equal(projectStage(s,'b').objects.length,1);
  act({action:'visibility',id:'npc',visible:false});assert.equal(projectStage(s,'a').objects.length,0);assert.equal(canSee(s.objects[0],'b'),false);
  act({action:'add',kind:'npc'});assert.equal(s.objects.filter(o=>o.kind==='npc').length,1);
});
test('players cannot mutate shared scenes/objects, stale writes fail without replacing data',()=>{
  const s=createStage();assert.throws(()=>changeStage(s,'a',{action:'scene',id:'taberna',expectedVersion:1}),{status:403});
  changeStage(s,'gm',{action:'scene',id:'barracks',expectedVersion:1});assert.throws(()=>changeStage(s,'gm',{action:'scene',id:'taberna',expectedVersion:1}),{status:409});assert.equal(s.scene,'barracks');
});
test('object movement and resizing remain inside normalized stage bounds',()=>{
  for(const rect of [{x:-10,y:-10,w:2,h:3},{x:2,y:2,w:.3,h:.4},{x:NaN,y:Infinity,w:NaN,h:-1}]){const r=constrainRect(rect);assert.ok(r.x>=0&&r.y>=0&&r.w>=.1&&r.h>=.13);assert.ok(r.x+r.w<=1&&r.y+r.h<=1);}
});
test('existing board operations use revisions and never reset scene or documents',()=>{
  const s=createStage();changeStage(s,'gm',{action:'add',kind:'document',expectedVersion:1});const object=JSON.stringify(s.objects);
  changeStage(s,'a',{action:'board',operation:'draw',epoch:0,element:{id:'stroke',points:[[10,10],[30,30]],memberId:'demo-a',name:'Demo A',color:'#d6b36f'},expectedVersion:2});
  assert.equal(s.board[0].revision,1);assert.equal(JSON.stringify(s.objects),object);
  changeStage(s,'a',{action:'board',operation:'edit',elementId:'stroke',expectedRevision:1,epoch:0,element:{...s.board[0],points:[[20,20],[40,40]]},expectedVersion:3});
  assert.equal(s.board[0].revision,2);assert.equal(s.scene,'campaign');assert.equal(JSON.stringify(s.objects),object);
  assert.throws(()=>changeStage(s,'a',{action:'board',operation:'remove',elementId:'stroke',expectedRevision:1,epoch:0,expectedVersion:4}),{status:409});
});
