import type {Actor,Entity} from '../domain/types.ts';
import {projectEntity,type GrantRow,type CharacterKnowledgeContext} from './entities.ts';

export async function npcRedactedCards(a:Actor,entities:Entity[],grants:GrantRow[],character?:CharacterKnowledgeContext){
  if(a.gm||a.status!=='active')return [];
  const hidden=entities.filter(e=>e.campaignId===a.campaignId&&e.type==='NPC'&&e.content.recoveryOnly!==true&&e.content.context!=='sl-message'&&!projectEntity(a,e,grants,character));
  return Promise.all(hidden.map(async e=>{
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('npc-redacted:'+a.campaignId+':'+e.id));
    return {id:'redacted-'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')};
  }));
}
