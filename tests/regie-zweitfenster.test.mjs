import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStage,changeStageObjects,stageSchema,stageCommandSchema,pagerVisible,pagerKeep,pagerTextMax} from '../domain/live-stage.ts';
// Regie im Zweitfenster: pager, table effects and background music as optional stage fields.
const a={id:'a',name:'Player A',gm:false},b={id:'b',name:'Player B',gm:false},gm={id:'sl',name:'SL',gm:true};
const music={fileId:'f-audio',title:'Regen auf Blech.mp3',key:'k1'};

test('stored stages from before the second-screen Regie stay valid without migration',()=>{
 const old={format:1,version:7,objects:[],backdrop:null,sceneId:'scene-1'};
 assert.deepEqual(stageSchema.parse(old),old);
 assert.throws(()=>stageSchema.parse({...old,unknownField:true}),'The strict parser still refuses unknown data');
});

test('only the GM sends pagers, effects and music',()=>{
 for(const c of [{action:'pager',text:'Ruf an',recipients:null},{action:'effects',effects:['rain']},{action:'music',fileId:'f-audio'},{action:'pagerWithdraw',id:'x'}])
  assert.throws(()=>changeStageObjects(emptyStage(),a,c,undefined,null,music),e=>e.status===403,c.action);
});

test('a pager reaches exactly its recipients; the GM sees all',()=>{
 let s=changeStageObjects(emptyStage(),gm,{action:'pager',text:'Nur für A',recipients:['a','a']},undefined,undefined,undefined,'2026-10-31T20:00:00.000Z');
 s=changeStageObjects(s,gm,{action:'pager',text:'An alle',recipients:null});
 const [onlyA,all]=s.pagers;
 assert.deepEqual(onlyA.recipients,['a'],'Duplicate recipients are folded');
 assert.equal(onlyA.at,'2026-10-31T20:00:00.000Z');
 assert.equal(pagerVisible(onlyA,a),true);assert.equal(pagerVisible(onlyA,b),false);assert.equal(pagerVisible(onlyA,gm),true);
 for(const viewer of [a,b,gm])assert.equal(pagerVisible(all,viewer),true);
 assert.equal(s.version,2);
 s=changeStageObjects(s,gm,{action:'pagerWithdraw',id:onlyA.id});
 assert.deepEqual(s.pagers.map(p=>p.text),['An alle']);
 assert.throws(()=>changeStageObjects(s,gm,{action:'pagerWithdraw',id:onlyA.id}),e=>e.status===404);
});

test('pager commands are bounded and need a real audience',()=>{
 assert.equal(stageCommandSchema.safeParse({action:'pager',text:'x'.repeat(pagerTextMax+1),recipients:null}).success,false);
 assert.equal(stageCommandSchema.safeParse({action:'pager',text:'   ',recipients:null}).success,false,'Blank text is refused');
 assert.equal(stageCommandSchema.safeParse({action:'pager',text:'Hallo',recipients:[]}).success,false,'An empty selection is not "everybody"');
 assert.equal(stageCommandSchema.parse({action:'pager',text:'  Hallo  ',recipients:['a']}).text,'Hallo');
 let s=emptyStage();for(let i=0;i<pagerKeep+5;i++)s=changeStageObjects(s,gm,{action:'pager',text:'Nachricht '+i,recipients:null});
 assert.equal(s.pagers.length,pagerKeep,'Only the newest pagers are kept');assert.equal(s.pagers.at(-1).text,'Nachricht '+(pagerKeep+4));
});

test('effects are a set in a stable order; unknown effects are refused',()=>{
 let s=changeStageObjects(emptyStage(),gm,{action:'effects',effects:['fog','rain','fog']});
 assert.deepEqual(s.effects,['rain','fog']);
 s=changeStageObjects(s,gm,{action:'effects',effects:[]});assert.deepEqual(s.effects,[]);
 assert.equal(stageCommandSchema.safeParse({action:'effects',effects:['fire']}).success,false);
});

test('music needs a resolved audio file and can be stopped; it survives a scene change',()=>{
 assert.throws(()=>changeStageObjects(emptyStage(),gm,{action:'music',fileId:'f-audio'}),e=>e.status===404,'Unresolved file');
 let s=changeStageObjects(emptyStage(),gm,{action:'music',fileId:'f-audio'},undefined,undefined,music);
 assert.deepEqual(s.music,music);
 s=changeStageObjects(s,gm,{action:'effects',effects:['rain']});
 s=changeStageObjects(s,gm,{action:'activateScene',sceneId:'next'},undefined,null);
 assert.deepEqual(s.music,music,'Music and weather are explicit GM choices, not table material');assert.deepEqual(s.effects,['rain']);
 s=changeStageObjects(s,gm,{action:'music',fileId:null});assert.equal(s.music,null);
});
