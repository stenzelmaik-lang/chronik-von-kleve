import test from 'node:test';
import assert from 'node:assert/strict';
import {journalKindOf,validPlayDate,formatPlayDate,bookEntries,noteEntries,chronicleEntries,draftDirty,draftProblem,draftRequest,nextTurn,clampSpread,registerStart,registerOf,spreadIndex,journalAvailable,sheetNumber,dotSlots,dotLabel,JOURNAL_SPREADS,SHEET_JUMPS} from '../domain/journal.ts';

const note=(over={})=>({id:'n',title:'T',text:'x',visibility:'private',version:1,createdAt:'2026-11-01T10:00:00Z',updatedAt:'2026-11-01T10:00:00Z',canEdit:true,...over});

test('older notes without a marker are notes; only an explicit chronicle marker makes a chronicle entry', () => {
  assert.equal(journalKindOf({}),'note');
  assert.equal(journalKindOf({journalKind:'chronicle'}),'chronicle');
  assert.equal(journalKindOf({journalKind:'weird'}),'note');
});

test('play date is an ISO calendar date with real month lengths', () => {
  for (const ok of ['1998-03-14','2000-02-29','0001-01-01','2026-12-31']) assert.ok(validPlayDate(ok),ok);
  for (const bad of ['1998-3-14','1999-02-29','1900-02-29','2026-13-01','2026-04-31','0000-01-01','',null,19980314,'14.03.1998']) assert.equal(validPlayDate(bad),false,String(bad));
  assert.equal(formatPlayDate('1998-03-14'),'14. März 1998');
  assert.equal(formatPlayDate(null),'Ohne Spieldatum');
  assert.equal(formatPlayDate('irgendwann'),'irgendwann','invalid stored values stay visible');
});

test('the book shows only own private entries; notes by last change, chronicle by play date', () => {
  const notes=[
    note({id:'a',updatedAt:'2026-11-02T00:00:00Z'}),
    note({id:'b',updatedAt:'2026-11-03T00:00:00Z',journalKind:'note'}),
    note({id:'shared',visibility:'group'}),
    note({id:'sl',visibility:'sl'}),
    note({id:'foreign',canEdit:false}),
    note({id:'c2',journalKind:'chronicle',playDate:'1998-03-15',createdAt:'2026-11-01T00:00:00Z'}),
    note({id:'c1',journalKind:'chronicle',playDate:'1998-03-14',createdAt:'2026-11-05T00:00:00Z'}),
    note({id:'c3',journalKind:'chronicle',playDate:'1998-03-15',createdAt:'2026-11-02T00:00:00Z'}),
    note({id:'cx',journalKind:'chronicle',playDate:null}),
  ];
  assert.deepEqual(bookEntries(notes).map(n=>n.id).sort(),['a','b','c1','c2','c3','cx']);
  assert.deepEqual(noteEntries(notes).map(n=>n.id),['b','a']);
  assert.deepEqual(chronicleEntries(notes).map(n=>n.id),['c1','c2','c3','cx']);
});

test('a draft is bound to its character and builds the matching companion request', () => {
  const draft={characterId:'char-1',characterName:'A',kind:'chronicle',title:' Nacht ',text:'Text',playDate:'1998-03-14'};
  assert.deepEqual(draftRequest(draft),{action:'note.create',characterId:'char-1',title:'Nacht',text:'Text',visibility:'private',journalKind:'chronicle',playDate:'1998-03-14'});
  const update=draftRequest({...draft,noteId:'n1',version:3,kind:'note'});
  assert.equal(update.action,'note.update');assert.equal(update.characterId,'char-1');assert.equal(update.noteId,'n1');assert.equal(update.version,3);
  assert.equal('playDate' in update,false,'notes never send a play date');
  assert.equal(draftRequest({...draft,title:''}).title,undefined,'empty title uses the server default');
  assert.equal(draftProblem({...draft,playDate:''}),'Bitte ein gültiges Spieldatum wählen.');
  assert.equal(draftProblem({...draft,text:'  '}),'Bitte einen Text eintragen.');
  assert.equal(draftProblem(draft),'');
  assert.equal(draftProblem({...draft,kind:'note',playDate:''}),'','notes need no play date');
});

test('dirty state compares against the opened version', () => {
  assert.equal(draftDirty(null),false);
  assert.equal(draftDirty({characterId:'c',characterName:'',kind:'note',title:'',text:'',playDate:''}),false);
  assert.equal(draftDirty({characterId:'c',characterName:'',kind:'note',title:'x',text:'',playDate:''}),true);
  const base={title:'a',text:'b',playDate:''};
  assert.equal(draftDirty({characterId:'c',characterName:'',kind:'note',...base,base}),false);
  assert.equal(draftDirty({characterId:'c',characterName:'',kind:'note',...base,text:'c',base}),true);
});

test('fast navigation keeps one target; the turn goes there in one sweep', () => {
  assert.equal(nextTurn(2,2),null);
  assert.deepEqual(nextTurn(0,4),{from:0,to:4,forward:true,skip:true});
  assert.deepEqual(nextTurn(3,2),{from:3,to:2,forward:false,skip:false});
  assert.deepEqual(nextTurn(0,99),{from:0,to:JOURNAL_SPREADS.length-1,forward:true,skip:true},'targets are clamped');
  assert.equal(clampSpread(-3),0);assert.equal(clampSpread(1.5),0);
});

test('registers jump to their first spread; sheet quick jumps point at sheet spreads', () => {
  assert.equal(registerStart('chronicle'),0);
  assert.equal(JOURNAL_SPREADS[registerStart('sheet')].register,'sheet');
  assert.equal(registerOf(spreadIndex('sheet-story')),'sheet');
  for (const jump of SHEET_JUMPS) assert.equal(JOURNAL_SPREADS[spreadIndex(jump.spread)].register,'sheet',jump.label);
});

test('journal gate is off by default and never opens production with the local flag alone', () => {
  assert.equal(journalAvailable({},'kleve'),false);
  assert.equal(journalAvailable({AJ01_JOURNAL:'local-only',AUTH_ACCESS_ENVIRONMENT:'local-test'},'kleve'),true);
  assert.equal(journalAvailable({AJ01_JOURNAL:'local-only',AUTH_ACCESS_ENVIRONMENT:'production'},'kleve'),false);
  assert.equal(journalAvailable({AJ01_JOURNAL_CAMPAIGNS:'*'},'kleve'),false,'no wildcard');
  assert.equal(journalAvailable({AJ01_JOURNAL_CAMPAIGNS:' other , kleve '},'kleve'),true);
  assert.equal(journalAvailable({AJ01_JOURNAL_CAMPAIGNS:'kleve'},''),false);
});

test('sheet values: missing stays missing, zero stays zero, more than five dots are kept', () => {
  assert.equal(sheetNumber(undefined),null);assert.equal(sheetNumber(''),null);assert.equal(sheetNumber(null),null);
  assert.equal(sheetNumber(0),0);assert.equal(sheetNumber('3'),3);assert.equal(sheetNumber(7.9),7);
  assert.equal(dotSlots(null),5);assert.equal(dotSlots(3),5);assert.equal(dotSlots(7),7);assert.equal(dotSlots(8,10),10);
  assert.equal(dotLabel('Stärke',null),'Stärke: nicht erfasst');
  assert.equal(dotLabel('Stärke',0),'Stärke: 0');
  assert.equal(dotLabel('Blut',4,13),'Blut: 4 von 13');
});

import {JOURNAL_VIEWS,viewAfterEscape,clampPlace,addBookmark,removeBookmark,readBookmarks,OWN_BOOKMARK_LIMIT,JOURNAL_REGISTERS} from '../domain/journal.ts';
test('the book is an object on the table: stored, closed, open, large; Escape steps back but never packs away', () => {
  assert.deepEqual([...JOURNAL_VIEWS],['stored','closed','open','large']);
  assert.equal(viewAfterEscape('large'),'open');
  assert.equal(viewAfterEscape('open'),'closed');
  assert.equal(viewAfterEscape('closed'),'closed');
  assert.equal(viewAfterEscape('stored'),'stored');
});
test('the book stays grabbable inside the play area wherever it is dropped', () => {
  const area={left:56,top:56,right:1600,bottom:900},book={width:800,height:500};
  const far=clampPlace({cx:99999,cy:99999},book,area);
  assert.ok(far.cx-book.width/2<=area.right-80&&far.cy-book.height/2<=area.bottom-80,'at least 80px stay visible');
  const top=clampPlace({cx:-500,cy:-500},book,area);
  assert.ok(top.cx+book.width/2>=area.left+80&&top.cy-book.height/2>=area.top+48,'the tool strip above the book stays below the top bar');
  assert.deepEqual(clampPlace({cx:800,cy:450},book,area),{cx:800,cy:450},'an ordinary place is kept');
});
test('ribbons: one per area (register); own bookmarks are laid in, limited, never doubled and taken out again', () => {
  assert.deepEqual(JOURNAL_REGISTERS.map(r=>r.id),['chronicle','sheet'],'area ribbons follow the registers');
  let list=[];
  list=addBookmark(list,{spread:1,page:0,label:'Chronik',noteId:'n1',kind:'chronicle'},'a');
  assert.equal(list.length,1);assert.equal(list[0].noteId,'n1');
  assert.equal(addBookmark(list,{spread:1,page:0,label:'Chronik',noteId:'n1',kind:'chronicle'},'b'),null,'same page and entry is not marked twice');
  list=addBookmark(list,{spread:1,page:0,label:'Chronik'},'b');
  list=addBookmark(list,{spread:3,page:1,label:'Zustände'},'c');
  list=addBookmark(list,{spread:4,page:0,label:'Geschichte'},'d');
  assert.equal(list.length,OWN_BOOKMARK_LIMIT);
  assert.equal(new Set(list.map(b=>b.color)).size,OWN_BOOKMARK_LIMIT,'each own ribbon has its own colour');
  assert.equal(addBookmark(list,{spread:0,page:0,label:'x'},'e'),null,'at most four own ribbons');
  list=removeBookmark(list,'b');
  const again=addBookmark(list,{spread:2,page:0,label:'Attribute'},'f');
  assert.equal(again.at(-1).color,['#4a552e','#4c3244','#8a6a30','#2b2520'][1],'a freed colour is reused');
  assert.deepEqual(readBookmarks([{id:'x',spread:99,page:7,label:'L',color:'#bad',icon:'evil'},{nope:1},'s']),[{id:'x',spread:JOURNAL_SPREADS.length-1,page:0,label:'L',color:'#4a552e',icon:'star'}],'stored values are sanitised');
});
