/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { cookies } from "next/headers";
import { GET as dashboardGET } from "@/app/api/dashboard/route";
import { actor } from "@/server/access";
import { HttpError } from "@/server/database";
import { currentUserFromContext } from "@/server/platform-auth";

export const dynamic = "force-dynamic";

type EntryPreview = { title: string; body: Record<string, unknown> };
type CampaignPreview = {
  campaignName: string;
  character: EntryPreview | null;
  characterCount: number;
  nextSession: EntryPreview | null;
};

export default async function KampagnePage() {
  const user = await currentUserFromContext();
  let member: Awaited<ReturnType<typeof actor>> | null = null;
  if (user) {
    try { member = await actor(false); }
    catch (error) { if (!(error instanceof HttpError && error.status === 403)) throw error; }
  }
  const admitted = member?.status === "active";
  let preview: CampaignPreview | null = null;
  if (admitted) {
    const response = await dashboardGET(new Request("http://chroniplay.local/api/dashboard", {
      headers: { Cookie: (await cookies()).toString() },
    }));
    if (!response.ok) throw new Error("Die Kampagnenübersicht konnte nicht geladen werden.");
    preview = await response.json() as CampaignPreview;
  }
  const dateValue = preview?.nextSession?.body.date ?? preview?.nextSession?.body.datetime ?? preview?.nextSession?.body.start;
  const nextDate = typeof dateValue === "string" && Number.isFinite(Date.parse(dateValue)) ? dateValue : null;
  return <main className="campaign-page">
    <section className="campaign-page__hero" aria-labelledby="campaign-title">
      <img src="/images/chronik-von-kleve-banner.png" alt="Nächtliche Stadt von Kleve mit Burg, Hafen und Mond" />
      <div className="campaign-page__content">
        <p className="eyebrow">CHRONIPLAY · ERSTE KAMPAGNE</p>
        <h1 id="campaign-title">{preview?.campaignName ?? "Chronik von Kleve"}</h1>
        <p className="campaign-page__meta">Vampire: The Masquerade V20</p>
        {preview ? <>
          <p>Dein Platz in der Chronik. Von hier gelangst du in deinen Spielerbereich und, falls du die Spielleitung führst, zur Vorbereitung.</p>
          <div className="campaign-page__overview" aria-label="Deine Kampagne">
            <section><h2>Meine Kampagne</h2><p>{preview.campaignName}</p></section>
            <section><h2>Mein Charakter</h2><p>{preview.character?.title ?? (preview.characterCount ? "Noch kein aktiver Charakter gewählt. Wähle ihn im Spielerbereich." : "Noch kein eigener Charakter vorhanden. Du kannst ihn im Spielerbereich anlegen.")}</p></section>
            <section><h2>Nächster Spielabend</h2>{nextDate ? <p><strong>{preview.nextSession?.title}</strong><br /><time dateTime={nextDate}>{new Date(nextDate).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "full", timeStyle: "short" })} Uhr</time></p> : <p>Noch kein Spielabend festgelegt. Termine findest du im Spielerbereich.</p>}</section>
          </div>
          <div className="campaign-page__actions"><Link className="button button--primary" href="/spielbereich">Mein Spielerbereich</Link>{member?.gm && <Link className="button" href="/sl/command-center?bereich=vorbereitung">Vorbereiten</Link>}</div>
        </> : <>
          <p>Vampire: The Masquerade V20 bildet den Rahmen der ersten Kampagne. Die Chronik befindet sich in geschlossener Alpha; der Spielbereich ist nur für freigegebene Konten vorgesehen.</p>
          <div className="campaign-page__actions"><Link className="button button--primary" href={user ? "/profil" : "/anmelden"}>{user ? "Kontostatus ansehen" : "Zur geschlossenen Alpha"}</Link><Link className="button" href="/#start">Zur ChroniPlay-Startseite</Link></div>
        </>}
      </div>
    </section>
  </main>;
}
