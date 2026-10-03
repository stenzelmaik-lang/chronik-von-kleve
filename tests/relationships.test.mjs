import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createRelationship,readRelationships,deleteRelationship} from '../server/relationships.ts';
import {coreRelationshipTypeSchema} from '../domain/relationships.ts';

test('Relationships retain legacy types and enforce endpoints, campaigns and reader visibility',async()=>{
  const sql=new DatabaseSync(':memory:');
  try {
    sql.exec('PRAGMA foreign_keys=ON');
    for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>/^000[0-9]_.*\.sql$/.test(f)).sort()) sql.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
    class Statement {
      constructor(q,v=[]) {this.q=q;this.v=v;}
      bind(...v) {return new Statement(this.q,v);}
      async all() {return {results:sql.prepare(this.q).all(...this.v)};}
      async first() {return sql.prepare(this.q).get(...this.v)??null;}
      async run() {return {meta:{changes:Number(sql.prepare(this.q).run(...this.v).changes)}};}
    }
    const db={prepare:q=>new Statement(q),batch:async ss=>Promise.all(ss.map(s=>s.all()))};
    sql.exec("INSERT INTO campaigns VALUES('other','Other','test')");
    for(const [id,type,campaign,status,owner] of [['npc','NPC','chronik-von-kleve','draft','gm'],['place','PLACE','chronik-von-kleve','draft','gm'],['scene','SCENE','chronik-von-kleve','draft','gm'],['story','storyline','chronik-von-kleve','draft','gm'],['session','SESSION','chronik-von-kleve','draft','gm'],['secret','NPC','chronik-von-kleve','GM_SECRET','gm'],['foreign','PLACE','other','draft','other'],['own-a','NPC','chronik-von-kleve','draft','player'],['own-b','PLACE','chronik-von-kleve','draft','player']]) {
      sql.prepare('INSERT INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(id,campaign,type,status,owner,'sl','test','test');
      if(campaign==='chronik-von-kleve') sql.prepare('INSERT INTO knowledge(id,campaign_id,entity_id,audience,subject_id,state,granted_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run('grant-'+id,campaign,id,'group',campaign,'DISCOVERED','gm','test','test');
    }
    const gm={id:'gm',campaignId:'chronik-von-kleve',role:'campaign_gm',gm:true,status:'active'},player={...gm,id:'player',role:'player',gm:false};
    const data={sourceId:'npc',targetId:'place',type:'related_to',visibility:'group'};
    const bad=e=>e.status===400,missing=e=>e.status===404,denied=e=>e.status===403;
    for(const patch of [{sourceId:'absent'},{targetId:'absent'},{targetId:'foreign'},{targetId:'npc'},{type:'invented'}]) await assert.rejects(createRelationship(db,gm,{...data,...patch}),bad);
    for(const type of coreRelationshipTypeSchema.options) {
      const r=await createRelationship(db,gm,{...data,type});
      assert.equal((await readRelationships(db,player,'npc',r.id))[0].type,type);
      await deleteRelationship(db,gm,r.id);
    }
    for(const targetId of ['scene','story','session']) await createRelationship(db,gm,{...data,targetId});
    const secretRel=await createRelationship(db,gm,{...data,targetId:'secret'});
    const slRel=await createRelationship(db,gm,{...data,visibility:'sl'});
    const privateRel=await createRelationship(db,gm,{...data,visibility:'private'});
    assert.ok((await readRelationships(db,gm,'npc')).some(r=>r.id===secretRel.id));
    for(const id of [secretRel.id,slRel.id,privateRel.id]) await assert.rejects(readRelationships(db,player,'npc',id),missing);
    await assert.rejects(readRelationships(db,player,'foreign'),missing);
    await assert.rejects(createRelationship(db,player,data),denied);
    await assert.rejects(createRelationship(db,{...player,gm:true},data),denied);
    await assert.rejects(deleteRelationship(db,player,slRel.id),denied);
    await assert.rejects(readRelationships(db,{...player,status:'blocked'},'npc'),denied);
    sql.exec("INSERT INTO relationships VALUES('legacy','chronik-von-kleve','npc','place','location.contains','group','test'); INSERT INTO relationships VALUES('private-owned','chronik-von-kleve','own-a','own-b','legacy.social','private','test')");
    assert.equal((await readRelationships(db,player,'npc','legacy'))[0].type,'location.contains');
    sql.exec("UPDATE knowledge SET state='UNKNOWN' WHERE entity_id='place'");
    await assert.rejects(readRelationships(db,player,'npc','legacy'),missing);
    sql.exec("UPDATE knowledge SET state='DISCOVERED' WHERE entity_id='place'");
    assert.equal((await readRelationships(db,player,'own-a','private-owned'))[0].type,'legacy.social');
    assert.throws(()=>sql.exec("INSERT INTO relationships VALUES('bad','chronik-von-kleve','npc','foreign','related_to','sl','test')"));
    assert.throws(()=>sql.exec("INSERT INTO relationships VALUES('bad','chronik-von-kleve','absent','place','related_to','sl','test')"));
    await deleteRelationship(db,gm,'legacy');
    assert.equal(sql.prepare('SELECT count(*) n FROM entities').get().n,9);
    assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[]);
  } finally {sql.close();}
});
