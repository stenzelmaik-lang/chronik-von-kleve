// Abenteuerjournal ad acta (Etappe 1): stored journal entries stay readable and keep every body field after the
// journal code is gone. Runs against an isolated local instance with the synthetic accounts command-gm, command-a,
// command-b (for example: node --experimental-strip-types scripts/test-local.mjs --command-center).
// Run: CVK_TEST_URL=http://127.0.0.1:<port> node --experimental-strip-types tests/journal-retirement-integration.mjs
import assert from 'node:assert/strict';

const base=process.env.CVK_TEST_URL||'';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only local isolated instances are allowed.');
let checks=0;const check=(ok,msg)=>{assert.ok(ok,msg);checks++;console.log('PASS AD-ACTA '+msg);};
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'})});assert.equal(r.status,200,'login '+id);return r.headers.get('set-cookie').split(';')[0];}
async function req(cookie,path,method='GET',body){const r=await fetch(base+path,{method,headers:{Origin:base,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const text=await r.text();let data=null;try{data=JSON.parse(text);}catch{/* not JSON */}return {status:r.status,data,text};}

const gm=await login('command-gm'),a=await login('command-a'),b=await login('command-b');
const own=(await req(a,'/api/records?kind=charaktere')).data.records.find(r=>r.owner_id==='command-a');
assert.ok(own,'Player A owns a synthetic character');

// A journal entry exactly as AJ-01 stored it, plus a field no current code knows.
const marker='AD_ACTA_JOURNAL_ENTRY_'+Date.now();
const stored={characterId:own.id,context:'character-companion',text:'cvk-html-v1:<p><strong>'+marker+'</strong> Die Nacht im Hafen.</p>',journalKind:'chronicle',playDate:'1998-03-14',archived:false,testData:true,futureField:{kept:true,list:[1,2]}};
const created=await req(a,'/api/records','POST',{kind:'notizen',title:'Chronik: Hafen',visibility:'private',body:stored});
check(created.status===200,'a stored journal entry exists in the old shape');
const noteId=created.data.id;
const ownNote=async()=>(await req(a,'/api/records?kind=notizen')).data.records.find(r=>r.id===noteId);

let note=await ownNote();
check(note&&note.body.journalKind==='chronicle'&&note.body.playDate==='1998-03-14'&&note.body.futureField?.kept===true,'the owner still reads the entry with all fields in the notes list');
const detail=(await req(a,'/api/character-detail?id='+encodeURIComponent(own.id))).data;
const projected=detail.companion.notes.find(n=>n.id===noteId);
check(projected&&projected.text.includes(marker),'the entry stays readable in the character management (HTML text intact)');

// Saving through the character companion keeps every other field of the stored body.
const updated=await req(a,'/api/character-companion','PATCH',{action:'note.update',characterId:own.id,noteId,version:note.version,title:'Chronik: Hafen (ergänzt)',text:'cvk-html-v1:<p>'+marker+' ergänzt.</p>',visibility:'private'});
check(updated.status===200,'the owner saves the entry through the character companion');
note=await ownNote();
check(note.body.journalKind==='chronicle'&&note.body.playDate==='1998-03-14','journalKind and playDate survive a companion save');
check(JSON.stringify(note.body.futureField)===JSON.stringify(stored.futureField)&&note.body.context==='character-companion'&&note.body.characterId===own.id,'unknown and binding fields survive a companion save');
check(note.body.text.includes('ergänzt'),'the new text is stored');

// Saving through the generic notes editor (sends the body it read) keeps them as well.
const resaved=await req(a,'/api/records','POST',{id:noteId,version:note.version,kind:'notizen',title:'Chronik: Hafen (Editor)',visibility:'private',body:{...note.body,summary:'neu'}});
check(resaved.status===200,'the owner saves the entry through the generic notes editor');
note=await ownNote();
check(note.body.journalKind==='chronicle'&&note.body.playDate==='1998-03-14'&&note.body.futureField?.kept===true&&note.body.summary==='neu','all fields survive a generic save');

// A stale version is refused and changes nothing.
const stale=await req(a,'/api/character-companion','PATCH',{action:'note.update',characterId:own.id,noteId,version:1,text:'veraltet',visibility:'private'});
check(stale.status===409,'a stale companion save is refused with 409');
check((await ownNote()).body.text.includes('ergänzt'),'the stored text is unchanged after the refused save');

// Privacy: player B and the SL never read the private entry, also with the foreign IDs.
const bList=await req(b,'/api/records?kind=notizen');
check(bList.status===200&&!bList.text.includes(marker),'player B does not see the entry in the notes list');
const bDetail=await req(b,'/api/character-detail?id='+encodeURIComponent(own.id));
check(bDetail.status>=400&&!bDetail.text.includes(marker),'player B cannot open the foreign character with the entry');
const bWrite=await req(b,'/api/character-companion','PATCH',{action:'note.update',characterId:own.id,noteId,version:note.version,text:'fremd',visibility:'private'});
check(bWrite.status>=400,'player B cannot change the entry with its IDs');
const gmList=await req(gm,'/api/records?kind=notizen'),gmInspection=await req(gm,'/api/records?kind=notizen&view=sl');
check(!gmList.text.includes(marker)&&gmInspection.status===200&&!gmInspection.text.includes(marker),'the SL does not see the private entry in either notes view');
const gmDetail=await req(gm,'/api/character-detail?id='+encodeURIComponent(own.id)+'&view=sl');
check(!gmDetail.text.includes(marker),'the SL character projection leaves the private entry out');
const gmWrite=await req(gm,'/api/character-companion','PATCH',{action:'note.update',characterId:own.id,noteId,version:note.version,text:'SL',visibility:'private'});
check(gmWrite.status>=400,'the SL cannot change the private entry');

// The journal switch is gone from the table snapshot; unknown session ids stay closed for everyone.
const liveA=await req(a,'/api/live-stage?sessionId=unbekannt');
check(liveA.status>=400&&!liveA.text.includes('journalEnabled'),'the table snapshot route carries no journal switch');

// Not signed in: every touched route answers 401.
for (const [path,method,body] of [['/api/records?kind=notizen','GET'],['/api/character-detail?id='+encodeURIComponent(own.id),'GET'],['/api/character-companion','PATCH',{action:'note.update',characterId:own.id,noteId,version:1,text:'x'}],['/api/live-stage?sessionId=unbekannt','GET']]) {
  const r=await req(null,path,method,body);
  check(r.status===401&&!r.text.includes(marker),'not signed in: '+method+' '+path.split('?')[0]+' → 401');
}

// Clean-up of the synthetic entry: hard delete through the existing route (local instance only).
check((await req(a,'/api/records','DELETE',{id:noteId,version:note.version})).status===200,'the synthetic entry is removed again');
console.log('AD-ACTA checks passed: '+checks);
