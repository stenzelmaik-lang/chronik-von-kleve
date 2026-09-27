// Administrative CLI only. No HTTP endpoint, registration change, or platform role.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashPassword } from "../server/password-hash.ts";
import { firstAlphaAccount, firstAlphaTarget, firstAlphaReadQuery, firstAlphaInsertStatements, inspectFirstAlphaState, quote } from "./first-alpha-account-core.mjs";

const root = process.cwd();
const mode = process.argv.find((v) => v.startsWith("--target="))?.slice(9);
const target = firstAlphaTarget(mode);
assert.ok(!process.env.CI && !process.env.WORKERS_CI, "Interactive administrator execution only.");
const state = join(root, ".wrangler");
mkdirSync(state, { recursive: true });
const config = join(state, `first-alpha-${process.pid}.json`);
const sqlFile = join(state, `first-alpha-${process.pid}.sql`);
const statusFile = join(state, `first-alpha-${mode}-result.json`);
const env = { ...process.env, WRANGLER_WRITE_LOGS: "false", WRANGLER_SEND_METRICS: "false", CLOUDFLARE_INCLUDE_PROCESS_ENV: "false", CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false" };
function wrangler(args) {
  const r = spawnSync(process.execPath, [join(root,"node_modules/wrangler/bin/wrangler.js"), ...args], { cwd: root, env, encoding: "utf8", windowsHide: true });
  // Do not echo SQL, credentials, or raw diagnostics from a failed write.
  assert.equal(r.status, 0, "Cloudflare operation failed; no raw credential-bearing output is logged.");
  return r.stdout;
}
function json(output) {
  const start = Math.min(...[output.indexOf("["),output.indexOf("{")].filter((i) => i >= 0));
  return JSON.parse(output.slice(start));
}
function query(sql) {
  return json(wrangler(["d1","execute",target.name,"--config",config,"--remote","--json","--command",sql])).flatMap((v) => v.results);
}
function readState() {
  const rows = query(firstAlphaReadQuery());
  const members = query(`SELECT id FROM members WHERE lower(email)=${quote(firstAlphaAccount.email)}`);
  const campaign = query(`SELECT COUNT(*) AS n FROM campaigns WHERE id=${quote(firstAlphaAccount.campaignId)}`);
  return inspectFirstAlphaState(rows, members, campaign[0].n);
}
function masked(prompt) {
  assert.ok(process.stdin.isTTY && process.stdout.isTTY, "A visible local terminal is required.");
  return new Promise((resolve, reject) => {
    let value = "";
    function finish(error) { process.stdin.off("data", onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write("\n"); if (error) reject(error); else resolve(value); }
    function onData(buffer) {
      for (const c of buffer.toString("utf8")) {
        if (c === "\u0003") { finish(new Error("Canceled.")); return; }
        if (c === "\r" || c === "\n") { finish(); return; }
        if (c === "\b" || c === "\u007f") { if (value.length) { value=value.slice(0,-1); process.stdout.write("\b \b"); } }
        else if (c >= " " && value.length < 201) { value+=c; process.stdout.write("*"); }
      }
    }
    process.stdout.write(prompt); process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.on("data",onData);
  });
}
try {
  writeFileSync(config, JSON.stringify({ name: "chronik-von-kleve", account_id: firstAlphaAccount.accountId, compatibility_date:"2026-05-15", d1_databases:[{binding:"DB",database_name:target.name,database_id:target.id}] }), {flag:"wx"});
  const identity = wrangler(["whoami"]).toLowerCase();
  assert.ok(identity.includes(`associated with the email ${firstAlphaAccount.email}`) && identity.includes(firstAlphaAccount.accountId), "Independent Cloudflare OAuth identity is not the approved account owner.");
  const database = json(wrangler(["d1","info",target.name,"--config",config,"--json"]));
  assert.equal(database.uuid,target.id); assert.equal(database.name,target.name);
  console.log(`Confirmed ${mode.toUpperCase()} D1: ${target.name} (${target.id}).`);
  let result = readState();
  if (!result.existing) {
    console.log(`Only ${firstAlphaAccount.email}; campaign_gm only for ${firstAlphaAccount.campaignId}. No platform_admin.`);
    let password = await masked("Privates Alpha-Passwort (12-200 Zeichen): ");
    let repeat = await masked("Passwort wiederholen: ");
    assert.ok(password.length >= 12 && password.length <= 200 && password === repeat,"Password length or confirmation invalid.");
    const hash = await hashPassword(password); password=""; repeat="";
    // Unique keys protect simultaneous runs. D1's file import rolls back the entire import on failure.
    writeFileSync(sqlFile, firstAlphaInsertStatements(target,hash,new Date().toISOString(),randomUUID()).join(";\n")+";\n", {flag:"wx",mode:0o600});
    try { wrangler(["d1","execute",target.name,"--config",config,"--remote","--json","--yes","--file",sqlFile]); }
    finally { unlinkSync(sqlFile); }
    result = readState(); assert.ok(result.existing);
    console.log("Konto sicher angelegt und Rechte zurueckgelesen.");
  } else console.log("Vorhandenes Konto vollstaendig geprueft; keine Aenderung, kein Passwort-Reset, kein Duplikat.");
  writeFileSync(statusFile, JSON.stringify({ status:"succeeded", target:target.name, databaseId:target.id, ...result, email:firstAlphaAccount.email, campaign:firstAlphaAccount.campaignId, role:"campaign_gm", platformAdmin:false, checkedAt:new Date().toISOString() },null,2));
} catch (error) {
  writeFileSync(statusFile, JSON.stringify({status:"failed",target:target.name,checkedAt:new Date().toISOString()}));
  console.error(`Account setup stopped: ${error.message}`); process.exitCode=1;
} finally {
  for (const file of [config,sqlFile]) { try { unlinkSync(file); } catch {} }
}
