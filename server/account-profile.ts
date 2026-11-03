import { env } from "cloudflare:workers";
import { currentUser, rateAllowed, rateKey, recordFailure, verifyPassword } from "@/server/platform-auth";
import { database, HttpError } from "@/server/database";
import { profileBanners, profileInput, profilePlayStyles } from "@/domain/account-access";

export async function account(request: Request) {
  const user = await currentUser(request);
  if (!user) throw new HttpError(401, "Bitte mit deinem ChroniPlay-Konto anmelden.");
  return user;
}
export async function accountRoles(memberId: string) {
  const rows = await database().prepare("SELECT role FROM platform_roles WHERE user_id=? AND status='active'").bind(memberId).all<{role:string}>();
  return rows.results.map(row => row.role);
}
export async function reauthenticate(userId: string, password: string, request: Request) {
  const key = await rateKey("reauth:" + userId, request);
  if (!await rateAllowed(key)) throw new HttpError(429, "Zu viele Versuche. Bitte später erneut versuchen.");
  const row = await database().prepare("SELECT password_hash FROM auth_users WHERE id=? AND status='active'").bind(userId).first<{password_hash:string|null}>();
  if (!await verifyPassword(password, row?.password_hash ?? null)) {
    await recordFailure(key);
    throw new HttpError(401, "Das aktuelle Passwort ist nicht korrekt.");
  }
}
export async function profile(request: Request) {
  const u = await account(request), db = database();
  const [row, memberships, platformRoles] = await Promise.all([
    db.prepare("SELECT u.version,p.avatar_file_id,p.preferences FROM auth_users u LEFT JOIN auth_profiles p ON p.user_id=u.id WHERE u.id=?").bind(u.id).first<{version:number;avatar_file_id:string|null;preferences:string|null}>(),
    db.prepare("SELECT c.id,c.name,cm.role,cm.status FROM campaign_memberships cm JOIN campaigns c ON c.id=cm.campaign_id WHERE cm.user_id=? ORDER BY c.name").bind(u.memberId).all<{id:string;name:string;role:string;status:string}>(),
    accountRoles(u.memberId),
  ]);
  const preferences=JSON.parse(row?.preferences||'{}');
  return { displayName:u.displayName, email:u.email, version:row!.version, avatarFileId:row?.avatar_file_id ?? null,
    preferences:{
      reducedMotion:preferences.reducedMotion===true,
      compactView:preferences.compactView===true,
      ...(typeof preferences.realName==='string'?{realName:preferences.realName}:{}),
      ...(typeof preferences.pronouns==='string'?{pronouns:preferences.pronouns}:{}),
      ...(profileBanners.includes(preferences.banner)?{banner:preferences.banner}:{}),
      ...(Array.isArray(preferences.playStyles)?{playStyles:profilePlayStyles.filter(style=>preferences.playStyles.includes(style)).slice(0,5)}:{}),
      ...(typeof preferences.introduction==='string'?{introduction:preferences.introduction}:{}),
    },
    campaigns:memberships.results, platformRoles, canManage:platformRoles.includes("platform_admin") || memberships.results.some(r => r.status==='active' && ['campaign_owner','campaign_gm'].includes(r.role)),
  };
}
export async function saveProfile(request:Request, value:unknown) {
  const u=await account(request), parsed=profileInput.safeParse(value);
  if(!parsed.success) throw new HttpError(400,"Bitte Anzeigename, Profilbild und Einstellungen prüfen.");
  const d=parsed.data,db=database();
  if(d.avatarFileId){
    const f=await db.prepare("SELECT id FROM files WHERE id=? AND owner_id=? AND visibility='private' AND mime IN ('image/png','image/jpeg','image/webp')").bind(d.avatarFileId,u.memberId).first();
    if(!f) throw new HttpError(403,"Bitte ein eigenes privates Bild auswählen.");
  }
  const stamp=new Date().toISOString(),event=crypto.randomUUID();
  const result=await db.batch([
    db.prepare("UPDATE auth_users SET display_name=?,version=version+1,updated_at=? WHERE id=? AND version=? AND status='active'").bind(d.displayName,stamp,u.id,d.version),
    db.prepare("INSERT INTO auth_security_events(id,actor_id,subject_user_id,action,metadata,created_at) SELECT ?,?,?,'profile.saved','{}',? WHERE changes()=1").bind(event,u.id,u.id,stamp),
    db.prepare("INSERT INTO auth_profiles(user_id,avatar_file_id,preferences) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM auth_security_events WHERE id=?) ON CONFLICT(user_id) DO UPDATE SET avatar_file_id=excluded.avatar_file_id,preferences=json_patch(COALESCE(auth_profiles.preferences,'{}'),excluded.preferences)").bind(u.id,d.avatarFileId,JSON.stringify(d.preferences),event),
  ]);
  if(result[0].meta.changes!==1)throw new HttpError(409,"Dein Profil wurde inzwischen geändert. Bitte neu laden.");
  return {ok:true,version:d.version+1};
}
export async function avatar(request:Request) {
  const u=await account(request),f=await database().prepare("SELECT f.key,f.mime FROM auth_profiles p JOIN files f ON f.id=p.avatar_file_id WHERE p.user_id=? AND f.owner_id=? AND f.visibility='private' AND f.mime IN ('image/png','image/jpeg','image/webp')").bind(u.id,u.memberId).first<{key:string;mime:string}>();
  if(!f||!env.BUCKET)throw new HttpError(404,"Kein Profilbild gespeichert.");
  const obj=await env.BUCKET.get(f.key);if(!obj)throw new HttpError(404,"Profilbild nicht gefunden.");
  return new Response(obj.body,{headers:{'Content-Type':f.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
