import {seedInventoryDemo} from "../tests/fixtures/inventory-demo.mjs";
import {seedSilasNPC} from '../tests/fixtures/silas-npc.mjs';
import {seedCodex} from '../tests/fixtures/codex-demo.mjs';
import {seedLocationAreaDemo} from '../tests/fixtures/location-area-demo.mjs';
import {seedSpieltischKaserne} from '../tests/fixtures/spieltisch-kaserne.mjs';
import {importCodexSources} from './codex-import.mjs';
import {CODEX_PRE_ALPHA_DECISION} from '../domain/codex.ts';
import {engineFixture} from "../tests/fixtures/engine-character.mjs";
import {spawnSync,spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash,randomUUID,pbkdf2Sync,randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {dirname,join,relative,resolve} from 'node:path';
import {createServer} from 'node:http';
import {convertV4MiniflareOptions,Log,Miniflare} from 'miniflare';

// Isolated local resources only. --weekend preserves synthetic acceptance
// data across restarts; the full regression suite always uses a fresh store.
const inventoryDemo=process.argv.includes('--inventory');
const stageReleaseTest=process.argv.includes('--spieltisch-release');
const accessDemo=process.argv.includes('--access-alpha');
const storyWork=process.argv.includes('--story-workspace');
const characterThree=process.argv.includes('--charakter-3');
// Zustandswerte am Spieltisch: Spieltisch-Fixture plus bestätigte Charaktere für Spieler A und B.
const vitalsDemo=process.argv.includes('--zustandswerte');
const commandDemo=process.argv.includes('--command-center-2')||characterThree||vitalsDemo;
const stageDemo=process.argv.includes('--spieltisch-2')||vitalsDemo;
const npcDemo=process.argv.includes('--npc-detail');
const areaDemo=process.argv.includes('--location-areas');
const codexPlayers=process.argv.includes('--codex-players');
const codexAll=process.argv.includes('--codex-all')||codexPlayers;
const codexDemo=process.argv.includes('--codex')||codexAll;
const interactive=stageDemo||stageReleaseTest||areaDemo||codexDemo||npcDemo||storyWork||commandDemo||process.argv.includes('--command-center')||process.argv.includes('--weekend')||accessDemo||inventoryDemo;
const preserve=storyWork||commandDemo||stageDemo||process.argv.includes('--weekend')||accessDemo||inventoryDemo;
const state=preserve?resolve(storyWork?'.local-work/story-workspace':vitalsDemo?'.local-test/zustandswerte':stageDemo?'.local-test/spieltisch-2':characterThree?'.local-test/charakter-3':commandDemo?'.local-test/command-center-2':inventoryDemo?'.local-test/inventory-2':accessDemo?'.local-test/closed-alpha-access':'.local-test/character-weekend'):join(tmpdir(),'cvk-phase-c-tests-'+randomUUID());
const purpose=storyWork?'persistent-local-authoring':'synthetic-local-weekend';
const marker=join(state,'synthetic-weekend.json');
const migrations=['drizzle/0000_aromatic_network.sql','drizzle/0001_purple_blockbuster.sql','drizzle/0002_thick_mister_fear.sql','drizzle/0003_careful_leech.sql','drizzle/0004_role_membership_foundation.sql','drizzle/0005_phase_c_editorial_revisions.sql','drizzle/0006_auth_platform.sql','drizzle/0007_auth_profiles_closed_alpha.sql'];
const journal=JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8'));
migrations.splice(0,migrations.length,...journal.entries.map(entry=>'drizzle/'+entry.tag+'.sql'));
const fingerprint=createHash('sha256').update(migrations.map(file=>readFileSync(file,'utf8')).join('\n')).digest('hex');
const resumed=preserve&&existsSync(marker);
if(resumed){const saved=JSON.parse(readFileSync(marker,'utf8'));if(saved.purpose!==purpose||saved.migrations!==fingerprint)throw new Error('Local demo store has an incompatible marker. Existing data are preserved; no migration was run.');}
else if(preserve&&existsSync(state)&&readdirSync(state).length)throw new Error('Unmarked local demo store: stop instead of overwriting existing data.');
mkdirSync(state,{recursive:true});
const cli='node_modules/wrangler/bin/wrangler.js',config='dist/server/wrangler.json';
const defaultPort=vitalsDemo?8852:stageDemo?8830:stageReleaseTest?8820:characterThree?8846:codexPlayers?8805:codexDemo?8804:storyWork?8802:commandDemo?8798:inventoryDemo?8796:accessDemo?8795:interactive?8794:8793;
const port=process.env.CVK_TEST_PORT ? Number(process.env.CVK_TEST_PORT) : defaultPort;
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local test port');
if(interactive){const probe=createServer();await new Promise((ok,fail)=>{probe.once('error',()=>fail(new Error('Der lokale Port '+port+' ist bereits belegt. Öffne die laufende Anwendung; kein anderer Prozess wird beendet.')));probe.listen(port,'127.0.0.1',()=>probe.close(ok));});}
const env={...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG:'error',WRANGLER_LOG_PATH:join(state,'wrangler.log'),CVK_TEST_URL:'http://127.0.0.1:'+port,CVK_TEST_STATE:state};
if(!resumed)for(const migration of migrations){
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
 bindings:{...wrangler.vars,GM_EMAIL:'gm@sprint.invalid',AUTH_ACCESS_ENVIRONMENT:'local-test'},
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
    try{const data=readFileSync(assetPath);res.setHeader('Content-Type',/\.m?js$/.test(assetPath)?'text/javascript':assetPath.endsWith('.css')?'text/css':'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');return res.end(data);}catch{res.statusCode=404;return res.end('Asset not found');}
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
 await new Promise((resolveReady,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolveReady)});
 let ready=false,lastHealth='no response';
 for(let attempt=0;attempt<60;attempt++){
  try{const response=await fetch(env.CVK_TEST_URL+'/api/members');ready=response.status===401;if(!ready)lastHealth=`HTTP ${response.status}: ${(await response.text()).slice(0,300)}`}catch(error){lastHealth=String(error)}
  if(ready)break;
  await new Promise(resolveWait=>setTimeout(resolveWait,250));
 }
 if(!ready)throw new Error('Local Miniflare Worker did not become ready: '+lastHealth);
 if(interactive){
  if(!resumed){
  // Synthetic accounts only in the freshly migrated local database above.
  // Never reused by any production or remote provisioning command.
  const stamp=new Date().toISOString(),salt=randomBytes(16).toString('base64url');
  const digest=pbkdf2Sync('ChroniPlay-Demo-2036!',salt,600000,32,'sha256').toString('base64url');
  for(const [id,name,role] of (storyWork?[['command-gm','Lokale Spielleitung','campaign_gm']]:[['command-gm','Demo Spielleitung','campaign_gm'],['command-a','Demo Spieler A','player'],['command-b','Demo Spieler B','player'],...(accessDemo?[['command-admin','Demo Plattformadmin','player']]:[])])){
   const email=id+'@example.invalid',authId='auth-'+id;
   await localDb.batch([
    localDb.prepare('INSERT INTO members(id,campaign_id,email,name,status,created_at) VALUES(?,?,?,?,?,?)').bind(id,'chronik-von-kleve',email,name,'active',stamp),
    localDb.prepare('INSERT INTO campaign_memberships(campaign_id,user_id,role,status,source,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind('chronik-von-kleve',id,role,'active','manual',stamp,stamp),
    localDb.prepare('INSERT INTO auth_users(id,email,email_normalized,display_name,password_hash,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(authId,email,email,name,'pbkdf2_sha256$600000$'+salt+'$'+digest,stamp,'active',stamp,stamp),
    localDb.prepare('INSERT INTO auth_member_links(auth_user_id,member_id,approved_by,approval_reference,linked_at) VALUES(?,?,?,?,?)').bind(authId,id,'local-test-operator','SYNTHETIC_TEST_DATA',stamp),
   ]);
  }
  if(accessDemo)await localDb.prepare("INSERT INTO platform_roles(user_id,role,status,granted_by,created_at,updated_at) VALUES('command-admin','platform_admin','active','synthetic-local-fixture',?,?)").bind(stamp,stamp).run();
  if(!storyWork){
  const login=await fetch(env.CVK_TEST_URL+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.CVK_TEST_URL},body:JSON.stringify({email:'command-gm@example.invalid',password:'ChroniPlay-Demo-2036!'})});
  if(login.status!==200)throw new Error('Synthetic demo login failed');
  const fixtureCookie=login.headers.get('set-cookie')?.split(';')[0];
  if(!fixtureCookie)throw new Error('Synthetic demo session missing');
  const author=async(path,body)=>{const response=await fetch(env.CVK_TEST_URL+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:env.CVK_TEST_URL,Cookie:fixtureCookie},body:JSON.stringify(body)});if(!response.ok)throw new Error('Synthetic demo authoring failed: '+path+' '+response.status);return response.json();};
  await author('/api/records',{kind:'sitzungen',title:'SYNTHETISCH – Regieabnahme',visibility:'group',body:{scene:'Lokale Demonstrationsszene',subtitle:'Ausschließlich synthetische Abnahmedaten.',status:'Bereit',log:[]},gmBody:'PRIVATE_QA: Diese Notiz gehört ausschließlich der Spielleitung.'});
  await author('/api/entities',{type:'HANDOUT',title:'SYNTHETISCH – Testhinweis',text:'PLAYER_QA: Gezielter Testhinweis.',gmBody:'PRIVATE_QA: Vertraulicher Handout-Kontext.'});
  const playerLogin=await fetch(env.CVK_TEST_URL+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.CVK_TEST_URL},body:JSON.stringify({email:'command-a@example.invalid',password:'ChroniPlay-Demo-2036!'})});
  const playerCookie=playerLogin.headers.get('set-cookie')?.split(';')[0];
  if(!playerLogin.ok||!playerCookie)throw new Error('Synthetic character owner login failed');
  const characterResponse=await fetch(env.CVK_TEST_URL+'/api/records',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.CVK_TEST_URL,Cookie:playerCookie},body:JSON.stringify({kind:'charaktere',title:inventoryDemo?'TEST – Nachtläufer A':'SYNTHETISCH – Regiecharakter A',visibility:'group',body:{player:'Demo Spieler A',clan:'Tremere',generation:10,attributes:{Körperkraft:2,Geschick:3,Widerstandsfähigkeit:2,Charisma:2,Manipulation:2,Erscheinungsbild:2,Wahrnehmung:3,Intelligenz:3,Geistesschärfe:2},disciplines:[{name:'Auspex',value:1}],humanity:7,willpower:5,willpowerTemporary:4,blood:8,bloodMax:13}})});
  if(!characterResponse.ok)throw new Error('Synthetic character authoring failed '+characterResponse.status);
  const inventoryCharacterId=(await characterResponse.json()).id;
  if(inventoryDemo)await seedInventoryDemo(env.CVK_TEST_URL,playerCookie,inventoryCharacterId);
  const engineDraft=await fetch(env.CVK_TEST_URL+'/api/records',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.CVK_TEST_URL,Cookie:playerCookie},body:JSON.stringify({kind:'charaktere',title:'SYNTHETISCH – Character Engine A',visibility:'sl',body:{...engineFixture,player:'Demo Spieler A'}})});
  if(!engineDraft.ok)throw new Error('Synthetic engine draft failed '+engineDraft.status);
  const engineId=(await engineDraft.json()).id;
  console.log('Synthetic engine character: '+engineId+'. Draft belongs to Player A and is shared only with SL.');

  // Existing accepted reference fixture, only in this fresh isolated local DB.
  if(!inventoryDemo)await author('/api/locations/migrate',{placeId:'place.electric-taberna'});
  if(npcDemo)await seedSilasNPC({db:localDb,base:env.CVK_TEST_URL,cookie:fixtureCookie,primary:process.argv.find(a=>a.startsWith('--npc-primary='))?.slice('--npc-primary='.length),secondary:process.argv.find(a=>a.startsWith('--npc-secondary='))?.slice('--npc-secondary='.length)});
  if(codexAll){const audit=await importCodexSources({db:localDb,bucket:await mf.getR2Bucket('BUCKET'),base:env.CVK_TEST_URL,root:'.local-work/codex-all',...(codexPlayers?{playerAccessDecision:CODEX_PRE_ALPHA_DECISION}:{})});writeFileSync(codexPlayers?join(state,'codex-player-import-audit.json'):'.local-work/codex-all/import-audit.json',JSON.stringify(audit,null,2));}
  else if(codexDemo)await seedCodex({db:localDb,bucket:await mf.getR2Bucket('BUCKET'),base:env.CVK_TEST_URL,sourcePath:process.argv.find(a=>a.startsWith('--codex-source='))?.slice('--codex-source='.length)??'.local-work/codex-v1/source.json'});
  if(areaDemo)console.log('Synthetic area dossier: '+JSON.stringify(await seedLocationAreaDemo({base:env.CVK_TEST_URL,cookie:fixtureCookie})));
  if(commandDemo){
   const command=async(cookie,id,action,extra={})=>{const view=await (await fetch(env.CVK_TEST_URL+'/api/character-engine?id='+id,{headers:{Cookie:cookie}})).json();const response=await fetch(env.CVK_TEST_URL+'/api/character-engine',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.CVK_TEST_URL,Cookie:cookie},body:JSON.stringify({id,version:view.version,action,...extra})});if(!response.ok)throw new Error('Synthetic character command failed: '+action+' '+response.status);};
   await command(playerCookie,engineId,'review');
   const bLogin=await fetch(env.CVK_TEST_URL+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.CVK_TEST_URL},body:JSON.stringify({email:'command-b@example.invalid',password:'ChroniPlay-Demo-2036!'})});
   const bCookie=bLogin.headers.get('set-cookie')?.split(';')[0];if(!bLogin.ok||!bCookie)throw new Error('Synthetic Player B login failed');
   const bResponse=await fetch(env.CVK_TEST_URL+'/api/records',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.CVK_TEST_URL,Cookie:bCookie},body:JSON.stringify({kind:'charaktere',title:'SYNTHETISCH – Regiecharakter B',visibility:'sl',body:{...engineFixture,player:'Demo Spieler B'}})});
   if(!bResponse.ok)throw new Error('Synthetic Player B character authoring failed');const bId=(await bResponse.json()).id;
   await command(bCookie,bId,'review');await command(fixtureCookie,bId,'confirm');await command(fixtureCookie,bId,'xp_grant',{amount:15,reason:'Synthetische Demonstration, kein Kanon'});
   if(characterThree){
    // A played paper sheet above the creation frame, owned by Player B. Purely synthetic.
    const legacy=await fetch(env.CVK_TEST_URL+'/api/records',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.CVK_TEST_URL,Cookie:bCookie},body:JSON.stringify({kind:'charaktere',title:'SYNTHETISCH – Bestandscharakter Papierbogen',visibility:'sl',body:{player:'Demo Spieler B',clan:'Brujah',generation:12,attributes:{Körperkraft:4,Geschick:3,Widerstandsfähigkeit:3,Charisma:3,Manipulation:2,Erscheinungsbild:2,Wahrnehmung:3,Intelligenz:2,Geistesschärfe:3},skills:{Aufmerksamkeit:2,Handgemenge:3,Sportlichkeit:2,Einschüchtern:2,Szenekenntnis:2,Nahkampf:3,Fahren:1,Heimlichkeit:2,Überleben:1,Politik:1,Nachforschungen:1},disciplines:[{name:'Potenz',value:2},{name:'Schnelligkeit',value:2},{name:'Präsenz',value:1}],humanity:2,willpower:1}})});
    if(!legacy.ok)throw new Error('Synthetic paper character failed '+legacy.status);
    // Optional private reconstruction for the owner's personal acceptance. The
    // source file stays in ignored .local-work and is never committed.
    const privateSource='.local-work/character-3/referenz-local.json';
    if(existsSync(privateSource)){const source=JSON.parse(readFileSync(privateSource,'utf8'));const created=await fetch(env.CVK_TEST_URL+'/api/records',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.CVK_TEST_URL,Cookie:playerCookie},body:JSON.stringify({kind:'charaktere',title:source.title,visibility:'sl',body:source.body})});if(!created.ok)throw new Error('Private local reference failed '+created.status);console.log('Private local reference character seeded for Player A.');}
   }
   await author('/api/command-center/story',{action:'create',clientRequestId:randomUUID(),document:{title:'SYNTHETISCH – Die offene Frage',sections:{core:'Dies ist ein reiner Bedienungstest. Beschreibe hier deinen roten Faden; die Software erzwingt keine Szenenfolge.',background:'Vorbereitete Informationen bleiben von tatsächlich geschehenen Ereignissen getrennt.',secrets:'PRIVATE_COMMAND_QA: Diese Information gehört ausschließlich der Spielleitung.',clues:'Verknüpfe vorhandene Hinweise, statt ihre Inhalte zu kopieren.',consequences:'Mögliche Folgen sind Vorschläge für deine Regie, keine automatischen Kampagnenereignisse.',notes:''},references:['place.electric-taberna'],possibilities:[{id:randomUUID(),title:'Synthetische mögliche Begegnung',text:'Nur vorbereitet. Ein Protokolleintrag erledigt diese Möglichkeit nicht automatisch.',status:'open'}]}});
  }
  if(stageDemo){
   const fixture=await seedSpieltischKaserne({db:localDb,base:env.CVK_TEST_URL,cookie:fixtureCookie});
   console.log('Synthetic Spieltisch 2.0 fixture: '+JSON.stringify(fixture));
   if(vitalsDemo){
    // Start the synthetic evening right away so the condition values are usable at once.
    const started=await fetch(env.CVK_TEST_URL+'/api/live-table',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.CVK_TEST_URL,Cookie:fixtureCookie},body:JSON.stringify({action:'start',sessionId:fixture.sessionId,title:'SYNTHETISCH – Zustandswerte'})});
    if(!started.ok)throw new Error('Synthetic evening start failed '+started.status+' '+await started.text());
   }
  }
  }
  if(preserve)writeFileSync(marker,JSON.stringify({purpose,migrations:fingerprint}));
  }
  console.log(storyWork?'Persistent local authoring workspace: '+env.CVK_TEST_URL+'/sl/command-center · empty story/session collection, retained across restarts. Local-only account: command-gm@example.invalid.':'Isolated application ready: '+env.CVK_TEST_URL+'/anmelden · synthetic account command-gm@example.invalid. See local command-center README for demo credentials.');
  await new Promise(resolveStop=>{process.once('SIGINT',resolveStop);process.once('SIGTERM',resolveStop);});
 }else{
  const suite=spawn(process.execPath,['--experimental-strip-types','tests/integration.mjs'],{env,stdio:'inherit',windowsHide:true});
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
