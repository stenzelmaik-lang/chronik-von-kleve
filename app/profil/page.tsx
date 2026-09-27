import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import LogoutButton from "./logout-button";
import { currentUser } from "@/server/platform-auth";
export default async function ProfilePage() { const c = await cookies(); const request = new Request("http://local/profil", { headers: { Cookie: c.toString() } }); const user = await currentUser(request); if (!user) redirect("/anmelden"); return <main className="auth-page"><section className="auth-card"><p className="eyebrow">CHRONIPLAY · PROFIL</p><h1>{user.displayName}</h1><p>Deine Etappe-1-Sitzung ist serverseitig aktiv.</p><dl><dt>E-Mail</dt><dd>{user.email}</dd><dt>E-Mail bestätigt</dt><dd>{user.emailVerifiedAt ? "Ja" : "Noch nicht (Etappe 2)"}</dd></dl><LogoutButton /></section></main>; }
