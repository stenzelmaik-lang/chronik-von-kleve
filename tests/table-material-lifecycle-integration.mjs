import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
// Ends its explicitly separate synthetic evening; never run against the interactive acceptance server.
const base=process.env.CVK_LIFECYCLE_TEST_URL||'http://127.0.0.1:8884';assert.match(base,/^http:\/\/127\.0\.0\.1:8884$/);
const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:'command-gm@example.invalid',password:'ChroniPlay-Demo-2036!'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
let count=0;
const call=async(path,method='GET',data,expected=200)=>{const form=data instanceof FormData,r=await fetch(base+path,{method,headers:{Cookie:cookie,...(method!=='GET'?{Origin:base,...(!form?{'Content-Type':'application/json'}:{})}:{})},...(data?{body:form?data:JSON.stringify(data)}:{})});const type=r.headers.get('content-type')||'',text=type.includes('json')?await r.text():(await r.arrayBuffer(),'');assert.equal(r.status,expected,path+': '+text);count++;return text?JSON.parse(text):null;};
const active=await call('/api/live-table?view=active');assert.ok(active.room?.title.startsWith('SYNTHETISCH')&&active.room.started);
const {sessionId,runId}=active.room,q='/api/live-stage?sessionId='+sessionId;
const material=(await call('/api/table-materials','POST',{material:{title:'SYNTHETISCH – geschlossene Sitzung '+randomUUID(),kind:'document',text:'Arbeitsfassung bleibt im Verlauf',fileId:''}})).material;
const s=await call(q);await call('/api/live-stage','POST',{sessionId,runId,expectedVersion:s.version,command:{action:'add',kind:'document',sourceId:material.id,sourceKind:'record',visible:true,recipients:null}});
await call('/api/table-materials','DELETE',{id:material.id,version:material.version},409);
await call('/api/live-table','POST',{action:'end',sessionId,runId});
await call('/api/table-materials','DELETE',{id:material.id,version:material.version});
console.log('PASS Closed session retains its working-copy history without permanently locking the private template');

const form=new FormData();form.set('visibility','private');form.set('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ZkAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'SYNTHETISCH – Avatar-Referenz.png');
const file=await call('/api/files','POST',form),before=await call('/api/profile');
await call('/api/profile','PATCH',{version:before.version,displayName:before.displayName,avatarFileId:file.id,preferences:before.preferences});
await call('/api/files','DELETE',{id:file.id},409);const after=await call('/api/profile');assert.equal(after.avatarFileId,file.id);count++;
await call('/api/profile','PATCH',{version:after.version,displayName:before.displayName,avatarFileId:before.avatarFileId,preferences:before.preferences});
await call('/api/files','DELETE',{id:file.id});
console.log('PASS Referenced profile avatar cannot be deleted; synthetic profile restored before removing the unused file');
console.log('ALL PASS: '+count+' isolated lifecycle/avatar checks');
