import { cookies } from "next/headers";
import { database } from "@/server/database";
import { hashPassword, verifyPassword } from "@/server/password-hash";

const COOKIE = "chroniplay_session";
const TTL = 30 * 24 * 60 * 60 * 1000;
const enc = new TextEncoder();
type AuthUserSessionRow = { id: string; email: string; display_name: string | null; email_verified_at: string | null; status: string; session_hash: string; session_id: string | null; member_id: string };
type RateLimitRow = { attempts: number; blocked_until: string | null; window_started_at: string };
const bytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const b64 = (v: Uint8Array) => btoa(String.fromCharCode(...v)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const hex = (v: ArrayBuffer) => [...new Uint8Array(v)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function sha(value: string) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(value))); }
export { hashPassword, verifyPassword };
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const validateCredentials = (email: string, password: string) => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return "Bitte eine gültige E-Mail-Adresse eingeben.";
  if (password.length < 12 || password.length > 200) return "Das Passwort muss 12 bis 200 Zeichen lang sein.";
  return null;
};
function cookieValue(request: Request) { return request.headers.get("Cookie")?.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`))?.[1] ?? null; }
export function sessionCookie(token: string, request: Request, clear = false) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${clear ? "" : token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : TTL / 1000}${secure}`;
}
export async function createSession(userId: string) {
  const token = b64(bytes(32)); const now = new Date(); const expires = new Date(now.getTime() + TTL);
  await database().prepare("INSERT INTO auth_sessions (session_hash,user_id,created_at,expires_at,last_seen_at) VALUES (?,?,?,?,?)").bind(await sha(token), userId, now.toISOString(), expires.toISOString(), now.toISOString()).run();
  return { token, expires };
}
export async function currentUser(request: Request) {
  const token = cookieValue(request); if (!token) return null;
  const now = new Date().toISOString();
  const row = await database().prepare("SELECT u.id,u.email,u.display_name,u.email_verified_at,u.status,s.session_hash,l.member_id,s.session_id FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id JOIN auth_member_links l ON l.auth_user_id=u.id WHERE s.session_hash=? AND s.revoked_at IS NULL AND s.expires_at>? LIMIT 1").bind(await sha(token), now).first<AuthUserSessionRow>();
  if (!row || row.status !== "active" || !row.email_verified_at) return null;
  await database().prepare("UPDATE auth_sessions SET last_seen_at=? WHERE session_hash=?").bind(now, row.session_hash).run();
  return { id: row.id, memberId: row.member_id, email: row.email, displayName: row.display_name, emailVerifiedAt: row.email_verified_at, sessionId: row.session_id };
}
export async function currentUserFromContext() {
  const cookieStore = await cookies();
  return currentUser(new Request("http://chroniplay.local/api/auth/session", { headers: { Cookie: cookieStore.toString() } }));
}
export async function revokeSession(request: Request) { const token = cookieValue(request); if (token) await database().prepare("UPDATE auth_sessions SET revoked_at=? WHERE session_hash=?").bind(new Date().toISOString(), await sha(token)).run(); }
export async function rateKey(email: string, request: Request) { return sha(`${normalizeEmail(email)}|${request.headers.get("CF-Connecting-IP") ?? "local"}`); }
export async function rateAllowed(key: string) {
  const row = await database().prepare("SELECT attempts,blocked_until,window_started_at FROM auth_rate_limits WHERE key_hash=?").bind(key).first<RateLimitRow>();
  const now = Date.now(); if (row?.blocked_until && Date.parse(row.blocked_until) > now) return false;
  if (row && now - Date.parse(row.window_started_at) < 15 * 60 * 1000 && row.attempts >= 5) return false;
  return true;
}
export async function recordFailure(key: string) {
  const now = new Date(); const row = await database().prepare("SELECT attempts,window_started_at FROM auth_rate_limits WHERE key_hash=?").bind(key).first<Pick<RateLimitRow, "attempts" | "window_started_at">>();
  const fresh = !row || Date.now() - Date.parse(row.window_started_at) >= 15 * 60 * 1000; const attempts = fresh ? 1 : row.attempts + 1;
  await database().prepare("INSERT INTO auth_rate_limits (key_hash,window_started_at,attempts,blocked_until,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(key_hash) DO UPDATE SET window_started_at=excluded.window_started_at,attempts=excluded.attempts,blocked_until=excluded.blocked_until,updated_at=excluded.updated_at").bind(key, fresh ? now.toISOString() : row.window_started_at, attempts, attempts >= 5 ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : null, now.toISOString()).run();
}
export const json = (body: unknown, status = 200, headers: HeadersInit = {}) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store", ...Object.fromEntries(new Headers(headers).entries()) } });
