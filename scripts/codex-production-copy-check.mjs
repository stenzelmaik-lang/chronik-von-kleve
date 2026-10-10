// Offline verification only: no network, no production writes, no application
// serving the copied accounts. Export/restore artefacts stay ignored/private.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve('.local-work/codex-release-20261010');
const target=join(root,'production-copy-v2.sqlite');
assert.ok(!existsSync(target),'Preserve an existing copy; choose a new run directory.');
const dump=readFileSync(join(root,'production-B0.sql'));
const sha=x=>createHash('sha256').update(x).digest('hex');
const db=new DatabaseSync(target);
const quote=s=>'"'+s.replaceAll('"','""')+'"';
const stringify=x=>JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v);
try{
 // D1 export emits unique indexes after data. Temporarily disable FK checks
 // only while restoring this disposable copy, then enforce and verify them.
 db.exec('PRAGMA foreign_keys=OFF');
 db.exec(dump.toString('utf8'));
 db.exec('PRAGMA foreign_keys=ON');
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);
 const snapshot=()=>Object.fromEntries(tables.map(t=>{const rows=db.prepare('SELECT * FROM '+quote(t)).all().map(stringify).sort();return [t,{count:rows.length,hash:sha(rows.join('\n'))}];}));
 const before=snapshot(),fkBefore=db.prepare('PRAGMA foreign_key_check').all();
 assert.ok(tables.includes('entity_content_blocks'));
 const cols=db.prepare('PRAGMA table_info(entities)').all().map(r=>r.name);
 for(const col of ['play_state','replaced_by','default_visibility'])assert.ok(cols.includes(col));
 const migration=readFileSync('drizzle/0012_codex_reader_index.sql');
 db.exec(migration.toString('utf8'));
 assert.deepEqual(snapshot(),before);
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),fkBefore);
 assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 const generated=JSON.parse(readFileSync('drizzle/meta/0012_snapshot.json'));
 assert.deepEqual(db.prepare('PRAGMA table_info(codex_sections)').all().map(r=>r.name),Object.keys(generated.tables.codex_sections.columns));
 // FTS trigger lifecycle checked without changing existing game objects.
 db.exec('SAVEPOINT codex_probe');
 const campaign=db.prepare('SELECT id FROM campaigns LIMIT 1').get().id;
 db.prepare("INSERT INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,title,content,created_at,updated_at) VALUES('codex-copy-probe',?,'RULE','draft','offline-probe','sl','OFFLINE TEST','{}','test','test')").run(campaign);
 db.prepare("INSERT INTO entity_content_blocks(id,campaign_id,entity_id,kind,content,visibility,position) VALUES('codex-copy-probe-block',?,'codex-copy-probe','codex_chapter','{}','sl_secret',0)").run(campaign);
 db.exec("INSERT INTO codex_sections VALUES('codex-copy-probe-section','codex-copy-probe-block','TEST','FTSPROBESENTINEL','{}')");
 assert.equal(db.prepare("SELECT count(*) AS n FROM codex_fts WHERE codex_fts MATCH 'FTSPROBESENTINEL'").get().n,1);
 db.exec("UPDATE codex_sections SET plain_text='UPDATEDPROBESENTINEL' WHERE id='codex-copy-probe-section'");
 assert.equal(db.prepare("SELECT count(*) AS n FROM codex_fts WHERE codex_fts MATCH 'FTSPROBESENTINEL'").get().n,0);
 db.exec("DELETE FROM entities WHERE id='codex-copy-probe'");
 // Export may leave FK enforcement off; rollback always removes this probe.
 db.exec('ROLLBACK TO codex_probe; RELEASE codex_probe');
 assert.deepEqual(snapshot(),before);
 const pano=db.prepare("SELECT cm.role,cm.status FROM campaign_memberships cm JOIN members m ON m.id=cm.user_id WHERE lower(m.name)='pano'").all();
 const result={backupSHA256:sha(dump),migrationSHA256:sha(migration),tablesPreserved:before,foreignKeysBefore:fkBefore.length,foreignKeysAfter:db.prepare('PRAGMA foreign_key_check').all().length,integrity:'ok',migration:'0012',fts:'insert/update checked; probe rolled back',panoRoles:pano,productionWrites:false};
 writeFileSync(join(root,'migration-copy-result.json'),JSON.stringify(result,null,2),{flag:'wx'});
 console.log(JSON.stringify({migration:'0012',tablesPreserved:tables.length,integrity:'ok',foreignKeyIssues:fkBefore.length,panoRoles:pano,productionWrites:false}));
}finally{db.close();}
