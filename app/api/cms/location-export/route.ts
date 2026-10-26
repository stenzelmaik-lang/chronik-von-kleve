import {actor,database,failure,HttpError} from '@/server/access';
import {getLocationNode,requireCmsPublisher} from '@/server/location-cms-service';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
  const a=await actor();requireCmsPublisher(a);const entityId=new URL(req.url).searchParams.get('entityId');if(!entityId||entityId.length>160)throw new HttpError(400,'Ortseintrag fehlt.');
  const db=database(),node=await getLocationNode(db,a,entityId);
  const nodes=await db.prepare('SELECT * FROM location_nodes WHERE campaign_id=? AND location_id=?').bind(a.campaignId,node.location_id).all<{entity_id:string;parent_id:string|null}>();
  const ids=new Set([entityId]);for(let p=0;p<16;p++)for(const n of nodes.results)if(n.parent_id&&ids.has(n.parent_id))ids.add(n.entity_id);
  const result:Record<string,unknown>={format:'chroniplay-location-v1',createdAt:new Date().toISOString(),campaignId:a.campaignId,rootId:entityId,nodes:nodes.results.filter(n=>ids.has(n.entity_id))};
  const encoded=JSON.stringify([...ids]);
  for(const [table,column] of [['entities','id'],['entity_content_blocks','entity_id'],['entity_revisions','entity_id'],['entity_revision_media','entity_id'],['entity_revision_releases','entity_id'],['entity_revision_events','entity_id'],['knowledge','entity_id'],['world_events','entity_id']] as const){
    const rows=await db.prepare(`SELECT * FROM ${table} WHERE campaign_id=? AND ${column} IN (SELECT value FROM json_each(?))`).bind(a.campaignId,encoded).all();result[table]=rows.results;
  }
  result.relationships=(await db.prepare('SELECT * FROM relationships WHERE campaign_id=? AND (source_id IN (SELECT value FROM json_each(?)) OR target_id IN (SELECT value FROM json_each(?)))').bind(a.campaignId,encoded,encoded).all()).results;
  // References only: protected bytes are never copied into a public export URL.
  return new Response(JSON.stringify(result,null,2),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Content-Disposition':'attachment; filename="chroniplay-ortsdossier.json"','X-Content-Type-Options':'nosniff'}});
}catch(error){return failure(error,req);}}
