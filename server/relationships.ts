import type { Actor, Relationship } from '../domain/types.ts';
import { relationshipInputSchema, type RelationshipInput } from '../domain/relationships.ts';
import { loadEntitiesForIds, grantsFor, projectEntity } from './entities.ts';

export class RelationshipError extends Error {
  status: number;
  constructor(status:number,message:string) { super(message); this.status=status; }
}
const isSL=(a:Actor)=>a.status==='active' && a.gm && ['campaign_owner','campaign_gm'].includes(a.role);
function active(a:Actor) { if(a.status!=='active') throw new RelationshipError(403,'Zugang nicht aktiv.'); }
function sl(a:Actor) { active(a); if(!isSL(a)) throw new RelationshipError(403,'Nur für die Spielleitung.'); }
type Row={id:string;campaign_id:string;source_id:string;target_id:string;type:string;note?:string|null;visibility:Relationship['visibility'];created_at:string};
const relation=(r:Row):Relationship=>({id:r.id,campaignId:r.campaign_id,sourceId:r.source_id,targetId:r.target_id,type:r.type,note:r.note??null,visibility:r.visibility,createdAt:r.created_at});
export async function createRelationship(db:D1Database,a:Actor,raw:RelationshipInput) {
  sl(a);
  const parsed=relationshipInputSchema.safeParse(raw);
  if(!parsed.success) throw new RelationshipError(400,'Ungültige Beziehung.');
  const d=parsed.data, endpoints=await loadEntitiesForIds(db,a.campaignId,[d.sourceId,d.targetId]);
  if(endpoints.length!==2) throw new RelationshipError(400,'Beide Entities müssen in derselben Kampagne existieren.');
  if(endpoints.some(e=>!projectEntity(a,e,[]))) throw new RelationshipError(404,'Entität nicht gefunden.');
  // Private relations have no separate owner column: both endpoint owners must match.
  if(d.visibility==='private' && endpoints.some(e=>e.ownerId!==a.id)) throw new RelationshipError(400,'Private Beziehungen benötigen zwei eigene Entities.');
  const id=crypto.randomUUID(),createdAt=new Date().toISOString();
  await db.prepare('INSERT INTO relationships(id,campaign_id,source_id,target_id,type,visibility,note,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,a.campaignId,d.sourceId,d.targetId,d.type,d.visibility,d.note??null,createdAt).run();
  return {id,campaignId:a.campaignId,...d,createdAt};
}
export async function readRelationships(db:D1Database,a:Actor,entityId:string,id?:string) {
  active(a);
  const viewer={...a,gm:isSL(a)}, grants=await grantsFor(db,viewer);
  const anchor=(await loadEntitiesForIds(db,a.campaignId,[entityId]))[0];
  if(!anchor || !projectEntity(viewer,anchor,grants)) throw new RelationshipError(404,'Entität nicht gefunden.');
  const rows=await db.prepare('SELECT * FROM relationships WHERE campaign_id=? AND (source_id=? OR target_id=?)'+(id?' AND id=?':'')+(isSL(a)?'':" AND visibility IN ('group','private')")+' ORDER BY created_at,id').bind(a.campaignId,entityId,entityId,...(id?[id]:[])).all<Row>();
  const endpoints=await loadEntitiesForIds(db,a.campaignId,rows.results.flatMap(r=>[r.source_id,r.target_id]));
  const entities=new Map(endpoints.map(e=>[e.id,e]));
  const result=rows.results.filter(r=>{
    const source=entities.get(r.source_id),target=entities.get(r.target_id);
    if(!source || !target) return false;
    if(r.visibility==='private' && (source.ownerId!==a.id || target.ownerId!==a.id)) return false;
    if(!['sl','group','private'].includes(r.visibility)) return false;
    return !!projectEntity(viewer,source,grants) && !!projectEntity(viewer,target,grants);
  }).map(relation);
  if(id && !result.length) throw new RelationshipError(404,'Beziehung nicht gefunden.');
  return result;
}
export async function deleteRelationship(db:D1Database,a:Actor,id:string) {
  sl(a);
  const row=await db.prepare('SELECT * FROM relationships WHERE campaign_id=? AND id=?').bind(a.campaignId,id).first<Row>();
  if(!row) throw new RelationshipError(404,'Beziehung nicht gefunden.');
  await readRelationships(db,a,row.source_id,id);
  const result=await db.prepare('DELETE FROM relationships WHERE campaign_id=? AND id=?').bind(a.campaignId,id).run();
  if(!result.meta.changes) throw new RelationshipError(404,'Beziehung nicht gefunden.');
}
