import { maximumPulseMs, minimumPulseMs, pulseMs, type EngagementCategory } from '../domain/engagement-browser.ts';
import { berlinDay, berlinMidnight, engagementWindow, shiftDay } from '../domain/engagement-window.ts';
import { engagementProgress } from '../domain/engagement-targets.ts';
import { parseBody } from './xp-reward-errors.ts';

type Scope = { campaignId: string; memberId: string };
export type EngagementPulse = { category: EngagementCategory; ticket?: string; restart?: boolean };
type Lease = { category: EngagementCategory; received_at: number };
type Daily = { day: string; category: EngagementCategory; seconds: number };

const dailyRetention = 365;
const rejected = { ticket: null, seconds: 0 };

export async function recordEngagementPulse(db: D1Database, scope: Scope, pulse: EngagementPulse, now: number) {
  const { campaignId, memberId } = scope;
  const day = berlinDay(now);
  const ticket = crypto.randomUUID();

  if (pulse.restart && pulse.ticket) {
    const result = await db.prepare(`
      UPDATE engagement_leases SET ticket=?,category=?,received_at=?
      WHERE campaign_id=? AND member_id=? AND ticket=? AND received_at<=?
    `).bind(ticket, pulse.category, now, campaignId, memberId, pulse.ticket, now - 5_000).run();
    return result.meta.changes ? { ticket, seconds: 0 } : rejected;
  }

  if (pulse.ticket === undefined) {
    const [started] = await db.batch([
      db.prepare(`
        INSERT INTO engagement_leases(campaign_id,member_id,ticket,category,received_at) VALUES(?,?,?,?,?)
        ON CONFLICT(campaign_id,member_id) DO UPDATE SET
          ticket=excluded.ticket, category=excluded.category, received_at=excluded.received_at
        WHERE engagement_leases.received_at < ?
      `).bind(campaignId, memberId, ticket, pulse.category, now, now - maximumPulseMs),
      db.prepare('DELETE FROM engagement_daily WHERE campaign_id=? AND member_id=? AND day<?')
        .bind(campaignId, memberId, shiftDay(day, 1 - dailyRetention)),
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
    db.prepare('UPDATE engagement_leases SET ticket=?,received_at=? WHERE campaign_id=? AND member_id=? AND ticket=?')
      .bind(ticket, now, campaignId, memberId, pulse.ticket),
  ]);
  return rotated.meta.changes ? { ticket, seconds } : rejected;
}

export async function engagementSummary(db: D1Database, scope: Scope, now: number) {
  const { campaignId, memberId } = scope;
  const today = berlinDay(now);
  const weekStart = shiftDay(today, -6);
  const [played, appointments, daily] = await Promise.all([
    db.prepare(`
      SELECT id,played_on AS day FROM played_sessions
      WHERE campaign_id=? AND played_on<=? ORDER BY played_on DESC,registered_at DESC,id LIMIT 1
    `).bind(campaignId, today).first<{ id: string; day: string }>(),
    db.prepare(`
      SELECT r.id,r.body FROM records r
      WHERE r.campaign_id=? AND r.kind='termine' AND r.visibility='group'
        AND CASE WHEN json_valid(r.body) THEN json_extract(r.body,'$.engagementGameNight')=1 ELSE 0 END
        AND NOT EXISTS(SELECT 1 FROM played_sessions p WHERE p.campaign_id=r.campaign_id AND p.appointment_id=r.id)
    `).bind(campaignId).all<{ id: string; body: string }>(),
    db.prepare('SELECT day,category,seconds FROM engagement_daily WHERE campaign_id=? AND member_id=? AND day BETWEEN ? AND ?')
      .bind(campaignId, memberId, shiftDay(today, 1 - dailyRetention), today).all<Daily>(),
  ]);
  const window = engagementWindow(played, appointments.results.map(({ id, body }) => ({ id, body: parseBody(body) })), now);
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
    window, todaySeconds, weekSeconds, intervalSeconds, categories,
    progress: 'targets' in window ? { percent: engagementProgress(intervalSeconds, window.targets).percent } : null,
  };
}
