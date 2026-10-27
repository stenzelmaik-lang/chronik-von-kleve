import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,unlinkSync,rmdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createStage,changeStage,projectStage,NOTE_LIMIT,fitNoteRect} from './stage-state.mjs';
import {writeStage,readStage} from './stage-storage.mjs';
const act=(state,viewer,c)=>changeStage(state,viewer,{...c,expectedVersion:state.version});
function fixture(){const s=createStage();act(s,'a',{action:'add',kind:'note',content:'A PRIVAT\n\nZweite Zeile – äöü 📝'});return {s,n:s.objects[0]};}

test('notes are private by default, owned by the simulated actor, hidden from other players but readable by SL',()=>{
  const {s,n}=fixture();assert.equal(n.ownerId,'a');assert.equal(n.visibility,'private');assert.match(n.id,/^note-[0-9a-f-]{36}$/);
  for(const viewer of ['b']){const p=projectStage(s,viewer);assert.equal(p.objects.length,0);assert.ok(!JSON.stringify(p).includes('A PRIVAT'));}
  assert.equal(projectStage(s,'a').objects[0].content,n.content);assert.equal(projectStage(s,'gm').objects[0].content,n.content);
  act(s,'b',{action:'add',kind:'note',ownerId:'a',visibility:'group',content:'B privat'});
  assert.equal(s.objects[1].ownerId,'b');assert.equal(s.objects[1].visibility,'private');assert.equal(projectStage(s,'a').objects.length,1);assert.equal(projectStage(s,'gm').objects.length,2);assert.equal(projectStage(s,'b').objects[0].ownerId,'b');
});
test('explicit group publication, live edits/moves and revocation use the same projected stage',()=>{
  const {s,n}=fixture();act(s,'a',{action:'visibility',id:n.id,expectedRevision:n.revision,visibility:'group'});
  for(const viewer of ['b','gm'])assert.equal(projectStage(s,viewer).objects[0].id,n.id);
  act(s,'a',{action:'edit',id:n.id,expectedRevision:n.revision,content:'Geändert\n\nAbsatz\n<script>alert(1)</script>'});
  act(s,'a',{action:'move',id:n.id,expectedRevision:n.revision,rect:{x:.4,y:.3,w:.16,h:.27}});
  assert.equal(projectStage(s,'b').objects[0].content,n.content);assert.equal(projectStage(s,'b').objects[0].rect.x,.4);
  const before=structuredClone(n);act(s,'gm',{action:'scene',id:'taberna'});assert.deepEqual(s.objects[0],before);
  act(s,'a',{action:'visibility',id:n.id,expectedRevision:n.revision,visibility:'private'});
  assert.equal(projectStage(s,'b').objects.length,0);assert.equal(projectStage(s,'gm').objects.length,1);
});
test('only the creator edits, moves, removes or shares notes, including group notes',()=>{
  const {s,n}=fixture();
  for(const visibility of ['private','group']){
    act(s,'a',{action:'visibility',id:n.id,expectedRevision:n.revision,visibility});
    for(const viewer of ['b','gm'])for(const c of [{action:'edit',content:'Fremd'},{action:'move',rect:{x:0,y:0,w:.2,h:.3}},{action:'remove'},{action:'visibility',visibility:'group'}]){
      const before=JSON.stringify(s);assert.throws(()=>act(s,viewer,{...c,id:n.id,expectedRevision:n.revision}),{status:403});assert.equal(JSON.stringify(s),before);
    }
  }
  act(s,'a',{action:'remove',id:n.id,expectedRevision:n.revision});assert.equal(s.objects.length,0);
});
test('stale note drafts and global commands fail without overwriting newer content',()=>{
  const {s,n}=fixture(),oldVersion=s.version,oldRevision=n.revision;
  act(s,'a',{action:'edit',id:n.id,expectedRevision:oldRevision,content:'Neuere Fassung'});
  const before=JSON.stringify(s);
  assert.throws(()=>changeStage(s,'a',{action:'edit',id:n.id,content:'Alt',expectedRevision:oldRevision,expectedVersion:oldVersion}),{status:409});
  assert.throws(()=>act(s,'a',{action:'edit',id:n.id,content:'Alt',expectedRevision:oldRevision}),{status:409});
  assert.equal(JSON.stringify(s),before);
});
test('invalid note payloads and ownership spoofing cannot alter the test stage',()=>{
  const {s,n}=fixture();
  for(const c of [{action:'edit',content:'x'.repeat(NOTE_LIMIT+1)},{action:'edit',content:{html:'oops'}},{action:'visibility',visibility:'sl'}]){
    const before=JSON.stringify(s);assert.throws(()=>act(s,'a',{...c,id:n.id,expectedRevision:n.revision}));assert.equal(JSON.stringify(s),before);
  }
  assert.throws(()=>act(s,'a',{action:'edit',id:'missing',content:'fremd',expectedRevision:1}),{status:403});
  assert.throws(()=>act(s,'unknown',{action:'add',kind:'note'}),{status:403});
  act(s,'a',{action:'edit',id:n.id,expectedRevision:n.revision,content:''});assert.equal(n.content,'');
});
test('notes neither replace whiteboard elements nor duplicate NPC/documents',()=>{
  const s=createStage();act(s,'gm',{action:'add',kind:'npc'});act(s,'gm',{action:'add',kind:'document'});
  act(s,'b',{action:'board',operation:'draw',epoch:0,element:{id:'line',points:[[10,10],[20,20]],memberId:'demo-b',name:'Demo B',color:'#d6b36f'}});
  const objects=structuredClone(s.objects),board=structuredClone(s.board);
  act(s,'a',{action:'add',kind:'note',content:'Unabhängig'});const n=s.objects.find(o=>o.kind==='note');
  act(s,'a',{action:'remove',id:n.id,expectedRevision:n.revision});assert.deepEqual(s.objects,objects);assert.deepEqual(s.board,board);
});
test('private local snapshot restores note IDs, text, rights, positions and all existing layers after restart',()=>{
  const dir=mkdtempSync(resolve('.local-work/spieltisch-2/sticky-storage-')),file=join(dir,'state.json');
  try{
    const {s,n}=fixture();act(s,'a',{action:'move',id:n.id,expectedRevision:n.revision,rect:{x:.4,y:.2,w:.16,h:.27}});
    act(s,'gm',{action:'scene',id:'barracks'});act(s,'gm',{action:'add',kind:'document'});writeStage(file,s);
    const restored=readStage(file);assert.deepEqual(restored,s);assert.deepEqual(projectStage(restored,'a'),projectStage(s,'a'));assert.equal(projectStage(restored,'b').objects.length,0);
    const before=readFileSync(file,'utf8');writeFileSync(file,'broken');assert.throws(()=>readStage(file));assert.equal(readFileSync(file,'utf8'),'broken');writeFileSync(file,before);
    const invalid=JSON.parse(before);invalid.state.objects[0].visibility='sl';writeFileSync(file,JSON.stringify(invalid));assert.throws(()=>readStage(file));
  }finally{unlinkSync(file);rmdirSync(dir);}
});
test('bounded local note count rejects excess notes without changing existing content',()=>{
  const s=createStage();for(let i=0;i<30;i++)act(s,'a',{action:'add',kind:'note',content:String(i)});
  const before=JSON.stringify(s);assert.throws(()=>act(s,'a',{action:'add',kind:'note'}));assert.equal(JSON.stringify(s),before);
});

test('readable note rendering stays on stage at desktop and smaller viewport without changing stored dimensions',()=>{
  const original={x:.84,y:.73,w:.16,h:.27},before=structuredClone(original);
  for(const bounds of [{w:1864,h:1024},{w:1864,h:839},{w:904,h:484}]){const r=fitNoteRect(original,bounds);assert.ok(r.x+r.w<=1&&r.y+r.h<=1);assert.ok(r.w*bounds.w>=199.99&&r.h*bounds.h>=234.99);}
  assert.deepEqual(original,before);
});
