import { z } from "zod";

import { ELECTRIC_TABERNA_ID } from "@/domain/location-model";
import {
  actor,
  database,
  failure,
  gmOnly,
  HttpError,
  input,
  json,
  sameOrigin,
} from "@/server/access";

export const dynamic = "force-dynamic";

const actionSchema = z
  .object({
    placeId: z.literal(ELECTRIC_TABERNA_ID),
    actionId: z.string().min(1).max(120),
  })
  .strict();

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    gmOnly(a);
    const parsed = actionSchema.safeParse(await input(req));
    if (!parsed.success) throw new HttpError(400, "Ungültige Ortsaktion.");
    const db = database();
    const row = await db.prepare("SELECT id,target_id,definition,status,revision FROM location_actions WHERE campaign_id=? AND location_id=? AND id=?").bind(a.campaignId, parsed.data.placeId, parsed.data.actionId).first<{id:string;target_id:string;definition:string;status:string;revision:number}>();
    if (!row) throw new HttpError(404, "Ortsaktion nicht gefunden.");
    let definition: { target?: string } = {};
    try { definition = JSON.parse(row.definition) as { target?: string }; } catch {}
    const existing = await db
      .prepare(
        "SELECT id FROM world_events WHERE campaign_id=? AND entity_id=? AND type=? AND payload LIKE ? LIMIT 1",
      )
      .bind(
        a.campaignId,
        parsed.data.placeId,
        "location.action.triggered",
        `%"actionId":"${parsed.data.actionId}"%`,
      )
      .first<{ id: string }>();
    if (!existing) {
      const now = new Date().toISOString();
      const results = await db.batch([
        db.prepare("UPDATE location_actions SET status=?,revision=revision+1,updated_at=? WHERE campaign_id=? AND id=? AND revision=?").bind("triggered", now, a.campaignId, row.id, row.revision),
        db.prepare("INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM location_actions WHERE campaign_id=? AND id=? AND revision=? AND updated_at=?)").bind(crypto.randomUUID(), a.campaignId, parsed.data.placeId, a.id, "location.action.triggered", JSON.stringify({ actionId: row.id, target: definition.target || "Gruppe", targetId: row.target_id, previousStatus: row.status, nextStatus: "triggered" }), now, a.campaignId, row.id, row.revision + 1, now),
      ]);
      if (!results[0].meta.changes || !results[1].meta.changes) throw new HttpError(409, "Diese Ortsaktion wurde inzwischen geändert. Bitte lade sie neu.");
    }
    return json({ ok: true, actionId: row.id, status: "triggered" });
  } catch (e) {
    return failure(e, req);
  }
}
