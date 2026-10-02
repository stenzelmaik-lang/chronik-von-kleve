import { actor, database, failure, gmOnly, json } from '@/server/access';
import { loadEntities, projectEntity, type GrantRow } from '@/server/entities';
import { commandHandouts } from '@/domain/command-center';
import { commandCharacterSummary } from '@/domain/character-live';
import { commandReferences, listStories, listMoments } from '@/server/command-workspace';
import { listScenes, scenePlayerPreview } from '@/server/story-scenes';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const a = await actor();
    gmOnly(a);
    const db = database();
    const [entities, members, grants, readableCharacters] = await Promise.all([
      loadEntities(db, a.campaignId),
      db.prepare(`SELECT m.id,m.name,COALESCE(cm.status,m.status) AS status
        FROM members m LEFT JOIN campaign_memberships cm ON cm.campaign_id=? AND cm.user_id=m.id
        WHERE (cm.user_id IS NOT NULL AND cm.status='active') OR
          (cm.user_id IS NULL AND m.campaign_id=? AND m.status='active')`)
        .bind(a.campaignId, a.campaignId).all<{id:string;name:string;status:string}>(),
      db.prepare('SELECT entity_id,audience,subject_id,state FROM knowledge WHERE campaign_id=?')
        .bind(a.campaignId).all(),
      db.prepare("SELECT id,title,owner_id,body,version FROM records WHERE campaign_id=? AND kind='charaktere' AND (visibility!='private' OR owner_id=?)").bind(a.campaignId,a.id).all<{id:string;title:string;owner_id:string;body:string;version:number}>(),
    ]);
    if(new URL(req.url).searchParams.get('view')==='player') {
      const viewer={...a,id:'command-center-group-preview',gm:false,role:'player' as const};
      const sessions=entities.filter(e=>e.type==='SESSION').flatMap(e=>{
        const projected=projectEntity(viewer,e,grants.results as GrantRow[]);
        return projected?[{id:projected.id,kind:'sitzungen',title:projected.title,visibility:projected.visibility,body:projected.content,version:projected.version}]:[];
      });
      const handouts=entities.filter(e=>e.type==='HANDOUT').flatMap(e=>{
        const projected=projectEntity(viewer,e,grants.results as GrantRow[]);
        return projected?[{id:projected.id,title:projected.title,text:typeof projected.content.text==='string'?projected.content.text:''}]:[];
      });
      return json({sessions,handouts,scenes:await scenePlayerPreview(db,a)});
    }
    const [references, stories, moments, scenes] = await Promise.all([commandReferences(db, a), listStories(db, a), listMoments(db, a), listScenes(db, a)]);
    return json({
      campaignId:a.campaignId,
      references, stories, moments, scenes,
      sessions:entities.filter(e=>e.type==='SESSION').map(e=>({id:e.id,kind:'sitzungen',title:e.title,visibility:e.visibility,body:e.content,gmBody:e.gmBody,version:e.version})),
      members:members.results,
      characters:readableCharacters.results.flatMap(row=>{
        const entity=entities.find(e=>e.id===row.id&&e.type==='CHARACTER'&&e.canonStatus!=='GM_SECRET'&&e.content.recoveryOnly!==true);
        const summary=entity?commandCharacterSummary(row):null;
        return summary?[summary]:[];
      }),
      handouts:commandHandouts(entities,a.campaignId).map(e=>({id:e.id,title:e.title,text:typeof e.content.text==='string'?e.content.text:'',revocable:e.visibility==='sl',legacy:!!e.legacyRecordId})),
      grants:grants.results,
    });
  } catch(e) { return failure(e); }
}

