import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { readContentBlocks, writeContentBlock, deleteContentBlock } from '../server/content-blocks.ts';
import { contentBlockInputSchema } from '../domain/content-blocks.ts';

test('Content block CRUD and SQL filtering preserve entity content and secrecy', async () => {
  const sql=new DatabaseSync(':memory:');
  try {
    sql.exec('PRAGMA foreign_keys=ON');
    for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>/^000[0-9]_.*\.sql$/.test(f)).sort()) sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
    class Statement {
      constructor(query,values=[]) { this.query=query; this.values=values; }
      bind(...values) { return new Statement(this.query,values); }
      async all() { return {results:sql.prepare(this.query).all(...this.values)}; }
      async first() { return sql.prepare(this.query).get(...this.values)??null; }
      async run() { return {meta:{changes:Number(sql.prepare(this.query).run(...this.values).changes)}}; }
    }
    const db={prepare:q=>new Statement(q),batch:async statements=>Promise.all(statements.map(s=>s.all()))};
    sql.exec("INSERT INTO campaigns VALUES('other','Other','test'); INSERT INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,content,created_at,updated_at) VALUES('npc','chronik-von-kleve','NPC','draft','gm','sl','{\"original\":true}','test','test'),('hidden','chronik-von-kleve','NPC','GM_SECRET','gm','sl','{}','test','test'),('foreign','other','NPC','draft','other','sl','{}','test','test')");
    sql.exec("INSERT INTO knowledge(id,campaign_id,entity_id,audience,subject_id,state,granted_by,created_at,updated_at) VALUES('grant','chronik-von-kleve','npc','group','chronik-von-kleve','DISCOVERED','gm','test','test')");
    const gm={id:'gm',campaignId:'chronik-von-kleve',role:'campaign_gm',gm:true,status:'active'};
    const player={...gm,id:'player',role:'player',gm:false};
    const data={entityId:'npc',kind:'description',content:'VISIBLE',visibility:'player_visible',position:2};
    const visible=await writeContentBlock(db,gm,data);
    const secret=await writeContentBlock(db,gm,{...data,content:'SECRET_SENTINEL',visibility:'sl_secret',position:0});
    assert.equal((await readContentBlocks(db,gm,'npc')).length,2);
    assert.deepEqual((await readContentBlocks(db,gm,'npc')).map(b=>b.id),[secret.id,visible.id]);
    const response=await readContentBlocks(db,player,'npc');
    assert.deepEqual(response,[visible]);
    assert.equal(JSON.stringify(response).includes('SECRET_SENTINEL'),false);
    const notFound=e=>e.status===404;
    const forbidden=e=>e.status===403;
    await assert.rejects(readContentBlocks(db,player,'npc',secret.id),notFound);
    await assert.rejects(readContentBlocks(db,player,'hidden'),notFound);
    await assert.rejects(readContentBlocks(db,player,'foreign'),notFound);
    await assert.rejects(readContentBlocks(db,{...player,id:'no-grant',campaignId:'other'},'npc'),notFound);
    await assert.rejects(readContentBlocks(db,{...player,status:'blocked'},'npc'),forbidden);
    await assert.rejects(writeContentBlock(db,player,data),forbidden);
    await assert.rejects(writeContentBlock(db,{...player,gm:true},data),forbidden);
    await assert.rejects(deleteContentBlock(db,player,'npc',visible.id),forbidden);
    const updated=await writeContentBlock(db,gm,{...data,content:'EDITED',position:1},visible.id);
    assert.equal(updated.id,visible.id);
    assert.equal((await readContentBlocks(db,player,'npc'))[0].content,'EDITED');
    await writeContentBlock(db,gm,{...data,visibility:'sl_secret'},visible.id);
    assert.deepEqual(await readContentBlocks(db,player,'npc'),[]);
    await assert.rejects(writeContentBlock(db,gm,{...data,entityId:'hidden'},visible.id),notFound);
    assert.throws(()=>sql.prepare('UPDATE entity_content_blocks SET entity_id=? WHERE id=?').run('hidden',secret.id));
    assert.throws(()=>sql.prepare('UPDATE entity_content_blocks SET visibility=? WHERE id=?').run('group',secret.id));
    assert.throws(()=>sql.prepare('UPDATE entity_content_blocks SET position=? WHERE id=?').run(-1,secret.id));
    await deleteContentBlock(db,gm,'npc',secret.id);
    await assert.rejects(readContentBlocks(db,gm,'npc',secret.id),notFound);
    assert.equal(sql.prepare("SELECT content FROM entities WHERE id='npc'").get().content,'{"original":true}');
    assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[]);
    sql.exec("DELETE FROM entities WHERE id='npc'");
    assert.equal(sql.prepare('SELECT count(*) n FROM entity_content_blocks').get().n,0);
  } finally { sql.close(); }
});

test('Content block payload rejects unknown visibility, identity injection and invalid position',()=>{
  const data={entityId:'npc',kind:'text',content:'',visibility:'sl_secret',position:0};
  assert.ok(contentBlockInputSchema.safeParse(data).success);
  for(const patch of [{visibility:'group'},{position:1.5},{position:-1},{id:'forged'},{campaignId:'foreign'},{kind:''}]) assert.equal(contentBlockInputSchema.safeParse({...data,...patch}).success,false);
});
