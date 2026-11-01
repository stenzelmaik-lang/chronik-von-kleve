import { z } from "zod";
import { actor, failure, HttpError, input, json, sameOrigin } from "@/server/access";
import { account } from "@/server/account-profile";
import { w10Preview, w10PreviewEnabled } from "@/server/w10-preview";

export const dynamic = "force-dynamic";
// Strict: pool, faces, stress, hunger, willpower, specialty, allowed, characterVersion or a
// difficulty cap policy from the client are rejected, never merged into the server derivation.
const schema = z.object({
  sessionId: z.string().trim().min(1).max(160),
  characterId: z.string().trim().min(1).max(100),
  selection: z.object({ attributeId: z.string().min(1).max(40), abilityId: z.string().min(1).max(80).optional(),
    specialtyId: z.string().regex(/^spec_[A-Za-z0-9-]{8,64}$/).optional() }).strict(),
  declared: z.object({
    baseDifficulty: z.number().int().min(2).max(10),
    requiredSuccesses: z.number().int().min(1).max(20).optional(),
  }).strict(),
}).strict();

export async function POST(req: Request) {
  try {
    if (!w10PreviewEnabled()) throw new HttpError(404, "Nicht gefunden.");
    sameOrigin(req);
    const a = await actor();
    const parsed = schema.safeParse(await input(req));
    if (!parsed.success) throw new HttpError(400, "Ungültige Würfelvorschau: " + parsed.error.issues[0].message);
    const d = parsed.data, u = await account(req);
    return json(await w10Preview(a, u.id, d.sessionId, d.characterId, d.selection, d.declared));
  } catch (error) { return failure(error, req); }
}
