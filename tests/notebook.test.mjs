import test from 'node:test';
import assert from 'node:assert/strict';
import {isNotebookRow,pageFromRow,pageDate,normalizeTags,deriveTitle,applyPageEdit,sortPages,tagIndex,searchPages,draftDiffers,draftFromPage,slMayRead,today,plainText,SEARCH_PAGE_LIMIT} from '../domain/notebook.ts';

const row=(body,over={})=>({id:'p1',owner_id:'me',title:'Titel',visibility:'private',body:JSON.stringify(body),version:3,created_at:'2026-11-01T20:00:00.000Z',updated_at:'2026-11-02T08:00:00.000Z',...over});

test('only own, real notes are pages: system records, archived and foreign rows stay out', () => {
  assert.ok(isNotebookRow(row({text:'x'}),'me'));
  assert.ok(isNotebookRow(row({text:'x',context:'character-companion',characterId:'c1'}),'me'),'character notes are pages');
  assert.equal(isNotebookRow(row({text:'x'}),'someone'),false,'foreign rows');
  for (const context of ['live-table','live-table-signal','live-table-event','sl-message','appointment-vote','table-material','display-asset'])
    assert.equal(isNotebookRow(row({context}),'me'),false,context);
  assert.equal(isNotebookRow(row({text:'x',archived:true}),'me'),false,'archived character notes');
  assert.equal(isNotebookRow(row({},{body:'kein JSON'}),'me'),true,'a broken body is still the owner\'s note');
});

test('every older note shape becomes a page with the right source, date and deletion', () => {
  const journal=pageFromRow(row({context:'character-companion',characterId:'c1',text:'cvk-html-v1:<p>Hafen</p>',journalKind:'chronicle',playDate:'1998-03-14'}));
  assert.deepEqual([journal.source,journal.date,journal.rich,journal.deletion,journal.characterId],['figur','1998-03-14',true,'archive','c1']);
  const place=pageFromRow(row({text:'Verdacht',locationId:'place.a',targetId:'place.a',noteType:'suspicion'}));
  assert.deepEqual([place.source,place.locationId,place.deletion,place.date],['ort','place.a','delete','2026-11-01']);
  const letter=pageFromRow(row({text:'Brief',sourceMessageId:'m1',date:'2026-10-30',source:'Postfach'}));
  assert.deepEqual([letter.source,letter.date],['postfach','2026-10-30']);
  assert.equal(slMayRead(letter),false,'copied letters stay private');
  assert.equal(slMayRead(place),true);
  assert.deepEqual(pageFromRow(row({tags:['Hafen',' ',3,'Malkavianer']})).tags,['Hafen','Malkavianer']);
});

test('page date prefers the own date, then an older play date, then the creation day', () => {
  assert.equal(pageDate({date:'2026-11-08',playDate:'1998-03-14'},'2026-01-01T00:00:00Z'),'2026-11-08');
  assert.equal(pageDate({date:'kaputt',playDate:'1998-03-14'},'2026-01-01T00:00:00Z'),'1998-03-14');
  assert.equal(pageDate({},'2026-01-05T23:00:00Z'),'2026-01-05');
});

test('tags are the player\'s own words with limits, trimmed and without duplicates', () => {
  assert.deepEqual(normalizeTags(['  Hafen ','hafen','Ilse  Barkeeper','']),{tags:['Hafen','Ilse Barkeeper'],error:''});
  assert.match(normalizeTags(['x'.repeat(41)]).error,/40/);
  assert.match(normalizeTags(Array.from({length:21},(_,i)=>'t'+i)).error,/20/);
  assert.deepEqual(normalizeTags(Array.from({length:20},(_,i)=>'t'+i)).tags.length,20);
  assert.match(normalizeTags([3]).error,/Text/);
});

test('without a title the first line names the page; rich text is read as plain text', () => {
  assert.deepEqual(deriveTitle('  Eigener   Titel ','x'),{title:'Eigener Titel',autoTitle:false});
  assert.deepEqual(deriveTitle('','\n  Erste Zeile\nzweite'),{title:'Erste Zeile',autoTitle:true});
  assert.deepEqual(deriveTitle('','cvk-html-v1:<p><strong>Fett</strong> zuerst</p><p>dann</p>'),{title:'Fett zuerst',autoTitle:true});
  assert.equal(deriveTitle('','').title,'Ohne Titel');
  assert.equal(plainText('cvk-html-v1:<p>a</p><p>b</p>'),'a\nb');
});

test('saving changes only the notebook fields and keeps every other stored field', () => {
  const stored={characterId:'c1',context:'character-companion',journalKind:'chronicle',playDate:'1998-03-14',futureField:{kept:true},autoTitle:true,text:'alt'};
  const saved=applyPageEdit(stored,{title:'Neu',text:'neu',date:'2026-11-08',tags:['Hafen']});
  assert.equal(saved.title,'Neu');
  assert.deepEqual(saved.body,{characterId:'c1',context:'character-companion',journalKind:'chronicle',playDate:'1998-03-14',futureField:{kept:true},text:'neu',date:'2026-11-08',tags:['Hafen']});
  assert.equal(applyPageEdit({},{title:'',text:'Zeile',date:'2026-11-08',tags:[]}).body.autoTitle,true);
  assert.equal(stored.text,'alt','the stored body object is not mutated');
});

test('pages sort by date, newest first, the same day by last change', () => {
  const p=(id,date,updatedAt)=>({id,date,updatedAt});
  assert.deepEqual(sortPages([p('a','2026-11-01','2026-11-01T10'),p('b','2026-11-08','2026-11-08T09'),p('c','2026-11-08','2026-11-08T11'),p('d','1998-03-14','2026-11-09')]).map(x=>x.id),['c','b','a','d']);
});

test('search finds every word in title, text or tags, accent-insensitive, optionally within a tag', () => {
  const pages=[{id:1,title:'Hafen',text:'Ilse am Kai',tags:['Zeugen']},{id:2,title:'Offene Fragen',text:'cvk-html-v1:<p>Wer ist der <strong>Fährmann</strong>?</p>',tags:['Fragen']},{id:3,title:'Elysium',text:'Prinz',tags:['Zeugen','Hof']}];
  assert.deepEqual(searchPages(pages,'ilse kai').map(p=>p.id),[1]);
  assert.deepEqual(searchPages(pages,'fahrmann').map(p=>p.id),[2],'umlauts fold');
  assert.deepEqual(searchPages(pages,'zeugen').map(p=>p.id),[1,3],'tags are searched');
  assert.deepEqual(searchPages(pages,'','zeugen').map(p=>p.id),[1,3]);
  assert.deepEqual(searchPages(pages,'prinz','Zeugen').map(p=>p.id),[3]);
  assert.deepEqual(searchPages(pages,'').map(p=>p.id),[1,2,3]);
  assert.deepEqual(tagIndex(pages),['Zeugen','Fragen','Hof']);
});

test('client-side search stays fast at the size limit', () => {
  const pages=Array.from({length:SEARCH_PAGE_LIMIT},(_,i)=>({id:i,title:'Seite '+i,text:('Ein längerer Absatz über die Nacht in Kleve und ihre Spuren. ').repeat(30)+(i===777?' Fährmann':''),tags:['Tag'+(i%15)]}));
  const start=performance.now();
  const found=searchPages(pages,'fährmann nacht');
  const ms=performance.now()-start;
  assert.deepEqual(found.map(p=>p.id),[777]);
  assert.ok(ms<250,'search over '+SEARCH_PAGE_LIMIT+' pages took '+ms.toFixed(1)+' ms');
  console.log('notebook search: '+SEARCH_PAGE_LIMIT+' pages in '+ms.toFixed(1)+' ms');
});

test('a draft differs only when the player changed something', () => {
  const page=pageFromRow(row({text:'Text',date:'2026-11-08',tags:['A'],autoTitle:true},{title:'Text'}));
  const draft=draftFromPage(page);
  assert.equal(draft.title,'','an automatic title is not shown as own title');
  assert.equal(draftDiffers(draft,page),false);
  assert.equal(draftDiffers({...draft,text:'Text!'},page),true);
  assert.equal(draftDiffers({...draft,tags:['A','B']},page),true);
  assert.equal(draftDiffers({...draft,title:'Eigener'},page),true);
  assert.equal(draftDiffers({pageId:'neu',baseVersion:null,title:'',text:'  ',date:'2026-11-08',tags:[]},null),false,'an empty new page is no draft');
  assert.equal(draftDiffers({pageId:'neu',baseVersion:null,title:'',text:'x',date:'2026-11-08',tags:[]},null),true);
  assert.equal(today(new Date(2026,10,8,23,30)),'2026-11-08');
});
