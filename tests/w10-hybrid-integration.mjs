// W10-Hybrid Phase B against a running isolated instance (scripts/start-w10-hybrid.ps1).
// Three synthetic sessions (SL, Spieler A, Spieler B): server-side pool derivation from the stored sheet,
// binding to the running evening and the explicitly selected character (K7), V20 wound penalties (K5),
// SG above 10 rejected (K3), foreign characters 404, manipulated client values rejected, no writes.
// Run: node --experimental-strip-types tests/w10-hybrid-integration.mjs
import assert from 'node:assert/strict';

const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8878';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only local isolated instances are allowed.');
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'})});assert.equal(r.status,200,'login '+id);return r.headers.get('set-cookie').split(';')[0];}
const client=cookie=>({
 get:async path=>{const r=await fetch(base+path,{headers:{Cookie:cookie}});return {status:r.status,text:await r.text()};},
 send:async(method,path,body,headers={})=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie,...headers},body:JSON.stringify(body)});return {status:r.status,text:await r.text()};},
 post(path,body,headers){return this.send('POST',path,body,headers);},
});
const gm=client(await login('command-gm')),a=client(await login('command-a')),b=client(await login('command-b'));
const own=async c=>JSON.parse((await c.get('/api/records?kind=charaktere')).text).records;
const byTitle=(rows,title)=>{const row=rows.find(r=>r.title===title);assert.ok(row,'Synthetic character missing: '+title);return row;};
const rowsA=await own(a);
const charA=byTitle(rowsA,'SYNTHETISCH – Regiecharakter A'),draftA=byTitle(rowsA,'SYNTHETISCH – Character Engine A'),charB=byTitle(await own(b),'SYNTHETISCH – Regiecharakter B');
const active=JSON.parse((await gm.get('/api/live-table?view=active')).text);
const sessionId=active.room?.sessionId;assert.ok(sessionId&&active.room.started,'Start the synthetic evening first.');
const select=async(c,characterId)=>{const r=await c.send('PATCH','/api/character-selection',{characterId});assert.equal(r.status,200,'select: '+r.text);};
const preview=(c,characterId,selection,declared={baseDifficulty:6},extra={})=>c.post('/api/w10-preview',{sessionId,characterId,selection,declared,...extra});
const ok=async(c,...args)=>{const r=await preview(c,...args);assert.equal(r.status,200,r.text);return JSON.parse(r.text);};
const status=async(expected,c,...args)=>{const r=await preview(c,...args);assert.equal(r.status,expected,r.text);return r;};
const version=async(c,id)=>JSON.parse((await c.get('/api/character-engine?id='+encodeURIComponent(id))).text).version;

// 1. K7: players roll only with the explicitly selected, playable character at the running evening.
await select(a,null);
assert.match((await status(409,a,charA.id,{attributeId:'dexterity'})).text,/aktiven Charakter auswählen/,'No selection, no automatic owner fallback');
await select(a,draftA.id);
assert.match((await status(409,a,charA.id,{attributeId:'dexterity'})).text,/ausgewählten aktiven Charakter/,'Own but not selected');
assert.match((await status(409,a,draftA.id,{attributeId:'dexterity'})).text,/nicht spielbereit/,'Selected engine sheet under review cannot roll');
await select(a,charA.id);await select(b,charB.id);
assert.equal((await preview(a,charA.id,{attributeId:'dexterity'},{baseDifficulty:6},{sessionId:'session-unbekannt'})).status,404,'Unknown evening');
console.log('PASS binding: explicit selection, no fallback, drafts excluded, evening required');

// 2. Pool and provenance from the stored sheet.
const pa=await ok(a,charA.id,{attributeId:'dexterity'});
assert.equal(pa.status,'ready');assert.equal(pa.characterId,charA.id);assert.equal(pa.sessionId,sessionId);
assert.deepEqual(pa.pool,{base:3,effective:3},'Geschick 3 from the stored sheet of A');
assert.deepEqual(pa.provenance[0],{part:'attribute',id:'dexterity',label:'Geschick',amount:3,source:'Charakterbogen · Attribute · Geschick'});
assert.equal(pa.profile.rulesVersion,'1.0.0-draft');assert.equal(pa.profile.productionEnabled,false);
assert.ok(Number.isInteger(pa.characterVersion)&&pa.characterVersion>0,'Server sets the record version');
const pb=await ok(b,charB.id,{attributeId:'dexterity',abilityId:'firearms'});
assert.deepEqual(pb.pool,{base:6,effective:6},'Geschick 3 + Schusswaffen 3 for B');
const skill=await ok(b,charB.id,{attributeId:'dexterity',abilityId:'melee'});
assert.equal(skill.difficulty.effective,7);assert.equal(skill.provenance.at(-1).id,'untrained_skill');
const knowledge=await ok(b,charB.id,{attributeId:'intelligence',abilityId:'medicine'});
assert.equal(knowledge.status,'blocked');assert.equal(knowledge.code,'UNTRAINED_KNOWLEDGE');
for(const p of [pa,pb])assert.doesNotMatch(JSON.stringify(p),/PRIVATE_QA|gmBody|gm_body|gmNotes/,'No SL data in a preview');
console.log('PASS players: own selected character, pool and provenance from the stored sheet');

// 3. K3: SG above 10 is rejected before rolling with an explanation; no cap policy is accepted.
const over=await ok(b,charB.id,{attributeId:'dexterity',abilityId:'melee'},{baseDifficulty:10});
assert.equal(over.code,'DIFFICULTY_ABOVE_10');assert.equal(over.pool,undefined);assert.equal(over.difficulty.sum,11);assert.match(over.message,/2 bis 10/);
await status(400,b,charB.id,{attributeId:'dexterity',abilityId:'melee'},{baseDifficulty:10,difficultyOverflow:'cap_at_10'});
console.log('PASS SG: above 10 rejected and explained, cap policy refused');

// 4. K5: wound penalty from the existing health track (synthetic local change, reset afterwards).
const health=async value=>{const v=await version(gm,charB.id);const r=await gm.send('PATCH','/api/character-runtime',{id:charB.id,version:v,field:'health',value});assert.equal(r.status,200,'health: '+r.text);};
await health('Verwundet');
const wounded=await ok(b,charB.id,{attributeId:'dexterity',abilityId:'firearms'});
assert.deepEqual(wounded.pool,{base:4,effective:4},'6 − 2 for Verwundet');
assert.deepEqual(wounded.provenance.filter(p=>p.part==='wounds').map(p=>[p.label,p.amount]),[['Verwundet',-2]]);
await health('Außer Gefecht');
assert.equal((await ok(b,charB.id,{attributeId:'dexterity'})).code,'INCAPACITATED');
await health('Gesund');
assert.deepEqual((await ok(b,charB.id,{attributeId:'dexterity',abilityId:'firearms'})).pool,{base:6,effective:6});
console.log('PASS wounds: V20 penalty applied once and explained, incapacitated blocked');

// 5. Foreign characters are indistinguishable from missing ones.
await status(404,a,charB.id,{attributeId:'dexterity'});
await status(404,b,charA.id,{attributeId:'dexterity'});
await status(404,a,'unbekannt',{attributeId:'dexterity'});
console.log('PASS rights: foreign character 404 for players');

// 6. The SL previews player characters of this evening; unplayable sheets are refused.
const ga=await ok(gm,charA.id,{attributeId:'dexterity'}),gb=await ok(gm,charB.id,{attributeId:'dexterity',abilityId:'firearms'});
assert.deepEqual([ga.pool,gb.pool],[pa.pool,pb.pool],'Same sheet, same result for SL');
await status(409,gm,draftA.id,{attributeId:'dexterity'});
await status(404,gm,'unbekannt',{attributeId:'dexterity'});
console.log('PASS rights: SL previews the evening\'s player characters');

// 7. Manipulated client values are rejected, never merged.
for(const extra of [{pool:99},{faces:[10,10,10]},{diceFaces:[10]},{stressUnits:0},{hunger:0},{characterVersion:1},{allowed:true},{specialtyApplies:true},{willpower:{requested:true}},{woundPenalty:0}]){
 const r=await preview(a,charA.id,{attributeId:'dexterity'},{baseDifficulty:6},extra);
 assert.equal(r.status,400,'Rejected top-level '+Object.keys(extra)[0]+': '+r.text);
}
await status(400,a,charA.id,{attributeId:'dexterity',pool:99});
await status(400,a,charA.id,{attributeId:'dexterity'},{baseDifficulty:6,pool:99});
await status(400,a,charA.id,{attributeId:'dexterity'},{baseDifficulty:6,specialtyApplies:true});
for(const d of [1,11,6.5,'6'])await status(400,a,charA.id,{attributeId:'dexterity'},{baseDifficulty:d});
for(const s of [{attributeId:'Geschick'},{attributeId:'dexterity',abilityId:'security'},{attributeId:'__proto__'}])await status(400,a,charA.id,s);
assert.equal((await a.post('/api/w10-preview',{characterId:charA.id,selection:{attributeId:'dexterity'},declared:{baseDifficulty:6}})).status,400,'sessionId is required');
await status(200,a,charA.id,{attributeId:'dexterity'});
const foreignOrigin=await a.post('/api/w10-preview',{sessionId,characterId:charA.id,selection:{attributeId:'dexterity'},declared:{baseDifficulty:6}},{Origin:'http://evil.invalid'});
assert.equal(foreignOrigin.status,403,'Cross-origin refused: '+foreignOrigin.text);
const anonymous=await client('').post('/api/w10-preview',{sessionId,characterId:charA.id,selection:{attributeId:'dexterity'},declared:{baseDifficulty:6}});
assert.equal(anonymous.status,401,'Login required');
console.log('PASS manipulation: free pool/faces/resources/version/specialty/cap rejected');

// 8. Preview is read-only.
const before=await version(gm,charB.id);
for(let i=0;i<3;i++)await ok(b,charB.id,{attributeId:'wits',abilityId:'alertness'});
assert.equal(await version(gm,charB.id),before,'Record version unchanged by previews');
console.log('PASS read-only: no record writes');

// 9. K4: structured specialties are edited through the sheet route, protected, and applied by the server.
const engineView=async(c,id)=>JSON.parse((await c.get('/api/character-engine?id='+encodeURIComponent(id))).text);
const editSheet=async(c,id,patch)=>{const v=await version(c,id);return c.post('/api/character-engine',{id,version:v,action:'edit_sheet',patch,reason:'Synthetische K4-Abnahme'});};
const specB={id:'spec_'+crypto.randomUUID(),target:{kind:'ability',id:'firearms'},name:'Pistolen',scope:'Kurze Distanz'};
const skillsB=(await engineView(gm,charB.id)).sheet?.skills??JSON.parse((await gm.get('/api/records?kind=charaktere')).text).records.find(r=>r.id===charB.id).body.skills;
assert.equal(skillsB.Schusswaffen,3,'Fixture: Schusswaffen 3');
const tooLow=await editSheet(gm,charB.id,{specialties:[specB]});
assert.equal(tooLow.status,400,'Rating below 4 refused: '+tooLow.text);assert.match(tooLow.text,/mindestens 4/);
assert.equal((await editSheet(gm,charB.id,{specialties:[{...specB,id:'kaputt'}],skills:{...skillsB,Schusswaffen:4}})).status,400,'Malformed id refused');
const saved=await editSheet(gm,charB.id,{specialties:[specB],skills:{...skillsB,Schusswaffen:4}});assert.equal(saved.status,200,'SL saves specialty: '+saved.text);
const recB=JSON.parse((await b.get('/api/records?kind=charaktere')).text).records.find(r=>r.id===charB.id);
const sneak=await b.post('/api/records',{id:recB.id,version:recB.version,kind:'charaktere',title:recB.title,visibility:recB.visibility,body:{...recB.body,specialties:[{...specB,id:'spec_'+crypto.randomUUID(),name:'Alles'}]}});
assert.ok([400,403,409].includes(sneak.status),'Player cannot add specialties through the generic editor: '+sneak.status);
const withSpec=await ok(b,charB.id,{attributeId:'dexterity',abilityId:'firearms',specialtyId:specB.id});
assert.equal(withSpec.specialtyApplies,true);assert.deepEqual(withSpec.specialty,{id:specB.id,name:'Pistolen',claimedBy:'player'});
assert.deepEqual(withSpec.pool,{base:7,effective:7},'Specialty adds no die: 3 + 4');
assert.equal((await ok(gm,charB.id,{attributeId:'dexterity',abilityId:'firearms',specialtyId:specB.id})).specialty.claimedBy,'gm');
assert.equal((await ok(b,charB.id,{attributeId:'dexterity',abilityId:'melee',specialtyId:specB.id})).code,'SPECIALTY_NOT_FOR_TRAIT');
assert.equal((await ok(a,charA.id,{attributeId:'dexterity',specialtyId:specB.id})).code,'SPECIALTY_NOT_FOUND','Foreign specialty is unknown on another sheet');
await status(400,b,charB.id,{attributeId:'dexterity',abilityId:'firearms',specialtyId:'Pistolen'});
const offered=await ok(b,charB.id,{attributeId:'dexterity',abilityId:'firearms'});
assert.deepEqual(offered.specialties.map(s=>[s.id,s.applicable]),[[specB.id,true]],'Preview offers the matching specialty');
const restored=await editSheet(gm,charB.id,{specialties:[],skills:skillsB});assert.equal(restored.status,200,'Reset synthetic sheet: '+restored.text);
assert.equal((await ok(b,charB.id,{attributeId:'dexterity',abilityId:'firearms'})).specialties.length,0);
console.log('PASS specialties: edit with V20 minimum, protected, applied only to the matching trait');

// 10. K6: own abilities with a stable ID; entries without ID stay untouched and not selectable.
const ownB={id:'cab_'+crypto.randomUUID(),name:'Falknerei',value:3,category:'Fertigkeit'},legacyB={name:'Alte Notiz vom Papierbogen',value:2};
assert.equal((await editSheet(gm,charB.id,{customAbilities:[legacyB,{...ownB,name:'Nahkampf'}]})).status,400,'Name of a V20 standard ability refused');
assert.equal((await editSheet(gm,charB.id,{customAbilities:[legacyB,{...ownB,category:undefined}]})).status,400,'Category required');
const savedOwn=await editSheet(gm,charB.id,{customAbilities:[legacyB,ownB]});assert.equal(savedOwn.status,200,'SL saves own ability: '+savedOwn.text);
const ownPreview=await ok(b,charB.id,{attributeId:'wits',abilityId:'custom:'+ownB.id});
assert.deepEqual(ownPreview.pool,{base:5,effective:5},'Geistesschärfe 2 + Falknerei 3');
assert.equal(ownPreview.customAbilitiesWithoutId,1,'The legacy row is counted, not selectable');
assert.equal(ownPreview.provenance[1].source,'Charakterbogen · Eigene Fähigkeit (Fertigkeit) · Falknerei');
assert.equal((await ok(a,charA.id,{attributeId:'wits',abilityId:'custom:'+ownB.id})).code,'CUSTOM_ABILITY_NOT_FOUND','Foreign own ability is unknown on another sheet');
await status(400,b,charB.id,{attributeId:'wits',abilityId:'custom:Alte Notiz vom Papierbogen'});
assert.equal((await editSheet(gm,charB.id,{customAbilities:[legacyB,{...ownB,name:'Beizjagd'}]})).status,200,'Rename keeps the ID');
assert.equal((await ok(b,charB.id,{attributeId:'wits',abilityId:'custom:'+ownB.id})).provenance[1].label,'Beizjagd');
assert.equal((await editSheet(gm,charB.id,{customAbilities:[legacyB,{...ownB,active:false}]})).status,200,'Deactivate instead of delete');
assert.equal((await ok(b,charB.id,{attributeId:'wits',abilityId:'custom:'+ownB.id})).code,'CUSTOM_ABILITY_INACTIVE');
const storedB=JSON.parse((await b.get('/api/records?kind=charaktere')).text).records.find(r=>r.id===charB.id).body.customAbilities;
assert.deepEqual(storedB[0],legacyB,'Legacy row stored exactly as written, without an invented ID');
assert.equal((await editSheet(gm,charB.id,{customAbilities:[]})).status,200,'Reset synthetic sheet');
console.log('PASS own abilities: stable ID, category rules, rename/deactivate, legacy rows untouched');

// 11. Existing dice path is untouched: the live table still answers with its own contract.
assert.equal((await gm.get('/api/live-table?view=active')).status,200,'Live table still reachable');
console.log('PASS W10-Hybrid Phase B integration');
