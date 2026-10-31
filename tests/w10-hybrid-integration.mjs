// W10-Hybrid Phase B against a running isolated instance (scripts/start-w10-hybrid.ps1).
// Three synthetic sessions (SL, Spieler A, Spieler B): server-side pool derivation from the stored sheet,
// own-character rights, foreign characters 404, manipulated client values rejected, no writes.
// Run: node --experimental-strip-types tests/w10-hybrid-integration.mjs
import assert from 'node:assert/strict';

const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8878';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only local isolated instances are allowed.');
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'})});assert.equal(r.status,200,'login '+id);return r.headers.get('set-cookie').split(';')[0];}
const client=cookie=>({
 get:async path=>{const r=await fetch(base+path,{headers:{Cookie:cookie}});return {status:r.status,text:await r.text()};},
 post:async(path,body,headers={})=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie,...headers},body:JSON.stringify(body)});return {status:r.status,text:await r.text()};},
});
const gm=client(await login('command-gm')),a=client(await login('command-a')),b=client(await login('command-b'));
const own=async c=>JSON.parse((await c.get('/api/records?kind=charaktere')).text).records;
const byTitle=(rows,title)=>{const row=rows.find(r=>r.title===title);assert.ok(row,'Synthetic character missing: '+title);return row;};
const charA=byTitle(await own(a),'SYNTHETISCH – Regiecharakter A'),charB=byTitle(await own(b),'SYNTHETISCH – Regiecharakter B');
const preview=(c,characterId,selection,declared={baseDifficulty:6},extra={})=>c.post('/api/w10-preview',{characterId,selection,declared,...extra});
const ok=async(c,...args)=>{const r=await preview(c,...args);assert.equal(r.status,200,r.text);return JSON.parse(r.text);};
const version=async(c,id)=>JSON.parse((await c.get('/api/character-engine?id='+encodeURIComponent(id))).text).version;

// 1. Players: own active character, pool from the stored sheet with provenance.
const pa=await ok(a,charA.id,{attributeId:'dexterity'});
assert.equal(pa.status,'ready');assert.equal(pa.characterId,charA.id);
assert.deepEqual(pa.pool,{base:3,effective:3},'Geschick 3 from the stored sheet of A');
assert.deepEqual(pa.provenance,[{part:'attribute',id:'dexterity',label:'Geschick',amount:3,source:'Charakterbogen · Attribute · Geschick'}]);
assert.equal(pa.profile.rulesVersion,'1.0.0-draft');assert.equal(pa.profile.productionEnabled,false);
assert.ok(Number.isInteger(pa.characterVersion)&&pa.characterVersion>0,'Server sets the record version');
const pb=await ok(b,charB.id,{attributeId:'dexterity',abilityId:'firearms'});
assert.deepEqual(pb.pool,{base:6,effective:6},'Geschick 3 + Schusswaffen 3 for B');
const skill=await ok(b,charB.id,{attributeId:'dexterity',abilityId:'melee'});
assert.equal(skill.difficulty.effective,7);assert.equal(skill.provenance.at(-1).id,'untrained_skill');
const knowledge=await ok(b,charB.id,{attributeId:'intelligence',abilityId:'medicine'});
assert.equal(knowledge.status,'blocked');assert.equal(knowledge.code,'UNTRAINED_KNOWLEDGE');
assert.deepEqual(pb.notApplied.map(n=>n.id),['specialty','wounds','hunger','personal_stress','group_stress','willpower']);
for(const p of [pa,pb])assert.doesNotMatch(JSON.stringify(p),/PRIVATE_QA|gmBody|gm_body|gmNotes/,'No SL data in a preview');
console.log('PASS players: own character, pool and provenance from the stored sheet');

// 2. Foreign characters are indistinguishable from missing ones.
assert.equal((await preview(a,charB.id,{attributeId:'dexterity'})).status,404,'A cannot preview B');
assert.equal((await preview(b,charA.id,{attributeId:'dexterity'})).status,404,'B cannot preview A');
assert.equal((await preview(a,'unbekannt',{attributeId:'dexterity'})).status,404,'Unknown id');
console.log('PASS rights: foreign character 404 for players');

// 3. The SL may preview every campaign character.
const ga=await ok(gm,charA.id,{attributeId:'dexterity'}),gb=await ok(gm,charB.id,{attributeId:'dexterity',abilityId:'firearms'});
assert.deepEqual([ga.pool,gb.pool],[pa.pool,pb.pool],'Same sheet, same result for SL');
console.log('PASS rights: SL previews all characters');

// 4. Manipulated client values are rejected, never merged.
for(const extra of [{pool:99},{faces:[10,10,10]},{diceFaces:[10]},{stressUnits:0},{hunger:0},{characterVersion:1},{allowed:true},{specialtyApplies:true},{willpower:{requested:true}}]){
 const r=await preview(a,charA.id,{attributeId:'dexterity'},{baseDifficulty:6},extra);
 assert.equal(r.status,400,'Rejected top-level '+Object.keys(extra)[0]+': '+r.text);
}
assert.equal((await preview(a,charA.id,{attributeId:'dexterity',pool:99})).status,400,'selection.pool');
assert.equal((await preview(a,charA.id,{attributeId:'dexterity'},{baseDifficulty:6,pool:99})).status,400,'declared.pool');
assert.equal((await preview(a,charA.id,{attributeId:'dexterity'},{baseDifficulty:6,specialtyApplies:true})).status,400,'declared.specialtyApplies');
for(const d of [1,11,6.5,'6'])assert.equal((await preview(a,charA.id,{attributeId:'dexterity'},{baseDifficulty:d})).status,400,'baseDifficulty '+d);
for(const s of [{attributeId:'Geschick'},{attributeId:'dexterity',abilityId:'security'},{attributeId:'__proto__'}])assert.equal((await preview(a,charA.id,s)).status,400,'Unknown ID '+JSON.stringify(s));
assert.equal((await preview(a,charA.id,{attributeId:'dexterity'},{baseDifficulty:6})).status,200,'Clean request still accepted');
const foreignOrigin=await a.post('/api/w10-preview',{characterId:charA.id,selection:{attributeId:'dexterity'},declared:{baseDifficulty:6}},{Origin:'http://evil.invalid'});
assert.equal(foreignOrigin.status,403,'Cross-origin refused: '+foreignOrigin.text);
const anonymous=await client('').post('/api/w10-preview',{characterId:charA.id,selection:{attributeId:'dexterity'},declared:{baseDifficulty:6}});
assert.equal(anonymous.status,401,'Login required');
console.log('PASS manipulation: free pool/faces/resources/version/specialty rejected');

// 5. Preview is read-only.
const before=await version(gm,charB.id);
for(let i=0;i<3;i++)await ok(b,charB.id,{attributeId:'wits',abilityId:'alertness'});
assert.equal(await version(gm,charB.id),before,'Record version unchanged by previews');
console.log('PASS read-only: no record writes');

// 6. Existing dice path is untouched: the live table still answers with its own contract.
const live=await gm.get('/api/live-table?view=active');assert.equal(live.status,200,'Live table still reachable');
console.log('PASS W10-Hybrid Phase B integration');
