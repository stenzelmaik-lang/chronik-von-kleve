import {DatabaseSync} from 'node:sqlite';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve('.local-work/codex-release-20261010');
const source=new DatabaseSync(root+'/production-copy-v2.sqlite',{readOnly:true});
const prior=JSON.parse(readFileSync(root+'/migration-copy-result.json'));
const names=Object.keys(prior.tablesPreserved);
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("Offline copy test");}}',compatibilityDate:'2026-05-15',d1Databases:{DB:'codex-production-copy-local-only'}}));
const q=s=>'"'+s.replaceAll('"','""')+'"';
const hash=rows=>createHash('sha256').update(rows.map(r=>JSON.stringify(r)).sort().join('\n')).digest('hex');
try{
 const db=await mf.getD1Database('DB');
 const schema=source.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END,name").all().filter(r=>names.includes(r.tbl_name)&&r.type!=='trigger');
 for(const row of schema)await db.prepare(row.sql).run();
 const statements=[db.prepare('PRAGMA defer_foreign_keys=TRUE')];
 for(const table of names){
  const columns=source.prepare('PRAGMA table_info('+q(table)+')').all().map(r=>r.name);
  for(const row of source.prepare('SELECT * FROM '+q(table)).all())statements.push(db.prepare('INSERT INTO '+q(table)+' ('+columns.map(q).join(',')+') VALUES ('+columns.map(()=>'?').join(',')+')').bind(...columns.map(c=>row[c])));
 }
 await db.batch(statements);
 const before={};
 for(const t of names)before[t]=hash((await db.prepare('SELECT * FROM '+q(t)).all()).results);
 await db.batch(readFileSync('drizzle/0012_codex_reader_index.sql','utf8').split('--> statement-breakpoint').map(s=>db.prepare(s.trim())));
 for(const t of names)assert.equal(hash((await db.prepare('SELECT * FROM '+q(t)).all()).results),before[t],t);
 assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length,0);
 // D1 authorizer does not expose integrity_check. The offline SQLite copy
 // already passed it; runtime evidence is exact row hashes and FK checks.
 const result={runtime:'workerd/Miniflare local D1',migration:'0012',tablesPreserved:names.length,foreignKeyIssues:0,integrity:'offline SQLite check passed; D1 pragma unsupported',productionWrites:false};
 writeFileSync(root+'/migration-runtime-result.json',JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));
}finally{source.close();await mf.dispose();}
