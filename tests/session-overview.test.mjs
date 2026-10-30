import test from 'node:test';
import assert from 'node:assert/strict';
import { scenePreparation, orderedSessionScenes, liveSceneChoice } from '../domain/session-overview.ts';
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

test('SL overview has a bounded narration excerpt without secret fields or invented readiness',()=>{
  const document={...emptyScene(),narration:htmlToRichText('<p>PRIVATE NARRATION</p>'),secrets:'<h2>PRIVATE SECRET</h2>',atmosphere:htmlToRichText('<p><br></p>'),npcIds:['npc-original'],clueIds:['clue-original'],elements:[{id:'image-element',kind:'image',title:'Kasernenbild',text:'PRIVATE CAPTION',referenceId:'',fileId:'private-image'}]};
  const metadata=scenePreparation(document);
  assert.deepEqual(metadata.sections,['narration','secrets']);
  assert.deepEqual(metadata.npcIds,['npc-original']);
  assert.equal(metadata.materials[0].fileId,'private-image');
  assert.equal(metadata.narrationExcerpt,'PRIVATE NARRATION');
  assert.ok(!JSON.stringify(metadata).includes('PRIVATE SECRET'));
  assert.ok(!JSON.stringify(metadata).includes('PRIVATE CAPTION'));
  assert.equal(scenePreparation({...document,narration:'a'.repeat(1000)}).narrationExcerpt.length,280);
  assert.equal(metadata.status,undefined);
  const withImage={...document,atmosphere:htmlToRichText('<p>Atmosphäre</p><img src="/api/files?id=original-image" alt="Bild">')};
  assert.deepEqual(scenePreparation(withImage).embeddedFileIds,['original-image']);
  assert.equal(document.secrets,'<h2>PRIVATE SECRET</h2>');
});

test('Live direction lists only the evening scenes first and keeps foreign or test scenes apart',()=>{
  const scenes=[
    {id:'decoy',title:'Technische Prüfung Hauptszene',sessionIds:[]},
    {id:'new',title:'Neue Szene',sessionIds:[]},
    {id:'cellar',title:'Szene 02 – Der Keller',sessionIds:[]},
    {id:'barracks',title:'Szene 01 – Spielort Kaserne (Auftakt)',sessionIds:[]},
    {id:'legacy',title:'Legacy',sessionIds:['evening']},
    {id:'archived',title:'Archiviert',sessionIds:['evening'],archived:true},
  ];
  const choice=liveSceneChoice('evening',['barracks','cellar'],scenes);
  assert.deepEqual(choice.session.map(s=>s.id),['barracks','cellar','legacy'],'Planned order first, legacy links after');
  assert.deepEqual(choice.more.map(s=>s.id),['decoy','new'],'Unlinked scenes are improvisation only');
  assert.ok(![...choice.session,...choice.more].some(s=>s.id==='archived'),'Archived scenes never appear live');
  assert.deepEqual(liveSceneChoice('spontaneous',[],scenes).session,[],'An unprepared evening offers no foreign scenes as its own');
});