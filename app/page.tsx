import { currentUserFromContext } from "@/server/platform-auth";
import { visitorContent } from "./visitor/content";
import { VisitorShell } from "./visitor/visitor-shell";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUserFromContext();
  return <VisitorShell content={visitorContent} entryHref={user?"/spielbereich":"/anmelden"} isSignedIn={!!user} />;
}
