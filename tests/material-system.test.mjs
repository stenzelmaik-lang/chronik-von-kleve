// Spielmaterial 3.0 – domain rules: material block on scene elements, legacy compatibility, effects and fallbacks,
// display assets and the table object. Run: node --experimental-strip-types --test tests/material-system.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {defaultMaterial,displayAssetSchema,effectProblem,effectSupport,effectiveEffect,isMaterialElement,legacyFileEntryId,materialOf,materialSummary,materialTypeInfo,materialTypes,mimeFits,sceneMaterialSchema,withMaterial} from '../domain/material-system.ts';
import {sceneElementSchema,sceneDocumentSchema,emptyScene} from '../domain/story-scene.ts';
import {stageSchema,emptyStage,changeStageObjects} from '../domain/live-stage.ts';

const element=(extra={})=>({id:randomUUID(),kind:'image',title:'Foto',text:'',referenceId:'',fileId:'',...extra});
const gm={id:'gm',name:'SL',gm:true};

test('older elements without a material block stay valid and become a one-file material',()=>{
 const legacy=element({fileId:'file-1'});
 assert.equal(sceneElementSchema.safeParse(legacy).success,true);
 const m=materialOf(legacy);
 assert.equal(m.type,'image');assert.equal(m.files.length,1);assert.equal(m.files[0].fileId,'file-1');
 assert.equal(m.files[0].id,legacyFileEntryId('file-1'),'the implicit entry id is stable');
 assert.equal(sceneMaterialSchema.safeParse(m).success,true,'the derived id is a valid uuid');
 assert.equal(materialOf(element({kind:'handout'})).type,'letter');
 assert.equal(materialOf(element({kind:'check'})).type,'other');
 assert.equal(isMaterialElement(element({kind:'check'})),false,'checks keep their own editor');
 assert.equal(isMaterialElement(element({kind:'pager'})),true);
});

test('a material block mirrors its first file into the element and must match the element kind',()=>{
 const m={...defaultMaterial('dossier'),files:[{id:randomUUID(),fileId:'a',title:'Seite 1'},{id:randomUUID(),fileId:'b',title:''}]};
 const e=withMaterial(element(),m);
 assert.equal(e.kind,'handout');assert.equal(e.fileId,'a');
 assert.equal(sceneElementSchema.safeParse(e).success,true);
 assert.equal(sceneElementSchema.safeParse({...e,kind:'audio'}).success,false,'type and kind must fit');
 const pager=withMaterial(element({kind:'pager',pager:{sender:'',text:'Hallo',priority:'normal',recipientIds:[]}}),defaultMaterial('pager'));
 assert.equal(pager.fileId,'');assert.equal(sceneElementSchema.safeParse(pager).success,true);
 assert.equal(sceneElementSchema.safeParse({...pager,material:{...pager.material,files:[{id:randomUUID(),fileId:'x',title:''}]}}).success,false,'pager materials carry no files');
 const other=withMaterial(element(),defaultMaterial('other'));assert.equal(other.kind,'object');
 const backdrop=withMaterial(element(),defaultMaterial('backdrop'));assert.equal(backdrop.kind,'image');
});

test('a scene with materials of every type round-trips through the scene document schema',()=>{
 const doc={...emptyScene(),elements:materialTypes.map(t=>withMaterial(element(t==='pager'?{kind:'pager',pager:{sender:'',text:'x',priority:'normal',recipientIds:[]}}:{}),defaultMaterial(t)))};
 const parsed=sceneDocumentSchema.safeParse(doc);
 assert.equal(parsed.success,true,JSON.stringify(parsed.error?.issues));
 assert.deepEqual(parsed.data.elements.map(e=>e.material.type),[...materialTypes]);
});

test('effects that need asset states or several files fall back to a simpler effect and say so',()=>{
 assert.equal(effectSupport('unseal',{states:['closed','open'],files:1}).ok,true);
 assert.deepEqual(effectSupport('unseal',{states:['closed'],files:1}).missing,['open']);
 assert.equal(effectiveEffect('unseal',{states:['closed'],files:1}),'fade');
 assert.equal(effectiveEffect('open-book',{states:['closed'],files:3}),'open-book');
 assert.equal(effectiveEffect('fan',{states:[],files:1}),'fade');
 assert.equal(effectiveEffect('fan',{states:[],files:6}),'fan');
 assert.match(effectProblem('unfold',{states:[],files:1}),/braucht eine Darstellung mit dem Zustand Geschlossen und Geöffnet.*Einblenden/);
 assert.equal(effectProblem('fade',{states:[],files:0}),'');
 for(const t of materialTypes)for(const e of materialTypeInfo[t].effects)assert.ok(effectiveEffect(e,{states:[],files:0}),'every offered effect has a fallback');
});

test('display assets need a closed state, unique states and images only by reference',()=>{
 const ok={title:'Umschlag',kind:'envelope',states:[{key:'closed',label:'Geschlossen',fileId:'f1'},{key:'open',label:'Geöffnet',fileId:'f2'}],tags:[]};
 assert.equal(displayAssetSchema.safeParse(ok).success,true);
 assert.equal(displayAssetSchema.safeParse({...ok,states:[ok.states[1]]}).success,false,'closed is required');
 assert.equal(displayAssetSchema.safeParse({...ok,states:[ok.states[0],ok.states[0]]}).success,false,'states are unique');
 assert.equal(displayAssetSchema.safeParse({...ok,states:[{key:'Closed!',label:'',fileId:'f'}]}).success,false,'state keys are slugs');
});

test('file types fit the material type',()=>{
 assert.equal(mimeFits('image','image/png'),true);assert.equal(mimeFits('image','application/pdf'),false);
 assert.equal(mimeFits('document','application/pdf'),true);assert.equal(mimeFits('audio','video/mp4'),false);
 assert.equal(materialSummary(defaultMaterial('dossier'),6),'Akte / Paket · 6 Dateien · Mappe / Buch (Einzelseite) · Einblenden');
});

test('the table object carries the material view; refreshing it drops a stale one; older stages stay valid',()=>{
 assert.equal(stageSchema.safeParse({format:1,version:3,objects:[],backdrop:{fileId:'b',title:'Alt',sceneId:'s'}}).success,true,'stage from before');
 const material={type:'dossier',display:'stack',effect:{open:'unseal',close:'fade',speed:'normal',afterClose:'open',sound:false},states:[{key:'closed',fileId:'c'},{key:'open',fileId:'o'}]};
 const pages=[{id:randomUUID(),fileId:'p1',title:'Foto 1'},{id:randomUUID(),fileId:'p2',title:'Foto 2'}];
 const source={title:'Paket',kind:'document',sourceId:'scene-material:s:e',sourceKind:'record',sourceVersion:2,ownerId:'gm',media:'pages',pages,material};
 const placed=changeStageObjects(emptyStage(),gm,{action:'add',kind:'document',sourceId:source.sourceId,sourceKind:'record'},source);
 assert.equal(placed.objects[0].visibility,'sl','laying on the table never releases');
 assert.deepEqual(placed.objects[0].material,material);
 const released=changeStageObjects(placed,gm,{action:'add',kind:'document',sourceId:source.sourceId,sourceKind:'record',visible:true,recipients:['a']},{...source,material:undefined});
 assert.equal(released.objects.length,1,'still one object');
 assert.equal(released.objects[0].material,undefined,'refresh replaces the material view');
 assert.deepEqual(released.objects[0].recipients,['a']);
 const withdrawn=changeStageObjects(released,gm,{action:'visibility',id:released.objects[0].id,visible:false});
 assert.equal(withdrawn.objects[0].visibility,'sl');
 assert.equal(stageSchema.safeParse({...emptyStage(),backdrop:{fileId:'b',title:'x',sceneId:'',transition:'slow'}}).success,true);
 assert.equal(stageSchema.safeParse({...emptyStage(),backdrop:{fileId:'b',title:'x',sceneId:'',transition:'zoom'}}).success,false);
});
