import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {emptyScene,sceneDocumentSchema} from '../domain/story-scene.ts';
import {emptyStage,stageSchema,stageVisible,changeStageObjects} from '../domain/live-stage.ts';
import {scenePreparation} from '../domain/session-overview.ts';
const gm={id:'gm',name:'SL',gm:true},a={id:'a',name:'A',gm:false},b={id:'b',name:'B',gm:false};
const whisper=(patch={})=>({id:crypto.randomUUID(),kind:'vision',title:'Vision',text:'PRIVATE_A',recipientIds:['a'],fileIds:[],...patch});
test('old scenes keep their legacy content and gain an empty private-delivery list',()=>{
 const d=emptyScene();delete d.whispers;d.visions='OLD';d.visionRecipientIds=['a'];
 const parsed=sceneDocumentSchema.parse(d);assert.deepEqual(parsed.whispers,[]);assert.equal(parsed.visions,'OLD');assert.deepEqual(parsed.visionRecipientIds,['a']);
});
test('each player can have several independent visions and letters in one scene',()=>{
 const list=[whisper(),whisper({kind:'letter',title:'Brief'}),whisper({recipientIds:['b'],text:'PRIVATE_B'})];
 const result=sceneDocumentSchema.parse({...emptyScene(),whispers:list});assert.deepEqual(result.whispers,list);
 assert.ok(scenePreparation(result).sections.includes('visions'));
});
test('IDs, recipients, limits and sanitized rich content are validated per entry',()=>{
 const w=whisper();assert.equal(sceneDocumentSchema.safeParse({...emptyScene(),whispers:[w,w]}).success,false);
 for(const patch of [{recipientIds:['a','a']},{fileIds:['file','file']},{kind:'pager'},{text:'a'.repeat(10001)},{id:'not-a-uuid'}])assert.equal(sceneDocumentSchema.safeParse({...emptyScene(),whispers:[{...w,...patch}]}).success,false);
 const safe=sceneDocumentSchema.parse({...emptyScene(),whispers:[whisper({text:'cvk-html-v1:<p>Safe</p><script>alert(1)</script>'})]});assert.ok(!safe.whispers[0].text.includes('<script>'));
});
test('personal content reuses document objects and the exact existing recipient projection',()=>{
 const source={title:'Brief',kind:'document',sourceId:'scene-whisper:scene:id',sourceKind:'record',ownerId:'gm',presentation:'letter',documentContent:'PRIVATE_A'};
 const state=changeStageObjects(emptyStage(),gm,{action:'add',kind:'document',sourceId:source.sourceId,sourceKind:'record',visible:true,recipients:['a']},source);
 const item=state.objects[0];assert.equal(item.presentation,'letter');assert.equal(stageVisible(item,gm),true);assert.equal(stageVisible(item,a),true);assert.equal(stageVisible(item,b),false);assert.ok(stageSchema.safeParse(state).success);
 assert.ok(item.rect.x>.65,'new envelopes start on the right');
 assert.throws(()=>changeStageObjects(state,b,{action:'documentEdit',id:item.id,content:'forged'}));
 assert.throws(()=>changeStageObjects(state,gm,{action:'documentEdit',id:item.id,content:'changed'}));
 assert.throws(()=>changeStageObjects(state,gm,{action:'visibility',id:item.id,visible:true,recipients:null}));
 assert.equal(changeStageObjects(state,gm,{action:'remove',id:item.id}).objects.length,0);assert.equal(state.objects.length,1);
});
test('new vision placement stays in the upper left without overwriting saved object positions',()=>{
 const source={title:'Vision',kind:'document',sourceId:'scene-whisper:s:v',sourceKind:'record',ownerId:'gm',presentation:'vision',documentContent:'Private'};
 const state=changeStageObjects(emptyStage(),gm,{action:'add',kind:'document',visible:true,recipients:['a']},source),item=state.objects[0];
 assert.ok(item.rect.x<.1&&item.rect.y<.1&&item.rect.h<.45);
 const rect={x:.4,y:.4,w:.3,h:.3};const moved=changeStageObjects(state,gm,{action:'move',id:item.id,rect});
 const replay=changeStageObjects(moved,gm,{action:'add',kind:'document',visible:true,recipients:['a']},source);assert.deepEqual(replay.objects[0].rect,rect);
});
test('decorative delivery assets are shipped as compact WebP files',()=>{
 let total=0;for(const name of ['envelope','paper','mist']){const p=new URL('../public/images/personal-delivery/'+name+'-v2.webp',import.meta.url),bytes=readFileSync(p);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');total+=statSync(p).size;}assert.ok(total<512000,'asset set stays below 500 KiB');
});
test('scene changes clear personal scene deliveries but preserve private sticky notes',()=>{
 let state=changeStageObjects(emptyStage(),a,{action:'add',kind:'note'});
 state=changeStageObjects(state,gm,{action:'add',kind:'document',visible:true,recipients:['a']},{title:'Vision',kind:'document',sourceId:'scene-whisper:s:w',sourceKind:'record',ownerId:'gm',presentation:'vision',documentContent:'Private'});
 const next=changeStageObjects(state,gm,{action:'activateScene',sceneId:'next'});assert.equal(next.objects.length,1);assert.equal(next.objects[0].kind,'note');
 const edited=changeStageObjects(next,a,{action:'edit',id:next.objects[0].id,expectedRevision:1,content:'Keep me'});assert.equal(edited.objects[0].content,'Keep me');
});
