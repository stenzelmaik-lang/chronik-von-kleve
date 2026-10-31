import { env } from "cloudflare:workers";
import type { Actor } from "@/domain/types";
import type { LegacyRecordRow } from "@/domain/legacy";
import { activeCharacterBody } from "@/domain/character-selection";
import { HYBRID_DRAFT_PROFILE } from "@/domain/w10-hybrid-draft";
import { deriveW10Preview, type W10Declared, type W10Selection } from "@/domain/w10-selection";
import { HttpError } from "./access";
import { characterBody, editableCharacter } from "./character-engine-service";
import { ownedActiveCharacter } from "./character-selection";

/** The draft profile is not released. Only an isolated local instance with an explicit
 * binding may reach the preview; every other environment answers 404. */
export function w10PreviewEnabled() {
  if (HYBRID_DRAFT_PROFILE.productionEnabled) return true;
  const vars = env as unknown as { W10_HYBRID_PREVIEW?: string; AUTH_ACCESS_ENVIRONMENT?: string };
  return vars.W10_HYBRID_PREVIEW === "local-only" && vars.AUTH_ACCESS_ENVIRONMENT === "local-test";
}

/** SL: every manageable campaign character. Player: only an own, active character.
 * Foreign, secret, archived or missing characters are indistinguishable (404). */
async function previewCharacter(a: Actor, id: string): Promise<{ row: LegacyRecordRow; body: Record<string, unknown> }> {
  if (a.gm) {
    const { row, body } = await editableCharacter(a, id);
    if (!activeCharacterBody(body)) throw new HttpError(404, "Charakter nicht verfügbar.");
    return { row, body };
  }
  const row = await ownedActiveCharacter(a, id);
  if (!row) throw new HttpError(404, "Charakter nicht verfügbar.");
  return { row, body: characterBody(row.body) };
}

/** Read-only: pool, difficulty and provenance come from the stored sheet and record version. */
export async function w10Preview(a: Actor, characterId: string, selection: W10Selection, declared: W10Declared) {
  const { row, body } = await previewCharacter(a, characterId);
  try {
    return { characterId: row.id, ...deriveW10Preview(body, selection, declared, row.version) };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) throw new HttpError(400, "Ungültige Auswahl: " + String((error as { code: string }).code));
    throw error;
  }
}
