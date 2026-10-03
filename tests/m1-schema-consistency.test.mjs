import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

test('M1 journal snapshots and applied SQL agree on columns, defaults and foreign keys',()=>{
  const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
  const journal=read('drizzle/meta/_journal.json');
  const db=new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys=ON');
    let previous=read('drizzle/meta/0007_snapshot.json').id;
    for(const entry of journal.entries) {
      db.exec(readFileSync(new URL('../drizzle/'+entry.tag+'.sql',import.meta.url),'utf8'));
      if(entry.idx<8) continue;
      const snapshot=read('drizzle/meta/'+String(entry.idx).padStart(4,'0')+'_snapshot.json');
      assert.equal(snapshot.prevId,previous);previous=snapshot.id;
      for(const table of ['entities',...(entry.idx>=9?['entity_content_blocks']:[])]) {
        const actual=db.prepare(`PRAGMA table_info('${table}')`).all();
        assert.deepEqual(actual.map(c=>c.name).sort(),Object.keys(snapshot.tables[table].columns).sort());
        for(const c of actual) {
          const column=snapshot.tables[table].columns[c.name];
          assert.equal(c.type.toLowerCase(),column.type);
          assert.equal(!!c.notnull,column.notNull);
          assert.equal(c.dflt_value,column.default===undefined?null:String(column.default));
        }
        const expected=Object.values(snapshot.tables[table].foreignKeys).flatMap(f=>f.columnsFrom.map((from,i)=>[from,f.tableTo,f.columnsTo[i],f.onDelete??'no action'].join('|').toLowerCase())).sort();
        const foreign=db.prepare(`PRAGMA foreign_key_list('${table}')`).all().map(f=>[f.from,f.table,f.to,f.on_delete].join('|').toLowerCase()).sort();
        assert.deepEqual(foreign,expected);
      }
    }
    assert.throws(()=>db.exec("INSERT INTO entities(id,type,owner_id,created_at,updated_at,default_visibility) VALUES('bad','NPC','gm','test','test','group')"));
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  } finally {db.close();}
});
