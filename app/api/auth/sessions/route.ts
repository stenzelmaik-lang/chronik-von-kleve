import { failure,input,json,sameOrigin } from "@/server/access";
import { account } from "@/server/account-profile";
import { database,HttpError } from "@/server/database";
import { sessionCookie } from "@/server/platform-auth";
import { sessionInput } from "@/domain/account-access";
export const dynamic="force-dynamic";
export async function GET(req:Request){try{
  const u=await account(req),r=await database().prepare("SELECT session_id AS id,created_at AS createdAt,expires_at AS expiresAt,last_seen_at AS lastSeenAt FROM auth_sessions WHERE user_id=? AND revoked_at IS NULL AND expires_at>? ORDER BY last_seen_at DESC LIMIT 100").bind(u.id,new Date().toISOString()).all<{id:string;createdAt:string;expiresAt:string;lastSeenAt:string}>();
  return json({sessions:r.results.map(s=>({...s,current:s.id===u.sessionId}))});
}catch(e){return failure(e,req);}}
export async function POST(req:Request){try{
  sameOrigin(req);const u=await account(req),p=sessionInput.safeParse(await input(req));if(!p.success)throw new HttpError(400,"Ungültige Sitzungsauswahl.");
  const stamp=new Date().toISOString(),db=database();
  if(p.data.action==='revoke'){
    const r=await db.prepare("UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND session_id=? AND revoked_at IS NULL RETURNING session_id").bind(stamp,u.id,p.data.id).first();
    if(!r)throw new HttpError(404,"Eigene Sitzung nicht gefunden.");
  }else await db.prepare("UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL AND (?='revoke_all' OR session_id<>?)").bind(stamp,u.id,p.data.action,u.sessionId).run();
  const logout=p.data.action==='revoke_all'||(p.data.action==='revoke'&&p.data.id===u.sessionId);
  return Response.json({ok:true,logout},{headers:{'Cache-Control':'no-store',...(logout?{'Set-Cookie':sessionCookie('',req,true)}:{})}});
}catch(e){return failure(e,req);}}
