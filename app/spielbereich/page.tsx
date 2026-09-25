import Link from "next/link";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { actor } from "@/server/access";
import Workspace from "./workspace";
export const dynamic = "force-dynamic";
async function SignedIn({ initialSection }: { initialSection: string }) {
  await requireChatGPTUser("/spielbereich");
  const a = await actor(false).catch(() => null);
  if (a) return <Workspace actor={a} initialSection={initialSection} />;
  return (
    <main className="shell">
      <header className="masthead">
        <Link href="/" className="brand">
          CVK
        </Link>
      </header>
      <h1 className="page-title">
        Der Spielbereich ist gerade nicht erreichbar.
      </h1>
      <p>
        Bitte lade die Seite in einem Moment neu. Deine gespeicherten Daten
        bleiben erhalten.
      </p>
      <a href="/spielbereich" className="button">
        Erneut versuchen
      </a>
    </main>
  );
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ bereich?: string }>;
}) {
  const params = await searchParams;
  return <SignedIn initialSection={params.bereich || "dashboard"} />;
}
