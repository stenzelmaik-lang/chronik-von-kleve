// Notizbuch (Etappe 2) against an isolated local instance with the synthetic accounts command-gm, command-a, command-b
// (for example: node --experimental-strip-types scripts/test-local.mjs --command-center).
// Run: CVK_TEST_URL=http://127.0.0.1:<port> node --experimental-strip-types tests/notebook-integration.mjs
import assert from 'node:assert/strict';

const base=process.env.CVK_TEST_URL||'';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only local isolated instances are allowed.');
let checks=0;const check=(ok,msg)=>{assert.ok(ok,msg);checks++;console.log('PASS NOTEBOOK '+msg);};
async function login(id){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'})});assert.equal(r.status,200,'login '+id);return r.headers.get('set-cookie').split(';')[0];}
async function req(cookie,path,method='GET',body,origin=base){const r=await fetch(base+path,{method,headers:{...(origin?{Origin:origin}:{}),...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const text=await r.text();let data=null;try{data=JSON.parse(text);}catch{/* not JSON */}return {status:r.status,data,text};}
const nb=(who,body)=>req(who,'/api/notebook','POST',body);
const pagesOf=async(who,member='')=>(await req(who,'/api/notebook'+(member?'?member='+member:''))).data;

const gm=await login('command-gm'),a=await login('command-a'),b=await login('command-b');
const stamp=Date.now(),M=s=>'NB_'+s+'_'+stamp;
const own=(await req(a,'/api/records?kind=charaktere')).data.records.find(r=>r.owner_id==='command-a');
assert.ok(own,'Player A owns a synthetic character');

// Older notes in every shape exist before the notebook (journal entry, plain note, letter copy, system record).
const legacy=await req(a,'/api/records','POST',{kind:'notizen',title:'Chronik: Hafen',visibility:'private',body:{characterId:own.id,context:'character-companion',text:'cvk-html-v1:<p><strong>'+M('JOURNAL')+'</strong> Hafen.</p>',journalKind:'chronicle',playDate:'1998-03-14',archived:false,futureField:{kept:true}}});
const plain=await req(a,'/api/records','POST',{kind:'notizen',title:'Alte Notiz',visibility:'private',body:{text:M('PLAIN')+' alte Notiz',summary:'kurz'}});
const shared=await req(a,'/api/records','POST',{kind:'notizen',title:'Geteilt mit SL',visibility:'sl',body:{text:M('SHARED')}});
const letter=await req(a,'/api/records','POST',{kind:'notizen',title:'Brief von B',visibility:'private',body:{text:M('LETTER')+' privater Brief',source:'Postfach',sourceMessageId:'msg-'+stamp,date:'2026-11-01'}});
const archived=await req(a,'/api/records','POST',{kind:'notizen',title:'Archiviert',visibility:'private',body:{characterId:own.id,context:'character-companion',text:M('ARCHIVED'),archived:true}});
const bOwn=await req(b,'/api/records','POST',{kind:'notizen',title:'B privat',visibility:'private',body:{text:M('B_PRIVATE')}});
const bGroup=await req(b,'/api/records','POST',{kind:'notizen',title:'B Gruppe',visibility:'group',body:{text:M('B_GROUP')}});
for (const r of [legacy,plain,shared,letter,archived,bOwn,bGroup]) assert.equal(r.status,200,r.text);

// Player A: one list with every own note, older journal entries included, nothing foreign or archived.
let mine=await pagesOf(a);
const find=(data,marker)=>data.pages.find(p=>p.text.includes(marker));
check(mine.readOnly===false&&mine.owner.id==='command-a','Player A opens the own notebook');
const journal=find(mine,M('JOURNAL'));
check(journal&&journal.date==='1998-03-14'&&journal.rich&&journal.source==='figur'&&journal.deletion==='archive','an older journal entry appears, its play date is the page date');
check(find(mine,M('PLAIN'))?.source==='notiz','an older plain note appears');
check(find(mine,M('SHARED'))?.visibility==='sl','an own note shared with the SL appears and keeps its visibility');
check(find(mine,M('LETTER'))?.source==='postfach','a letter copied from the mailbox appears');
check(!find(mine,M('ARCHIVED')),'archived character notes stay out');
check(!find(mine,M('B_PRIVATE'))&&!find(mine,M('B_GROUP')),'foreign notes stay out, also shared group notes');
check(!mine.pages.some(p=>/live-table|sl-message|appointment-vote|table-material|display-asset/.test(JSON.stringify(p))),'system records stay out');
check(mine.characters.some(c=>c.id===own.id),'own characters are offered for the optional binding');

// Create: title optional, date set, tags normalised; a foreign character binding is refused.
const created=await nb(a,{action:'save',title:'',text:M('NEW')+' erste Zeile\nzweite Zeile',date:'2026-11-08',tags:[' Hafen ','hafen','offene Frage'],characterId:own.id});
check(created.status===200&&created.data.page.title===M('NEW')+' erste Zeile'&&created.data.page.autoTitle,'a new page without title is named by its first line');
check(JSON.stringify(created.data.page.tags)===JSON.stringify(['Hafen','offene Frage'])&&created.data.page.characterId===own.id&&created.data.page.visibility==='private','tags are normalised, the page is private and bound to the own character');
const bChar=(await req(b,'/api/records?kind=charaktere')).data.records.find(r=>r.owner_id==='command-b');
if(bChar)check((await nb(a,{action:'save',title:'x',text:'x',date:'2026-11-08',tags:[],characterId:bChar.id})).status===404,'a foreign character binding is refused');
check((await nb(a,{action:'save',title:'',text:'  ',date:'2026-11-08',tags:[]})).status===400,'an empty page is not stored');
check((await nb(a,{action:'save',title:'x',text:'x',date:'2026-02-30',tags:[]})).status===400,'an impossible date is refused');
check((await nb(a,{action:'save',title:'x',text:'x',date:'2026-11-08',tags:Array.from({length:21},(_,i)=>'t'+i)})).status===400,'more than 20 tags are refused');
check((await nb(a,{action:'save',title:'x',text:'x',date:'2026-11-08',tags:['x'.repeat(41)]})).status===400,'a tag over 40 characters is refused');
check((await nb(a,{action:'save',title:'x',text:'x',date:'2026-11-08',tags:[],visibility:'group'})).status===400,'visibility cannot be set through the notebook');

// Save and reload: the edited journal entry keeps every other field; a stale version is refused.
const edited=await nb(a,{action:'save',id:journal.id,version:journal.version,title:'Hafen, neu',text:journal.text,date:'1998-03-15',tags:['Hafen']});
check(edited.status===200,'Player A saves the older journal entry in the notebook');
const raw=(await req(a,'/api/records?kind=notizen')).data.records.find(r=>r.id===journal.id);
check(raw.body.playDate==='1998-03-14'&&raw.body.journalKind==='chronicle'&&raw.body.futureField?.kept===true&&raw.body.context==='character-companion'&&raw.body.characterId===own.id,'unknown and journal fields survive the notebook save');
check(raw.body.date==='1998-03-15'&&raw.title==='Hafen, neu'&&raw.body.text.includes(M('JOURNAL')),'the new date and title are stored, the HTML text is unchanged');
mine=await pagesOf(a);
check(find(mine,M('JOURNAL')).date==='1998-03-15','after reloading the page shows its new date');
const stale=await nb(a,{action:'save',id:journal.id,version:journal.version,title:'veraltet',text:'veraltet',date:'2026-11-08',tags:[]});
check(stale.status===409,'a save with a stale version is refused (conflict)');
check(find(await pagesOf(a),M('JOURNAL')).title==='Hafen, neu','the conflict changed nothing');

// Player B: never reads, writes or deletes A's pages, also with A's ids.
const bView=await pagesOf(b);
check(!JSON.stringify(bView).includes(M('PLAIN'))&&!JSON.stringify(bView).includes(M('JOURNAL')),'Player B does not see any page of Player A');
check((await req(b,'/api/notebook?member=command-a')).status===403,'Player B cannot open Player A\'s notebook by member id');
const plainPage=find(mine,M('PLAIN'));
check((await nb(b,{action:'save',id:plainPage.id,version:plainPage.version,title:'B',text:'B',date:'2026-11-08',tags:[]})).status===404,'Player B cannot edit Player A\'s page');
check((await nb(b,{action:'delete',id:plainPage.id,version:plainPage.version})).status===404,'Player B cannot delete Player A\'s page');
check(find(await pagesOf(a),M('PLAIN')).text.includes(M('PLAIN')),'Player A\'s page is unchanged');

// SL: reads along, never edits, never sees copied letters.
const slView=await pagesOf(gm,'command-a');
check(slView.readOnly===true&&slView.owner.id==='command-a','the SL opens Player A\'s notebook read-only');
check(!!find(slView,M('PLAIN'))&&!!find(slView,M('JOURNAL')),'the SL reads Player A\'s pages');
check(!find(slView,M('LETTER')),'the SL does not see letters Player A copied from the mailbox');
check(slView.characters.length===0,'the SL view lists no character choices');
check((await nb(gm,{action:'save',id:plainPage.id,version:plainPage.version,title:'SL',text:'SL',date:'2026-11-08',tags:[]})).status===404,'the SL cannot edit Player A\'s page');
check((await nb(gm,{action:'delete',id:plainPage.id,version:plainPage.version})).status===404,'the SL cannot delete Player A\'s page');
check((await req(gm,'/api/notebook?member=unbekannt')).status===404,'an unknown member is not found');
const gmOwn=await pagesOf(gm);
check(!JSON.stringify(gmOwn).includes(M('PLAIN')),'the SL\'s own notebook holds only the SL\'s own pages');

// Delete: a plain page is gone for good, a character note is archived and stays stored.
const fresh=find(await pagesOf(a),M('PLAIN'));
check((await nb(a,{action:'delete',id:fresh.id,version:fresh.version})).data?.archived===false,'Player A deletes a plain page for good');
check(!(await req(a,'/api/records?kind=notizen')).data.records.some(r=>r.id===fresh.id),'the deleted page is gone');
const j=find(await pagesOf(a),M('JOURNAL'));
check((await nb(a,{action:'delete',id:j.id,version:j.version})).data?.archived===true,'Player A removes a character note: it is archived');
check(!find(await pagesOf(a),M('JOURNAL'))&&(await req(a,'/api/records?kind=notizen')).data.records.find(r=>r.id===j.id)?.body.archived===true,'the archived note leaves the notebook but stays stored');

// The mailbox action "Ins Notizbuch" lands a real letter as a page; the SL still does not read it there.
const sent=await req(gm,'/api/messages','POST',{clientRequestId:crypto.randomUUID(),recipients:['command-a'],title:'Brief '+stamp,text:M('MAIL')+' Treffen am Kai.'});
check(sent.status===200&&sent.data.sent===1,'the SL sends a letter to Player A');
const kept=await req(a,'/api/messages','PATCH',{action:'to-notes',box:'in',id:sent.data.ids[0]});
check(kept.status===200,'Player A keeps the letter in the notebook');
const keptPage=find(await pagesOf(a),M('MAIL'));
check(keptPage?.source==='postfach'&&keptPage.id===kept.data.noteId,'the kept letter appears as a page in Player A\'s notebook');
check(!find(await pagesOf(gm,'command-a'),M('MAIL')),'the SL does not read the kept letter in Player A\'s notebook');

// Not signed in, foreign origin.
check((await req(null,'/api/notebook')).status===401,'not signed in: GET → 401');
check((await req(null,'/api/notebook','POST',{action:'save',title:'x',text:'x',date:'2026-11-08',tags:[]})).status===401,'not signed in: POST → 401');
check((await req(a,'/api/notebook','POST',{action:'save',title:'x',text:'x',date:'2026-11-08',tags:[]},'https://fremd.example')).status===403,'a request from another website is refused');

// Clean-up of the remaining synthetic rows on this local instance.
for (const [who,data] of [[a,(await req(a,'/api/records?kind=notizen')).data],[b,(await req(b,'/api/records?kind=notizen')).data]])
  for (const r of data.records.filter(r=>JSON.stringify(r.body).includes('_'+stamp)&&r.owner_id===(who===a?'command-a':'command-b')))
    await req(who,'/api/records','DELETE',{id:r.id,version:r.version});
console.log('NOTEBOOK checks passed: '+checks);
