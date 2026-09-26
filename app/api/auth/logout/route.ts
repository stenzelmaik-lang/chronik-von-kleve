import { sameOrigin } from "@/server/access";
import { json, revokeSession, sessionCookie } from "@/server/platform-auth";
export async function POST(request: Request) { sameOrigin(request); await revokeSession(request); return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", request, true) }); }
