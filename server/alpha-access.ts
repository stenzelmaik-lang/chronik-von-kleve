import { env } from "cloudflare:workers";
import { account, accountRoles, reauthenticate } from "@/server/account-profile";
import { database, HttpError } from "@/server/database";
import { accessEnvironment, canInvite, managementInput, acceptInput, resetInput } from "@/domain/account-access";
import { hashPassword, normalizeEmail, rateAllowed, rateKey, recordFailure } from "@/server/platform-auth";

type Grant = {id:string;purpose:string;email_normalized:string;campaign_id:string|null;member_id:string|null;target_user_id:string|null;issued_by:string};
const now=()=>new Date().toISOString();
async function digest(token:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
function newToken(){return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
function environment(){
  const e=accessEnvironment.safeParse((env as unknown as {AUTH_ACCESS_ENVIRONMENT?:string}).AUTH_ACCESS_ENVIRONMENT);
  if(!e.success)throw new HttpError(503,"Einladungen und Wiederherstellung sind in dieser Umgebung noch nicht freigegeben.");
  return e.data;
}
// Rechecked inside each consuming atomic batch. Revoked issuers cannot leave
// functioning invitations/recovery credentials behind.
const issuerAllowed=`EXISTS(SELECT 1 FROM auth_users issuer JOIN auth_member_links il ON il.auth_user_id=issuer.id
 WHERE issuer.id=auth_access_grants.issued_by AND issuer.status='active' AND issuer.email_verified_at IS NOT NULL
 AND (EXISTS(SELECT 1 FROM platform_roles p WHERE p.user_id=il.member_id AND p.role='platform_admin' AND p.status='active')
 OR (auth_access_grants.purpose='invite' AND EXISTS(SELECT 1 FROM campaign_memberships cm WHERE cm.user_id=il.member_id AND cm.campaign_id=auth_access_grants.campaign_id AND cm.status='active' AND cm.role IN ('campaign_owner','campaign_gm')))))`;
const validGrant=`token_hash=? AND purpose=? AND environment=? AND revoked_at IS NULL AND consumed_at IS NULL AND expires_at>? AND ${issuerAllowed}`;

export async function accessOverview(req:Request){
  const u=await account(req),roles=await accountRoles(u.memberId),admin=roles.includes('platform_admin'),db=database();
  const campaigns=await db.prepare(`SELECT c.id,c.name FROM campaigns c WHERE ?=1 OR EXISTS(SELECT 1 FROM campaign_memberships cm WHERE cm.campaign_id=c.id AND cm.user_id=? AND cm.status='active' AND cm.role IN ('campaign_owner','campaign_gm')) ORDER BY c.name`).bind(admin?1:0,u.memberId).all<{id:string;name:string}>();
  if(!admin&&!campaigns.results.length)throw new HttpError(403,"Keine Berechtigung zur Zugangsverwaltung.");
  const grants=await db.prepare(`SELECT g.id,g.purpose,g.email_normalized AS email,g.campaign_id AS campaignId,g.created_at AS createdAt,g.expires_at AS expiresAt,g.revoked_at AS revokedAt,g.consumed_at AS consumedAt,g.environment
    FROM auth_access_grants g WHERE g.environment=? AND (?=1 OR (g.purpose='invite' AND EXISTS(SELECT 1 FROM campaign_memberships cm WHERE cm.campaign_id=g.campaign_id AND cm.user_id=? AND cm.status='active' AND cm.role IN ('campaign_owner','campaign_gm')))) ORDER BY g.created_at DESC LIMIT 100`).bind(environment(),admin?1:0,u.memberId).all<{id:string;expiresAt:string}>();
  const members=await db.prepare(`SELECT m.id,m.email,m.name,cm.campaign_id AS campaignId,cm.role,cm.status,cm.version,CASE WHEN l.auth_user_id IS NOT NULL THEN 1 ELSE 0 END AS linked FROM campaign_memberships cm JOIN members m ON m.id=cm.user_id LEFT JOIN auth_member_links l ON l.member_id=m.id WHERE ?=1 OR EXISTS(SELECT 1 FROM campaign_memberships own WHERE own.campaign_id=cm.campaign_id AND own.user_id=? AND own.status='active' AND own.role IN ('campaign_owner','campaign_gm')) ORDER BY m.name LIMIT 200`).bind(admin?1:0,u.memberId).all();
  const users=admin?(await db.prepare("SELECT u.id,u.email,u.display_name AS displayName,u.status,u.version FROM auth_users u ORDER BY u.created_at DESC LIMIT 200").all()).results:[];
  return {admin,campaigns:campaigns.results,members:members.results,grants:grants.results.map(g=>({...g,expired:Date.parse(g.expiresAt)<=Date.now()})),users,environment:environment()};
}
async function campaignManager(memberId:string,campaignId:string,admin:boolean){
  const cm=await database().prepare("SELECT role,status FROM campaign_memberships WHERE campaign_id=? AND user_id=?").bind(campaignId,memberId).first<{role:string;status:string}>();
  const campaign=await database().prepare("SELECT id FROM campaigns WHERE id=?").bind(campaignId).first();
  if(!campaign||(!admin&&!canInvite(cm?.role??'',cm?.status??'')))throw new HttpError(403,"Nur für die Leitung dieser Kampagne.");
}
export async function manageAccess(req:Request,value:unknown){
  const u=await account(req),parsed=managementInput.safeParse(value);if(!parsed.success)throw new HttpError(400,"Ungültige Zugangsfreigabe.");
  const d=parsed.data,db=database(),admin=(await accountRoles(u.memberId)).includes('platform_admin'),stamp=now(),id=crypto.randomUUID();
  const e=environment();
  if(d.action==='invite'){
    await campaignManager(u.memberId,d.campaignId,admin);const email=normalizeEmail(d.email);
    if(await db.prepare("SELECT id FROM auth_users WHERE email_normalized=?").bind(email).first())throw new HttpError(409,"Dieses Konto existiert bereits. Keine zweite Identität anlegen.");
    if(d.memberId){
      const m=await db.prepare("SELECT m.id,m.email,cm.role,cm.status,l.auth_user_id FROM members m JOIN campaign_memberships cm ON cm.user_id=m.id AND cm.campaign_id=? LEFT JOIN auth_member_links l ON l.member_id=m.id WHERE m.id=?").bind(d.campaignId,d.memberId).first<{email:string;role:string;status:string;auth_user_id:string|null}>();
      if(!m||m.role!=='player'||m.status==='blocked'||m.auth_user_id||normalizeEmail(m.email)!==email)throw new HttpError(403,"Bitte ein ungesperrtes, noch nicht verbundenes Spielmitglied dieser Kampagne auswählen.");
    }else if(await db.prepare("SELECT m.id FROM members m JOIN campaign_memberships cm ON cm.user_id=m.id AND cm.campaign_id=? WHERE lower(trim(m.email))=?").bind(d.campaignId,email).first())throw new HttpError(409,"Ein Spielmitglied mit dieser Adresse existiert bereits. Bitte gezielt dieses Mitglied auswählen.");
    const token=newToken(),expiresAt=new Date(Date.now()+d.days*86400000).toISOString();
    await db.batch([
      db.prepare("INSERT INTO auth_access_grants(id,token_hash,purpose,environment,email_normalized,campaign_id,member_id,issued_by,approval_reference,created_at,expires_at) VALUES(?,?,'invite',?,?,?,?,?,?,?,?)").bind(id,await digest(token),e,email,d.campaignId,d.memberId,u.id,'Personal invitation by authorized campaign/platform manager',stamp,expiresAt),
      db.prepare("INSERT INTO auth_security_events(id,actor_id,action,metadata,created_at) VALUES(?,?,'invitation.issued',?,?)").bind(crypto.randomUUID(),u.id,JSON.stringify({grantId:id,campaignId:d.campaignId,memberId:d.memberId,environment:e}),stamp),
    ]);
    return {ok:true,id,token,expiresAt,purpose:'invite',environment:e};
  }
  if(d.action==='revoke'){
    const grant=await db.prepare("SELECT campaign_id,purpose FROM auth_access_grants WHERE id=? AND environment=?").bind(d.id,e).first<Pick<Grant,'campaign_id'|'purpose'>>();
    if(!grant)throw new HttpError(404,"Freigabe nicht gefunden.");
    if(grant.purpose==='reset'&&!admin)throw new HttpError(403,"Wiederherstellungen gehören zur Plattformadministration.");
    if(grant.purpose==='invite')await campaignManager(u.memberId,grant.campaign_id!,admin);
    const r=await db.prepare("UPDATE auth_access_grants SET revoked_at=? WHERE id=? AND environment=? AND consumed_at IS NULL AND revoked_at IS NULL").bind(stamp,d.id,e).run();
    if(r.meta.changes!==1)throw new HttpError(409,"Diese Freigabe ist bereits verwendet oder widerrufen.");return {ok:true};
  }
  if(!admin)throw new HttpError(403,"Nur für die Plattformadministration; SL-Rechte reichen nicht aus.");
  await reauthenticate(u.id,d.currentPassword,req);
  if(d.action==='account_status'){
    if(d.userId===u.id)throw new HttpError(400,"Der eigene Administrationszugang bleibt geschützt.");
    if(await db.prepare("SELECT p.user_id FROM platform_roles p JOIN auth_member_links l ON l.member_id=p.user_id WHERE l.auth_user_id=? AND p.status='active'").bind(d.userId).first())throw new HttpError(403,"Administrationskonten benötigen eine gesonderte geprüfte Rechtekorrektur.");
    const event=crypto.randomUUID();const r=await db.batch([
      db.prepare("UPDATE auth_users SET status=?,version=version+1,updated_at=? WHERE id=? AND version=?").bind(d.status,stamp,d.userId,d.version),
      db.prepare("INSERT INTO auth_security_events(id,actor_id,subject_user_id,action,metadata,created_at) SELECT ?,?,?,'account.status_changed',?,? WHERE changes()=1").bind(event,u.id,d.userId,JSON.stringify({status:d.status}),stamp),
      db.prepare("UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL AND EXISTS(SELECT 1 FROM auth_security_events WHERE id=?)").bind(stamp,d.userId,event),
      db.prepare("UPDATE auth_access_grants SET revoked_at=? WHERE (target_user_id=? OR issued_by=?) AND consumed_at IS NULL AND revoked_at IS NULL AND EXISTS(SELECT 1 FROM auth_security_events WHERE id=?)").bind(stamp,d.userId,d.userId,event),
    ]);if(r[0].meta.changes!==1)throw new HttpError(409,"Das Konto wurde inzwischen geändert. Bitte neu laden.");return {ok:true};
  }
  const target=await db.prepare("SELECT email_normalized FROM auth_users WHERE id=? AND status='active'").bind(d.userId).first<{email_normalized:string}>();
  if(!target)throw new HttpError(404,"Aktives Konto nicht gefunden.");
  const token=newToken(),expiresAt=new Date(Date.now()+30*60000).toISOString();
  await db.batch([
    db.prepare("UPDATE auth_access_grants SET revoked_at=? WHERE target_user_id=? AND purpose='reset' AND consumed_at IS NULL AND revoked_at IS NULL").bind(stamp,d.userId),
    db.prepare("INSERT INTO auth_access_grants(id,token_hash,purpose,environment,email_normalized,target_user_id,issued_by,approval_reference,created_at,expires_at) VALUES(?,?,'reset',?,?,?,?,?,?,?)").bind(id,await digest(token),e,target.email_normalized,d.userId,u.id,d.approvalReference,stamp,expiresAt),
    db.prepare("INSERT INTO auth_security_events(id,actor_id,subject_user_id,action,metadata,created_at) VALUES(?,?,?,'recovery.issued',?,?)").bind(crypto.randomUUID(),u.id,d.userId,JSON.stringify({grantId:id,approvalReference:d.approvalReference,environment:e}),stamp),
  ]);
  return {ok:true,id,token,expiresAt,purpose:'reset',environment:e};
}
async function grantFor(token:string,purpose:string,req:Request){
  const key=await rateKey('access:'+purpose,req);if(!await rateAllowed(key))throw new HttpError(429,"Zu viele Versuche. Bitte später erneut versuchen.");
  const hash=await digest(token),e=environment(),g=await database().prepare(`SELECT id,purpose,email_normalized,campaign_id,member_id,target_user_id,issued_by FROM auth_access_grants WHERE ${validGrant}`).bind(hash,purpose,e,now()).first<Grant>();
  if(!g){await recordFailure(key);throw new HttpError(400,"Der persönliche Link ist ungültig, abgelaufen oder bereits verwendet.");}
  return {g,hash,e,key};
}
export async function acceptInvitation(req:Request,value:unknown){
  const p=acceptInput.safeParse(value);if(!p.success)throw new HttpError(400,"Bitte persönlichen Link und Eingaben prüfen. Passwort: 12–200 Zeichen.");
  const d=p.data,{g,hash,e,key}=await grantFor(d.token,'invite',req),email=normalizeEmail(d.email),db=database();
  if(email!==g.email_normalized){await recordFailure(key);throw new HttpError(400,"Der persönliche Link passt nicht zu diesen Eingaben.");}
  const userId=crypto.randomUUID(),memberId=g.member_id??crypto.randomUUID(),stamp=now(),pw=await hashPassword(d.password);
  let memberVersion:number|null=null;
  if(g.member_id){
    const m=await db.prepare("SELECT cm.version FROM campaign_memberships cm JOIN members m ON m.id=cm.user_id LEFT JOIN auth_member_links l ON l.member_id=m.id WHERE cm.campaign_id=? AND cm.user_id=? AND cm.role='player' AND cm.status IN ('pending','active') AND lower(trim(m.email))=? AND l.auth_user_id IS NULL").bind(g.campaign_id,memberId,email).first<{version:number}>();
    if(!m)throw new HttpError(409,"Die Zuordnung ist nicht mehr freigegeben. Bitte die Spielleitung kontaktieren.");memberVersion=m.version;
  }
  const claim=db.prepare(`UPDATE auth_access_grants SET consumed_at=?,consumed_by=? WHERE id=? AND ${validGrant} AND (? IS NULL OR EXISTS(SELECT 1 FROM campaign_memberships cm LEFT JOIN auth_member_links l ON l.member_id=cm.user_id WHERE cm.campaign_id=auth_access_grants.campaign_id AND cm.user_id=auth_access_grants.member_id AND cm.role='player' AND cm.status IN ('pending','active') AND cm.version=? AND l.auth_user_id IS NULL))`).bind(stamp,userId,g.id,hash,'invite',e,stamp,memberVersion,memberVersion);
  const ownsClaim="EXISTS(SELECT 1 FROM auth_access_grants WHERE id=? AND consumed_by=?)";
  const statements=[claim,
    db.prepare(`INSERT INTO auth_users(id,email,email_normalized,display_name,password_hash,email_verified_at,status,created_at,updated_at) SELECT ?,?,?,?,?,?,'active',?,? WHERE ${ownsClaim}`).bind(userId,email,email,d.displayName,pw,stamp,stamp,stamp,g.id,userId),
    db.prepare(`INSERT INTO auth_identities(id,user_id,provider,provider_subject,provider_email,created_at,updated_at) SELECT ?,?,'local',?,?,?,? WHERE ${ownsClaim}`).bind(crypto.randomUUID(),userId,userId,email,stamp,stamp,g.id,userId),
  ];
  if(!g.member_id)statements.push(
    db.prepare(`INSERT INTO members(id,campaign_id,email,name,status,created_at) SELECT ?,?,?,?,'active',? WHERE ${ownsClaim}`).bind(memberId,g.campaign_id,email,d.displayName,stamp,g.id,userId),
    db.prepare(`INSERT INTO campaign_memberships(campaign_id,user_id,role,status,source,granted_by,created_at,updated_at) SELECT ?,?,'player','active','manual',?,?,? WHERE ${ownsClaim}`).bind(g.campaign_id,memberId,g.issued_by,stamp,stamp,g.id,userId),
  );else statements.push(db.prepare(`UPDATE campaign_memberships SET status='active',version=version+1,updated_at=? WHERE campaign_id=? AND user_id=? AND version=? AND ${ownsClaim}`).bind(stamp,g.campaign_id,memberId,memberVersion,g.id,userId));
  statements.push(
    db.prepare(`INSERT INTO auth_member_links(auth_user_id,member_id,approved_by,approval_reference,linked_at) SELECT ?,?,?,?,? WHERE ${ownsClaim}`).bind(userId,memberId,g.issued_by,'INVITATION:'+g.id,stamp,g.id,userId),
    db.prepare(`INSERT INTO auth_security_events(id,actor_id,subject_user_id,action,metadata,created_at) SELECT ?,?,?,'invitation.accepted',?,? WHERE ${ownsClaim}`).bind(crypto.randomUUID(),userId,userId,JSON.stringify({grantId:g.id,memberId,campaignId:g.campaign_id,environment:e}),stamp,g.id,userId),
  );
  try{const r=await db.batch(statements);if(r[0].meta.changes!==1)throw new HttpError(409,"Der Link wurde inzwischen verwendet oder widerrufen.");}
  catch(error){if(error instanceof HttpError)throw error;throw new HttpError(409,"Das Konto oder der Link wurde inzwischen verändert. Keine zweite Identität angelegt.");}
  return {ok:true}; // Explicit ordinary login afterwards; never an automatic session.
}
export async function resetPassword(req:Request,value:unknown){
  const p=resetInput.safeParse(value);if(!p.success)throw new HttpError(400,"Bitte Link und Passwörter prüfen: 12–200 Zeichen, gleiche Bestätigung.");
  const {g,hash,e}=await grantFor(p.data.token,'reset',req),db=database(),user=await db.prepare("SELECT version FROM auth_users WHERE id=? AND status='active'").bind(g.target_user_id).first<{version:number}>();
  if(!user)throw new HttpError(400,"Der persönliche Link ist nicht mehr gültig.");
  const pw=await hashPassword(p.data.password),stamp=now(),nonce=crypto.randomUUID(),ownsClaim="EXISTS(SELECT 1 FROM auth_access_grants WHERE id=? AND consumed_by=?)";
  const r=await db.batch([
    db.prepare(`UPDATE auth_access_grants SET consumed_at=?,consumed_by=? WHERE id=? AND ${validGrant} AND EXISTS(SELECT 1 FROM auth_users u WHERE u.id=auth_access_grants.target_user_id AND u.version=? AND u.status='active')`).bind(stamp,nonce,g.id,hash,'reset',e,stamp,user.version),
    db.prepare(`UPDATE auth_users SET password_hash=?,version=version+1,updated_at=? WHERE id=? AND version=? AND ${ownsClaim}`).bind(pw,stamp,g.target_user_id,user.version,g.id,nonce),
    db.prepare(`UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL AND ${ownsClaim}`).bind(stamp,g.target_user_id,g.id,nonce),
    db.prepare(`UPDATE auth_access_grants SET revoked_at=? WHERE target_user_id=? AND consumed_at IS NULL AND revoked_at IS NULL AND ${ownsClaim}`).bind(stamp,g.target_user_id,g.id,nonce),
    db.prepare(`INSERT INTO auth_security_events(id,actor_id,subject_user_id,action,metadata,created_at) SELECT ?,?,?,'password.recovered',?,? WHERE ${ownsClaim}`).bind(crypto.randomUUID(),g.issued_by,g.target_user_id,JSON.stringify({grantId:g.id,environment:e}),stamp,g.id,nonce),
  ]);
  if(r[0].meta.changes!==1)throw new HttpError(409,"Der Link wurde inzwischen verwendet oder widerrufen.");return {ok:true};
}
