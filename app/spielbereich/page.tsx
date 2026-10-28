import { redirect } from "next/navigation";
import { actor } from "@/server/access";
import { currentUserFromContext } from "@/server/platform-auth";
import Workspace from "./workspace";
import {selectedCharacter} from '@/server/character-selection';
export const dynamic = "force-dynamic";
async function SignedIn({ initialSection, initialCharacterId }: { initialSection: string; initialCharacterId?: string }) {
  const user=await currentUserFromContext();
  if (!user) redirect("/anmelden");
  const a = await actor(false).catch(() => null);
  if (a) return <Workspace actor={a} initialSection={initialSection} initialCharacterId={await selectedCharacter(a,user.id,initialCharacterId) || undefined} />;
  return (
    <main className="shell">
      <h1 className="page-title">Dein Zugang ist noch nicht freigeschaltet.</h1>
      <p>Dieses Konto muss mit einem bestehenden Spielmitglied verknüpft und für die Chronik freigegeben sein.</p>
      <a href="/profil" className="button">Kontostatus ansehen</a>
    </main>
  );
}
export default async function Page({ searchParams }: { searchParams: Promise<{ bereich?: string; character?: string }> }) {
  const params = await searchParams;
  if (params.bereich === "ortscms") redirect("/sl/command-center?bereich=ortscms");
  return <SignedIn initialSection={params.bereich || "dashboard"} initialCharacterId={typeof params.character==="string"&&params.character.length<=100?params.character:undefined} />;
}
