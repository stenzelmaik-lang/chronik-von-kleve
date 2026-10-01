import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {canInvite,profileInput,managementInput,acceptInput} from '../domain/account-access.ts';

test('Only active campaign owners/GM can issue player invitations; GM is not platform admin',()=>{
  for(const role of ['campaign_owner','campaign_gm'])assert.equal(canInvite(role,'active'),true);
  for(const role of ['player','campaign_editor','platform_admin'])assert.equal(canInvite(role,'active'),false);
  for(const status of ['pending','blocked'])assert.equal(canInvite('campaign_gm',status),false);
});
test('Account contracts reject privilege injection and unbounded invitations',()=>{
  const valid={action:'invite',email:'synthetic@example.invalid',campaignId:'chronik-von-kleve',memberId:null,days:3};
  assert.equal(managementInput.safeParse(valid).success,true);
  for(const altered of [{...valid,role:'platform_admin'},{...valid,days:8},{...valid,action:'grant_admin'}])assert.equal(managementInput.safeParse(altered).success,false);
  assert.equal(profileInput.safeParse({version:1,displayName:'Tester',avatarFileId:null,preferences:{reducedMotion:true,compactView:false},userId:'someone-else'}).success,false);
  assert.equal(acceptInput.safeParse({token:'a'.repeat(43),email:'tester@example.invalid',displayName:'Tester',password:'long-test-password',confirmation:'different-password'}).success,false);
});
test('Migration 0007 preserves existing identity links, password hashes, sessions and character ownership',()=>{
  const db=new DatabaseSync(':memory:');
  try{
    for(const name of ['0000_aromatic_network','0001_purple_blockbuster','0002_thick_mister_fear','0003_careful_leech','0004_role_membership_foundation','0005_phase_c_editorial_revisions','0006_auth_platform'])db.exec(readFileSync('drizzle/'+name+'.sql','utf8'));
    db.exec(`INSERT INTO members(id,email,name,status,created_at) VALUES('canary-member','canary@example.invalid','Canary','active','now');
      INSERT INTO auth_users(id,email,email_normalized,display_name,password_hash,email_verified_at,status,created_at,updated_at) VALUES('canary-user','canary@example.invalid','canary@example.invalid','Canary','SYNTHETIC_HASH_CANARY','now','active','now','now');
      INSERT INTO auth_member_links(auth_user_id,member_id,approved_by,approval_reference,linked_at) VALUES('canary-user','canary-member','isolated-operator','synthetic test','now');
      INSERT INTO auth_sessions(session_hash,user_id,created_at,expires_at,last_seen_at) VALUES('SYNTHETIC_SESSION_HASH','canary-user','now','2099-01-01','now');
      INSERT INTO records(id,owner_id,kind,title,created_at,updated_at) VALUES('canary-character','canary-member','charaktere','Synthetic existing character','now','now');`);
    const before=db.prepare('SELECT * FROM auth_member_links').get();
    const migration=readFileSync('drizzle/0007_auth_profiles_closed_alpha.sql','utf8');
    assert.doesNotMatch(migration,/DROP TABLE|foreign_keys\s*=\s*OFF/i);db.exec(migration);
    assert.deepEqual(db.prepare('SELECT * FROM auth_member_links').get(),before);
    assert.equal(db.prepare('SELECT password_hash,version FROM auth_users').get().password_hash,'SYNTHETIC_HASH_CANARY');
    assert.equal(db.prepare('SELECT version FROM auth_users').get().version,1);
    assert.equal(db.prepare('SELECT owner_id FROM records').get().owner_id,'canary-member');
    assert.match(db.prepare('SELECT session_id FROM auth_sessions').get().session_id,/^[a-f0-9]{32}$/);
    db.exec("INSERT INTO auth_sessions(session_hash,user_id,created_at,expires_at,last_seen_at) VALUES('OLD_INSERT_PATH','canary-user','now','2099-01-01','now')");
    assert.match(db.prepare("SELECT session_id FROM auth_sessions WHERE session_hash='OLD_INSERT_PATH'").get().session_id,/^[a-f0-9]{32}$/);
    assert.throws(()=>db.exec('UPDATE auth_users SET version=0'));
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  }finally{db.close();}
});
