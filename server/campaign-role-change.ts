import { account, accountRoles } from "@/server/account-profile";
import { database, HttpError } from "@/server/database";

type Membership = { memberId: string; role: string; status: string; version: number };

export async function changeCampaignRole(request: Request, value: unknown) {
  const actor = await account(request);
  if (!(await accountRoles(actor.memberId)).includes("platform_admin"))
    throw new HttpError(403, "Nur für die Plattformadministration.");
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpError(400, "Ungültige Rollenänderung.");
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => !["accountId", "campaignId", "role", "expectedVersion", "reason"].includes(key)) ||
    typeof body.accountId !== "string" || !body.accountId ||
    typeof body.campaignId !== "string" || !body.campaignId ||
    !["player", "campaign_gm"].includes(String(body.role)) ||
    typeof body.reason !== "string" || !body.reason.trim() || body.reason.length > 500)
    throw new HttpError(400, "Nur der Wechsel zwischen Spieler und SL mit Begründung ist erlaubt.");
  if (body.expectedVersion === undefined)
    throw new HttpError(428, "Bitte die Benutzerübersicht neu laden.");
  if (!Number.isInteger(body.expectedVersion) || Number(body.expectedVersion) < 1)
    throw new HttpError(400, "Ungültige Mitgliedschaftsversion.");

  const db = database();
  const membership = await db.prepare(`SELECT cm.user_id AS memberId,cm.role,cm.status,cm.version
    FROM campaign_memberships cm JOIN auth_member_links l ON l.member_id=cm.user_id
    JOIN auth_users u ON u.id=l.auth_user_id
    WHERE l.auth_user_id=? AND cm.campaign_id=? AND u.status='active'`)
    .bind(body.accountId, body.campaignId).first<Membership>();
  if (!membership) throw new HttpError(404, "Aktive Kontozuordnung nicht gefunden.");
  if (membership.status !== "active" || !["player", "campaign_gm"].includes(membership.role))
    throw new HttpError(403, "Diese Mitgliedschaft kann hier nicht geändert werden.");
  if (membership.version !== body.expectedVersion)
    throw new HttpError(409, "Die Mitgliedschaft wurde inzwischen geändert. Bitte neu laden.");
  if (membership.role === body.role)
    throw new HttpError(400, "Die Rolle ist bereits zugewiesen.");

  const stamp = new Date().toISOString();
  const event = crypto.randomUUID();
  const results = await db.batch([
    db.prepare(`UPDATE campaign_memberships SET role=?,version=version+1,updated_at=?
      WHERE campaign_id=? AND user_id=? AND status='active' AND role=? AND version=?
      AND EXISTS(SELECT 1 FROM auth_users u JOIN auth_member_links l ON l.auth_user_id=u.id
        JOIN platform_roles p ON p.user_id=l.member_id
        WHERE u.id=? AND u.status='active' AND u.email_verified_at IS NOT NULL
        AND p.role='platform_admin' AND p.status='active')`)
      .bind(body.role, stamp, body.campaignId, membership.memberId, membership.role, membership.version, actor.id),
    db.prepare(`INSERT INTO auth_security_events(id,actor_id,subject_user_id,action,metadata,created_at)
      SELECT ?,?,?,'campaign_membership.role_changed',?,? WHERE changes()=1`)
      .bind(event, actor.id, body.accountId, JSON.stringify({campaignId: body.campaignId,
        memberId: membership.memberId, from: membership.role, to: body.role,
        previousVersion: membership.version, version: membership.version + 1, reason: body.reason.trim()}), stamp),
  ]);
  if (results[0]?.meta.changes !== 1)
    throw new HttpError(409, "Die Berechtigung oder Mitgliedschaft hat sich geändert. Bitte neu laden.");
  return { ok: true, version: membership.version + 1 };
}
