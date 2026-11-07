import test from 'node:test';
import assert from 'node:assert/strict';
import {materialSchema,materialMimeMatches} from '../domain/table-material.ts';
import {emptyStage,changeStageObjects,stageVisible,stageSchema,stageCommandSchema} from '../domain/live-stage.ts';
const a={id:'a',name:'A',gm:false},b={id:'b',name:'B',gm:false},gm={id:'gm',name:'SL',gm:true};
const source={title:'Arbeitsblatt',kind:'document',sourceKind:'record',sourceId:'prepared-1',sourceVersion:1,ownerId:'a',documentContent:'Name: …'};
const add={action:'add',kind:'document',sourceKind:'record',sourceId:'prepared-1',visible:true,recipients:['b']};
test('material validates titles, bounded text and type-compatible attachments',()=>{
 assert.ok(materialSchema.safeParse({title:'Notiz',kind:'document',text:'',fileId:''}).success);
 for(const draft of [{title:'',kind:'document',text:'',fileId:''},{title:'Bild',kind:'image',text:'',fileId:''},{title:'Lang',kind:'document',text:'a'.repeat(130001),fileId:''}])assert.equal(materialSchema.safeParse(draft).success,false);
 assert.equal(materialMimeMatches('image','application/pdf'),false);assert.equal(materialMimeMatches('pdf','application/pdf'),true);assert.equal(materialMimeMatches('audio','audio/mpeg'),true);
});
test('only author-owned server-resolved records may be staged by players',()=>{
 assert.throws(()=>changeStageObjects(emptyStage(),a,add,{...source,ownerId:'b'}),e=>e.status===403);
 assert.throws(()=>changeStageObjects(emptyStage(),a,add,{...source,sourceKind:'entity'}),e=>e.status===403);
 assert.throws(()=>changeStageObjects(emptyStage(),a,add),e=>e.status===403);
 const s=changeStageObjects(emptyStage(),a,add,source);assert.equal(s.objects[0].ownerId,'a');
 assert.equal(stageVisible(s.objects[0],a),true);assert.equal(stageVisible(s.objects[0],b),true);assert.equal(stageVisible(s.objects[0],{id:'other',gm:false}),false);assert.equal(stageVisible(s.objects[0],gm),true);
});
test('working content, placement and recipients are versioned through the existing stage',()=>{
 let s=changeStageObjects(emptyStage(),a,add,source),id=s.objects[0].id;
 assert.throws(()=>changeStageObjects(s,b,{action:'documentEdit',id,content:'fremd'}),e=>e.status===403);
 s=changeStageObjects(s,a,{action:'documentEdit',id,content:'Name: ausgefüllt'});assert.equal(s.objects[0].documentContent,'Name: ausgefüllt');assert.equal(source.documentContent,'Name: …');
 s=changeStageObjects(s,a,{action:'move',id,rect:{x:.1,y:.2,w:.2,h:.3}});assert.equal(s.objects[0].rect.x,.1);
 s=changeStageObjects(s,a,{action:'visibility',id,visible:false});assert.equal(stageVisible(s.objects[0],b),false);assert.equal(stageVisible(s.objects[0],a),true);
 s=changeStageObjects(s,a,{action:'remove',id});assert.equal(s.objects.length,0);
});
test('players retain no authority over GM objects, private notes or scene controls',()=>{
 const s=changeStageObjects(emptyStage(),gm,{...add,sourceKind:'entity'},{...source,sourceKind:'entity',ownerId:undefined});
 assert.throws(()=>changeStageObjects(s,a,{action:'remove',id:s.objects[0].id}),e=>e.status===403);
 const n=changeStageObjects(emptyStage(),b,{action:'add',kind:'note'});assert.throws(()=>changeStageObjects(n,a,{action:'documentEdit',id:n.objects[0].id,content:'overwrite'}),e=>e.status===403);
 assert.throws(()=>changeStageObjects(emptyStage(),a,{action:'activateScene',sceneId:'x'}),e=>e.status===403);
});
test('older stages stay valid and clients cannot forge ownership or initial document content',()=>{
 assert.ok(stageSchema.safeParse(emptyStage()).success);
 assert.equal(stageCommandSchema.safeParse({...add,ownerId:'b'}).success,false);
 assert.equal(stageCommandSchema.safeParse({...add,documentContent:'forged'}).success,false);
});

test('personal working copies survive scene changes; explicit re-placement resets old file metadata',()=>{
 let s=changeStageObjects(emptyStage(),a,add,{...source,media:'image',sourceFileId:'photo'});
 s=changeStageObjects(s,a,add,source);assert.equal(s.objects[0].sourceFileId,undefined);assert.equal(s.objects[0].media,undefined);
 s=changeStageObjects(s,gm,{action:'activateScene',sceneId:'next'});assert.equal(s.objects[0].documentContent,source.documentContent);
});

test('per-document revisions ignore other table activity but reject conflicting document edits',()=>{
 let s=changeStageObjects(emptyStage(),a,add,source),id=s.objects[0].id;
 s=changeStageObjects(s,a,{action:'move',id,rect:{x:.2,y:.2,w:.2,h:.3}});
 s=changeStageObjects(s,a,{action:'documentEdit',id,content:'A',expectedDocumentRevision:1});assert.equal(s.objects[0].documentRevision,2);
 assert.throws(()=>changeStageObjects(s,gm,{action:'documentEdit',id,content:'stale',expectedDocumentRevision:1}),e=>e.status===409);
});
test('a paged handout keeps page identities and order without splitting into different table objects',()=>{
 const pages=Array.from({length:7},(_,i)=>({id:crypto.randomUUID(),fileId:'page-'+i,title:'Seite '+(i+1)}));
 const draft=materialSchema.parse({title:'Anselm-Paket (synthetisch)',kind:'handout',text:'',fileId:'',pages});assert.deepEqual(draft.pages,pages);
 const s=changeStageObjects(emptyStage(),a,add,{...source,media:'pages',pages});assert.equal(s.objects.length,1);assert.deepEqual(s.objects[0].pages,pages);
 assert.equal(materialSchema.safeParse({...draft,pages:[pages[0],pages[0]]}).success,false);
 assert.equal(materialSchema.safeParse({...draft,fileId:'single'}).success,false);
 assert.equal(materialSchema.safeParse({...draft,kind:'image'}).success,false);
});
