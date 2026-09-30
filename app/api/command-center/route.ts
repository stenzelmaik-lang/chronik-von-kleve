import { actor, database, failure, gmOnly, json } from '@/server/access';
import { loadEntities, projectEntity, type GrantRow } from '@/server/entities';
import { commandHandouts } from '@/domain/command-center';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const a = await actor();
    gmOnly(a);
    const db = database();
    const [entities, members, grants] = await Promise.all([
      loadEntities(db, a.campaignId),
      db.prepare(`SELECT m.id,m.name,COALESCE(cm.status,m.status) AS status
        FROM members m LEFT JOIN campaign_memberships cm ON cm.campaign_id=? AND cm.user_id=m.id
        WHERE (cm.user_id IS NOT NULL AND cm.status='active') OR
          (cm.user_id IS NULL AND m.campaign_id=? AND m.status='active')`)
        .bind(a.campaignId, a.campaignId).all<{id:string;name:string;status:string}>(),
      db.prepare('SELECT entity_id,audience,subject_id,state FROM knowledge WHERE campaign_id=?')
        .bind(a.campaignId).all(),
    ]);
    if(new URL(req.url).searchParams.get('view')==='player') {
      const viewer={...a,id:'command-center-group-preview',gm:false,role:'player' as const};
      const sessions=entities.filter(e=>e.type==='SESSION').flatMap(e=>{
        const projected=projectEntity(viewer,e,grants.results as GrantRow[]);
        return projected?[{id:projected.id,kind:'sitzungen',title:projected.title,visibility:projected.visibility,body:projected.content,version:projected.version}]:[];
      });
      return json({sessions});
    }
    return json({
      campaignId:a.campaignId,
      members:members.results,
      characters:entities.filter(e=>e.type==='CHARACTER' && e.content.recoveryOnly!==true).map(e=>({id:e.id,title:e.title,ownerId:e.ownerId})),
      handouts:commandHandouts(entities,a.campaignId).map(e=>({id:e.id,title:e.title,text:typeof e.content.text==='string'?e.content.text:'',revocable:e.visibility==='sl',legacy:!!e.legacyRecordId})),
      grants:grants.results,
    });
  } catch(e) { return failure(e); }
}
