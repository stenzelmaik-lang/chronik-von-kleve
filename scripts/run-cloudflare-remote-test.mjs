import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { createInterface } from "node:readline";
import { createServer } from "node:net";
import { join } from "node:path";
import { once } from "node:events";
import {
  cloudflareTestResourceIdentity,
  REMOTE_TEST_MODE_ENV,
  REQUIRED_TEST_D1_TABLES,
  assertCloudflareRemoteTestEnvironment,
  assertPhaseCCandidateMigrationSource,
  resolveCloudflareRemoteTestConfig,
} from "./cloudflare-remote-test-config.mjs";

const root = process.cwd();
const expected = cloudflareTestResourceIdentity;
const phrase = `USE TEST RESOURCES ${expected.d1Name} / ${expected.r2Name}`;
function fail(message) {
  console.error(`REMOTE TEST STOPPED: ${message}`);
  process.exit(1);
}

if (!existsSync(join(root, "vite.config.ts")) || !existsSync(join(root, "package.json"))) {
  fail("Start this script from the ChroniPlay repository root.");
}

if (process.env.WORKERS_CI || process.env.WORKERS_CI_BRANCH || process.env.CI === "true") {
  fail("This runner is local-only; Workers Builds and CI are refused.");
}

if (process.env[REMOTE_TEST_MODE_ENV] && process.env[REMOTE_TEST_MODE_ENV] !== "1") {
  fail(`${REMOTE_TEST_MODE_ENV} is already set to a value other than 1.`);
}

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (packageJson.name !== "site-creator-vinext-starter") {
  fail("Unexpected repository package; refusing to use test bindings.");
}

const nodeExe = process.execPath;
const wranglerCli = join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const viteCli = join(root, "node_modules", "vite", "bin", "vite.js");
if (!existsSync(wranglerCli) || !existsSync(viteCli)) {
  fail("Project-local Wrangler and Vite dependencies must be installed first.");
}

let bindingConfig;
try {
  bindingConfig = resolveCloudflareRemoteTestConfig({ [REMOTE_TEST_MODE_ENV]: "1" });
  assert.equal(bindingConfig.account_id, expected.accountId);
  assert.equal(bindingConfig.d1_databases[0].binding, "DB");
  assert.equal(bindingConfig.d1_databases[0].database_name, expected.d1Name);
  assert.equal(bindingConfig.d1_databases[0].database_id, expected.d1Id);
  assert.equal(bindingConfig.d1_databases[0].remote, true);
  assert.equal(bindingConfig.r2_buckets[0].binding, "BUCKET");
  assert.equal(bindingConfig.r2_buckets[0].bucket_name, expected.r2Name);
  assert.equal(bindingConfig.r2_buckets[0].remote, true);
} catch (error) {
  fail(`The fixed test binding configuration did not validate: ${error.message}`);
}

const configPath = join(root, ".wrangler", `cvk-phase-c-remote-preflight-${process.pid}.jsonc`);
mkdirSync(join(root, ".wrangler"), { recursive: true });
const configFile = {
  name: bindingConfig.name,
  account_id: bindingConfig.account_id,
  compatibility_date: "2026-05-15",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: bindingConfig.d1_databases,
  r2_buckets: bindingConfig.r2_buckets,
};
writeFileSync(configPath, `${JSON.stringify(configFile, null, 2)}\n`, { flag: "wx" });

const commandEnv = {
  ...process.env,
  WRANGLER_SEND_METRICS: "false",
  WRANGLER_WRITE_LOGS: "false",
  [REMOTE_TEST_MODE_ENV]: "1",
  CLOUDFLARE_INCLUDE_PROCESS_ENV: "false",
  CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
};

const viteEnv = Object.fromEntries(
  Object.entries(process.env).filter(([name]) =>
    [
      "PATH",
      "PATHEXT",
      "SYSTEMROOT",
      "WINDIR",
      "COMSPEC",
      "TEMP",
      "TMP",
      "USERPROFILE",
      "HOME",
      "APPDATA",
      "LOCALAPPDATA",
      "XDG_CONFIG_HOME",
      "PROGRAMDATA",
      "CODEX_SANDBOX",
    ].includes(name.toUpperCase()),
  ),
);
Object.assign(viteEnv, {
  NODE_ENV: "development",
  WRANGLER_SEND_METRICS: "false",
  WRANGLER_WRITE_LOGS: "false",
  [REMOTE_TEST_MODE_ENV]: "1",
  CLOUDFLARE_INCLUDE_PROCESS_ENV: "false",
  CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
});

function scrubAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function runWrangler(args, label) {
  const result = spawnSync(nodeExe, [wranglerCli, ...args], {
    cwd: root,
    env: commandEnv,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    const detail = scrubAnsi(`${result.stderr ?? ""}\n${result.stdout ?? ""}`).trim().slice(0, 900);
    throw new Error(
      `${label} failed. No migrations or application server were started. ` +
        `Confirm Wrangler account authentication, then retry. ${detail}`,
    );
  }
  return scrubAnsi(result.stdout ?? "");
}

function parseJson(text, label) {
  const start = Math.min(...[text.indexOf("{"), text.indexOf("[")].filter((i) => i >= 0));
  if (!Number.isFinite(start)) throw new Error(`${label} did not return JSON.`);
  try {
    return JSON.parse(text.slice(start));
  } catch {
    throw new Error(`${label} returned unreadable JSON.`);
  }
}

function objectsDeep(value) {
  if (Array.isArray(value)) return value.flatMap(objectsDeep);
  if (!value || typeof value !== "object") return [];
  return [value, ...Object.values(value).flatMap(objectsDeep)];
}

function preflightResourceIdentity() {
  const d1Output = runWrangler(
    ["d1", "info", expected.d1Name, "--json", "--config", configPath],
    "Test-D1 identity check",
  );
  const d1Json = parseJson(d1Output, "Test-D1 identity check");
  const d1Rows = objectsDeep(d1Json);
  const d1Matches = d1Rows.some((row) => {
    const name = row.name ?? row.database_name;
    const id = row.uuid ?? row.database_id ?? row.databaseId;
    return name === expected.d1Name && id === expected.d1Id;
  });
  if (!d1Matches) throw new Error("Cloudflare did not verify the exact expected Test-D1 name and ID.");

  if (process.env.CVK_REMOTE_TEST_R2_PREVERIFIED !== "1") {
    throw new Error("Verify the exact isolated Test-R2 bucket through Cloudflare before running; then set CVK_REMOTE_TEST_R2_PREVERIFIED=1.");
  }

  console.log(`Verified account: ${expected.accountId}`);
  console.log(`Verified remote Test-D1: ${expected.d1Name} (${expected.d1Id})`);
  console.log(`Externally verified remote Test-R2: ${expected.r2Name}`);
  console.log("No production resource is present in this runner's generated Wrangler config.");
}

function verifyTestSchema() {
  const sql = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name";
  const output = runWrangler(
    [
      "d1",
      "execute",
      expected.d1Name,
      "--remote",
      "--json",
      "--command",
      sql,
      "--config",
      configPath,
    ],
    "Read-only Test-D1 schema check",
  );
  const query = parseJson(output, "Read-only Test-D1 schema check");
  const names = new Set(
    objectsDeep(query)
      .filter((row) => typeof row.name === "string")
      .map((row) => row.name),
  );
  const missing = REQUIRED_TEST_D1_TABLES.filter((name) => !names.has(name));
  if (missing.length) {
    throw new Error(
      `Test-D1 is not ready (missing ${missing.join(", ")}). ` +
        "No migration has been run. Wait for the integrated migration 0006 release candidate and its separate approval.",
    );
  }

  if (!names.has("d1_migrations")) {
    throw new Error("Test-D1 has no Wrangler migration ledger; no migration was run.");
  }
  const migrationOutput = runWrangler(
    [
      "d1",
      "execute",
      expected.d1Name,
      "--remote",
      "--json",
      "--command",
      "SELECT name FROM d1_migrations ORDER BY name",
      "--config",
      configPath,
    ],
    "Read-only Test-D1 migration ledger check",
  );
  const migrationRows = objectsDeep(parseJson(migrationOutput, "Read-only Test-D1 migration ledger check"));
  if (!migrationRows.some((row) => row.name === `${migration0006Tag}.sql`)) {
    throw new Error(`Test-D1 has not recorded ${migration0006Tag}; no migration was run.`);
  }
  console.log(`Verified Test-D1 schema and migration ${migration0006Tag} (${REQUIRED_TEST_D1_TABLES.length} required tables found).`);
}

let migration0006Tag;

async function askForWriteConfirmation() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("A real interactive PowerShell terminal is required for the remote-write confirmation.");
  }
  console.log("\nThe local app can write data to these Cloudflare TEST resources.");
  console.log("No production database or bucket is configured in this runner.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise((resolveAnswer) => rl.question(`Type exactly: ${phrase}\n> `, resolveAnswer));
    if (answer !== phrase) throw new Error("Confirmation did not match; no server was started.");
  } finally {
    rl.close();
  }
}

async function assertPortFree(port) {
  await new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.once("error", () => {
      rejectPort(new Error(`Local port ${port} is already in use; no process was stopped.`));
    });
    server.listen(port, "127.0.0.1", () => server.close((error) => (error ? rejectPort(error) : resolvePort())));
  });
}

async function serveLocally() {
  const port = 5181;
  await assertPortFree(port);
  console.log(`Starting local Vite app on http://127.0.0.1:${port} (strict port; no other process will be stopped).`);
  const child = spawn(nodeExe, [viteCli, "dev", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: root,
    env: viteEnv,
    stdio: "inherit",
    windowsHide: true,
  });

  const stopChild = (signal) => {
    if (!child.killed) child.kill(signal);
  };
  const onInterrupt = () => stopChild("SIGINT");
  const onTerminate = () => stopChild("SIGTERM");
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onTerminate);
  try {
    const [code, signal] = await once(child, "exit");
    if (signal) console.log(`Local test server stopped (${signal}).`);
    else if (code !== 0) process.exitCode = code ?? 1;
  } finally {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onTerminate);
  }
}

try {
  preflightResourceIdentity();
  if (process.argv.includes("--verify-targets-only")) {
    console.log("Read-only target verification complete; no migration, app server, or application write was run.");
  } else {
    const journal = JSON.parse(readFileSync(join(root, "drizzle", "meta", "_journal.json"), "utf8"));
    migration0006Tag = assertPhaseCCandidateMigrationSource(journal.entries, (tag) =>
      existsSync(join(root, "drizzle", `${tag}.sql`)),
    );
    assertCloudflareRemoteTestEnvironment(process.env, readdirSync(root));
    verifyTestSchema();
    await askForWriteConfirmation();
    await serveLocally();
  }
} catch (error) {
  fail(error.message);
} finally {
  try {
    unlinkSync(configPath);
  } catch {
    // Ignore cleanup if Wrangler or an external interruption already removed it.
  }
}
