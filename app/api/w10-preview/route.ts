import { z } from "zod";
import { actor, failure, HttpError, input, json, sameOrigin } from "@/server/access";
import { w10Preview, w10PreviewEnabled } from "@/server/w10-preview";

export const dynamic = "force-dynamic";
// Strict: pool, faces, stress, hunger, willpower, specialty, allowed or characterVersion
// from the client are rejected, never merged into the server derivation.
const schema = z.object({
  characterId: z.string().trim().min(1).max(100),
  selection: z.object({ attributeId: z.string().min(1).max(40), abilityId: z.string().min(1).max(40).optional() }).strict(),
  declared: z.object({
    baseDifficulty: z.number().int().min(2).max(10),
    requiredSuccesses: z.number().int().min(1).max(20).optional(),
    difficultyOverflow: z.enum(["reject", "cap_at_10"]).optional(),
  }).strict(),
}).strict();

export async function POST(req: Request) {
  try {
    if (!w10PreviewEnabled()) throw new HttpError(404, "Nicht gefunden.");
    sameOrigin(req);
    const a = await actor();
    const parsed = schema.safeParse(await input(req));
    if (!parsed.success) throw new HttpError(400, "Ungültige Würfelvorschau: " + parsed.error.issues[0].message);
    const d = parsed.data;
    return json(await w10Preview(a, d.characterId, d.selection, d.declared));
  } catch (error) { return failure(error, req); }
}
