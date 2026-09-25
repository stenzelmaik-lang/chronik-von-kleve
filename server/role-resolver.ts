import type { D1Database } from "@cloudflare/workers-types";
import type { CampaignRole, MembershipStatus, PlatformRole } from "../domain/types";

type CampaignMembershipRow = { role: CampaignRole; status: MembershipStatus };
type LegacyMembershipRow = { status: MembershipStatus };
type PlatformRoleRow = { role: PlatformRole };

export type ResolvedRoles = {
  campaignId: string;
  campaignRole: CampaignRole;
  campaignStatus: MembershipStatus;
  platformRoles: PlatformRole[];
  source: "campaign_membership" | "legacy_gm_adapter" | "legacy_player" | "unregistered";
};

/**
 * Resolve platform and campaign roles independently. A platform role never
 * implies a campaign role. Existing GM_EMAIL access is only a transitional
 * adapter for the active legacy Kleve membership.
 */
export async function resolveRoles(
  db: D1Database,
  input: {
    userId: string;
    email: string;
    campaignId: string;
    gmEmail: string;
    gmCampaignId: string;
  },
): Promise<ResolvedRoles> {
  const [campaignMembership, legacyMembership, platformRoleRows] = await Promise.all([
    db.prepare(
      "SELECT role,status FROM campaign_memberships WHERE campaign_id=? AND user_id=?",
    ).bind(input.campaignId, input.userId).first<CampaignMembershipRow>(),
    db.prepare(
      "SELECT status FROM members WHERE campaign_id=? AND id=?",
    ).bind(input.campaignId, input.userId).first<LegacyMembershipRow>(),
    db.prepare(
      "SELECT role FROM platform_roles WHERE user_id=? AND status='active' ORDER BY role",
    ).bind(input.userId).all<PlatformRoleRow>(),
  ]);

  if (campaignMembership) {
    return {
      campaignId: input.campaignId,
      campaignRole: campaignMembership.role,
      campaignStatus: campaignMembership.status,
      platformRoles: platformRoleRows.results.map((row) => row.role),
      source: "campaign_membership",
    };
  }

  const isLegacyKleveGm =
    input.campaignId === input.gmCampaignId &&
    legacyMembership?.status === "active" &&
    input.gmEmail.length > 0 &&
    input.email.trim().toLowerCase() === input.gmEmail.trim().toLowerCase();

  return {
    campaignId: input.campaignId,
    campaignRole: isLegacyKleveGm ? "campaign_gm" : "player",
    campaignStatus: legacyMembership?.status ?? "pending",
    platformRoles: platformRoleRows.results.map((row) => row.role),
    source: legacyMembership
      ? isLegacyKleveGm ? "legacy_gm_adapter" : "legacy_player"
      : "unregistered",
  };
}
