import {
  actor,
  database,
  gmOnly,
  json,
  failure,
  sameOrigin,
  input,
  HttpError,
} from "@/server/access";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const a = await actor(false);
    if (!a.gm) return json({ actor: a, members: [] });
    const r = await database()
      .prepare(
        "SELECT id,email,name,status,created_at FROM members WHERE campaign_id=? ORDER BY created_at DESC",
      )
      .bind(a.campaignId)
      .all();
    return json({ actor: a, members: r.results });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    gmOnly(a);
    const d = await input(req);
    if (!["active", "blocked"].includes(d.status) || typeof d.id !== "string")
      throw new HttpError(400, "Ungültige Freigabe.");
    if (d.id === a.id)
      throw new HttpError(400, "Dein eigener Zugang bleibt aktiv.");
    await database()
      .prepare("UPDATE members SET status=? WHERE id=? AND campaign_id=?")
      .bind(d.status, d.id,a.campaignId)
      .run();
    return json({ ok: true });
  } catch (e) {
    return failure(e, req);
  }
}
