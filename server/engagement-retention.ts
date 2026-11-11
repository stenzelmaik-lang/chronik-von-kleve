import { berlinDay, engagementRetentionDays, shiftDay } from '../domain/engagement-window.ts';

export async function pruneEngagement(db: D1Database, now: number) {
  const cutoff = shiftDay(berlinDay(now), 1 - engagementRetentionDays);
  const results = await db.batch([
    db.prepare('DELETE FROM engagement_daily WHERE day<?').bind(cutoff),
    db.prepare('DELETE FROM engagement_verified_notes WHERE day<?').bind(cutoff),
    db.prepare('DELETE FROM engagement_leases WHERE received_at<?').bind(now - 86_400_000),
  ]);
  return results.map(result => result.meta.changes);
}
