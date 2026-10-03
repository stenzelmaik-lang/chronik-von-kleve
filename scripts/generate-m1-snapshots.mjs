// Mechanical snapshot generation from drizzle-kit output; no database access.
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const final=JSON.parse(readFileSync('work/m1-snapshot-source/meta/0000_snapshot.json','utf8'));
let prevId=JSON.parse(readFileSync('drizzle/meta/0007_snapshot.json','utf8')).id;
for(const idx of [8,9,10]) {
  const snapshot=structuredClone(final);
  snapshot.id=randomUUID(); snapshot.prevId=prevId;
  if(idx<10) {delete snapshot.tables.entities.columns.default_visibility;delete snapshot.tables.entities.checkConstraints.entities_default_visibility_check;}
  if(idx<9) delete snapshot.tables.entity_content_blocks;
  writeFileSync(`drizzle/meta/${String(idx).padStart(4,'0')}_snapshot.json`,JSON.stringify(snapshot,null,2)+'\n');
  prevId=snapshot.id;
}
