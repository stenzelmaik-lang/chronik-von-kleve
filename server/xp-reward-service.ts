// Alpha 2.0 (#75): the one server path that books a reward into a character's
// existing XP ledger. It carries no HTTP or session knowledge of its own, takes
// the database as a parameter and never trusts a booking ID from outside: the
// ledger ID is always derived from the validated origin (domain/xp-rewards.ts).
import type { LegacyRecordRow } from "../domain/legacy.ts";
import { characterLedger, type CharacterXpEntry, type XpRewardSource } from "../domain/character-management.ts";
import { bookXpReward, XpRewardError } from "../domain/xp-rewards.ts";
import { writeCharacterEngine, type CharacterWriteGuard } from "./character-engine-store.ts";
import { playedSession } from "./played-sessions.ts";
import { parseBody, validId, XpRewardServiceError } from "./xp-reward-errors.ts";

export { XpRewardServiceError };

export type XpRewardResult = { row: LegacyRecordRow; entry: CharacterXpEntry; duplicate: boolean; reversed: boolean };
export type CharacterXpRewardInput = { campaignId: string; characterId: string; actorId: string; source: XpRewardSource; amount: number; reason: string; now?: string; guard?: CharacterWriteGuard };

const attempts = 8;

/**
 * MVP is awarded to ONE character per played evening across the entire campaign.
 * Per-character ledger IDs alone cannot enforce that invariant. The existing
 * settings key is a durable compare-by-unique-key reservation: first valid
 * winner claims it, later requests for another character/amount are refused.
 *
 * The claim intentionally persists after a write failure. Retrying the same
 * recipient is safe and can finish the booking; silently reassigning it is not.
 */
async function reserveMvpWinner(
  db: D1Database,
  input: CharacterXpRewardInput,
): Promise<void> {
  if (input.source.type !== "mvp") return;
  const scopeId = input.source.scopeId;

  // Earlier direct MVP grants may predate this reservation. Respect them too:
  // the same evening must never acquire a second winner after an upgrade.
  const previous = await db.prepare(
    `SELECT records.id FROM records
     WHERE records.campaign_id=? AND records.kind='charaktere' AND records.id<>?
       AND json_valid(records.body)
       AND EXISTS (
         SELECT 1 FROM json_each(records.body,'$.xpLedger') AS award
         WHERE json_extract(award.value,'$.source.type')='mvp'
           AND json_extract(award.value,'$.source.campaignId')=?
           AND json_extract(award.value,'$.source.scopeId')=?
       )
     LIMIT 1`
  ).bind(input.campaignId, input.characterId, input.campaignId, scopeId).first<{id:string}>();
  if (previous) throw new XpRewardServiceError(409, "Dieser Spielabend hat bereits einen anderen MVP erhalten.");

  const key = "mvp-award:" + input.campaignId + ":" + scopeId;
  const value = JSON.stringify({ characterId: input.characterId, amount: input.amount });
  await db.prepare(
    "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING"
  ).bind(key, value).run();
  const stored = await db.prepare("SELECT value FROM settings WHERE key=?")
    .bind(key).first<{value:string}>();
  if (!stored) throw new XpRewardServiceError(409, "Die MVP-Vergabe konnte nicht gesichert werden.");
  let winner: {characterId?:unknown;amount?:unknown};
  try { winner = JSON.parse(stored.value) as {characterId?:unknown;amount?:unknown}; }
  catch { throw new XpRewardServiceError(409, "Die bestehende MVP-Vergabe ist ungültig. Bitte die Spielleitung informieren."); }
  if (winner.characterId !== input.characterId || winner.amount !== input.amount)
    throw new XpRewardServiceError(409, "Für diesen Spielabend ist bereits ein anderer MVP oder EP-Betrag festgelegt.");
}

/**
 * INTERNAL booking service. The caller is responsible for having verified the
 * origin (played evening, story arc, interval, milestone) and the right to award
 * it. HTTP routes use `bookSessionXpReward` and `bookSessionSettlement`; the
 * automatic engagement award (#76) will call this from server code only and must
 * never get a route of its own that a player can trigger.
 *
 * Exactly once per origin and character: a repeat, a second tab or a retry after
 * a version conflict returns the existing entry and writes nothing.
 */
export async function bookCharacterXpReward(db: D1Database, input: CharacterXpRewardInput): Promise<XpRewardResult> {
  if (input.source?.campaignId !== input.campaignId) throw new XpRewardServiceError(400, "Die Belohnungsquelle gehört nicht zu dieser Chronik.");
  const now = input.now ?? new Date().toISOString();
  for (let attempt = 0; attempt < attempts; attempt++) {
    const row = await db.prepare("SELECT * FROM records WHERE id=? AND campaign_id=? AND kind='charaktere'").bind(input.characterId, input.campaignId).first<LegacyRecordRow>();
    if (!row) throw new XpRewardServiceError(404, "Charakter nicht verfügbar.");
    const body = parseBody(row.body);
    const entity = await db.prepare("SELECT canon_status FROM entities WHERE id=? AND campaign_id=?").bind(input.characterId, input.campaignId).first<{ canon_status: string }>();
    if (body.recoveryOnly === true || body.canonStatus === "GM_SECRET" || entity?.canon_status === "GM_SECRET") throw new XpRewardServiceError(404, "Charakter nicht verfügbar.");
    if (body.archived === true || body.lifecycleStatus === "ARCHIVED") throw new XpRewardServiceError(409, "Archivierte Charaktere zuerst wiederherstellen.");
    if (body.engineVersion !== 1) throw new XpRewardServiceError(409, "Bestehenden Bogen zuerst bewusst als Bestandscharakter übernehmen. Keine automatische Erschaffung.");
    let booked;
    try { booked = bookXpReward(body, { source: input.source, amount: input.amount, reason: input.reason, createdAt: now }); }
    catch (error) { throw new XpRewardServiceError(error instanceof XpRewardError && error.code === "invalid" ? 400 : 409, (error as Error).message); }
    await reserveMvpWinner(db, input);
    if (booked.duplicate) return { row, entry: booked.entry, duplicate: true, reversed: characterLedger(body).some(entry => entry.referenceId === booked.entry.id) };
    if (JSON.stringify(booked.body).length > 100000) throw new XpRewardServiceError(413, "Der Charakter ist zu umfangreich. Bitte keine weiteren Einträge hinzufügen.");
    const updated = await writeCharacterEngine(db, { campaignId: input.campaignId, actorId: input.actorId, row, next: booked.body, expectedVersion: row.version, action: "xp_reward", now, guard: input.guard,
      payload: { reason: booked.entry.reason + " · " + booked.entry.amount + " EP · Quelle " + booked.entry.id, changes: {}, entryId: booked.entry.id, source: booked.entry.source, amount: booked.entry.amount } });
    if (updated) return { row: updated, entry: booked.entry, duplicate: false, reversed: false };
    // Another write won the compare-and-swap: reload and decide again on fresh data.
  }
  throw new XpRewardServiceError(409, "Der Charakter wird gerade mehrfach geändert. Bitte erneut versuchen; eine doppelte Gutschrift entsteht dabei nicht.");
}

/** Sources the Spielleitung may award by hand for a played evening. Engagement is deliberately absent. */
export const sessionRewardTypes = ["session", "story", "mvp", "sl_exception"] as const;
export type SessionRewardType = typeof sessionRewardTypes[number];
export type RewardRequest = { type: SessionRewardType; amount: number; reason: string; storyId?: string };

export async function storyArc(db: D1Database, campaignId: string, storyId: string) {
  const row = await db.prepare("SELECT id FROM entities WHERE id=? AND campaign_id=? AND type='storyline'").bind(storyId, campaignId).first<{ id: string }>();
  if (!row) throw new XpRewardServiceError(404, "Handlungsstrang nicht verfügbar.");
}

// Shape only, no database: which origin a request names. A story reward is
// identified by its own story arc, every other source by the played evening.
export function rewardScope(reward: RewardRequest, playedSessionId: string): string {
  if (!(sessionRewardTypes as readonly unknown[]).includes(reward?.type)) throw new XpRewardServiceError(400, "Diese Belohnungsquelle kann hier nicht vergeben werden.");
  if (reward.type === "story") { if (!validId(reward.storyId)) throw new XpRewardServiceError(400, "Eine Story-Belohnung braucht ihren Handlungsstrang."); return reward.storyId; }
  if (reward.storyId !== undefined) throw new XpRewardServiceError(400, "Nur eine Story-Belohnung nennt einen Handlungsstrang.");
  return playedSessionId;
}

/** `sessionId` is the ID of a registered played evening (server/played-sessions.ts). */
export type SessionXpRewardInput = RewardRequest & { campaignId: string; characterId: string; actorId: string; sessionId: string; now?: string };

/**
 * One reward for one character of a played evening, without a settlement receipt.
 * The caller must have verified that the actor is the Spielleitung.
 */
export async function bookSessionXpReward(db: D1Database, input: SessionXpRewardInput): Promise<XpRewardResult> {
  if (!validId(input.sessionId)) throw new XpRewardServiceError(400, "Bitte einen Spielabend auswählen.");
  const scopeId = rewardScope(input, input.sessionId);
  await playedSession(db, input.campaignId, input.sessionId);
  if (input.type === "story") await storyArc(db, input.campaignId, scopeId);
  return bookCharacterXpReward(db, { campaignId: input.campaignId, characterId: input.characterId, actorId: input.actorId, amount: input.amount, reason: input.reason, now: input.now,
    source: { type: input.type, campaignId: input.campaignId, scopeId } });
}
