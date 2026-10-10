import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,copyFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {library,contents,search} from '../server/codex.ts';
const root=resolve('.local-work/codex-release-20261010'),target=root+'/production-with-codex-copy.sqlite';
assert.ok(!existsSync(target),'Preserve existing package check.');
copyFileSync(root+'/production-copy-v2.sqlite',target);
const sql=new DatabaseSync(target);sql.exec('PRAGMA foreign_keys=ON');
const q=s=>'"'+s.replaceAll('"','""')+'"';
const names=Object.keys(JSON.parse(readFileSync(root+'/migration-copy-result.json')).tablesPreserved);
const before=Object.fromEntries(names.map(t=>[t,sql.prepare('SELECT * FROM '+q(t)).all().map(r=>JSON.stringify(r))]));
class Statement{constructor(q,v=[]){this.q=q;this.v=v;}bind(...v){return new Statement(this.q,v);}async all(){return {results:sql.prepare(this.q).all(...this.v)};}async first(){return sql.prepare(this.q).get(...this.v)??null;}}
const db={prepare:q=>new Statement(q),batch:async s=>Promise.all(s.map(a=>a.all()))};
const gm={id:'offline-role-check',campaignId:'chronik-von-kleve',gm:true,role:'campaign_gm',status:'active'},player={...gm,id:'offline-player-check',gm:false,role:'player'};
try{
 sql.exec(readFileSync(root+'/books-staged.sql','utf8'));
 assert.equal((await library(db,gm)).filter(b=>b.readerReady).length,0,'Staged books fail closed');
 sql.exec(readFileSync(root+'/books-activate-after-assets.sql','utf8'));
 const books=await library(db,gm);assert.equal(books.length,15);assert.ok(books.every(b=>b.readerReady&&!b.playerReleased));
 for(const b of books)assert.ok((await contents(db,gm,b.id)).chapters.length);
 assert.ok((await library(db,player)).every(b=>!b.readerReady));
 assert.equal((await search(db,player,'Willenskraft')).length,0);
 for(const table of names){const after=new Set(sql.prepare('SELECT * FROM '+q(table)).all().map(r=>JSON.stringify(r)));for(const row of before[table])assert.ok(after.has(row),'Existing row changed in '+table);if(!['entities','entity_content_blocks'].includes(table))assert.equal(after.size,before[table].length,table);}
 assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length,0);assert.equal(sql.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 const result={books:15,stagedFailClosed:true,slReaderAll:true,allPlayerReleases:false,existingRowsPreserved:true,foreignKeys:0,integrity:'ok',productionWrites:false};
 writeFileSync(root+'/release-package-copy-result.json',JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));
}finally{sql.close();}
