// Existing profiles have no preference and use the closed alpha default.
export const engagementTrackingAllowedSql = `NOT EXISTS(
  SELECT 1 FROM auth_member_links l JOIN auth_profiles p ON p.user_id=l.auth_user_id
  WHERE l.member_id=? AND json_type(p.preferences,'$.engagementTracking')='false'
)`;

export async function engagementTrackingEnabled(db: D1Database, memberId: string) {
  const row = await db.prepare(`SELECT ${engagementTrackingAllowedSql} AS enabled`)
    .bind(memberId).first<{ enabled: number }>();
  return row?.enabled === 1;
}
