import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { canonStatusSchema, storedCanonStatusSchema, playStateSchema, entityTypeSchema } from '../domain/types.ts';
import { resolveEntity, projectEntity } from '../server/entities.ts';

test('M1 domains distinguish core status from protected legacy values', () => {
  assert.deepEqual(canonStatusSchema.options, ['draft','open','confirmed','replaced']);
  assert.equal(entityTypeSchema.parse('storyline'), 'storyline');
  assert.equal(canonStatusSchema.safeParse('GM_SECRET').success, false);
  assert.equal(storedCanonStatusSchema.parse('GM_SECRET'), 'GM_SECRET');
  for (const state of ['unplayed','played','historical']) assert.equal(playStateSchema.parse(state), state);
  assert.equal(playStateSchema.safeParse('active').success, false);
});

test('M1 additive migration preserves rows and enforces stable campaign references', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys=ON');
    for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(f=>/^000[0-7]_.*\.sql$/.test(f)).sort())
      db.exec(readFileSync(new URL('../drizzle/'+file, import.meta.url),'utf8'));
    db.exec("INSERT INTO campaigns VALUES ('other','Other','test')");
    const insert = (id, campaign='chronik-von-kleve', status='draft', state=null, replacement=null) =>
      db.prepare('INSERT INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,title,content,gm_body,version,created_at,updated_at,play_state,replaced_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,campaign,'storyline',status,'gm','sl','Title','{}','SECRET',1,'test','test',state,replacement);
    db.exec("INSERT INTO entities(id,campaign_id,type,canon_status,owner_id,created_at,updated_at) VALUES('secret','chronik-von-kleve','NPC','GM_SECRET','gm','test','test')");
    const before = db.prepare('SELECT * FROM entities').all().map(row=>({...row}));
    db.exec(readFileSync(new URL('../drizzle/0008_m1_entity_foundation.sql', import.meta.url),'utf8'));
    assert.deepEqual(db.prepare('SELECT * FROM entities').all().map(({play_state,replaced_by,...row})=>row), before);
    for (const status of canonStatusSchema.options) insert(status);
    insert('foreign','other');
    insert('source','chronik-von-kleve','replaced','historical','confirmed');
    assert.throws(()=>insert('bad-state','chronik-von-kleve','draft','invalid'));
    assert.throws(()=>insert('bad-status','chronik-von-kleve','invalid'));
    assert.throws(()=>insert('cross','chronik-von-kleve','draft',null,'foreign'));
    assert.throws(()=>insert('missing','chronik-von-kleve','draft',null,'absent'));
    assert.throws(()=>db.exec("UPDATE entities SET replaced_by='source' WHERE id='source'"));
    assert.throws(()=>db.exec("DELETE FROM entities WHERE id='confirmed'"));
    assert.throws(()=>db.exec("UPDATE entities SET replaced_by='foreign' WHERE id='source'"));
    const entity=resolveEntity(db.prepare("SELECT * FROM entities WHERE id='source'").get());
    assert.equal(entity.replacedBy,'confirmed');
    assert.equal(entity.playState,'historical');
    const player={id:'player',campaignId:'chronik-von-kleve',gm:false,status:'active',role:'player'};
    const projected=projectEntity(player,entity,[{entity_id:'source',audience:'group',subject_id:player.campaignId,state:'DISCOVERED'}]);
    assert.ok(projected);
    assert.equal('replacedBy' in projected,false);
    assert.equal(db.prepare("SELECT canon_status FROM entities WHERE id='secret'").get().canon_status,'GM_SECRET');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { db.close(); }
});
