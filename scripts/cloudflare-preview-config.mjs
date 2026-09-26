const PRODUCTION_D1_DATABASE_ID = "a4bc79e6-3f33-4b03-b240-9c341bd1d4d7";
const PRODUCTION_D1_DATABASE_NAME = "chronik-von-kleve-db";
const PRODUCTION_R2_BUCKET_NAME = "chronik-von-kleve-r2";

const PREVIEW_D1_ID = "PHASE_C_D1_DATABASE_ID";
const PREVIEW_D1_NAME = "PHASE_C_D1_DATABASE_NAME";
const PREVIEW_R2_NAME = "PHASE_C_R2_BUCKET_NAME";
const PREVIEW_WORKER = "PHASE_C_WORKER";
const EXPECTED_WORKER_NAME = "chronik-von-kleve";

function normalized(value) {
  return value?.trim().toLowerCase();
}

/**
 * Build the Wrangler Previews block for Cloudflare Workers Builds.
 *
 * `main` may build without Preview resources so production remains deployable;
 * every non-main Workers Build (including PR branches) fails closed unless it
 * has explicit, separate D1 and R2 targets.
 */
export function resolveCloudflarePreviewBindings(env = process.env) {
  if (env.WORKERS_CI !== "1") return undefined;

  const branch = env.WORKERS_CI_BRANCH?.trim();
  if (!branch) {
    throw new Error(
      "Workers Builds must provide WORKERS_CI_BRANCH before selecting resource bindings.",
    );
  }

  if (branch !== "main" && normalized(env[PREVIEW_WORKER]) !== EXPECTED_WORKER_NAME) {
    throw new Error(
      `Refusing a Preview build unless ${PREVIEW_WORKER} is ${EXPECTED_WORKER_NAME}.`,
    );
  }

  const supplied = [env[PREVIEW_D1_ID], env[PREVIEW_D1_NAME], env[PREVIEW_R2_NAME]];
  const hasAny = supplied.some((value) => Boolean(value?.trim()));
  const hasAll = supplied.every((value) => Boolean(value?.trim()));

  if (!hasAll) {
    if (hasAny) {
      throw new Error(
        `Incomplete Preview resource configuration. Set ${PREVIEW_D1_ID}, ${PREVIEW_D1_NAME}, and ${PREVIEW_R2_NAME} together.`,
      );
    }
    if (branch !== "main") {
      throw new Error(
        `Refusing a non-main Workers Build without isolated Preview D1/R2 resources. Configure ${PREVIEW_D1_ID}, ${PREVIEW_D1_NAME}, and ${PREVIEW_R2_NAME}.`,
      );
    }
    return {};
  }

  const databaseId = env[PREVIEW_D1_ID].trim();
  const databaseName = env[PREVIEW_D1_NAME].trim();
  const bucketName = env[PREVIEW_R2_NAME].trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(databaseId)) {
    throw new Error(`${PREVIEW_D1_ID} must be a valid D1 database UUID.`);
  }
  if (
    normalized(databaseId) === normalized(PRODUCTION_D1_DATABASE_ID) ||
    normalized(databaseName) === normalized(PRODUCTION_D1_DATABASE_NAME) ||
    normalized(bucketName) === normalized(PRODUCTION_R2_BUCKET_NAME)
  ) {
    throw new Error("Preview D1/R2 resources must not match the production resources.");
  }

  return {
    d1_databases: [
      {
        binding: "DB",
        database_name: databaseName,
        database_id: databaseId,
      },
    ],
    r2_buckets: [
      {
        binding: "BUCKET",
        bucket_name: bucketName,
      },
    ],
  };
}
