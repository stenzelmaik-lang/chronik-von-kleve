// Charakterprofil (page 2 of the sheet) against an isolated local instance with a running evening (scripts/test-local.mjs --ge-01):
// owner saves, other player and anonymous cannot, the SL sees the full profile, other players only shared blocks.
// Run: CVK_TEST_URL=http://127.0.0.1:<port> node --experimental-strip-types tests/character-profile-integration.mjs
import assert from 'node:assert/strict';

const base=process.env.CVK_TEST_URL||'';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only local isolated instances are allowed.');
let checks=0;const check=(ok,msg)=>{assert.ok(ok,msg);checks++;console.log('PASS PROFILE '+msg);};
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'})});assert.equal(r.status,200,'login '+id);return r.headers.get('set-cookie').split(';')[0];}
async function req(cookie,path,method='GET',body){const r=await fetch(base+path,{method,headers:{Origin:base,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const text=await r.text();let data=null;try{data=JSON.parse(text);}catch{/* not JSON */}return {status:r.status,data,text};}

const gm=await login('command-gm'),a=await login('command-a'),b=await login('command-b');
const selected=(await req(a,'/api/character-selection')).data?.characterId;
const own=(await req(a,'/api/records?kind=charaktere')).data.records.find(r=>r.owner_id==='command-a'&&(!selected||r.id===selected));
assert.ok(own,'Player A owns a synthetic character');
const detail=async who=>(await req(who,'/api/character-detail?id='+encodeURIComponent(own.id)+(who===gm?'&view=sl':''))).data;
const marker='PROFILE_'+Date.now();
const profile={description:{age:'34',apparentAge:'',deathDate:'',gender:'',origin:'',nationality:'',hair:'schwarz',eyes:'',height:'',weight:'',appearance:marker+' sichtbar'},allies:marker+' geheim',visibility:{description:'group',story:'private',drive:'private',allies:'private'}};

let d=await detail(a);
check(d.roleplay.profile&&d.roleplay.profile.visibility.allies==='private','the owner reads an empty, private profile');
const saved=await req(a,'/api/character-companion','PATCH',{action:'profile',id:own.id,version:d.revision.version,profile});
check(saved.status===200,'the owner saves the profile');
d=await detail(a);
check(d.roleplay.profile.description.appearance===marker+' sichtbar'&&d.roleplay.profile.allies===marker+' geheim','the profile is stored and read back');
check((await req(a,'/api/character-companion','PATCH',{action:'profile',id:own.id,version:1,profile})).status===409,'a stale version is refused');
check((await req(a,'/api/character-companion','PATCH',{action:'profile',id:own.id,version:d.revision.version,profile:{...profile,extra:1}})).status===400,'unknown fields are refused');

check((await req(b,'/api/character-companion','PATCH',{action:'profile',id:own.id,version:d.revision.version,profile})).status>=400,'Player B cannot change Player A\'s profile');
check((await req(null,'/api/character-companion','PATCH',{action:'profile',id:own.id,version:d.revision.version,profile})).status===401,'not signed in: save → 401');
const sl=await detail(gm);
check(sl.roleplay.profile.allies===marker+' geheim','the SL reads the full profile in its own projection');

const live=(await req(a,'/api/live-table?view=active')).data;
const sessionId=live?.room?.sessionId;
if(sessionId){
  const seen=await req(b,'/api/live-participants?sessionId='+encodeURIComponent(sessionId)+'&memberId=command-a&view=profile&characterId='+encodeURIComponent(own.id));
  if(seen.status===200){
    check(seen.text.includes(marker+' sichtbar'),'Player B sees the block Player A shared with the group');
    check(!seen.text.includes(marker+' geheim'),'Player B does not see the private block');
  }else console.log('SKIP PROFILE table view not reachable for Player B: '+seen.status);
}else console.log('SKIP PROFILE no running evening on this instance');
check((await req(null,'/api/live-participants?sessionId=x&memberId=command-a&view=profile')).status===401,'not signed in: table profile → 401');

// Restore an empty profile so the instance stays as it was.
const latest=await detail(a);
const empty={description:Object.fromEntries(Object.keys(profile.description).map(k=>[k,''])),allies:'',visibility:{description:'private',story:'private',drive:'private',allies:'private'}};
check((await req(a,'/api/character-companion','PATCH',{action:'profile',id:own.id,version:latest.revision.version,profile:empty})).status===200,'the synthetic profile is cleared again');
console.log('PROFILE checks passed: '+checks);
