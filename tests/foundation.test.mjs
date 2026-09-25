import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {projectEntity} from '../server/entities.ts';

const campaignId='chronik-von-kleve';
const gm={id:'gm',campaignId,gm:true,status:'active'};
const a={id:'a',campaignId,gm:false,status:'active'},b={...a,id:'b'};
const entity={id:'immutable-1',campaignId,type:'CLUE',canonStatus:'WORKING',ownerId:'gm',visibility:'sl',legacyRecordId:null,title:'Test',content:{text:'RELEASED_ONLY',gmBody:'NESTED_SECRET',parts:[{canonStatus:'GM_SECRET',text:'SECRET_PART'}]},gmBody:'GM_ONLY',version:1,createdAt:'test',updatedAt:'test'};
test('Player projection: individual, group, inactive, campaign and GM_SECRET protection',()=>{
 const grant={entity_id:entity.id,audience:'player',subject_id:'a',state:'DISCOVERED'};
 assert.equal(projectEntity(a,entity,[]),null);
 assert.equal(projectEntity(b,entity,[grant]),null);
 const safe=projectEntity(a,entity,[grant]);assert.equal(safe.content.text,'RELEASED_ONLY');
 assert.ok(!JSON.stringify(safe).includes('SECRET'));assert.ok(!JSON.stringify(safe).includes('GM_ONLY'));
 const group={...grant,audience:'group',subject_id:campaignId};assert.ok(projectEntity(b,entity,[group]));
 assert.equal(projectEntity({...b,status:'blocked'},entity,[group]),null);
 assert.equal(projectEntity({...b,campaignId:'other'},entity,[group]),null);
 assert.equal(projectEntity(a,{...entity,canonStatus:'GM_SECRET'},[group]),null);
 assert.equal(projectEntity(a,{...entity,content:{canonStatus:'GM_SECRET',text:'SECRET_ROOT'}},[group]),null);
 assert.equal(projectEntity(gm,entity,[]).gmBody,'GM_ONLY');
 assert.equal(projectEntity(a,entity,[{...grant,state:'UNKNOWN'}]),null);
});
test('Legacy shared body and hidden places use the same server projection',()=>{
 const legacy={...entity,legacyRecordId:entity.id,visibility:'group'};
 assert.ok(projectEntity(a,legacy,[]));
 assert.equal(projectEntity(a,{...legacy,content:{text:'SECRET',discovered:false}},[]),null);
 assert.equal(projectEntity(a,{...legacy,content:{text:'SECRET',content_unlocked:false}},[]),null);
 const unlocked=projectEntity(a,{...legacy,content:{text:'RELEASED',discovered:false}},[{entity_id:legacy.id,audience:'group',subject_id:campaignId,state:'DISCOVERED'}]);
 assert.equal(unlocked.content.discovered,true);
});
test('Migration preserves all 67 legacy records and files; adapters, FKs, stable IDs and events work',()=>{
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 db.exec(fs.readFileSync('drizzle/0000_aromatic_network.sql','utf8'));
 const catalog=JSON.parse(fs.readFileSync('server/catalog.json','utf8'));
 assert.equal(catalog.length,67);
 const insert=db.prepare('INSERT INTO records(id,owner_id,kind,visibility,title,body,gm_body,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)');
 for(const r of catalog)insert.run(r.id,'test-gm',r.kind,r.visibility,r.title,JSON.stringify(r.body),r.gmBody,'test','test');
 db.prepare('INSERT INTO files(id,owner_id,visibility,name,mime,size,key,created_at) VALUES(?,?,?,?,?,?,?,?)').run('fixture-file','test-gm','sl','fixture.pdf','application/pdf',5,'preserve/r2/key','test');
 const before=db.prepare('SELECT * FROM records ORDER BY id').all();
 db.exec(fs.readFileSync('drizzle/0001_purple_blockbuster.sql','utf8'));
 const after=db.prepare('SELECT * FROM records ORDER BY id').all().map(({campaign_id,...r})=>{assert.equal(campaign_id,campaignId);return r});
 const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 assert.equal(hash(after),hash(before),'Legacy payload checksum unchanged');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entities').get().n,67);
 assert.equal(db.prepare('SELECT key FROM files').get().key,'preserve/r2/key');
 assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 const id=before[0].id;db.prepare('UPDATE records SET title=?,version=version+1 WHERE id=?').run('Renamed test',id);
 assert.equal(db.prepare('SELECT legacy_record_id FROM entities WHERE id=?').get(id).legacy_record_id,id);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM world_events').get().n,1);
 assert.throws(()=>db.prepare('UPDATE records SET id=? WHERE id=?').run('changed',id),/Immutable identity/);
 assert.throws(()=>db.prepare('INSERT INTO relationships(id,campaign_id,source_id,target_id,type,created_at) VALUES(?,?,?,?,?,?)').run('bad','other',id,before[1].id,'test','test'),/FOREIGN KEY/);
 db.prepare('INSERT INTO relationships(id,campaign_id,source_id,target_id,type,created_at) VALUES(?,?,?,?,?,?)').run('relation',campaignId,id,before[1].id,'test','test');
 db.prepare('INSERT INTO knowledge(id,campaign_id,entity_id,audience,subject_id,state,granted_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run('grant',campaignId,id,'group',campaignId,'DISCOVERED','gm','test','test');
 db.prepare('DELETE FROM records WHERE id=?').run(id);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM knowledge').get().n,0);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM relationships').get().n,0);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entities').get().n,66);
 db.close();
});
test('Migration 0004 is additive and constrains campaign roles, platform roles, revisions and audit history',()=>{
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 for(const file of ['0000_aromatic_network.sql','0001_purple_blockbuster.sql','0002_thick_mister_fear.sql','0003_careful_leech.sql'])db.exec(fs.readFileSync(`drizzle/${file}`,'utf8'));
 db.prepare('INSERT INTO members(id,email,name,status,created_at) VALUES(?,?,?,?,?)').run('phase-b-schema-user','schema@test.invalid','Schema fixture','active','before-0004');
 db.prepare('INSERT INTO records(id,owner_id,kind,title,created_at,updated_at) VALUES(?,?,?,?,?,?)').run('phase-b-schema-record','phase-b-schema-user','chronik','Existing record','before-0004','before-0004');
 db.prepare('INSERT INTO files(id,owner_id,name,mime,size,key,created_at) VALUES(?,?,?,?,?,?,?)').run('phase-b-schema-file','phase-b-schema-user','kept.bin','application/octet-stream',4,'kept/r2/key','before-0004');
 const beforeMember=db.prepare('SELECT id,email,name,status,created_at FROM members WHERE id=?').get('phase-b-schema-user');
 const beforeRecords=db.prepare('SELECT * FROM records ORDER BY id').all();
 const beforeFiles=db.prepare('SELECT * FROM files ORDER BY id').all();
 db.exec(fs.readFileSync('drizzle/0004_role_membership_foundation.sql','utf8'));
 assert.equal(db.prepare('SELECT id,email,name,status,created_at FROM members WHERE id=?').get('phase-b-schema-user').email,beforeMember.email);
 assert.equal(db.prepare('SELECT version FROM members WHERE id=?').get('phase-b-schema-user').version,1);
 assert.deepEqual(db.prepare('SELECT * FROM records ORDER BY id').all(),beforeRecords);
 assert.deepEqual(db.prepare('SELECT * FROM files ORDER BY id').all(),beforeFiles);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM campaign_memberships').get().n,0,'migration does not backfill memberships');
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM platform_roles').get().n,0,'migration does not provision an administrator');
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM role_audit_events').get().n,0);
 db.prepare(`INSERT INTO campaign_memberships(campaign_id,user_id,role,status,source,version,created_at,updated_at)
  VALUES('chronik-von-kleve','phase-b-schema-user','player','active','manual',1,'test','test')`).run();
 assert.throws(()=>db.prepare(`INSERT INTO campaign_memberships(campaign_id,user_id,role,status,source,version,created_at,updated_at)
  VALUES('chronik-von-kleve','phase-b-schema-user','platform_admin','active','manual',1,'test','test')`).run(),/CHECK constraint/);
 assert.throws(()=>db.prepare(`INSERT INTO campaign_memberships(campaign_id,user_id,role,status,source,version,created_at,updated_at)
  VALUES('unknown-campaign','phase-b-schema-user','player','active','manual',1,'test','test')`).run(),/FOREIGN KEY/);
 db.prepare(`INSERT INTO role_audit_events(id,actor_id,actor_kind,action,subject_user_id,campaign_id,before_state,after_state,reason,created_at)
  VALUES('immutable-phase-b','operator','user','campaign_membership.backfilled','phase-b-schema-user','chronik-von-kleve','{}','{"role":"player"}','test','test')`).run();
 assert.throws(()=>db.prepare("UPDATE role_audit_events SET reason='changed' WHERE id='immutable-phase-b'").run(),/immutable/);
 assert.throws(()=>db.prepare("DELETE FROM role_audit_events WHERE id='immutable-phase-b'").run(),/immutable/);
 assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 db.close();
});

test('member management UI sends the revision required by the members API',()=>{
 const workspace=fs.readFileSync('app/spielbereich/workspace.tsx','utf8');
 const route=fs.readFileSync('app/api/members/route.ts','utf8');
 assert.match(workspace,/expectedVersion:\s*m\.version/);
 assert.match(route,/body\.expectedVersion === undefined/);
 assert.match(route,/new HttpError\(428,/);
 assert.match(route,/body\.expectedVersion !== currentVersion/);
});
