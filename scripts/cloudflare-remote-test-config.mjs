const ACCOUNT_ID = "688c841e3110458e2e64b001c3291920";
const WORKER_NAME = "chronik-von-kleve";

const TEST_D1_NAME = "chronik-von-kleve-phase-c-db";
const TEST_D1_ID = "93863382-2046-4efc-a5b7-7eb1306955f9";
const TEST_R2_NAME = "chronik-von-kleve-phase-c-r2";

const PRODUCTION_D1_NAME = "chronik-von-kleve-db";
const PRODUCTION_D1_ID = "a4bc79e6-3f33-4b03-b240-9c341bd1d4d7";
const PRODUCTION_R2_NAME = "chronik-von-kleve-r2";

export const REMOTE_TEST_MODE_ENV = "CVK_ENABLE_REMOTE_TEST_BINDINGS";

const LOCAL_ENV_FILE = /^(?:\.dev\.vars(?:\..*)?|\.env(?:\..*)?)$/i;

export const REQUIRED_TEST_D1_TABLES = Object.freeze([
  "members",
  "files",
  "records",
  "settings",
  "campaigns",
  "entities",
  "knowledge",
  "relationships",
  "world_events",
  "recovery_conflicts",
  "recovery_records",
  "recovery_sources",
  "location_actions",
  "location_nodes",
  "platform_roles",
  "campaign_memberships",
  "entity_revision_events",
  "entity_revision_media",
  "entity_revision_releases",
  "entity_revisions",
  "auth_users",
  "auth_identities",
  "auth_sessions",
  "auth_member_links",
  "auth_rate_limits",
]);

function normalized(value) {
  return value?.trim().toLowerCase();
}

/**
 * Return the only permitted remote test targets for local development.
 * The opt-in is intentionally explicit and cannot run in Workers Builds or CI.
 */
export function resolveCloudflareRemoteTestConfig(env = process.env) {
  if (!Object.hasOwn(env, REMOTE_TEST_MODE_ENV)) return undefined;
  if (env[REMOTE_TEST_MODE_ENV] !== "1") {
    throw new Error(`${REMOTE_TEST_MODE_ENV} must be exactly "1" when present.`);
  }

  if (env.WORKERS_CI || env.WORKERS_CI_BRANCH || env.CI === "true" || env.NODE_ENV === "production") {
    throw new Error("Remote test bindings are local-only and cannot run in CI or production mode.");
  }

  if (
    normalized(TEST_D1_NAME) === normalized(PRODUCTION_D1_NAME) ||
    normalized(TEST_D1_ID) === normalized(PRODUCTION_D1_ID) ||
    normalized(TEST_R2_NAME) === normalized(PRODUCTION_R2_NAME)
  ) {
    throw new Error("Refusing remote test bindings that match a production D1/R2 resource.");
  }

  if (
    normalized(env.PHASE_C_D1_DATABASE_NAME) === normalized(PRODUCTION_D1_NAME) ||
    normalized(env.PHASE_C_D1_DATABASE_ID) === normalized(PRODUCTION_D1_ID) ||
    normalized(env.PHASE_C_R2_BUCKET_NAME) === normalized(PRODUCTION_R2_NAME)
  ) {
    throw new Error("Production D1/R2 values were supplied; refusing remote test mode.");
  }

  return {
    name: `${WORKER_NAME}-phase-c-local-test`,
    account_id: ACCOUNT_ID,
    d1_databases: [
      {
        binding: "DB",
        database_name: TEST_D1_NAME,
        database_id: TEST_D1_ID,
        remote: true,
      },
    ],
    r2_buckets: [
      {
        binding: "BUCKET",
        bucket_name: TEST_R2_NAME,
        remote: true,
      },
    ],
  };
}

/** Refuse any local Worker secret source that has not been explicitly isolated for tests. */
export function assertCloudflareRemoteTestEnvironment(env = process.env, rootFiles = []) {
  if (env.CLOUDFLARE_INCLUDE_PROCESS_ENV === "true") {
    throw new Error("CLOUDFLARE_INCLUDE_PROCESS_ENV=true is not allowed for remote test runs.");
  }

  const secretFiles = rootFiles.filter((fileName) => LOCAL_ENV_FILE.test(fileName));
  if (secretFiles.length) {
    throw new Error(
      `Local secret/environment files are present (${secretFiles.join(", ")}). ` +
        "Remove them from this test checkout or prepare a separately reviewed test-only secret setup before running the app.",
    );
  }

}

/** Require the integrated migration chain through 0006 without running it. */
export function assertPhaseCCandidateMigrationSource(entries, hasMigrationFile) {
  for (let idx = 0; idx <= 6; idx += 1) {
    const entry = entries.find((candidate) => candidate.idx === idx);
    if (!entry) {
      if (idx === 6) {
        throw new Error("The complete release-candidate migration 0006 is not integrated in the Drizzle journal.");
      }
      throw new Error(`Migration chain is incomplete: journal entry ${String(idx).padStart(4, "0")} is missing.`);
    }
    if (idx < 6 && !String(entry.tag).startsWith(`${String(idx).padStart(4, "0")}_`)) {
      throw new Error(`Migration chain entry ${idx} has an unexpected tag.`);
    }
    if (idx === 6 && !/^0006_[a-z0-9_-]+$/i.test(String(entry.tag))) {
      throw new Error("The complete release-candidate migration 0006 is not integrated in the Drizzle journal.");
    }
  }

  const migration0006 = entries.find((candidate) => candidate.idx === 6).tag;
  if (!hasMigrationFile(migration0006)) {
    throw new Error(`Migration source file for ${migration0006} is missing; no migration was run.`);
  }
  return migration0006;
}

export const cloudflareTestResourceIdentity = Object.freeze({
  accountId: ACCOUNT_ID,
  workerName: WORKER_NAME,
  d1Name: TEST_D1_NAME,
  d1Id: TEST_D1_ID,
  r2Name: TEST_R2_NAME,
});
