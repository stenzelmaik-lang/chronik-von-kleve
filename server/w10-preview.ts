import { env } from "cloudflare:workers";
import type { Actor } from "@/domain/types";
import type { LegacyRecordRow } from "@/domain/legacy";
import { activeCharacterBody } from "@/domain/character-selection";
import { HYBRID_DRAFT_PROFILE } from "@/domain/w10-hybrid-draft";
import { deriveW10Preview, type W10Declared, type W10Selection } from "@/domain/w10-selection";
import { HttpError } from "./access";
import { characterBody, editableCharacter } from "./character-engine-service";
import { ownedActiveCharacter, selectedCharacter } from "./character-selection";
import { liveMembers } from "./live-game";
import { stageRoom } from "./live-stage";

/** The draft profile is not released. Only an isolated local instance with an explicit
 * binding may reach the preview; every other environment answers 404. */
export function w10PreviewEnabled() {
  if (HYBRID_DRAFT_PROFILE.productionEnabled) return true;
  const vars = env as unknown as { W10_HYBRID_PREVIEW?: string; AUTH_ACCESS_ENVIRONMENT?: string };
  return vars.W10_HYBRID_PREVIEW === "local-only" && vars.AUTH_ACCESS_ENVIRONMENT === "local-test";
}

/** Same playability rule as the live table: engine drafts and sheets under review cannot roll. */
function playable(body: Record<string, unknown>) {
  if (!activeCharacterBody(body) || body.canonStatus === "GM_SECRET") return false;
  return !(body.engineVersion === 1 && ["draft", "review"].includes(String(body.characterState)));
}

/** Owner decision 31.10.2026 (K7): a check is bound to the running evening and to exactly one character.
 * Player: only the character explicitly selected in the profile, never an owner-based fallback.
 * SL: any player character at this evening's table. Foreign, secret, archived, missing → 404. */
async function previewCharacter(a: Actor, userId: string, sessionId: string, id: string): Promise<{ row: LegacyRecordRow; body: Record<string, unknown> }> {
  const { room } = await stageRoom(a, sessionId);
  if (a.gm) {
    const { row, body } = await editableCharacter(a, id);
    const participants = (await liveMembers(a)).map(m => m.id).filter(m => !room.participants || room.participants.includes(m));
    if (!activeCharacterBody(body) || !participants.includes(row.owner_id)) throw new HttpError(404, "Charakter nicht an diesem Spielabend.");
    if (!playable(body)) throw new HttpError(409, "Dieser Charakter ist noch nicht spielbereit (Entwurf oder in Prüfung).");
    return { row, body };
  }
  const row = await ownedActiveCharacter(a, id);
  if (!row) throw new HttpError(404, "Charakter nicht verfügbar.");
  const selected = await selectedCharacter(a, userId);
  if (!selected) throw new HttpError(409, "Bitte zuerst deinen aktiven Charakter auswählen.");
  if (selected !== row.id) throw new HttpError(409, "Gewürfelt wird nur mit dem ausgewählten aktiven Charakter. Bitte die Auswahl wechseln.");
  const body = characterBody(row.body);
  if (!playable(body)) throw new HttpError(409, "Dieser Charakter ist noch nicht spielbereit (Entwurf oder in Prüfung).");
  return { row, body };
}

/** Read-only: pool, difficulty and provenance come from the stored sheet and record version. */
export async function w10Preview(a: Actor, userId: string, sessionId: string, characterId: string, selection: W10Selection, declared: W10Declared) {
  const { row, body } = await previewCharacter(a, userId, sessionId, characterId);
  try {
    return { sessionId, characterId: row.id, ...deriveW10Preview(body, selection, declared, row.version, { claimedBy: a.gm ? "gm" : "player" }) };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) throw new HttpError(400, "Ungültige Auswahl: " + String((error as { code: string }).code));
    throw error;
  }
}
