import {randomUUID} from 'node:crypto';
import {engineFixture} from './fixtures/engine-character.mjs';

export async function dashboardHubIntegration({req,check}) {
  check((await req('/api/dashboard')).s===401,'HUB anonymous overview denied');
  for(const role of ['blockedPlayer','otherCampaign']) {
    const r=await req('/api/dashboard',role);
    check(r.s!==200 || !JSON.stringify(r.d).includes('SYNTHETIC MENU CHARACTER'),'HUB foreign and blocked scopes do not inherit campaign characters: '+role);
  }
  const character=await req('/api/records','a','POST',{kind:'charaktere',title:'SYNTHETIC HUB OWNER',visibility:'private',body:{...engineFixture}});
  check(character.s===200,'HUB reuses existing character source');
  const path='/api/dashboard?characterId='+character.d.id;
  const initial=await req(path,'a');
  check(initial.s===200&&initial.d.character.id===character.d.id,'HUB selected owner character and XP remain available');
  check((await req(path,'b')).s===404&&(await req(path,'gm')).s===404,'HUB personal overview rejects foreign character even for SL');
  const form=new FormData();form.set('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1cAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'SYNTHETIC_HUB_PORTRAIT.png');form.set('visibility','private');
  const file=await req('/api/files','a','POST',form);
  const record=(await req('/api/records?kind=charaktere','a')).d.records.find(r=>r.id===character.d.id);
  check((await req('/api/records','a','POST',{...record,body:{...record.body,image:'/api/files?id='+file.d.id}})).s===200,'HUB portrait uses existing private character media');
  check((await req(path,'a')).d.portrait==='/api/files?id='+file.d.id,'HUB authorized original portrait projected');
  const message={clientRequestId:randomUUID(),recipients:['sprint1-b'],title:'HUB PRIVATE LETTER '+randomUUID(),text:'HUB_SECRET_MESSAGE_BODY'};
  check((await req('/api/messages','a','POST',message)).s===200,'HUB message setup uses existing private engine');
  const ownInbox=(await req('/api/dashboard','b')).d;
  check(ownInbox.inbox.unread>0&&ownInbox.inbox.latest.title===message.title,'HUB recipient sees own unread count and latest title');
  check(!JSON.stringify(ownInbox).includes(message.text),'HUB compact overview excludes message body and internal note copies');
  check(!JSON.stringify((await req('/api/dashboard','gm')).d.inbox).includes(message.title),'HUB SL has no overview access to foreign conversation');
  const now=Date.now();
  const post=(kind,title,visibility,body)=>req('/api/records','gm','POST',{kind,title,visibility,body});
  const future=new Date(now+1000*60*60).toISOString();
  const publicDate=await post('termine','HUB public next date','group',{date:future,scheduleKind:'fixed'});
  await post('termine','HUB_SECRET_DATE','sl',{date:new Date(now+1000*60).toISOString()});
  const poll=await req('/api/appointments','gm','POST',{action:'save',title:'HUB public poll',visibility:'group',scheduleKind:'poll',options:[{id:'a',date:future},{id:'b',date:new Date(now+7200000).toISOString()}]});
  check(publicDate.s===200&&poll.s===200,'HUB existing calendar accepts fixed and poll sources');
  const past=await post('sitzungen','HUB public last evening','group',{date:new Date(now-1000).toISOString(),summary:'HUB_RELEASED_SUMMARY'});
  await post('sitzungen','HUB future evening','group',{date:future,summary:'HUB_FUTURE_SUMMARY'});
  await post('sitzungen','HUB_SECRET_EVENING','sl',{date:new Date(now-500).toISOString(),summary:'HUB_SECRET_SUMMARY'});
  const final=(await req(path,'a')).d;
  check(final.nextSession?.id===publicDate.d.id&&final.openPoll?.title==='HUB public poll','HUB uses nearest authorized date and existing open poll');
  check(final.lastSession?.id===past.d.id,'HUB last evening excludes future and SL-secret entries');
  check(!JSON.stringify(final).includes('HUB_SECRET_'),'HUB server projection contains no secret dates, summaries or messages');
}
