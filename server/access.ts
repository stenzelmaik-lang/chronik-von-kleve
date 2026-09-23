import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { KLEVE_CAMPAIGN_ID, type Actor } from '@/domain/types';
export type { Actor } from '@/domain/types';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function database() {
  if (!env.DB)
    throw new HttpError(
      503,
      "Die Datenbank ist gerade nicht erreichbar. Bitte versuche es erneut.",
    );
  return env.DB;
}
export async function actor(requireActive = true): Promise<Actor> {
  const u = await getChatGPTUser();
  if (!u) throw new HttpError(401, "Bitte melde dich mit ChatGPT an.");
  const gmEmail =
    (env as unknown as { GM_EMAIL?: string }).GM_EMAIL ||
    process.env.GM_EMAIL ||
    "";
  const gm = !!gmEmail && u.email.toLowerCase() === gmEmail.toLowerCase();
  const db = database();
  await db
    .prepare(
      "INSERT INTO members (id,email,name,status,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name",
    )
    .bind(
      u.userId,
      u.email,
      u.displayName,
      gm ? "active" : "pending",
      new Date().toISOString(),
    )
    .run();
  const m = await db
    .prepare("SELECT status FROM members WHERE id=? AND campaign_id=?")
    .bind(u.userId,KLEVE_CAMPAIGN_ID)
    .first<{ status: Actor['status'] }>();
  const status = gm ? "active" : m?.status || "pending";
  if (requireActive && status !== "active")
    throw new HttpError(
      403,
      status === "blocked"
        ? "Dein Zugang ist gesperrt."
        : "Die Spielleitung muss deinen Zugang noch freigeben.",
    );
  return { id: u.userId, campaignId:KLEVE_CAMPAIGN_ID, email: u.email, name: u.displayName, gm, status };
}
export function gmOnly(a: Actor) {
  if (!a.gm) throw new HttpError(403, "Nur für die Spielleitung.");
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
  return (
    r.owner_id === a.id ||
    (a.gm &&
      (campaignKinds.includes(r.kind) ||
        (r.kind === "charaktere" && r.visibility !== "private")))
  );
}
