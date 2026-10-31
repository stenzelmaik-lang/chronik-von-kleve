// Readable Phase-B demonstration against the isolated instance (scripts/start-w10-hybrid.ps1).
// Prints server-side previews for synthetic characters A and B as plain German lines. Read-only:
// only the profile selection of the synthetic players is set. Never against production.
// Run: node --experimental-strip-types scripts/w10-preview-demo.mjs
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8878';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw new Error('Only local isolated instances are allowed.');
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'})});if(r.status!==200)throw new Error('Login '+id+': '+r.status);return r.headers.get('set-cookie').split(';')[0];}
const call=async(cookie,method,path,body)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json().catch(()=>null)};};
const [gm,a,b]=await Promise.all(['command-gm','command-a','command-b'].map(login));
const sessionId=(await call(gm,'GET','/api/live-table?view=active')).data?.room?.sessionId;
if(!sessionId)throw new Error('Kein laufender Spielabend. Instanz mit scripts/start-w10-hybrid.ps1 starten.');
const mine=async c=>(await call(c,'GET','/api/records?kind=charaktere')).data.records;
const charA=(await mine(a)).find(r=>r.title==='SYNTHETISCH – Regiecharakter A'),charB=(await mine(b)).find(r=>r.title==='SYNTHETISCH – Regiecharakter B');
await call(a,'PATCH','/api/character-selection',{characterId:charA.id});await call(b,'PATCH','/api/character-selection',{characterId:charB.id});

function show(title,{status,data}){
  console.log('\n■ '+title);
  if(status!==200){console.log(`  HTTP ${status}: ${data?.error??''}`);return;}
  if(data.status==='blocked'){console.log(`  Abgelehnt: ${data.code}${data.message?' – '+data.message:''}`);}
  else console.log(`  Pool ${data.pool.effective} W10 gegen SG ${data.difficulty.effective}${data.specialtyApplies?' · Spezialisierung: jede 10 zählt doppelt':''}`);
  for(const p of data.provenance??[])console.log(`  ${p.amount>=0&&p.part!=='difficulty'?'+':p.part==='difficulty'?'SG +':''}${p.amount} ${p.label}  ← ${p.source}`);
  if(data.stress)console.log(`  Persönlicher Stress: ${data.stress.personal.units}/300${data.stress.personal.recorded?'':' (nicht erfasst)'}${data.stress.legacyManual?` · Altwert ${data.stress.legacyManual.value}/10 ohne Wirkung`:''} · auf den Wurf angewandt: nein`);
}
const preview=(c,characterId,selection,baseDifficulty=6)=>call(c,'POST','/api/w10-preview',{sessionId,characterId,selection,declared:{baseDifficulty}});
show('Spieler B: Geschick + Schusswaffen, SG 6',await preview(b,charB.id,{attributeId:'dexterity',abilityId:'firearms'}));
show('Spieler B: Geschick + Nahkampf (ungelernte Fertigkeit), SG 6',await preview(b,charB.id,{attributeId:'dexterity',abilityId:'melee'}));
show('Spieler B: Geschick + Nahkampf, SG 10 → über 10',await preview(b,charB.id,{attributeId:'dexterity',abilityId:'melee'},10));
show('Spieler B: Intelligenz + Medizin (ungelernte Kenntnis)',await preview(b,charB.id,{attributeId:'intelligence',abilityId:'medicine'}));
show('Spieler A: nur Geschick',await preview(a,charA.id,{attributeId:'dexterity'}));
show('Spieler A versucht Charakter B',await preview(a,charB.id,{attributeId:'dexterity'}));
show('Spieler A schickt einen eigenen Pool mit',await call(a,'POST','/api/w10-preview',{sessionId,characterId:charA.id,selection:{attributeId:'dexterity'},declared:{baseDifficulty:6},pool:99}));
show('SL: Charakter B, Geistesschärfe + Aufmerksamkeit',await preview(gm,charB.id,{attributeId:'wits',abilityId:'alertness'}));
console.log('\nNur Vorschau: Es wurde nicht gewürfelt und nichts gebucht.');
