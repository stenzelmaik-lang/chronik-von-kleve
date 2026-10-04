import type {Actor,Entity} from '../domain/types.ts';
import {projectEntity,type GrantRow,loadEntities,grantsFor} from './entities.ts';

export function npcReferencesVisibleFile(a:Actor,entities:Entity[],grants:GrantRow[],fileId:string){
  const reference='/api/files?id='+fileId;
  return entities.some(entity=>{
    if(entity.type!=='NPC'||entity.campaignId!==a.campaignId)return false;
    const projected=projectEntity(a,entity,grants);
    return !!projected&&['image_primary','image_secondary'].some(key=>projected.content[key]===reference);
  });
}
export async function canReadNPCFile(db:D1Database,a:Actor,fileId:string){
  const entities=await loadEntities(db,a.campaignId);
  return npcReferencesVisibleFile(a,entities,await grantsFor(db,a),fileId);
}
