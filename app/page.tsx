import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import { visitorContent } from "./visitor/content";
import { VisitorShell } from "./visitor/visitor-shell";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();

  return (
    <VisitorShell
      content={visitorContent}
      entryHref={user ? "/spielbereich" : chatGPTSignInPath("/spielbereich")}
      isSignedIn={Boolean(user)}
    />
  );
}
