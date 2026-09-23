import type { LegacyRecordRow, Entry } from "@/domain/legacy";
import { actor, database, json, failure, canRead } from "@/server/access";
import { loadEntities, grantsFor, projectEntity } from "@/server/entities";
export const dynamic = "force-dynamic";
const kinds = ["charaktere", "termine", "wirtschaft", "gefallen", "notizen", "sitzungen", "neuigkeiten"];
function dateOf(e: Entry) { const body = e.body as Record<string, unknown>; const v = body.date || body.datetime || body.start; const d = typeof v === "string" ? Date.parse(v) : NaN; return Number.isFinite(d) ? d : null; }
export async function GET() {
  try {
    const a = await actor(); const db = database();
    const [rows, entities, grants] = await Promise.all([
      db.prepare(`SELECT * FROM records WHERE campaign_id=? AND kind IN (${kinds.map(() => "?").join(",")}) ORDER BY updated_at DESC`).bind(a.campaignId, ...kinds).all<LegacyRecordRow>(),
      loadEntities(db, a.campaignId), grantsFor(db, a),
    ]);
    const index = new Map(entities.map((e) => [e.id, e]));
    const records = rows.results.flatMap((r) => { const e = index.get(r.id); if (!e || !canRead(a, r)) return []; const safe = projectEntity(a, e, grants); if (!safe) return []; return [{ id:r.id, owner_id:r.owner_id, kind:r.kind, title:r.title, visibility:r.visibility, body:safe.content, version:r.version, updated_at:r.updated_at, canEdit:false } satisfies Entry]; });
    const by = (kind: string) => records.filter((r) => r.kind === kind);
    const chars = by("charaktere");
    const sessions = by("sitzungen").sort((x,y) => (dateOf(y) ?? Date.parse(y.updated_at || "")) - (dateOf(x) ?? Date.parse(x.updated_at || "")));
    const terms = by("termine"); const now = Date.now();
    const upcoming = terms.filter((r) => { const d=dateOf(r); return d !== null && d > now; }).sort((x,y) => (dateOf(x) || 0) - (dateOf(y) || 0))[0] || null;
    return json({ character: chars.length === 1 ? chars[0] : null, characterCount: chars.length, nextSession: upcoming, lastSession: sessions[0] || null, economy: by("wirtschaft")[0] || null, favors: by("gefallen")[0] || null, notes: by("notizen").slice(0,5), message: by("neuigkeiten")[0] || null });
  } catch (e) { return failure(e); }
}
