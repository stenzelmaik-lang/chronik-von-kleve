// Alpha 2.0 (#74/#75): uniquely attributable reward sources for the existing XP ledger.
// This is not a second ledger. A reward is an ordinary `grant` entry in
// `body.xpLedger` whose ID is derived from its origin, so that a retry, a second
// tab or a replayed request can never credit the same origin twice.
import { appendCharacterXp, characterLedger, type CharacterBody, type CharacterXpEntry, type XpRewardSource, type XpRewardType } from './character-management.ts';

export type { XpRewardSource, XpRewardType };

/** Amount limits per single booking. Kleve standard, issue #75; `sl_exception` keeps the bound of the existing xp_grant. */
export const xpRewardRules: Readonly<Record<XpRewardType, { min: number; max: number; milestones?: readonly number[] }>> = {
  session: { min: 1, max: 5 },
  story: { min: 1, max: 3 },
  mvp: { min: 1, max: 2 },
  engagement: { min: 1, max: 1, milestones: [1, 2] },
  sl_exception: { min: 1, max: 1000 },
};

export class XpRewardError extends Error {
  code: 'invalid' | 'conflict';
  constructor(code: 'invalid' | 'conflict', message: string) { super(message); this.name = 'XpRewardError'; this.code = code; }
}

// No colon: the parts of an entry ID can never run into each other.
const idPart = /^[A-Za-z0-9_-]{1,100}$/;

function checkedSource(source: XpRewardSource) {
  const rule = source && Object.hasOwn(xpRewardRules, source.type) ? xpRewardRules[source.type] : null;
  if (!rule) throw new XpRewardError('invalid', 'Unbekannte Belohnungsquelle.');
  if (typeof source.campaignId !== 'string' || !idPart.test(source.campaignId) || typeof source.scopeId !== 'string' || !idPart.test(source.scopeId)) throw new XpRewardError('invalid', 'Die Belohnungsquelle braucht eine eindeutige Kampagnen- und Bezugskennung.');
  if (rule.milestones ? !rule.milestones.includes(source.milestone as number) : source.milestone !== undefined) throw new XpRewardError('invalid', 'Ungültiger Meilenstein für diese Belohnungsquelle.');
  return rule;
}

/** Deterministic ledger ID: one origin, one entry per character. */
export function xpRewardEntryId(source: XpRewardSource): string {
  checkedSource(source);
  return ['reward', source.type, source.campaignId, source.scopeId, ...(source.milestone === undefined ? [] : ['m' + source.milestone])].join(':');
}

export function characterXpRewards(body: CharacterBody): CharacterXpEntry[] {
  return characterLedger(body).filter(entry => !!entry.source);
}

export type XpRewardInput = { source: XpRewardSource; amount: number; reason: string; createdAt: string };

/**
 * Books a reward exactly once. A replay of the same origin with the same amount
 * returns the unchanged body (`duplicate: true`); a different amount is a conflict
 * and has to go through the existing audited counterbooking instead.
 */
export function bookXpReward(body: CharacterBody, input: XpRewardInput): { body: CharacterBody; entry: CharacterXpEntry; duplicate: boolean } {
  const rule = checkedSource(input.source), id = xpRewardEntryId(input.source);
  if (!Number.isSafeInteger(input.amount) || input.amount < rule.min || input.amount > rule.max) throw new XpRewardError('invalid', rule.min === rule.max ? `Diese Belohnung beträgt genau ${rule.min} EP.` : `Diese Belohnung beträgt ${rule.min} bis ${rule.max} EP.`);
  if (typeof input.reason !== 'string' || input.reason.trim().length < 3) throw new XpRewardError('invalid', 'Bitte begründe die Vergabe kurz.');
  const existing = characterLedger(body).find(entry => entry.id === id);
  if (existing) {
    if (existing.kind !== 'grant' || existing.amount !== input.amount) throw new XpRewardError('conflict', 'Diese Belohnung wurde bereits mit einem anderen Betrag gebucht. Änderungen nur als begründete Korrektur.');
    return { body, entry: existing, duplicate: true };
  }
  if (body.characterState !== 'confirmed') throw new XpRewardError('conflict', 'EP nur einem bestätigten Charakter gutschreiben.');
  const source: XpRewardSource = { type: input.source.type, campaignId: input.source.campaignId, scopeId: input.source.scopeId, ...(input.source.milestone === undefined ? {} : { milestone: input.source.milestone }) };
  const entry: CharacterXpEntry = { id, kind: 'grant', amount: input.amount, reason: input.reason.trim(), createdAt: input.createdAt, source };
  return { body: appendCharacterXp(body, entry), entry, duplicate: false };
}
