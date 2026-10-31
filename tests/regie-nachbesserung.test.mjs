import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStage,changeStageObjects,stageSchema,stageCommandSchema,stageEffects,youtubeVideoId} from '../domain/live-stage.ts';
import {sceneDocumentSchema,emptyScene} from '../domain/story-scene.ts';
// Regie-Nachbesserung: more atmosphere effects, YouTube music as an optional stage field, YouTube tracks in scenes.
const a={id:'a',name:'Player A',gm:false},gm={id:'sl',name:'SL',gm:true};

test('new effects are known, combinable and keep the stable table order',()=>{
 assert.deepEqual([...stageEffects],['rain','fog','storm','snow','embers','darkness','flicker']);
 const s=changeStageObjects(emptyStage(),gm,{action:'effects',effects:['flicker','storm','rain','snow','embers','darkness','fog']});
 assert.deepEqual(s.effects,['rain','fog','storm','snow','embers','darkness','flicker']);
 assert.equal(stageCommandSchema.safeParse({action:'effects',effects:['lightning']}).success,false,'Unknown names stay refused');
 assert.throws(()=>changeStageObjects(emptyStage(),a,{action:'effects',effects:['snow']}),e=>e.status===403);
});

test('YouTube links are reduced to the video id; anything else is refused',()=>{
 const id='dQw4w9WgXcQ';
 for(const link of [id,'https://www.youtube.com/watch?v='+id,'https://youtube.com/watch?v='+id+'&t=42s','https://youtu.be/'+id+'?si=abc','youtu.be/'+id,'https://www.youtube.com/embed/'+id,'https://www.youtube-nocookie.com/embed/'+id,'https://www.youtube.com/shorts/'+id,'https://music.youtube.com/watch?v='+id,'https://m.youtube.com/watch?v='+id])
  assert.equal(youtubeVideoId(link),id,link);
 for(const bad of ['','https://example.com/watch?v='+id,'https://youtube.com.evil.test/watch?v='+id,'javascript:alert(1)','https://www.youtube.com/watch?v=short','https://youtu.be/'+id+'x','ftp://youtu.be/'+id,'<script>'])
  assert.equal(youtubeVideoId(bad),undefined,bad);
});

test('only the GM starts and stops YouTube music; the stage stores the id, a title and a fresh key',()=>{
 assert.throws(()=>changeStageObjects(emptyStage(),a,{action:'youtube',video:'dQw4w9WgXcQ'}),e=>e.status===403);
 assert.throws(()=>changeStageObjects(emptyStage(),gm,{action:'youtube',video:'https://example.com'}),e=>e.status===400);
 let s=changeStageObjects(emptyStage(),gm,{action:'youtube',video:'https://youtu.be/dQw4w9WgXcQ',title:'Regennacht'});
 assert.equal(s.youtube.videoId,'dQw4w9WgXcQ');assert.equal(s.youtube.title,'Regennacht');
 const first=s.youtube.key;
 s=changeStageObjects(s,gm,{action:'youtube',video:'dQw4w9WgXcQ'});
 assert.notEqual(s.youtube.key,first,'Starting again restarts for everyone');assert.equal(s.youtube.title,'YouTube-Musik');
 s=changeStageObjects(s,gm,{action:'activateScene',sceneId:'next'},undefined,null);
 assert.equal(s.youtube.videoId,'dQw4w9WgXcQ','Music is an explicit GM choice and survives a scene change');
 s=changeStageObjects(s,gm,{action:'youtube',video:null});assert.equal(s.youtube,null);
});

test('stored stages and scenes from before stay valid; strict parsers still refuse unknown data',()=>{
 const old={format:1,version:3,objects:[],effects:['rain','fog'],music:null,pagers:[]};
 assert.deepEqual(stageSchema.parse(old),old);
 assert.equal(stageSchema.safeParse({...old,youtube:{videoId:'dQw4w9WgXcQ',title:'x',key:'k',url:'https://…'}}).success,false);
 assert.equal(stageSchema.safeParse({...old,youtube:{videoId:'not valid!!',title:'x',key:'k'}}).success,false);
 const scene=sceneDocumentSchema.parse(emptyScene());
 assert.equal('youtube' in scene,false,'Scenes without YouTube music keep their shape');
 const withMusic=sceneDocumentSchema.parse({...emptyScene(),youtube:[{id:'6f1c2b9e-1d2a-4c3b-9e8f-0a1b2c3d4e5f',title:'Kaserne',videoId:'dQw4w9WgXcQ'}]});
 assert.equal(withMusic.youtube[0].videoId,'dQw4w9WgXcQ');
 assert.equal(sceneDocumentSchema.safeParse({...emptyScene(),youtube:[{id:'6f1c2b9e-1d2a-4c3b-9e8f-0a1b2c3d4e5f',title:'x',videoId:'https://youtu.be/dQw4w9WgXcQ'}]}).success,false,'Only the reduced id is stored');
});
