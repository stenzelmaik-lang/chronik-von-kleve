import {spawnSync,spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdirSync,readdirSync,readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {dirname,join,relative,resolve} from 'node:path';
import {createServer} from 'node:http';
import {Log,Miniflare} from 'miniflare';

// Isolated local test worker: never reuse .wrangler production/preview state.
const state=join(tmpdir(),'cvk-phase-c-tests-'+randomUUID());mkdirSync(state,{recursive:true});
const cli='node_modules/wrangler/bin/wrangler.js',config='dist/server/wrangler.json';
const env={...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG:'error',WRANGLER_LOG_PATH:join(state,'wrangler.log'),CVK_TEST_URL:'http://127.0.0.1:8793',CVK_TEST_STATE:state};
for(const migration of ['drizzle/0000_aromatic_network.sql','drizzle/0001_purple_blockbuster.sql','drizzle/0002_thick_mister_fear.sql','drizzle/0003_careful_leech.sql','drizzle/0004_role_membership_foundation.sql','drizzle/0005_phase_c_editorial_revisions.sql']){
 const result=spawnSync(process.execPath,[cli,'d1','execute','DB','--local','--persist-to',state,'--config',config,'--file',migration],{env,encoding:'utf8',windowsHide:true});
 if(result.status!==0)throw new Error('Local migration failed: '+result.stderr);
}

const wrangler=JSON.parse(readFileSync(config,'utf8'));
const serverRoot=resolve(dirname(config));
function findModules(directory){
 return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const path=join(directory,entry.name);
  return entry.isDirectory()?findModules(path):/\.m?js$/.test(entry.name)?[path]:[];
 });
}
const moduleFiles=findModules(serverRoot).map(path=>relative(serverRoot,path).replaceAll('\\','/'));
const entry=relative(serverRoot,resolve(serverRoot,wrangler.main)).replaceAll('\\','/');
const modules=[{type:'ESModule',path:resolve(serverRoot,entry)},...moduleFiles.filter(path=>path!==entry).map(path=>({type:'ESModule',path:resolve(serverRoot,path)}))];
const mf=new Miniflare({
 name:wrangler.name,
 modules,
 modulesRoot:serverRoot,
 compatibilityDate:wrangler.compatibility_date,
 compatibilityFlags:wrangler.compatibility_flags,
 bindings:{...wrangler.vars,GM_EMAIL:'gm@sprint.invalid'},
 d1Databases:Object.fromEntries(wrangler.d1_databases.map(binding=>[binding.binding,binding.database_id])),
 r2Buckets:Object.fromEntries(wrangler.r2_buckets.map(binding=>[binding.binding,binding.bucket_name])),
 assets:{directory:resolve(dirname(config),wrangler.assets.directory),binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},
 d1Persist:join(state,'v3','d1'),
 r2Persist:false,
 log:new Log('ERROR'),
});
let server;
let localDb;
try{
 localDb=await mf.getD1Database('DB');
 const schema=await localDb.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='entity_revision_releases'").first();
 if(schema?.n!==1)throw new Error('The direct local Worker did not open the migrated isolated Test-D1 with migration 0005.');
 server=createServer(async(req,res)=>{
  try{
   const headers=new Headers();
   for(const [key,value] of Object.entries(req.headers))if(typeof value==='string')headers.set(key,value);
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const body=chunks.length?Buffer.concat(chunks):undefined;
   const url=`http://${req.headers.host||'127.0.0.1:8793'}${req.url||'/'}`;
   const response=await mf.dispatchFetch(url,{method:req.method,headers,body});
   res.statusCode=response.status;
   response.headers.forEach((value,key)=>res.setHeader(key,value));
   res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){res.statusCode=500;res.end(String(error));}
 });
 await new Promise((resolveReady,reject)=>{server.once('error',reject);server.listen(8793,'127.0.0.1',resolveReady)});
 let ready=false,lastHealth='no response';
 for(let attempt=0;attempt<60;attempt++){
  try{const response=await fetch(env.CVK_TEST_URL+'/api/members');ready=response.status===401;if(!ready)lastHealth=`HTTP ${response.status}: ${(await response.text()).slice(0,300)}`}catch(error){lastHealth=String(error)}
  if(ready)break;
  await new Promise(resolveWait=>setTimeout(resolveWait,250));
 }
 if(!ready)throw new Error('Local Miniflare Worker did not become ready: '+lastHealth);
 const suite=spawn(process.execPath,['tests/integration.mjs'],{env,stdio:'inherit',windowsHide:true});
 const [code]=await once(suite,'exit');
 process.exitCode=code??1;
 if(process.exitCode===0){
  const atomicKey='phase-c-atomic-'+randomUUID();let rejected=false;
  try{await localDb.batch([
   localDb.prepare('INSERT INTO settings(key,value) VALUES(?,?)').bind(atomicKey,'must roll back'),
   localDb.prepare("INSERT INTO platform_roles(user_id,role,status,granted_by,created_at,updated_at,version) VALUES('nobody','invalid-role','active','test','now','now',1)"),
  ]);}catch{rejected=true;}
  assert.ok(rejected,'A failing D1 batch must reject');
  const partial=await localDb.prepare('SELECT value FROM settings WHERE key=?').bind(atomicKey).first();
  assert.equal(partial,null,'D1 batch failure rolls back earlier statements atomically');
  console.log('PASS isolated Test-D1 atomic batch rollback');
 }
}finally{
 if(server)await new Promise(resolveClose=>server.close(()=>resolveClose()));
 await mf.dispose();
}
if(process.exitCode===0){
 // Role backfill tests need a genuinely empty migrated database. Reusing the
 // integration DB would correctly report conflicts from its active test users.
 const roleState=join(tmpdir(),'cvk-phase-c-tests-'+randomUUID());mkdirSync(roleState,{recursive:true});
 const roleEnv={...env,CVK_TEST_STATE:roleState,WRANGLER_LOG_PATH:join(roleState,'wrangler.log')};
 for(const migration of ['drizzle/0000_aromatic_network.sql','drizzle/0001_purple_blockbuster.sql','drizzle/0002_thick_mister_fear.sql','drizzle/0003_careful_leech.sql','drizzle/0004_role_membership_foundation.sql']){
  const result=spawnSync(process.execPath,[cli,'d1','execute','DB','--local','--persist-to',roleState,'--config',config,'--file',migration],{env:roleEnv,encoding:'utf8',windowsHide:true});
  if(result.status!==0)throw new Error('Role foundation isolated migration failed: '+result.stderr);
 }
 const maintenance=spawnSync(process.execPath,['--experimental-strip-types','tests/role-foundation-local.mjs'],{env:roleEnv,stdio:'inherit',windowsHide:true});
 if(maintenance.status!==0)process.exitCode=maintenance.status??1;
}
