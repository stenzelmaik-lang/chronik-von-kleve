# Identity and closed-alpha authentication gate

**Local implementation status: cookie-based Auth 2.0 is integrated in the Phase-C working copy and tested with synthetic users only.** This does not mean a real account, production migration, or production login has been provisioned.

## Implemented in the current local source

- The app signs in at `/anmelden` with a server-created, random session token. Only its SHA-256 hash is stored in `auth_sessions`; the browser cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` on HTTPS. Session lookup rejects expired, revoked, blocked, or unlinked accounts.
- A valid session is resolved through `auth_member_links` to the exact existing `members.id`. The existing campaign-role resolver receives that member ID and its stored member email. The request never creates, renames, or re-keys a `members` row.
- The `members.id`, campaign membership, platform-role, character-owner, inventory-owner, personal-note, and file-owner values remain unchanged. No automatic email comparison, owner transfer, or real platform-admin assignment is performed.
- The public registration endpoint always returns 404. There is no public account-creation, account-link, or administrator-bootstrap endpoint. Sign-in succeeds only for an active, independently email-verified `auth_users` account with an explicit member crosswalk. Session resolution rechecks verification status.
- All current `/api/cms/*` handlers call the shared server-side session actor before handling protected data. The legacy `oai-authenticated-*` request headers do not authenticate requests; the old header-reader module was removed from the app.
- Migration `0006_auth_platform` adds the auth account, provider identity, session, rate-limit, and immutable crosswalk tables after `0004` and `0005`. It contains no account backfill and grants no role. Its only test application was to fresh isolated local D1.

## Identity and ownership mapping

| Record | Current meaning | Auth treatment |
|---|---|---|
| `members.id` | Existing application/member principal | Preserved byte-for-byte; this remains the principal ID for authorization and existing content ownership. |
| `campaign_memberships.user_id`, `platform_roles.user_id` | Existing role subjects | Continue to use the existing `members.id`; Auth does not create global admin rights or infer campaign access. |
| Character, inventory, notes, files, and other owner IDs | Existing data ownership | No re-key, email merge, or transfer. |
| `auth_users.id` | New Auth account ID | Separate from `members.id`; it grants no game role by itself. |
| `(auth_identities.provider, provider_subject)` | Verified provider identity slot | Unique pair stored separately. Provider flows are not implemented in this phase. Email is not an identity key. |
| `auth_member_links.auth_user_id → member_id` | Explicit Auth-to-existing-member association | One-to-one and database-enforced unique. Stores `approved_by` and `approval_reference`; update/delete are blocked to prevent silent reassignment. |

## First real closed-alpha account: still a release blocker

The application has no public or self-service route for creating accounts or crosswalks. The only demonstrated setup is synthetic data in disposable Test-D1. A real player account must **not** be linked by matching email strings. Before live use, the project owner must approve an operator-run provisioning procedure that independently verifies the player's account and intended existing `members.id`, records who approved it and the verification reference, securely provisions the password credential, and writes the Auth account plus immutable link. The current `approved_by` / `approval_reference` columns record an approval claim; they do not independently verify identity. No such operator workflow or real account has been created here.

Until that process is approved and tested, no real alpha user can safely be admitted. Do not substitute an ad-hoc public linking endpoint or seed a real user during deployment.

## Providers, admin roles, and remaining gates

- Email/password sign-in is implemented for already provisioned, linked accounts. Password records use PBKDF2-HMAC-SHA-256 with 600,000 iterations. Login bodies are capped at 2 KB, email at 320 characters, and password at 200 characters before PBKDF2 runs. Missing, unlinked, and unverified account attempts perform a dummy hash verification and receive the same generic rejection. No email-verification flow exists; a separately approved operator process must independently verify an address before setting `email_verified_at`.
- `google` and `discord` are allowed provider enum values only. OAuth authorization, callbacks, signature/issuer validation, state/nonce/PKCE, secrets, and account-link UI are **not implemented**.
- No `platform_admin` has been created. There is no self-assignment or role-bootstrap endpoint. Platform administration and campaign roles remain separate.
- Before production release, separately approve the real-account provisioning/crosswalk procedure, verify the first real users and their existing owner IDs, plan any schema migration, take the required production backup, and run authorized player/GM access tests. M0006 has not been applied to production; do not treat local integration success as production acceptance.

## Verification evidence

The isolated local regression checks migration order `0004 → 0005 → 0006`, closed registration, successful login for a synthetic explicitly linked account, rejection of a same-email but unlinked account, session-to-existing-member resolution, rejection of forged OAI headers, and 401 responses for every implemented CMS route method without a session. The full counts and build status are recorded in the current technical handover/test output; all writes were confined to disposable local D1/R2 resources.
