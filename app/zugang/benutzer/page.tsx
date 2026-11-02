import { notFound, redirect } from "next/navigation";
import { roleLabels } from "@/domain/account-access";
import { HttpError } from "@/server/database";
import { currentUserFromContext } from "@/server/platform-auth";
import { platformUserOverview } from "@/server/platform-users";
import styles from "@/app/profil/account.module.css";

export const dynamic = "force-dynamic";

const membershipStatus: Record<string, string> = {
  active: "aktiv", pending: "Freigabe ausstehend", blocked: "gesperrt",
};

export default async function PlatformUsersPage() {
  const current = await currentUserFromContext();
  if (!current) redirect("/anmelden");

  let users: Awaited<ReturnType<typeof platformUserOverview>>;
  try {
    users = await platformUserOverview(current.memberId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 403) notFound();
    throw error;
  }

  return <main className={styles.page}>
    <header className={styles.topbar}><a href="/zugang/verwaltung">← Zugangsverwaltung</a><strong>CHRONIPLAY</strong><a href="/profil">Mein Profil</a></header>
    <div className={styles.container}>
      <header className={styles.hero}><p>PLATTFORMADMINISTRATION · NUR LESEN</p><h1>Benutzerübersicht</h1><span>Konten und zugewiesene Rollen. Hier können keine Zugänge oder Rollen geändert werden.</span></header>
      <section className={styles.card} aria-label="Benutzerkonten">
        <h2>Konten ({users.length})</h2>
        {users.length === 0 ? <p>Keine Konten vorhanden.</p> : <ul className={styles.accountList}>{users.map(user => <li className={styles.row} key={user.id}>
          <div><strong>{user.displayName}</strong>{user.memberName && user.memberName !== user.displayName && <small>Spielmitglied: {user.memberName}</small>}
            <small>Plattform: {user.platformRoles.length ? user.platformRoles.map(role => roleLabels[role] ?? role).join(", ") : "keine Rolle"}</small>
            <small>Kampagnen: {user.campaigns.length ? user.campaigns.map(c => `${c.name} · ${roleLabels[c.role] ?? c.role} (${membershipStatus[c.status] ?? c.status})`).join("; ") : "keine Zuordnung"}</small>
          </div>
          <span>{user.status === "blocked" ? "Gesperrt" : user.verified ? "Aktiv" : "E-Mail ausstehend"}</span>
        </li>)}</ul>}
      </section>
    </div>
  </main>;
}
