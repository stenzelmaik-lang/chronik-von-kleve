import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { firstAlphaTarget, firstAlphaInsertStatements, firstAlphaReadQuery, inspectFirstAlphaState } from "../scripts/first-alpha-account-core.mjs";

test("first Alpha provisioning: complete fresh migrations, atomic, idempotent, campaign-only, fail closed", async () => {
  const mf = new Miniflare(convertV4MiniflareOptions({ modules:true, script:"export default {fetch(){return new Response('test')}}", compatibilityDate:"2026-05-15", d1Databases:{DB:"isolated-first-alpha-"+randomUUID()} }));
  try {
    const db = await mf.getD1Database("DB");
    const journal = JSON.parse(readFileSync(new URL("../drizzle/meta/_journal.json",import.meta.url),"utf8"));
    for (const entry of journal.entries) {
      const sql = readFileSync(new URL(`../drizzle/${entry.tag}.sql`,import.meta.url),"utf8").replace(/^\s*--(?!> statement-breakpoint).*$/gm,"");
      // D1 exec requires single-line statements; SQL triggers are preserved as units.
      const parts = entry.idx === 4 ? sql.split(/(?=CREATE (?:TABLE|INDEX|TRIGGER)|ALTER TABLE)/).filter(v=>v.trim() && !/^--/.test(v.trim())) : sql.split("--> statement-breakpoint");
      await db.batch(parts.filter(v=>v.trim()).map(v=>db.prepare(v)));
    }
    const target = firstAlphaTarget("test");
    const now = new Date().toISOString();
    const hash = "pbkdf2_sha256$600000$synthetic-test-salt$"+"A".repeat(43);
    const inspect = async () => inspectFirstAlphaState((await db.prepare(firstAlphaReadQuery()).all()).results,(await db.prepare("SELECT id FROM members WHERE email='stenzel.maik@gmail.com'").all()).results,(await db.prepare("SELECT COUNT(*) AS n FROM campaigns WHERE id='chronik-von-kleve'").first()).n);
    assert.deepEqual(await inspect(),{existing:false});
    const statements = firstAlphaInsertStatements(target,hash,now,randomUUID());
    // A late constraint failure cannot leave partial accounts or membership links.
    await assert.rejects(db.batch([...statements, "INSERT INTO campaign_memberships(campaign_id,user_id,role,status,source,created_at,updated_at) VALUES('bad','bad','platform_admin','active','manual','now','now')"].map(v=>db.prepare(v))));
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM auth_users").first()).n,0);
    await db.batch(statements.map(v=>db.prepare(v)));
    const existing = await inspect(); assert.equal(existing.existing,true);
    assert.deepEqual(await inspect(),existing); // repeat has no write plan
    await assert.rejects(db.batch(statements.map(v=>db.prepare(v)))); // simultaneous duplicate insert conflicts atomically
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM auth_users").first()).n,1);
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM platform_roles").first()).n,0);
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM campaign_memberships").first()).n,1);
    const row = (await db.prepare(firstAlphaReadQuery()).all()).results[0];
    for (const patch of [{status:"blocked"},{campaign_status:"blocked"},{member_status:"pending"},{platform_roles:1},{campaign_count:2},{local_identity_count:0},{email_verified_at:null},{role:"player"}]) {
      assert.throws(()=>inspectFirstAlphaState([{...row,...patch}],[{id:row.member_id}],1));
    }
    assert.throws(()=>inspectFirstAlphaState([],[{id:"legacy-existing"}],1));
    assert.throws(()=>firstAlphaTarget("other"));
    assert.throws(()=>firstAlphaInsertStatements({...target,id:firstAlphaTarget("production").id},hash,now,randomUUID()));
  } finally { await mf.dispose(); }
});
