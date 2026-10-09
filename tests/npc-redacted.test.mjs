import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {npcRedactedCards} from '../server/npc-redacted-cards.ts';
import {npcProfileSchema,projectNPCFields} from '../domain/npc-profile.ts';
import {npcPortraitSettings,npcFigureKinds} from '../domain/npc-presentation.ts';
import {loadNPCList,isRedactedNPC} from '../app/spielbereich/modules/npc-data.ts';
const player={id:'p',campaignId:'c',role:'player',gm:false,status:'active'};
const secret={id:'original-secret',campaignId:'c',type:'NPC',title:'NEVER DISCLOSE',defaultVisibility:'sl_secret',visibility:'sl',ownerId:'gm',content:{image_primary:'/api/files?id=SECRET',text:'SECRET'},canonStatus:'draft'};
test('Sealed cards reveal only stable opaque IDs, never original information',async()=>{
  const cards=await npcRedactedCards(player,[secret],[]);
  assert.equal(cards.length,1);assert.deepEqual(Object.keys(cards[0]),['id']);assert.match(cards[0].id,/^redacted-[a-f0-9]{64}$/);
  assert.deepEqual(await npcRedactedCards(player,[secret],[]),cards);
  assert.doesNotMatch(JSON.stringify(cards),/original-secret|NEVER DISCLOSE|SECRET/);
  for(const actor of [{...player,gm:true},{...player,status:'blocked'},{...player,campaignId:'other'}])assert.deepEqual(await npcRedactedCards(actor,[secret],[]),[]);
  for(const patch of [{type:'PLACE'},{content:{recoveryOnly:true}},{content:{context:'sl-message'}},{defaultVisibility:'player_visible'}])assert.deepEqual(await npcRedactedCards(player,[{...secret,...patch}],[]),[]);
});
test('Overview placeholders contain fixed UI labels, never fetched dossiers',async()=>{
  const list=await loadNPCList(async()=>({entities:[],redactedNPCs:[{id:'redacted-'+'a'.repeat(64)}]}));
  assert.equal(list.length,1);assert.equal(isRedactedNPC(list[0]),true);assert.equal(list[0].title,'TOP SECRET');assert.deepEqual(list[0].content,{});
  const source=readFileSync('app/spielbereich/modules/npc-dossier.tsx','utf8');
  assert.match(source,/if\(\/\^redacted-\[a-f0-9\]\{64\}\$\/\.test\(id\)\)return/);
  assert.match(source,/<NPCTopSecret\/>/);
});
test('Portrait controls are bounded and only follow explicitly released images',()=>{
  assert.deepEqual(npcFigureKinds,['Haupt-NPC','NPC','Nebencharakter','Antagonist']);
  assert.deepEqual(npcPortraitSettings({hero_zoom:99,hero_position:-10,hero_mist:500}),{zoom:2.5,position:0,mist:100});
  for(const profile of [{hero_zoom:3},{hero_position:-1},{hero_mist:101}])assert.equal(npcProfileSchema.safeParse(profile).success,false);
  assert.ok(npcProfileSchema.safeParse({npc_status:'Aktiv',hero_zoom:1.5}).success);
  const content={image_primary:'/images/test.png',hero_zoom:2,hero_mist:80,field_visibility:{}};
  assert.deepEqual(projectNPCFields(content),{field_visibility:{}});
  const projected=projectNPCFields({...content,field_visibility:{image_primary:'player_visible'}});
  assert.equal(projected.hero_zoom,2);assert.equal(projected.hero_mist,80);
});
test('Direct visibility controls are labeled and character relations exclude world entities',()=>{
  const button=readFileSync('app/spielbereich/modules/npc-visibility-button.tsx','utf8');
  assert.match(button,/aria-pressed=/);assert.match(button,/aria-label=/);assert.match(button,/type="button"/);
  const editor=readFileSync('app/spielbereich/modules/npc-editor.tsx','utf8');
  assert.match(editor,/\['NPC','CHARACTER'\]\.includes\(e.type\)/);assert.match(editor,/retainedRelationships:relations.filter/);
  assert.doesNotMatch(editor,/Freigabe bestehender Inhalte/);assert.match(editor,/Alles freigeben/);assert.match(editor,/URL.revokeObjectURL/);
});
