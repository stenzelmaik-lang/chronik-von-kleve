import { redirect } from "next/navigation";
import { currentUserFromContext } from "@/server/platform-auth";
import { visitorContent } from "./visitor/content";
import { VisitorShell } from "./visitor/visitor-shell";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUserFromContext();
  if (user) redirect("/spielbereich");
  return <VisitorShell content={visitorContent} entryHref="/anmelden" isSignedIn={false} />;
}