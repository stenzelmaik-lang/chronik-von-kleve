// GE-02 release rollback aid. Only needed if the Worker is rolled back to a build older than GE-02 AND scenes were saved
// with structured checks; older builds parse scenes strictly and would answer such scenes (and the scene list) with 409.
// Reads a JSON export (`wrangler d1 execute DB --remote --json --command "SELECT id,campaign_id,version,gm_body FROM entities
// WHERE type='SCENE' AND gm_body LIKE '%\"check\":{%'"`) and WRITES SQL ONLY. It never connects to a database.
// Usage: node --experimental-strip-types scripts/ge02-rollback-scene-checks.mjs export.json > rollback.sql
import {readFileSync} from 'node:fs';
import {sceneWithoutStructuredChecks} from '../domain/story-scene.ts';
const file=process.argv[2];if(!file){console.error('Pfad zur JSON-Ausgabe von wrangler d1 execute --json angeben.');process.exit(2);}
const parsed=JSON.parse(readFileSync(file,'utf8')),rows=(Array.isArray(parsed)?parsed.flatMap(r=>r.results||[r]):parsed.results||[]).filter(r=>r&&r.id&&r.gm_body);
const quote=v=>"'"+String(v).replace(/'/g,"''")+"'";let total=0;
console.log('-- GE-02 rollback: structured checks back to free text. Review before running; version-guarded.');
for(const row of rows){
 let doc;try{doc=JSON.parse(row.gm_body);}catch{console.log('-- skipped (invalid JSON): '+row.id);continue;}
 const {document,changed}=sceneWithoutStructuredChecks(doc);if(!changed)continue;total+=changed;
 console.log(`UPDATE entities SET gm_body=${quote(JSON.stringify(document))},version=version+1 WHERE id=${quote(row.id)} AND campaign_id=${quote(row.campaign_id)} AND version=${Number(row.version)};`);
}
console.log(`-- ${total} structured check(s) in ${rows.length} scene row(s) examined.`);
