import test from 'node:test';
import assert from 'node:assert/strict';
import {d10,dot,orient,spin,makeDicePresentation} from './dice-geometry.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));

test('D10 is a closed 10-face kite solid with 12 vertices and 20 shared edges',()=>{
  assert.equal(d10.vertices.length,12);assert.equal(d10.faces.length,10);
  assert.deepEqual(d10.faces.map(f=>f.value).sort((a,b)=>a-b),[1,2,3,4,5,6,7,8,9,10]);
  const edges=new Map(),lengthSets=[];
  for(const face of d10.faces){
    assert.equal(face.indices.length,4);assert.equal(new Set(face.indices).size,4);
    const plane=dot(face.normal,face.center),lengths=[];
    face.indices.forEach((a,i)=>{const b=face.indices[(i+1)%4],key=[a,b].sort((x,y)=>x-y).join('-');edges.set(key,(edges.get(key)||0)+1);near(dot(face.normal,d10.vertices[a]),plane);lengths.push(distance(d10.vertices[a],d10.vertices[b]));});
    lengths.sort((a,b)=>a-b);near(lengths[0],lengths[1]);near(lengths[2],lengths[3]);lengthSets.push(lengths);
  }
  assert.equal(edges.size,20);assert.ok([...edges.values()].every(count=>count===2));
  for(const lengths of lengthSets)lengths.forEach((v,i)=>near(v,lengthSets[0][i]));
});
test('opposite D10 face values sum to 11',()=>{
  for(const face of d10.faces){const opposite=d10.faces.find(f=>dot(f.normal,face.normal)<-.999999);assert.ok(opposite);assert.equal(opposite.value+face.value,11);}
});
test('every returned value, including 10, finishes facing the camera with upright label axes',()=>{
  for(let value=1;value<=10;value++){
    const face=d10.faces.find(f=>f.value===value),normal=orient(face.normal,value),up=orient(face.up,value),right=orient(face.right,value);
    near(normal[0],0);near(normal[1],0);near(normal[2],1);near(up[1],1);near(right[0],1);
    for(const point of d10.vertices)spin(orient(point,value),1).forEach((n,i)=>near(n,orient(point,value)[i]));
  }
});
test('visual tumbling preserves geometry and ends exactly at the supplied result',()=>{
  for(const point of d10.vertices)for(const progress of [0,.1,.4,.75,1]){
    const rotated=spin(point,progress,7);assert.ok(rotated.every(Number.isFinite));near(Math.hypot(...point),Math.hypot(...rotated));
  }
});
test('presentation copies immutable raw results without rerolling, sorting or interpreting them',()=>{
  const raw=[10,1,9,2,6],presentation=makeDicePresentation(raw,6);
  assert.deepEqual(presentation.dice,raw);assert.notEqual(presentation.dice,raw);assert.equal(presentation.target,6);
  raw[0]=3;assert.equal(presentation.dice[0],10);assert.throws(()=>presentation.dice.push(4),TypeError);assert.throws(()=>presentation.target=8,TypeError);
});
test('invalid presentation input fails while all supported pools preserve their exact order',()=>{
  for(const [dice,target] of [[[],6],[[0],6],[[11],6],[[1.5],6],[[5],1],[[5],11],[Array(31).fill(6),6]])assert.throws(()=>makeDicePresentation(dice,target));
  for(const n of [1,5,30]){const values=Array.from({length:n},(_,i)=>i%10+1);assert.deepEqual(makeDicePresentation(values,10).dice,values);}
});
