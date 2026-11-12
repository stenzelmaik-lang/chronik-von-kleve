import { z } from "zod";
import { actor, canEdit, database, failure, HttpError, input, json, sameOrigin } from "@/server/access";
import type { LegacyRecordRow } from "@/domain/legacy";
import { readVitals, sheetInteger } from "@/domain/character-vitals";
import { activeBloodRoundSql } from "@/server/live-game";

export const dynamic = "force-dynamic";
const health = ["Gesund", "Blaue Flecken", "Verletzt", "Schwer verletzt", "Verwundet", "Schwer verwundet", "Verkrüppelt", "Außer Gefecht"] as const;
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
    if(body.archived===true||body.lifecycleStatus==='ARCHIVED')throw new HttpError(409,'Archivierte Charaktere zuerst wiederherstellen.');
    if (d.field !== "health") {
      const vitals = readVitals(body), value = sheetInteger(d.value);
      const blood = d.field === "blood";
      const maximum = blood ? vitals.blood.max : vitals.willpower.permanent;
      const label = blood ? "Blutvorrat" : "Willenskraft";
      if (maximum === null) throw new HttpError(400, `Höchstwert für ${label} fehlt im Charakterbogen.`);
      if (value === null || value < 0 || value > maximum) throw new HttpError(400, `${label} muss zwischen 0 und ${maximum} liegen.`);
      body[d.field] = value;
    } else {
      if (typeof d.value !== "string" || !health.includes(d.value as (typeof health)[number])) throw new HttpError(400, "Gesundheitszustand ungültig.");
      const existing = body.health && typeof body.health === "object" && !Array.isArray(body.health) ? body.health as Record<string, unknown> : {};
      // Keep the table's V20 damage track consistent: known damage types stay, new levels have no recorded type.
      const levels = health.indexOf(d.value as (typeof health)[number]), track = Array.isArray(existing.track) ? existing.track.slice(0, levels) : [];
      body.health = { ...existing, current: d.value, ...(Array.isArray(existing.track) || levels === 0 ? { track: [...track, ...Array(levels - track.length).fill("unspecified")], ...(levels === 0 ? { status: "active" } : {}) } : {}) };
    }
    const guardBlood = !a.gm && d.field === "blood";
    const update = await db.prepare(`UPDATE records SET body=?,version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND version=? AND (?=0 OR NOT EXISTS(${activeBloodRoundSql}))`)
      .bind(JSON.stringify(body), new Date().toISOString(), r.id, a.campaignId, d.version, guardBlood?1:0, a.campaignId).run();
    if (!update.meta.changes) {
      if (guardBlood && await db.prepare(activeBloodRoundSql).bind(a.campaignId).first())
        throw new HttpError(409, "Blut während einer Kampfrunde bitte am Spieltisch buchen.");
      throw new HttpError(409, "Konflikt: Charakter wurde inzwischen geändert.");
    }
    return json({ ok: true, version: r.version + 1 });
  } catch (error) { return failure(error, req); }
}
