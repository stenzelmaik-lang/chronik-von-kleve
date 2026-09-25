import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {existsSync,readdirSync,rmSync} from 'node:fs';
import {basename,dirname,join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {backfillMemberships,bootstrapFirstPlatformAdmin,planMembershipBackfill} from '../server/role-maintenance.ts';
import {resolveRoles} from '../server/role-resolver.ts';

const state=process.env.CVK_TEST_STATE||'';
const stateRoot=resolve(state);
assert.equal(dirname(stateRoot),tmpdir(),'role maintenance requires an isolated Wrangler Test-D1 state');
assert.match(basename(stateRoot),/^cvk-phase-b-tests-[a-f0-9-]+$/,'role maintenance requires an isolated Wrangler Test-D1 state');
function findSqlite(directory){
  const found=[];
  for(const entry of readdirSync(directory,{withFileTypes:true})){
    const path=join(directory,entry.name);
    if(entry.isDirectory())found.push(...findSqlite(path));
    else if(entry.name.endsWith('.sqlite'))found.push(path);
  }
  return found;
}
const candidates=findSqlite(stateRoot).filter(path=>basename(path)!=='metadata.sqlite'&&!path.endsWith('0004-rollback-probe.sqlite'));
assert.equal(candidates.length,1,'expected exactly one Wrangler local D1 database');
const connection=new DatabaseSync(candidates[0]);
connection.exec('PRAGMA foreign_keys=ON');
let checks=0;
function check(condition,label){assert.ok(condition,label);checks++;console.log('PASS '+label)}
function rows(table){return connection.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()}
function count(table){return connection.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n}
class LocalD1Statement{
  constructor(sql,values=[]){this.sql=sql;this.values=values}
  bind(...values){return new LocalD1Statement(this.sql,values)}
  async first(column){const row=connection.prepare(this.sql).get(...this.values)||null;return column?row?.[column]??null:row}
  async all(){return{results:connection.prepare(this.sql).all(...this.values),success:true,meta:{changes:0}}}
  async run(){const result=connection.prepare(this.sql).run(...this.values);return{success:true,meta:{changes:Number(result.changes),last_row_id:result.lastInsertRowid}}}
}
const db={
  prepare(sql){return new LocalD1Statement(sql)},
  async batch(statements){
    connection.exec('BEGIN IMMEDIATE');
    try{
      const results=[];
      for(const statement of statements){
        const result=connection.prepare(statement.sql).run(...statement.values);
        results.push({success:true,meta:{changes:Number(result.changes),last_row_id:result.lastInsertRowid}});
      }
      connection.exec('COMMIT');
      return results;
    }catch(error){connection.exec('ROLLBACK');throw error;}
  },
};

check(count('platform_roles')===0,'no platform administrator is pre-provisioned in Test-D1');
const otherCampaign='phase-b-campaign-'+randomUUID();
connection.prepare('INSERT INTO campaigns(id,name,created_at) VALUES(?,?,?)').run(otherCampaign,'Isolated Phase B Test Campaign','test-only');
const insertMember=connection.prepare('INSERT INTO members(id,email,name,status,campaign_id,created_at) VALUES(?,?,?,?,?,?)');
insertMember.run('phase-b-backfill-gm-'+randomUUID(),'gm@sprint.invalid','Synthetic GM','active','chronik-von-kleve','test-gm');
insertMember.run('phase-b-backfill-blocked-gm-'+randomUUID(),'gm@sprint.invalid','Synthetic blocked GM','blocked','chronik-von-kleve','test-blocked');
insertMember.run('phase-b-backfill-pending-gm-'+randomUUID(),'gm@sprint.invalid','Synthetic pending GM','pending','chronik-von-kleve','test-pending');
insertMember.run('phase-b-other-campaign-'+randomUUID(),'other@sprint.invalid','Synthetic other-campaign player','active',otherCampaign,'test-other');

const conflictId='phase-b-conflict-'+randomUUID();
insertMember.run(conflictId,'conflict@sprint.invalid','Synthetic conflict','active','chronik-von-kleve','test-conflict');
connection.prepare(`INSERT INTO campaign_memberships(campaign_id,user_id,role,status,source,version,created_at,updated_at)
 VALUES('chronik-von-kleve',?,'campaign_editor','active','manual',1,'test','test')`).run(conflictId);
const countBeforeConflict=count('campaign_memberships');
const conflictedPlan=await planMembershipBackfill(db,'gm@sprint.invalid','chronik-von-kleve');
check(conflictedPlan.conflicts.some(item=>item.userId===conflictId),'backfill preflight exposes role/status conflicts');
await assert.rejects(()=>backfillMemberships(db,'gm@sprint.invalid','chronik-von-kleve','test-now'),/Membership backfill stopped/);
check(count('campaign_memberships')===countBeforeConflict,'a backfill conflict stops every write');
connection.prepare('DELETE FROM campaign_memberships WHERE user_id=?').run(conflictId);
connection.prepare('DELETE FROM members WHERE id=?').run(conflictId);

const first=await backfillMemberships(db,'gm@sprint.invalid','chronik-von-kleve','test-backfill-time');
check(first.inserted>0&&first.planned===first.inserted+first.unchanged,'backfill deterministically imports every legacy membership');
const second=await backfillMemberships(db,'gm@sprint.invalid','chronik-von-kleve','test-rerun-time');
check(second.inserted===0&&second.unchanged===first.planned,'backfill is idempotent on rerun');
const gmRows=connection.prepare(`SELECT cm.role,cm.status FROM campaign_memberships cm JOIN members m ON m.id=cm.user_id
 WHERE m.email='gm@sprint.invalid' AND m.id LIKE 'phase-b-backfill-%'`).all();
check(gmRows.some(row=>row.role==='campaign_gm'&&row.status==='active'),'Kleve GM email maps only to the campaign_gm role');
check(gmRows.some(row=>row.role==='campaign_gm'&&row.status==='blocked'),'backfill preserves blocked status for the legacy GM identity');
check(gmRows.some(row=>row.role==='campaign_gm'&&row.status==='pending'),'backfill preserves pending status for the legacy GM identity');
check(connection.prepare('SELECT role,status FROM campaign_memberships WHERE user_id LIKE \'phase-b-other-campaign-%\'').get()?.role==='player','different campaign legacy member maps to player');
const backfillEvents=connection.prepare("SELECT COUNT(*) AS n FROM role_audit_events WHERE action='campaign_membership.backfilled'").get().n;
check(backfillEvents===first.inserted,'each inserted backfill membership has one audit event');
assert.throws(()=>connection.prepare("UPDATE role_audit_events SET reason='tampered' WHERE action='campaign_membership.backfilled'").run(),/immutable/);
assert.throws(()=>connection.prepare("DELETE FROM role_audit_events WHERE action='campaign_membership.backfilled'").run(),/immutable/);
check(true,'role audit events reject update and delete');

const scoped=connection.prepare(`SELECT id FROM members WHERE id LIKE 'phase-b-other-campaign-%'`).get();
check(!!scoped,'synthetic second-campaign identity was retained');
const crossRow=connection.prepare(`SELECT cm.user_id FROM campaign_memberships cm JOIN members m ON m.id=cm.user_id
 WHERE m.id LIKE 'phase-b-other-campaign-%' AND cm.campaign_id=?`).get(otherCampaign);
check(!!crossRow,'backfill retains the source campaign ID');
const gmTestId=connection.prepare("SELECT id FROM members WHERE id LIKE 'phase-b-backfill-gm-%'").get().id;
connection.prepare(`INSERT INTO campaign_memberships(campaign_id,user_id,role,status,source,version,created_at,updated_at)
 VALUES(?,?,'player','active','manual',1,'test','test')`).run(otherCampaign,gmTestId);
const kleveGm=await resolveRoles(db,{userId:gmTestId,email:'gm@sprint.invalid',campaignId:'chronik-von-kleve',gmEmail:'gm@sprint.invalid',gmCampaignId:'chronik-von-kleve'});
const otherCampaignRole=await resolveRoles(db,{userId:gmTestId,email:'gm@sprint.invalid',campaignId:otherCampaign,gmEmail:'gm@sprint.invalid',gmCampaignId:'chronik-von-kleve'});
check(kleveGm.campaignRole==='campaign_gm'&&kleveGm.campaignStatus==='active','Kleve GM assignment resolves as a campaign role');
check(otherCampaignRole.campaignRole==='player'&&otherCampaignRole.campaignStatus==='active','same identity does not gain GM rights in another campaign');

const explicitOverride='phase-b-explicit-player-override-'+randomUUID();
insertMember.run(explicitOverride,'gm@sprint.invalid','Synthetic explicit player','active','chronik-von-kleve','test-override');
connection.prepare(`INSERT INTO campaign_memberships(campaign_id,user_id,role,status,source,version,created_at,updated_at)
 VALUES('chronik-von-kleve',?,'player','active','manual',1,'test','test')`).run(explicitOverride);
const explicitPlayerRole=await resolveRoles(db,{userId:explicitOverride,email:'gm@sprint.invalid',campaignId:'chronik-von-kleve',gmEmail:'gm@sprint.invalid',gmCampaignId:'chronik-von-kleve'});
check(explicitPlayerRole.campaignRole==='player'&&explicitPlayerRole.campaignStatus==='active','explicit campaign role takes precedence over the legacy GM email adapter');

const roleNames=['campaign_owner','campaign_gm','campaign_editor','player'];
for(const role of roleNames){
 for(const status of ['pending','blocked']){
  const id=`phase-b-${role}-${status}-${randomUUID()}`;
  insertMember.run(id,`${id}@sprint.invalid`,id,'active','chronik-von-kleve','test-status-matrix');
  connection.prepare(`INSERT INTO campaign_memberships(campaign_id,user_id,role,status,source,version,created_at,updated_at)
   VALUES('chronik-von-kleve',?,?,?,'manual',1,'test','test')`).run(id,role,status);
  const resolved=await resolveRoles(db,{userId:id,email:`${id}@sprint.invalid`,campaignId:'chronik-von-kleve',gmEmail:'gm@sprint.invalid',gmCampaignId:'chronik-von-kleve'});
  check(resolved.campaignRole===role&&resolved.campaignStatus===status,`${role} with ${status} remains inactive`);
 }
}

const otherOwner='phase-b-other-campaign-owner-'+randomUUID();
insertMember.run(otherOwner,`${otherOwner}@sprint.invalid`,'Synthetic multi-campaign owner','active','chronik-von-kleve','test-other-owner');
connection.prepare(`INSERT INTO campaign_memberships(campaign_id,user_id,role,status,source,version,created_at,updated_at)
 VALUES(?,?,'campaign_owner','active','manual',1,'test','test')`).run(otherCampaign,otherOwner);
const currentCampaignRole=await resolveRoles(db,{userId:otherOwner,email:`${otherOwner}@sprint.invalid`,campaignId:'chronik-von-kleve',gmEmail:'gm@sprint.invalid',gmCampaignId:'chronik-von-kleve'});
const foreignCampaignRole=await resolveRoles(db,{userId:otherOwner,email:`${otherOwner}@sprint.invalid`,campaignId:otherCampaign,gmEmail:'gm@sprint.invalid',gmCampaignId:'chronik-von-kleve'});
check(currentCampaignRole.campaignRole==='player'&&foreignCampaignRole.campaignRole==='campaign_owner','campaign owner rights stay within their own campaign');

const adminTarget='phase-b-first-platform-admin-test-'+randomUUID();
const adminOperator='phase-b-approved-operator-test-'+randomUUID();
insertMember.run(adminTarget,'synthetic-admin@sprint.invalid','Synthetic test principal','pending','chronik-von-kleve','test-bootstrap');
await assert.rejects(()=>bootstrapFirstPlatformAdmin(db,{targetUserId:adminTarget,verifiedTargetUserId:adminTarget,authorizedByUserId:adminTarget,approvalReference:'phase-b-test-approval'}),/separate authorizing operator/);
await assert.rejects(()=>bootstrapFirstPlatformAdmin(db,{targetUserId:adminTarget,verifiedTargetUserId:adminTarget,authorizedByUserId:adminOperator,approvalReference:'short'}),/explicit approval reference/);
const boot=await bootstrapFirstPlatformAdmin(db,{targetUserId:adminTarget,verifiedTargetUserId:adminTarget,authorizedByUserId:adminOperator,approvalReference:'TEST-ONLY-phase-b-isolated-d1'},'test-bootstrap-time');
check(boot.userId===adminTarget&&boot.role==='platform_admin','controlled bootstrap works only with separate synthetic approval identities');
await assert.rejects(()=>bootstrapFirstPlatformAdmin(db,{targetUserId:'phase-b-second-admin-test',verifiedTargetUserId:'phase-b-second-admin-test',authorizedByUserId:adminOperator,approvalReference:'TEST-ONLY-second-attempt'},'test-bootstrap-time-2'),/already used|concurrency race/);
check(count('platform_roles')===1,'bootstrap creates at most the first synthetic Test-D1 admin');
const adminRoles=await resolveRoles(db,{userId:adminTarget,email:'synthetic-admin@sprint.invalid',campaignId:'chronik-von-kleve',gmEmail:'gm@sprint.invalid',gmCampaignId:'chronik-von-kleve'});
check(adminRoles.platformRoles.includes('platform_admin')&&adminRoles.campaignRole==='player'&&adminRoles.campaignStatus==='pending','platform admin does not imply campaign access');
check(connection.prepare("SELECT COUNT(*) AS n FROM role_audit_events WHERE action='platform_admin.bootstrapped'").get().n===1,'bootstrap writes an audit event');
check(connection.prepare("SELECT COUNT(*) AS n FROM role_audit_events WHERE action='campaign_membership.status_changed'").get().n>=1,'legacy and explicit membership changes were audited');

const protectedTables=['campaigns','members','records','files','entities','relationships','knowledge','world_events','recovery_sources','recovery_records','recovery_conflicts','location_nodes','location_actions'];
const preRollback=new Map(protectedTables.map(table=>[table,JSON.stringify(rows(table))]));
const clone=join(stateRoot,'0004-rollback-probe.sqlite');
if(existsSync(clone))rmSync(clone);
connection.prepare('VACUUM INTO ?').run(clone);
const rollbackDb=new DatabaseSync(clone);
rollbackDb.exec(`DROP TRIGGER role_audit_events_no_update;
DROP TRIGGER role_audit_events_no_delete;
DROP INDEX idx_role_audit_subject_time;
DROP INDEX idx_role_audit_campaign_time;
DROP INDEX idx_campaign_memberships_campaign_status;
DROP INDEX idx_campaign_memberships_user_status;
DROP INDEX idx_platform_roles_status;
DROP TABLE role_audit_events;
DROP TABLE campaign_memberships;
DROP TABLE platform_roles;
ALTER TABLE members DROP COLUMN version;`);
const postRollback=new Map(protectedTables.map(table=>[table,JSON.stringify(rollbackDb.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all())]));
for(const table of protectedTables){
 if(table==='members'){
  const withoutRevision=items=>items.map(item=>Object.fromEntries(Object.entries(item).filter(([key])=>key!=='version')));
  assert.deepEqual(JSON.parse(postRollback.get(table)),withoutRevision(JSON.parse(preRollback.get(table))),'rollback retained members and all legacy columns');
 }else assert.equal(postRollback.get(table),preRollback.get(table),`rollback retained ${table}`);
 checks++;
 console.log(`PASS rollback retained ${table}`);
}
check(!rollbackDb.prepare('PRAGMA table_info(members)').all().some(column=>column.name==='version'),'physical rollback probe removes only the additive revision column');
check(rollbackDb.prepare('PRAGMA foreign_key_check').all().length===0,'physical rollback probe leaves legacy foreign keys valid');
rollbackDb.close();
connection.close();
console.log(`Role foundation Test-D1 checks passed: ${checks}; ${first.inserted} deterministic backfill rows; no production database was used.`);
