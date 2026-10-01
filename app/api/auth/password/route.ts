import { failure, input, sameOrigin } from "@/server/access";
import { account, reauthenticate } from "@/server/account-profile";
import { database, HttpError } from "@/server/database";
import { hashPassword, sessionCookie } from "@/server/platform-auth";
import { passwordInput } from "@/domain/account-access";
export async function POST(req:Request){try{
  sameOrigin(req);const u=await account(req),p=passwordInput.safeParse(await input(req));
  if(!p.success)throw new HttpError(400,"Bitte Passwörter prüfen: 12–200 Zeichen und identische Bestätigung.");
  await reauthenticate(u.id,p.data.currentPassword,req);
  const hash=await hashPassword(p.data.password),db=database(),stamp=new Date().toISOString(),event=crypto.randomUUID();
  const r=await db.batch([
    db.prepare("UPDATE auth_users SET password_hash=?,version=version+1,updated_at=? WHERE id=? AND version=? AND status='active'").bind(hash,stamp,u.id,p.data.version),
    db.prepare("INSERT INTO auth_security_events(id,actor_id,subject_user_id,action,metadata,created_at) SELECT ?,?,?,'password.changed','{}',? WHERE changes()=1").bind(event,u.id,u.id,stamp),
    db.prepare("UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL AND EXISTS(SELECT 1 FROM auth_security_events WHERE id=?)").bind(stamp,u.id,event),
    db.prepare("UPDATE auth_access_grants SET revoked_at=? WHERE target_user_id=? AND purpose='reset' AND consumed_at IS NULL AND revoked_at IS NULL AND EXISTS(SELECT 1 FROM auth_security_events WHERE id=?)").bind(stamp,u.id,event),
  ]);
  if(r[0].meta.changes!==1)throw new HttpError(409,"Das Konto wurde inzwischen geändert. Bitte neu anmelden.");
  return Response.json({ok:true,logout:true},{headers:{'Cache-Control':'no-store','Set-Cookie':sessionCookie('',req,true)}});
}catch(e){return failure(e,req);}}
