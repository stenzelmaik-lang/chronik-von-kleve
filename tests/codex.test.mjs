import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {prepareDocument,sectionText,searchExpression} from '../domain/codex.ts';
import {library,contents,readChapter,search,pageAsset} from '../server/codex.ts';
import {readContentBlocks,writeContentBlock,deleteContentBlock} from '../server/content-blocks.ts';

const para=(text,start,style='NORMAL_TEXT',bold=false)=>({startIndex:start,endIndex:start+text.length,paragraph:{paragraphStyle:{namedStyleType:style},elements:[{textRun:{content:text,textStyle:{bold}}}]}});
export const syntheticDoc={documentId:'synthetic',title:'TEST Regel',tabs:[{tabId:'t.0',title:'Haupttab',body:{content:[
  para('TEST Regel\n',1,'HEADING_1'),para('Absatz eins\n',12),para('1 | Regeln\n',24,'HEADING_2'),
  para('Willenskraft bleibt erhalten.\vKeine Änderung.\n',35,'NORMAL_TEXT',true),
  {startIndex:81,endIndex:141,table:{tableRows:[{tableCells:[{content:[para('Stufe\n',83)]},{content:[para('Wirkung\n',90)]}]},{tableCells:[{content:[para('7–9\n',100)]},{content:[para('Willenskraft\n',107)]}]},{tableCells:[{content:[para('Fortsetzung\n',121)]},{content:[para('\n',134)]}]}]}},
  para('2 | Beispiel\n',142,'HEADING_2'),para('STRESS_SENTINEL\n',156),
]}}]};
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 const journal=JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json',import.meta.url)));
 for(const m of journal.entries)sql.exec(readFileSync(new URL('../drizzle/'+m.tag+'.sql',import.meta.url),'utf8'));
 class Statement{constructor(q,v=[]){this.q=q;this.v=v;}bind(...v){return new Statement(this.q,v);}async all(){return {results:sql.prepare(this.q).all(...this.v)};}async first(){return sql.prepare(this.q).get(...this.v)??null;}async run(){return {meta:{changes:Number(sql.prepare(this.q).run(...this.v).changes)}};}}
 const db={prepare:q=>new Statement(q),batch:async s=>Promise.all(s.map(a=>a.all()))};
 const gm={id:'gm',campaignId:'chronik-von-kleve',gm:true,role:'campaign_gm',status:'active'};
 const player={...gm,id:'player',gm:false,role:'player'};
 sql.exec("INSERT INTO campaigns VALUES('other','Other','now')");
 const chapters=prepareDocument(syntheticDoc);
 for(const [id,rights,visibility,campaign,edition] of [['own','own','player_visible',gm.campaignId,'HOUSE'],['pending','pending','player_visible',gm.campaignId,'V5'],['hidden','own','sl_secret',gm.campaignId,'V20'],['foreign','own','player_visible','other','HOUSE']]){
   sql.prepare("INSERT INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,default_visibility,title,content,created_at,updated_at) VALUES(?,?,'RULE','confirmed','gm','group',?,?,?,'now','now')").run(id,campaign,visibility,id,JSON.stringify({documentKind:'codex_book',rights,readerReady:true,edition}));
   for(const [position,c] of chapters.entries()){
     const blockId=id+'-'+c.id;
     sql.prepare("INSERT INTO entity_content_blocks VALUES(?,?,?,'codex_chapter',?,?,?)").run(blockId,campaign,id,JSON.stringify({...c,id:blockId}),position===0?'sl_secret':'player_visible',position);
     for(const s of c.sections)sql.prepare('INSERT INTO codex_sections VALUES(?,?,?,?,?)').run(blockId+'-'+s.id,blockId,c.title,sectionText(s),JSON.stringify(s.source));
   }
 }
 return {db,sql,gm,player,chapters};
}
test('Native Docs preserve every paragraph, inline emphasis, table cell and source span with stable IDs',()=>{
 const a=prepareDocument(syntheticDoc),b=prepareDocument(syntheticDoc);
 assert.deepEqual(a,b);assert.equal(a.length,3);
 assert.equal(a[1].sections[1].runs[0].text,'Willenskraft bleibt erhalten.\vKeine Änderung.\n');
 assert.equal(a[1].sections[1].runs[0].bold,true);
 assert.deepEqual(a[1].sections[2].rows,[['Stufe\n','Wirkung\n'],['7–9\n','Willenskraft\n'],['Fortsetzung\n','\n']]);
 assert.deepEqual(a[1].sections[2].source,{tab:'t.0',start:81,end:141});
 assert.equal(searchExpression('willenskraft OR " * - stress'),'"willenskraft"* AND "OR"* AND "stress"*');
 assert.equal(searchExpression('"""***'), '');
});
test('Codex permissions apply to books, TOC, chapters and indexed search, including immediate revocation and generic-API bypass',async()=>{
 const {db,sql,gm,player}=fixture();
 try{
  assert.deepEqual((await library(db,player)).map(b=>b.id).sort(),['own','pending']);
  assert.equal((await contents(db,player,'own')).chapters.length,2);
  assert.equal((await contents(db,gm,'own')).chapters.length,3);
  await assert.rejects(contents(db,player,'pending'),e=>e.status===403);
  await assert.rejects(contents(db,gm,'pending'),e=>e.status===403);
  await assert.rejects(contents(db,player,'hidden'),e=>e.status===404);
  await assert.rejects(contents(db,gm,'foreign'),e=>e.status===404);
  const toc=await contents(db,player,'own'),chapter=await readChapter(db,player,'own',toc.chapters[0].id);
  assert.equal(chapter.title,'1 | Regeln');assert.ok(!JSON.stringify(toc).includes('STRESS_SENTINEL'));
  await assert.rejects(readChapter(db,player,'own','own-chapter-t.0-1'),e=>e.status===404);
  const hits=await search(db,player,'Willenskraft');
  assert.ok(hits.length>=2);assert.ok(hits.every(h=>h.bookId==='own'));
  assert.ok(hits.every(h=>h.sectionId.startsWith('section-')));
  assert.deepEqual(await search(db,player,'Willenskraft','V5'),[]);
  assert.ok((await search(db,gm,'Willenskraft')).some(h=>h.bookId==='hidden'));
  assert.deepEqual(await readContentBlocks(db,gm,'own'),[]);
  await assert.rejects(writeContentBlock(db,gm,{entityId:'own',kind:'description',content:'bypass',visibility:'player_visible',position:0},toc.chapters[0].id),e=>e.status===403);
  await assert.rejects(deleteContentBlock(db,gm,'own',toc.chapters[0].id),e=>e.status===403);
  sql.prepare("UPDATE entity_content_blocks SET visibility='sl_secret' WHERE id=?").run(toc.chapters[0].id);
  assert.deepEqual(await search(db,player,'Willenskraft'),[]);
  sql.prepare("UPDATE entities SET content=json_set(content,'$.rights','pending') WHERE id='own'").run();
  assert.ok((await search(db,gm,'STRESS_SENTINEL')).every(h=>h.bookId!=='own'));
  await assert.rejects(readChapter(db,gm,'own',toc.chapters[1].id),e=>e.status===403);
  await assert.rejects(library(db,{...player,status:'blocked'}),e=>e.status===403);
 }finally{sql.close();}
});
test('Search index trigger update and cascade deletion do not leave phantom hits',async()=>{
 const {db,sql,gm}=fixture();
 try{
  assert.ok((await search(db,gm,'STRESS_SENTINEL')).length);
  sql.exec("UPDATE codex_sections SET plain_text='NEW_SENTINEL' WHERE plain_text LIKE '%STRESS_SENTINEL%'");
  assert.equal((await search(db,gm,'STRESS_SENTINEL')).length,0);
  assert.ok((await search(db,gm,'NEW_SENTINEL')).length);
  sql.exec("DELETE FROM entity_content_blocks WHERE entity_id IN ('own','hidden')");
  assert.deepEqual(await search(db,gm,'NEW_SENTINEL'),[]);
  assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{sql.close();}
});
test('Technical review is explicitly local, SL-only and never a player publication grant; page assets share chapter checks',async()=>{
 const {db,sql,gm,player}=fixture();
 try{
  sql.exec("UPDATE entities SET content=json_set(content,'$.localReview',json('true')) WHERE id='pending'");
  assert.equal((await library(db,gm,true)).find(b=>b.id==='pending').readerReady,true);
  assert.equal((await library(db,player,true)).find(b=>b.id==='pending').readerReady,false);
  assert.equal((await library(db,gm,false)).find(b=>b.id==='pending').readerReady,false);
  await assert.rejects(contents(db,player,'pending',true),e=>e.status===403);
  await assert.rejects(contents(db,{...player,gm:true},'pending',true),e=>e.status===403);
  assert.ok((await search(db,gm,'STRESS_SENTINEL',undefined,true)).some(h=>h.bookId==='pending'));
  assert.ok((await search(db,player,'STRESS_SENTINEL',undefined,true)).every(h=>h.bookId!=='pending'));
  const chapterId='pending-chapter-t.0-1',hash='a'.repeat(64);
  sql.exec("UPDATE entities SET content=json_set(content,'$.sourceHash','"+hash+"') WHERE id='pending'");
  const c={id:chapterId,title:'Originalseite',sections:[{id:'section-page-1',kind:'page',level:0,runs:[],rows:[],source:{tab:'PDF',start:0,end:0,page:1,label:'1'}}]};
  sql.prepare('UPDATE entity_content_blocks SET content=? WHERE id=?').run(JSON.stringify(c),chapterId);
  let requested;const bucket={get:async key=>{requested=key;return {body:'FAKE_IMAGE'};}};
  assert.equal((await pageAsset(db,bucket,gm,'pending',chapterId,1,true)).status,200);
  assert.equal(requested,'codex-pages/'+hash+'/page-1.jpg');
  await assert.rejects(pageAsset(db,bucket,player,'pending',chapterId,1,true),e=>e.status===403);
  await assert.rejects(pageAsset(db,bucket,gm,'pending',chapterId,2,true),e=>e.status===404);
  await assert.rejects(pageAsset(db,bucket,gm,'pending',chapterId,1,false),e=>e.status===403);
 }finally{sql.close();}
});
test('0012 is additive, matches its Drizzle snapshot and leaves existing domain data unchanged',()=>{
 const sql=new DatabaseSync(':memory:');
 try{
  const journal=JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json',import.meta.url)));
  for(const m of journal.entries.filter(m=>m.idx<12))sql.exec(readFileSync(new URL('../drizzle/'+m.tag+'.sql',import.meta.url),'utf8'));
  sql.exec("INSERT INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,title,content,gm_body,created_at,updated_at) VALUES('keep-npc','chronik-von-kleve','NPC','confirmed','gm','sl','KEEP','{\"original\":true}','KEEP_SECRET','before','before')");
  const names=sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);
  const before=names.map(n=>sql.prepare('SELECT * FROM '+n).all());
  sql.exec(readFileSync(new URL('../drizzle/0012_codex_reader_index.sql',import.meta.url),'utf8'));
  assert.deepEqual(names.map(n=>sql.prepare('SELECT * FROM '+n).all()),before);
  const snapshot=JSON.parse(readFileSync(new URL('../drizzle/meta/0012_snapshot.json',import.meta.url)));
  assert.deepEqual(sql.prepare('PRAGMA table_info(codex_sections)').all().map(c=>c.name),Object.keys(snapshot.tables.codex_sections.columns));
  assert.equal(sql.prepare('PRAGMA foreign_key_list(codex_sections)').get().on_delete,'CASCADE');
  assert.ok(sql.prepare("SELECT sql FROM sqlite_master WHERE name='codex_fts'").get().sql.includes('fts5'));
  assert.equal(sql.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='trigger' AND name LIKE 'codex_sections_%'").get().n,3);
 }finally{sql.close();}
});
