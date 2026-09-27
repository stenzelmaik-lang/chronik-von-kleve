import { currentUser, json } from "@/server/platform-auth";
export async function GET(request: Request) { const user = await currentUser(request); return user ? json({ authenticated: true, user }) : json({ authenticated: false }, 401); }
