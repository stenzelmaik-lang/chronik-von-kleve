import { berlinDay, engagementWindow } from '../domain/engagement-window.ts';
import { parseBody } from './xp-reward-errors.ts';

// A deterministic snapshot lets the final XP write reject a concurrently
// changed calendar or newly registered evening in the same database statement.
export const engagementScheduleSql = `
  WITH scope(campaign_id,today) AS (VALUES(?,?))
  SELECT json_object(
    'played', json((SELECT json_object('id',p.id,'day',p.played_on) FROM played_sessions p, scope s
      WHERE p.campaign_id=s.campaign_id AND p.played_on<=s.today
      ORDER BY p.played_on DESC,p.registered_at DESC,p.id LIMIT 1)),
    'appointments', json((SELECT json_group_array(json_array(id,version,body)) FROM (
      SELECT r.id,r.version,r.body FROM records r, scope s
      WHERE r.campaign_id=s.campaign_id AND r.kind='termine' AND r.visibility='group'
        AND CASE WHEN json_valid(r.body) THEN json_extract(r.body,'$.engagementGameNight')=1 ELSE 0 END
        AND NOT EXISTS(SELECT 1 FROM played_sessions p WHERE p.campaign_id=r.campaign_id AND p.appointment_id=r.id)
      ORDER BY r.id
    )))
  )`;

export async function engagementSchedule(db: D1Database, campaignId: string, now: number) {
  const today = berlinDay(now);
  const row = await db.prepare('SELECT (' + engagementScheduleSql + ') AS snapshot')
    .bind(campaignId, today).first<{ snapshot: string }>();
  if (!row) throw new Error('Engagement calendar snapshot unavailable.');
  const { played, appointments } = JSON.parse(row.snapshot) as {
    played: { id: string; day: string } | null;
    appointments: [string, number, string][];
  };
  return {
    today, snapshot: row.snapshot,
    window: engagementWindow(played, appointments.map(([id, , body]) => ({ id, body: parseBody(body) })), now),
  };
}
