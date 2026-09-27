# Controlled first platform administrator bootstrap

**Status: NOT ENABLED. No real platform administrator has been created.**

The Phase B runtime deliberately provides no platform-administrator bootstrap function or HTTP endpoint. Comparing two caller-supplied identity strings, a GM email, or an `authorizedByUserId` string does not prove who is signed in and does not independently authorize an operator. The role tables and audit schema also do not independently authenticate or approve a bootstrap.

## Required procedure before a future bootstrap

1. Open a restricted change request that names the intended account, the reason, the target environment, the operator, and a unique approval reference. Do not use email as the account key.
2. The target signs in through the normal ChatGPT authentication flow. Resolve the immutable user ID from the server-side authenticated session and the existing `members` record; never accept the target ID from a browser form, command argument, or copied text as proof.
3. A second authorized reviewer independently verifies the target through a separate authenticated view and approves the exact target ID, operator, environment, and approval reference in the protected change request. The target cannot act as the operator or reviewer.
4. Before execution, produce a read-only preflight showing that no active platform administrator exists, the resolved target ID matches the approved authenticated account, and the operator and reviewer are distinct. Abort on any mismatch or ambiguity.
5. A future implementation must require an expiring, single-use authorization signed by the separately approved operator and reviewer identities. It must validate the signatures against provisioned trusted keys before writing, and reject replay, wrong-environment, expired, or mismatched-target approvals. No such signing keys or validator exist in this Phase B patch, so no production bootstrap can be run through this code.
6. Execute only through a separately reviewed maintenance release after an explicit production change approval. Record the authenticated operator, target ID, approval reference, verification method, environment, timestamp, and result in the append-only `role_audit_events` log. Never store authentication tokens or signing secrets in the log or repository.
7. Read back the role and audit event, then have the independent reviewer verify both against the approval. If any step fails, do not retry with altered identities; stop and investigate.

## Current technical guard

`server/role-maintenance.ts` contains membership preflight and backfill only. It has no platform-role write helper. The test suite inserts a clearly synthetic platform-role fixture directly into an isolated Test-D1 solely to verify role separation and immutable audit behavior. Production D1 is not used. A real bootstrap remains a separate, explicitly reviewed capability that must implement the signed authorization gate above before it can be enabled.
