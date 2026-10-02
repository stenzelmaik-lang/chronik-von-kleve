import type { Actor } from '@/domain/types';
import { canRead, gmOnly, HttpError } from '@/server/access';
import { loadEntitiesForIds, type CharacterKnowledgeContext } from '@/server/entities';

/** Character knowledge is evaluated only for an explicitly selected, owned
 * character. Preview is a separate GM-only read, never an identity header. */
export async function characterKnowledgeContext(db: D1Database, a: Actor, id: string, preview = false): Promise<CharacterKnowledgeContext> {
  if (preview) gmOnly(a);
  const e = (await loadEntitiesForIds(db, a.campaignId, [id]))[0];
  if (!e || e.type !== 'CHARACTER' || e.canonStatus === 'GM_SECRET' || e.content.recoveryOnly === true ||
    (!preview && e.ownerId !== a.id) || !canRead(a, { owner_id: e.ownerId, visibility: e.visibility }))
    throw new HttpError(404, 'Dieser Charakter ist nicht verfügbar.');
  const member = await db.prepare(`SELECT m.id FROM members m LEFT JOIN campaign_memberships cm ON cm.campaign_id=? AND cm.user_id=m.id
    WHERE m.id=? AND ((cm.user_id IS NOT NULL AND cm.status='active') OR (cm.user_id IS NULL AND m.campaign_id=? AND m.status='active'))`)
    .bind(a.campaignId, e.ownerId, a.campaignId).first();
  if (!member) throw new HttpError(404, 'Dieser Charakter ist nicht verfügbar.');
  return { id: e.id, ownerId: e.ownerId, campaignId: e.campaignId };
}
