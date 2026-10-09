import type {Actor} from '../domain/types.ts';
import {loadEntitiesForIds,grantsFor,projectEntity} from './entities.ts';
import {readContentBlocks} from './content-blocks.ts';
import {readRelationships} from './relationships.ts';

/** Uses the real player projectors, with group knowledge only; no account impersonation. */
export async function readNPCPlayerPreview(db:D1Database,sl:Actor,id:string) {
  if(sl.status!=='active'||!sl.gm||!['campaign_owner','campaign_gm'].includes(sl.role))throw Object.assign(new Error('Nur für die Spielleitung.'),{status:403});
  const viewer:Actor={...sl,id:'npc-preview:'+crypto.randomUUID(),email:'',name:'',gm:false,role:'player'};
  const grants=(await grantsFor(db,viewer)).filter(g=>g.audience==='group');
  const original=(await loadEntitiesForIds(db,sl.campaignId,[id]))[0];
  const entity=original&&['NPC','CHARACTER'].includes(original.type)&&projectEntity(viewer,original,grants);
  if(!entity)return {redacted:true as const};
  const [blocks,relationships]=await Promise.all([readContentBlocks(db,viewer,id),readRelationships(db,viewer,id)]);
  const endpoints=await loadEntitiesForIds(db,sl.campaignId,relationships.flatMap(r=>[r.sourceId,r.targetId]));
  const relatedEntities=endpoints.flatMap(e=>{const safe=projectEntity(viewer,e,grants);return safe?[safe]:[];});
  return {entity,blocks,relationships,relatedEntities};
}
