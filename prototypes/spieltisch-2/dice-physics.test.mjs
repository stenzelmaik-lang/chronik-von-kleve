import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3,Matrix4} from 'three';
import {prepareThrow,motionRandom,trayLayout} from './dice-physics.mjs';
import {d10,labelRotation,applyMatrix,upwardValue,bevelledSurface} from './dice-geometry.mjs';
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));

test('a single physics pass drops bounded W10 bodies, collides and naturally sleeps for 1/5/30 dice',async()=>{
  for(const count of [1,5,30]){
    const plan=await prepareThrow(count,[1,2,3,4]);assert.ok(plan.asleep);assert.ok(plan.duration>1&&plan.duration<=10.02);assert.ok(plan.floorContacts>=count);
    if(count>1)assert.ok(plan.contacts>0&&plan.diePairs>0);
    for(const frame of plan.frames){assert.equal(frame.length,count*7);assert.ok([...frame].every(Number.isFinite));for(let i=0;i<count;i++){assert.ok(Math.abs(frame[i*7])<=plan.width/2+.1);assert.ok(Math.abs(frame[i*7+2])<=plan.depth/2+.1);assert.ok(frame[i*7+1]>.02);}}
  }
});
test('motion is reproducible for a seed and varies independently of any dice result',async()=>{
  const a=await prepareThrow(5,[5,6,7,8]),b=await prepareThrow(5,[5,6,7,8]),c=await prepareThrow(5,[9,10,11,12]);
  assert.deepEqual(a.frames,b.frames);assert.notDeepEqual(a.frames[0],c.frames[0]);assert.notDeepEqual(a.frames.at(-1),c.frames.at(-1));
  // prepareThrow accepts a count and movement seed only, no face values or difficulty.
  const final=a.frames.at(-1),before=final.slice();
  for(let i=0;i<5;i++)for(let value=1;value<=10;value++){const q=Array.from(final.slice(i*7+3,i*7+7)),s=labelRotation(q,value);assert.equal(upwardValue(q,s),value);}
  assert.deepEqual(final,before);
});
test('constant shell orientation preserves the collider shape and actual Three quaternion end-face value',()=>{
  for(let source=0;source<10;source++){
    const q=new Quaternion().setFromAxisAngle(new Vector3(.3,.7,.2).normalize(),source*.57).toArray();
    for(let value=1;value<=10;value++){
      const s=labelRotation(q,value);
      for(const vertex of d10.vertices){const transformed=applyMatrix(vertex,s);assert.ok(Math.min(...d10.vertices.map(v=>distance(v,transformed)))<1e-8);}
      const matrix=new Matrix4().makeBasis(new Vector3(...s.slice(0,3)),new Vector3(...s.slice(3,6)),new Vector3(...s.slice(6,9))),skin=new Quaternion().setFromRotationMatrix(matrix),body=new Quaternion(...q);
      const ranked=d10.faces.map(f=>({value:f.value,up:new Vector3(...f.normal).applyQuaternion(skin).applyQuaternion(body).y})).sort((a,b)=>b.up-a.up);
      const wanted=ranked.find(f=>f.value===value);assert.ok(wanted.up>=ranked[0].up-1e-9);
      if(ranked[0].up-ranked[1].up<1e-6)assert.throws(()=>upwardValue(q,s),/eindeutige/);else{assert.equal(ranked[0].value,value);assert.equal(upwardValue(q,s),value);}
    }
  }
});
test('bevels stay within the original symmetric solid and keep complete triangle/UV data',()=>{
  const surface=bevelledSurface();assert.equal(surface.positions.length%9,0);assert.equal(surface.uvs.length,surface.positions.length/3*2);
  for(let i=0;i<surface.positions.length;i+=3){const p=Array.from(surface.positions.slice(i,i+3));for(const face of d10.faces){const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);assert.ok(dot(p,face.normal)<=dot(face.center,face.normal)+1e-6);}}
});
test('cancelled preparation releases its physics world without generating another outcome',async()=>{
  const c=new AbortController();c.abort();await assert.rejects(prepareThrow(5,[1,2,3,4],{signal:c.signal}),{name:'AbortError'});
  let iterations=0;const active=new AbortController();await assert.rejects(prepareThrow(30,[1,2,3,4],{signal:active.signal,yieldControl:async()=>{if(++iterations===1)active.abort();}}),{name:'AbortError'});
  const plan=await prepareThrow(1,[1,2,3,4]);assert.ok(plan.asleep);
});
test('movement PRNG is separate from outcome sampling and rejects invalid seeds/counts',async()=>{
  const r=motionRandom([1,2,3,4]),v=Array.from({length:100},()=>r());assert.ok(v.every(n=>n>=0&&n<1));assert.ok(new Set(v).size>95);
  assert.throws(()=>motionRandom([1,2]));await assert.rejects(prepareThrow(31,[1,2,3,4]));
});
test('stage throws launch outside and rest inside the same eight physical tray walls without retrying',async()=>{
  for(const count of [1,5,30])for(let n=0;n<6;n++){
    const plan=await prepareThrow(count,[n+100,n*91+21,n*837+9,n*13+83]);
    assert.deepEqual(plan.tray,trayLayout(count));assert.equal(plan.tray.walls.length,8);assert.ok(plan.asleep);
    assert.equal(plan.releaseTimes.length,count);assert.ok(plan.releaseTimes.every(t=>t>=0&&t<2));
    const first=plan.frames[0],last=plan.frames.at(-1);
    for(let i=0;i<count;i++){
      assert.ok(Math.hypot(first[i*7],first[i*7+2])>plan.tray.radius);
      for(const w of plan.tray.walls)assert.ok(last[i*7]*Math.cos(w.angle)+last[i*7+2]*Math.sin(w.angle)<=plan.tray.apothem-.08);
      const q=Array.from(last.slice(i*7+3,i*7+7));for(let value=1;value<=10;value++)assert.equal(upwardValue(q,labelRotation(q,value)),value);
    }
  }
});
