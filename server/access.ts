import { env } from "cloudflare:workers";
import { KLEVE_CAMPAIGN_ID, type Actor } from "@/domain/types";
import { currentUserFromContext } from "@/server/platform-auth";
import { database, HttpError } from "@/server/database";
import { resolveRoles } from "@/server/role-resolver";
export { database, HttpError } from "@/server/database";
export type { Actor } from "@/domain/types";
export async function actor(requireActive = true): Promise<Actor> {
  const u = await currentUserFromContext();
  if (!u) throw new HttpError(401, "Bitte melde dich mit deinem ChroniPlay-Konto an.");
  const gmEmail =
    (env as unknown as { GM_EMAIL?: string }).GM_EMAIL ||
    process.env.GM_EMAIL ||
    "";
  const db = database();
  const member = await db.prepare(
    "SELECT id,email,name,status FROM members WHERE id=? LIMIT 1",
  ).bind(u.memberId).first<{ id: string; email: string; name: string; status: string }>();
  if (!member) throw new HttpError(403, "Dein ChroniPlay-Konto ist noch keinem bestehenden Spielmitglied zugeordnet.");
  const roles = await resolveRoles(db, {
    userId: member.id,
    email: member.email,
    campaignId: KLEVE_CAMPAIGN_ID,
    gmEmail,
    gmCampaignId: KLEVE_CAMPAIGN_ID,
  });
  const gm = roles.campaignRole === "campaign_owner" || roles.campaignRole === "campaign_gm";
  if (requireActive && roles.campaignStatus !== "active") {
    throw new HttpError(403, roles.campaignStatus === "blocked"
      ? "Dein Zugang ist gesperrt."
      : "Die Spielleitung muss deinen Zugang noch freigeben.");
  }
  return {
    id: member.id,
    campaignId: KLEVE_CAMPAIGN_ID,
    email: member.email,
    name: u.displayName || member.name,
    gm,
    role: roles.campaignRole,
    status: roles.campaignStatus,
  };
}
export function gmOnly(a: Actor) {
  if (a.status !== "active" || !a.gm || !["campaign_owner", "campaign_gm"].includes(a.role))
    throw new HttpError(403, "Nur für die Spielleitung.");
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    throw new HttpError(403, "Diese Anfrage stammt von einer anderen Website.");
  if (req.headers.get("sec-fetch-site") === "cross-site")
    throw new HttpError(403, "Diese Anfrage ist nicht erlaubt.");
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function failure(e: unknown, req?: Request) {
  if (req?.body && !req.bodyUsed) {
    try {
      const reader = req.body.getReader();
      let size = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 12 * 1024 * 1024) {
          await reader.cancel();
          break;
        }
      }
    } catch {}
  }
  if (e instanceof HttpError) return json({ error: e.message }, e.status);
  console.error("CVK request failed", e);
  return json(
    {
      error:
        "Das hat leider nicht geklappt. Deine Eingabe bleibt erhalten; bitte versuche es erneut.",
    },
    503,
  );
}
export async function input(req: Request) {
  if (!(req.headers.get("content-type") || "").includes("application/json"))
    throw new HttpError(415, "JSON erwartet.");
  const raw = await req.text();
  if (raw.length > 150000) throw new HttpError(413, "Der Eintrag ist zu groß.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Ungültige Eingabe.");
  }
}
export const campaignKinds = [
  "chronik",
  "schauplaetze",
  "nscs",
  "archiv",
  "regelwerk",
  "mechaniken",
  "gefahren",
  "haendler",
  "termine",
  "neuigkeiten",
  "sitzungen",
];
export const personalKinds = [
  "charaktere",
  "notizen",
  "gefallen",
  "wirtschaft",
  "inventar",
];
export function canRead(
  a: Actor,
  r: { owner_id: string; visibility: string; kind?: string },
) {
  if (a.status !== "active") return false;
  return (
    r.owner_id === a.id ||
    r.visibility === "group" ||
    (a.gm && r.visibility === "sl")
  );
}
export function canEdit(
  a: Actor,
  r: { owner_id: string; visibility: string; kind: string },
) {
  if (a.status !== "active") return false;
  return (
    r.owner_id === a.id ||
    (a.gm &&
      (campaignKinds.includes(r.kind) ||
        (r.kind === "charaktere" && r.visibility !== "private")))
  );
}
