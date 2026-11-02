import {randomUUID} from 'node:crypto';
// Hotfix: players who join the campaign after the evening was started must reach the table and appear in the crew.
// Everything runs through the real invitation flow with synthetic accounts, so it does not depend on other modules' fixture state.
export async function liveLateMembersIntegration({req,check,base,testPassword,localSql}){
 // Earlier invitation checks fill the shared failure window on purpose; this module starts from a clean one (disposable local database only).
 localSql("DELETE FROM auth_rate_limits");
 const call=async(path,cookie,method='GET',body)=>{const r=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json',Origin:base}:{})},body:body?JSON.stringify(body):undefined});return {s:r.status,d:await r.json().catch(()=>({})),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 const sessionId=randomUUID(),stageUrl='/api/live-stage?sessionId='+sessionId,tag=sessionId.slice(0,6);
 const invitePlayer=async label=>{
  const email=`${label}-${tag}@example.invalid`;
  const issued=await req('/api/alpha/access','gm','POST',{action:'invite',email,campaignId:'chronik-von-kleve',memberId:null,days:3});
  const accepted=await call('/api/auth/invitations/accept',null,'POST',{token:issued.d.token,email,displayName:label,password:testPassword,confirmation:testPassword});
  const login=await call('/api/auth/login',null,'POST',{email,password:testPassword});
  const profile=(await call('/api/profile',login.cookie)).d;
  return {label,email,cookie:login.cookie,ok:issued.s===200&&accepted.s===200&&login.s===200&&profile.campaigns?.[0]?.role==='player',status:[issued.s,accepted.s,login.s].join('/')};
 };
 const early=await invitePlayer('early');
 check(early.ok,'LATE an earlier player is invited, signed in and active before the evening starts');
 check((await req('/api/live-table','gm','POST',{action:'start',sessionId,title:'SYNTHETIC late members',create:true})).s===200,'LATE the evening is started before the new players exist');
 const started=(await req(stageUrl,'gm')).d;
 check((await call(stageUrl,early.cookie)).s===200,'LATE an earlier player keeps the table');
 const late=[];
 for(let n=1;n<=10;n++)late.push({n,...await invitePlayer('late'+n)});
 check(late.every(p=>p.ok),'LATE ten invited players accepted, signed in and hold an active player membership ('+late.map(p=>p.status).join(' ')+')');
 const members=(await req('/api/members','gm')).d.members;
 for(const p of [early,...late])p.id=members.find(m=>m.email===p.email)?.id;
 check([early,...late].every(p=>p.id&&members.find(m=>m.id===p.id).status==='active'),'LATE every new member row is active and linked');
 // Presence is reported only for tables the player actually joined.
 const peerId=randomUUID();
 for(const action of ['join','pulse'])await call('/api/live-table',late[0].cookie,'POST',{action,sessionId,runId:started.runId,peerId});
 for(const p of late){
  const view=await call(stageUrl,p.cookie);
  check(view.s===200&&Array.isArray(view.d.crew)&&view.d.crew.some(m=>m.id===p.id),`LATE player ${p.n} reaches the table and sees themself in the crew`);
 }
 const crew=(await call(stageUrl,early.cookie)).d.crew;
 check(late.every(p=>crew.some(m=>m.id===p.id))&&crew.some(m=>m.id===early.id)&&crew.some(m=>m.id==='alpha-pano-member-2026'||m.role==='Spielleitung'||m.id==='sprint1-gm'),'LATE crew lists the earlier player, the GM and all ten new players');
 check(crew.find(m=>m.id===late[0].id)?.presence==='connected'&&crew.find(m=>m.id===late[1].id)?.presence==='disconnected','LATE presence follows real connections, not membership');
 check(!JSON.stringify(crew).includes('@')&&crew.every(m=>m.gm===undefined),'LATE players see no e-mail addresses and no GM markers');
 const lateView=(await call(stageUrl,late[0].cookie)).d;
 check(!JSON.stringify(lateView).includes('membershipRole')&&lateView.stageSceneId===undefined,'LATE player projection carries no membership roles or GM scene data');
 check((await call('/api/live-table?sessionId='+sessionId,late[0].cookie)).s===200,'LATE regular table route works for a new player');
 check((await call('/api/live-participants?sessionId='+sessionId+'&memberId='+late[1].id+'&view=profile',late[0].cookie)).s===200,'LATE new players open each other\'s public profile');
 check((await call('/api/live-participants?sessionId='+sessionId+'&memberId='+late[1].id+'&view=sheet',late[0].cookie)).s===403,'LATE full foreign character sheet stays protected');
 check([403,404].includes((await call(stageUrl+'&regie=none',late[0].cookie)).s)&&(await call('/api/command-center',late[0].cookie)).s===403,'LATE player cannot reach SL surfaces');
 // Access still requires a matching, active membership.
 check((await call(stageUrl)).s===401,'LATE anonymous access denied');
 for(const role of ['blockedPlayer','otherCampaign','editor'])check([401,403,404].includes((await req(stageUrl,role)).s),'LATE no matching player membership: '+role+' denied');
 const target=members.find(m=>m.id===late[2].id);
 check((await req('/api/members','gm','POST',{id:target.id,status:'blocked',expectedVersion:target.version})).s===200,'LATE GM blocks one new player');
 check([403,404].includes((await call(stageUrl,late[2].cookie)).s)&&!(await call(stageUrl,early.cookie)).d.crew.some(m=>m.id===late[2].id),'LATE a blocked new player loses the table and leaves the crew');
}
