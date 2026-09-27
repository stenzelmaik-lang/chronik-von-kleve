import type { D1Database } from "@cloudflare/workers-types";
import type { CampaignRole, MembershipStatus } from "../domain/types";

type LegacyMember = {
  id: string;
  email: string;
  status: string;
  campaign_id: string;
  created_at: string;
  campaign_exists: string | null;
};
type ExistingMembership = {
  campaign_id: string;
  user_id: string;
  role: CampaignRole;
  status: MembershipStatus;
};
type PlannedMembership = {
  campaignId: string;
  userId: string;
  role: CampaignRole;
  status: MembershipStatus;
  createdAt: string;
};

export type MembershipBackfillPlan = {
  rows: PlannedMembership[];
  insert: PlannedMembership[];
  unchanged: PlannedMembership[];
  conflicts: Array<{ campaignId: string; userId: string; reason: string }>;
};

/** Read-only preflight. All legacy rows are considered before any write occurs. */
export async function planMembershipBackfill(
  db: D1Database,
  gmEmail: string,
  gmCampaignId: string,
): Promise<MembershipBackfillPlan> {
  const [legacyResult, membershipsResult] = await Promise.all([
    db.prepare(
      `SELECT m.id,m.email,m.status,m.campaign_id,m.created_at,c.id AS campaign_exists
       FROM members m LEFT JOIN campaigns c ON c.id=m.campaign_id
       ORDER BY m.campaign_id,m.id`,
    ).all<LegacyMember>(),
    db.prepare(
      "SELECT campaign_id,user_id,role,status FROM campaign_memberships ORDER BY campaign_id,user_id",
    ).all<ExistingMembership>(),
  ]);
  const existing = new Map(
    membershipsResult.results.map((row) => [`${row.campaign_id}\u0000${row.user_id}`, row]),
  );
  const plan: MembershipBackfillPlan = { rows: [], insert: [], unchanged: [], conflicts: [] };
  for (const row of legacyResult.results) {
    const key = `${row.campaign_id}\u0000${row.id}`;
    const reason =
      !row.id?.trim() ? "missing stable user id" :
      !row.campaign_id?.trim() || !row.campaign_exists ? "campaign does not exist" :
      !["pending", "active", "blocked"].includes(row.status) ? "unsupported legacy status" :
      null;
    if (reason) {
      plan.conflicts.push({ campaignId: row.campaign_id ?? "", userId: row.id ?? "", reason });
      continue;
    }
    const status = row.status as MembershipStatus;
    const role: CampaignRole =
      row.campaign_id === gmCampaignId && gmEmail.trim() !== "" &&
      row.email.trim().toLowerCase() === gmEmail.trim().toLowerCase()
        ? "campaign_gm"
        : "player";
    const planned = {
      campaignId: row.campaign_id,
      userId: row.id,
      role,
      status,
      createdAt: row.created_at,
    };
    plan.rows.push(planned);
    const prior = existing.get(key);
    if (!prior) plan.insert.push(planned);
    else if (prior.role === role && prior.status === status) plan.unchanged.push(planned);
    else plan.conflicts.push({
      campaignId: row.campaign_id,
      userId: row.id,
      reason: `existing explicit membership is ${prior.role}/${prior.status}; legacy source resolves to ${role}/${status}`,
    });
  }
  return plan;
}

/**
 * Deterministic, idempotent backfill. A full read-only conflict scan runs first;
 * inserts are plain INSERTs in a single atomic D1 batch so a concurrent insert
 * fails and rolls back the whole batch instead of silently winning.
 */
export async function backfillMemberships(
  db: D1Database,
  gmEmail: string,
  gmCampaignId: string,
  now = new Date().toISOString(),
): Promise<{ planned: number; inserted: number; unchanged: number }> {
  const plan = await planMembershipBackfill(db, gmEmail, gmCampaignId);
  if (plan.conflicts.length) {
    const detail = plan.conflicts.map((item) => `${item.campaignId}/${item.userId}: ${item.reason}`).join("; ");
    throw new Error(`Membership backfill stopped: ${detail}`);
  }
  if (!plan.insert.length) {
    return { planned: plan.rows.length, inserted: 0, unchanged: plan.unchanged.length };
  }
  const statements = plan.insert.flatMap((row) => {
    const auditId = `legacy-backfill:${row.campaignId}:${row.userId}`;
    return [
      db.prepare(
        `INSERT INTO campaign_memberships
         (campaign_id,user_id,role,status,source,granted_by,version,created_at,updated_at)
         VALUES(?,?,?,?,'legacy_backfill',NULL,1,?,?)`,
      ).bind(row.campaignId, row.userId, row.role, row.status, row.createdAt || now, now),
      db.prepare(
        `INSERT INTO role_audit_events
         (id,actor_id,actor_kind,action,subject_user_id,campaign_id,before_state,after_state,reason,created_at)
         SELECT ?, 'phase-b-membership-backfill', 'system', 'campaign_membership.backfilled', ?, ?, '{}', ?, ?, ?
         WHERE changes()=1`,
      ).bind(
        auditId,
        row.userId,
        row.campaignId,
        JSON.stringify({ role: row.role, status: row.status }),
        "Deterministische Phase-B-Übernahme aus members.",
        now,
      ),
    ];
  });
  const results = await db.batch(statements);
  const inserted = results.filter((_, index) => index % 2 === 0)
    .reduce((sum, result) => sum + (result.meta?.changes ?? 0), 0);
  if (inserted !== plan.insert.length)
    throw new Error("Membership backfill stopped after a concurrent revision conflict.");
  return { planned: plan.rows.length, inserted, unchanged: plan.unchanged.length };
}

