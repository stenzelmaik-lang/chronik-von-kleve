import { json } from "@/server/platform-auth";

// Closed-alpha policy: accounts and immutable member links are provisioned offline.
// Never create an account or session through this public endpoint.
export async function POST() {
  return json({ error: "Die Registrierung ist für die geschlossene Alpha deaktiviert. Konten werden persönlich freigeschaltet." }, 404);
}