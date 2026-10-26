import { randomUUID } from 'node:crypto';

export async function workspaceUxIntegration({req,check}) {
  const before=(await req('/api/command-center','gm')).d;
  const workspace=(await req('/api/command-center/workspace?mode=live','gm')).d;
  const note=await req('/api/records','a','POST',{kind:'notizen',title:'SYNTHETIC UX private quick note',visibility:'private',body:{text:'UX_PRIVATE_QUICK_NOTE_'+randomUUID()}});
  check(note.s===200,'UX quick note uses the existing private Record write path');
  const own=(await req('/api/records?kind=notizen','a')).d.records;
  check(own.some(item=>item.id===note.d.id),'UX quick note readable by its owner');
  for(const who of ['b','gm'])check(!(await req('/api/records?kind=notizen',who)).d.records.some(item=>item.id===note.d.id),'UX private note not exposed to '+who);
  check((await req('/api/records',undefined,'POST',{kind:'notizen',title:'Anonymous note',visibility:'private',body:{text:'denied'}})).s===401,'UX anonymous private note write denied');
  const after=(await req('/api/command-center','gm')).d;
  for(const key of ['characters','sessions','stories','scenes'])check(JSON.stringify(before[key])===JSON.stringify(after[key]),'UX quick note preserves existing '+key);
  check(JSON.stringify(workspace)==JSON.stringify((await req('/api/command-center/workspace?mode=live','gm')).d),'UX private note leaves the saved desktop workspace unchanged');
  for(const who of ['a','b']){
    const scenes=await req('/api/session-scenes',who);
    check(scenes.s===200&&Array.isArray(scenes.d.scenes),'UX dashboard scene reader available to '+who);
    check(scenes.d.scenes.every(scene=>!('gmNotes' in scene)&&!('secrets' in scene)&&!('document' in scene)),'UX scene overview uses only filtered player projection for '+who);
  }
  check((await req('/api/session-scenes')).s===401,'UX anonymous scene overview denied');
}
