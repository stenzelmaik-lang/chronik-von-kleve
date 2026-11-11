// Alpha 2.0 (#75): settlement of one played evening for several characters, with
// a persistent receipt. It adds no XP logic: every reward goes through
// `bookCharacterXpReward` and is protected against double booking on its own.
// The XP live in the character ledger only; the receipt records who took part,
// what was awarded for which reason, by whom and when, and points to the ledger
// entry of every booked reward.
import { xpRewardRules } from "../domain/xp-rewards.ts";
import { characterLedger } from "../domain/character-management.ts";
import { reversedRewardIds } from "../domain/xp-reversal-view.ts";
import { parseBody } from "./xp-reward-errors.ts";
import { playedSession, type PlayedSession } from "./played-sessions.ts";
import { validId, XpRewardServiceError } from "./xp-reward-errors.ts";
import { bookCharacterXpReward, rewardScope, storyArc, type RewardRequest, type SessionRewardType } from "./xp-reward-service.ts";

export type SettlementEntry = { characterId: string; attended: boolean; rewards: RewardRequest[] };
/** `sessionId` is the ID of a registered played evening (server/played-sessions.ts). */
export type SessionSettlementInput = { campaignId: string; actorId: string; sessionId: string; entries: SettlementEntry[]; now?: string };
export type SettlementRewardResult = { type: SessionRewardType; storyId?: string; amount: number; status: "booked" | "already_booked" | "failed"; entryId?: string; reversed?: boolean; code?: number; error?: string };
export type SettlementCharacterResult = { characterId: string; attended: boolean; status: "booked" | "already_booked" | "failed" | "none"; rewards: SettlementRewardResult[] };
export type ReceiptStatus = "complete" | "partial" | "failed";
export type SessionSettlementResult = {
  /** Outcome of this call. Only "complete" may be shown as success. */
  status: ReceiptStatus; complete: boolean; sessionId: string; appointmentId: string | null;
  totals: { booked: number; alreadyBooked: number; failed: number }; characters: SettlementCharacterResult[];
  /** State of the persistent receipt of the evening after this call. */
  receipt: { id: string; status: ReceiptStatus; revision: number };
};

export const settlementLimits = { characters: 50, rewardsPerCharacter: 10 } as const;

type Header = { id: string; campaign_id: string; played_session_id: string; status: ReceiptStatus; revision: number; created_by: string; created_at: string; updated_by: string; updated_at: string };
const header = (db: D1Database, campaignId: string, playedSessionId: string) => db.prepare("SELECT * FROM xp_settlements WHERE campaign_id=? AND played_session_id=?").bind(campaignId, playedSessionId).first<Header>();

/**
 * A structurally invalid call is refused as a whole before anything is written.
 * Then the intent is stored in the receipt, every reward is attempted and its
 * line is marked booked or failed. A partial failure is therefore visible as
 * such, and the identical call can simply be sent again: what was booked comes
 * back as "already_booked", only the rest is booked.
 *
 * A booked line is never changed again (also enforced by a database trigger).
 * A correction is an audited counterbooking in the character ledger.
 *
 * Attendance: an absent character gets no regular, story or MVP reward here; a
 * reasoned "sl_exception" stays possible. The caller must have verified that the
 * actor is the Spielleitung.
 */
export async function bookSessionSettlement(db: D1Database, input: SessionSettlementInput): Promise<SessionSettlementResult> {
  if (!validId(input.sessionId)) throw new XpRewardServiceError(400, "Bitte einen Spielabend auswählen.");
  if (!Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > settlementLimits.characters) throw new XpRewardServiceError(400, "Eine Abrechnung umfasst 1 bis " + settlementLimits.characters + " Charaktere.");
  const characters = new Set<string>(), stories = new Set<string>();
  const planned = input.entries.map(entry => {
    if (!entry || !validId(entry.characterId) || typeof entry.attended !== "boolean" || !Array.isArray(entry.rewards) || entry.rewards.length > settlementLimits.rewardsPerCharacter) throw new XpRewardServiceError(400, "Ungültiger Eintrag in der Abrechnung.");
    if (characters.has(entry.characterId)) throw new XpRewardServiceError(400, "Ein Charakter steht mehrfach in der Abrechnung.");
    characters.add(entry.characterId);
    const sources = new Set<string>();
    const rewards = entry.rewards.map(reward => {
      const scopeId = rewardScope(reward, input.sessionId), rule = xpRewardRules[reward.type], key = reward.type + ":" + scopeId;
      if (sources.has(key)) throw new XpRewardServiceError(400, "Dieselbe Belohnungsquelle steht für einen Charakter mehrfach in der Abrechnung.");
      sources.add(key);
      if (!entry.attended && reward.type !== "sl_exception") throw new XpRewardServiceError(400, "Abwesende Figuren erhalten nur eine begründete SL-Sondervergabe.");
      if (!Number.isSafeInteger(reward.amount) || reward.amount < rule.min || reward.amount > rule.max) throw new XpRewardServiceError(400, "Diese Belohnung beträgt " + rule.min + " bis " + rule.max + " EP.");
      if (typeof reward.reason !== "string" || reward.reason.trim().length < 3) throw new XpRewardServiceError(400, "Bitte begründe jede Vergabe kurz.");
      if (reward.type === "story") stories.add(scopeId);
      return { reward, scopeId };
    });
    return { entry, rewards };
  });
  // The whole request is invalid if more than one MVP is nominated for
  // the same evening. Avoid partial writes or contradictory settlement intents.
  const mvpCount = planned.reduce((total, item) =>
    total + item.rewards.filter(x => x.reward.type === "mvp").length, 0);
  if (mvpCount > 1) throw new XpRewardServiceError(
    400, "Pro Spielabend darf nur ein Charakter MVP-Sonder-EP erhalten."
  );
  const session = await playedSession(db, input.campaignId, input.sessionId);
  for (const storyId of stories) await storyArc(db, input.campaignId, storyId);
  const now = input.now ?? new Date().toISOString();

  // The receipt of the evening: created once, extended by later calls.
  let receipt = await header(db, input.campaignId, session.id);
  if (receipt) {
    const flipped = await db.prepare("SELECT p.character_id,p.attended FROM xp_settlement_participants p WHERE p.settlement_id=? AND EXISTS(SELECT 1 FROM xp_settlement_rewards r WHERE r.settlement_id=p.settlement_id AND r.character_id=p.character_id AND r.status='booked')").bind(receipt.id).all<{ character_id: string; attended: number }>();
    const stored = new Map(flipped.results.map(row => [row.character_id, row.attended === 1]));
    if (planned.some(({ entry }) => stored.has(entry.characterId) && stored.get(entry.characterId) !== entry.attended)) throw new XpRewardServiceError(409, "Für diese Figur sind bereits EP gebucht. Die Anwesenheit lässt sich danach nicht mehr umstellen; Korrekturen laufen über eine begründete Gegenbuchung.");
  } else {
    await db.prepare("INSERT INTO xp_settlements(id,campaign_id,played_session_id,status,revision,created_by,created_at,updated_by,updated_at) VALUES(?,?,?,'partial',0,?,?,?,?) ON CONFLICT(campaign_id,played_session_id) DO NOTHING")
      .bind(crypto.randomUUID(), input.campaignId, session.id, input.actorId, now, input.actorId, now).run();
    receipt = await header(db, input.campaignId, session.id);
    if (!receipt) throw new XpRewardServiceError(409, "Der Abrechnungsbeleg konnte nicht angelegt werden. Bitte erneut versuchen.");
  }
  const receiptId = receipt.id;
  // Intent first: participants, attendance and every planned reward as "pending". Booked lines stay untouched.
  await db.batch(planned.flatMap(({ entry, rewards }) => [
    db.prepare("INSERT INTO xp_settlement_participants(settlement_id,character_id,attended,recorded_by,recorded_at) VALUES(?,?,?,?,?) ON CONFLICT(settlement_id,character_id) DO UPDATE SET attended=excluded.attended,recorded_by=excluded.recorded_by,recorded_at=excluded.recorded_at WHERE xp_settlement_participants.attended<>excluded.attended")
      .bind(receiptId, entry.characterId, entry.attended ? 1 : 0, input.actorId, now),
    ...rewards.map(({ reward, scopeId }) => db.prepare("INSERT INTO xp_settlement_rewards(settlement_id,character_id,reward_type,scope_id,amount,reason,status,awarded_by,updated_at) VALUES(?,?,?,?,?,?,'pending',?,?) ON CONFLICT(settlement_id,character_id,reward_type,scope_id) DO UPDATE SET amount=excluded.amount,reason=excluded.reason,status='pending',error_code=NULL,awarded_by=excluded.awarded_by,updated_at=excluded.updated_at WHERE xp_settlement_rewards.status<>'booked'")
      .bind(receiptId, entry.characterId, reward.type, scopeId, reward.amount, reward.reason.trim(), input.actorId, now)),
  ]));

  const totals = { booked: 0, alreadyBooked: 0, failed: 0 }, results: SettlementCharacterResult[] = [];
  for (const { entry, rewards } of planned) {
    const outcome: SettlementRewardResult[] = [];
    for (const { reward, scopeId } of rewards) {
      const base = { type: reward.type, ...(reward.type === "story" ? { storyId: scopeId } : {}), amount: reward.amount };
      const line = [receiptId, entry.characterId, reward.type, scopeId];
      try {
        const booked = await bookCharacterXpReward(db, { campaignId: input.campaignId, characterId: entry.characterId, actorId: input.actorId, amount: reward.amount, reason: reward.reason, now, source: { type: reward.type, campaignId: input.campaignId, scopeId } });
        // The line takes over what the ledger really holds, including the time of an earlier booking.
        await db.prepare("UPDATE xp_settlement_rewards SET status='booked',amount=?,reason=?,ledger_entry_id=?,booked_at=?,error_code=NULL,updated_at=? WHERE settlement_id=? AND character_id=? AND reward_type=? AND scope_id=? AND status<>'booked'")
          .bind(booked.entry.amount, booked.entry.reason, booked.entry.id, booked.entry.createdAt, now, ...line).run();
        outcome.push({ ...base, status: booked.duplicate ? "already_booked" : "booked", entryId: booked.entry.id, reversed: booked.reversed });
        if (booked.duplicate) totals.alreadyBooked++; else totals.booked++;
      } catch (error) {
        // An unexpected failure is reported without internals; the retry is safe either way.
        const known = error instanceof XpRewardServiceError, code = known ? error.status : 503;
        if (!known) console.error("CVK xp settlement reward failed", error);
        try { await db.prepare("UPDATE xp_settlement_rewards SET status='failed',error_code=?,updated_at=? WHERE settlement_id=? AND character_id=? AND reward_type=? AND scope_id=? AND status<>'booked'").bind(code, now, ...line).run(); }
        catch (receiptError) { console.error("CVK xp settlement receipt line failed", receiptError); }
        outcome.push({ ...base, status: "failed", code, error: known ? error.message : "Diese Vergabe konnte gerade nicht gespeichert werden. Bitte die Abrechnung erneut senden." });
        totals.failed++;
      }
    }
    const status = !outcome.length ? "none" : outcome.some(r => r.status === "failed") ? "failed" : outcome.every(r => r.status === "already_booked") ? "already_booked" : "booked";
    results.push({ characterId: entry.characterId, attended: entry.attended, status, rewards: outcome });
  }
  // The receipt status covers every line of the evening, not only this call.
  await db.prepare("UPDATE xp_settlements SET status=CASE WHEN NOT EXISTS(SELECT 1 FROM xp_settlement_rewards WHERE settlement_id=? AND status<>'booked') THEN 'complete' WHEN EXISTS(SELECT 1 FROM xp_settlement_rewards WHERE settlement_id=? AND status='booked') THEN 'partial' ELSE 'failed' END,revision=revision+1,updated_by=?,updated_at=? WHERE id=?")
    .bind(receiptId, receiptId, input.actorId, now, receiptId).run();
  const stored = await header(db, input.campaignId, session.id);
  const status = !totals.failed ? "complete" : totals.booked + totals.alreadyBooked ? "partial" : "failed";
  return { status, complete: status === "complete", sessionId: session.id, appointmentId: session.appointmentId, totals, characters: results,
    receipt: { id: receiptId, status: stored?.status ?? "partial", revision: stored?.revision ?? 0 } };
}

export type SettlementReceiptReward = { type: SessionRewardType; scopeId: string; amount: number; reason: string; status: "pending" | "booked" | "failed"; ledgerEntryId: string | null; errorCode: number | null; awardedBy: string; bookedAt: string | null; reversed?: boolean };
export type SettlementReceipt = {
  id: string; status: ReceiptStatus; revision: number; createdBy: string; createdAt: string; updatedBy: string; updatedAt: string; session: PlayedSession;
  participants: { characterId: string; attended: boolean; rewards: SettlementReceiptReward[] }[];
};

/** The receipt of a played evening, or null if nothing was settled yet. For the Spielleitung only. */
export async function readSessionSettlement(db: D1Database, campaignId: string, playedSessionId: unknown): Promise<SettlementReceipt | null> {
  const session = await playedSession(db, campaignId, playedSessionId);
  const receipt = await header(db, campaignId, session.id);
  if (!receipt) return null;
  const participants = await db.prepare("SELECT character_id,attended FROM xp_settlement_participants WHERE settlement_id=? ORDER BY rowid").bind(receipt.id).all<{ character_id: string; attended: number }>();
  const rewards = await db.prepare("SELECT * FROM xp_settlement_rewards WHERE settlement_id=? ORDER BY rowid").bind(receipt.id)
    .all<{ character_id: string; reward_type: SessionRewardType; scope_id: string; amount: number; reason: string; status: "pending" | "booked" | "failed"; ledger_entry_id: string | null; error_code: number | null; awarded_by: string; booked_at: string | null }>();
  // Read the current ledger state separately: immutable receipt lines still prove
  // the original booking even after the SL has created a valid counterbooking.
  const characterIds = participants.results.map(p => p.character_id);
  const reversals = new Map<string,Set<string>>();
  if (characterIds.length) {
    const placeholders = characterIds.map(() => "?").join(",");
    const characterRows = await db.prepare(
      `SELECT id,body FROM records WHERE campaign_id=? AND kind='charaktere' AND id IN (${placeholders})`
    ).bind(campaignId,...characterIds).all<{id:string;body:string}>();
    for (const row of characterRows.results) reversals.set(row.id,reversedRewardIds(characterLedger(parseBody(row.body))));
  }
  return { id: receipt.id, status: receipt.status, revision: receipt.revision, createdBy: receipt.created_by, createdAt: receipt.created_at, updatedBy: receipt.updated_by, updatedAt: receipt.updated_at, session,
    participants: participants.results.map(p => ({ characterId: p.character_id, attended: p.attended === 1,
      rewards: rewards.results.filter(r => r.character_id === p.character_id).map(r => ({ type: r.reward_type, scopeId: r.scope_id, amount: r.amount, reason: r.reason, status: r.status, ledgerEntryId: r.ledger_entry_id, errorCode: r.error_code, awardedBy: r.awarded_by, bookedAt: r.booked_at, ...(r.ledger_entry_id && reversals.get(p.character_id)?.has(r.ledger_entry_id) ? { reversed:true } : {}) })) })) };
}
