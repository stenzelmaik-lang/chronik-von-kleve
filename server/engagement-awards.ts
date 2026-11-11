import { maximumPulseMs } from '../domain/engagement-browser.ts';
import { berlinMidnight, engagementRetentionDays, shiftDay, type EngagementWindow } from '../domain/engagement-window.ts';
import { plainText } from '../domain/notebook.ts';
import { characterLedger } from '../domain/character-management.ts';
import { xpRewardEntryId } from '../domain/xp-rewards.ts';
import type { EngagementScope } from './engagement-activity.ts';
import { engagementSchedule, engagementScheduleSql } from './engagement-schedule.ts';
import { engagementRewardPlans } from './engagement-reward-plans.ts';
import { bookCharacterXpReward } from './xp-reward-service.ts';
import { parseBody, XpRewardServiceError } from './xp-reward-errors.ts';

const dailyLimitSeconds = 7_200;
const recipientEligible = `
  c.kind='charaktere' AND CASE WHEN json_valid(c.body) THEN json_extract(c.body,'$.engineVersion')=1
  AND json_extract(c.body,'$.characterState')='confirmed'
  AND COALESCE(json_extract(c.body,'$.archived'),0)=0
  AND COALESCE(json_extract(c.body,'$.recoveryOnly'),0)=0
  AND COALESCE(json_extract(c.body,'$.lifecycleStatus'),'ACTIVE')<>'ARCHIVED'
  AND COALESCE(json_extract(c.body,'$.canonStatus'),'')<>'GM_SECRET' ELSE 0 END
  AND NOT EXISTS(SELECT 1 FROM entities e WHERE e.id=c.id AND e.campaign_id=c.campaign_id AND e.canon_status='GM_SECRET')`;

function activeMemberSql(alias: 'l' | 'r') {
  return `COALESCE(
    (SELECT m.status FROM campaign_memberships m WHERE m.campaign_id=${alias}.campaign_id AND m.user_id=${alias}.member_id),
    (SELECT m.status FROM members m WHERE m.campaign_id=${alias}.campaign_id AND m.id=${alias}.member_id)
  )='active'`;
}

type NotebookEvidence = {
  id: string; characterId: string | null; previousText: string; text: string; ticket?: string;
};

function visibleLetters(text: string) {
  return (plainText(text).normalize('NFKC').match(/[\p{L}\p{N}]/gu) ?? []).length;
}

/** Save the notebook revision and claim already measured seconds in one transaction. */
export async function saveNotebookWithEngagement(
  db: D1Database, scope: EngagementScope, mutation: D1PreparedStatement, evidence: NotebookEvidence, now: number,
) {
  const { id, characterId, previousText, text, ticket } = evidence;
  if (!characterId || !ticket) return { saved: await mutation.run(), claimed: false };
  const letters = visibleLetters(text);
  if (letters < 40 || letters <= visibleLetters(previousText)) return { saved: await mutation.run(), claimed: false };
  const { campaignId, memberId } = scope;
  const schedule = await engagementSchedule(db, campaignId, now);
  const { window, today, snapshot } = schedule;
  if (!('fromDay' in window) || today < window.fromDay ||
      ('untilDay' in window && window.status !== 'preview' && today >= window.untilDay)) return { saved: await mutation.run(), claimed: false };

  const { intervalId } = window;
  const [saved, claimed] = await db.batch([
    mutation,
    db.prepare(`
      INSERT INTO engagement_verified_notes(campaign_id,member_id,interval_id,day,note_id,high_water,seconds)
      SELECT l.campaign_id,l.member_id,?,?,?,?,MIN(l.unclaimed_notebook_seconds,? - totals.seconds,900 - COALESCE(v.seconds,0))
      FROM engagement_leases l
      JOIN records c ON c.id=? AND c.campaign_id=l.campaign_id AND c.owner_id=l.member_id
      LEFT JOIN engagement_verified_notes v ON v.campaign_id=l.campaign_id AND v.member_id=l.member_id AND v.day=? AND v.note_id=?
      CROSS JOIN (SELECT COALESCE(SUM(seconds),0) AS seconds FROM engagement_verified_notes WHERE campaign_id=? AND member_id=? AND day=?) totals
      WHERE changes()=1 AND l.campaign_id=? AND l.member_id=? AND l.ticket=? AND l.category='notebook'
        AND l.received_at BETWEEN ? AND ? AND l.unclaimed_notebook_seconds>0 AND totals.seconds<?
        AND (v.note_id IS NULL OR (v.interval_id=? AND v.seconds<900 AND v.high_water+40<=?))
        AND EXISTS(SELECT 1 FROM records n WHERE n.id=? AND n.campaign_id=l.campaign_id AND n.owner_id=l.member_id
          AND n.kind='notizen' AND json_extract(n.body,'$.characterId')=c.id)
        AND ${recipientEligible} AND ${activeMemberSql('l')}
        AND NOT EXISTS(SELECT 1 FROM engagement_recipients r WHERE r.campaign_id=l.campaign_id AND r.interval_id=?
          AND ((r.member_id=l.member_id AND r.character_id<>c.id) OR (r.character_id=c.id AND r.member_id<>l.member_id)))
        AND ?=(${engagementScheduleSql})
      ON CONFLICT(campaign_id,member_id,day,note_id) DO UPDATE SET
        seconds=engagement_verified_notes.seconds+excluded.seconds, high_water=excluded.high_water
    `).bind(intervalId, today, id, letters, dailyLimitSeconds, characterId, today, id, campaignId, memberId, today,
      campaignId, memberId, ticket, Math.max(berlinMidnight(today), now - maximumPulseMs), now, dailyLimitSeconds,
      intervalId, letters, id, intervalId, snapshot, campaignId, today),
    db.prepare(`
      UPDATE engagement_leases SET unclaimed_notebook_seconds=0
      WHERE campaign_id=? AND member_id=? AND ticket=? AND changes()=1
    `).bind(campaignId, memberId, ticket),
    db.prepare(`
      INSERT INTO engagement_recipients(campaign_id,member_id,interval_id,character_id)
      SELECT ?,?,?,? WHERE changes()=1 ON CONFLICT DO NOTHING
    `).bind(campaignId, memberId, intervalId, characterId),
  ]);
  return { saved, claimed: claimed.meta.changes > 0 };
}

async function recipientProgress(db: D1Database, scope: EngagementScope, window: EngagementWindow, today: string) {
  if (!('fromDay' in window)) return null;
  const cutoff = shiftDay(today, 1 - engagementRetentionDays);
  const fromDay = window.fromDay < cutoff ? cutoff : window.fromDay;
  const untilDay = 'untilDay' in window ? window.untilDay : shiftDay(today, 1);
  return db.prepare(`
    SELECT c.id,c.title,c.body,COALESCE((
      SELECT SUM(v.seconds) FROM engagement_verified_notes v
      WHERE v.campaign_id=r.campaign_id AND v.interval_id=r.interval_id AND v.member_id=r.member_id
        AND v.day>=? AND v.day<=? AND v.day<?
    ),0) AS seconds
    FROM engagement_recipients r
    JOIN records c ON c.id=r.character_id AND c.campaign_id=r.campaign_id AND c.owner_id=r.member_id
    WHERE r.campaign_id=? AND r.interval_id=? AND r.member_id=? AND ${recipientEligible}
  `).bind(fromDay, today, untilDay,
    scope.campaignId, window.intervalId, scope.memberId).first<{ id: string; title: string; body: string; seconds: number }>();
}

export async function verifiedEngagementProgress(db: D1Database, scope: EngagementScope, window: EngagementWindow, today: string) {
  const recipient = await recipientProgress(db, scope, window, today);
  const ledger = recipient ? characterLedger(parseBody(recipient.body)) : [];
  const reversed = new Set(ledger.map(entry => entry.referenceId));
  const bookedStages = 'intervalId' in window ? ledger.flatMap(entry => {
    const source = entry.source;
    return entry.kind === 'grant' && source?.type === 'engagement' && source.campaignId === scope.campaignId &&
      source.scopeId === window.intervalId && source.milestone && !reversed.has(entry.id) ? [source.milestone] : [];
  }) : [];
  return { verifiedSeconds: recipient?.seconds ?? 0, recipient: recipient?.title ?? null, bookedStages };
}

export async function reconcileEngagement(
  db: D1Database, scope: EngagementScope, now: number, schedule?: Awaited<ReturnType<typeof engagementSchedule>>,
) {
  const { campaignId, memberId } = scope;
  const { window, today, snapshot } = schedule ?? await engagementSchedule(db, campaignId, now);
  if (window.status !== 'confirmed') return;
  const recipient = await recipientProgress(db, scope, window, today);
  if (!recipient) return;
  const plans = engagementRewardPlans(window, {
    campaignId, actorId: memberId, characterId: recipient.id, intervalId: window.intervalId,
    appointmentId: window.appointmentId, appointmentDate: window.appointmentDate, verifiedSeconds: recipient.seconds,
  });
  const booked = new Set(characterLedger(parseBody(recipient.body)).map(entry => entry.id));
  for (const plan of plans) {
    if (booked.has(xpRewardEntryId(plan.source))) continue;
    await bookCharacterXpReward(db, {
      ...plan, now: new Date(now).toISOString(),
      guard: {
        sql: `owner_id=? AND ?=(${engagementScheduleSql}) AND EXISTS(
          SELECT 1 FROM engagement_recipients r
          WHERE r.campaign_id=? AND r.member_id=? AND r.interval_id=? AND r.character_id=? AND ${activeMemberSql('r')}
        ) AND NOT EXISTS(SELECT 1 FROM entities e WHERE e.id=records.id AND e.campaign_id=records.campaign_id AND e.canon_status='GM_SECRET')`,
        bindings: [memberId, snapshot, campaignId, today, campaignId, memberId, window.intervalId, recipient.id],
      },
    });
  }
}

export async function reconcileEngagementAfterSave(db: D1Database, scope: EngagementScope, now: number) {
  try {
    await reconcileEngagement(db, scope, now);
  } catch (error) {
    reportBookingFailure(error);
  }
}

function reportBookingFailure(error: unknown) {
  // The saved note and its evidence stay durable. The next qualifying workflow retries.
  const status = error instanceof XpRewardServiceError ? error.status : 503;
  console.warn('Engagement EP reconciliation deferred', status);
}

export async function reconcileCampaignEngagement(db: D1Database, campaignId: string, now: number) {
  try {
    const schedule = await engagementSchedule(db, campaignId, now);
    if (schedule.window.status !== 'confirmed') return;
    const recipients = await db.prepare('SELECT member_id FROM engagement_recipients WHERE campaign_id=? AND interval_id=?')
      .bind(campaignId, schedule.window.intervalId).all<{ member_id: string }>();
    for (const { member_id: memberId } of recipients.results) {
      try {
        await reconcileEngagement(db, { campaignId, memberId }, now, schedule);
      } catch (error) {
        reportBookingFailure(error);
      }
    }
  } catch (error) {
    reportBookingFailure(error);
  }
}
