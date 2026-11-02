import { accountRoles } from "@/server/account-profile";
import { database, HttpError } from "@/server/database";

type AccountRow = {
  id: string;
  displayName: string;
  memberName: string | null;
  status: "active" | "blocked";
  verifiedAt: string | null;
};
type PlatformRoleRow = { accountId: string; role: string };
type CampaignRoleRow = { accountId: string; campaignId: string; campaignName: string; role: string; status: string };

export async function platformUserOverview(memberId: string) {
  if (!(await accountRoles(memberId)).includes("platform_admin"))
    throw new HttpError(403, "Nur für die Plattformadministration.");

  const db = database();
  const [accounts, platformRoles, campaignRoles] = await Promise.all([
    db.prepare(`SELECT u.id, u.display_name AS displayName, m.name AS memberName,
        u.status, u.email_verified_at AS verifiedAt
      FROM auth_users u
      LEFT JOIN auth_member_links l ON l.auth_user_id=u.id
      LEFT JOIN members m ON m.id=l.member_id
      ORDER BY lower(u.display_name),u.id`).all<AccountRow>(),
    db.prepare(`SELECT l.auth_user_id AS accountId,p.role
      FROM platform_roles p JOIN auth_member_links l ON l.member_id=p.user_id
      WHERE p.status='active' ORDER BY p.role`).all<PlatformRoleRow>(),
    db.prepare(`SELECT l.auth_user_id AS accountId,c.id AS campaignId,c.name AS campaignName,cm.role,cm.status
      FROM campaign_memberships cm
      JOIN auth_member_links l ON l.member_id=cm.user_id
      JOIN campaigns c ON c.id=cm.campaign_id
      ORDER BY c.name,cm.role`).all<CampaignRoleRow>(),
  ]);

  return accounts.results.map(account => ({
    id: account.id,
    displayName: account.displayName,
    memberName: account.memberName,
    status: account.status,
    verified: Boolean(account.verifiedAt),
    platformRoles: platformRoles.results.filter(row => row.accountId === account.id).map(row => row.role),
    campaigns: campaignRoles.results.filter(row => row.accountId === account.id).map(row => ({
      id: row.campaignId, name: row.campaignName, role: row.role, status: row.status,
    })),
  }));
}
