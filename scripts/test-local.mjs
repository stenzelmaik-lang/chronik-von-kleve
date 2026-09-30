import {spawnSync,spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdirSync,readdirSync,readFileSync} from 'node:fs';
import {randomUUID,pbkdf2Sync,randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {dirname,join,relative,resolve} from 'node:path';
import {createServer} from 'node:http';
import {convertV4MiniflareOptions,Log,Miniflare} from 'miniflare';

// Isolated local test worker: never reuse .wrangler production/preview state.
const state=join(tmpdir(),'cvk-phase-c-tests-'+randomUUID());mkdirSync(state,{recursive:true});
const cli='node_modules/wrangler/bin/wrangler.js',config='dist/server/wrangler.json';
const env={...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG:'error',WRANGLER_LOG_PATH:join(state,'wrangler.log'),CVK_TEST_URL:'http://127.0.0.1:8793',CVK_TEST_STATE:state};
const interactive=process.argv.includes('--command-center');
if(interactive)env.CVK_TEST_URL='http://127.0.0.1:8794';
for(const migration of ['drizzle/0000_aromatic_network.sql','drizzle/0001_purple_blockbuster.sql','drizzle/0002_thick_mister_fear.sql','drizzle/0003_careful_leech.sql','drizzle/0004_role_membership_foundation.sql','drizzle/0005_phase_c_editorial_revisions.sql','drizzle/0006_auth_platform.sql']){
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
const mf=new Miniflare(convertV4MiniflareOptions({
 name:wrangler.name,
 modules,
 modulesRoot:serverRoot,
 compatibilityDate:wrangler.compatibility_date,
 compatibilityFlags:wrangler.compatibility_flags,
 bindings:{...wrangler.vars,GM_EMAIL:'gm@sprint.invalid'},
 d1Databases:Object.fromEntries(wrangler.d1_databases.map(binding=>[binding.binding,binding.database_id])),
 r2Buckets:Object.fromEntries(wrangler.r2_buckets.map(binding=>[binding.binding,binding.bucket_name])),
 assets:{directory:resolve(dirname(config),wrangler.assets.directory),binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},
 resourcePersistencePath:join(state,'v3'),
 log:new Log('ERROR'),
}));
let server;
let localDb;
try{
 localDb=await mf.getD1Database('DB');
 const schema=await localDb.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('entity_revision_releases','auth_member_links')").first();
 if(schema?.n!==2)throw new Error('The direct local Worker did not open the migrated isolated Test-D1 with migrations 0005 and 0006.');
 server=createServer(async(req,res)=>{
  try{
   // The direct dispatchFetch bridge bypasses Miniflare's HTTP asset router.
   // Serve only built client chunks here; never project sources or state files.
   const pathname=new URL(req.url||'/', 'http://127.0.0.1:8793').pathname;
   if(pathname.startsWith('/_next/static/')) {
    const clientRoot=resolve('dist/client'),assetPath=resolve(clientRoot,'.'+decodeURIComponent(pathname));
    if(!assetPath.startsWith(clientRoot+'\\')&&!assetPath.startsWith(clientRoot+'/')){res.statusCode=403;return res.end();}
    try{const data=readFileSync(assetPath);res.setHeader('Content-Type',assetPath.endsWith('.js')?'text/javascript':assetPath.endsWith('.css')?'text/css':'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');return res.end(data);}catch{res.statusCode=404;return res.end('Asset not found');}
   }
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
 await new Promise((resolveReady,reject)=>{server.once('error',reject);server.listen(interactive?8794:8793,'127.0.0.1',resolveReady)});
 let ready=false,lastHealth='no response';
 for(let attempt=0;attempt<60;attempt++){
  try{const response=await fetch(env.CVK_TEST_URL+'/api/members');ready=response.status===401;if(!ready)lastHealth=`HTTP ${response.status}: ${(await response.text()).slice(0,300)}`}catch(error){lastHealth=String(error)}
  if(ready)break;
  await new Promise(resolveWait=>setTimeout(resolveWait,250));
 }
 if(!ready)throw new Error('Local Miniflare Worker did not become ready: '+lastHealth);
 if(interactive){
  // Synthetic accounts only in the freshly migrated local database above.
  // Never reused by any production or remote provisioning command.
  const stamp=new Date().toISOString(),salt=randomBytes(16).toString('base64url');
  const digest=pbkdf2Sync('ChroniPlay-Demo-2036!',salt,600000,32,'sha256').toString('base64url');
  for(const [id,name,role] of [['command-gm','Demo Spielleitung','campaign_gm'],['command-a','Demo Spieler A','player'],['command-b','Demo Spieler B','player']]){
   const email=id+'@example.invalid',authId='auth-'+id;
   await localDb.batch([
    localDb.prepare('INSERT INTO members(id,campaign_id,email,name,status,created_at) VALUES(?,?,?,?,?,?)').bind(id,'chronik-von-kleve',email,name,'active',stamp),
    localDb.prepare('INSERT INTO campaign_memberships(campaign_id,user_id,role,status,source,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind('chronik-von-kleve',id,role,'active','manual',stamp,stamp),
    localDb.prepare('INSERT INTO auth_users(id,email,email_normalized,display_name,password_hash,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(authId,email,email,name,'pbkdf2_sha256$600000$'+salt+'$'+digest,stamp,'active',stamp,stamp),
    localDb.prepare('INSERT INTO auth_member_links(auth_user_id,member_id,approved_by,approval_reference,linked_at) VALUES(?,?,?,?,?)').bind(authId,id,'local-test-operator','SYNTHETIC_TEST_DATA',stamp),
   ]);
  }
  const login=await fetch(env.CVK_TEST_URL+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.CVK_TEST_URL},body:JSON.stringify({email:'command-gm@example.invalid',password:'ChroniPlay-Demo-2036!'})});
  if(login.status!==200)throw new Error('Synthetic demo login failed');
  const fixtureCookie=login.headers.get('set-cookie')?.split(';')[0];
  if(!fixtureCookie)throw new Error('Synthetic demo session missing');
  const author=async(path,body)=>{const response=await fetch(env.CVK_TEST_URL+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:env.CVK_TEST_URL,Cookie:fixtureCookie},body:JSON.stringify(body)});if(!response.ok)throw new Error('Synthetic demo authoring failed: '+path+' '+response.status);};
  await author('/api/records',{kind:'sitzungen',title:'SYNTHETISCH – Regieabnahme',visibility:'group',body:{scene:'Lokale Demonstrationsszene',subtitle:'Ausschließlich synthetische Abnahmedaten.',status:'Bereit',log:[]},gmBody:'PRIVATE_QA: Diese Notiz gehört ausschließlich der Spielleitung.'});
  await author('/api/entities',{type:'HANDOUT',title:'SYNTHETISCH – Testhinweis',text:'PLAYER_QA: Gezielter Testhinweis.',gmBody:'PRIVATE_QA: Vertraulicher Handout-Kontext.'});
  const playerLogin=await fetch(env.CVK_TEST_URL+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.CVK_TEST_URL},body:JSON.stringify({email:'command-a@example.invalid',password:'ChroniPlay-Demo-2036!'})});
  const playerCookie=playerLogin.headers.get('set-cookie')?.split(';')[0];
  if(!playerLogin.ok||!playerCookie)throw new Error('Synthetic character owner login failed');
  const characterResponse=await fetch(env.CVK_TEST_URL+'/api/records',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.CVK_TEST_URL,Cookie:playerCookie},body:JSON.stringify({kind:'charaktere',title:'SYNTHETISCH – Regiecharakter A',visibility:'group',body:{player:'Demo Spieler A',clan:'Tremere',generation:10,attributes:{Körperkraft:2,Geschick:3,Widerstandsfähigkeit:2,Charisma:2,Manipulation:2,Erscheinungsbild:2,Wahrnehmung:3,Intelligenz:3,Geistesschärfe:2},disciplines:[{name:'Auspex',value:1}],humanity:7,willpower:5,willpowerTemporary:4,blood:8,bloodMax:13}})});
  if(!characterResponse.ok)throw new Error('Synthetic character authoring failed '+characterResponse.status);
  // Existing accepted reference fixture, only in this fresh isolated local DB.
  await author('/api/locations/migrate',{placeId:'place.electric-taberna'});
  console.log('Isolated application ready: http://127.0.0.1:8794/anmelden · synthetic account command-gm@example.invalid. See local command-center README for demo credentials.');
  await new Promise(resolveStop=>{process.once('SIGINT',resolveStop);process.once('SIGTERM',resolveStop);});
 }else{
  const suite=spawn(process.execPath,['tests/integration.mjs'],{env,stdio:'inherit',windowsHide:true});
  const [code]=await once(suite,'exit');
  process.exitCode=code??1;
 }
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


