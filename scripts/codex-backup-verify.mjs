import {readdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve('.local-work/codex-release-20261010');
const restored=join(root,'restore-check/codex-all'),source=resolve('.local-work/codex-all');
const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(p,e.name)):[join(p,e.name)]);
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const manifest=[];
for(const file of walk(restored)){
 const path=relative(restored,file),sha256=hash(file);
 // The audit is historical run evidence; a subsequent fresh test may update
 // only its timestamps. All original/prepared source files must match exactly.
 if(path!=='import-audit.json')assert.equal(hash(join(source,path)),sha256,path);
 manifest.push({path,bytes:statSync(file).size,sha256});
}
writeFileSync(root+'/private-backup-manifest.json',JSON.stringify(manifest,null,2),{flag:'wx'});
console.log(JSON.stringify({restoredFiles:manifest.length,bytes:manifest.reduce((n,f)=>n+f.bytes,0),allSourceHashesMatch:true,archiveSHA256:'92ad5edabfec5be4e3beb421fca03ad39dde5fe51f750d210d3de16d3e2ec21b',backupSHA256:hash(root+'/production-B0.sql')}));
