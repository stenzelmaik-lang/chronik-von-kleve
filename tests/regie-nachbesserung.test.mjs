import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStage,changeStageObjects,stageSchema,stageCommandSchema,stageEffects,youtubeVideoId,youtubePlaylist,startYoutube,youtubeDefaultVolume} from '../domain/live-stage.ts';
import {sceneDocumentSchema,emptyScene} from '../domain/story-scene.ts';
import {mayOperate,allowedOperations,applyTableVitals,emptyTableVitals,tableVitalsSchema,tableCommandSchema,roundViewOf,damageByOf} from '../domain/character-vitals.ts';
// Regie-Nachbesserung: more atmosphere effects, YouTube music as an optional stage field, YouTube tracks in scenes.
const a={id:'a',name:'Player A',gm:false},gm={id:'sl',name:'SL',gm:true};

test('lighting and weather can be combined and stored in stable table order',()=>{
 const command=stageCommandSchema.parse({action:'effects',effects:['ritualglow','candlelight','fog','moonlight','rain']});
 const stage=changeStageObjects(emptyStage(),gm,command);
 assert.deepEqual(stageSchema.parse(stage).effects,['rain','fog','moonlight','candlelight','ritualglow']);
 assert.deepEqual(stageEffects.slice(0,7),['rain','fog','storm','snow','embers','darkness','flicker']);
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
 assert.equal(s.youtube,null,'An activated scene never inherits the previous YouTube source');
 s=changeStageObjects(s,gm,{action:'youtube',video:'dQw4w9WgXcQ'});
 s=changeStageObjects(s,gm,{action:'youtube',video:null});assert.equal(s.youtube,null);
});

test('the GM can stop both background sources in one command',()=>{
 const playing=changeStageObjects(emptyStage(),gm,{action:'youtube',video:'dQw4w9WgXcQ'});
 playing.music={fileId:'f-audio',title:'Dateimusik',key:'file-start'};
 const command={action:'stopMusic'};
 assert.equal(stageCommandSchema.safeParse(command).success,true);
 assert.throws(()=>changeStageObjects(playing,a,command),e=>e.status===403);
 const stopped=changeStageObjects(playing,gm,command);
 assert.equal(stopped.music,null);
 assert.equal(stopped.youtube,null);
 assert.equal(stopped.version,playing.version+1);
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

// Zustandswerte für die Runde: Sichtbarkeit und Schadensrecht als optionale Rundeneinstellungen.
test('round defaults: everyone sees the round, players enter their own damage; older table states stay valid',()=>{
 const old={format:1,version:4,profile:'empfohlen',stress:2,masquerade:{value:1,max:5,visible:false},nightlyWillpower:false,shared:[],log:[]};
 const parsed=tableVitalsSchema.parse(old);assert.equal('roundView' in parsed,false);
 assert.equal(roundViewOf(parsed),'all');assert.equal(damageByOf(parsed),'player');
 assert.equal(tableVitalsSchema.safeParse({...old,roundView:'everyone'}).success,false,'Strict values');
});
test('players damage only their own character, and only while the round allows it; the SL always may',()=>{
 const player={gm:false,id:'a'},gm={gm:true,id:'sl'};
 assert.ok(mayOperate('empfohlen',player,'a','damage',true));
 assert.ok(!mayOperate('empfohlen',player,'a','damage',false));
 assert.ok(!mayOperate('empfohlen',player,'b','damage',true),'Never someone else\'s character');
 assert.ok(!mayOperate('empfohlen',player,'a','heal',true),'Healing stays with the SL');
 assert.ok(mayOperate('sl',gm,'a','damage',false));
 assert.ok(allowedOperations('empfohlen',false,true).includes('damage'));assert.ok(!allowedOperations('empfohlen',false,false).includes('damage'));
});
test('only settings change round view and damage mode; unknown values are refused',()=>{
 let s=applyTableVitals(emptyTableVitals(),{op:'settings',roundView:'shared',damageBy:'sl'},'SL','t','1');
 assert.equal(s.roundView,'shared');assert.equal(s.damageBy,'sl');assert.ok(s.log[0].secret);
 s=applyTableVitals(s,{op:'settings',roundView:'all'},'SL','t','2');assert.equal(s.roundView,'all');assert.equal(s.damageBy,'sl');
 assert.equal(tableCommandSchema.safeParse({op:'settings',damageBy:'alle'}).success,false);
});

// Ambiente-Playlist: Szenenstart, Steuerung nur durch die SL, alte Stände bleiben gültig.
test('a playlist starts at a position with the base volume; old single-track states read as a playlist of one',()=>{
 const old={videoId:'dQw4w9WgXcQ',title:'Alt',key:'k'};
 assert.ok(stageSchema.safeParse({format:1,version:1,objects:[],youtube:old}).success,'First YouTube version stays valid');
 assert.deepEqual(youtubePlaylist(old),{tracks:[{videoId:'dQw4w9WgXcQ',title:'Alt'}],index:0,playing:true,volume:youtubeDefaultVolume,label:'Alt'});
 const tracks=[{videoId:'l8GAZU4eY7g',title:'Wald'},{videoId:'dQw4w9WgXcQ',title:'Bar'}];
 let s=startYoutube(emptyStage(),tracks,{label:'Szene 1',sceneId:'s1'});
 assert.equal(s.youtube.videoId,'l8GAZU4eY7g');assert.equal(s.youtube.volume,youtubeDefaultVolume);assert.equal(s.youtube.playing,true);assert.equal(s.youtube.label,'Szene 1');
 s={...s,youtube:{...s.youtube,volume:60}};
 const again=startYoutube(s,tracks.slice(1),{label:'Bar'});assert.equal(again.youtube.volume,60,'The GM base volume survives a new playlist');assert.notEqual(again.youtube.key,s.youtube.key);
 assert.equal(stageSchema.safeParse(s).success,true);
});
test('only the GM controls: play/pause keep the track, next/previous wrap, select checks the range, volume 0–100',()=>{
 const a={id:'a',name:'A',gm:false},gm={id:'sl',name:'SL',gm:true};
 let s=changeStageObjects(emptyStage(),gm,{action:'youtubeList',tracks:[{video:'https://youtu.be/l8GAZU4eY7g',title:'Eins'},{video:'dQw4w9WgXcQ'}],label:'Wald'});
 assert.deepEqual(s.youtube.tracks.map(t=>t.title),['Eins','Titel 2']);
 for(const c of [{action:'youtubeControl',op:'pause'},{action:'youtubeList',tracks:[{video:'dQw4w9WgXcQ'}]}])assert.throws(()=>changeStageObjects(s,a,c),e=>e.status===403);
 const key=s.youtube.key;
 s=changeStageObjects(s,gm,{action:'youtubeControl',op:'pause'});assert.equal(s.youtube.playing,false);assert.equal(s.youtube.key,key,'Pause does not reload');
 s=changeStageObjects(s,gm,{action:'youtubeControl',op:'next'});assert.equal(s.youtube.index,1);assert.equal(s.youtube.videoId,'dQw4w9WgXcQ');assert.equal(s.youtube.playing,true);assert.notEqual(s.youtube.key,key);
 s=changeStageObjects(s,gm,{action:'youtubeControl',op:'next'});assert.equal(s.youtube.index,0,'Wraps around');
 s=changeStageObjects(s,gm,{action:'youtubeControl',op:'previous'});assert.equal(s.youtube.index,1);
 assert.throws(()=>changeStageObjects(s,gm,{action:'youtubeControl',op:'select',index:5}),e=>e.status===400);
 s=changeStageObjects(s,gm,{action:'youtubeControl',op:'volume',volume:40});assert.equal(s.youtube.volume,40);
 assert.equal(stageCommandSchema.safeParse({action:'youtubeControl',op:'volume',volume:140}).success,false);
 assert.throws(()=>changeStageObjects(s,gm,{action:'youtubeList',tracks:[{video:'https://example.com/x'}]}),e=>e.status===400);
 assert.throws(()=>changeStageObjects(emptyStage(),gm,{action:'youtubeControl',op:'play'}),e=>e.status===404);
});
