import {
  actor,
  database,
  gmOnly,
  json,
  failure,
  sameOrigin,
  input,
  HttpError,
} from "@/server/access";
export const dynamic = "force-dynamic";

type MemberRevision = {
  id: string;
  status: "pending" | "active" | "blocked";
  member_version: number;
  membership_status: "pending" | "active" | "blocked" | null;
  membership_role: "campaign_owner" | "campaign_gm" | "campaign_editor" | "player" | null;
  membership_version: number | null;
};

export async function GET() {
  try {
    const a = await actor(false);
    if (a.status !== "active" || !a.gm) return json({ actor: a, members: [] });
    const r = await database()
      .prepare(
        `SELECT m.id,m.email,m.name,COALESCE(cm.status,m.status) AS status,
                m.created_at,COALESCE(cm.version,m.version) AS version,cm.role
         FROM members m
         LEFT JOIN campaign_memberships cm
           ON cm.campaign_id=? AND cm.user_id=m.id
         WHERE m.campaign_id=? OR cm.user_id IS NOT NULL ORDER BY m.created_at DESC`,
      )
      .bind(a.campaignId, a.campaignId)
      .all();
    return json({ actor: a, members: r.results });
  } catch (e) {
    return failure(e);
  }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    gmOnly(a);
    const d = await input(req);
    if (!d || typeof d !== "object" || Array.isArray(d))
      throw new HttpError(400, "Ungültige Freigabe.");
    const body = d as Record<string, unknown>;
    if (Object.keys(body).some((key) => !["id", "status", "expectedVersion"].includes(key)))
      throw new HttpError(400, "Ungültige Freigabe.");
    if (
      !["active", "blocked"].includes(String(body.status)) ||
      typeof body.id !== "string" ||
      (body.expectedVersion !== undefined &&
        (!Number.isInteger(body.expectedVersion) || Number(body.expectedVersion) < 1))
    ) throw new HttpError(400, "Ungültige Freigabe.");
    if (body.id === a.id) throw new HttpError(400, "Dein eigener Zugang bleibt aktiv.");

    const db = database();
    const target = await db.prepare(
      `SELECT m.id,m.status,m.version AS member_version,
              cm.status AS membership_status,cm.role AS membership_role,
              cm.version AS membership_version
       FROM members m
       LEFT JOIN campaign_memberships cm
         ON cm.campaign_id=? AND cm.user_id=m.id
       WHERE m.id=? AND (m.campaign_id=? OR cm.user_id IS NOT NULL)`,
    ).bind(a.campaignId, body.id, a.campaignId).first<MemberRevision>();
    if (!target) throw new HttpError(404, "Mitglied nicht gefunden.");

    const explicitMembership = target.membership_version !== null;
    const currentVersion = explicitMembership
      ? target.membership_version!
      : target.member_version;
    if (body.expectedVersion !== undefined && body.expectedVersion !== currentVersion)
      throw new HttpError(409, "Der Mitgliedsstatus wurde zwischenzeitlich geändert. Bitte neu laden.");

    const nextStatus = body.status as "active" | "blocked";
    const updatedAt = new Date().toISOString();
    const eventId = crypto.randomUUID();
    const beforeState = JSON.stringify({
      role: target.membership_role ?? "legacy",
      status: target.membership_status ?? target.status,
      version: currentVersion,
    });
    const afterState = JSON.stringify({
      role: target.membership_role ?? "legacy",
      status: nextStatus,
      version: currentVersion + 1,
    });

    if (explicitMembership) {
      const results = await db.batch([
        db.prepare(
          `UPDATE campaign_memberships SET status=?,version=version+1,updated_at=?
           WHERE campaign_id=? AND user_id=? AND version=?`,
        ).bind(nextStatus, updatedAt, a.campaignId, body.id, currentVersion),
        db.prepare(
          `INSERT INTO role_audit_events
             (id,actor_id,actor_kind,action,subject_user_id,campaign_id,before_state,after_state,reason,created_at)
           SELECT ?,?,'user','campaign_membership.status_changed',?,?,?,?,?,? WHERE changes()=1`,
        ).bind(eventId, a.id, body.id, a.campaignId, beforeState, afterState,
          "Mitgliederfreigabe über die bestehende Spielleitungsverwaltung.", updatedAt),
      ]);
      if (results[0]?.meta.changes !== 1)
        throw new HttpError(409, "Der Mitgliedsstatus wurde zwischenzeitlich geändert. Bitte neu laden.");
    } else {
      const results = await db.batch([
        db.prepare(
          "UPDATE members SET status=?,version=version+1 WHERE id=? AND campaign_id=? AND version=?",
        ).bind(nextStatus, body.id, a.campaignId, target.member_version),
        db.prepare(
          `INSERT INTO role_audit_events
             (id,actor_id,actor_kind,action,subject_user_id,campaign_id,before_state,after_state,reason,created_at)
           SELECT ?,?,'user','campaign_membership.status_changed',?,?,?,?,?,? WHERE changes()=1`,
        ).bind(eventId, a.id, body.id, a.campaignId, beforeState, afterState,
          "Mitgliederfreigabe über die bestehende Spielleitungsverwaltung.", updatedAt),
      ]);
      if (results[0]?.meta.changes !== 1)
        throw new HttpError(409, "Der Mitgliedsstatus wurde zwischenzeitlich geändert. Bitte neu laden.");
    }
    return json({ ok: true, version: currentVersion + 1 });
  } catch (e) {
    return failure(e, req);
  }
}
