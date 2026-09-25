# Cloudflare identity integration – Phase-C release gate

**Status: design constraint only. Authentication, account linking and identity migration are not implemented in Phase C.**

The current app resolves the Sites-authenticated immutable `userId` through the existing server-side actor and then applies the Phase-B campaign-role resolver. This phase adds no authentication endpoint and trusts no browser-supplied identity value. A Cloudflare target must not infer identity from unsigned `oai-*` request headers.

## Required identity mapping

| Current record | Future stable meaning | Required treatment |
|---|---|---|
| `members.id` | Internal application principal ID; currently the Sites-authenticated stable user ID | Preserve as application ID for account continuity. Do not replace it with an email, Google ID or Discord name. |
| `campaign_memberships.user_id` and `platform_roles.user_id` | Authorization rows attached to the internal principal | Keep foreign-key semantics; role and status rows move only through an audited migration/administrative process. |
| `characters.owner_id`, inventory ownership, personal notes, file ownership and other existing owner IDs | Existing content owner principal | Preserve exact values and rows. No automatic re-key, email merge or ownership transfer. |
| Future `(provider, provider_subject)` | Auth-provider identity | Store separately with a unique provider/subject pair; resolve it server-side to one internal principal. Email is profile/contact data, not the key. |
| Google / Discord profile email, display name | Mutable provider attributes | Update only as profile attributes after provider verification. Never use equality of email strings alone to merge accounts. |

The future implementation may add an `auth_identities` table referencing the internal principal and, if needed, a one-time migration/link audit record. Those schema changes require their own reviewed migration. Phase C does not create these tables.

## Safe account-link flow

1. Authenticate through the existing provider and create a server-side linking session bound to the existing internal principal.
2. Authenticate the new email/password, Google or Discord credential in the same protected flow. Validate provider issuer, audience, signature, expiry, OAuth state/nonce and PKCE where applicable; verify email for the email/password account.
3. Require explicit confirmation and write a unique `(provider, subject) → principal ID` mapping with an audit event. Reject a provider identity already linked elsewhere.
4. Never merge two principals because names or emails match. Conflicts go to a separate account-recovery review that proves control of both identities or uses a separately approved support process.
5. Keep all existing campaign, character, inventory, notes and file-owner IDs attached to the original principal. Transfer/merge is a separate, explicit, audited user operation.
6. Test parallel linking, replayed OAuth callbacks, blocked users, account unlink, provider email change and foreign-campaign isolation before production enablement.

## Release gate

Before a Cloudflare deployment can serve real players, deliver and review the chosen identity-provider architecture, secret handling, callback/origin allowlists, recovery process, rate limits, session invalidation, identity-link conflict handling, audit policy and data-preservation migration. Test with at least two real player accounts and a separate GM account. Until then the Phase-C CMS is an isolated implementation preview and is not safe to expose as a live Cloudflare player service.
