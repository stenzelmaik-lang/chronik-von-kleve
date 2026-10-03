import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {npcSaveSchema,npcProfilePatch} from '../domain/npc-authoring.ts';
import {readNPCDraft,saveNPC} from '../server/npc-authoring.ts';
import {loadEntities,projectEntity} from '../server/entities.ts';
import {readContentBlocks,writeContentBlock} from '../server/content-blocks.ts';
const gm={id:'gm',campaignId:'chronik-von-kleve',role:'campaign_gm',gm:true,status:'active'},player={...gm,id:'a',gm:false,role:'player'};
const base=()=>({title:'NPC original',canonStatus:'draft',playState:'unplayed',defaultVisibility:'player_visible',profile:{alias:'Alias',summary:'Kurzprofil'},blocks:[{kind:'bio',content:'PUBLIC',visibility:'player_visible',position:0},{kind:'motivation',content:'SECRET',visibility:'sl_secret',position:1}],retainedRelationships:[],addedRelationships:[]});
function database(){
  const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
  const journal=JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8'));
  for(const {tag} of journal.entries)sql.exec(readFileSync('drizzle/'+tag+'.sql','utf8'));
  class Statement{
    constructor(q,args=[]){this.q=q;this.args=args;}
    bind(...args){return new Statement(this.q,args);}
    async first(column){const row=sql.prepare(this.q).get(...this.args)??null;return column&&row?row[column]:row;}
    async all(){const results=sql.prepare(this.q).all(...this.args);return {results,meta:{changes:sql.prepare('SELECT changes() n').get().n}};}
    async run(){return {meta:{changes:Number(sql.prepare(this.q).run(...this.args).changes)}};}
  }
  const db={prepare:q=>new Statement(q),batch:async rows=>{sql.exec('BEGIN');try{const result=[];for(const row of rows)result.push(await row.all());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
  return {sql,db};
}
const payload=d=>({...base(),id:d.entity.id,revision:d.revision,title:d.entity.title,canonStatus:d.entity.canonStatus,playState:d.entity.playState,defaultVisibility:d.entity.defaultVisibility,blocks:d.blocks.map(({entityId,...b})=>b),retainedRelationships:d.relationships.map(r=>r.id)});
test('NPC authoring creates M1 originals, updates stable blocks, sorts, deletes and preserves secrets',async()=>{
  const {sql,db}=database();try{
    const saved=await saveNPC(db,gm,base());
    assert.equal(sql.prepare('SELECT count(*) n FROM records').get().n,0);
    const draft=await readNPCDraft(db,gm,saved.id);assert.equal(draft.blocks.length,2);
    const edit=payload(draft);edit.title='Edited';edit.playState='played';edit.profile.alias='Changed';edit.blocks.reverse().forEach((b,i)=>{b.position=i;});edit.blocks[1].content='PUBLIC_EDITED';
    await saveNPC(db,gm,edit);
    const next=await readNPCDraft(db,gm,saved.id);assert.equal(next.entity.title,'Edited');assert.equal(next.entity.playState,'played');assert.equal(next.blocks[1].id,draft.blocks[0].id);assert.equal(next.blocks[0].visibility,'sl_secret');
    assert.deepEqual((await readContentBlocks(db,player,saved.id)).map(b=>b.content),['PUBLIC_EDITED']);
    const remove=payload(next);remove.blocks=[remove.blocks[1]];await saveNPC(db,gm,remove);
    assert.equal((await readNPCDraft(db,gm,saved.id)).blocks.length,1);
    assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[]);
  }finally{sql.close();}
});
test('NPC revision protects edits made through existing APIs; failed batch rolls everything back',async()=>{
  const {sql,db}=database();try{
    const {id}=await saveNPC(db,gm,base()),draft=await readNPCDraft(db,gm,id);
    const {id:blockId,...b}=draft.blocks[0];await writeContentBlock(db,gm,{...b,content:'Concurrent'},blockId);
    await assert.rejects(saveNPC(db,gm,payload(draft)),e=>e.status===409);
    const before=sql.prepare('SELECT * FROM entities ORDER BY id').all();
    sql.exec("CREATE TRIGGER fail_npc_block BEFORE INSERT ON entity_content_blocks WHEN NEW.content='FAIL' BEGIN SELECT RAISE(ABORT,'isolated failure'); END;");
    const broken=base();broken.blocks[0].content='FAIL';await assert.rejects(saveNPC(db,gm,broken));
    assert.deepEqual(sql.prepare('SELECT * FROM entities ORDER BY id').all(),before);
    const fresh=await readNPCDraft(db,gm,id),brokenUpdate=payload(fresh);brokenUpdate.title='MUST_ROLL_BACK';brokenUpdate.blocks.push({kind:'bio',content:'FAIL',visibility:'sl_secret',position:3});
    await assert.rejects(saveNPC(db,gm,brokenUpdate));assert.equal((await readNPCDraft(db,gm,id)).entity.title,fresh.entity.title);
  }finally{sql.close();}
});
test('NPC authoring enforces campaign, role, self-reference and existing block ownership',async()=>{
  const {sql,db}=database();try{
    const {id}=await saveNPC(db,gm,base());
    for(const actor of [player,{...player,gm:true},{...gm,status:'blocked'},{...gm,role:'campaign_editor'}]){
      await assert.rejects(readNPCDraft(db,actor,id),e=>e.status===403);await assert.rejects(saveNPC(db,actor,base()),e=>e.status===403);
    }
    sql.exec("INSERT INTO campaigns VALUES('other','Other','test');INSERT INTO entities(id,campaign_id,type,owner_id,created_at,updated_at) VALUES('foreign','other','NPC','gm','test','test');");
    const d=payload(await readNPCDraft(db,gm,id));
    for(const targetId of ['foreign','missing',id])await assert.rejects(saveNPC(db,gm,{...d,addedRelationships:[{targetId,type:'related_to',visibility:'group'}]}),e=>e.status===400);
    await assert.rejects(saveNPC(db,gm,{...d,blocks:[{...d.blocks[0],id:'foreign-block'}]}),e=>e.status===400);
    await assert.rejects(readNPCDraft(db,{...gm,campaignId:'other'},id),e=>e.status===404);
  }finally{sql.close();}
});
test('Final transactional guard catches a concurrent block edit without deleting or overwriting anything',async()=>{
  const {sql,db}=database();try{
    const {id}=await saveNPC(db,gm,base()),draft=await readNPCDraft(db,gm,id),edit=payload(draft);
    edit.title='STALE TITLE';edit.blocks=[];
    const batch=db.batch;
    db.batch=async rows=>{
      if(rows[0].q.startsWith('UPDATE entities SET title'))sql.prepare('UPDATE entity_content_blocks SET content=? WHERE id=?').run('Concurrent immediately before transaction',draft.blocks[0].id);
      return batch(rows);
    };
    await assert.rejects(saveNPC(db,gm,edit),e=>e.status===409);
    assert.equal(sql.prepare('SELECT title FROM entities WHERE id=?').get(id).title,'NPC original');
    assert.equal(sql.prepare('SELECT count(*) n FROM entity_content_blocks WHERE entity_id=?').get(id).n,2);
    assert.equal(sql.prepare('SELECT count(*) n FROM world_events WHERE entity_id=?').get(id).n,1);
  }finally{sql.close();}
});
test('Legacy NPC keeps original ID, untouched legacy row and unrelated content on Entity-only edits',async()=>{
  const {sql,db}=database();try{
    sql.prepare("INSERT INTO records(id,campaign_id,owner_id,kind,visibility,title,body,gm_body,created_at,updated_at) VALUES('legacy',?,'gm','nscs','group','Old',?,'LEGACY_SECRET','test','test')").run(gm.campaignId,JSON.stringify({alias:'Old alias',text:'Untouched biography',clan:'Tremere',opaque:{keep:true}}));
    const before=sql.prepare("SELECT * FROM records WHERE id='legacy'").get(),draft=await readNPCDraft(db,gm,'legacy');
    await saveNPC(db,gm,{...payload(draft),title:'M1 title',profile:{alias:'M1 alias'},defaultVisibility:null});
    const entity=(await loadEntities(db,gm.campaignId,'legacy'))[0];assert.equal(entity.id,'legacy');assert.equal(entity.title,'M1 title');assert.equal(entity.content.alias,'M1 alias');assert.equal(entity.content.text,'Untouched biography');assert.deepEqual(entity.content.opaque,{keep:true});assert.equal(entity.gmBody,'LEGACY_SECRET');
    assert.deepEqual(sql.prepare("SELECT * FROM records WHERE id='legacy'").get(),before);assert.equal(projectEntity(player,entity,[]).content.alias,'M1 alias');
    assert.equal(sql.prepare('SELECT count(*) n FROM entities').get().n,1);
    const again=payload(await readNPCDraft(db,gm,'legacy'));again.defaultVisibility='sl_secret';await saveNPC(db,gm,again);assert.equal(projectEntity(player,(await loadEntities(db,gm.campaignId,'legacy'))[0],[]),null);
  }finally{sql.close();}
});
test('Existing Legacy relationships survive while explicit removal uses same relationships table',async()=>{
  const {sql,db}=database();try{
    const {id}=await saveNPC(db,gm,base()),target=(await saveNPC(db,gm,{...base(),blocks:[]})).id;
    sql.prepare("INSERT INTO relationships(id,campaign_id,source_id,target_id,type,visibility,created_at) VALUES('legacy-rel',?,?,?,'ALLY','group','test')").run(gm.campaignId,id,target);
    const d=payload(await readNPCDraft(db,gm,id));d.addedRelationships=[{targetId:target,type:'related_to',visibility:'sl'}];await saveNPC(db,gm,d);
    const next=await readNPCDraft(db,gm,id);assert.equal(next.relationships.length,2);assert.equal(next.relationships.find(r=>r.id==='legacy-rel').type,'ALLY');
    const remove=payload(next);remove.retainedRelationships=['legacy-rel'];await saveNPC(db,gm,remove);assert.equal((await readNPCDraft(db,gm,id)).relationships.length,1);
  }finally{sql.close();}
});
test('NPC payload disallows parallel model, owner/campaign injection, invalid profile and duplicate IDs',()=>{
  assert.ok(npcSaveSchema.safeParse(base()).success);
  for(const patch of [{campaignId:'foreign'},{type:'PLACE'},{ownerId:'a'},{profile:{image:'https://example.com/image.jpg'}},{profile:{newRequiredField:'x'}},{title:''},{blocks:[{...base().blocks[0],id:'x'},{...base().blocks[1],id:'x'}]}])assert.equal(npcSaveSchema.safeParse({...base(),...patch}).success,false);
});
test('Profile saves only explicit changes and does not migrate untouched legacy values',()=>{
  const old={alias:'Legacy alias',summary:'Unchanged legacy profile',image:'unsupported-old-reference'};
  assert.deepEqual(npcProfilePatch({...old,alias:'New alias'},old),{alias:'New alias'});
  assert.deepEqual(npcProfilePatch(old,old),{});
  assert.ok(npcSaveSchema.safeParse({...base(),profile:npcProfilePatch(old,old)}).success);
});
