import test from 'node:test';
import assert from 'node:assert/strict';
import {readProfile,sharedProfile,hasSharedProfile,profileSchema,PROFILE_DESCRIPTION_FIELDS} from '../domain/character-profile.ts';

const filled={description:{age:'34',apparentAge:'28',deathDate:'1998-03-14',gender:'weiblich',origin:'',nationality:'deutsch',hair:'schwarz',eyes:'grün',height:'1,65 m',weight:'',appearance:'Lange Mäntel, Siegelring.'},allies:'Ilse, Barkeeperin am Kai.',visibility:{description:'group',story:'private',drive:'group',allies:'private'}};
const body={profile:filled,text:'cvk-html-v1:<p>Geschichte</p>',playGuide:'Leise, beobachtend.'};

test('an empty or broken profile reads as empty fields, everything private', () => {
  const p=readProfile({});
  assert.equal(Object.keys(p.description).length,PROFILE_DESCRIPTION_FIELDS.length+1);
  assert.ok(Object.values(p.description).every(v=>v===''));
  assert.deepEqual(p.visibility,{description:'private',story:'private',drive:'private',allies:'private'});
  assert.deepEqual(readProfile({profile:{visibility:{story:'öffentlich'},description:{age:7}}}).visibility.story,'private','unknown values fall back to private');
  assert.equal(readProfile({profile:{description:{age:7}}}).description.age,'','non-text values are dropped');
});

test('other players only get shared blocks, and only filled fields', () => {
  const s=sharedProfile(body);
  assert.deepEqual(s.description.map(r=>r.label),['Alter','Sieht aus wie','Todestag','Geschlecht','Nationalität','Haarfarbe','Augenfarbe','Größe']);
  assert.equal(s.appearance,'Lange Mäntel, Siegelring.');
  assert.equal(s.drive,'Leise, beobachtend.');
  assert.equal(s.story,undefined,'private story stays private');
  assert.equal(s.allies,undefined,'private allies stay private');
  assert.equal(hasSharedProfile(s),true);
  assert.equal(hasSharedProfile(sharedProfile({profile:{...filled,visibility:{description:'private',story:'private',drive:'private',allies:'private'}},text:'x',playGuide:'y'})),false,'nothing shared, nothing sent');
  assert.equal(hasSharedProfile(sharedProfile({profile:{...filled,visibility:{description:'private',story:'group',drive:'private',allies:'private'}},text:'  '})),false,'a shared but empty story is not sent');
});

test('the save schema accepts the full profile and enforces its limits', () => {
  assert.equal(profileSchema.safeParse(filled).success,true);
  assert.equal(profileSchema.safeParse({...filled,description:{...filled.description,age:'x'.repeat(121)}}).success,false);
  assert.equal(profileSchema.safeParse({...filled,allies:'x'.repeat(5001)}).success,false);
  assert.equal(profileSchema.safeParse({...filled,visibility:{...filled.visibility,story:'public'}}).success,false);
  assert.equal(profileSchema.safeParse({...filled,extra:1}).success,false,'unknown keys are refused');
});
