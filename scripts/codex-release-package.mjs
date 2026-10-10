// Build a PRIVATE release package using the SAME validated importer. No network,
// production binding, account changes or writes to the read-only production copy.
import {DatabaseSync} from 'node:sqlite';
import {importCodexSources} from './codex-import.mjs';
import {CODEX_PRE_ALPHA_DECISION} from '../domain/codex.ts';
import {readFileSync,writeFileSync,readdirSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const playerPublication=process.argv.includes('--players-pre-alpha');
const root=resolve(playerPublication?'.local-work/codex-player-release-20261010':'.local-work/codex-release-20261010'),sources=resolve('.local-work/codex-all');
mkdirSync(root,{recursive:true});
assert.ok(!existsSync(root+'/books-staged.sql'),'Preserve an existing release package.');
const sql=new DatabaseSync(resolve('.local-work/codex-release-20261010/production-copy-v2.sqlite'),{readOnly:true});
const pano=sql.prepare("SELECT m.id FROM members m JOIN campaign_memberships cm ON cm.user_id=m.id WHERE lower(m.name)='pano' AND cm.role IN ('campaign_owner','campaign_gm') AND cm.status='active' AND cm.campaign_id='chronik-von-kleve'").all();
assert.equal(pano.length,1,'Unambiguous existing SL owner required.');
const hash=v=>createHash('sha256').update(v).digest('hex');
const encode=v=>v===null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
const stage=[],activate=[],assets=[];
function record(q,v){
 if(q.startsWith('INSERT INTO entities')){const c=JSON.parse(v[3]);c.playerReleased=false;v=[...v];v[3]=JSON.stringify(c);}
 if(playerPublication&&q.startsWith('UPDATE entities SET content=json_set')){q=q.replace("json('true'))","json('true'),'$.playerReleased',json('true'),'$.releaseActor',?,'$.releaseChangedAt',?)");v=[pano[0].id,new Date().toISOString(),...v];}
 let i=0;const line=q.replaceAll('?',()=>encode(v[i++]))+';';assert.equal(i,v.length);
 (q.startsWith('UPDATE entities SET content=json_set')?activate:stage).push(line);
 return {meta:{changes:1}};
}
class Statement{
 constructor(q,v=[]){this.q=q;this.v=v;}
 bind(...v){return new Statement(this.q,v);}
 async first(){return sql.prepare(this.q).get(...this.v)??null;}
 async all(){return {results:sql.prepare(this.q).all(...this.v)};}
 async run(){return record(this.q,this.v);}
}
const db={prepare:q=>new Statement(q),batch:async statements=>statements.map(s=>record(s.q,s.v))};
const bucket={put:async(key,data)=>{assert.ok(key.startsWith('codex-originals/')||key.startsWith('codex-pages/'));assets.push({key,bytes:data.byteLength,sha256:hash(data)});}};
try{
 const audit=await importCodexSources({db,bucket,base:'http://127.0.0.1:8804',root:sources,owner:pano[0].id,...(playerPublication?{playerAccessDecision:CODEX_PRE_ALPHA_DECISION}:{})});
 const inventory=JSON.parse(readFileSync('tests/fixtures/codex-inventory.json'));
 const originalMap=new Map(readdirSync(sources+'/sources').map(name=>{const path=join(sources,'sources',name);return [hash(readFileSync(path)),path];}));
 for(const a of assets){
  if(a.key.startsWith('codex-originals/'))a.file=originalMap.get(a.sha256);
  else{const [,bookHash,file]=a.key.split('/'),book=audit.find(b=>b.hash===bookHash);assert.ok(book);const source=inventory.find(b=>b.title===book.title);assert.ok(source);a.file=join(sources,'prepared',source.sourceId+(source.format==='PDF'?'':'-facsimile'),file);}
  assert.ok(a.file&&existsSync(a.file));assert.equal(hash(readFileSync(a.file)),a.sha256);
 }
 assert.equal(audit.length,15);assert.equal(activate.length,15);
 writeFileSync(root+'/books-staged.sql',stage.join('\n'),{flag:'wx'});
 writeFileSync(root+'/books-activate-after-assets.sql',activate.join('\n'),{flag:'wx'});
 writeFileSync(root+'/r2-private-assets.json',JSON.stringify(assets,null,2),{flag:'wx'});
 writeFileSync(root+'/release-package-summary.json',JSON.stringify({books:15,assets:assets.length,stagedStatements:stage.length,activationStatements:activate.length,allPlayerReleases:playerPublication,...(playerPublication?{operatorDecision:CODEX_PRE_ALPHA_DECISION,licencesConfirmed:false}:{}),stageSHA256:hash(stage.join('\n')),activationSHA256:hash(activate.join('\n')),manifestSHA256:hash(JSON.stringify(assets,null,2)),productionWrites:false},null,2),{flag:'wx'});
 console.log('Private release package ready; player activation '+(playerPublication?'prepared separately, operator decision only':'closed')+'; no production writes.');
}finally{sql.close();}
