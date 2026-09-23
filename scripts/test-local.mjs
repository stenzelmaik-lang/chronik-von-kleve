import {spawn,spawnSync} from 'node:child_process';
import {mkdirSync,createWriteStream} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';

// Isolated local test worker: never reuse .wrangler production/preview state.
const state='work/tests/'+randomUUID();mkdirSync(state,{recursive:true});
const cli='node_modules/wrangler/bin/wrangler.js',config='dist/server/wrangler.json';
const env={...process.env,WRANGLER_SEND_METRICS:'false',CVK_TEST_URL:'http://127.0.0.1:8793',CVK_TEST_STATE:state};
for(const migration of ['drizzle/0000_aromatic_network.sql','drizzle/0001_purple_blockbuster.sql','drizzle/0002_thick_mister_fear.sql','drizzle/0003_careful_leech.sql']){
 const r=spawnSync(process.execPath,[cli,'d1','execute','DB','--local','--persist-to',state,'--config',config,'--file',migration],{env,encoding:'utf8'});
 if(r.status!==0)throw new Error('Local migration failed: '+r.stderr);
}
const worker=spawn(process.execPath,[cli,'dev','--config',config,'--local','--persist-to',state,'--ip','127.0.0.1','--port','8793','--inspector-port','0','--var','GM_EMAIL:gm@sprint.invalid'],{env,stdio:['ignore','pipe','pipe'],windowsHide:true});
const log=createWriteStream(state+'/worker.log');worker.stdout.pipe(log);worker.stderr.pipe(log);
try{
 let ready=false;
 for(let attempt=0;attempt<60;attempt++){
  try{ready=(await fetch(env.CVK_TEST_URL)).ok}catch{}
  if(ready)break;
  if(worker.exitCode!==null)throw new Error('Local worker exited; see '+state+'/worker.log');
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 if(!ready)throw new Error('Local worker did not become ready.');
 const suite=spawn(process.execPath,['tests/integration.mjs'],{env,stdio:'inherit',windowsHide:true});
 const [code]=await once(suite,'exit');process.exitCode=code??1;
}finally{
 if(process.platform==='win32'&&worker.pid)spawnSync('taskkill',['/PID',String(worker.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
 else worker.kill('SIGTERM');
 log.end();
}
