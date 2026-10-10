import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,copyFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {library,contents,readChapter,pageAsset,search,setBookRelease} from '../server/codex.ts';
import {createHash} from 'node:crypto';
const playerPublication=process.argv.includes('--players-pre-alpha');
const baseline=resolve('.local-work/codex-release-20261010');
const root=resolve(playerPublication?'.local-work/codex-player-release-20261010':'.local-work/codex-release-20261010'),target=root+'/production-with-codex-copy.sqlite';
assert.ok(!existsSync(target),'Preserve existing package check.');
copyFileSync(baseline+'/production-copy-v2.sqlite',target);
const sql=new DatabaseSync(target);sql.exec('PRAGMA foreign_keys=ON');
const q=s=>'"'+s.replaceAll('"','""')+'"';
const names=Object.keys(JSON.parse(readFileSync(baseline+'/migration-copy-result.json')).tablesPreserved);
const before=Object.fromEntries(names.map(t=>[t,sql.prepare('SELECT * FROM '+q(t)).all().map(r=>JSON.stringify(r))]));
class Statement{constructor(q,v=[]){this.q=q;this.v=v;}bind(...v){return new Statement(this.q,v);}async all(){return {results:sql.prepare(this.q).all(...this.v)};}async first(){return sql.prepare(this.q).get(...this.v)??null;}}
const db={prepare:q=>new Statement(q),batch:async s=>Promise.all(s.map(a=>a.all()))};
const gm={id:'offline-role-check',campaignId:'chronik-von-kleve',gm:true,role:'campaign_gm',status:'active'},player={...gm,id:'offline-player-check',gm:false,role:'player'};
try{
 sql.exec(readFileSync(root+'/books-staged.sql','utf8'));
 assert.equal((await library(db,gm)).filter(b=>b.readerReady).length,0,'Staged books fail closed');
 sql.exec(readFileSync(root+'/books-activate-after-assets.sql','utf8'));
 const books=await library(db,gm);assert.equal(books.length,15);assert.ok(books.every(b=>b.readerReady&&b.playerReleased===playerPublication));
 for(const b of books)assert.ok((await contents(db,gm,b.id)).chapters.length);
 let chapterChecks=0,pageChecks=0;
 const timings=[];
 if(playerPublication){
  const assets=new Map(JSON.parse(readFileSync(root+'/r2-private-assets.json')).map(a=>[a.key,a]));let storageReads=0;
  const bucket={get:async key=>{storageReads++;const a=assets.get(key);return a?{body:readFileSync(a.file)}:null;}};
  assert.ok((await library(db,player)).every(b=>b.readerReady));
  for(const b of books){
   const toc=await contents(db,player,b.id);assert.ok(toc.chapters.length);let pageChapter,page;
   assert.equal(b.rights,JSON.parse(sql.prepare('SELECT content FROM entities WHERE id=?').get(b.id).content).rights);
   for(const c of toc.chapters){const chapter=await readChapter(db,player,b.id,c.id);assert.deepEqual(chapter,JSON.parse(sql.prepare('SELECT content FROM entity_content_blocks WHERE id=?').get(c.id).content));chapterChecks++;
    for(const s of chapter.sections.filter(s=>s.kind==='page')){pageChapter=c.id;page=s.source.page;const image=await pageAsset(db,bucket,player,b.id,c.id,page);assert.equal(image.headers.get('cache-control'),'private, no-store');assert.equal(createHash('sha256').update(Buffer.from(await image.arrayBuffer())).digest('hex'),assets.get(`codex-pages/${b.hash}/page-${page}.jpg`).sha256);pageChecks++;}
   }
   await setBookRelease(db,gm,b.id,false);
   await assert.rejects(contents(db,player,b.id),e=>e.status===403);
   await assert.rejects(readChapter(db,player,b.id,toc.chapters[0].id),e=>e.status===403);
   const reads=storageReads;await assert.rejects(pageAsset(db,bucket,player,b.id,pageChapter,page),e=>e.status===403);assert.equal(storageReads,reads);
   assert.ok((await search(db,player,'Willenskraft')).every(h=>h.bookId!==b.id));
   await setBookRelease(db,gm,b.id,true);
  }
  for(let i=0;i<20;i++){const start=performance.now();const hits=await search(db,player,'Willenskraft');assert.ok(hits.length);for(const h of hits)assert.ok((await readChapter(db,player,h.bookId,h.chapterId)).sections.some(s=>s.id===h.sectionId));timings.push(performance.now()-start);}
  timings.sort((a,b)=>a-b);
 }else{assert.ok((await library(db,player)).every(b=>!b.readerReady));assert.equal((await search(db,player,'Willenskraft')).length,0);}
 for(const table of names){const after=new Set(sql.prepare('SELECT * FROM '+q(table)).all().map(r=>JSON.stringify(r)));for(const row of before[table])assert.ok(after.has(row),'Existing row changed in '+table);if(!['entities','entity_content_blocks'].includes(table))assert.equal(after.size,before[table].length,table);}
 assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length,0);assert.equal(sql.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 const result={books:15,stagedFailClosed:true,slReaderAll:true,allPlayerReleases:playerPublication,chapterChecks,pageChecks,...(playerPublication?{licenceAssertions:false,perBookRevocationTested:15,searchAndHitNavigationMedianMs:timings[10],searchAndHitNavigationP95Ms:timings[18]}:{}),existingRowsPreserved:true,foreignKeys:0,integrity:'ok',productionWrites:false};
 writeFileSync(root+'/release-package-copy-result.json',JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));
}finally{sql.close();}
