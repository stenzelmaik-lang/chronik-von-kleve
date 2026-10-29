import test from 'node:test';
import assert from 'node:assert/strict';
import { scenePreparation, orderedSessionScenes } from '../domain/session-overview.ts';
import { htmlToRichText } from '../domain/location-rich-text.ts';
import { emptyScene } from '../domain/story-scene.ts';
import { sessionPreparationSchema } from '../domain/story-preparation.ts';

test('Session order preserves explicit links and appends legacy scene-side links once',()=>{
  const document=sessionPreparationSchema.parse({title:'Abend',sceneIds:['z','a','missing']});
  const scenes=[{id:'a',title:'A',sessionIds:['evening','other']},{id:'z',title:'Z',sessionIds:[]},{id:'b',title:'B',sessionIds:['evening']},{id:'foreign',title:'Other',sessionIds:['other']}];
  const before=JSON.stringify({document,scenes});
  assert.deepEqual(orderedSessionScenes('evening',document,scenes).map(s=>s.id),['z','a','b']);
  assert.equal(JSON.stringify({document,scenes}),before,'Reading never rewrites stored links');
  assert.deepEqual(orderedSessionScenes('other',sessionPreparationSchema.parse({title:'Other'}),scenes).map(s=>s.id),['a','foreign']);
});

test('Overview describes actual preparation without disclosing text or inventing readiness',()=>{
  const document={...emptyScene(),narration:'<p>PRIVATE NARRATION</p>',secrets:'<h2>PRIVATE SECRET</h2>',atmosphere:htmlToRichText('<p><br></p>'),npcIds:['npc-original'],clueIds:['clue-original'],elements:[{id:'image-element',kind:'image',title:'Kasernenbild',text:'PRIVATE CAPTION',referenceId:'',fileId:'private-image'}]};
  const metadata=scenePreparation(document);
  assert.deepEqual(metadata.sections,['narration','secrets']);
  assert.deepEqual(metadata.npcIds,['npc-original']);
  assert.equal(metadata.materials[0].fileId,'private-image');
  assert.ok(!JSON.stringify(metadata).includes('PRIVATE'));
  assert.equal(metadata.status,undefined);
  const withImage={...document,atmosphere:htmlToRichText('<p>Atmosphäre</p><img src="/api/files?id=original-image" alt="Bild">')};
  assert.deepEqual(scenePreparation(withImage).embeddedFileIds,['original-image']);
  assert.equal(document.secrets,'<h2>PRIVATE SECRET</h2>');
});
