import assert from "node:assert/strict";
import test from "node:test";

import { resolveCloudflarePreviewBindings } from "../scripts/cloudflare-preview-config.mjs";

const isolatedEnv = {
  WORKERS_CI: "1",
  WORKERS_CI_BRANCH: "codex/pre-alpha-v0.1.037-phase-c",
  PHASE_C_WORKER: "chronik-von-kleve",
  PHASE_C_D1_DATABASE_ID: "93863382-2046-4efc-a5b7-7eb1306955f9",
  PHASE_C_D1_DATABASE_NAME: "chronik-von-kleve-phase-c-db",
  PHASE_C_R2_BUCKET_NAME: "chronik-von-kleve-phase-c-r2",
};

test("local builds do not create Workers Preview bindings", () => {
  assert.equal(resolveCloudflarePreviewBindings({ WORKERS_CI: "0" }), undefined);
});

test("main can build before preview resources are provisioned", () => {
  assert.deepEqual(
    resolveCloudflarePreviewBindings({ WORKERS_CI: "1", WORKERS_CI_BRANCH: "main" }),
    {},
  );
});

test("non-main Workers Builds fail closed without isolated D1 and R2", () => {
  assert.throws(
    () => resolveCloudflarePreviewBindings({
      WORKERS_CI: "1",
      WORKERS_CI_BRANCH: "codex/example",
      PHASE_C_WORKER: "chronik-von-kleve",
    }),
    /Refusing a non-main Workers Build without isolated Preview D1\/R2 resources/,
  );
});

test("non-main Preview builds require the intended Worker target", () => {
  const withoutWorker = { ...isolatedEnv };
  delete withoutWorker.PHASE_C_WORKER;
  assert.throws(
    () => resolveCloudflarePreviewBindings(withoutWorker),
    /Refusing a Preview build unless PHASE_C_WORKER is chronik-von-kleve/,
  );
  assert.throws(
    () => resolveCloudflarePreviewBindings({ ...isolatedEnv, PHASE_C_WORKER: "other-worker" }),
    /Refusing a Preview build unless PHASE_C_WORKER is chronik-von-kleve/,
  );
});

test("Preview bindings point only to explicitly configured isolated resources", () => {
  assert.deepEqual(resolveCloudflarePreviewBindings(isolatedEnv), {
    d1_databases: [
      {
        binding: "DB",
        database_name: "chronik-von-kleve-phase-c-db",
        database_id: "93863382-2046-4efc-a5b7-7eb1306955f9",
      },
    ],
    r2_buckets: [
      {
        binding: "BUCKET",
        bucket_name: "chronik-von-kleve-phase-c-r2",
      },
    ],
  });
});

test("partial Preview resource configuration is rejected", () => {
  assert.throws(
    () => resolveCloudflarePreviewBindings({
      ...isolatedEnv,
      PHASE_C_R2_BUCKET_NAME: "",
    }),
    /Incomplete Preview resource configuration/,
  );
});

test("production D1 ID or resource names cannot be reused for Preview", () => {
  assert.throws(
    () => resolveCloudflarePreviewBindings({
      ...isolatedEnv,
      PHASE_C_D1_DATABASE_ID: "a4bc79e6-3f33-4b03-b240-9c341bd1d4d7",
    }),
    /must not match the production resources/,
  );
  assert.throws(
    () => resolveCloudflarePreviewBindings({
      ...isolatedEnv,
      PHASE_C_R2_BUCKET_NAME: "chronik-von-kleve-r2",
    }),
    /must not match the production resources/,
  );
});
