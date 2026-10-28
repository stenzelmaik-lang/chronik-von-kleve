import {inventory2Integration} from "./inventory-integration.mjs";
import {m1Integration} from './m1-integration.mjs';
import {codexIntegration} from './codex-integration.mjs';
import {npcAuthoringIntegration} from './npc-authoring-integration.mjs';
import {npcDetailV1Integration} from './npc-detail-v1-integration.mjs';
import {npcUploadIntegration} from './npc-upload-integration.mjs';
import {commandWorkspaceIntegration} from "./command-workspace-integration.mjs";
import {storySceneIntegration} from './story-scene-integration.mjs';
import {storyPreparationIntegration} from './story-preparation-integration.mjs';
import {workspaceUxIntegration} from './workspace-ux-integration.mjs';
import {appointmentsIntegration} from './appointments-integration.mjs';
import {liveTableIntegration} from './live-table-integration.mjs';
import {liveGameIntegration} from './live-game-integration.mjs';
import {liveStageIntegration} from './live-stage-integration.mjs';
import {liveParticipantsIntegration} from './live-participants-integration.mjs';
import {dashboardHubIntegration} from './dashboard-hub-integration.mjs';
import {characterSelectionIntegration} from './character-selection-integration.mjs';
import {locationAreaIntegration} from './location-area-integration.mjs';
import {locationCreationIntegration} from './location-creation-integration.mjs';
import {locationLibraryIntegration} from './location-library-integration.mjs';
import {locationDossierIntegration} from './location-dossier-integration.mjs';
import {engineFixture} from "./fixtures/engine-character.mjs";
import {weekendIntegration} from "./weekend-integration.mjs";
import {accountAccessIntegration} from "./account-access-integration.mjs";
import assert from 'node:assert/strict';
import {createHash,pbkdf2Sync,randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,dirname,resolve} from 'node:path';
// Run only against an isolated local Wrangler worker. No production writes.
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8791';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Tests require localhost');
const fixtureAccounts=[
 {key:'gm',memberId:'sprint1-gm',memberEmail:'gm@sprint.invalid',memberName:'Test GM',memberStatus:'active',campaign:'chronik-von-kleve',authEmail:'alpha-gm@sprint.invalid',linked:true},
 {key:'a',memberId:'sprint1-a',memberEmail:'a@sprint.invalid',memberName:'Player A',memberStatus:'pending',campaign:'chronik-von-kleve',authEmail:'alpha-a@sprint.invalid',linked:true,password:true},
 {key:'b',memberId:'sprint1-b',memberEmail:'b@sprint.invalid',memberName:'Player B',memberStatus:'pending',campaign:'chronik-von-kleve',authEmail:'alpha-b@sprint.invalid',linked:true,password:true},
 {key:'editor',memberId:'sprint1-editor',memberEmail:'editor@sprint.invalid',memberName:'Phase C Editor',memberStatus:'active',campaign:'chronik-von-kleve',authEmail:'alpha-editor@sprint.invalid',linked:false},
 {key:'blockedPlayer',memberId:'sprint1-blocked-player',memberEmail:'blocked-player@sprint.invalid',memberName:'Blocked Phase C Player',memberStatus:'blocked',campaign:'chronik-von-kleve',authEmail:'alpha-blocked@sprint.invalid',linked:false},
 {key:'blockedGm',memberId:'sprint1-blocked-gm',memberEmail:'gm@sprint.invalid',memberName:'Blocked GM test',memberStatus:'blocked',campaign:'chronik-von-kleve',authEmail:'alpha-blocked-gm@sprint.invalid',linked:true},
 {key:'pendingGm',memberId:'sprint1-pending-gm',memberEmail:'gm@sprint.invalid',memberName:'Pending GM test',memberStatus:'pending',campaign:'chronik-von-kleve',authEmail:'alpha-pending-gm@sprint.invalid',linked:true},
 {key:'explicitBlockedGm',memberId:'sprint1-explicit-blocked-gm',memberEmail:'gm@sprint.invalid',memberName:'Explicit blocked GM test',memberStatus:'blocked',campaign:'chronik-von-kleve',authEmail:'alpha-explicit-blocked-gm@sprint.invalid',linked:true},
 {key:'explicitPendingGm',memberId:'sprint1-explicit-pending-gm',memberEmail:'gm@sprint.invalid',memberName:'Explicit pending GM test',memberStatus:'pending',campaign:'chronik-von-kleve',authEmail:'alpha-explicit-pending-gm@sprint.invalid',linked:true},
 {key:'platformOnly',memberId:'sprint1-platform-only',memberEmail:'platform@sprint.invalid',memberName:'Platform-only test',memberStatus:'pending',campaign:'chronik-von-kleve',authEmail:'alpha-platform@sprint.invalid',linked:true},
 {key:'unlinkedEmail',authEmail:'platform@sprint.invalid',linked:false,password:true},
 {key:'unverified',memberId:'sprint1-unverified',memberEmail:'unverified@sprint.invalid',memberName:'Unverified synthetic account',memberStatus:'pending',campaign:'chronik-von-kleve',authEmail:'unverified@sprint.invalid',linked:true,password:true,verified:false},
 {key:'otherCampaign',memberId:'sprint1-other-campaign',memberEmail:'other@sprint.invalid',memberName:'Other campaign owner',memberStatus:'active',campaign:'phase-b-other-campaign',authEmail:'alpha-other@sprint.invalid',linked:true},
];
const testPassword=randomBytes(24).toString('base64url');
const testSalt=randomBytes(16).toString('base64url');
const testPasswordHash=`pbkdf2_sha256$600000$${testSalt}$${pbkdf2Sync(testPassword,testSalt,600000,32,'sha256').toString('base64url')}`;
const sessionTokens=Object.fromEntries(fixtureAccounts.map(account=>[account.key,randomBytes(32).toString('base64url')]));
const ids=Object.fromEntries(fixtureAccounts.map(account=>[account.key,{Cookie:`chroniplay_session=${sessionTokens[account.key]}`} ]));
let checks=0;
function check(value,message){assert.ok(value,message);checks++;console.log('PASS '+message)}
// Exercise the emitted worker through the actual application asset route.
// A bare ?url or relative SDK sibling silently leaves vector maps unloaded.
const mapWorker=readdirSync('dist/client/_next/static').find(name=>/^maplibre-gl-worker-.*\.js$/.test(name));
check(Boolean(mapWorker),'MapLibre v6 emits a bundled worker artifact');
const mapWorkerResponse=await fetch(base+'/_next/static/'+mapWorker);
check(mapWorkerResponse.status===200&&mapWorkerResponse.headers.get('content-type')?.includes('javascript'),'MapLibre worker is served as JavaScript, not an HTML fallback');
check(Buffer.from(await mapWorkerResponse.arrayBuffer()).equals(readFileSync('dist/client/_next/static/'+mapWorker)),'MapLibre worker response matches the tested build artifact');
async function req(path,who,method='GET',body,extra={}){const r=await fetch(base+path,{method,headers:{...(who&&ids[who]?ids[who]:{}),...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{}),...extra},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});const d=await r.json();return {s:r.status,d}}
function localSqlFails(sql) { const state=resolve(process.env.CVK_TEST_STATE||''); assert.equal(dirname(state),tmpdir()); assert.match(basename(state),/^cvk-phase-c-tests-[a-f0-9-]+$/); const r=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--persist-to',process.env.CVK_TEST_STATE,'--config','dist/server/wrangler.json','--command',sql],{encoding:'utf8',windowsHide:true}); assert.notEqual(r.status,0,'Expected isolated D1 constraint or trigger to reject the write'); }
const sqlQuote=value=>`'${String(value).replaceAll("'","''")}'`;
const now='2026-09-26T12:00:00.000Z';
const memberRows=fixtureAccounts.filter(a=>a.memberId).map(a=>`INSERT INTO members(campaign_id,id,email,name,status,version,created_at) VALUES(${sqlQuote(a.campaign)},${sqlQuote(a.memberId)},${sqlQuote(a.memberEmail)},${sqlQuote(a.memberName)},${sqlQuote(a.memberStatus)},1,${sqlQuote(now)});`).join('\n');
const accountRows=fixtureAccounts.map(a=>{
 const userId=`auth-${a.key}`; const passwordHash=a.password?sqlQuote(testPasswordHash):'NULL'; const email=a.authEmail.toLowerCase();
 return `INSERT INTO auth_users(id,email,email_normalized,display_name,password_hash,email_verified_at,status,created_at,updated_at) VALUES(${sqlQuote(userId)},${sqlQuote(email)},${sqlQuote(email)},${sqlQuote(a.memberName||'Unlinked test')},${passwordHash},${a.verified===false?'NULL':sqlQuote(now)},'active',${sqlQuote(now)},${sqlQuote(now)});\nINSERT INTO auth_identities(id,user_id,provider,provider_subject,provider_email,created_at,updated_at) VALUES(${sqlQuote(`identity-${a.key}`)},${sqlQuote(userId)},'local',${sqlQuote(`subject-${a.key}`)},${sqlQuote(email)},${sqlQuote(now)},${sqlQuote(now)});\nINSERT INTO auth_sessions(session_hash,user_id,created_at,expires_at,last_seen_at) VALUES(${sqlQuote(createHash('sha256').update(sessionTokens[a.key]).digest('hex'))},${sqlQuote(userId)},${sqlQuote(now)},'2099-01-01T00:00:00.000Z',${sqlQuote(now)});${a.linked?`\nINSERT INTO auth_member_links(auth_user_id,member_id,approved_by,approval_reference,linked_at) VALUES(${sqlQuote(userId)},${sqlQuote(a.memberId)},'isolated-test-operator',${sqlQuote(`TEST_DATA:${a.key}`)},${sqlQuote(now)});`:''}`;
}).join('\n');
localSql(`INSERT INTO campaigns(id,name,created_at) VALUES('phase-b-other-campaign','Isolated Phase B other campaign',${sqlQuote(now)});
${memberRows}
${accountRows}
INSERT INTO campaign_memberships(campaign_id,user_id,role,status,source,version,created_at,updated_at) VALUES
('chronik-von-kleve','sprint1-explicit-blocked-gm','campaign_gm','blocked','manual',1,'phase-b','phase-b'),
('chronik-von-kleve','sprint1-explicit-pending-gm','campaign_gm','pending','manual',1,'phase-b','phase-b');
`);
check((await req('/api/entities')).s===401,'Anonymous denied without an Auth 2.0 session');
check((await req('/api/cms/locations',undefined,'GET',undefined,{'oai-authenticated-user-id':'sprint1-gm','oai-authenticated-user-email':'gm@sprint.invalid'})).s===401,'Unsigned legacy OAI headers cannot authenticate a CMS request');
for(const [method,path] of [['GET','/api/cms/locations'],['POST','/api/cms/locations'],['GET','/api/cms/drafts?entityId=place.electric-taberna'],['POST','/api/cms/drafts'],['PATCH','/api/cms/drafts'],['GET','/api/cms/media?id=test'],['POST','/api/cms/media'],['POST','/api/cms/preview'],['GET','/api/cms/releases?entityId=place.electric-taberna&scope=group'],['POST','/api/cms/releases'],['POST','/api/cms/transitions']]) {
  check((await req(path,undefined,method,method==='GET'?undefined:{})).s===401,`${method} ${path.split('?')[0]} denies requests without an Auth session`);
}
for(const [method,path] of [['GET','/api/members'],['POST','/api/members'],['GET','/api/recovery'],['POST','/api/recovery']]) {
  check((await req(path,undefined,method,method==='GET'?undefined:{})).s===401,`${method} ${path} administrative route denies requests without an Auth session`);
}
const openRegister=await req('/api/auth/register',undefined,'POST',{email:'new-player@sprint.invalid',password:testPassword,displayName:'Uninvited'});
check(openRegister.s===404,'Public self-registration is disabled for the closed alpha');
const linkedLogin=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'alpha-a@sprint.invalid',password:testPassword})});
const linkedLoginCookie=linkedLogin.headers.get('set-cookie')?.split(';')[0];
check(linkedLogin.status===200&&Boolean(linkedLoginCookie)&&linkedLogin.headers.get('set-cookie').includes('HttpOnly'),'Pre-provisioned linked account can sign in with an HttpOnly session cookie');
const linkedSessionUse=await fetch(base+'/api/members',{headers:{Cookie:linkedLoginCookie}});
const linkedSessionData=await linkedSessionUse.json();
check(linkedSessionUse.status===200&&linkedSessionData.actor.id==='sprint1-a','Auth session resolves to the existing member ID, not a new account ID');
const unlinkedLogin=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'platform@sprint.invalid',password:testPassword})});
check(unlinkedLogin.status===401,'Matching email without an explicit crosswalk cannot sign in');
const unknownLogin=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'missing@sprint.invalid',password:testPassword})});
const [unlinkedError,unknownError]=await Promise.all([unlinkedLogin.json(),unknownLogin.json()]);
check(unknownLogin.status===401&&JSON.stringify(unlinkedError)===JSON.stringify(unknownError),'Unknown and unlinked login attempts return the same generic rejection');
const unverifiedLogin=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'unverified@sprint.invalid',password:testPassword})});
check(unverifiedLogin.status===401,'Correct password is insufficient when a pre-provisioned account lacks verified email');
check((await req('/api/auth/session','unverified')).s===401,'An existing session is rejected if email verification is absent');
const oversizedPasswordLogin=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'alpha-a@sprint.invalid',password:'x'.repeat(201)})});
check(oversizedPasswordLogin.status===401&&JSON.stringify(await oversizedPasswordLogin.json())===JSON.stringify({error:'E-Mail-Adresse oder Passwort ist nicht korrekt.'}),'Oversized password is rejected generically before PBKDF2');
check((await req('/api/auth/session','unlinkedEmail')).s===401,'Unlinked account session is rejected even when its email matches an existing member');
localSqlFails("INSERT INTO auth_member_links(auth_user_id,member_id,approved_by,approval_reference,linked_at) VALUES('auth-unlinkedEmail','sprint1-a','operator','must-not-duplicate','now')");
localSqlFails("UPDATE auth_member_links SET member_id='sprint1-b' WHERE auth_user_id='auth-a'");
check((await req('/api/cms/locations','editor')).s===401,'Unlinked account cannot reach CMS data');
const gmActor=await req('/api/members','gm');
check(gmActor.d.actor.gm&&gmActor.d.actor.role==='campaign_gm','GM identity resolves only to campaign_gm');
const blockedGm=await req('/api/members','blockedGm');
check(blockedGm.d.actor.status==='blocked'&&blockedGm.d.members.length===0,'blocked legacy GM email cannot bypass membership status');
check((await req('/api/entities','blockedGm')).s===403,'blocked legacy GM cannot use campaign APIs');
check((await req('/api/entities','pendingGm')).s===403,'pending legacy GM cannot use campaign APIs');
const explicitBlocked=await req('/api/members','explicitBlockedGm');
check(explicitBlocked.d.actor.status==='blocked'&&explicitBlocked.d.actor.role==='campaign_gm','explicit blocked campaign membership overrides GM email');
check((await req('/api/entities','explicitBlockedGm')).s===403,'explicitly blocked GM role is denied');
const explicitPending=await req('/api/members','explicitPendingGm');
check(explicitPending.d.actor.status==='pending'&&explicitPending.d.actor.role==='campaign_gm','explicit pending campaign GM role retains its status');
check((await req('/api/entities','explicitPendingGm')).s===403,'explicit pending campaign GM membership is denied');
const platformOnly=await req('/api/members','platformOnly');
check(platformOnly.d.actor.role==='player'&&platformOnly.d.actor.status==='pending'&&!platformOnly.d.actor.gm,'unregistered user does not acquire a campaign role');
check((await req('/api/entities','platformOnly')).s===403,'user without active campaign membership has no campaign API access');
const otherCampaign=await req('/api/members','otherCampaign');
check(otherCampaign.d.actor.status==='pending'&&!otherCampaign.d.actor.gm,'campaign owner role does not cross into Kleve');
check((await req('/api/entities','otherCampaign')).s===403,'another campaign membership grants no Kleve access');
for(const who of ['a','b']){
 const m=await req('/api/members',who);check(m.s===200,'Player registers');
 if(m.d.actor.status!=='active')check((await req('/api/entities',who)).s===403,'Pending player denied');
 const pendingMember=(await req('/api/members','gm')).d.members.find(member=>member.id===m.d.actor.id);
 check(Number.isInteger(pendingMember?.version),'GM member list includes the revision needed for status changes');
 check((await req('/api/members','gm','POST',{id:m.d.actor.id,status:'active',expectedVersion:pendingMember.version})).s===200,'GM activates player using the listed revision');
}
localSql("INSERT INTO campaign_memberships(campaign_id,user_id,role,status,source,version,created_at,updated_at) VALUES('chronik-von-kleve','sprint1-b','player','active','manual',1,'phase-b','phase-b')");
const bMembership=(await req('/api/members','gm')).d.members.find(member=>member.id==='sprint1-b');
check((await req('/api/members','gm','POST',{id:'sprint1-b',status:'blocked'})).s===428,'Old management UI without a revision cannot change a member');
const freshUiWrite=await req('/api/members','gm','POST',{id:'sprint1-b',status:'blocked',expectedVersion:bMembership.version});
const staleUiWrite=await req('/api/members','gm','POST',{id:'sprint1-b',status:'active',expectedVersion:bMembership.version});
const afterStaleUi=(await req('/api/members','gm')).d.members.find(member=>member.id==='sprint1-b');
check(freshUiWrite.s===200&&staleUiWrite.s===409&&afterStaleUi.status==='blocked'&&afterStaleUi.version===bMembership.version+1,'Stale management UI snapshot returns 409 and cannot overwrite the newer status');
const memberRaceRevision=afterStaleUi.version;
const memberRaces=await Promise.all([
 req('/api/members','gm','POST',{id:'sprint1-b',status:'blocked',expectedVersion:memberRaceRevision}),
 req('/api/members','gm','POST',{id:'sprint1-b',status:'active',expectedVersion:memberRaceRevision}),
]);
check(memberRaces.filter(result=>result.s===200).length===1&&memberRaces.filter(result=>result.s===409).length===1,'two concurrent membership changes from one revision yield one success and one 409');
const afterMemberRace=(await req('/api/members','gm')).d.members.find(member=>member.id==='sprint1-b');
check(afterMemberRace.version===memberRaceRevision+1,'successful membership mutation advances its revision once');
const staleRevisionWrite=await req('/api/members','gm','POST',{id:'sprint1-b',status:afterMemberRace.status==='active'?'blocked':'active',expectedVersion:bMembership.version});
check(staleRevisionWrite.s===409,'stale membership revision is rejected after a later write');
const resetMember=(await req('/api/members','gm')).d.members.find(member=>member.id==='sprint1-b');
check((await req('/api/members','gm','POST',{id:'sprint1-b',status:'active',expectedVersion:resetMember.version})).s===200,'membership concurrency fixture is restored to active');
check((await req('/api/entities','a','POST',{type:'CLUE',title:'test',text:'test'})).s===403,'Player cannot author core entity');
await m1Integration({req,check,localSql});
await npcAuthoringIntegration({req,check,localSql,sqlQuote});
await npcDetailV1Integration({req,check,localSql,sqlQuote});
await npcUploadIntegration({req,check,base,ids});
await codexIntegration({req,check,localSql,sqlQuote});
const created=await req('/api/entities','gm','POST',{type:'CLUE',title:'QA isolated clue',text:'SPRINT_PROTECTED',gmBody:'SPRINT_GM_ONLY'});
check(created.s===201&&created.d.campaignId==='chronik-von-kleve','Entity has stable ID and campaignId');
const id=created.d.id;
for(const who of ['a','b'])check((await req('/api/entities?id='+id,who)).s===404,'Unreleased entity hidden');
check((await req('/api/knowledge','a','POST',{entityId:id,audience:'group',state:'DISCOVERED'})).s===403,'Player cannot grant knowledge');
check((await req('/api/knowledge','gm','POST',{entityId:id,audience:'player',playerId:'sprint1-a',state:'DISCOVERED'})).s===200,'GM grants to player A');
const read=await req('/api/entities?id='+id,'a');check(JSON.stringify(read.d).includes('SPRINT_PROTECTED')&&!JSON.stringify(read.d).includes('SPRINT_GM_ONLY'),'Player A receives released content only');
check((await req('/api/entities?id='+id,'b')).s===404,'Player B cannot obtain player A knowledge');
check((await req('/api/knowledge','gm','POST',{entityId:id,audience:'group',state:'OBSERVED'})).s===200,'GM grants to group');
check((await req('/api/entities?id='+id,'b')).s===200,'Active group member receives content');
let bCurrent=(await req('/api/members','gm')).d.members.find(member=>member.id==='sprint1-b');
await req('/api/members','gm','POST',{id:'sprint1-b',status:'blocked',expectedVersion:bCurrent.version});
check((await req('/api/entities?id='+id,'b')).s===403,'Blocked member cannot use group grant');
bCurrent=(await req('/api/members','gm')).d.members.find(member=>member.id==='sprint1-b');
await req('/api/members','gm','POST',{id:'sprint1-b',status:'active',expectedVersion:bCurrent.version});
await req('/api/knowledge','gm','POST',{entityId:id,audience:'group',state:'UNKNOWN'});
check((await req('/api/entities?id='+id,'b')).s===404,'Group grant revoked');
const secret=await req('/api/entities','gm','POST',{type:'CLUE',canonStatus:'GM_SECRET',title:'QA GM SECRET',text:'HIDDEN_CANON'});
check((await req('/api/knowledge','gm','POST',{entityId:secret.d.id,audience:'group',state:'VERIFIED'})).s===400,'GM_SECRET cannot be released');
check((await req('/api/entities?id='+secret.d.id,'a')).s===404,'GM_SECRET hidden by server');
check((await req('/api/locations')).s===401,'Location dossier denies anonymous');
const unknownMapPlace=await req('/api/locations?place=place.unknown-secret&view=player','a');
check(unknownMapPlace.s===404&&!JSON.stringify(unknownMapPlace.d).includes('coordinates'),'Unknown Chronicle place yields no player map data or coordinates');
check((await req('/api/locations/migrate','a','POST',{placeId:'place.electric-taberna'})).s===403,'Player cannot migrate location data');
const migrated=await req('/api/locations/migrate','gm','POST',{placeId:'place.electric-taberna'});
check(migrated.s===200&&migrated.d.migrated===true,'GM migrates Electric Taberna fixture once');
check((await req('/api/locations/migrate','gm','POST',{placeId:'place.electric-taberna'})).d.migrated===false,'Location migration is idempotent');
// Synthetic place exists only in this runner's disposable local D1 database.
localSql(`INSERT INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,title,content,gm_body,version,created_at,updated_at) VALUES
('place.synthetic-night-market','chronik-von-kleve','PLACE','WORKING','sprint1-gm','sl','Testort Zwei','{}','',1,'2026-09-25','2026-09-25'),
('room.synthetic-night-market.secret','chronik-von-kleve','PLACE','GM_SECRET','sprint1-gm','sl','SYNTHETIC_SECRET_ROOM','{}','',1,'2026-09-25','2026-09-25'),
('place.ungranted-secret','chronik-von-kleve','PLACE','WORKING','sprint1-gm','sl','SYNTHETIC_UNGRANTED_PLACE','{}','',1,'2026-09-25','2026-09-25');
INSERT INTO location_nodes(entity_id,campaign_id,location_id,parent_id,level,position,world_state,world_visibility,world_subject_id,markers,attributes,revision,updated_at) VALUES
('place.synthetic-night-market','chronik-von-kleve','place.synthetic-night-market',NULL,'location',0,'active','group',NULL,'[]','{"title":"Testort Zwei","subtitle":"Testdaten","district":"Isolierter Bereich","summary":"Synthetischer Ort für den isolierten Integrationstest.","visibility":"group","geography":{"status":"exact","visibility":"group","coordinates":[6.21,51.83],"provenance":{"source":"isolated synthetic fixture; not canon","reviewedAt":"2026-09-25"}}}',1,'2026-09-25'),
('room.synthetic-night-market.secret','chronik-von-kleve','place.synthetic-night-market','place.synthetic-night-market','room',1,'active','gm',NULL,'[]','{"title":"SYNTHETIC_SECRET_ROOM"}',1,'2026-09-25'),
('place.ungranted-secret','chronik-von-kleve','place.ungranted-secret',NULL,'location',0,'active','group',NULL,'[]','{"title":"SYNTHETIC_UNGRANTED_PLACE","visibility":"group","geography":{"status":"exact","visibility":"group","coordinates":[6.22,51.84],"provenance":{"source":"isolated synthetic fixture; not canon","reviewedAt":"2026-09-25"}}}',1,'2026-09-25');
INSERT INTO knowledge(id,campaign_id,entity_id,audience,subject_id,state,discovery_state,version,granted_by,created_at,updated_at) VALUES
('qa.synthetic-night-market.group','chronik-von-kleve','place.synthetic-night-market','group','chronik-von-kleve','DISCOVERED','known',1,'sprint1-gm','2026-09-25','2026-09-25');
INSERT INTO location_actions(id,campaign_id,location_id,target_id,definition,status,revision,updated_at) VALUES
('action.synthetic-night-market.qa','chronik-von-kleve','place.synthetic-night-market','place.synthetic-night-market','{"label":"Isolated QA action","target":"Group"}','ready',1,'2026-09-25');`);
const gmLocation=await req('/api/locations?place=place.electric-taberna&view=sl','gm');
check(gmLocation.s===200,'GM opens Electric Taberna dossier');
check(gmLocation.d.projection.location.id==='place.electric-taberna','Electric Taberna keeps permanent ID through API');
check(gmLocation.d.projection.location.areas.length===3,'GM sees all Electric Taberna areas');
check(gmLocation.d.projection.location.areas.reduce((sum,area)=>sum+area.rooms.length,0)===11,'GM sees all Electric Taberna rooms');
const playerLocation=await req('/api/locations?place=place.electric-taberna','a');
const playerLocationJson=JSON.stringify(playerLocation.d);
check(playerLocation.s===200,'Player opens projected Electric Taberna dossier');
check(playerLocation.d.projection.location.geography.status==='unknown'&&!Object.hasOwn(playerLocation.d,'mapMarker'),'Electric Taberna test coordinate is not silently treated as a verified canon position');
check(!Object.hasOwn(gmLocation.d,'mapMarker'),'GM-only dossier response does not expose player map markers');
check(!playerLocationJson.includes('Keller & Service')&&!playerLocationJson.includes('Getränkevorrat')&&!playerLocationJson.includes('Büro'),'Player projection hides unreleased Electric Taberna room names');
check(!playerLocationJson.includes('room.electric-taberna.office')&&!playerLocationJson.includes('room.electric-taberna.entrance-cloakroom')&&!playerLocationJson.includes('area.electric-taberna.public-guests')&&!playerLocationJson.includes('info.electric-taberna.public-signal')&&!playerLocationJson.includes('legacy-1bf8cd98a7c87c2e018890b4'),'Player projection hides internal room, area, info and legacy IDs');
const worldHub=await req('/api/locations?view=player&target=player','a');
const worldHubJson=JSON.stringify(worldHub.d);
check(worldHub.s===200&&worldHub.d.places.some(p=>p.id==='place.electric-taberna')&&worldHub.d.places.some(p=>p.id==='place.synthetic-night-market'),'Generic world hub returns Electric Taberna and isolated second place');
check(worldHub.d.places.find(p=>p.id==='place.synthetic-night-market').summary!==worldHub.d.places.find(p=>p.id==='place.electric-taberna').summary,'World hub tiles use each location’s released content');
check(!worldHubJson.includes('place.ungranted-secret')&&!worldHubJson.includes('SYNTHETIC_UNGRANTED_PLACE')&&!worldHubJson.includes('6.22'),'Unreleased location and its coordinates never enter the player hub');
check(!worldHubJson.includes('SYNTHETIC_SECRET_ROOM')&&!worldHubJson.includes('room.synthetic-night-market.secret'),'GM_SECRET synthetic sibling is absent from player hub and tiles');
check(!Object.hasOwn(worldHub.d,'total')&&!Object.hasOwn(worldHub.d,'hiddenCount'),'World hub does not disclose a count of unknown locations');
const syntheticDetail=await req('/api/locations?place=place.synthetic-night-market&view=player&target=player','a');
check(syntheticDetail.s===200&&syntheticDetail.d.projection.location.summary.includes('isolierten Integrationstest'),'Generic detail route opens a different persisted place');
check(syntheticDetail.d.mapMarker?.id==='place.synthetic-night-market'&&syntheticDetail.d.mapMarker.coordinates[0]===6.21,'Synthetic known coordinates project a marker through the shared contract');
check((await req('/api/locations?place=place.ungranted-secret&view=player','a')).s===404,'Existing root without grant is not player knowledge');
check((await req('/api/locations?place=place.synthetic-night-market&view=sl','a')).s===403,'Player cannot request a generic GM dossier');
check((await req('/api/locations/actions','gm','POST',{placeId:'place.synthetic-night-market',actionId:'action.synthetic-night-market.qa'})).s===200,'Prepared actions work through the generic place ID');
check((await req('/api/locations/state','gm','POST',{placeId:'place.synthetic-night-market',entityId:'place.synthetic-night-market',mode:'world',worldState:'changed',expectedRevision:1,reason:'isolated generic QA'})).s===200,'World state uses the same generic place ID contract');
const syntheticNote=await req('/api/records','a','POST',{kind:'notizen',title:'Synthetic place note',visibility:'private',body:{text:'SYNTHETIC_NOTE_ONLY',locationId:'place.synthetic-night-market',targetId:'place.synthetic-night-market'}});
check(syntheticNote.s===200&&JSON.stringify((await req('/api/records?kind=notizen','a')).d).includes('place.synthetic-night-market'),'Location note is linked to the selected stable place ID');
const gmPlayerPreview=await req('/api/locations?place=place.electric-taberna&view=player&target=group','gm');
check(gmPlayerPreview.s===200&&!JSON.stringify(gmPlayerPreview.d).includes('Keller & Service')&&!JSON.stringify(gmPlayerPreview.d).includes('Elysium / Camarilla'),'GM player preview uses the safe player projection');
check((await req('/api/locations?place=place.electric-taberna&view=sl','a')).s===403,'Player cannot switch to SL location view');
check((await req('/api/locations/actions','a','POST',{placeId:'place.electric-taberna',actionId:'action.electric-taberna.office-known.group'})).s===403,'Player cannot trigger prepared location actions');
check((await req('/api/locations/actions','gm','POST',{placeId:'place.electric-taberna',actionId:'action.electric-taberna.office-known.group'})).s===200,'GM triggers prepared location action');
const officeState=await req('/api/locations/state','gm','POST',{placeId:'place.electric-taberna',entityId:'room.electric-taberna.office',mode:'world',worldState:'changed',markers:['watched'],expectedRevision:1,reason:'isolated QA'});
check(officeState.s===200&&officeState.d.revision===2,'World-State and marker persist with revision');
check((await req('/api/locations/state','gm','POST',{placeId:'place.electric-taberna',entityId:'room.electric-taberna.office',mode:'world',worldState:'active',expectedRevision:1,reason:'stale QA'})).s===409,'World-State rejects stale revision');
const discoveryState=await req('/api/locations/state','gm','POST',{placeId:'place.electric-taberna',entityId:'room.electric-taberna.office',mode:'discovery',audience:'player',playerId:'sprint1-a',discoveryState:'known',expectedRevision:0,reason:'isolated QA'});
check(discoveryState.s===200,'Per-player discovery persists');
check((await req('/api/locations?place=place.electric-taberna','a')).s===200,'Player projection remains server-side after persistent state');

// Closing patch: real parallel HTTP requests against the isolated D1 worker.
const office='room.electric-taberna.office', staff='area.electric-taberna.staff-back';
const discover=(entityId,discoveryState,expectedRevision,extra={})=>req('/api/locations/state','gm','POST',{placeId:'place.electric-taberna',entityId,mode:'discovery',audience:'player',playerId:'sprint1-a',discoveryState,expectedRevision,reason:'closing QA',...extra});
const locationJson=async(who,query='')=>JSON.stringify((await req('/api/locations?place=place.electric-taberna'+query,who)).d);
check((await locationJson('a')).includes('07 Büro'),'Personal office grant controls player A projection');
check(!(await locationJson('b')).includes('07 Büro'),'Player B cannot see personal office');
check(!(await locationJson('gm','&view=player&target=group')).includes('07 Büro'),'Group preview excludes personal office');
check(!(await locationJson('a','&target=group')).includes('07 Büro'),'Explicit group view excludes own personal office');
for(const text of ['Personal-/Hinterbereich','Gesprächsraum','Personalflur','Keller & Service','Getränkevorrat','legacy-1bf8cd98','Elysium / Camarilla'])
  check(!(await locationJson('a')).includes(text),'Personal room grant does not release '+text);
check((await req('/api/records','a','POST',{kind:'notizen',title:'Known office',visibility:'private',body:{locationId:'place.electric-taberna',targetId:office,text:'OFFICE_PRIVATE'}})).s===200,'Personal discovery permits own office note');
check((await req('/api/records','b','POST',{kind:'notizen',title:'Unknown office',visibility:'private',body:{locationId:'place.electric-taberna',targetId:office}})).s!==200,'Unknown office note reference denied');
check(!JSON.stringify((await req('/api/records?kind=notizen','b')).d).includes('OFFICE_PRIVATE'),'Other player cannot read personal office note');
const eventCount=async()=>((await req('/api/export?scope=campaign','gm')).d.world_events).filter(e=>e.type==='location.discovery.changed').length;
const eventsBefore=await eventCount();
const concurrent=await Promise.all([discover(office,'visited',1),discover(office,'investigated',1)]);
check(concurrent.filter(r=>r.s===200).length===1&&concurrent.filter(r=>r.s===409).length===1,'Exactly one parallel discovery writer succeeds; other receives 409');
check(await eventCount()===eventsBefore+1,'Losing writer appends no discovery event');
check((await discover(office,'known',2)).s===400,'Visited or investigated cannot downgrade to known');
check((await discover(office,'investigated',2)).s===200,'Advance or confirm investigated');
check((await discover(office,'hidden',3)).s===400,'Investigated cannot downgrade to hidden');
check((await discover(office,'investigated',3)).s===200,'Same discovery state may be confirmed');
check((await discover(office,'known',undefined)).s===400,'Discovery requires explicit expected version');
const createRace=await Promise.all([discover(staff,'known',0),discover(staff,'known',0)]);
check(createRace.filter(r=>r.s===200).length===1&&createRace.filter(r=>r.s===409).length===1,'Concurrent initial grants also allow exactly one writer');
check((await discover(staff,'visited',1)).s===200,'Known to visited allowed');
check((await discover(staff,'known',2)).s===400,'Visited to known rejected');
check((await locationJson('a')).includes('Personal-/Hinterbereich'),'Personal area grant exposes area');
check(!(await locationJson('b')).includes('Personal-/Hinterbereich'),'Personal area grant does not expose area to B');
check(!(await locationJson('a')).includes('Personalflur'),'Area grant does not release sibling rooms');
check(!(await locationJson('gm','&view=player&target=group')).includes('Personal-/Hinterbereich'),'Personal area absent from group preview');
const entrance='room.electric-taberna.entrance-cloakroom';
check((await req('/api/knowledge','gm','POST',{entityId:entrance,audience:'group',state:'UNKNOWN'})).s===200,'Group grant can be revoked through existing knowledge controls');
check(!(await locationJson('a')).includes('01 Eingang & Garderobe'),'Revoked grant cannot fall back to fixture visited');
check((await req('/api/knowledge','gm','POST',{entityId:entrance,audience:'group',state:'DISCOVERED'})).s===200,'Restore isolated fixture grant');

// Direct mutations are restricted to this runner's disposable LOCAL test database.
function localSql(sql) {
  const state=resolve(process.env.CVK_TEST_STATE||'');
  assert.equal(dirname(state),tmpdir());
  assert.match(basename(state),/^cvk-phase-c-tests-[a-f0-9-]+$/);
  const r=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--persist-to',process.env.CVK_TEST_STATE,'--config','dist/server/wrangler.json','--command',sql],{encoding:'utf8',windowsHide:true});
  assert.equal(r.status,0,r.stderr);
}
localSql("DELETE FROM knowledge WHERE entity_id='room.electric-taberna.entrance-cloakroom'");
check(!(await locationJson('a')).includes('01 Eingang & Garderobe'),'Node exists with fixture visited but no grant: no player knowledge');
localSql("UPDATE location_nodes SET attributes=json_set(attributes,'$.visibility','public') WHERE entity_id='room.electric-taberna.entrance-cloakroom'");
check((await locationJson('b')).includes('01 Eingang & Garderobe'),'Explicit public content rule remains visible without group grant');
localSql("UPDATE location_nodes SET attributes=json_set(attributes,'$.visibility','group') WHERE entity_id='room.electric-taberna.entrance-cloakroom'; UPDATE entities SET canon_status='GM_SECRET' WHERE id='room.electric-taberna.office'");
check((await discover(office,'investigated',4)).s===400,'Location API refuses GM_SECRET discovery grant');
check(!(await locationJson('a')).includes('07 Büro'),'GM_SECRET overrides existing personal grant');
check((await locationJson('gm','&view=sl')).includes('07 Büro'),'GM still sees GM_SECRET office');
localSql("UPDATE entities SET canon_status='WORKING' WHERE id='room.electric-taberna.office'; UPDATE entities SET canon_status='GM_SECRET' WHERE id='area.electric-taberna.staff-back'");
check(!(await locationJson('a')).includes('07 Büro'),'Secret parent blocks descendant grants');
localSql("UPDATE entities SET canon_status='WORKING' WHERE id='area.electric-taberna.staff-back'");
const beforeRevoked=(await req('/api/knowledge?entityId='+office,'gm')).d.knowledge.find(g=>g.audience==='player');
await req('/api/knowledge','gm','POST',{entityId:office,audience:'player',playerId:'sprint1-a',state:'UNKNOWN'});
check((await discover(office,'investigated',beforeRevoked.version)).s===409,'Knowledge revocation invalidates stale discovery revision');
check(!(await locationJson('a')).includes('07 Büro'),'Revoked personal grant stays hidden');

const hall='room.electric-taberna.staff-hall';
check((await discover(hall,'hidden',0)).s===200,'Initial hidden confirmation allowed');
check(!(await locationJson('a')).includes('06 Personalflur'),'Hidden confirmation does not release location');
check((await req('/api/entities?id='+hall,'a')).s===404,'Hidden confirmation does not release generic entity');
check((await discover(hall,'known',1)).s===200,'Existing hidden grant advances to known');
check((await locationJson('a')).includes('06 Personalflur'),'Explicit hidden-to-known transition releases to intended player');
// The Phase-B discovery test intentionally grants this sibling to Player A; clear
// that isolated fixture grant before proving that a later office release does not
// itself reveal sibling rooms.
localSql("DELETE FROM knowledge WHERE campaign_id='chronik-von-kleve' AND entity_id='room.electric-taberna.staff-hall' AND audience='player' AND subject_id='sprint1-a'");
check(!(await locationJson('a')).includes('06 Personalflur'),'Personal projection fixture reset hides the earlier explicit sibling grant');
const gmLocationAfterAction=await req('/api/locations?place=place.electric-taberna&view=sl','gm');
check(JSON.stringify(gmLocationAfterAction.d).includes('"status":"triggered"'),'Prepared location action status persists');
const shared=await req('/api/records','gm','POST',{kind:'schauplaetze',title:'QA hidden place',visibility:'group',body:{text:'LEGACY_HIDDEN',discovered:false},gmBody:'LEGACY_GM_ONLY'});
check(shared.s===200,'Legacy write creates identity adapter');
check(!JSON.stringify((await req('/api/records?kind=schauplaetze','a')).d).includes('LEGACY_HIDDEN'),'Legacy map content hidden in records API');
await req('/api/knowledge','gm','POST',{entityId:shared.d.id,audience:'player',playerId:'sprint1-a',state:'DISCOVERED'});
const released=await req('/api/records?kind=schauplaetze','a');check(JSON.stringify(released.d).includes('LEGACY_HIDDEN')&&!JSON.stringify(released.d).includes('LEGACY_GM_ONLY'),'Legacy grant uses protected projection');
check(!JSON.stringify((await req('/api/records?kind=schauplaetze','b')).d).includes('LEGACY_HIDDEN'),'Legacy grant does not leak to player B');
const note=await req('/api/records','a','POST',{kind:'notizen',title:'Private',visibility:'private',body:{text:'PLAYER_PRIVATE'}});
check(note.s===200,'Player creates private note');
check(!JSON.stringify((await req('/api/records?kind=notizen','b')).d).includes('PLAYER_PRIVATE'),'Private note remains private');
check((await req('/api/records','a','POST',{id:note.d.id,version:1,kind:'notizen',title:'Edited',visibility:'private',body:{text:'PLAYER_PRIVATE'}})).s===200,'Owner edits legacy record');
check((await req('/api/records','a','POST',{id:note.d.id,version:1,kind:'notizen',title:'Stale',visibility:'private',body:{}})).s===409,'Optimistic version conflict preserved');
check((await req('/api/knowledge','gm','POST',{entityId:id,audience:'group',state:'VERIFIED'},{origin:'https://foreign.invalid'})).s===403,'Cross-origin write rejected');
check((await req('/api/export?scope=campaign','a')).s===403,'Campaign export GM only');
check(!JSON.stringify((await req('/api/export','a')).d).includes('GM_ONLY'),'Personal export has no GM text');
// Character V1 RC: a complete, isolated owner-bound projection and runtime round trip.
const characterBody={player:'QA owner',chronicle:'QA',clan:'Tremere',generation:10,nature:'Natur',demeanor:'Verhalten',concept:'Konzept',sire:'QA',attributes:{Geschick:4},skills:{Diebstahl:3},customAbilities:[{name:'Talent',category:'Talent',value:2},{name:'Fertigkeit',category:'Fertigkeit',value:3},{name:'Kenntnis',category:'Kenntnis',value:4}],disciplines:[{name:'Auspex',value:2}],backgrounds:[{name:'Kontakte',value:3}],merits:[{name:'Sinn',cost:2}],flaws:[{name:'Ruf',cost:1}],virtues:{Gewissen:3,Selbstbeherrschung:4,Mut:3},humanity:7,humanityPath:'Pfad QA',willpower:6,willpowerTemporary:4,health:{current:'Verletzt',legacy:true},blood:8,bloodMax:13,bloodPerRound:1,xpFree:12,xp:37,clanWeakness:'QA'};
const character=await req('/api/records','a','POST',{kind:'charaktere',title:'QA Character',visibility:'private',body:characterBody});
check(character.s===200,'CHAR-P01 attribute character is created');
check((await req('/api/records','a','POST',{kind:'charaktere',title:'Locked Clan',visibility:'private',body:{...characterBody,clan:'Lasombra',disciplines:[{name:'Beherrschung',value:1}]}})).s===400,'CHAR-C01 locked classic V20 clan is rejected server-side');
check((await req('/api/records','a','POST',{kind:'charaktere',title:'Wrong Discipline',visibility:'private',body:{...characterBody,clan:'Tremere',disciplines:[{name:'Potenz',value:1}]}})).s===400,'CHAR-C02 discipline outside the selected clan is rejected server-side');
const legacyClanId='legacy-clan-character';
const legacyClanBody={...characterBody,clan:'Legacy-Clan',disciplines:[{name:'Legacy-Disziplin',value:2}]};
localSql(`INSERT INTO records(id,campaign_id,owner_id,kind,visibility,title,body,gm_body,version,created_at,updated_at) VALUES(${sqlQuote(legacyClanId)},'chronik-von-kleve','sprint1-a','charaktere','private','Legacy Clan Character',${sqlQuote(JSON.stringify(legacyClanBody))},'',1,${sqlQuote(now)},${sqlQuote(now)})`);
check((await req('/api/records','a','POST',{id:legacyClanId,version:1,kind:'charaktere',title:'Legacy Clan Character',visibility:'private',body:{...legacyClanBody,concept:'Unveränderte Clanwerte'}})).s===200,'CHAR-C03 unchanged legacy clan values remain writable with unrelated edits');
check((await req('/api/records','a','POST',{id:legacyClanId,version:2,kind:'charaktere',title:'Legacy Clan Character',visibility:'private',body:{...legacyClanBody,disciplines:[{name:'Andere Legacy-Disziplin',value:2}]}})).s===400,'CHAR-C04 legacy clan values cannot be changed outside the configured catalogue');
localSql(`DELETE FROM records WHERE id=${sqlQuote(legacyClanId)}`);
const engineBody=structuredClone(engineFixture);
check((await req('/api/records','a','POST',{kind:'charaktere',title:'Forged initial XP',visibility:'private',body:{...engineBody,xpLedger:[{id:'forged',kind:'grant',amount:999,reason:'FORGED',createdAt:now}]}})).s===403,'B1A-S00 initial forged ledger is denied');
const engineCharacter=await req('/api/records','a','POST',{kind:'charaktere',title:'B1a Engine Character',visibility:'private',body:engineBody});
check(engineCharacter.s===200,`B1A-01 engine draft is created (${engineCharacter.s}: ${JSON.stringify(engineCharacter.d)})`);
check((await req('/api/character-engine?id='+engineCharacter.d.id,'gm')).s===200,'B1A campaign SL can inspect a private draft without submitting it');
const reviewed=await req('/api/character-engine','a','POST',{id:engineCharacter.d.id,version:1,action:'review'});
check(reviewed.s===200&&reviewed.d.state==='review','B1A-02 draft enters confirmation review');
check((await req('/api/character-engine','a','POST',{id:engineCharacter.d.id,version:2,action:'confirm'})).s===403,'B1A owner cannot confirm own character');
const confirmed=await req('/api/character-engine','gm','POST',{id:engineCharacter.d.id,version:2,action:'confirm'});
check(confirmed.s===200&&confirmed.d.state==='confirmed','B1A-03 character confirmation is SL-only');
check((await req('/api/character-engine','gm','POST',{id:engineCharacter.d.id,version:3,action:'xp_grant',amount:14,reason:'TEST_DATA'})).s===200,'B1A XP grant requires SL command');
const xpPurchase=await req('/api/character-engine','a','POST',{id:engineCharacter.d.id,version:4,action:'xp_purchase',purchase:{category:'attribute',target:'Geschick',from:3,to:4}});
check(xpPurchase.s===200&&xpPurchase.d.xpAvailable===2,'B1A-04 XP purchase changes value and ledger atomically');
const currentEngine=(await req('/api/records?kind=charaktere','a')).d.records.find(r=>r.id===engineCharacter.d.id);
const directXp=await req('/api/records','a','POST',{id:currentEngine.id,version:5,kind:'charaktere',title:currentEngine.title,visibility:'sl',body:{...currentEngine.body,xpLedger:[{id:'forged',kind:'grant',amount:999,reason:'FORGED',createdAt:now}]}});
check(directXp.s===403,'B1A-S01 direct XP ledger edits are rejected');
const directPermanent=await req('/api/records','a','POST',{id:currentEngine.id,version:5,kind:'charaktere',title:currentEngine.title,visibility:'sl',body:{...currentEngine.body,concept:'forged'}});
check(directPermanent.s===400,'B1A-S02 confirmed permanent edits are rejected');
check((await req('/api/records','a','DELETE',{id:engineCharacter.d.id,version:5})).s===403,'Characters cannot be physically deleted through ordinary management');
check((await req('/api/character-companion','a','PATCH',{action:'character.archive',id:engineCharacter.d.id,version:5,confirmed:true})).s===200,'B1A synthetic fixture archived with its complete engine history');
const charId=character.d.id;
let dashboard=await req('/api/dashboard','a');
check(dashboard.s===200&&dashboard.d.character?.id===charId&&dashboard.d.characterCount===1,'DASH-01 sole owned character is selected in dashboard projection');
const secondDashboardCharacter=await req('/api/records','a','POST',{kind:'charaktere',title:'QA Second Character',visibility:'private',body:{...characterBody,testData:true}});
const secondDashboardCharacterId=secondDashboardCharacter.d.id;
dashboard=await req('/api/dashboard','a');
check(dashboard.s===200&&dashboard.d.character===null&&dashboard.d.characterCount===2&&dashboard.d.characters.length===2,'DASH-02 multiple owned characters require an explicit selection');
dashboard=await req(`/api/dashboard?characterId=${encodeURIComponent(charId)}`,'a');
check(dashboard.s===200&&dashboard.d.character.id===charId,'DASH-03 selected character is returned by stable ID');
check((await req(`/api/dashboard?characterId=${encodeURIComponent(charId)}`,'b')).s===404,'DASH-S01 another player cannot select a foreign character');
check((await req('/api/dashboard','b')).d.characterCount===0,'DASH-S02 private characters are absent from another player dashboard');
check(JSON.stringify((await req('/api/records?kind=charaktere','b')).d).indexOf(secondDashboardCharacterId)===-1,'DASH-S03 character-list projection keeps private ownership filter');
const characterDetail=async(who)=>req('/api/character-detail?id='+charId+(who==='gm'?'&view=sl':''),who);
let charProjection=await characterDetail('a');
check(charProjection.s===200&&charProjection.d.sheet.attributes.Geschick===4,'CHAR-P01 attribute reload persists');
check(charProjection.d.sheet.abilities.Diebstahl===3,'CHAR-P02 fixed skill reload persists');
check(charProjection.d.sheet.customAbilities.length===3&&charProjection.d.sheet.customAbilities[0].category==='Talent','CHAR-P03/P04/P05 custom talent, skill and knowledge CRUD reload');
check(charProjection.d.sheet.disciplines[0].name==='Auspex','CHAR-P06 discipline CRUD reload');
check(charProjection.d.sheet.backgrounds[0].name==='Kontakte','CHAR-P07 background CRUD reload');
check(charProjection.d.sheet.merits[0].cost===2,'CHAR-P08 merit cost reload');
check(charProjection.d.sheet.flaws[0].cost===1,'CHAR-P09 flaw cost reload');
check(charProjection.d.sheet.humanity===7,'CHAR-P10 humanity persists');
check(charProjection.d.sheet.humanityPath==='Pfad QA','CHAR-P11 path and name persist');
check(charProjection.d.sheet.willpower.permanent===6,'CHAR-P12 permanent willpower persists');
check(charProjection.d.sheet.willpower.temporary===4,'CHAR-P13 temporary willpower persists');
check(charProjection.d.sheet.health.current==='Verletzt','CHAR-P14 health persists');
check(charProjection.d.sheet.blood.current===8,'CHAR-P15 current blood persists');
check(charProjection.d.sheet.blood.max===13,'CHAR-P16 blood maximum persists');
check(charProjection.d.sheet.blood.perRound===1,'CHAR-P17 blood per round persists');
check(charProjection.d.progression.freeXp===12,'CHAR-P18 free XP persists');
check(charProjection.d.sheet.clanWeakness==='QA','CHAR-P19 clan weakness persists');
const runtime=async(version,field,value)=>req('/api/character-runtime','a','PATCH',{id:charId,version,field,value});
let runtimeResult=await runtime(charProjection.d.revision.version,'blood',7);check(runtimeResult.s===200,'CHAR-R01 blood update succeeds');
charProjection=await characterDetail('a');check(charProjection.d.sheet.blood.current===7,'CHAR-R01 blood reload persists');
runtimeResult=await runtime(charProjection.d.revision.version,'willpowerTemporary',3);check(runtimeResult.s===200,'CHAR-R02 temporary willpower update succeeds');
charProjection=await characterDetail('a');check(charProjection.d.sheet.willpower.temporary===3,'CHAR-R02 temporary willpower reload persists');
runtimeResult=await runtime(charProjection.d.revision.version,'health','Verwundet');check(runtimeResult.s===200,'CHAR-R03 health update succeeds');
charProjection=await characterDetail('a');check(charProjection.d.sheet.health.current==='Verwundet'&&charProjection.d.sheet.health.legacy===true,'CHAR-R03 health reload preserves legacy fields');
runtimeResult=await runtime(charProjection.d.revision.version,'health','Gesund');check(runtimeResult.s===200,'CHAR-R03A health reset succeeds');
charProjection=await characterDetail('a');check(charProjection.d.sheet.health.current==='Gesund'&&charProjection.d.sheet.health.legacy===true,'CHAR-R03A health reset preserves other health fields');
check((await runtime(charProjection.d.revision.version,'blood',-1)).s===400,'CHAR-R04 negative blood rejected');
check((await runtime(charProjection.d.revision.version,'blood',14)).s===400,'CHAR-R05 blood above maximum rejected');
check((await runtime(charProjection.d.revision.version,'health','Invalid')).s===400,'CHAR-R06 invalid health rejected');
check((await characterDetail('a')).d.sheet.willpower.permanent===6,'CHAR-R07 runtime cannot alter permanent willpower');
const currentVersion=(await characterDetail('a')).d.revision.version;
check((await runtime(currentVersion,'blood',6)).s===200,'CHAR-R08 runtime increments revision');
check((await runtime(currentVersion,'blood',5)).s===409,'CHAR-R09/R10 stale runtime is a conflict without overwrite');
check((await characterDetail('a')).d.sheet.blood.current===6,'CHAR-R10 conflicting write did not overwrite server state');
check((await runtime((await characterDetail('a')).d.revision.version,'blood',5)).s===200,'CHAR-S01 owner can change runtime');
check((await req('/api/character-runtime','b','PATCH',{id:charId,version:1,field:'blood',value:4})).s===404,'CHAR-S02 other player cannot change runtime');
check((await characterDetail('b')).s===404,'CHAR-S03 other player cannot read character detail');
check(!JSON.stringify((await req('/api/records?kind=charaktere','b')).d).includes(charId),'CHAR-S04 private character not listed to other player');
check((await characterDetail('gm')).s===200,'CHAR-S07 authorized campaign SL reads private player character');
check((await characterDetail('gm')).d.permissions.canEdit===true,'CHAR-SL campaign SL receives character edit permission');
check(!(await req('/api/records?kind=charaktere','gm')).d.records.some(r=>r.id===charId),'WORKSPACE SL personal roster excludes foreign characters');
check((await req('/api/character-detail?id='+charId,'gm')).s===404,'WORKSPACE SL personal detail rejects foreign ID');
check((await req('/api/character-detail?id='+charId+'&view=sl','b')).s===403,'WORKSPACE player cannot forge SL inspection');
check((await req('/api/records?kind=charaktere&view=sl','b')).s===403,'WORKSPACE player cannot list SL roster');
check((await req('/api/dashboard?characterId='+charId,'gm')).s===404,'WORKSPACE personal dashboard rejects foreign character selection');
check((await req('/api/inventory?characterId='+charId,'gm')).s===404,'WORKSPACE personal inventory rejects foreign character selection');
check((await req('/api/inventory?view=sl','b')).s===403,'WORKSPACE player cannot forge SL inventory inspection');
const deniedWorkspace=await fetch(base+'/sl/command-center',{headers:ids.b});
const deniedWorkspaceHtml=await deniedWorkspace.text();
check(deniedWorkspaceHtml.includes('Nur für die Kampagnenredaktion')&&!deniedWorkspaceHtml.includes('SL-Workspace-Werkzeuge'),'WORKSPACE direct player URL cannot render SL preparation');
check((await req('/api/records?kind=charaktere&view=sl','gm')).d.records.some(r=>r.id===charId&&r.canEdit),'CHAR-SL private character appears in SL list');
check((await req('/api/command-center','gm')).d.characters.some(r=>r.id===charId),'CHAR-SL private character appears in Command Center selection');
for(const who of ['b','editor','blockedGm','pendingGm','otherCampaign','platformOnly'])check([401,403,404].includes((await characterDetail(who)).s),'CHAR-SL non-authorized identity cannot open another character: '+who);
const slRecord=(await req('/api/records?kind=charaktere&view=sl','gm')).d.records.find(r=>r.id===charId);
const slEdit={id:charId,version:slRecord.version,kind:'charaktere',title:slRecord.title,visibility:slRecord.visibility,body:{...slRecord.body,concept:'SL_SYNTHETIC_EDIT'}};
check((await req('/api/records','gm','POST',slEdit)).s===200,'CHAR-SL edits campaign player sheet through normal versioned write path');
check((await req('/api/records','gm','POST',slEdit)).s===409,'CHAR-SL stale edit cannot overwrite player changes');
const slRestored=await req('/api/records','gm','POST',{...slEdit,version:slRecord.version+1,body:slRecord.body});
check(slRestored.s===200&&(await characterDetail('a')).d.identity.concept===slRecord.body.concept,'CHAR-SL owner sees restored persisted original values');
const form=new FormData();form.set('file',new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:'image/png'}),'test.png');form.set('visibility','private');
const fileResponse=await fetch(base+'/api/files',{method:'POST',headers:ids.a,body:form}),file=await fileResponse.json();
check(fileResponse.status===200,'R2 upload works');check((await fetch(base+'/api/files?id='+file.id,{headers:ids.b})).status===404,'Private R2 file protected');check((await fetch(base+'/api/files?id='+file.id,{headers:ids.a})).status===200,'Owner reads R2 file');
const companionPatch=(body,who='a')=>req('/api/character-companion',who,'PATCH',body);
charProjection=await characterDetail('a');
check(charProjection.d.companion.lastSession===null,'COMP-S03 no session has clean empty state');
check((await companionPatch({action:'roleplay',id:charId,version:charProjection.d.revision.version,backgroundStory:'COMP_STORY',playGuide:'Auftreten: ruhig\nSprechweise: leise\nPrinzipien: vorsichtig'})).s===200,'COMP-P01 owner saves background and play guide');
charProjection=await characterDetail('a');
check(charProjection.d.roleplay.backgroundStory==='COMP_STORY'&&String(charProjection.d.roleplay.playGuide).includes('Sprechweise'),'COMP-P02 companion roleplay reload persists');
check((await companionPatch({action:'media',id:charId,version:charProjection.d.revision.version,fileId:file.id,mediaType:'portrait'})).s===200,'COMP-M01 owner attaches character portrait');
charProjection=await characterDetail('a');
check(String(charProjection.d.identity.portraitRef).includes(file.id)&&charProjection.d.companion.media.some(m=>m.type==='portrait'&&m.id===file.id),'COMP-M01 owner sees Character Portrait');
const invalidForm=new FormData();invalidForm.set('file',new Blob([new Uint8Array([1,2,3,4])],{type:'image/png'}),'fake.png');invalidForm.set('visibility','private');
check((await fetch(base+'/api/files',{method:'POST',headers:ids.a,body:invalidForm})).status===400,'COMP-M03 invalid image is rejected');
const otherForm=new FormData();otherForm.set('file',new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:'image/png'}),'other.png');otherForm.set('visibility','private');
const otherFileResponse=await fetch(base+'/api/files',{method:'POST',headers:ids.b,body:otherForm}),otherFile=await otherFileResponse.json();
check((await companionPatch({action:'media',id:charId,version:charProjection.d.revision.version,fileId:otherFile.id,mediaType:'reference'})).s===404,'COMP-M04 foreign File-ID cannot be attached');
const noteCreated=await companionPatch({action:'note.create',characterId:charId,title:'COMP private note',text:'COMP_PRIVATE_NOTE',visibility:'private'});
check(noteCreated.s===200,'COMP-N01 owner creates own private Character Note');
charProjection=await characterDetail('a');
check(JSON.stringify(charProjection.d.companion.notes).includes('COMP_PRIVATE_NOTE'),'COMP-N01 owner sees own private Character Note');
check(!JSON.stringify((await req('/api/records?kind=notizen','b')).d).includes('COMP_PRIVATE_NOTE'),'COMP-N02 other player cannot read private Character Note');
check((await companionPatch({action:'note.update',characterId:charId,noteId:noteCreated.d.id,version:1,title:'COMP edited note',text:'COMP_EDITED_NOTE',visibility:'private'})).s===200,'COMP-N06 owner edits Character Note');
charProjection=await characterDetail('a');
check(JSON.stringify(charProjection.d.companion.notes).includes('COMP_EDITED_NOTE'),'COMP-N06 edited Character Note reloads');
check((await companionPatch({action:'note.archive',characterId:charId,noteId:noteCreated.d.id,version:2})).s===200,'COMP-N07 owner archives Character Note');
charProjection=await characterDetail('a');
check(!JSON.stringify(charProjection.d.companion.notes).includes('COMP_EDITED_NOTE'),'COMP-N07 archived Character Note leaves active companion');
const sharedCharacter=await req('/api/records','a','POST',{kind:'charaktere',title:'QA Companion Shared',visibility:'group',body:{...characterBody,text:'Shared',testData:true}});
const sharedCharId=sharedCharacter.d.id;
const sharedDetail=async(who)=>req('/api/character-detail?id='+sharedCharId+(who==='gm'?'&view=sl':''),who);
check((await companionPatch({action:'note.create',characterId:sharedCharId,title:'COMP GM hidden private',text:'COMP_GROUP_PRIVATE',visibility:'private'})).s===200,'COMP-N03 owner creates private note on readable shared character');
check(!JSON.stringify((await sharedDetail('gm')).d).includes('COMP_GROUP_PRIVATE'),'COMP-N03/COMP-N04 GM/admin path does not automatically read private Player Note');
check((await companionPatch({action:'note.create',characterId:sharedCharId,title:'COMP SL shared',text:'COMP_SL_SHARED',visibility:'sl'})).s===200,'COMP-N05 explicitly shared SL note saved');
check(JSON.stringify((await sharedDetail('gm')).d).includes('COMP_SL_SHARED'),'COMP-N05 explicitly shared note is visible to allowed role');
const contact=await req('/api/entities','gm','POST',{type:'NPC',title:'QA Companion Contact',text:'KNOWN_CONTACT',gmBody:'REL_SECRET'});
const contactDraft=(await req('/api/entities/npc?id='+contact.d.id,'gm')).d;
check((await req('/api/entities/npc','gm','POST',{id:contact.d.id,revision:contactDraft.revision,title:contactDraft.entity.title,canonStatus:contactDraft.entity.canonStatus,playState:null,defaultVisibility:null,profile:{field_visibility:{name:'player_visible'}},blocks:[],retainedRelationships:[],addedRelationships:[]})).s===200,'COMP-R00 contact name explicitly released without releasing its text');
await req('/api/knowledge','gm','POST',{entityId:contact.d.id,audience:'player',playerId:'sprint1-a',state:'DISCOVERED'});
localSql(`INSERT INTO relationships(id,campaign_id,source_id,target_id,type,visibility,created_at) VALUES('rel-comp-known','chronik-von-kleve','${sharedCharId}','${contact.d.id}','Kontakt','group','test')`);
const secretContact=await req('/api/entities','gm','POST',{type:'NPC',canonStatus:'GM_SECRET',title:'QA Secret Contact',text:'SECRET_CONTACT'});
localSql(`INSERT INTO relationships(id,campaign_id,source_id,target_id,type,visibility,created_at) VALUES('rel-comp-secret','chronik-von-kleve','${sharedCharId}','${secretContact.d.id}','Kontakt','group','test')`);
const unknownContact=await req('/api/entities','gm','POST',{type:'NPC',title:'QA Unknown Contact',text:'UNKNOWN_CONTACT'});
localSql(`INSERT INTO relationships(id,campaign_id,source_id,target_id,type,visibility,created_at) VALUES('rel-comp-unknown','chronik-von-kleve','${sharedCharId}','${unknownContact.d.id}','Kontakt','group','test')`);
const relProjection=await sharedDetail('a');
check(JSON.stringify(relProjection.d.companion.relationships).includes('QA Companion Contact'),'COMP-R01 allowed Character Relationship visible');
check(!JSON.stringify(relProjection.d).includes('SECRET_CONTACT'),'COMP-R02 GM_SECRET Relationship not in Player Companion');
check(!JSON.stringify(relProjection.d).includes('UNKNOWN_CONTACT'),'COMP-R03 unknown Relationship remains hidden');
check(relProjection.d.companion.relationships.some(r=>r.id==='rel-comp-known'&&r.targetId===contact.d.id),'COMP-R04 relationship keeps stable IDs');
check((await req('/api/records','gm','POST',{kind:'sitzungen',title:'COMP letzte Sitzung',visibility:'group',body:{date:'2026-09-15',summary:'PLAYER_SAFE_SESSION',gm_secret:'SESSION_SECRET'},gmBody:'GM_SESSION_SECRET'})).s===200,'COMP-S01 player-safe session fixture saved');
const sessionProjection=await sharedDetail('a');
check(sessionProjection.d.companion.lastSession.summary==='PLAYER_SAFE_SESSION','COMP-S01 last player-safe session visible');
check(!JSON.stringify(sessionProjection.d).includes('GM_SESSION_SECRET')&&!JSON.stringify(sessionProjection.d).includes('SESSION_SECRET'),'COMP-S02 GM internal session text hidden');
// Inventory V1-A: first-class Character-owned items and safe server projection.
const invPayload=(characterId,overrides={})=>({characterId,name:'INV Test Item',category:'Werkzeug',description:'Synthetic inventory fixture',quantity:1,status:'Mitgeführt',visibility:'private',tags:['TEST_DATA'],testData:true,...overrides});
const inventory=(who,characterId,archived=false)=>req('/api/inventory?characterId='+encodeURIComponent(characterId)+(archived?'&includeArchived=1':'')+(who==='gm'?'&view=sl':''),who);
const inventoryCreate=async(who,payload,expectedCarryRevision)=>{const revision=expectedCarryRevision??(await inventory(who,payload.characterId)).d.carry.revision;return req('/api/inventory',who,'POST',{...payload,action:'create',expectedCarryRevision:revision})};
const inventoryPatch=async(who,item,payload,action='update',expectedCarryRevision)=>{const revision=expectedCarryRevision??(await inventory(who,payload.characterId,true)).d.carry.revision;return req('/api/inventory',who,'PATCH',{...payload,id:item.id,expectedRevision:item.revision,expectedCarryRevision:revision,action})};
const privateCreated=await inventoryCreate('a',invPayload(charId));
const characterAfterItem=await req('/api/character-detail?id='+charId,'a');
check(characterAfterItem.s===200&&!characterAfterItem.d.companion.relationships.some(r=>r.type==='character.owns'||r.targetId===privateCreated.d.id),'CHAR-POS-01 inventory ownership does not appear as a social relationship');
check((await req('/api/inventory','a','POST',{action:'update',...invPayload(charId,{name:'INV invalid command'})})).s===400,'INV-C01 Unknown create action is rejected');
check((await req('/api/inventory','a','POST',{action:'create',...invPayload(charId,{name:'INV unknown field'}),unknownField:'no'})).s===400,'INV-C02 Unknown Item field is rejected');
check((await req('/api/inventory','a','POST',{action:'create',...invPayload(charId,{category:'INVALID'})})).s===400,'INV-C03 Invalid category is rejected');
check((await req('/api/inventory','a','POST',{action:'create',...invPayload(charId,{quantity:0})})).s===400,'INV-C04 Invalid quantity is rejected');
check((await inventory('a',charId)).d.items.some(i=>i.id===privateCreated.d.id),'INV-01 Owner sees own Inventory');
check((await inventory('b',charId)).s===404,'INV-02 foreign PLAYER cannot see Inventory');
check(!JSON.stringify((await inventory('b',charId)).d).includes(privateCreated.d.id),'INV-03 foreign PLAYER cannot open Item');
check((await req('/api/inventory','b','PATCH',{...invPayload(charId),id:privateCreated.d.id,expectedRevision:1,action:'update'})).s===404,'INV-04 foreign PLAYER cannot change Item');
check(!JSON.stringify((await inventory('gm',charId)).d).includes(privateCreated.d.id),'INV-05 PRIVATE Item remains private, including from GM');
const slCreated=await inventoryCreate('a',invPayload(sharedCharId,{name:'INV SL Shared',visibility:'sl'}));
check(JSON.stringify((await inventory('gm',sharedCharId)).d).includes(slCreated.d.id),'INV-06 SL_SHARED follows existing GM policy');
check(privateCreated.s===201&&privateCreated.d.id.startsWith('item.'),'INV-07 Item creation returns stable Item ID');
let inv=(await inventory('a',charId)).d;let privateItem=inv.items.find(i=>i.id===privateCreated.d.id);
check(privateItem?.name==='INV Test Item'&&privateItem.testData===true,'INV-08 Reload keeps created TEST_DATA Item');
let updated=await inventoryPatch('a',privateItem,invPayload(charId,{name:'INV Edited'}));
check(updated.s===200,'INV-09 Owner edits own Item');
inv=(await inventory('a',charId)).d;privateItem=inv.items.find(i=>i.id===privateCreated.d.id);
check(privateItem?.name==='INV Edited','INV-10 Reload keeps Item edit');
updated=await inventoryPatch('a',privateItem,invPayload(charId,{name:'INV Edited',quantity:4}));inv=(await inventory('a',charId)).d;privateItem=inv.items.find(i=>i.id===privateCreated.d.id);
check(privateItem?.quantity===4,'INV-11 Quantity update persists');
updated=await inventoryPatch('a',privateItem,invPayload(charId,{name:'INV Edited',quantity:4,status:'Ausgerüstet'}));inv=(await inventory('a',charId)).d;privateItem=inv.items.find(i=>i.id===privateCreated.d.id);
check(privateItem?.status==='Ausgerüstet','INV-12 Status update persists');
updated=await inventoryPatch('a',privateItem,invPayload(charId,{name:'INV Edited',quantity:4,status:'Ausgerüstet',visibility:'group'}));inv=(await inventory('a',charId)).d;privateItem=inv.items.find(i=>i.id===privateCreated.d.id);
check(privateItem?.visibility==='group','INV-13 Visibility update persists');
check((await inventoryPatch('a',privateItem,invPayload(charId,{name:'INV Edited',quantity:4,status:'Ausgerüstet',visibility:'group'}),'archive')).s===200,'INV-14 Owner archives Item without hard delete');
check(!(await inventory('a',charId)).d.items.some(i=>i.id===privateCreated.d.id)&&(await inventory('a',charId,true)).d.items.some(i=>i.id===privateCreated.d.id),'INV-15 Archived Item leaves active Bag but remains retrievable');
const weaponData=invPayload(charId,{name:'INV Weapon',category:'Waffe',weaponProfile:{damage:'TEST 4',range:'TEST 20',rate:'TEST 2',capacity:'TEST 9',concealability:'TEST J',currentAmmo:7,note:'synthetic'}});
const weaponCreated=await inventoryCreate('a',weaponData);let weapon=(await inventory('a',charId)).d.items.find(i=>i.id===weaponCreated.d.id);
check(weapon?.weaponProfile?.currentAmmo===7&&weapon.weaponProfile.damage==='TEST 4','INV-16 Weapon Profile persists structurally');
const armorCreated=await inventoryCreate('a',invPayload(charId,{name:'INV Armor',category:'Schutz / Rüstung',description:'Synthetic armor fixture',quantity:1,status:'Ausgerüstet'}));
check(armorCreated.s===201&&(await inventory('a',charId)).d.items.some(i=>i.id===armorCreated.d.id&&i.category==='Schutz / Rüstung'),'INV-C05 Protective equipment create and reload work');
check(Object.keys(weapon.weaponProfile).every(k=>['damage','range','rate','capacity','concealability','currentAmmo','note'].includes(k)),'INV-17 Only schema Weapon fields are stored');
check((await inventoryCreate('a',{...weaponData,weaponProfile:{...weaponData.weaponProfile,currentAmmo:-2,arbitrary:'NO'}})).s===400,'INV-18 Invalid Weapon values are rejected server-side');
const imageCreated=await inventoryCreate('a',invPayload(charId,{name:'INV Image',imageFileId:file.id}));
check(imageCreated.s===201&&(await inventory('a',charId)).d.items.some(i=>i.id===imageCreated.d.id&&i.imageFileId===file.id),'INV-19 Own secure image file can be linked');
check((await inventoryCreate('a',invPayload(charId,{name:'INV Foreign Image',imageFileId:otherFile.id}))).s===404,'INV-20 Foreign File ID is rejected');
const pdfForm=new FormData();pdfForm.set('file',new Blob([new TextEncoder().encode('%PDF-1.4 TEST')],{type:'application/pdf'}),'test.pdf');pdfForm.set('visibility','private');const pdfResponse=await fetch(base+'/api/files',{method:'POST',headers:ids.a,body:pdfForm}),pdfFile=await pdfResponse.json();
check(pdfResponse.status===200&&(await inventoryCreate('a',invPayload(charId,{name:'INV PDF',imageFileId:pdfFile.id}))).s===400,'INV-21 Non-image MIME type is rejected for Item image');
weapon=(await inventory('a',charId)).d.items.find(i=>i.id===weaponCreated.d.id);const beforeWeaponRevision=weapon.revision;
check((await inventoryPatch('a',weapon,{...weaponData,name:'INV Weapon Revised'})).d.revision===beforeWeaponRevision+1,'INV-22 Update increments Item revision');
check((await inventoryPatch('a',weapon,{...weaponData,name:'INV Stale'})).s===409,'INV-23 Stale Item revision returns HTTP 409');
check((await inventory('a',charId)).d.items.find(i=>i.id===weaponCreated.d.id).name==='INV Weapon Revised','INV-24 Conflict does not overwrite server data');
const itemEntity=(await req('/api/export?scope=campaign','gm')).d.relationships.find(r=>r.target_id===weaponCreated.d.id);
check(itemEntity?.source_id===charId&&itemEntity.type==='character.owns','INV-25 Item remains bound to stable Character ID');
check(!(await inventory('a',sharedCharId)).d.items.some(i=>i.id===weaponCreated.d.id),'INV-26 Character A Item does not appear for Character B');
const otherInventoryItem=await inventoryCreate('a',invPayload(sharedCharId,{name:'INV Other Character'}));
check((await inventory('a',sharedCharId)).d.items.some(i=>i.id===otherInventoryItem.d.id)&&!(await inventory('a',charId)).d.items.some(i=>i.id===otherInventoryItem.d.id),'INV-27 Multiple own Character inventories remain separated');
const archivedCharacter=await req('/api/records','a','POST',{kind:'charaktere',title:'INV Archived Character',visibility:'private',body:{...characterBody,archived:true,testData:true}});
check((await inventory('a',archivedCharacter.d.id)).s===404&&(await req('/api/inventory','a')).d.requiresCharacterSelection===true,'INV-28 Archived Character is never silently selected as active context');
// Inventory V1-B verification on a separate disposable Character fixture.
const carryCharacter=await req('/api/records','a','POST',{kind:'charaktere',title:'INV-B QA Character',visibility:'private',body:{...characterBody,player:'QA owner',testData:true}}),carryCharacterId=carryCharacter.d.id;
const carryInventory=()=>inventory('a',carryCharacterId,true);
const changeCarryProfile=(profile,expectedRevision)=>req('/api/inventory/profile','a','PATCH',{characterId:carryCharacterId,profile,expectedRevision});
let carryView=await carryInventory();
check(carryView.d.carry.profile==='BODY_ONLY'&&carryView.d.carry.capacity===4,'INV-B02 Legacy/default Character resolves to BODY_ONLY');
let profileChange=await changeCarryProfile('BODY_ONLY',carryView.d.carry.revision);carryView=profileChange.d;
const savedProfileRows=(await req('/api/export?scope=campaign','gm')).d.records.filter(r=>r.kind==='inventory_carry'&&r.title===carryCharacterId);
check(profileChange.s===200&&savedProfileRows.length===1&&JSON.parse(savedProfileRows[0].body).profile==='BODY_ONLY','INV-B01 exactly one active Carry Profile is stored per Character');
for(const [profile,capacity] of [['BODY_ONLY',4],['BACKPACK_SMALL',8],['BACKPACK_MEDIUM',12],['BACKPACK_LARGE',20]]){const response=await changeCarryProfile(profile,carryView.carry.revision);carryView=response.d;check(response.s===200&&carryView.carry.capacity===capacity,`INV-B03 ${profile} derives capacity ${capacity}`)}
carryView=await changeCarryProfile('BODY_ONLY',carryView.carry.revision).then(r=>r.d);
profileChange=await changeCarryProfile('BACKPACK_SMALL',carryView.carry.revision);carryView=profileChange.d;
check(profileChange.s===200&&carryView.carry.profile==='BACKPACK_SMALL','INV-B04 larger Carry Profile can be selected');
profileChange=await changeCarryProfile('BACKPACK_LARGE',carryView.carry.revision);carryView=profileChange.d;
const overfull=await inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B 15 Slot Load',slotCost:15,location:'BACKPACK'}));
carryView=await carryInventory();
const blockedSmall=await changeCarryProfile('BACKPACK_MEDIUM',carryView.d.carry.revision);
check(blockedSmall.s===409&&blockedSmall.d.error.includes('3 Slots müssen zuerst'), 'INV-B05 smaller profile is blocked with a clear capacity conflict');
carryView=await carryInventory();
check(carryView.d.items.some(i=>i.id===overfull.d.id&&i.location==='BACKPACK')&&carryView.d.carry.profile==='BACKPACK_LARGE','INV-B06 profile conflict neither deletes nor moves Items');
let loaded=carryView.d.items.find(i=>i.id===overfull.d.id);
check((await inventoryPatch('a',loaded,invPayload(carryCharacterId,{name:loaded.name,status:'Gelagert',location:'STORED',slotCost:15}))).s===200,'INV-B setup: large load can be stored');
for(const [profile,capacity,testId] of [['BODY_ONLY',4,'INV-B07'],['BACKPACK_SMALL',8,'INV-B08'],['BACKPACK_MEDIUM',12,'INV-B09'],['BACKPACK_LARGE',20,'INV-B10']]){
 carryView=(await carryInventory()).d;const switched=await changeCarryProfile(profile,carryView.carry.revision);carryView=switched.d;
 const exact=await inventoryCreate('a',invPayload(carryCharacterId,{name:`${testId} exact capacity`,slotCost:capacity,location:'BACKPACK'}));
 check(switched.s===200&&exact.s===201&&(await carryInventory()).d.carry.used===capacity,`${testId} capacity admits exactly ${capacity} slots`);
 const reject=await inventoryCreate('a',invPayload(carryCharacterId,{name:`${testId} over capacity`,slotCost:1,location:'BACKPACK'}));
 check(reject.s===409,`${testId} rejects capacity overflow server-side`);
 const storedVersion=(await carryInventory()).d.items.find(i=>i.id===exact.d.id);
 await inventoryPatch('a',storedVersion,invPayload(carryCharacterId,{name:storedVersion.name,status:'Gelagert',location:'STORED',slotCost:capacity}));
}
carryView=(await carryInventory()).d;
const storedLarge=await inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B Stored 20 Slots',status:'Gelagert',location:'STORED',slotCost:20}));
check(storedLarge.s===201&&(await carryInventory()).d.carry.used===0,'INV-B11 STORED items do not count against carry capacity');
carryView=(await carryInventory()).d;carryView=(await changeCarryProfile('BODY_ONLY',carryView.carry.revision)).d;
const bodyItem=await inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B Body Item',location:'BODY',bodySlot:'HAND_LEFT',slotCost:2}));
const backpackItem=await inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B Backpack Item',location:'BACKPACK',slotCost:2}));
carryView=(await carryInventory()).d;
check(bodyItem.s===201&&backpackItem.s===201&&carryView.carry.used===4,'INV-B12 BODY and BACKPACK both count against capacity');
check(bodyItem.s===201&&(await carryInventory()).d.items.some(i=>i.id===bodyItem.d.id&&i.location==='BODY'&&i.bodySlot==='HAND_LEFT'),'INV-B14 Item can be assigned to BODY and a Body Slot');
check((await carryInventory()).d.items.some(i=>i.id===bodyItem.d.id&&i.bodySlot==='HAND_LEFT'),'INV-B15 Body Placement survives a fresh request/reload');
const collision=await inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B Collision',location:'BODY',bodySlot:'HAND_LEFT'}));
check(collision.s===409&&collision.d.error.includes('Linke Hand ist bereits durch INV-B Body Item belegt'),'INV-B16 occupied Body Slot returns the occupying Item name');
check((await inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B Over Capacity',slotCost:1,location:'BACKPACK'}))).s===409,'INV-B13 server rejects capacity overflow');
let currentBody=(await carryInventory()).d.items.find(i=>i.id===bodyItem.d.id);
const bodyToBag=await inventoryPatch('a',currentBody,invPayload(carryCharacterId,{name:currentBody.name,location:'BACKPACK',status:'Mitgeführt',slotCost:2}));
check(bodyToBag.s===200&&(await carryInventory()).d.items.find(i=>i.id===bodyItem.d.id).location==='BACKPACK','INV-B17 BODY to BACKPACK placement works');
let currentBag=(await carryInventory()).d.items.find(i=>i.id===backpackItem.d.id);
const bagToStored=await inventoryPatch('a',currentBag,invPayload(carryCharacterId,{name:currentBag.name,location:'STORED',status:'Gelagert',slotCost:2}));
check(bagToStored.s===200&&(await carryInventory()).d.carry.used===2,'INV-B18 BACKPACK to STORED frees capacity');
const classes=['T','J','M','N',null],classResults=[];
for(const concealmentClass of classes)classResults.push(await inventoryCreate('a',invPayload(carryCharacterId,{name:`INV-B Class ${concealmentClass??'empty'}`,category:'Waffe',status:'Gelagert',location:'STORED',weaponProfile:{damage:'',range:'',rate:'',capacity:'',concealability:'',concealmentClass}})));
check(classResults.every(result=>result.s===201),'INV-B19 V20 concealment accepts T/J/M/N and null');
const visibleWeapon=await inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B Visible N Weapon',category:'Waffe',location:'BODY',bodySlot:'BACK_EXTERNAL',weaponProfile:{damage:'',range:'',rate:'',capacity:'',concealability:'',concealmentClass:'N'}}));
carryView=(await carryInventory()).d;
check(visibleWeapon.s===201&&carryView.carry.attention==='SEHR_AUFFAELLIG'&&carryView.carry.warningItems.includes(visibleWeapon.d.id),'INV-B20 N weapon on open Body placement raises attention warning');
check((await inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B Invalid concealment',category:'Waffe',weaponProfile:{damage:'',range:'',rate:'',capacity:'',concealability:'',concealmentClass:'anything'}}))).s===400,'INV-B21 arbitrary concealment values are rejected');
weapon=(await inventory('a',charId)).d.items.find(i=>i.id===weaponCreated.d.id);
check(weapon?.weaponProfile&&weapon.weaponProfile.concealmentClass===undefined,'INV-B22 legacy Weapon Profile without concealment remains valid');
const noWeight=await inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B No Weight'}));
check(noWeight.s===201&&(await carryInventory()).d.items.some(i=>i.id===noWeight.d.id&&i.weightKg===undefined),'INV-B23 weightKg stays optional');
const armorValid=await inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B Armor Valid',category:'Schutz / Rüstung',status:'Gelagert',location:'STORED',armorProfile:{armorClass:5,armorValue:100,dexterityPenalty:-20}}));
check(armorValid.s===201&&(await carryInventory()).d.items.some(i=>i.id===armorValid.d.id&&i.armorProfile?.armorClass===5),'INV-B24 armorClass accepts boundary values 1 through 5');
check((await inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B Armor Class 0',category:'Schutz / Rüstung',armorProfile:{armorClass:0}}))).s===400&&(await inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B Armor Class 6',category:'Schutz / Rüstung',armorProfile:{armorClass:6}}))).s===400,'INV-B24 armorClass outside 1 through 5 is rejected');
check((await inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B Armor Value Invalid',category:'Schutz / Rüstung',armorProfile:{armorValue:101}}))).s===400,'INV-B25 armorValue range is validated');
check((await inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B Dexterity Penalty Invalid',category:'Schutz / Rüstung',armorProfile:{dexterityPenalty:1}}))).s===400,'INV-B26 dexterityPenalty range is validated');
carryView=(await carryInventory()).d;carryView=(await changeCarryProfile('BACKPACK_LARGE',carryView.carry.revision)).d;
const priorUsed=carryView.carry.used;
const heavyOptional=await inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B Optional Weight',weightKg:9000,slotCost:1,location:'BACKPACK'}));
carryView=(await carryInventory()).d;
check(heavyOptional.s===201&&carryView.carry.used===priorUsed+1&&carryView.items.some(i=>i.id===heavyOptional.d.id&&i.weightKg===9000)&&!Object.keys(carryView).some(key=>/movement|weightPenalty/i.test(key)),'INV-B27 weightKg does not activate load or movement penalties');
const profileInvalid=await req('/api/inventory/profile','a','PATCH',{characterId:carryCharacterId,profile:'BACKPACK_HUGE',expectedRevision:carryView.carry.revision});
check(profileInvalid.s===400,'INV-B-C01 unknown Carry Profile is rejected');
check((await inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B Unknown Body Slot',location:'BODY',bodySlot:'GLOVE'}))).s===400,'INV-B-C02 unknown Body Slot is rejected');
check((await inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B Body Without Slot',location:'BODY'}))).s===400,'INV-B-C03 BODY without a Body Slot is rejected');
check((await inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B Backpack With Slot',location:'BACKPACK',bodySlot:'HAND_LEFT'}))).s===400,'INV-B-C04 BACKPACK with Body Slot is rejected');
check((await inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B Stored With Slot',location:'STORED',status:'Gelagert',bodySlot:'HAND_LEFT'}))).s===400,'INV-B-C05 STORED with Body Slot is rejected');
carryView=(await carryInventory()).d;
check((await req('/api/inventory/profile','b','PATCH',{characterId:carryCharacterId,profile:'BACKPACK_SMALL',expectedRevision:carryView.carry.revision})).s===404,'INV-B-C06 foreign Player cannot change Carry Profile');
check((await req('/api/inventory','b','PATCH',{...invPayload(carryCharacterId,{name:'INV-B stolen placement',location:'STORED',status:'Gelagert'}),id:bodyItem.d.id,expectedRevision:1,expectedCarryRevision:carryView.carry.revision,action:'update'})).s===404,'INV-B-C07 foreign Player cannot change Item Placement');
const beforeStale=carryView.carry.revision;
profileChange=await changeCarryProfile('BACKPACK_LARGE',beforeStale);carryView=profileChange.d;
check(profileChange.s===200&&(await changeCarryProfile('BACKPACK_MEDIUM',beforeStale)).s===409,'INV-B-C08 stale Carry Profile revision returns 409');
check((await inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B stale carry create'}),beforeStale)).s===409,'INV-B-C08 stale Placement revision returns 409');
const raceRevision=carryView.carry.revision;
const placementRace=await Promise.all([inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B race A',status:'Gelagert',location:'STORED'}),raceRevision),inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B race B',status:'Gelagert',location:'STORED'}),raceRevision)]);
check(placementRace.filter(result=>result.s===201).length===1&&placementRace.filter(result=>result.s===409).length===1,'INV-B-C08 concurrent placements with same Carry revision allow exactly one writer');
carryView=(await carryInventory()).d;
const duplicateRows=(await req('/api/export?scope=campaign','gm')).d.records.filter(r=>r.kind==='inventory_carry'&&r.title===carryCharacterId);
check(duplicateRows.length===1,'INV-B-C01 concurrent saves retain exactly one Carry Profile record');
const createContractRegression=await inventoryCreate('a',invPayload(carryCharacterId,{name:'INV-B Create Contract Regression'}));
check(createContractRegression.s===201&&(await carryInventory()).d.items.some(i=>i.id===createContractRegression.d.id),'INV-B-C09 Version 30 Create Item contract remains functional');
await inventory2Integration({req,check,inventory,inventoryCreate,inventoryPatch,invPayload,characterBody,localSql,sqlQuote,base,ids});
const imported=await req('/api/catalog','gm','POST',{});check(imported.s===200,'Legacy catalogue import works');
check((await req('/api/catalog','gm','POST',{})).d.imported===0,'Legacy catalogue reimport is idempotent');
const backup=(await req('/api/export?scope=campaign','gm')).d;
check((await req('/api/recovery')).s===401,'Recovery denies anonymous');
check((await req('/api/recovery','a')).s===403,'Recovery denies players');
check((await req('/api/recovery','a','POST',{offset:0})).s===403,'Players cannot import recovery');
check((await req('/api/recovery','gm','POST',{offset:0},{origin:'https://foreign.invalid'})).s===403,'Recovery rejects cross-origin writes');
check((await req('/api/recovery','gm','POST',{offset:0})).s===400,'Recovery requires explicit import confirmation');
const beforeRecovery=(await req('/api/export?scope=campaign','gm')).d;
let offset=0,total=1;
while(offset<total){const r=await req('/api/recovery','gm','POST',{offset,mode:'confirmed-recovery-import'});assert.equal(r.s,200,JSON.stringify(r.d));offset=r.d.next;total=r.d.total;}
const recovered=(await req('/api/recovery','gm')).d;
check(recovered.importedSources===recovered.expectedSources&&recovered.importedRecords===recovered.expectedRecords,'Recovery imports every source and indexed claim');
const afterRecovery=(await req('/api/export?scope=campaign','gm')).d;
check(JSON.stringify(beforeRecovery.records)===JSON.stringify(afterRecovery.records),'Recovery does not overwrite legacy records');
check(JSON.stringify(beforeRecovery.knowledge)===JSON.stringify(afterRecovery.knowledge),'Recovery grants no knowledge');
check(JSON.stringify(beforeRecovery.world_events)===JSON.stringify(afterRecovery.world_events),'Recovery invents no world events');
check(afterRecovery.recovery_records.length===recovered.expectedRecords,'Campaign export includes recovery');
const claim=recovered.records[0];const detail=await req('/api/recovery?id='+claim.id,'gm');check(detail.s===200&&detail.d.original!==undefined,'GM reads checksum-verified original');
check((await req('/api/recovery?id='+claim.id,'a')).s===403,'Player cannot read original by ID');
const native=afterRecovery.entities.find(e=>JSON.parse(e.content).recoveryOnly);
check(native&&native.canon_status==='GM_SECRET','New recovery entities are GM_SECRET');
check((await req('/api/entities?id='+native.id,'a')).s===404,'Player cannot read recovery entity');
check((await req('/api/knowledge','gm','POST',{entityId:native.id,audience:'group',state:'VERIFIED'})).s===400,'Unreviewed recovery entity cannot be granted');
check((await req('/api/recovery','gm','POST',{offset:0,mode:'confirmed-recovery-import'})).s===200,'Recovery repeat is safe');
check((await req('/api/recovery','gm')).d.importedRecords===recovered.expectedRecords,'Recovery repeat creates no duplicate claims');
for(const key of ['campaigns','entities','relationships','knowledge','world_events','records','files','members'])check(Array.isArray(backup[key]),'Backup contains '+key);
check(backup.records.filter(r=>r.id.startsWith('legacy-')).length===67,'All 67 imported records included');
check(backup.files.some(f=>f.id===file.id&&f.key),'Backup contains R2 metadata');
check(backup.records.some(r=>r.id===note.d.id),'Campaign export includes other owner records');
check(backup.binaries.included===false,'Separate R2 binary handling explicit');
for(const kind of ['charaktere','inventar','wirtschaft','gefallen','sitzungen','chronik','schauplaetze','nscs','archiv','regelwerk','haendler','termine','neuigkeiten'])check((await req('/api/records?kind='+kind,'gm')).s===200,'Existing API '+kind);
await req('/api/files','a','DELETE',{id:file.id});await req('/api/records','a','DELETE',{id:note.d.id,version:2});await req('/api/records','gm','DELETE',{id:shared.d.id,version:1});

// Phase C editorial workflow: all records below live only in this disposable Test-D1 and Test-R2.
localSql(`INSERT INTO members(id,campaign_id,email,name,status,created_at) VALUES
('sprint1-editor','chronik-von-kleve','editor@sprint.invalid','Phase C Editor','active','phase-c-test'),
('sprint1-blocked-player','chronik-von-kleve','blocked-player@sprint.invalid','Blocked Phase C Player','blocked','phase-c-test')
ON CONFLICT(id) DO UPDATE SET status=excluded.status;
INSERT INTO auth_member_links(auth_user_id,member_id,approved_by,approval_reference,linked_at) VALUES
('auth-editor','sprint1-editor','isolated-test-operator','TEST_DATA:phase-c-editor','phase-c-test'),
('auth-blockedPlayer','sprint1-blocked-player','isolated-test-operator','TEST_DATA:phase-c-blocked-player','phase-c-test');
UPDATE members SET status='active' WHERE id IN ('sprint1-a','sprint1-b');
INSERT INTO campaign_memberships(campaign_id,user_id,role,status,source,version,created_at,updated_at) VALUES
('chronik-von-kleve','sprint1-a','player','active','manual',1,'phase-c-test','phase-c-test'),
('chronik-von-kleve','sprint1-b','player','active','manual',1,'phase-c-test','phase-c-test'),
('chronik-von-kleve','sprint1-editor','campaign_editor','active','manual',1,'phase-c-test','phase-c-test'),
('chronik-von-kleve','sprint1-blocked-player','player','blocked','manual',1,'phase-c-test','phase-c-test')
ON CONFLICT(campaign_id,user_id) DO UPDATE SET role=excluded.role,status=excluded.status,version=campaign_memberships.version+1,updated_at=excluded.updated_at;`);
check((await req('/api/cms/locations','a')).s===403,'Phase C editor APIs deny ordinary players');
const cmsCatalog=await req('/api/cms/locations','editor');
check(cmsCatalog.s===200&&cmsCatalog.d.locations.some(place=>place.id==='place.electric-taberna'),'Campaign editor can open existing Electric Taberna without creating a new location');
const forbiddenEditorCreate=await req('/api/cms/locations','editor','POST',{level:'location',title:'TEST_DATA editor forbidden place'});
check(forbiddenEditorCreate.s===403,'Campaign editor cannot create new stable world identities');
const createdCmsPlace=await req('/api/cms/locations','gm','POST',{level:'location',title:'TEST_DATA Etappe 2 Hauptort'});
check(createdCmsPlace.s===201&&createdCmsPlace.d.id.startsWith('place.')&&createdCmsPlace.d.locationId===createdCmsPlace.d.id,'GM creates a new stable main-place identity');
const createdCmsArea=await req('/api/cms/locations','gm','POST',{level:'area',parentId:createdCmsPlace.d.id,title:'TEST_DATA Etappe 2 Bereich'});
check(createdCmsArea.s===201&&createdCmsArea.d.locationId===createdCmsPlace.d.id&&createdCmsArea.d.parentId===createdCmsPlace.d.id,'GM creates an area under its selected main place');
const createdCmsRoom=await req('/api/cms/locations','gm','POST',{level:'room',parentId:createdCmsArea.d.id,title:'TEST_DATA Etappe 2 Raum'});
check(createdCmsRoom.s===201&&createdCmsRoom.d.locationId===createdCmsPlace.d.id&&createdCmsRoom.d.parentId===createdCmsArea.d.id,'GM creates a room under its selected area');
check((await req('/api/cms/locations','gm','POST',{level:'room',parentId:createdCmsPlace.d.id,title:'TEST_DATA wrong parent'})).s===400,'CMS rejects a room placed directly under a main place');
check((await req('/api/cms/locations','gm','POST',{level:'location',title:'TEST_DATA extra fields',visibility:'public'})).s===400,'CMS creation rejects unknown visibility or payload fields');
const createdCmsTree=await req('/api/cms/locations?place='+encodeURIComponent(createdCmsPlace.d.id),'gm');
const createdNodesById=new Map((createdCmsTree.d.nodes||[]).map(item=>[item.id,item]));
check(createdCmsTree.s===200&&createdNodesById.get(createdCmsPlace.d.id)?.level==='location'&&createdNodesById.get(createdCmsArea.d.id)?.parentId===createdCmsPlace.d.id&&createdNodesById.get(createdCmsRoom.d.id)?.parentId===createdCmsArea.d.id,'New location hierarchy reloads from the existing location_nodes model');
const createdRootDraft=await req('/api/cms/drafts?entityId='+encodeURIComponent(createdCmsPlace.d.id),'gm');
const createdAreaDraft=await req('/api/cms/drafts?entityId='+encodeURIComponent(createdCmsArea.d.id),'gm');
const createdRoomDraft=await req('/api/cms/drafts?entityId='+encodeURIComponent(createdCmsRoom.d.id),'gm');
check([createdRootDraft,createdAreaDraft,createdRoomDraft].every(result=>result.s===200&&result.d.drafts.length===1&&result.d.drafts[0].status==='draft'&&result.d.drafts[0].audience_scope==='group'),'Each new identity starts with a saved but unpublished group draft');
check((await req('/api/locations?place='+encodeURIComponent(createdCmsPlace.d.id)+'&view=player&target=player','a')).s===404&&!JSON.stringify((await req('/api/locations?view=player&target=player','a')).d).includes('TEST_DATA Etappe 2'),'New place remains absent from player detail and hub until explicitly released');
check((await req('/api/cms/releases?entityId=place.electric-taberna&scope=group','editor')).s===403,'Campaign editor cannot read protected publisher controls');
check((await req('/api/cms/locations','blockedPlayer')).s===403,'Blocked campaign membership cannot open the CMS or campaign APIs');
check((await req('/api/cms/locations','otherCampaign')).s===403,'A different campaign membership does not grant access to Kleve CMS');
localSql(`INSERT INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,title,content,gm_body,version,created_at,updated_at)
VALUES('info.phase-c-gm-secret','chronik-von-kleve','INFORMATION','WORKING','sprint1-gm','sl','TEST_DATA_SL_ONLY_TITLE',
'{"locationLevel":"information","title":"TEST_DATA_SL_ONLY_TITLE","text":"TEST_DATA_SL_ONLY_BODY"}','',1,'phase-c-test','phase-c-test');
INSERT INTO location_nodes(entity_id,campaign_id,location_id,parent_id,level,position,world_state,world_visibility,world_subject_id,markers,attributes,revision,updated_at)
VALUES('info.phase-c-gm-secret','chronik-von-kleve','place.electric-taberna','place.electric-taberna','information',999,'active','gm',NULL,'[]',
'{"title":"TEST_DATA_SL_ONLY_TITLE","text":"TEST_DATA_SL_ONLY_BODY","visibility":"gm","discovery":"hidden"}',1,'phase-c-test');
INSERT INTO knowledge(id,campaign_id,entity_id,audience,subject_id,state,discovery_state,version,granted_by,created_at,updated_at)
VALUES('knowledge.phase-c-known-root','chronik-von-kleve','place.electric-taberna','player','sprint1-a','DISCOVERED','known',1,'sprint1-gm','phase-c-test','phase-c-test');`);
const editorLocationTree=await req('/api/cms/locations?place=place.electric-taberna','editor');
const editorTreeWire=JSON.stringify(editorLocationTree.d);
check(editorLocationTree.s===200&&!editorTreeWire.includes('TEST_DATA_SL_ONLY_TITLE')&&!editorTreeWire.includes('TEST_DATA_SL_ONLY_BODY'),'Campaign editor location tree omits SL-only information node and its metadata');
check((await req('/api/cms/drafts?entityId=info.phase-c-gm-secret','editor')).s===404,'Campaign editor cannot address an SL-only information node by its stable ID');
check(editorLocationTree.s===200&&editorLocationTree.d.nodes.some(item=>item.id==='area.electric-taberna.staff-back'&&item.visibility==='gm')&&editorLocationTree.d.nodes.some(item=>item.id==='room.electric-taberna.office'&&item.visibility==='gm'),'Campaign editor tree clearly labels SL-only areas and rooms without exposing their private revision payloads');
const gmLocationTree=await req('/api/cms/locations?place=place.electric-taberna','gm');
check(gmLocationTree.s===200&&gmLocationTree.d.nodes.some(item=>item.id==='info.phase-c-gm-secret'&&item.visibility==='gm')&&gmLocationTree.d.nodes.some(item=>item.id==='area.electric-taberna.staff-back'&&item.visibility==='gm')&&gmLocationTree.d.nodes.some(item=>item.id==='room.electric-taberna.office'&&item.visibility==='gm'),'Spielleitung can identify SL-only information, areas and rooms in the location tree');
const playerLocationWithGmNote=await req('/api/locations?place=place.electric-taberna&view=player&target=player','a');
check(playerLocationWithGmNote.s===200&&!JSON.stringify(playerLocationWithGmNote.d).includes('TEST_DATA_SL_ONLY_BODY'),'Known player location projection excludes GM-only information even when its parent is known');

const cmsCreate=(entityId,scope,who='gm',playerId)=>req('/api/cms/drafts',who,'POST',{entityId,audience:scope,...(playerId?{playerId}:{})});
const cmsSave=(revisionId,expectedVersion,payload,extra={},who='gm')=>req('/api/cms/drafts',who,'PATCH',{revisionId,expectedVersion,payload,...extra});
const cmsTransition=(who,action,revisionId,expectedVersion,reason='Phase C isolated review')=>req('/api/cms/transitions',who,'POST',{action,revisionId,expectedVersion,reason});
const cmsRelease=(who,action,entityId,scope,expectedReleaseVersion,revisionId,extra={})=>req('/api/cms/releases',who,'POST',{action,entityId,scope,expectedReleaseVersion,...(revisionId?{revisionId}:{}),...extra,reason:'Phase C isolated Test-D1 release QA'});
const newPlaceDraft=createdRootDraft.d.drafts[0];
const newPlacePayload=JSON.parse(newPlaceDraft.player_payload_json);
const savedNewPlace=await cmsSave(newPlaceDraft.id,newPlaceDraft.version,{...newPlacePayload,title:'TEST_DATA Etappe 2 freigegebener Hauptort'});
const submittedNewPlace=savedNewPlace.s===200?await cmsTransition('gm','submit',newPlaceDraft.id,savedNewPlace.d.version,'Direktfreigabe im SL-CMS'):null;
const approvedNewPlace=submittedNewPlace?.s===200?await cmsTransition('gm','approve',newPlaceDraft.id,submittedNewPlace.d.version,'Direktfreigabe im SL-CMS'):null;
const publishedNewPlace=approvedNewPlace?.s===200?await req('/api/cms/releases','gm','POST',{action:'publish',entityId:createdCmsPlace.d.id,scope:'group',revisionId:newPlaceDraft.id,expectedReleaseVersion:0,discoveryState:'known',reason:'Direktfreigabe im SL-CMS'}):null;
const newPlacePlayerView=publishedNewPlace?.s===200?await req('/api/locations?place='+encodeURIComponent(createdCmsPlace.d.id)+'&view=player&target=player','a'):null;
const newPlaceReleaseLog=publishedNewPlace?.s===200?await req('/api/cms/releases?entityId='+encodeURIComponent(createdCmsPlace.d.id)+'&scope=group','gm'):null;
check(savedNewPlace.s===200&&submittedNewPlace?.s===200&&approvedNewPlace?.s===200&&publishedNewPlace?.s===200&&newPlacePlayerView?.d.projection.location.title==='TEST_DATA Etappe 2 freigegebener Hauptort'&&newPlaceReleaseLog?.d.history[0]?.reason==='Direktfreigabe im SL-CMS','New location group draft completes save, submit, approve, publish, player projection, and auditable default note');
const publicDraft=await cmsCreate('place.electric-taberna','public','gm');
const newInformation=await req('/api/cms/locations','gm','POST',{level:'information',parentId:createdCmsPlace.d.id,title:'TEST_DATA eigene Erkenntnis'});
check(newInformation.s===201&&newInformation.d.locationId===createdCmsPlace.d.id&&newInformation.d.parentId===createdCmsPlace.d.id,'GM creates a stable information node in the existing location model');
check((await req('/api/cms/locations','editor','POST',{level:'information',parentId:createdCmsPlace.d.id,title:'TEST_DATA forbidden creation'})).s===403,'Editor cannot create new information identities');
check((await req('/api/cms/locations','a','POST',{level:'information',parentId:createdCmsPlace.d.id,title:'TEST_DATA forbidden player creation'})).s===403,'Player cannot create new information identities');
check((await req('/api/cms/locations','gm','POST',{level:'information',parentId:createdCmsRoom.d.id,title:'TEST_DATA room information'})).s===201,'Information creation supports an existing room parent without a new location type');
check((await req('/api/cms/locations','gm','POST',{level:'information',parentId:'place.other-campaign',title:'TEST_DATA foreign parent'})).s===404,'Information creation rejects unavailable or foreign parent');
const informationDrafts=await req('/api/cms/drafts?entityId='+encodeURIComponent(newInformation.d.id),'gm');
const informationDraft=informationDrafts.d.drafts[0];
const informationSaved=await cmsSave(informationDraft.id,informationDraft.version,{title:'TEST_DATA eigene Erkenntnis',text:'TEST_DATA eigenstaendiger Hinweis',noteType:'question',pinned:true});
const informationReload=await req('/api/cms/drafts?entityId='+encodeURIComponent(newInformation.d.id),'gm');
check(informationSaved.s===200&&JSON.parse(informationReload.d.drafts[0].player_payload_json).pinned===true&&JSON.parse(informationReload.d.drafts[0].player_payload_json).noteType==='question','Information text, type and importance persist after reload');
check(!JSON.stringify((await req('/api/locations?place='+encodeURIComponent(createdCmsPlace.d.id)+'&view=player&target=player','a')).d).includes('TEST_DATA eigenstaendiger Hinweis'),'Unreleased information remains absent from actual player dossier');
const informationSubmitted=await cmsTransition('gm','submit',informationDraft.id,informationSaved.d.version);
const informationApproved=await cmsTransition('gm','approve',informationDraft.id,informationSubmitted.d.version);
const informationPublished=await cmsRelease('gm','publish',newInformation.d.id,'group',0,informationDraft.id,{discoveryState:'known'});
const informationPlayer=(await req('/api/locations?place='+encodeURIComponent(createdCmsPlace.d.id)+'&view=player&target=player','a')).d.projection.location.knownInformation;
check(informationApproved.s===200&&informationPublished.s===200&&informationPlayer.some(info=>info.title==='TEST_DATA eigene Erkenntnis'&&info.text==='TEST_DATA eigenstaendiger Hinweis'&&info.noteType==='question'&&info.pinned),'Explicit group release exposes only the matching new information');
check(publicDraft.s===201&&publicDraft.d.geography.status==='unknown','Existing Electric Taberna can start an explicit public draft with unknown geodata');
const gmNoteDraft=await cmsCreate('info.phase-c-gm-secret','gm','gm');
check(gmNoteDraft.s===201&&gmNoteDraft.d.gmSecret.text==='TEST_DATA_SL_ONLY_BODY','Spielleitung receives the existing protected note only in its internal draft payload');
check((await cmsCreate('info.phase-c-gm-secret','group','gm')).s===404,'GM-only information cannot be opened as a group/player draft');
check((await req('/api/cms/drafts','editor','POST',{entityId:'recovery.synthetic-secret',audience:'group'})).s===404,'Recovery-only or unknown IDs cannot be opened as CMS locations');
const cmsPng=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0,1,2,3]);
const cmsForm=new FormData();cmsForm.set('file',new Blob([cmsPng],{type:'image/png'}),'phase-c-test.png');
const mediaResponse=await fetch(base+'/api/cms/media',{method:'POST',headers:ids.gm,body:cmsForm});const media=await mediaResponse.json();
check(mediaResponse.status===201&&media.id,'Spielleitung can place a synthetic image into private Test-R2 through the CMS uploader');
localSql(`INSERT INTO members(id,email,name,status,campaign_id,created_at) VALUES
('sprint1-helena','helena@phase-c.invalid','Helena test target','active','chronik-von-kleve','phase-c-test'),
('sprint1-doro','doro@phase-c.invalid','Doro test target','active','chronik-von-kleve','phase-c-test');
INSERT INTO campaign_memberships(campaign_id,user_id,role,status,source,version,created_at,updated_at) VALUES
('chronik-von-kleve','sprint1-helena','player','active','manual',1,'phase-c-test','phase-c-test'),
('chronik-von-kleve','sprint1-doro','player','active','manual',1,'phase-c-test','phase-c-test');`);
const personalHelena=await cmsCreate('room.electric-taberna.office','player','gm','sprint1-helena');
const personalDoro=await cmsCreate('room.electric-taberna.office','player','gm','sprint1-doro');
const publicOfficeDraft=await cmsCreate('room.electric-taberna.office','public','gm');
check(personalHelena.s===201&&personalDoro.s===201&&publicOfficeDraft.s===201,'Isolated editor-scope fixtures create two personal drafts and one public draft');
const savedHelena=await cmsSave(personalHelena.d.id,1,{...personalHelena.d.payload,title:'TEST_DATA_HELENA_PERSONAL_PRIVATE'},{heroFileId:media.id});
const savedDoro=await cmsSave(personalDoro.d.id,1,{...personalDoro.d.payload,title:'TEST_DATA_DORO_PERSONAL_PRIVATE'},{heroFileId:media.id});
const savedPublicOffice=await cmsSave(publicOfficeDraft.d.id,1,{...publicOfficeDraft.d.payload,title:'TEST_DATA_PUBLIC_OFFICE_PRIVATE'},{heroFileId:media.id});
check(savedHelena.s===200&&savedDoro.s===200&&savedPublicOffice.s===200,'Personal and public test revisions contain distinct private content and image metadata');
const editorCmsForm=new FormData();editorCmsForm.set('file',new Blob([cmsPng],{type:'image/png'}),'phase-c-editor-test.png');
const editorMediaResponse=await fetch(base+'/api/cms/media',{method:'POST',headers:ids.editor,body:editorCmsForm});const editorMedia=await editorMediaResponse.json();
check(editorMediaResponse.status===201&&editorMedia.id,'Campaign editor can upload an image into isolated private Test-R2');
const editorOfficeGroupDraft=await cmsCreate('room.electric-taberna.office','group','editor');
const editorMediaLibrary=await fetch(base+`/api/cms/media?library=1&entityId=room.electric-taberna.office&revisionId=${editorOfficeGroupDraft.d.id}`,{headers:ids.editor});
const editorMediaLibraryBody=await editorMediaLibrary.json();
check(editorMediaLibrary.status===200&&editorMediaLibraryBody.files.some(item=>item.id===editorMedia.id)&&!editorMediaLibraryBody.files.some(item=>item.id===media.id),`CMS media picker returns only owned campaign images (HTTP ${editorMediaLibrary.status}; ${JSON.stringify(editorMediaLibraryBody)})`);
const mediaPreviewUrl=(fileId,revisionId,entityId='room.electric-taberna.office')=>base+'/api/cms/media?id='+encodeURIComponent(fileId)+'&entityId='+encodeURIComponent(entityId)+'&revisionId='+encodeURIComponent(revisionId)+'&preview=1';
const candidateImagePreview=await fetch(mediaPreviewUrl(editorMedia.id,editorOfficeGroupDraft.d.id)+'&candidate=1',{headers:ids.editor});
const foreignCandidateImagePreview=await fetch(mediaPreviewUrl(media.id,editorOfficeGroupDraft.d.id)+'&candidate=1',{headers:ids.editor});
check(candidateImagePreview.status===200&&foreignCandidateImagePreview.status===404,'Unattached image selection preview requires an exact allowed draft and file ownership');
const savedEditorOfficeGroup=await cmsSave(editorOfficeGroupDraft.d.id,1,{...editorOfficeGroupDraft.d.payload,title:'TEST_DATA_GROUP_OFFICE_ALLOWED'},{heroFileId:editorMedia.id},'editor');
check(savedEditorOfficeGroup.s===200,'Campaign editor can save the allowed group draft and its owned image');
const editorOfficeDraftList=await req('/api/cms/drafts?entityId=room.electric-taberna.office','editor');
const editorOfficeDraftWire=JSON.stringify(editorOfficeDraftList.d);
check(editorOfficeDraftList.s===200&&editorOfficeDraftList.d.drafts.length===1&&editorOfficeDraftList.d.drafts[0].id===editorOfficeGroupDraft.d.id&&editorOfficeDraftList.d.drafts[0].audience_scope==='group'&&editorOfficeDraftList.d.drafts[0].audience_key==='@group','Campaign editor draft listing is server-filtered to the exact @group revision');
check([personalHelena.d.id,personalDoro.d.id,publicOfficeDraft.d.id,'sprint1-helena','sprint1-doro',media.id,'TEST_DATA_HELENA_PERSONAL_PRIVATE','TEST_DATA_DORO_PERSONAL_PRIVATE','TEST_DATA_PUBLIC_OFFICE_PRIVATE'].every(marker=>!editorOfficeDraftWire.includes(marker)),'Editor draft response contains no personal/public revision IDs, content, player IDs or private image metadata');
const guessedPersonalPreview=await req('/api/cms/preview','editor','POST',{revisionId:personalHelena.d.id});
const guessedPublicPreview=await req('/api/cms/preview','editor','POST',{revisionId:publicOfficeDraft.d.id});
check(guessedPersonalPreview.s===404&&guessedPublicPreview.s===404&&!JSON.stringify(guessedPersonalPreview.d).includes('TEST_DATA')&&!JSON.stringify(guessedPublicPreview.d).includes('TEST_DATA'),'Guessed personal/public revision IDs return opaque not-found from the preview API');
const guessedPersonalImage=await fetch(mediaPreviewUrl(media.id,personalHelena.d.id),{headers:ids.editor});
const guessedPublicImage=await fetch(mediaPreviewUrl(media.id,publicOfficeDraft.d.id),{headers:ids.editor});
check(guessedPersonalImage.status===404&&guessedPublicImage.status===404,'Editor cannot fetch personal or public revision images through CMS preview');
const editorGroupImagePreview=await fetch(mediaPreviewUrl(editorMedia.id,editorOfficeGroupDraft.d.id),{headers:ids.editor});
check(editorGroupImagePreview.status===200&&editorGroupImagePreview.headers.get('cache-control')==='private, no-store','Editor can preview the image attached to the exact authorized group revision');
const unattachedGroupImage=await fetch(mediaPreviewUrl(media.id,editorOfficeGroupDraft.d.id),{headers:ids.editor});
check(unattachedGroupImage.status===404,'Editor cannot combine an authorized group revision with a different unattached image ID');
const guessedPersonalSave=await req('/api/cms/drafts','editor','PATCH',{revisionId:personalHelena.d.id,expectedVersion:2,payload:personalHelena.d.payload});
check(guessedPersonalSave.s===404&&!JSON.stringify(guessedPersonalSave.d).includes('TEST_DATA'),'Guessed personal revision cannot be read or changed through the draft save API');
const submittedHelenaPrivate=await cmsTransition('gm','submit',personalHelena.d.id,savedHelena.d.version);
check(submittedHelenaPrivate.s===200,'Private Helena test revision leaves draft state without exposing it to the editor');
localSql(`INSERT INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,title,content,gm_body,version,created_at,updated_at) VALUES
('phase-c-foreign-place','phase-b-other-campaign','PLACE','WORKING','sprint1-other-campaign','sl','TEST_FOREIGN_CMS_ONLY','{}','',1,'phase-c-test','phase-c-test');
INSERT INTO location_nodes(entity_id,campaign_id,location_id,parent_id,level,position,world_state,world_visibility,world_subject_id,markers,attributes,revision,updated_at)
VALUES('phase-c-foreign-place','phase-b-other-campaign','phase-c-foreign-place',NULL,'location',0,'active','gm',NULL,'[]','{"title":"TEST_FOREIGN_CMS_ONLY"}',1,'phase-c-test');
INSERT INTO files(id,campaign_id,owner_id,visibility,name,mime,size,key,created_at)
VALUES('media.foreign-phase-c','phase-b-other-campaign','sprint1-other-campaign','sl','foreign.png','image/png',1,'phase-c/foreign-image','phase-c-test');
INSERT INTO entity_revisions(id,campaign_id,entity_id,revision_no,parent_revision_id,audience_scope,audience_key,audience_user_id,status,base_entity_version,version,player_payload_json,gm_secret_json,geography_json,author_id,created_at,updated_at)
VALUES('revision.foreign-phase-c','phase-b-other-campaign','phase-c-foreign-place',1,NULL,'group','@group',NULL,'draft',1,1,'{"title":"TEST_FOREIGN_REVISION_PRIVATE"}','{}','{"status":"unknown"}','sprint1-other-campaign','phase-c-test','phase-c-test');
INSERT INTO entity_revision_media(id,campaign_id,entity_id,revision_id,file_id,audience_scope,audience_key,purpose,alt_text,position,created_at)
VALUES('attachment.foreign-phase-c','phase-b-other-campaign','phase-c-foreign-place','revision.foreign-phase-c','media.foreign-phase-c','group','@group','hero','',0,'phase-c-test');`);
const foreignCampaignImage=await fetch(mediaPreviewUrl('media.foreign-phase-c','revision.foreign-phase-c','phase-c-foreign-place'),{headers:ids.editor});
check(foreignCampaignImage.status===404,'Campaign editor cannot address a real revision or media row belonging to another campaign');
const foreignCampaignDraftList=await req('/api/cms/drafts?entityId=phase-c-foreign-place','editor');
check(foreignCampaignDraftList.s===404&&!JSON.stringify(foreignCampaignDraftList.d).includes('TEST_FOREIGN'),'Campaign editor cannot list drafts from a foreign campaign');
const editorDirectMedia=await fetch(base+'/api/files?id='+media.id,{headers:ids.editor});
check(editorDirectMedia.status===404,'Private CMS media has no generic direct-file URL for campaign editors');
const publicPayload={...publicDraft.d.payload,title:'TEST_DATA Electric Taberna public release',summary:'TEST_DATA freigegebene öffentliche Zusammenfassung'};
const firstSave=await cmsSave(publicDraft.d.id,1,publicPayload,{geography:{status:'unknown'},heroFileId:media.id});
check(firstSave.s===200&&firstSave.d.version===2,'Draft save uses expectedVersion and can attach private campaign media');
const invalidCmsPayload=await cmsSave(publicDraft.d.id,2,{...publicPayload,gm_body:'MUST_NOT_PERSIST'});
check(invalidCmsPayload.s===400,'Strict player-content schema rejects unknown secret fields');
const cmsRace=await Promise.all([
  cmsSave(publicDraft.d.id,2,{...publicPayload,title:'TEST_DATA parallel A'},{geography:{status:'unknown'},heroFileId:media.id}),
  cmsSave(publicDraft.d.id,2,{...publicPayload,title:'TEST_DATA parallel B'},{geography:{status:'unknown'},heroFileId:media.id}),
]);
check(cmsRace.filter(result=>result.s===200).length===1&&cmsRace.filter(result=>result.s===409).length===1,'Two simultaneous draft saves from the same version yield one success and one 409');
const savedDrafts=await req('/api/cms/drafts?entityId=place.electric-taberna','gm');
const savedPublic=savedDrafts.d.drafts.find(item=>item.id===publicDraft.d.id);
check(savedPublic.version===3&&savedPublic.hero_file_id===media.id,'Draft reload preserves its winning content version and attached image');
const previewImage=await fetch(base+`/api/cms/media?id=${media.id}&entityId=place.electric-taberna&revisionId=${publicDraft.d.id}&preview=1`,{headers:ids.gm});
check(previewImage.status===200&&previewImage.headers.get('cache-control')==='private, no-store','Authorized CMS preview streams image bytes through the private proxy');
check((await fetch(base+'/api/files?id='+media.id,{headers:ids.a})).status===404,'Player cannot read an unpublished SL-only R2 media object');
check((await req('/api/files','gm','DELETE',{id:media.id})).s===409,'Existing file delete API refuses a referenced editorial image');
check((await fetch(base+`/api/cms/media?id=${media.id}&entityId=place.electric-taberna&revisionId=${publicDraft.d.id}`,{headers:ids.a})).status===404,'Player cannot request an unpublished draft media URL');
const submitted=await cmsTransition('gm','submit',publicDraft.d.id,savedPublic.version);
check(submitted.s===200&&submitted.d.status==='in_review','Draft can be submitted into the review queue');
check((await cmsTransition('editor','approve',publicDraft.d.id,submitted.d.version)).s===403,'Campaign editor cannot self-approve submitted material');
const approved=await cmsTransition('gm','approve',publicDraft.d.id,submitted.d.version);
check(approved.s===200&&approved.d.status==='approved','Campaign GM approves the reviewed revision');
const publicRaces=await Promise.all([
  cmsRelease('gm','publish','place.electric-taberna','public',0,publicDraft.d.id),
  cmsRelease('gm','publish','place.electric-taberna','public',0,publicDraft.d.id),
]);
check(publicRaces.filter(result=>result.s===200).length===1&&publicRaces.filter(result=>result.s===409).length===1,'Parallel publication for the same target version allows only one writer');
const publicHistory=await req('/api/cms/releases?entityId=place.electric-taberna&scope=public','gm');
check(publicHistory.s===200&&publicHistory.d.currentVersion===1,'Release ledger starts at target-specific version 1');
const approvedButUnreleased=await cmsCreate('place.electric-taberna','public','gm');
const unreleasedPayload={...approvedButUnreleased.d.payload,title:'TEST_DATA approved but never released'};
const unreleasedSaved=await cmsSave(approvedButUnreleased.d.id,1,unreleasedPayload,{geography:{status:'unknown'} });
const unreleasedSubmitted=await cmsTransition('gm','submit',approvedButUnreleased.d.id,unreleasedSaved.d.version);
const unreleasedApproved=await cmsTransition('gm','approve',approvedButUnreleased.d.id,unreleasedSubmitted.d.version);
const stillPublishedDuringUnreleased=await req('/api/locations?place=place.electric-taberna&view=player&target=player','a');
const slDuringUnreleased=await req('/api/locations?place=place.electric-taberna&view=sl&target=group','gm');
check(slDuringUnreleased.s===200&&slDuringUnreleased.d.projection.location.title===stillPublishedDuringUnreleased.d.projection.location.title&&!JSON.stringify(slDuringUnreleased.d).includes('TEST_DATA approved but never released'),'Live SL dossier uses the actual release, never an approved but unpublished revision');
check(unreleasedApproved.s===200&&stillPublishedDuringUnreleased.d.projection.location.title.startsWith('TEST_DATA parallel')&&!JSON.stringify(stillPublishedDuringUnreleased.d).includes('TEST_DATA approved but never released'),'Approving an unreleased revision does not change the live player projection');
const nextPublicRevision=await cmsCreate('place.electric-taberna','public','gm');
check(nextPublicRevision.s===201&&nextPublicRevision.d.revisionNo===3&&nextPublicRevision.d.payload.title.startsWith('TEST_DATA parallel')&&!nextPublicRevision.d.payload.title.includes('never released')&&nextPublicRevision.d.geography.status==='unknown'&&nextPublicRevision.d.heroFileId===media.id,`A new draft starts from the exact released payload, geography and image, not a newer approved-but-unreleased revision (${JSON.stringify(nextPublicRevision.d)})`);
const nextPublicDraftList=await req('/api/cms/drafts?entityId=place.electric-taberna','gm');
check(nextPublicDraftList.d.drafts.find(item=>item.id===nextPublicRevision.d.id)?.hero_file_id===media.id,'The new draft persists its inherited released image attachment for reload');
const publicPlayer=await req('/api/locations?place=place.electric-taberna&view=player&target=player','a');
const publicHub=await req('/api/locations?view=player&target=player','b');
const anonymousPublicReader=await fetch(base+'/api/locations?place=place.electric-taberna&view=player');
const anonymousPublicReaderBody=await anonymousPublicReader.text();
check(anonymousPublicReader.status===401&&!anonymousPublicReaderBody.includes('TEST_DATA parallel'),'Public-target content is not anonymously readable through the authenticated-only location reader');
check(publicPlayer.s===200&&publicPlayer.d.projection.location.title.startsWith('TEST_DATA parallel'),'Published content reaches player detail through the shared projector');
check(publicHub.s===200&&publicHub.d.places.some(place=>place.id==='place.electric-taberna'&&place.title.startsWith('TEST_DATA parallel')),'Published title feeds the same safe hub/search/map tile source');
check(publicPlayer.d.projection.location.geography.status==='unknown'&&!publicHub.d.places.find(place=>place.id==='place.electric-taberna').geography.coordinates,'Unknown Electric Taberna geodata produces no player coordinates or marker');
const liveMedia=await fetch(base+`/api/cms/media?id=${media.id}&entityId=place.electric-taberna&revisionId=${publicDraft.d.id}`,{headers:ids.a});
check(liveMedia.status===200&&liveMedia.headers.get('content-type')==='image/png','Player can stream the published target image only via the authorized R2 proxy');
check((await fetch(base+'/api/files?id='+media.id,{headers:ids.a})).status===404,'Published editorial image never becomes a direct generic file URL');

const groupDraft=await cmsCreate('place.electric-taberna','group','editor');
check(groupDraft.s===201&&groupDraft.d.payload.title===publicPlayer.d.projection.location.title&&groupDraft.d.heroFileId===media.id,'A new group draft inherits the effective public player projection when no group release exists');
const groupPayload={...groupDraft.d.payload,title:'TEST_DATA Electric Taberna group release',summary:'TEST_DATA freigegebener Gruppentext'};
const groupSaved=await cmsSave(groupDraft.d.id,1,groupPayload,{geography:{status:'unknown'},heroFileId:editorMedia.id},'editor');
check(groupSaved.s===200,'Campaign editor can save a group-scoped draft');
const groupMediaPreview=await fetch(mediaPreviewUrl(editorMedia.id,groupDraft.d.id,'place.electric-taberna'),{headers:ids.editor});
check(groupMediaPreview.status===200,'Campaign editor can preview a media file attached to its concrete group revision');
const groupSubmitted=await cmsTransition('editor','submit',groupDraft.d.id,groupSaved.d.version);
check(groupSubmitted.s===200,'Campaign editor can submit group draft for review');
const groupApproved=await cmsTransition('gm','approve',groupDraft.d.id,groupSubmitted.d.version);
check(groupApproved.s===200,'Campaign GM can approve group draft');
const groupPreview=await req('/api/cms/preview','editor','POST',{revisionId:groupDraft.d.id});
check(groupPreview.s===200&&groupPreview.d.projection.location.title==='TEST_DATA Electric Taberna group release','Editor preview uses the shared player-safe projector for its actual target');
check(groupPreview.d.projection.location.image?.includes(`revisionId=${groupDraft.d.id}&preview=1`),'Draft dossier projection marks its attached hero image for the protected preview route');
check((await fetch(base+groupPreview.d.projection.location.image,{headers:ids.editor})).status===200,'Authorized CMS draft dossier streams its attached private hero image through the protected preview route');
check((await fetch(base+groupPreview.d.projection.location.image.replace('&preview=1',''),{headers:ids.a})).status===404,'An unpublished draft hero image remains unavailable through the ordinary player media route');
const groupPublished=await cmsRelease('gm','publish','place.electric-taberna','group',0,groupDraft.d.id,{discoveryState:'known'});
check(groupPublished.s===200,'Approved group revision publishes to the exact group target');
const groupImageLiveUrl=mediaPreviewUrl(editorMedia.id,groupDraft.d.id,'place.electric-taberna').replace('&preview=1','');
check((await fetch(groupImageLiveUrl,{headers:ids.a})).status===200,'Published group revision image is served to an entitled player through the live projection');
const areaGroupDraft=await cmsCreate('area.electric-taberna.public-guests','group','editor');
const areaGroupSaved=await cmsSave(areaGroupDraft.d.id,1,{...areaGroupDraft.d.payload,playerHint:'TEST_DATA freigegebener Bereichshinweis'},{heroFileId:editorMedia.id},'editor');
const areaDraftPreview=await req('/api/cms/preview','editor','POST',{revisionId:areaGroupDraft.d.id});
const areaDraftImage=areaDraftPreview.d.projection.location.areas.find(area=>area.viewKey==='area.electric-taberna.public-guests'||area.title==='Öffentlicher Gästebereich');
check(areaDraftPreview.s===200&&areaDraftImage?.image?.includes(`revisionId=${areaGroupDraft.d.id}&preview=1`),'Draft area image uses a revision-bound protected preview URL');
check((await fetch(base+areaDraftImage.image,{headers:ids.editor})).status===200,'Authorized CMS preview streams the private draft area image');
const areaGroupSubmitted=await cmsTransition('editor','submit',areaGroupDraft.d.id,areaGroupSaved.d.version);
const areaGroupApproved=await cmsTransition('gm','approve',areaGroupDraft.d.id,areaGroupSubmitted.d.version);
check(areaGroupApproved.s===200&&(await cmsRelease('gm','publish','area.electric-taberna.public-guests','group',0,areaGroupDraft.d.id,{discoveryState:'known'})).s===200,'Area image revision passes review and targeted release on the existing area identity');
const playerAreaProjection=(await req('/api/locations?place=place.electric-taberna&view=player&target=player','a')).d.projection.location.areas.find(area=>area.title==='Öffentlicher Gästebereich');
check(playerAreaProjection?.image===`/api/cms/media?id=${encodeURIComponent(editorMedia.id)}&entityId=${encodeURIComponent('area.electric-taberna.public-guests')}&revisionId=${encodeURIComponent(areaGroupDraft.d.id)}`,'Player projection includes the released image only on its matching known area');
check((await fetch(base+playerAreaProjection.image,{headers:ids.a})).status===200,'Entitled player can retrieve an area image through the protected CMS media proxy');
check((await fetch(base+playerAreaProjection.image,{headers:ids.b})).status===200,'Group release grants the same area image to another member of that target group');
const slEditorialLocation=(await req('/api/locations?place=place.electric-taberna&view=sl&target=group','gm')).d.projection.location;
const slEditorialArea=slEditorialLocation.areas.find(area=>area.id==='area.electric-taberna.public-guests');
check(slEditorialLocation.title==='TEST_DATA Electric Taberna group release'&&slEditorialLocation.summary==='TEST_DATA freigegebener Gruppentext','SL dossier reflects the same published root text as the active group');
check(slEditorialArea?.image===playerAreaProjection.image&&slEditorialArea.playerHint==='TEST_DATA freigegebener Bereichshinweis','SL dossier reflects the published image and description of their matching area');
check(slEditorialLocation.preparedActions.length>0&&slEditorialLocation.areas.some(area=>area.id==='area.electric-taberna.cellar-service'),'Published overlays preserve the SL-only actions and hidden location hierarchy');

// Saved confidential content remains a separate, publisher-only projection.
const confidentialFixtures=[];
for(const entityId of ['place.electric-taberna','area.electric-taberna.public-guests','room.electric-taberna.office']){
  const draft=await cmsCreate(entityId,'gm','gm');
  const saved=await cmsSave(draft.d.id,draft.d.version,draft.d.payload,{gmSecret:{text:'TEST_DATA_CONFIDENTIAL_'+entityId,source:'Synthetic SL fixture'},heroFileId:media.id});
  check(saved.s===200,'SL-only saved text and image persist for '+entityId);
  confidentialFixtures.push({entityId,revisionId:draft.d.id});
}
const confidentialSl=(await req('/api/locations?place=place.electric-taberna&view=sl&target=group','gm')).d.projection.location;
for(const fixture of confidentialFixtures){
  const note=confidentialSl.slNotes.find(item=>item.entityId===fixture.entityId);
  check(note?.text==='TEST_DATA_CONFIDENTIAL_'+fixture.entityId&&note.image?.includes('revisionId='+fixture.revisionId+'&preview=1'),'Actual SL dossier reads latest saved confidential text/image for '+fixture.entityId);
  check((await fetch(base+note.image,{headers:ids.gm})).status===200,'SL can retrieve the revision-bound confidential image');
  for(const who of ['a','b','editor'])check((await fetch(base+note.image,{headers:ids[who]})).status===403||(await fetch(base+note.image,{headers:ids[who]})).status===404,'Confidential image denies '+who);
}
for(const who of ['a','b','gm']){
  const playerOutput=await req('/api/locations?place=place.electric-taberna&view=player&target=group',who);
  check(!JSON.stringify(playerOutput.d).includes('TEST_DATA_CONFIDENTIAL_')&&!JSON.stringify(playerOutput.d).includes('slNotes')&&!JSON.stringify(playerOutput.d).includes('slGroupReleases'),'Player/group switch excludes confidential text, media and control metadata for '+who);
}
const areaControl=confidentialSl.slGroupReleases.find(item=>item.entityId==='area.electric-taberna.public-guests');
check(areaControl.version===1&&areaControl.lastPublishedRevisionId===areaGroupDraft.d.id,'SL quick control refers to exact approved group revision');
const hideArea=await cmsRelease('gm','block',areaControl.entityId,'group',areaControl.version,null);
check(hideArea.s===200,'SL quick control can block the area');
check(!JSON.stringify((await req('/api/locations?place=place.electric-taberna&view=player&target=player','a')).d).includes('TEST_DATA freigegebener Bereichshinweis'),'Blocked area content disappears from real player dossier');
check((await fetch(base+playerAreaProjection.image,{headers:ids.a})).status===404,'Blocked area image disappears with its content');
check((await cmsRelease('gm','publish',areaControl.entityId,'group',areaControl.version,areaControl.lastPublishedRevisionId,{discoveryState:areaControl.discoveryState})).s===409,'Stale quick-control version is rejected');
const restoreArea=await cmsRelease('gm','publish',areaControl.entityId,'group',2,areaControl.lastPublishedRevisionId,{discoveryState:areaControl.discoveryState});
check(restoreArea.s===200&&JSON.stringify((await req('/api/locations?place=place.electric-taberna&view=player&target=player','a')).d).includes('TEST_DATA freigegebener Bereichshinweis'),'Reactivation restores only the approved group content');
check((await fetch(base+playerAreaProjection.image,{headers:ids.a})).status===200,'Reactivation restores matching released media');
const slEditorialHub=await req('/api/locations?view=sl&target=group','gm');
check(slEditorialHub.s===200&&slEditorialHub.d.places.some(place=>place.id==='place.electric-taberna'&&place.title===slEditorialLocation.title&&place.image===slEditorialLocation.image),'SL hub tiles and dossier share the actual published editorial content');
check((await req('/api/locations?place=place.electric-taberna&view=player&target=player','a')).d.projection.location.title==='TEST_DATA Electric Taberna group release','Group release supersedes lower public release for Player A');
const blockedRelease=await cmsRelease('gm','block','place.electric-taberna','group',1,null);
check((await fetch(groupImageLiveUrl,{headers:ids.editor})).status===404,'Group image is not live-readable to the editor after the target is blocked');
check(blockedRelease.s===200&&(await req('/api/locations?place=place.electric-taberna&view=player&target=player','a')).s===404,'A group block suppresses both that release and lower public/legacy fallback');
check((await fetch(base+`/api/cms/media?id=${media.id}&entityId=place.electric-taberna&revisionId=${publicDraft.d.id}`,{headers:ids.a})).status===404,'Blocking higher-priority content also blocks lower-priority media');
const revokedBlock=await cmsRelease('gm','revoke','place.electric-taberna','group',2,null);
check((await fetch(groupImageLiveUrl,{headers:ids.editor})).status===404,'Revoked group image remains unavailable when the player projection falls through to a different release');
check(revokedBlock.s===200,'A later revoke may remove a previous explicit block');
const fallbackPlayer=await req('/api/locations?place=place.electric-taberna&view=player&target=player','a');
check(fallbackPlayer.s===200&&fallbackPlayer.d.projection.location.title.startsWith('TEST_DATA parallel'),'Revoke falls through only to the explicit lower public release, never old entity fields');
check((await fetch(base+`/api/cms/media?id=${media.id}&entityId=place.electric-taberna&revisionId=${publicDraft.d.id}`,{headers:ids.a})).status===200,'Authorized media follows the same lower public release after a group revoke');

const personalArea=await cmsCreate('area.electric-taberna.staff-back','player','gm','sprint1-a');
check(personalArea.s===201,'Spielleitung can draft for one explicitly selected active player');
const areaSubmitted=await cmsTransition('gm','submit',personalArea.d.id,personalArea.d.version);
const areaApproved=await cmsTransition('gm','approve',personalArea.d.id,areaSubmitted.d.version);
check(areaApproved.s===200,'Personal-area revision goes through the same review transition');
check((await cmsRelease('gm','publish','area.electric-taberna.staff-back','player',0,personalArea.d.id,{playerId:'sprint1-a',discoveryState:'known'})).s===200,'Personal release is bound to Player A and creates matching discovery');
const playerAAfterArea=JSON.stringify((await req('/api/locations?place=place.electric-taberna&view=player&target=player','a')).d);
const playerBAfterArea=JSON.stringify((await req('/api/locations?place=place.electric-taberna&view=player&target=player','b')).d);
const groupAfterArea=JSON.stringify((await req('/api/locations?place=place.electric-taberna&view=player&target=group','gm')).d);
check(playerAAfterArea.includes('Personal-/Hinterbereich'),'Player A sees the personally granted area');
check(!playerBAfterArea.includes('Personal-/Hinterbereich')&&!groupAfterArea.includes('Personal-/Hinterbereich'),'Player B and group preview do not see Player A personal area');
const personalOffice=await cmsCreate('room.electric-taberna.office','player','gm','sprint1-a');
const officeSubmit=await cmsTransition('gm','submit',personalOffice.d.id,personalOffice.d.version);
const officeApprove=await cmsTransition('gm','approve',personalOffice.d.id,officeSubmit.d.version);
check(officeApprove.s===200,'Personal room draft can be reviewed');
check((await cmsRelease('gm','publish','room.electric-taberna.office','player',0,personalOffice.d.id,{playerId:'sprint1-a',discoveryState:'known'})).s===200,'Personal office release creates Player A discovery');
const officeA=JSON.stringify((await req('/api/locations?place=place.electric-taberna&view=player&target=player','a')).d);
const officeB=JSON.stringify((await req('/api/locations?place=place.electric-taberna&view=player&target=player','b')).d);
const officeGroup=JSON.stringify((await req('/api/locations?place=place.electric-taberna&view=player&target=group','gm')).d);
check(officeA.includes('07 Büro'),'Player A sees their personally released office');
check(!officeB.includes('07 Büro')&&!officeGroup.includes('07 Büro'),'Player B and group do not see the personal office');
for(const secretSibling of ['06 Personalflur','08 Hof & Anlieferung','Keller & Service','legacy-1bf8cd98','Elysium / Camarilla'])check(!officeA.includes(secretSibling),'Personal office grant does not reveal sibling or legacy secret '+secretSibling);
check((await req('/api/cms/drafts?entityId=room.electric-taberna.office','b')).s===403,'A player cannot read other users’ drafts');
check((await req('/api/locations?view=player&target=player','blockedPlayer')).s===403,'Blocked player identity cannot read player hub');
check((await req('/api/cms/drafts','gm','POST',{entityId:'recovery.synthetic-secret',audience:'public'})).s===404,'Recovery entities cannot be drafted or published through location CMS');
for(const who of [undefined,'a','b','editor','blockedGm','pendingGm','otherCampaign','platformOnly']) {
 const denied=await req('/api/command-center',who);
 check([401,403].includes(denied.s),'Command center denies '+(who||'anonymous'));
}
const commandSnapshot=await req('/api/command-center','gm');
const commandPreview=await req('/api/command-center?view=player','gm');
check(commandPreview.s===200&&!JSON.stringify(commandPreview.d).includes('GM_SESSION_SECRET'),'SL player preview is projected server-side without confidential session data');
check(!('members' in commandPreview.d)&&!('grants' in commandPreview.d),'Player preview response contains no roster or private grant metadata');
check(commandSnapshot.s===200&&commandSnapshot.d.campaignId==='chronik-von-kleve','SL command center resolves the existing campaign');
check(!JSON.stringify(commandSnapshot.d.members).includes('@'),'Command roster does not expose member emails');
check(commandSnapshot.d.members.every(m=>m.status==='active'),'Command roster contains only active campaign members');
check(commandSnapshot.d.characters.some(c=>c.id===charId),'Command roster includes private campaign characters for authorized SL');
check((await req('/api/character-detail?id='+charId+'&view=sl','gm')).s===200,'Command context uses campaign SL character permission');
const commandHandout=await req('/api/entities','gm','POST',{type:'HANDOUT',title:'COMMAND synthetic handout',text:'COMMAND_PLAYER_SAFE',gmBody:'COMMAND_PRIVATE_SECRET'});
check(commandHandout.s===201,'Existing entity API authors command handout');
check((await req('/api/knowledge','gm','POST',{entityId:commandHandout.d.id,audience:'player',playerId:'sprint1-a',state:'DISCOVERED'})).s===200,'Existing knowledge API grants command handout to A');
check(JSON.stringify((await req('/api/entities?id='+commandHandout.d.id,'a')).d).includes('COMMAND_PLAYER_SAFE'),'Player A receives released command handout');
check((await req('/api/entities?id='+commandHandout.d.id,'b')).s===404,'Player B cannot read A command handout');
check(!(await req('/api/command-center?view=player','gm')).d.handouts.some(h=>h.id===commandHandout.d.id),'Group preview excludes personal handout grants');
check(!JSON.stringify((await req('/api/entities?id='+commandHandout.d.id,'a')).d).includes('COMMAND_PRIVATE_SECRET'),'Command handout never leaks GM text');
check((await req('/api/knowledge','gm','POST',{entityId:commandHandout.d.id,audience:'player',playerId:'sprint1-a',state:'UNKNOWN'})).s===200,'Command handout withdrawal uses existing API');
check((await req('/api/entities?id='+commandHandout.d.id,'a')).s===404,'Command handout withdrawal is enforced server-side');
check((await req('/api/knowledge','gm','POST',{entityId:commandHandout.d.id,audience:'group',state:'DISCOVERED'})).s===200,'Command handout group release uses existing knowledge system');
const groupCommandPreview=await req('/api/command-center?view=player','gm');
check(groupCommandPreview.d.handouts.some(h=>h.id===commandHandout.d.id&&h.text==='COMMAND_PLAYER_SAFE'),'Group preview includes actually released handout text');
check(!JSON.stringify(groupCommandPreview.d).includes('COMMAND_PRIVATE_SECRET'),'Group preview handouts exclude confidential GM data');
check(groupCommandPreview.d.handouts.every(h=>Object.keys(h).every(k=>['id','title','text'].includes(k))),'Group preview handouts expose only whitelisted fields');
check((await req('/api/knowledge','gm','POST',{entityId:commandHandout.d.id,audience:'group',state:'UNKNOWN'})).s===200,'Command group release can be withdrawn');
check(!(await req('/api/command-center?view=player','gm')).d.handouts.some(h=>h.id===commandHandout.d.id),'Group preview immediately respects withdrawal');
const regieSession=await req('/api/records','gm','POST',{kind:'sitzungen',title:'Regie place QA',visibility:'group',body:{scene:'QA',slSecret:{activePlaceId:'place.electric-taberna'}}});
check(regieSession.s===200,'Regie persists existing place reference in session');
const regieRows=await req('/api/records?kind=sitzungen','gm');
const regieStored=regieRows.d.records.find(r=>r.id===regieSession.d.id);
check(regieStored.body.slSecret.activePlaceId==='place.electric-taberna','Regie place survives fresh server read');
check(!JSON.stringify((await req('/api/records?kind=sitzungen','a')).d).includes('activePlaceId'),'Player session projection strips confidential location association');
check((await req('/api/records','gm','POST',{id:regieStored.id,version:regieStored.version,kind:'sitzungen',title:regieStored.title,visibility:'group',body:{...regieStored.body,slSecret:{activePlaceId:'missing-place'}}})).s===404,'Regie rejects nonexistent place');
check((await req('/api/records','a','POST',{id:regieStored.id,version:regieStored.version,kind:'sitzungen',title:regieStored.title,visibility:'group',body:regieStored.body})).s===403,'Player cannot change regie association');
const regieUpdate={id:regieStored.id,version:regieStored.version,kind:'sitzungen',title:regieStored.title,visibility:'group',body:{...regieStored.body,scene:'Updated scene'}};
check((await req('/api/records','gm','POST',regieUpdate)).s===200,'Scene update with preserved location succeeds');
check((await req('/api/records','gm','POST',regieUpdate)).s===409,'Stale session revision cannot overwrite regie association');
await weekendIntegration({req,check,localSql,sqlQuote,now});
await commandWorkspaceIntegration({req,check,localSql,sqlQuote,session:regieStored,privateCharacterId:charId});
await storySceneIntegration({req,check,localSql,sqlQuote,session:regieStored,privateCharacterId:charId,characterBody});
await storyPreparationIntegration({req,check,localSql,sqlQuote,session:regieStored});
await workspaceUxIntegration({req,check});
await appointmentsIntegration({req,check});
await liveTableIntegration({req,check});
await liveGameIntegration({req,check,base,ids});
await liveStageIntegration({req,check,base,ids});
await liveParticipantsIntegration({req,check,base,ids,localSql,sqlQuote});
await dashboardHubIntegration({req,check});
await characterSelectionIntegration({req,check,localSql,sqlQuote});
await locationAreaIntegration({req,check,base,ids});
await locationCreationIntegration({req,check,base});
await locationDossierIntegration({req,check,base,ids});
await locationLibraryIntegration({req,check,base,ids});
await accountAccessIntegration({req,check,localSql,sqlQuote,base,testPassword,testPasswordHash});
console.log(checks+' integration checks passed. All writes were confined to the isolated local test database.');
