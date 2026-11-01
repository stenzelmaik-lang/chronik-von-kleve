import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sceneElementSchema,sceneCheckSchema,emptySceneCheck,sceneDocumentSchema,emptyScene} from '../domain/story-scene.ts';
import {checkRequestBody,defaultCheckTitle} from '../domain/live-checks.ts';
import {W10_MODIFIER_REGISTER,unreleasedModifiers,registerEntry} from '../domain/w10-modifier-register.ts';
import {deriveW10Preview} from '../domain/w10-selection.ts';
import {engineFixture} from './fixtures/engine-character.mjs';
// GE-02: one check desk. Prepared and spontaneous checks share one spec, one request and one central calculation.
const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const element=patch=>({id:crypto.randomUUID(),kind:'check',title:'Schlüsselbund stehlen',text:'',referenceId:'',fileId:'',...patch});

test('a prepared check stores traits, SG, intended figures and private consequences on the scene element',()=>{
 const check={attributeId:'dexterity',abilityId:'larceny',difficulty:7,targetCharacterIds:['char-a'],consequences:{success:'Schlüssel erbeutet.',failure:'',botch:'Schäfer bemerkt den Griff.'}};
 assert.deepEqual(sceneElementSchema.parse(element({check})).check,check);
 assert.deepEqual(sceneCheckSchema.parse({}),emptySceneCheck(),'defaults keep the editor simple');
 assert.equal(sceneElementSchema.safeParse(element({check:{...check,attributeId:'hunger'}})).success,false,'only known W10 traits');
 assert.equal(sceneElementSchema.safeParse(element({check:{...check,difficulty:11}})).success,false,'V20 SG 2–10');
 assert.equal(sceneElementSchema.safeParse(element({kind:'clue',check})).success,false,'only check elements carry check data');
 assert.equal(sceneElementSchema.safeParse(element({})).success,true,'older check elements without structure stay valid');
 assert.equal(sceneDocumentSchema.safeParse({...emptyScene(),elements:[element({check})]}).success,true,'stored in the scene JSON, no migration');
});

test('prepared and spontaneous checks build the same requestCheck; figures replace the audience',()=>{
 const base={difficulty:7,attributeId:'dexterity',abilityId:'larceny',targetCharacterIds:['char-a']};
 const prepared=checkRequestBody({...base,title:'Schlüsselbund stehlen',preparedId:'00000000-0000-4000-8000-000000000001',sceneId:'s1',consequences:{success:'x',failure:'',botch:''}},'e1');
 const spontaneous=checkRequestBody({...base,title:''},'e2');
 assert.equal(prepared.action,'requestCheck');assert.equal(spontaneous.action,'requestCheck');
 for(const key of ['difficulty','attributeId','abilityId','targetCharacterIds'])assert.deepEqual(prepared[key],spontaneous[key],key);
 assert.equal(spontaneous.title,'Geschick + Diebstahl','spontaneous check needs no name');
 assert.equal('audience' in prepared,false,'the server derives players from the figures');
 assert.equal(defaultCheckTitle({}),'Probe');
 assert.equal('consequences' in checkRequestBody({...base,title:'',consequences:{success:'',failure:'',botch:''}},'e3'),false,'empty consequences are not sent');
 const simplest=checkRequestBody({title:'',difficulty:6,attributeId:'',abilityId:'',targetCharacterIds:['char-b']},'e4');
 assert.deepEqual(simplest,{action:'requestCheck',eventId:'e4',title:'Probe',difficulty:6,targetCharacterIds:['char-b']},'figure + SG is enough; the player picks traits');
});

test('the central calculation only produces released register entries; open mechanics stay unreleased',()=>{
 let ready=0;
 for(const selection of [{attributeId:'dexterity',abilityId:'firearms'},{attributeId:'strength'},{attributeId:'dexterity',abilityId:'larceny'}]){
  const p=deriveW10Preview(engineFixture,selection,{baseDifficulty:6},9);
  if(p.status!=='ready')continue;ready++;
  assert.deepEqual(unreleasedModifiers(p.provenance),[],JSON.stringify(selection));
  for(const open of p.notApplied){const entry=W10_MODIFIER_REGISTER.find(e=>e.id===open.id);if(entry)assert.equal(entry.released,false,open.id);}
 }
 assert.ok(ready>=2,'real previews were checked');
 for(const id of ['hunger','personal_stress','group_stress','scene_condition','willpower'])assert.equal(W10_MODIFIER_REGISTER.find(e=>e.id===id)?.released,false,id);
 assert.equal(unreleasedModifiers([{part:'difficulty',id:'personal_stress'}]).length,1);
 assert.equal(unreleasedModifiers([{part:'difficulty',id:'mystery_bonus'}]).length,1,'unknown counts as unreleased');
 assert.equal(registerEntry({part:'attribute',id:'dexterity'})?.released,true);
});

test('server: figures, private consequences and the release guard sit on the one live check path',()=>{
 const checks=src('server/live-checks.ts'),events=src('server/live-commands.ts'),stage=src('server/live-stage.ts');
 assert.match(checks,/targetCharacterIds:z\.array/);assert.match(checks,/unreleasedModifiers\(preview\.provenance\)/);
 assert.match(checks,/Diese Probe gilt einer anderen Figur/);
 assert.match(events,/consequences:_outcomes,targetCharacterIds:_targets,preparedId:_origin/,'stripped for players');
 assert.match(events,/recipients:visible\.recipients===null\?null:\[a\.id\]/,'players never see other addressees');
 assert.match(stage,/a\.gm&&e\.consequences/);
 assert.doesNotMatch(src('app/spielbereich/modules/spieltisch/check-issue-form.tsx'),/action:'requestCheck'/,'the form builds no own request; checkRequestBody is the one builder');
});
