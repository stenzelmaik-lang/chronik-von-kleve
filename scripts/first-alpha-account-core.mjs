import assert from "node:assert/strict";

export const firstAlphaAccount = Object.freeze({
  email: "stenzel.maik@gmail.com",
  campaignId: "chronik-von-kleve",
  accountId: "688c841e3110458e2e64b001c3291920",
});

export function firstAlphaTarget(mode) {
  assert.ok(mode === "test" || mode === "production", "Explicit test or production target required.");
  return mode === "test"
    ? { mode, name: "chronik-von-kleve-phase-c-db", id: "93863382-2046-4efc-a5b7-7eb1306955f9", userId: "alpha-pano-test-2026", memberId: "alpha-pano-test-member-2026" }
    : { mode, name: "chronik-von-kleve-db", id: "a4bc79e6-3f33-4b03-b240-9c341bd1d4d7", userId: "alpha-pano-2026", memberId: "alpha-pano-member-2026" };
}

export const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

export function inspectFirstAlphaState(rows, memberRows, campaignCount) {
  assert.equal(campaignCount, 1, "Approved campaign must exist exactly once.");
  assert.ok(rows.length <= 1 && memberRows.length <= 1, "Ambiguous existing identity; manual review required.");
  if (!rows.length) {
    assert.equal(memberRows.length, 0, "An unlinked legacy member exists; refusing an automatic identity link.");
    return { existing: false };
  }
  const row = rows[0];
  assert.equal(row.email_normalized, firstAlphaAccount.email);
  assert.equal(row.status, "active", "Blocked account must not be reactivated.");
  assert.ok(row.email_verified_at && row.has_password === 1, "Existing identity is not verified and ready.");
  assert.equal(row.member_email?.toLowerCase(), firstAlphaAccount.email);
  assert.equal(row.member_status, "active", "Blocked or pending member must not be bypassed.");
  assert.equal(row.campaign_id, firstAlphaAccount.campaignId);
  assert.equal(row.role, "campaign_gm", "Unexpected campaign role; refusing privilege changes.");
  assert.equal(row.campaign_status, "active");
  assert.equal(row.platform_roles, 0, "This process cannot grant or adopt a platform administrator.");
  assert.equal(row.campaign_count, 1, "Unexpected additional campaign memberships.");
  assert.equal(row.local_identity_count, 1, "A local identity must exist exactly once.");
  assert.equal(memberRows[0]?.id, row.member_id);
  return { existing: true, userId: row.id, memberId: row.member_id };
}

export function firstAlphaInsertStatements(target, passwordHash, now, auditId) {
  assert.deepEqual(target, firstAlphaTarget(target.mode), "Unapproved database or identity target.");
  assert.match(passwordHash, /^pbkdf2_sha256\$600000\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]{43}$/);
  assert.ok(Number.isFinite(Date.parse(now)));
  const q = quote;
  const { email, campaignId } = firstAlphaAccount;
  const label = target.mode === "test" ? "Pano TEST_DATA" : "Pano";
  const approval = `Owner-approved first Alpha account; independently verified Cloudflare OAuth; ${target.mode}; 2026-09-27`;
  return [
    `INSERT INTO members(id,email,name,status,created_at,campaign_id,version) VALUES(${q(target.memberId)},${q(email)},${q(label)},'active',${q(now)},${q(campaignId)},1)`,
    `INSERT INTO auth_users(id,email,email_normalized,display_name,password_hash,email_verified_at,status,created_at,updated_at) VALUES(${q(target.userId)},${q(email)},${q(email)},${q(label)},${q(passwordHash)},${q(now)},'active',${q(now)},${q(now)})`,
    `INSERT INTO auth_identities(id,user_id,provider,provider_subject,provider_email,created_at,updated_at) VALUES(${q(target.userId + '-local')},${q(target.userId)},'local',${q(target.userId)},${q(email)},${q(now)},${q(now)})`,
    `INSERT INTO auth_member_links(auth_user_id,member_id,approved_by,approval_reference,linked_at) VALUES(${q(target.userId)},${q(target.memberId)},${q('Cloudflare OAuth: ' + email)},${q(approval)},${q(now)})`,
    `INSERT INTO campaign_memberships(campaign_id,user_id,role,status,source,granted_by,version,created_at,updated_at) VALUES(${q(campaignId)},${q(target.memberId)},'campaign_gm','active','manual',${q(target.userId)},1,${q(now)},${q(now)})`,
    `INSERT INTO role_audit_events(id,actor_id,actor_kind,action,subject_user_id,campaign_id,before_state,after_state,reason,created_at) VALUES(${q(auditId)},${q('Cloudflare OAuth: ' + email)},'system','campaign_membership.status_changed',${q(target.memberId)},${q(campaignId)},'{}',${q(JSON.stringify({ role: 'campaign_gm', status: 'active', source: 'manual', testData: target.mode === 'test' }))},${q(approval + '; no platform_admin')},${q(now)})`,
  ];
}

export function firstAlphaReadQuery() {
  const email = quote(firstAlphaAccount.email);
  return `SELECT u.id,u.email_normalized,u.status,u.email_verified_at,(u.password_hash IS NOT NULL) AS has_password,l.member_id,m.email AS member_email,m.status AS member_status,cm.campaign_id,cm.role,cm.status AS campaign_status,(SELECT COUNT(*) FROM platform_roles pr WHERE pr.user_id IN (u.id,l.member_id)) AS platform_roles,(SELECT COUNT(*) FROM campaign_memberships c WHERE c.user_id=l.member_id) AS campaign_count,(SELECT COUNT(*) FROM auth_identities i WHERE i.user_id=u.id AND i.provider='local' AND i.provider_subject=u.id) AS local_identity_count FROM auth_users u LEFT JOIN auth_member_links l ON l.auth_user_id=u.id LEFT JOIN members m ON m.id=l.member_id LEFT JOIN campaign_memberships cm ON cm.user_id=l.member_id AND cm.campaign_id=${quote(firstAlphaAccount.campaignId)} WHERE u.email_normalized=${email}`;
}
