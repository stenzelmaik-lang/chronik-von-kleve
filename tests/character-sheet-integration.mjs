// Etappe 4b: the shared sheet display reads the unchanged projections. Rights against an isolated local instance with
// the synthetic accounts command-gm, command-a, command-b (e.g. scripts/test-local.mjs --command-center).
// Run: CVK_TEST_URL=http://127.0.0.1:<port> node --experimental-strip-types tests/character-sheet-integration.mjs
import assert from 'node:assert/strict';

const base=process.env.CVK_TEST_URL||'';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only local isolated instances are allowed.');
let checks=0;const check=(ok,msg)=>{assert.ok(ok,msg);checks++;console.log('PASS SHEET '+msg);};
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'})});assert.equal(r.status,200,'login '+id);return r.headers.get('set-cookie').split(';')[0];}
async function req(cookie,path){const r=await fetch(base+path,{headers:{Origin:base,...(cookie?{Cookie:cookie}:{})}});const text=await r.text();let data=null;try{data=JSON.parse(text);}catch{/* not JSON */}return {status:r.status,data,text};}

const gm=await login('command-gm'),a=await login('command-a'),b=await login('command-b');
const own=(await req(a,'/api/records?kind=charaktere')).data.records.find(r=>r.owner_id==='command-a');
assert.ok(own,'Player A owns a synthetic character');
const path='/api/character-detail?id='+encodeURIComponent(own.id);

const mine=await req(a,path);
check(mine.status===200&&mine.data.sheet&&mine.data.identity&&typeof mine.data.sheet.attributes==='object','Player A reads the own sheet projection the display is built from');
check(mine.data.identity.name===own.title,'the projection carries the full character name');

const foreign=await req(b,path);
check(foreign.status>=400&&!foreign.text.includes(own.title),'Player B cannot read Player A\'s sheet');
const foreignInspect=await req(b,path+'&view=sl');
check(foreignInspect.status===403,'Player B cannot use the SL projection');

const sl=await req(gm,path+'&view=sl');
check(sl.status===200&&sl.data.sheet&&sl.data.identity.name===own.title,'the SL reads the sheet through its own projection');

const anon=await req(null,path),anonSl=await req(null,path+'&view=sl');
check(anon.status===401&&anonSl.status===401&&!anon.text.includes(own.title),'not signed in: both projections answer 401');
console.log('SHEET checks passed: '+checks);
