import { actor, database, failure, gmOnly } from "@/server/access";
import type { LegacyRecordRow } from "@/domain/legacy";
import { campaignExport } from "@/server/campaign-export";
import { loadEntities, grantsFor, projectEntity } from "@/server/entities";
import { favorsOverview } from "@/server/favors-ledger";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const a = await actor(),
      db = database(),
      full = new URL(req.url).searchParams.get("scope") === "campaign";
    let result: unknown;
    if (full) {
      gmOnly(a);
      result = await campaignExport(db, a);
    } else {
      const [entities, grants, records, files, favors] = await Promise.all([
        loadEntities(db, a.campaignId),
        grantsFor(db, a),
        db
          .prepare(
            "SELECT * FROM records WHERE campaign_id=? AND (owner_id=? OR (visibility=? AND ?=1))",
          )
          .bind(a.campaignId, a.id, "sl", a.gm ? 1 : 0)
          .all<LegacyRecordRow>(),
        db
          .prepare(
            "SELECT id,name,size,mime,visibility FROM files WHERE owner_id=? AND campaign_id=?",
          )
          .bind(a.id, a.campaignId)
          .all(),
        favorsOverview(db, { actor: a, sl: false }),
      ]);
      const index = new Map(entities.map((e) => [e.id, e]));
      result = {
        exportedAt: new Date().toISOString(),
        records: records.results.flatMap((r) => {
          const e = index.get(r.id),
            safe = e ? projectEntity(a, e, grants) : null;
          return safe
            ? [
                {
                  ...r,
                  body: safe.content,
                  gm_body: a.gm ? r.gm_body : undefined,
                },
              ]
            : [];
        }),
        files: files.results,
        favors: favors.obligations,
      };
    }
    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition":
          'attachment; filename="chronik-von-kleve-' +
          (full ? "campaign" : "personal") +
          '-export.json"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return failure(e, req);
  }
}
