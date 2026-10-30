import test from 'node:test';
import assert from 'node:assert/strict';
import {mailActionPatch,mailActionSchema,mailCopySchema,mailFolder,mailFolderSql,mailQuote,mailSubject,personalMessageSchema} from '../domain/personal-message.ts';

const now='2026-10-30T20:00:00.000Z';
const apply=(body,box,action)=>{const r=mailActionPatch(body,box,action,now);assert.ok('patch' in r,r.error);return {...body,...r.patch};};

test('folders are personal: recipient and sender fields never mix',()=>{
  const letter={context:'sl-message',readAt:null};
  assert.equal(mailFolder(letter,'in'),'inbox');assert.equal(mailFolder(letter,'out'),'sent');
  const archived=apply(letter,'in','archive');
  assert.equal(mailFolder(archived,'in'),'archive');assert.equal(mailFolder(archived,'out'),'sent');
  const senderTrash=apply(letter,'out','trash');
  assert.equal(mailFolder(senderTrash,'out'),'trash');assert.equal(mailFolder(senderTrash,'in'),'inbox');
});
test('trash restores to the previous folder and removal needs the trash first',()=>{
  let body=apply({},'in','archive');body=apply(body,'in','trash');
  assert.equal(mailFolder(body,'in'),'trash');
  assert.equal(mailFolder(apply(body,'in','restore'),'in'),'archive');
  assert.match(mailActionPatch({},'in','remove',now).error,/Papierkorb/);
  const removed=apply(body,'in','remove');assert.equal(mailFolder(removed,'in'),null);
  assert.match(mailActionPatch(removed,'in','restore',now).error,/nicht verfügbar/);
});
test('archiving from the trash moves the letter out of the trash',()=>{
  const body=apply(apply({},'in','trash'),'in','archive');
  assert.equal(mailFolder(body,'in'),'archive');
  assert.match(mailActionPatch({},'in','unarchive',now).error,/archivierte/);
});
test('read markers belong to the recipient and keep the first read time',()=>{
  assert.match(mailActionPatch({},'out','read',now).error,/erhaltene/);
  assert.equal(apply({readAt:'2026-01-01T00:00:00.000Z'},'in','read').readAt,'2026-01-01T00:00:00.000Z');
  assert.equal(apply({readAt:'2026-01-01T00:00:00.000Z'},'in','unread').readAt,null);
});
test('folder SQL only uses constant field names',()=>{
  assert.equal(mailFolderSql('inbox','in'),"json_extract(body,'$.removedAt') IS NULL AND json_extract(body,'$.trashedAt') IS NULL AND json_extract(body,'$.archivedAt') IS NULL");
  assert.match(mailFolderSql('trash','out'),/senderRemovedAt.*senderTrashedAt'\) IS NOT NULL/);
  assert.match(mailFolderSql('archive','out'),/senderArchivedAt'\) IS NOT NULL/);
});
test('action and copy commands are strict and bounded',()=>{
  assert.ok(mailActionSchema.safeParse({action:'archive',box:'in',ids:['m1']}).success);
  assert.ok(!mailActionSchema.safeParse({action:'purge',box:'in',ids:['m1']}).success);
  assert.ok(!mailActionSchema.safeParse({action:'archive',box:'in',ids:Array.from({length:51},(_,i)=>'m'+i)}).success);
  assert.ok(!mailActionSchema.safeParse({action:'archive',box:'in',ids:['m1'],owner:'x'}).success);
  assert.ok(mailCopySchema.safeParse({action:'to-notes',box:'in',id:'m1'}).success);
  assert.ok(!mailCopySchema.safeParse({action:'to-notes',box:'in',id:'m1',characterId:'x'}).success);
});
test('plain letters may carry attachments, also without text',()=>{
  const base={clientRequestId:'7d4c8f7e-7c43-4d59-9a6a-0f6c7b0d3a11',recipients:['b'],title:'Karte'};
  assert.ok(personalMessageSchema.safeParse({...base,text:'',fileIds:['f1']}).success);
  assert.ok(!personalMessageSchema.safeParse({...base,text:' '}).success);
  assert.ok(!personalMessageSchema.safeParse({...base,text:'x',replyToId:'a',forwardOfId:'b'}).success);
  assert.ok(personalMessageSchema.safeParse({...base,text:'x',replyToId:'a'}).success);
});
test('subjects and quotes follow mail conventions',()=>{
  assert.equal(mailSubject('Re: AW: Treffen','reply'),'Re: Treffen');
  assert.equal(mailSubject('Treffen','forward'),'Wg: Treffen');
  assert.ok(mailSubject('x'.repeat(200),'reply').length<=160);
  const quote=mailQuote('Zeile 1\nZeile 2',{senderName:'SL',createdAt:now,title:'Treffen'},'reply');
  assert.match(quote,/schrieb SL:\n> Zeile 1\n> Zeile 2$/);
  assert.match(mailQuote('Text',{senderName:'SL',createdAt:now,title:'Treffen'},'forward'),/Weitergeleiteter Brief[\s\S]*Betreff: Treffen/);
});
