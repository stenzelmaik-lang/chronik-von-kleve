import { actor, database, failure, HttpError, input, json, sameOrigin } from "@/server/access";
import { inventoryCreateEnvelopeSchema, inventoryPatchSchema, inventoryProjection, ownItem } from "@/server/inventory";
import { writeInventoryItem } from "@/server/inventory-write";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const a = await actor(), url = new URL(req.url);
    return json(await inventoryProjection(database(), a, url.searchParams.get("characterId"), url.searchParams.get("includeArchived") === "1"));
  } catch (error) { return failure(error, req); }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor(), parsed = inventoryCreateEnvelopeSchema.safeParse(await input(req));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const { action: _action, expectedCarryRevision, ...data } = parsed.data;
    void _action;
    return json(await writeInventoryItem(database(), a, data, expectedCarryRevision), 201);
  } catch (error) { return failure(error, req); }
}
export async function PATCH(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor(), parsed = inventoryPatchSchema.safeParse(await input(req));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const { id, expectedRevision, expectedCarryRevision, action, ...data } = parsed.data, db = database();
    const old = await ownItem(db, a, id);
    if (old.version !== expectedRevision) throw new HttpError(409, "Konflikt: Der Gegenstand wurde inzwischen geändert. Bitte neu laden.");
    return json(await writeInventoryItem(db, a, data, expectedCarryRevision, old, action));
  } catch (error) { return failure(error, req); }
}
