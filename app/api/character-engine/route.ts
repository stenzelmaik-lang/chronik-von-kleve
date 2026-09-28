import { validateCharacterDraft, applyXpPurchase, type XpPurchase } from "@/domain/character-engine";
import type { LegacyRecordRow } from "@/domain/legacy";
import { actor, database, sameOrigin, input, json, failure, HttpError, canEdit } from "@/server/access";

export const dynamic = "force-dynamic";

function objectBody(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    const data = await input(req) as Record<string, unknown>;
    const id = text(data.id);
    const action = text(data.action);
    const expectedVersion = Number(data.version);
    if (!id || !Number.isInteger(expectedVersion) || expectedVersion < 1)
      throw new HttpError(400, "Charakter-ID und aktuelle Version sind erforderlich.");
    const db = database();
    const row = await db.prepare("SELECT * FROM records WHERE id=? AND campaign_id=? AND kind='charaktere'").bind(id, a.campaignId).first<LegacyRecordRow>();
    if (!row || !canEdit(a, row)) throw new HttpError(403, "Du darfst diesen Charakter nicht bearbeiten.");
    if (row.version !== expectedVersion) throw new HttpError(409, "Der Charakter wurde inzwischen geändert. Bitte neu laden.");
    const body = objectBody(row.body);
    let next = body;
    if (action === "review" || action === "confirm") {
      if (!body.engineVersion || !body.creationAllocations || !body.freebiePurchases)
        throw new HttpError(409, "Dieser Legacy-Bogen muss zuerst als Engine-Entwurf erfasst werden.");
      next = { ...body, characterState: action === "review" ? "review" : "confirmed" };
    }
    else if (action === "xp_purchase") {
      if (body.characterState !== "confirmed") throw new HttpError(409, "XP können erst nach der Charakterbestätigung ausgegeben werden.");
      const purchase = data.purchase as XpPurchase;
      const result = applyXpPurchase(body, purchase);
      if (!result.ok) throw new HttpError(400, result.error);
      next = result.body;
    } else throw new HttpError(400, "Unbekannte Charakteraktion.");
    const validation = validateCharacterDraft(a.campaignId, next, action === "xp_purchase" ? undefined : body);
    if (!validation.ok) throw new HttpError(400, validation.error);
    const updated = await db.prepare("UPDATE records SET body=?,version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND version=?")
      .bind(JSON.stringify(next), new Date().toISOString(), id, a.campaignId, expectedVersion).run();
    if (!updated.meta.changes) throw new HttpError(409, "Der Charakter wurde inzwischen geändert. Bitte neu laden.");
    return json({ id, version: expectedVersion + 1, state: validation.state, freebieAvailable: validation.freebieAvailable, xpAvailable: validation.xpAvailable });
  } catch (error) { return failure(error, req); }
}
