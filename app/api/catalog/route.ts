import catalog from "@/server/catalog.json";
import {
  actor,
  gmOnly,
  database,
  json,
  failure,
  sameOrigin,
  input,
} from "@/server/access";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const a = await actor();
    gmOnly(a);
    const count = await database()
      .prepare("SELECT COUNT(*) AS n FROM records WHERE id LIKE 'legacy-%'")
      .first<{ n: number }>();
    return json({ available: catalog.length, imported: count?.n || 0 });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    gmOnly(a);
    await input(req);
    const db = database(),
      now = new Date().toISOString();
    let inserted = 0;
    for (let i = 0; i < catalog.length; i += 20) {
      const batch = await db.batch(
        catalog
          .slice(i, i + 20)
          .map((r) =>
            db
              .prepare(
                "INSERT OR IGNORE INTO records (id,owner_id,kind,visibility,title,body,gm_body,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
              )
              .bind(
                r.id,
                a.id,
                r.kind,
                r.visibility,
                r.title,
                JSON.stringify(r.body),
                r.gmBody,
                now,
                now,
              ),
          ),
      );
      inserted += batch.reduce((n, r) => n + (r.meta.changes || 0), 0);
    }
    return json({ imported: inserted, total: catalog.length });
  } catch (e) {
    return failure(e, req);
  }
}
