import {test} from 'node:test';
import assert from 'node:assert/strict';
import {audioTime,audioPosition,audioPeaks,fitAudioDevice,rotaryDelta,rotaryPointer,rotaryVolume} from '../domain/audio-player.ts';
import {emptyStage,changeStageObjects,stageCommandSchema} from '../domain/live-stage.ts';

test('Audio times are finite, non-negative, and support recordings over an hour',()=>{
 assert.equal(audioTime(NaN),'00:00');assert.equal(audioTime(Infinity),'00:00');assert.equal(audioTime(-4),'00:00');
 assert.equal(audioTime(61.8),'01:01');assert.equal(audioTime(3601),'1:00:01');
});
test('Seeking never exceeds a known recording, and unknown duration is not seekable',()=>{
 assert.equal(audioPosition(-10,60),0);assert.equal(audioPosition(90,60),60);assert.equal(audioPosition(12.3,60),12.3);
 assert.equal(audioPosition(NaN,60),0);assert.equal(audioPosition(5,Infinity),0);assert.equal(audioPosition(5,0),0);
});
test('Waveform represents actual signal including the right channel and the last sample',()=>{
 assert.deepEqual(audioPeaks([new Float32Array([0,.5,0,-1]),new Float32Array([.75,0,0,.25])],2),[.75,1]);
 assert.deepEqual(audioPeaks([new Float32Array([0,0,0,.5])],3),[0,0,.5]);
});
test('Silence is not replaced with a decorative fake waveform',()=>{
 assert.deepEqual(audioPeaks([new Float32Array(8)],4),[0,0,0,0]);
});
test('Waveform handles empty, short, or invalid samples without NaN or amplification',()=>{
 assert.deepEqual(audioPeaks([],160),[]);assert.deepEqual(audioPeaks([new Float32Array([.5])],160),[.5]);
 assert.deepEqual(audioPeaks([new Float32Array([NaN,Infinity,2])],3),[0,0,1]);
 assert.deepEqual(audioPeaks([new Float32Array([1])],0),[]);
});
test('Physical audio device stays inside desktop, phone, and short landscape playfields',()=>{
 for(const bounds of [{w:1384,h:894},{w:390,h:788},{w:844,h:280}]){
  for(const layout of [{x:.9,y:.95,width:800},{x:-1,y:-1,width:9000},{x:NaN,y:Infinity,width:NaN}]){
   const d=fitAudioDevice(layout,bounds);assert.ok(d.x>=0&&d.y>=0&&d.width>0);
   assert.ok(d.x*bounds.w+d.width<=bounds.w+.001);assert.ok(d.y*bounds.h+d.width*941/1671<=bounds.h+.001);
  }
 }
});
test('Rotary volume follows the shortest turn across the angle seam, clamps, and permits fine adjustment',()=>{
 assert.equal(rotaryDelta(179,-179),2);assert.equal(rotaryDelta(-179,179),-2);
 assert.equal(rotaryVolume(.5,0,135),1);assert.equal(rotaryVolume(.5,0,-135),0);
 assert.equal(rotaryVolume(.9,0,90),1);assert.equal(rotaryVolume(.1,0,-90),0);
 assert.ok(Math.abs(rotaryVolume(.5,0,135,true)-.6)<1e-9);
 assert.equal(rotaryVolume(.4,NaN,90),.4);assert.equal(rotaryVolume(NaN,0,0),0);
});
test('Rotary pointer uses the inclined cap plane, clockwise direction, and a quiet centre',()=>{
 const r={left:10,top:20,width:100,height:70},cx=60,cy=43.8;
 assert.equal(rotaryPointer(cx,cy,r),null);
 assert.ok(Math.abs(rotaryPointer(cx,cy-21,r))<1e-9);
 assert.ok(Math.abs(rotaryPointer(cx+50,cy,r)-90)<1e-9);
 assert.ok(Math.abs(rotaryPointer(cx-50,cy,r)+90)<1e-9);
 assert.equal(rotaryPointer(NaN,cy,r),null);assert.equal(rotaryPointer(cx,cy,{...r,width:0}),null);
});
const gm={id:'sl',name:'SL',gm:true},player={id:'p',name:'Spieler',gm:false};
function audioStage(){
 let s=changeStageObjects(emptyStage(),player,{action:'add',kind:'note'});
 for(const [id,media] of [['a','audio'],['b','audio'],['photo','image']])s=changeStageObjects(s,gm,{action:'add',kind:'document',sourceId:id,sourceKind:'file',visible:true},{title:id,kind:'document',sourceId:id,sourceKind:'file',media});
 return s;
}
test('Withdrawing the device removes only audio in one versioned mutation; source state stays unchanged',()=>{
 const s=audioStage(),before=structuredClone(s),next=changeStageObjects(s,gm,{action:'withdrawAudio'});
 assert.equal(next.version,s.version+1);assert.deepEqual(next.objects.map(o=>o.kind==='note'?'note':o.media),['note','image']);
 assert.deepEqual(s,before);assert.equal(stageCommandSchema.safeParse({action:'withdrawAudio'}).success,true);
 assert.equal(stageCommandSchema.safeParse({action:'withdrawAudio',ids:['photo']}).success,false);
});
test('Players cannot withdraw the shared device even when they can move their own personal view',()=>{
 assert.throws(()=>changeStageObjects(audioStage(),player,{action:'withdrawAudio'}),e=>e.status===403);
});
test('The audio device and its released tracks survive scene changes until explicitly withdrawn',()=>{
 const next=changeStageObjects(audioStage(),gm,{action:'activateScene',sceneId:'next-scene'},undefined,null);
 assert.equal(next.objects.filter(o=>o.kind!=='note'&&o.media==='audio').length,2);
 assert.equal(next.objects.some(o=>o.kind!=='note'&&o.media==='image'),false);
 assert.equal(next.objects.some(o=>o.kind==='note'),true);
});
