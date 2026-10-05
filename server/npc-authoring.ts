import type { Actor } from '../domain/types.ts';
import { npcSaveSchema, type NPCSave } from '../domain/npc-authoring.ts';
import { loadEntities, loadEntitiesForIds, parseObject, projectEntity, type EntityRow } from './entities.ts';
import { readContentBlocks } from './content-blocks.ts';
import { readRelationships } from './relationships.ts';

export class NPCAuthoringError extends Error {
  status:number;
  constructor(status:number,message:string){super(message);this.status=status;}
}
function requireSL(a:Actor){if(a.status!=='active'||!a.gm||!['campaign_owner','campaign_gm'].includes(a.role))throw new NPCAuthoringError(403,'Nur für die Spielleitung.');}
// Ordered SQL snapshots also guard changes made through the existing block/relation APIs.
const blockSnapshot="SELECT json_group_array(json_object('id',id,'kind',kind,'content',content,'visibility',visibility,'position',position)) AS snapshot FROM (SELECT * FROM entity_content_blocks WHERE campaign_id=? AND entity_id=? ORDER BY id)";
const relationSnapshot="SELECT json_group_array(json_object('id',id,'source',source_id,'target',target_id,'type',type,'visibility',visibility,'note',note)) AS snapshot FROM (SELECT * FROM relationships WHERE campaign_id=? AND (source_id=? OR target_id=?) ORDER BY id)";
async function snapshot(db:D1Database,a:Actor,id:string){
  const raw=await db.prepare('SELECT * FROM entities WHERE campaign_id=? AND id=?').bind(a.campaignId,id).first<EntityRow>();
  if(!raw||raw.type!=='NPC')throw new NPCAuthoringError(404,'NPC nicht gefunden.');
  const entity=(await loadEntities(db,a.campaignId,id))[0];
  if(!projectEntity(a,entity,[]))throw new NPCAuthoringError(404,'NPC nicht gefunden.');
  const b=await db.prepare(blockSnapshot).bind(a.campaignId,id).first<string>('snapshot');
  const r=await db.prepare(relationSnapshot).bind(a.campaignId,id,id).first<string>('snapshot');
  const legacy=raw.legacy_record_id?await db.prepare('SELECT version FROM records WHERE campaign_id=? AND id=?').bind(a.campaignId,raw.legacy_record_id).first<{version:number}>():null;
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([raw,b,r,legacy])));
  const revision=Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
  return {raw,entity,b,r,legacy,revision};
}
export async function readNPCDraft(db:D1Database,a:Actor,id:string){
  requireSL(a);
  const s=await snapshot(db,a,id);
  return {entity:s.entity,revision:s.revision,blocks:await readContentBlocks(db,a,id),relationships:await readRelationships(db,a,id)};
}
export async function saveNPC(db:D1Database,a:Actor,input:NPCSave){
  requireSL(a);
  const parsed=npcSaveSchema.safeParse(input);
  if(!parsed.success)throw new NPCAuthoringError(400,'Ungültige NPC-Akte.');
  const d=parsed.data,id=d.id??crypto.randomUUID(),now=new Date().toISOString(),eventId=crypto.randomUUID();
  const s=d.id?await snapshot(db,a,id):null;
  if(s&&s.revision!==d.revision)throw new NPCAuthoringError(409,'Die Akte wurde inzwischen geändert. Entwurf sichern und Akte neu öffnen.');
  const existingBlocks=s?await readContentBlocks(db,a,id):[];
  const existingRelations=s?await readRelationships(db,a,id):[];
  if(d.blocks.some(b=>b.id&&!existingBlocks.some(old=>old.id===b.id))||d.retainedRelationships.some(r=>!existingRelations.some(old=>old.id===r)))throw new NPCAuthoringError(400,'Inhalt oder Beziehung gehört nicht zu dieser Akte.');
  // Preserve even unknown/legacy relation types unless the SL explicitly removes them.
  const allRawRelations=s?JSON.parse(s.r??'[]') as {id:string}[]:[];
  const invisibleRelations=allRawRelations.filter(r=>!existingRelations.some(old=>old.id===r.id)).map(r=>r.id);
  const targets=await loadEntitiesForIds(db,a.campaignId,d.addedRelationships.map(r=>r.targetId));
  if(d.addedRelationships.some(r=>!targets.some(e=>e.id===r.targetId&&['NPC','CHARACTER'].includes(e.type)&&projectEntity(a,e,[]))))throw new NPCAuthoringError(400,'Beziehungen sind hier nur mit NPCs und Spielercharakteren dieser Kampagne möglich.');
  const updates=d.updatedRelationships??[];
  const updatedTargets=await loadEntitiesForIds(db,a.campaignId,updates.flatMap(update=>{const r=existingRelations.find(r=>r.id===update.id);return r?[r.sourceId===id?r.targetId:r.sourceId]:[];}));
  if(updates.some(update=>{const r=existingRelations.find(r=>r.id===update.id);return !r||!updatedTargets.some(e=>e.id===(r.sourceId===id?r.targetId:r.sourceId)&&['NPC','CHARACTER'].includes(e.type)&&projectEntity(a,e,[]));}))throw new NPCAuthoringError(400,'Nur Charakterbeziehungen dieser Akte dürfen freigegeben werden.');
  const previous=parseObject(s?.raw.content??'{}');
  const content={...previous,...d.profile,...(!s||d.profile.field_visibility?{field_visibility:{...(previous.field_visibility&&typeof previous.field_visibility==='object'&&!Array.isArray(previous.field_visibility)?previous.field_visibility:{}),...d.profile.field_visibility}}:{})};
  const statements:D1PreparedStatement[]=[];
  if(s){
    statements.push(db.prepare(`UPDATE entities SET title=?,content=?,canon_status=?,play_state=?,default_visibility=?,version=version+1,updated_at=? WHERE campaign_id=? AND id=? AND version=? AND (${blockSnapshot})=? AND (${relationSnapshot})=? AND (? IS NULL OR (SELECT version FROM records WHERE campaign_id=? AND id=?)=?)`)
      .bind(d.title,JSON.stringify(content),d.canonStatus,d.playState,d.defaultVisibility,now,a.campaignId,id,s.raw.version,a.campaignId,id,s.b,a.campaignId,id,id,s.r,s.legacy?.version??null,a.campaignId,s.raw.legacy_record_id,s.legacy?.version??null));
  }else statements.push(db.prepare("INSERT INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,title,content,gm_body,created_at,updated_at,play_state,default_visibility) VALUES(?,?,'NPC',?,?,'sl',?,?,'',?,?,?,?)").bind(id,a.campaignId,d.canonStatus,a.id,d.title,JSON.stringify(content),now,now,d.playState,d.defaultVisibility??'sl_secret'));
  // changes() binds the following mutations to this exact successful CAS, not another writer.
  statements.push(db.prepare("INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,'npc.saved','{}',? WHERE changes()=1").bind(eventId,a.campaignId,id,a.id,now));
  const guard='EXISTS (SELECT 1 FROM world_events WHERE id=?)';
  for(const old of existingBlocks.filter(b=>!d.blocks.some(n=>n.id===b.id)))statements.push(db.prepare(`DELETE FROM entity_content_blocks WHERE campaign_id=? AND entity_id=? AND id=? AND ${guard}`).bind(a.campaignId,id,old.id,eventId));
  for(const b of d.blocks){
    statements.push(b.id?db.prepare(`UPDATE entity_content_blocks SET kind=?,content=?,visibility=?,position=? WHERE campaign_id=? AND entity_id=? AND id=? AND ${guard}`).bind(b.kind,b.content,b.visibility,b.position,a.campaignId,id,b.id,eventId):db.prepare(`INSERT INTO entity_content_blocks(id,campaign_id,entity_id,kind,content,visibility,position) SELECT ?,?,?,?,?,?,? WHERE ${guard}`).bind(crypto.randomUUID(),a.campaignId,id,b.kind,b.content,b.visibility,b.position,eventId));
  }
  const retained=[...d.retainedRelationships,...invisibleRelations];
  for(const old of existingRelations.filter(r=>!retained.includes(r.id)))statements.push(db.prepare(`DELETE FROM relationships WHERE campaign_id=? AND id=? AND ${guard}`).bind(a.campaignId,old.id,eventId));
  for(const update of updates)statements.push(db.prepare(`UPDATE relationships SET visibility=? WHERE campaign_id=? AND id=? AND ${guard}`).bind(update.visibility,a.campaignId,update.id,eventId));
  for(const r of d.addedRelationships)statements.push(db.prepare(`INSERT INTO relationships(id,campaign_id,source_id,target_id,type,visibility,note,created_at) SELECT ?,?,?,?,?,?,?,? WHERE ${guard}`).bind(crypto.randomUUID(),a.campaignId,id,r.targetId,r.type,r.visibility,r.note??null,now,eventId));
  const results=await db.batch(statements);
  if(!results[0].meta.changes)throw new NPCAuthoringError(409,'Die Akte wurde inzwischen geändert. Bitte neu öffnen.');
  return {id,title:d.title};
}
