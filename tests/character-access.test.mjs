import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canManageCampaignCharacter } from '../domain/character-access.ts';
import { projectEntity } from '../server/entities.ts';
const sl={id:'sl',campaignId:'chronik-von-kleve',status:'active',gm:true,role:'campaign_gm'};
const sheet={id:'character',ownerId:'a',campaignId:sl.campaignId,type:'CHARACTER',visibility:'private',content:{clan:'Tremere'},gmBody:'SL',canonStatus:'WORKING'};
test('campaign SL and owner can access private campaign sheets without sharing with players',()=>{
 for(const role of ['campaign_gm','campaign_owner'])assert.equal(canManageCampaignCharacter({...sl,role},sl.campaignId),true);
 assert.ok(projectEntity(sl,sheet,[]));
 assert.ok(projectEntity({...sl,id:'a',gm:false,role:'player'},sheet,[]));
 assert.equal(projectEntity({...sl,id:'b',gm:false,role:'player'},sheet,[{entity_id:sheet.id,audience:'group',subject_id:sl.campaignId,state:'DISCOVERED'}]),null);
});
test('blocked, pending, editor, forged GM flag and different campaigns stay denied',()=>{
 for(const denied of [{...sl,status:'blocked'},{...sl,status:'pending'},{...sl,role:'campaign_editor'},{...sl,role:'player'},{...sl,gm:false},{...sl,campaignId:'other'}]){
  assert.equal(canManageCampaignCharacter(denied,sheet.campaignId),false);
  assert.equal(projectEntity(denied,sheet,[]),null);
 }
});
test('SL character permission never exposes a private letter addressed to another player',()=>{
 const letter={...sheet,type:'NOTE',content:{context:'sl-message',senderId:'other-sl',text:'PRIVATE_LETTER'}};
 assert.equal(projectEntity(sl,letter,[]),null);
});
