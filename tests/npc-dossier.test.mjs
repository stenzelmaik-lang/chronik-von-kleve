import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dossierSections,dossierRelations} from '../app/spielbereich/modules/npc-dossier-data.ts';
import {loadEntityDossier} from '../app/spielbereich/modules/npc-data.ts';
test('Dossier splits public reading and explicit SL internals without inventing content',()=>{
  const entity={content:{text:'Original biography'},gmBody:'GM_SECRET'};
  const blocks=[{id:'a',visibility:'player_visible',content:'Public'},{id:'s',visibility:'sl_secret',content:'SECRET'}];
  assert.equal(dossierSections(entity,blocks,true).secretBlocks.length,1);
  const player=dossierSections(entity,blocks,false);
  assert.equal(JSON.stringify(player).includes('SECRET'),false);
  assert.equal(player.texts[0].content,'Original biography');
});
test('World references group originals by actual entity type and isolate secret links for SL',()=>{
  const related=[{id:'place',type:'PLACE',title:'Original place'},{id:'story',type:'storyline'},{id:'secret',type:'NPC',defaultVisibility:'sl_secret'}];
  const relations=related.map(e=>({id:e.id,sourceId:'npc',targetId:e.id,visibility:'group',type:'related_to'}));
  assert.deepEqual(dossierRelations('npc',relations,related,true).map(g=>g.title),['Orte','Handlungsstränge','SL-INTERN']);
  assert.deepEqual(dossierRelations('npc',relations,related,false).map(g=>g.title),['Orte','Handlungsstränge']);
  assert.equal(dossierRelations('npc',relations,related,true)[0].items[0].entity,related[0]);
});
test('Linked non-NPC original uses existing protected entity/block/relationship reads',async()=>{
  const paths=[];
  const dossier=await loadEntityDossier(async path=>{paths.push(path);return {entities:[{id:'place',type:'PLACE'}],blocks:[],relationships:[]};},'place',false);
  assert.equal(dossier.entity.type,'PLACE');
  assert.deepEqual(paths,['/api/entities?id=place&view=player','/api/content-blocks?entityId=place&view=player','/api/relationships?entityId=place&view=player']);
});
