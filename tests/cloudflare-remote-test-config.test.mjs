import assert from "node:assert/strict";
import test from "node:test";
import {
  cloudflareTestResourceIdentity,
  REMOTE_TEST_MODE_ENV,
  REQUIRED_TEST_D1_TABLES,
  assertCloudflareRemoteTestEnvironment,
  assertPhaseCCandidateMigrationSource,
  resolveCloudflareRemoteTestConfig,
} from "../scripts/cloudflare-remote-test-config.mjs";

test("remote test mode is off unless explicitly opted in", () => {
  assert.equal(resolveCloudflareRemoteTestConfig({}), undefined);
});

test("remote test mode returns only the fixed isolated D1 and R2 targets", () => {
  const config = resolveCloudflareRemoteTestConfig({ [REMOTE_TEST_MODE_ENV]: "1" });

  assert.equal(config.account_id, "688c841e3110458e2e64b001c3291920");
  assert.deepEqual(config.d1_databases, [
    {
      binding: "DB",
      database_name: "chronik-von-kleve-phase-c-db",
      database_id: "93863382-2046-4efc-a5b7-7eb1306955f9",
      remote: true,
    },
  ]);
  assert.deepEqual(config.r2_buckets, [
    {
      binding: "BUCKET",
      bucket_name: "chronik-von-kleve-phase-c-r2",
      remote: true,
    },
  ]);

  assert.notEqual(config.d1_databases[0].database_id, "a4bc79e6-3f33-4b03-b240-9c341bd1d4d7");
  assert.notEqual(config.d1_databases[0].database_name, "chronik-von-kleve-db");
  assert.notEqual(config.r2_buckets[0].bucket_name, "chronik-von-kleve-r2");
  assert.equal(cloudflareTestResourceIdentity.d1Id, config.d1_databases[0].database_id);
});

test("remote test mode rejects production binding values and cannot be retargeted", () => {
  assert.throws(
    () => resolveCloudflareRemoteTestConfig({ [REMOTE_TEST_MODE_ENV]: "1", PHASE_C_D1_DATABASE_NAME: "chronik-von-kleve-db" }),
    /Production D1\/R2 values were supplied/,
  );
  assert.throws(
    () => resolveCloudflareRemoteTestConfig({ [REMOTE_TEST_MODE_ENV]: "1", PHASE_C_D1_DATABASE_ID: "a4bc79e6-3f33-4b03-b240-9c341bd1d4d7" }),
    /Production D1\/R2 values were supplied/,
  );
  assert.throws(
    () => resolveCloudflareRemoteTestConfig({ [REMOTE_TEST_MODE_ENV]: "1", PHASE_C_R2_BUCKET_NAME: "chronik-von-kleve-r2" }),
    /Production D1\/R2 values were supplied/,
  );

  const config = resolveCloudflareRemoteTestConfig({
    [REMOTE_TEST_MODE_ENV]: "1",
    PHASE_C_D1_DATABASE_NAME: "chronik-von-kleve-phase-c-db",
    PHASE_C_D1_DATABASE_ID: "93863382-2046-4efc-a5b7-7eb1306955f9",
    PHASE_C_R2_BUCKET_NAME: "chronik-von-kleve-phase-c-r2",
  });
  assert.equal(config.d1_databases[0].database_id, "93863382-2046-4efc-a5b7-7eb1306955f9");
  assert.equal(config.r2_buckets[0].bucket_name, "chronik-von-kleve-phase-c-r2");
});

test("remote test mode rejects malformed opt-in and Cloudflare build contexts", () => {
  assert.throws(
    () => resolveCloudflareRemoteTestConfig({ [REMOTE_TEST_MODE_ENV]: "true" }),
    /must be exactly/,
  );
  assert.throws(
    () => resolveCloudflareRemoteTestConfig({ [REMOTE_TEST_MODE_ENV]: "1", WORKERS_CI: "1" }),
    /local-only/,
  );
  assert.throws(
    () => resolveCloudflareRemoteTestConfig({ [REMOTE_TEST_MODE_ENV]: "1", WORKERS_CI_BRANCH: "main" }),
    /local-only/,
  );
  assert.throws(
    () => resolveCloudflareRemoteTestConfig({ [REMOTE_TEST_MODE_ENV]: "1", CI: "true" }),
    /local-only/,
  );
  assert.throws(
    () => resolveCloudflareRemoteTestConfig({ [REMOTE_TEST_MODE_ENV]: "1", NODE_ENV: "production" }),
    /local-only/,
  );
});

test("remote test runner refuses local env/secret files and process-env injection", () => {
  assert.throws(
    () => assertCloudflareRemoteTestEnvironment({}, [".dev.vars"]),
    /Local secret\/environment files are present/,
  );
  assert.throws(
    () => assertCloudflareRemoteTestEnvironment({}, [".env.production.local"]),
    /Local secret\/environment files are present/,
  );
  assert.throws(
    () => assertCloudflareRemoteTestEnvironment({ CLOUDFLARE_INCLUDE_PROCESS_ENV: "true" }, []),
    /CLOUDFLARE_INCLUDE_PROCESS_ENV=true/,
  );
  assert.doesNotThrow(() =>
    assertCloudflareRemoteTestEnvironment(
      { PATH: "C:\\Windows\\System32", CLOUDFLARE_API_TOKEN: "redacted", [REMOTE_TEST_MODE_ENV]: "1" },
      [],
    ),
  );
});

test("remote test runner requires integrated and applied migration 0006 before app start", () => {
  const baselineEntries = Array.from({ length: 6 }, (_, idx) => ({ idx, tag: `000${idx}_migration` }));
  assert.throws(
    () => assertPhaseCCandidateMigrationSource(baselineEntries, () => true),
    /release-candidate migration 0006 is not integrated/,
  );

  const completeEntries = [...baselineEntries, { idx: 6, tag: "0006_auth_identity" }];
  assert.throws(
    () => assertPhaseCCandidateMigrationSource(completeEntries, () => false),
    /source file .* is missing/,
  );
  assert.equal(
    assertPhaseCCandidateMigrationSource(completeEntries, (tag) => tag === "0006_auth_identity"),
    "0006_auth_identity",
  );
});

test("remote test schema requires all five Auth 2.0 tables", () => {
  assert.deepEqual(
    REQUIRED_TEST_D1_TABLES.filter((name) => name.startsWith("auth_")),
    ["auth_users", "auth_identities", "auth_sessions", "auth_member_links", "auth_rate_limits"],
  );
});
