import { z } from "zod";
import { actor, canEdit, database, failure, HttpError, input, json, sameOrigin } from "@/server/access";
import type { LegacyRecordRow } from "@/domain/legacy";

export const dynamic = "force-dynamic";
const health = ["Blaue Flecken", "Verletzt", "Schwer verletzt", "Verwundet", "Schwer verwundet", "Verkrüppelt", "Außer Gefecht"] as const;
const schema = z.object({ id: z.string().min(1).max(100), version: z.number().int().positive(), field: z.enum(["blood", "willpowerTemporary", "health"]), value: z.union([z.number(), z.string()]) });

export async function PATCH(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    const parsed = schema.safeParse(await input(req));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const d = parsed.data, db = database();
    const r = await db.prepare("SELECT * FROM records WHERE id=? AND campaign_id=? AND kind='charaktere'").bind(d.id, a.campaignId).first<LegacyRecordRow>();
    if (!r || !canEdit(a, r)) throw new HttpError(404, "Charakter nicht gefunden.");
    const body: Record<string, unknown> = JSON.parse(r.body || "{}");
    if (d.field === "blood") {
      const value = Number(d.value), maximum = Number(body.bloodMax);
      if (!Number.isInteger(maximum) || maximum < 0) throw new HttpError(400, "Blutmaximum muss zuerst im Bearbeitungsmodus gesetzt werden.");
      if (!Number.isInteger(value) || value < 0 || value > maximum) throw new HttpError(400, "Blutwert außerhalb des erlaubten Bereichs.");
      body.blood = value;
    } else if (d.field === "willpowerTemporary") {
      const value = Number(d.value), permanent = Number(body.willpower);
      const maximum = Number.isInteger(permanent) && permanent >= 0 ? permanent : 10;
      if (!Number.isInteger(value) || value < 0 || value > maximum) throw new HttpError(400, "Temporäre Willenskraft liegt außerhalb des erlaubten Bereichs.");
      body.willpowerTemporary = value;
    } else {
      if (typeof d.value !== "string" || !health.includes(d.value as (typeof health)[number])) throw new HttpError(400, "Gesundheitszustand ungültig.");
      const existing = body.health && typeof body.health === "object" && !Array.isArray(body.health) ? body.health as Record<string, unknown> : {};
      body.health = { ...existing, current: d.value };
    }
    const update = await db.prepare("UPDATE records SET body=?,version=version+1,updated_at=? WHERE id=? AND version=?").bind(JSON.stringify(body), new Date().toISOString(), r.id, d.version).run();
    if (!update.meta.changes) throw new HttpError(409, "Konflikt: Charakter wurde inzwischen geändert.");
    return json({ ok: true, version: r.version + 1 });
  } catch (error) { return failure(error, req); }
}
