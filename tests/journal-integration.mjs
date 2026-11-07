// Abenteuerjournal (AJ-01) against a running isolated --journal instance: three synthetic accounts (SL, Spieler A,
// Spieler B). Storage of notes and dated chronicle entries, separation of two own figures, privacy against a second
// player and the SL (also with foreign character or note IDs), the journal switch and a live table value.
// Run: CVK_TEST_URL=http://127.0.0.1:8897 node --experimental-strip-types tests/journal-integration.mjs
import assert from 'node:assert/strict';
import {JOURNAL_SECOND_TITLE,JOURNAL_MARKERS} from './fixtures/journal-demo.mjs';

const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8897';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only local isolated instances are allowed.');
let checks=0;const check=(ok,msg)=>{assert.ok(ok,msg);checks++;console.log('PASS JOURNAL '+msg);};
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'})});assert.equal(r.status,200,'login '+id);return r.headers.get('set-cookie').split(';')[0];}
async function req(cookie,path,method='GET',body){const r=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json',Origin:base}:{})},...(body?{body:JSON.stringify(body)}:{})});const text=await r.text();let data=null;try{data=JSON.parse(text);}catch{/* not json */}return {status:r.status,data,text};}
const gm=await login('command-gm'),a=await login('command-a'),b=await login('command-b');
const companion=(who,body)=>req(who,'/api/character-companion','PATCH',body);
const detail=(who,id,extra='')=>req(who,'/api/character-detail?id='+encodeURIComponent(id)+extra);

const list=await req(a,'/api/records?kind=charaktere');
const ownRows=list.data?.records||list.data?.entries||list.data||[];
// The fixture's primary figure is the one carrying the legacy note; select it explicitly (a browser session may have switched).
const primaryRow=ownRows.find?.(r=>/Regiecharakter A|Nachtläufer A/.test(r.title));
assert.ok(primaryRow,'primary figure from the fixture');
check((await req(a,'/api/character-selection','PATCH',{characterId:primaryRow.id})).status===200,'Player A selects the own primary figure');
const primary=(await req(a,'/api/character-selection')).data.characterId;
check(primary===primaryRow.id,'Player A has an active own figure');
const secondId=ownRows.find?.(r=>r.title===JOURNAL_SECOND_TITLE)?.id;
assert.ok(secondId,'second own figure from the fixture: '+list.text.slice(0,200));

// Old notes keep working: no marker = "Meine Notizen"; shared notes and unbound notes are handled separately.
let p=(await detail(a,primary,'&journal=1')).data;
const legacy=p.companion.notes.find(n=>n.text.includes(JOURNAL_MARKERS.legacy));
check(legacy&&legacy.journalKind==='note'&&legacy.playDate===null,'an existing note without marker appears as a note');
check(p.companion.notes.some(n=>n.text.includes(JOURNAL_MARKERS.group)&&n.visibility==='group'),'the shared note stays visible to its owner as shared (the book filters it out)');
check(p.companion.unboundNotes?.some(n=>n.text.includes(JOURNAL_MARKERS.unbound)),'own unbound note stays reachable in the personal projection');
check(!(await detail(a,primary)).data.companion.unboundNotes,'unbound notes are only added on the journal request');

// Create: note and dated chronicle entry, validation of the play date.
const note=await companion(a,{action:'note.create',characterId:primary,title:'Namen aus der Bar',text:'JOURNAL_PRIVATE_NOTE Ilse, Barkeeper.',visibility:'private',journalKind:'note'});
check(note.status===200,'private note is saved');
check((await companion(a,{action:'note.create',characterId:primary,text:'ohne Datum',visibility:'private',journalKind:'chronicle'})).status===400,'a chronicle entry without play date is refused');
check((await companion(a,{action:'note.create',characterId:primary,text:'x',visibility:'private',journalKind:'chronicle',playDate:'1998-02-30'})).status===400,'an impossible play date is refused');
check((await companion(a,{action:'note.create',characterId:primary,text:'x',visibility:'private',journalKind:'diary'})).status===400,'an unknown entry kind is refused');
const entry=await companion(a,{action:'note.create',characterId:primary,title:'Begegnung im Hafen',text:'JOURNAL_PRIVATE_CHRONICLE Der Mann mit dem Hut.',visibility:'private',journalKind:'chronicle',playDate:'1998-03-14'});
check(entry.status===200&&entry.data.version===1,'dated chronicle entry is saved');
p=(await detail(a,primary)).data;
const savedEntry=p.companion.notes.find(n=>n.id===entry.data.id);
check(savedEntry?.journalKind==='chronicle'&&savedEntry.playDate==='1998-03-14'&&savedEntry.visibility==='private','after reload the entry is a chronicle entry with its play date');
check(p.companion.notes.find(n=>n.id===note.data.id)?.journalKind==='note','after reload the note is a note');

// Update: the play date is the player's own; an older client that omits the fields keeps them; stale versions conflict.
let r=await companion(a,{action:'note.update',characterId:primary,noteId:entry.data.id,version:1,title:'Begegnung im Hafen',text:'JOURNAL_PRIVATE_CHRONICLE geändert.',visibility:'private',journalKind:'chronicle',playDate:'1998-03-15'});
check(r.status===200&&r.data.version===2,'chronicle entry is updated with a new play date');
r=await companion(a,{action:'note.update',characterId:primary,noteId:entry.data.id,version:2,title:'Begegnung im Hafen',text:'Vom alten Charakterformular gespeichert.',visibility:'private'});
p=(await detail(a,primary)).data;
check(r.status===200&&p.companion.notes.find(n=>n.id===entry.data.id).playDate==='1998-03-15'&&p.companion.notes.find(n=>n.id===entry.data.id).journalKind==='chronicle','an update without the new fields keeps kind and play date (backwards compatible)');
check((await companion(a,{action:'note.update',characterId:primary,noteId:entry.data.id,version:2,text:'veraltet',visibility:'private'})).status===409,'a stale version is a conflict, nothing is overwritten');
check((await companion(a,{action:'note.update',characterId:primary,noteId:entry.data.id,version:3,text:'x',visibility:'private',playDate:null})).status===400,'a chronicle entry cannot lose its play date');

// Two own figures stay separate.
const secondNote=await companion(a,{action:'note.create',characterId:secondId,title:'Zweite Figur',text:'JOURNAL_SECOND_FIGURE_NOTE',visibility:'private',journalKind:'note'});
check(secondNote.status===200,'a note for the second own figure is saved');
const first=JSON.stringify((await detail(a,primary)).data.companion.notes),second=JSON.stringify((await detail(a,secondId)).data.companion.notes);
check(!first.includes('JOURNAL_SECOND_FIGURE_NOTE')&&second.includes('JOURNAL_SECOND_FIGURE_NOTE')&&!second.includes('JOURNAL_PRIVATE_CHRONICLE'),'notes of two own figures do not mix');
check((await companion(a,{action:'note.update',characterId:secondId,noteId:entry.data.id,version:3,text:'falsche Figur',visibility:'private'})).status===404,'a note cannot be saved through another own figure');

// Second player: no access with foreign character or note IDs.
const bText=(await detail(b,primary)).text;
check((await detail(b,primary)).status===404&&!bText.includes('JOURNAL_PRIVATE'),'player B cannot open A\'s personal projection');
check((await detail(b,primary,'&view=sl')).status===403,'player B cannot use the SL inspection');
check([403,404].includes((await companion(b,{action:'note.update',characterId:primary,noteId:entry.data.id,version:3,text:'B schreibt',visibility:'private'})).status),'player B cannot change A\'s note with A\'s character ID');
let bOwn=(await req(b,'/api/character-selection')).data.characterId;
if(!bOwn){const own=await req(b,'/api/records?kind=charaktere');const rows=own.data?.records||own.data?.entries||own.data||[];for(const row of rows.filter?.(r=>r.ownerId==='command-b'||r.owner_id==='command-b'||r.canEdit)||[]){if((await req(b,'/api/character-selection','PATCH',{characterId:row.id})).status===200){bOwn=row.id;break;}}}
assert.ok(bOwn,'player B needs an own active figure for the cross-figure checks');
{
 check((await companion(b,{action:'note.update',characterId:bOwn,noteId:entry.data.id,version:3,text:'B schreibt',visibility:'private'})).status===404,'player B cannot change A\'s note through an own character');
 const bp=await detail(b,bOwn,'&journal=1');
 check(!bp.text.includes('JOURNAL_')&&bp.status===200,'player B\'s own book contains nothing of A');
}
check([403,404].includes((await companion(b,{action:'note.create',characterId:primary,text:'B legt an',visibility:'private'})).status),'player B cannot create notes on A\'s figure');

// SL: the inspection view never carries private book texts; personal view and editing are refused.
const sl=await detail(gm,primary,'&view=sl&journal=1');
check(sl.status===200&&!sl.text.includes('JOURNAL_PRIVATE')&&!sl.text.includes(JOURNAL_MARKERS.legacy)&&!sl.text.includes(JOURNAL_MARKERS.unbound)&&!sl.data.companion.unboundNotes,'SL inspection shows the sheet but no private notes, chronicle or unbound notes');
check(sl.text.includes(JOURNAL_MARKERS.group),'shared notes stay visible to the SL as before');
check((await detail(gm,primary)).status===404,'SL cannot request the personal projection of A\'s figure');
check([403,404].includes((await companion(gm,{action:'note.update',characterId:primary,noteId:entry.data.id,version:3,text:'SL schreibt',visibility:'private'})).status),'SL cannot change A\'s private entry');
check((await detail(undefined,primary)).status===401&&(await companion(undefined,{action:'note.create',characterId:primary,text:'x'})).status===401,'anonymous requests are refused');

// Journal switch (local instance on) and the live value of the running table.
const room=(await req(gm,'/api/live-table?view=active')).data.room;
const stageA=(await req(a,'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId))).data,stageG=(await req(gm,'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId))).data;
check(stageA.journalEnabled===true&&stageG.journalEnabled===undefined,'the switch opens the journal for players only');
const before=stageA.vitals.characters.find(c=>c.id===primary);
check(before&&before.own,'the active figure appears in the table values of A');
const spent=await req(a,'/api/live-vitals','POST',{sessionId:room.sessionId,runId:room.runId,characterId:primary,command:{op:'blood.spend',amount:1,note:'Journalabnahme'}});
check(spent.status===200,'an allowed table change (blood spend) succeeds');
const after=(await req(a,'/api/live-stage?sessionId='+encodeURIComponent(room.sessionId))).data.vitals.characters.find(c=>c.id===primary);
const sheet=(await detail(a,primary)).data.sheet;
check(after.vitals.blood.current===before.vitals.blood.current-1&&after.version>before.version&&sheet.blood.current===after.vitals.blood.current,'the table value and the sheet source agree after the change (the open book reloads on the new version)');

// Second figure: sheet special cases arrive unchanged in the projection the book renders.
const s2=(await detail(a,secondId)).data;
check(s2.identity.name===JOURNAL_SECOND_TITLE&&s2.sheet.attributes.Körperkraft===7&&s2.sheet.attributes.Erscheinungsbild===0,'long name, more than five dots and a real zero are kept');
check(s2.sheet.customAbilities.length===2&&s2.sheet.specialties.length===2&&s2.sheet.abilities['Heraldik (Altbestand)']===2,'own abilities, specialties and extra stored abilities are kept');
check(s2.sheet.blood.current===6&&s2.sheet.blood.max===15&&s2.sheet.willpower.temporary===3&&s2.sheet.willpower.permanent===7,'current and maximum resources differ');
console.log('PASS JOURNAL total '+checks+' checks');
