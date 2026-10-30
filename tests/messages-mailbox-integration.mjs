import {randomUUID} from 'node:crypto';

// Mailbox 2.0: personal archive, trash and removal, attachments for every member,
// reply/forward and keeping a letter in "Meine Notizen". Synthetic local data only.
const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1cAAAAASUVORK5CYII=';
export async function messagesMailboxIntegration({req,check,base,ids}) {
  const fileStatus=async(who,id)=>{const r=await fetch(base+'/api/files?id='+encodeURIComponent(id),{headers:ids[who]});await r.arrayBuffer();return r.status;};
  const upload=async(who,visibility,name)=>{const form=new FormData();form.set('file',new Blob([Buffer.from(PNG,'base64')],{type:'image/png'}),name);form.set('visibility',visibility);return (await req('/api/files',who,'POST',form)).d.id;};
  const send=(who,body)=>req('/api/messages',who,'POST',{clientRequestId:randomUUID(),...body});
  const folder=async(who,name)=>(await req('/api/messages?folder='+name,who)).d.messages;
  const has=(list,title)=>list.some(m=>m.title===title);
  const act=(who,action,box,ids)=>req('/api/messages',who,'PATCH',{action,box,ids});

  // SL handout only for Player A, and a group letter for A and B.
  const handout=await upload('gm','sl','MAILBOX_SL_HANDOUT.png');
  const secret=await send('gm',{recipients:['sprint1-a'],title:'MAILBOX_ONLY_A',text:'MAILBOX_TEXT_ONLY_A',fileIds:[handout]});
  check(secret.s===200&&secret.d.sent===1,'MAILBOX SL sends a plain letter with an SL handout to Player A only');
  const toA=secret.d.ids[0];
  const group=await send('gm',{recipients:['sprint1-a','sprint1-b'],title:'MAILBOX_GROUP',text:'MAILBOX_GROUP_TEXT'});
  check(group.s===200&&group.d.sent===2,'MAILBOX SL sends one letter to Player A and Player B');
  const [groupA,groupB]=await Promise.all(['a','b'].map(async who=>(await folder(who,'inbox')).find(m=>m.title==='MAILBOX_GROUP').id));

  // Player B sees nothing of A.
  const inboxB=await folder('b','inbox');
  check(!has(inboxB,'MAILBOX_ONLY_A')&&!JSON.stringify(inboxB).includes('MAILBOX_TEXT_ONLY_A'),'MAILBOX Player B inbox lists nothing addressed only to A');
  check((await req('/api/messages?id='+toA,'b')).s===404&&(await fileStatus('b',handout))===404,'MAILBOX Player B can neither open A\'s letter nor its attachment');
  check((await act('b','archive','in',[toA])).s===404&&(await act('b','trash','in',[groupA])).s===404,'MAILBOX Player B cannot archive or delete A\'s copies');
  check((await req('/api/messages','b','PATCH',{action:'to-notes',box:'in',id:toA})).s===404,'MAILBOX Player B cannot copy A\'s letter into own notes');
  for(const name of ['archive','trash'])check(!has(await folder('b',name),'MAILBOX_ONLY_A'),'MAILBOX Player B '+name+' stays free of A\'s letters');
  const detailA=(await req('/api/messages?id='+toA,'a')).d.messages[0];
  check(detailA.attachments.length===1&&detailA.attachments[0].forwardable===false&&(await fileStatus('a',handout))===200,'MAILBOX Player A reads the SL attachment, marked as not forwardable');

  // Archive and delete act only on the own copy.
  check((await act('a','archive','in',[groupA])).s===200,'MAILBOX Player A archives the group letter');
  check(!has(await folder('a','inbox'),'MAILBOX_GROUP')&&has(await folder('a','archive'),'MAILBOX_GROUP'),'MAILBOX archived letter moves from A\'s inbox to A\'s archive');
  check(has(await folder('b','inbox'),'MAILBOX_GROUP')&&!has(await folder('b','archive'),'MAILBOX_GROUP'),'MAILBOX Player B keeps the group letter in the inbox');
  const sentGm=(await folder('gm','sent')).filter(m=>m.title==='MAILBOX_GROUP');
  check(sentGm.length===1&&sentGm[0].recipients.length===2,'MAILBOX sender sees one grouped sent letter with both recipients');
  check((await act('a','remove','in',[groupA])).s===409,'MAILBOX removal requires the trash first');
  check((await act('a','trash','in',[groupA])).s===200&&has(await folder('a','trash'),'MAILBOX_GROUP')&&!has(await folder('a','archive'),'MAILBOX_GROUP'),'MAILBOX Player A moves the letter to the trash');
  check((await act('a','restore','in',[groupA])).s===200&&has(await folder('a','archive'),'MAILBOX_GROUP'),'MAILBOX restore returns the letter to its previous folder');
  check((await act('a','trash','in',[groupA])).s===200&&(await act('a','remove','in',[groupA])).s===200,'MAILBOX Player A removes the letter from the own mailbox');
  for(const name of ['inbox','archive','trash'])check(!has(await folder('a',name),'MAILBOX_GROUP'),'MAILBOX removed letter is gone from A\'s '+name);
  check((await req('/api/messages?id='+groupA,'a')).s===404&&(await act('a','restore','in',[groupA])).s===404,'MAILBOX removed copy can no longer be opened or restored by A');
  check((await req('/api/messages?id='+groupB,'b')).s===200&&has(await folder('gm','sent'),'MAILBOX_GROUP'),'MAILBOX Player B and the sender keep their copies after A\'s removal');

  // Read markers and the sender's own folders.
  const unread=(await req('/api/messages','b')).d.unread;
  check((await act('b','read','in',[groupB])).s===200&&(await req('/api/messages','b')).d.unread===unread-1,'MAILBOX Player B marks a letter read');
  check((await act('b','unread','in',[groupB])).s===200&&(await req('/api/messages','b')).d.unread===unread,'MAILBOX Player B marks it unread again');
  check((await act('gm','read','out',[groupB])).s===409,'MAILBOX sender cannot set recipient read markers');
  check((await act('gm','archive','out',[groupB])).s===200,'MAILBOX sender archives the sent letter');
  check(!has(await folder('gm','sent'),'MAILBOX_GROUP')&&(await folder('gm','archive')).filter(m=>m.title==='MAILBOX_GROUP').length===1,'MAILBOX the whole sent letter moves to the sender archive once');
  check(has(await folder('b','inbox'),'MAILBOX_GROUP'),'MAILBOX sender archive leaves the recipient untouched');
  check((await req('/api/messages','a','PATCH',{id:toA})).s===200,'MAILBOX legacy read command keeps working');

  // Attachments for players, reply and forward.
  const own=await upload('a','private','MAILBOX_A_PICTURE.png');
  const picture=await send('a',{recipients:['sprint1-b'],title:'MAILBOX_A_TO_B_PICTURE',text:'',fileIds:[own]});
  check(picture.s===200,'MAILBOX Player A sends an own picture without text');
  check((await fileStatus('b',own))===200&&(await fileStatus('gm',own))===404,'MAILBOX recipient opens the attachment; the SL does not gain access');
  const pictureB=(await req('/api/messages?id='+picture.d.ids[0],'b')).d.messages[0];
  check(pictureB.attachments[0].id===own&&pictureB.attachments[0].forwardable===false,'MAILBOX received player attachment is shown but not re-shareable by B');
  check((await send('a',{recipients:['sprint1-b'],title:'MAILBOX_LEAK',text:'x',fileIds:[handout],forwardOfId:toA})).s===404,'MAILBOX an SL handout cannot be forwarded to another player');
  check((await send('b',{recipients:['sprint1-a'],title:'MAILBOX_FORGE',text:'x',forwardOfId:toA})).s===404,'MAILBOX foreign letters cannot be referenced in a forward');
  const forward=await send('a',{recipients:['sprint1-b'],title:'Wg: MAILBOX_ONLY_A',text:'Weitergeleitet ohne Unterlage',forwardOfId:toA});
  check(forward.s===200&&(await fileStatus('b',handout))===404,'MAILBOX text forward works and still grants no SL file');
  // The suite's SL account has no campaign membership row, so B answers A's letter.
  const reply=await send('b',{recipients:['sprint1-a'],title:'Re: MAILBOX_A_TO_B_PICTURE',text:'Antwort',replyToId:pictureB.id});
  check(reply.s===200&&(await req('/api/messages?id='+reply.d.ids[0],'a')).d.messages[0].replyToId===pictureB.id,'MAILBOX Player B replies with a thread reference');

  // Keeping a letter in the own notes.
  const kept=await req('/api/messages','a','PATCH',{action:'to-notes',box:'in',id:toA});
  check(kept.s===200&&kept.d.existing===false,'MAILBOX Player A keeps the letter in "Meine Notizen"');
  check((await req('/api/messages','a','PATCH',{action:'to-notes',box:'in',id:toA})).d.noteId===kept.d.noteId,'MAILBOX keeping is idempotent');
  const note=(await req('/api/records?kind=notizen','a')).d.records.find(r=>r.id===kept.d.noteId);
  check(note&&note.visibility==='private'&&note.body.text==='MAILBOX_TEXT_ONLY_A'&&note.body.sourceMessageId===toA&&note.body.attachments[0].id===handout&&!note.gmBody,'MAILBOX note is private and holds text and attachment reference only');
  check(!JSON.stringify((await req('/api/records?kind=notizen','b')).d).includes(kept.d.noteId)&&!JSON.stringify((await req('/api/records?kind=notizen','gm')).d).includes(kept.d.noteId),'MAILBOX the kept note is invisible to Player B and the SL');
  check((await act('a','trash','in',[toA])).s===200&&(await act('a','remove','in',[toA])).s===200,'MAILBOX Player A removes the original letter');
  check((await fileStatus('a',handout))===200&&(await fileStatus('b',handout))===404,'MAILBOX the kept note keeps A\'s attachment access, B still has none');
  const plainLetter=await send('gm',{recipients:['sprint1-b'],title:'MAILBOX_UNKEPT',text:'x',fileIds:[await upload('gm','sl','MAILBOX_UNKEPT.png')]});
  const unkeptId=plainLetter.d.ids[0],unkeptFile=(await req('/api/messages?id='+unkeptId,'b')).d.messages[0].attachments[0].id;
  check((await act('b','trash','in',[unkeptId])).s===200&&(await act('b','remove','in',[unkeptId])).s===200&&(await fileStatus('b',unkeptFile))===404,'MAILBOX removing an unkept letter also ends its attachment access');
  check((await req('/api/records','a','POST',{kind:'notizen',title:'x',visibility:'private',body:{context:'sl-message',text:'forge'}})).s===403,'MAILBOX generic records route still cannot forge letters');
}
