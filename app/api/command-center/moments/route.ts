import { actor, database, gmOnly, input, sameOrigin, json, failure, HttpError } from '@/server/access';
import { momentSchema } from '@/domain/command-workspace';
import { listMoments, validateCommandReferences, readStory } from '@/server/command-workspace';
import { readScene } from '@/server/story-scenes';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) { try { const a = await actor(); gmOnly(a); return json({ moments: await listMoments(database(), a, new URL(req.url).searchParams.get('sessionId') || undefined) }); } catch (e) { return failure(e, req); } }
export async function POST(req: Request) {
  try { sameOrigin(req); const a = await actor(); gmOnly(a); const p = momentSchema.safeParse(await input(req)); if (!p.success) throw new HttpError(400, p.error.issues[0].message); const d = p.data, db = database();
    const session = await db.prepare("SELECT id FROM records WHERE id=? AND campaign_id=? AND kind='sitzungen'").bind(d.sessionId, a.campaignId).first(); if (!session) throw new HttpError(404, 'Sitzung nicht verfügbar.');
    if (d.storyId) await readStory(db, a, d.storyId);
    if (d.sceneId) {
      const scene = await readScene(db,a,d.sceneId);
      if (!d.runId || !scene.state.runs.some(r => r.id === d.runId && r.sessionId === d.sessionId)) throw new HttpError(400,'Wähle den tatsächlich gespielten Szenenlauf.');
      if (d.storyId !== scene.document.storyId) throw new HttpError(400,'Der Handlungsstrang passt nicht zur gespielten Szene.');
    } else if (d.runId) throw new HttpError(400,'Der Szenenlauf benötigt eine Szene.');
    await validateCommandReferences(db, a, d.references);
    const id = 'moment-' + d.clientRequestId, now = new Date().toISOString(), content = JSON.stringify({ documentKind: 'session_moment', ...d, canonStatus: 'GM_SECRET' });
    const prior = await db.prepare('SELECT content,campaign_id FROM entities WHERE id=?').bind(id).first<{ content: string; campaign_id: string }>(); if (prior && (prior.campaign_id !== a.campaignId || prior.content !== content)) throw new HttpError(409, 'Diese Momentnotiz wurde bereits mit anderem Inhalt gespeichert.');
    const results = await db.batch([
      db.prepare("INSERT OR IGNORE INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,title,content,gm_body,version,created_at,updated_at) VALUES(?,?,'NOTE','GM_SECRET',?,'sl',?,?,'',1,?,?)").bind(id, a.campaignId, a.id, d.text.slice(0, 120), content, now, now),
      db.prepare("INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,'command.moment.created',?,? WHERE changes()=1").bind(crypto.randomUUID(), a.campaignId, id, a.id, JSON.stringify({ sessionId: d.sessionId, storyId: d.storyId, sceneId:d.sceneId,runId:d.runId }), now),
    ]);
    const saved = await db.prepare('SELECT content,campaign_id FROM entities WHERE id=?').bind(id).first<{ content: string; campaign_id: string }>(); if (!saved || saved.campaign_id !== a.campaignId || saved.content !== content) throw new HttpError(409, 'Diese Momentnotiz wurde parallel mit anderem Inhalt gespeichert.');
    return json({ moments: await listMoments(db, a, d.sessionId) }, results[0].meta.changes ? 201 : 200);
  } catch (e) { return failure(e, req); }
}
