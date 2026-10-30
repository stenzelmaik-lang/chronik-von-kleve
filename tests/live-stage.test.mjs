import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStage,changeStageObjects,stageVisible,stageCommandSchema,stageSchema,stageSourceToken} from '../domain/live-stage.ts';
const a={id:'a',name:'Player A',gm:false},b={id:'b',name:'Player B',gm:false},gm={id:'sl',name:'SL',gm:true};
test('publication detects changed merged Legacy content even without an Entity revision change',async()=>{
 const npc={type:'NPC',title:'Original',content:{image_primary:'/api/files?id=reviewed',role:'SECRET'}};
 const reviewed=await stageSourceToken(npc);
 assert.notEqual(reviewed,await stageSourceToken({...npc,content:{...npc.content,image_primary:'/api/files?id=new-private'}}));
 assert.equal(reviewed,await stageSourceToken({...npc,content:{...npc.content,role:'OTHER SECRET'}}));
 const handout={type:'HANDOUT',title:'Original',content:{text:'Reviewed text'}};
 assert.notEqual(await stageSourceToken(handout),await stageSourceToken({...handout,content:{text:'New private fallback text'}}));
});
test('private notes go only to the creator and GM; only creator can edit or release',()=>{
 let s=changeStageObjects(emptyStage(),a,{action:'add',kind:'note'}),n=s.objects[0];
 assert.equal(stageVisible(n,a),true);assert.equal(stageVisible(n,gm),true);assert.equal(stageVisible(n,b),false);
 for(const actor of [b,gm])assert.throws(()=>changeStageObjects(s,actor,{action:'edit',id:n.id,content:'forged',expectedRevision:1}),e=>e.status===403);
 s=changeStageObjects(s,a,{action:'edit',id:n.id,content:'PRIVATE',expectedRevision:1});
 assert.throws(()=>changeStageObjects(s,a,{action:'edit',id:n.id,content:'lost',expectedRevision:1}),e=>e.status===409);
 s=changeStageObjects(s,a,{action:'visibility',id:n.id,visibility:'group',expectedRevision:2});assert.equal(stageVisible(s.objects[0],b),true);
 s=changeStageObjects(s,a,{action:'visibility',id:n.id,visibility:'private',expectedRevision:3});assert.equal(stageVisible(s.objects[0],b),false);
});
test('original objects stay private until explicit publication to exact recipients',()=>{
 const source={title:'Original',kind:'npc',sourceKind:'entity',sourceId:'original-id'};
 assert.throws(()=>changeStageObjects(emptyStage(),a,{action:'add',kind:'npc'},source),e=>e.status===403);
 let s=changeStageObjects(emptyStage(),gm,{action:'add',kind:'npc'},source),n=s.objects[0];assert.equal(stageVisible(n,a),false);
 s=changeStageObjects(s,gm,{action:'visibility',id:n.id,visible:true,recipients:['a']});assert.equal(stageVisible(s.objects[0],a),true);assert.equal(stageVisible(s.objects[0],b),false);
 assert.throws(()=>changeStageObjects(s,a,{action:'remove',id:n.id}),e=>e.status===403);
 s=changeStageObjects(s,gm,{action:'add',kind:'npc'},source);assert.equal(s.objects.length,1);
 s=changeStageObjects(s,gm,{action:'visibility',id:n.id,visible:false});assert.equal(stageVisible(s.objects[0],a),false);
});
test('commands and stored states reject forged owners, payloads and positions',()=>{
 assert.equal(stageCommandSchema.safeParse({action:'add',kind:'note',ownerId:'sl'}).success,false);
 assert.equal(stageCommandSchema.safeParse({action:'move',id:'x',rect:{x:.95,y:0,w:.5,h:.4}}).success,false);
 assert.equal(stageSchema.safeParse({format:2,version:0,objects:[]}).success,false);
 let s=changeStageObjects(emptyStage(),a,{action:'add',kind:'note'});assert.equal(emptyStage().objects.length,0);assert.equal(s.version,1);
 assert.throws(()=>changeStageObjects(s,a,{action:'edit',id:s.objects[0].id,content:'x'.repeat(3001),expectedRevision:1}));
});

test('scene media: backdrop, polaroid release in one step, scene change clears table material but keeps notes',()=>{
 const photo={title:'Foto Tor',kind:'document',sourceId:'file-photo',sourceKind:'file',media:'image'};
 let s=changeStageObjects(emptyStage(),a,{action:'add',kind:'note'});
 assert.throws(()=>changeStageObjects(s,a,{action:'backdrop',fileId:'f'},undefined,{fileId:'f',title:'T',sceneId:''}),e=>e.status===403,'Players cannot change the backdrop');
 s=changeStageObjects(s,gm,{action:'backdrop',fileId:'bg'},undefined,{fileId:'bg',title:'Kaserne',sceneId:'scene-1'});
 assert.equal(s.backdrop.fileId,'bg');
 s=changeStageObjects(s,gm,{action:'add',kind:'document',sourceId:'file-photo',sourceKind:'file',visible:true,recipients:['a']},photo);
 const card=s.objects.find(o=>o.kind==='document');
 assert.equal(card.media,'image');assert.ok(card.rect.w<.25,'Photos are placed as small cards');
 assert.equal(stageVisible(card,a),true);assert.equal(stageVisible(card,b),false,'Targeted photo stays hidden from B');
 s=changeStageObjects(s,gm,{action:'add',kind:'document',sourceId:'file-photo',sourceKind:'file',visible:true,recipients:null},photo);
 assert.equal(s.objects.filter(o=>o.kind==='document').length,1,'Placing again changes the release, never duplicates');
 assert.equal(stageVisible(s.objects.find(o=>o.kind==='document'),b),true);
 s=changeStageObjects(s,gm,{action:'activateScene',sceneId:'scene-2'},undefined,null);
 assert.deepEqual(s.objects.map(o=>o.kind),['note'],'Scene change removes previous material, keeps player notes');
 assert.equal(s.backdrop,null,'A scene without backdrop returns to the default stage');assert.equal(s.sceneId,'scene-2');
 assert.equal(stageSchema.safeParse(s).success,true);
 assert.equal(stageSchema.safeParse({format:1,version:0,objects:[]}).success,true,'Stages stored before this change stay readable');
 assert.equal(stageCommandSchema.safeParse({action:'backdrop',fileId:null}).success,true);
});