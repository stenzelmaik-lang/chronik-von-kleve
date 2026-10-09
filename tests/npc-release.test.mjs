import {test} from 'node:test';
import assert from 'node:assert/strict';
import {releaseNPCDraft} from '../domain/npc-release.ts';
import {npcFieldNames} from '../domain/npc-profile.ts';
import {loadNPCPlayerPreview} from '../app/spielbereich/modules/npc-data.ts';
import {readNPCPlayerPreview} from '../server/npc-player-preview.ts';

test('Whole-card release changes only the draft and keeps SL kinds protected',()=>{
  const draft={title:'Test',canonStatus:'draft',playState:'unplayed',defaultVisibility:'sl_secret',profile:{alias:'Test alias',field_visibility:{alias:'sl_secret'}},blocks:[],retainedRelationships:['original'],addedRelationships:[{targetId:'other',type:'related_to',visibility:'sl'}]};
  const blocks=['bio','personality','sl_secrets','sl_agenda','sl_playstyle'].map((kind,position)=>({key:kind,id:kind,kind,position,content:'Text',visibility:'sl_secret'}));
  const before=JSON.stringify({draft,blocks});
  const result=releaseNPCDraft(draft,blocks);
  assert.equal(JSON.stringify({draft,blocks}),before);
  assert.equal(result.draft.defaultVisibility,'player_visible');
  assert.equal(result.draft.canonStatus,'draft');assert.equal(result.draft.playState,'unplayed');
  for(const key of Object.keys(npcFieldNames))assert.equal(result.draft.profile.field_visibility[key],'player_visible');
  assert.deepEqual(result.blocks.map(b=>b.visibility),['player_visible','player_visible','sl_secret','sl_secret','sl_secret']);
  assert.equal(result.blocks[0].id,blocks[0].id);assert.equal(result.blocks[0].key,blocks[0].key);
  assert.equal(result.draft.addedRelationships[0].targetId,'other');assert.equal(result.draft.addedRelationships[0].visibility,'group');
  assert.deepEqual(result.draft.retainedRelationships,['original']);
});
test('Preview uses its protected server endpoint, not full SL dossier requests',async()=>{
  const paths=[];
  const data=await loadNPCPlayerPreview(async path=>{paths.push(path);return {redacted:true};},'secret/id');
  assert.deepEqual(paths,['/api/entities/npc-preview?id=secret%2Fid']);assert.deepEqual(data,{redacted:true});
});
test('Server preview refuses non-SL roles before any database access',async()=>{
  for(const actor of [{gm:false,role:'player',status:'active'},{gm:true,role:'player',status:'active'},{gm:true,role:'campaign_gm',status:'blocked'}])await assert.rejects(readNPCPlayerPreview({},actor,'id'),e=>e.status===403);
});
