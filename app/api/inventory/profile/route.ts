import { actor, database, failure, HttpError, input, json, sameOrigin } from "@/server/access";
import { carryProfiles, inventoryProjection, inventoryWriteContext } from "@/server/inventory";
import { z } from "zod";
const schema = z.object({ characterId: z.string().min(1).max(160), profile: z.enum(["BODY_ONLY", "BACKPACK_SMALL", "BACKPACK_MEDIUM", "BACKPACK_LARGE"]), expectedRevision: z.number().int().min(0) }).strict();
export async function PATCH(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor(), raw = schema.safeParse(await input(req));
    if (!raw.success) throw new HttpError(400, raw.error.issues[0].message);
    const data = raw.data, db = database(), context = await inventoryWriteContext(db, a, data.characterId);
    if (context.character.owner_id !== a.id) throw new HttpError(403, "Das persönliche Trageprofil ändert nur der Eigentümer.");
    if (context.carry.revision !== data.expectedRevision) throw new HttpError(409, "Konflikt: Das Trageprofil wurde inzwischen geändert.");
    if (context.carry.used > carryProfiles[data.profile].capacity) throw new HttpError(409, `${context.carry.used - carryProfiles[data.profile].capacity} Slots müssen zuerst abgelegt oder gelagert werden.`);
    const now = new Date().toISOString(), carryId = "carry." + data.characterId;
    const result = await db.batch([
      db.prepare("INSERT OR IGNORE INTO records(id,campaign_id,owner_id,kind,visibility,title,body,gm_body,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(carryId, a.campaignId, a.id, "inventory_carry", "private", data.characterId, '{"profile":"BODY_ONLY"}', "", 0, now, now),
      db.prepare("UPDATE records SET body=json_set(body,'$.profile',?,'$._inventoryMutation',?,'$._inventoryActor',?),version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND owner_id=? AND kind='inventory_carry' AND version=?").bind(data.profile, crypto.randomUUID(), a.id, now, carryId, a.campaignId, a.id, data.expectedRevision),
    ]);
    if (!result[1].meta.changes) throw new HttpError(409, "Konflikt: Das Trageprofil wurde inzwischen geändert.");
    return json(await inventoryProjection(db, a, data.characterId));
  } catch (e) { return failure(e, req); }
}
