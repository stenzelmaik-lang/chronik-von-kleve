import { maximumPulseMs, minimumPulseMs, pulseMs, type EngagementCategory } from '../domain/engagement-browser.ts';
import { berlinDay, berlinMidnight, engagementRetentionDays, shiftDay } from '../domain/engagement-window.ts';
import { engagementProgress } from '../domain/engagement-targets.ts';
import { engagementSchedule } from './engagement-schedule.ts';
import { verifiedEngagementProgress } from './engagement-awards.ts';

export type EngagementScope = { campaignId: string; memberId: string };
export type EngagementPulse = { category: EngagementCategory; ticket?: string; restart?: boolean };
type Lease = { category: EngagementCategory; received_at: number };
type Daily = { day: string; category: EngagementCategory; seconds: number };

const rejected = { ticket: null, seconds: 0 };

export async function recordEngagementPulse(db: D1Database, scope: EngagementScope, pulse: EngagementPulse, now: number, awardsEnabled = true) {
  const { campaignId, memberId } = scope;
  const day = berlinDay(now);
  const ticket = crypto.randomUUID();

  if (pulse.restart && pulse.ticket) {
    const result = await db.prepare(`
      UPDATE engagement_leases SET ticket=?,category=?,received_at=?,unclaimed_notebook_seconds=0
      WHERE campaign_id=? AND member_id=? AND ticket=? AND received_at<=?
    `).bind(ticket, pulse.category, now, campaignId, memberId, pulse.ticket, now - 5_000).run();
    return result.meta.changes ? { ticket, seconds: 0 } : rejected;
  }

  if (pulse.ticket === undefined) {
    const [started] = await db.batch([
      db.prepare(`
        INSERT INTO engagement_leases(campaign_id,member_id,ticket,category,received_at) VALUES(?,?,?,?,?)
        ON CONFLICT(campaign_id,member_id) DO UPDATE SET
          ticket=excluded.ticket, category=excluded.category, received_at=excluded.received_at, unclaimed_notebook_seconds=0
        WHERE engagement_leases.received_at < ?
      `).bind(campaignId, memberId, ticket, pulse.category, now, now - maximumPulseMs),
      db.prepare('DELETE FROM engagement_daily WHERE campaign_id=? AND member_id=? AND day<?')
        .bind(campaignId, memberId, shiftDay(day, 1 - engagementRetentionDays)),
      db.prepare('DELETE FROM engagement_verified_notes WHERE campaign_id=? AND member_id=? AND day<?')
        .bind(campaignId, memberId, shiftDay(day, 1 - engagementRetentionDays)),
    ]);
    return started.meta.changes ? { ticket, seconds: 0 } : rejected;
  }

  const lease = await db.prepare('SELECT category,received_at FROM engagement_leases WHERE campaign_id=? AND member_id=? AND ticket=?')
    .bind(campaignId, memberId, pulse.ticket).first<Lease>();
  if (!lease || lease.category !== pulse.category) return rejected;
  const elapsed = now - lease.received_at;
  if (elapsed < minimumPulseMs || elapsed > maximumPulseMs) return rejected;
  const seconds = Math.floor(Math.min(elapsed, pulseMs, now - berlinMidnight(day)) / 1000);

  // Both writes compete on the same ticket in one D1 transaction. The losing
  // request cannot add time, even if it read the lease before the winner.
  const [, rotated] = await db.batch([
    db.prepare(`
      INSERT INTO engagement_daily(campaign_id,member_id,day,category,seconds)
      SELECT campaign_id,member_id,?,category,? FROM engagement_leases
      WHERE campaign_id=? AND member_id=? AND ticket=? AND ?>0
      ON CONFLICT(campaign_id,member_id,day,category) DO UPDATE SET seconds=engagement_daily.seconds+excluded.seconds
    `).bind(day, seconds, campaignId, memberId, pulse.ticket, seconds),
    db.prepare(`UPDATE engagement_leases SET ticket=?,received_at=?,
      unclaimed_notebook_seconds=CASE WHEN ?=1 AND category='notebook'
        THEN MIN(900,?+CASE WHEN received_at>=? THEN unclaimed_notebook_seconds ELSE 0 END) ELSE 0 END
      WHERE campaign_id=? AND member_id=? AND ticket=?`)
      .bind(ticket, now, Number(awardsEnabled), seconds, berlinMidnight(day), campaignId, memberId, pulse.ticket),
  ]);
  return rotated.meta.changes ? { ticket, seconds } : rejected;
}

export async function engagementSummary(db: D1Database, scope: EngagementScope, now: number, awardsEnabled = true) {
  const { campaignId, memberId } = scope;
  const today = berlinDay(now);
  const weekStart = shiftDay(today, -6);
  const [{ window }, daily] = await Promise.all([
    engagementSchedule(db, campaignId, now),
    db.prepare('SELECT day,category,seconds FROM engagement_daily WHERE campaign_id=? AND member_id=? AND day BETWEEN ? AND ?')
      .bind(campaignId, memberId, shiftDay(today, 1 - engagementRetentionDays), today).all<Daily>(),
  ]);
  const verified = awardsEnabled ? await verifiedEngagementProgress(db, scope, window, today) : { verifiedSeconds: 0, recipient: null, bookedStages: [] };
  const categories: Partial<Record<EngagementCategory, number>> = {};
  let todaySeconds = 0, weekSeconds = 0, intervalSeconds = 0;
  for (const { day, category, seconds } of daily.results) {
    if (day === today) todaySeconds += seconds;
    if (day >= weekStart) weekSeconds += seconds;
    if ('fromDay' in window && day >= window.fromDay && (!('untilDay' in window) || day < window.untilDay)) {
      intervalSeconds += seconds;
      categories[category] = (categories[category] ?? 0) + seconds;
    }
  }
  return {
    window, todaySeconds, weekSeconds, intervalSeconds, categories, awardsEnabled, ...verified,
    progress: 'targets' in window ? { percent: engagementProgress(awardsEnabled ? verified.verifiedSeconds : intervalSeconds, window.targets).percent } : null,
  };
}
