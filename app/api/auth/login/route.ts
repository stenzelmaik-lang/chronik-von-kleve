import { database, sameOrigin } from "@/server/access";
import { createSession, json, normalizeEmail, rateAllowed, rateKey, recordFailure, sessionCookie } from "@/server/platform-auth";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/server/password-hash";
type LoginBody = { email?: unknown; password?: unknown };
type LoginAccount = { id: string; email: string; display_name: string | null; password_hash: string | null; status: string; email_verified_at: string | null; member_id: string | null };
const MAX_LOGIN_BODY_BYTES = 2048;
const MAX_LOGIN_EMAIL_LENGTH = 320;
const MAX_LOGIN_PASSWORD_LENGTH = 200;
const invalidCredentials = () => json({ error: "E-Mail-Adresse oder Passwort ist nicht korrekt." }, 401);

async function readLoginBody(request: Request): Promise<LoginBody | null> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_LOGIN_BODY_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_LOGIN_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as LoginBody : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  sameOrigin(request);
  const body = await readLoginBody(request);
  if (!body) {
    const oversizedKey = await rateKey("oversized-login-request", request);
    if (!(await rateAllowed(oversizedKey))) return json({ error: "Zu viele Versuche. Bitte später erneut versuchen." }, 429);
    await recordFailure(oversizedKey);
    return invalidCredentials();
  }
  const rawEmail = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const email = rawEmail.length > MAX_LOGIN_EMAIL_LENGTH ? "oversized-login-email" : normalizeEmail(rawEmail);
  const key = await rateKey(email, request);
  if (!(await rateAllowed(key))) return json({ error: "Zu viele Versuche. Bitte später erneut versuchen." }, 429);
  if (rawEmail.length > MAX_LOGIN_EMAIL_LENGTH || password.length > MAX_LOGIN_PASSWORD_LENGTH) { await recordFailure(key); return invalidCredentials(); }
  const row = await database().prepare("SELECT u.id,u.email,u.display_name,u.password_hash,u.status,u.email_verified_at,m.id AS member_id FROM auth_users u LEFT JOIN auth_member_links l ON l.auth_user_id=u.id LEFT JOIN members m ON m.id=l.member_id WHERE u.email_normalized=? LIMIT 1").bind(email).first<LoginAccount>();
  // Non-eligible accounts use the dummy hash; all paths still perform one 600k-round derivation.
  const mayUseStoredHash = Boolean(row?.member_id && row.status === "active" && row.email_verified_at && row.password_hash);
  const passwordMatches = await verifyPassword(password, mayUseStoredHash ? row!.password_hash : DUMMY_PASSWORD_HASH);
  if (!row || !passwordMatches || row.status !== "active" || !row.email_verified_at || !row.member_id) { await recordFailure(key); return invalidCredentials(); }
  const session = await createSession(row.id); return json({ ok: true, user: { email: row.email, displayName: row.display_name } }, 200, { "Set-Cookie": sessionCookie(session.token, request) });
}
