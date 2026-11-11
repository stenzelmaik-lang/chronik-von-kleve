import test from 'node:test';
import assert from 'node:assert/strict';
import { appendCharacterXp, characterXpSummary } from '../domain/character-management.ts';
import { xpBalance } from '../domain/character-engine.ts';
import { bookXpReward, characterXpRewards, xpRewardEntryId, xpRewardRules, XpRewardError } from '../domain/xp-rewards.ts';

const campaignId = 'chronik-von-kleve';
const legacy = [
  { id: 'opening', kind: 'historical', amount: 9, reason: 'Bestandsübernahme', createdAt: '2026-01-01' },
  { id: '7c1f0c53-6f0e-4d0b-9a59-1d2f4f0a9a11', kind: 'grant', amount: 40, reason: 'Alte Sammelgutschrift', createdAt: '2026-02-01' },
];
const confirmed = () => ({ engineVersion: 1, characterState: 'confirmed', clan: 'Toreador', xpLedger: structuredClone(legacy) });
const session = (scopeId = 'abend-2026-11-07') => ({ type: 'session', campaignId, scopeId });
const award = (source, amount, extra = {}) => ({ source, amount, reason: 'Sitzungsabrechnung', createdAt: '2026-11-08T10:00:00.000Z', ...extra });
const code = expected => error => error instanceof XpRewardError && error.code === expected;

test('A reward is booked as an ordinary grant in the existing ledger and keeps its origin', () => {
  const result = bookXpReward(confirmed(), award(session(), 4));
  assert.equal(result.duplicate, false);
  assert.equal(result.entry.kind, 'grant');
  assert.equal(result.entry.id, 'reward:session:chronik-von-kleve:abend-2026-11-07');
  assert.deepEqual(result.entry.source, session());
  assert.equal(xpBalance(result.body), 53);
  assert.equal(characterXpSummary(result.body).grants, 44);
  assert.equal(result.body.xpLedger.length, 3);
});

test('Existing ledger entries stay byte-identical and are never reinterpreted', () => {
  const result = bookXpReward(confirmed(), award(session(), 5));
  assert.deepEqual(result.body.xpLedger.slice(0, 2), legacy);
  assert.deepEqual(characterXpRewards(confirmed()), []);
  assert.deepEqual(characterXpRewards(result.body).map(e => e.id), [result.entry.id]);
});

test('Replaying the same reward two or ten times credits it exactly once', () => {
  let body = confirmed();
  for (let i = 0; i < 10; i++) {
    const result = bookXpReward(body, award(session(), 3, { createdAt: `2026-11-08T10:00:0${i}.000Z` }));
    assert.equal(result.duplicate, i > 0);
    body = result.body;
  }
  assert.equal(body.xpLedger.length, 3);
  assert.equal(xpBalance(body), 52);
  assert.equal(body.xpLedger[2].createdAt, '2026-11-08T10:00:00.000Z');
});

test('A replay with a different amount is a conflict, not a silent overwrite', () => {
  const { body } = bookXpReward(confirmed(), award(session(), 3));
  assert.throws(() => bookXpReward(body, award(session(), 5)), code('conflict'));
  assert.equal(xpBalance(body), 52);
});

test('Regular session reward: 5 accepted, 6 and non-positive or fractional amounts refused', () => {
  assert.equal(xpRewardRules.session.max, 5);
  assert.equal(xpBalance(bookXpReward(confirmed(), award(session(), 5)).body), 54);
  for (const amount of [6, 0, -1, 2.5, Number.NaN, '3']) assert.throws(() => bookXpReward(confirmed(), award(session(), amount)), code('invalid'));
});

test('Story 1–3, MVP 1–2 and engagement exactly 1 per milestone are checked independently', () => {
  const story = { type: 'story', campaignId, scopeId: 'bogen-1' }, mvp = { type: 'mvp', campaignId, scopeId: 'abend-2026-11-07' };
  assert.equal(bookXpReward(confirmed(), award(story, 3)).entry.amount, 3);
  assert.throws(() => bookXpReward(confirmed(), award(story, 4)), code('invalid'));
  assert.equal(bookXpReward(confirmed(), award(mvp, 2)).entry.amount, 2);
  assert.throws(() => bookXpReward(confirmed(), award(mvp, 3)), code('invalid'));
  const engagement = milestone => ({ type: 'engagement', campaignId, scopeId: 'intervall-7', milestone });
  assert.throws(() => bookXpReward(confirmed(), award(engagement(1), 2)), code('invalid'));
  assert.throws(() => bookXpReward(confirmed(), award(engagement(3), 1)), code('invalid'));
  assert.throws(() => bookXpReward(confirmed(), award({ type: 'engagement', campaignId, scopeId: 'intervall-7' }, 1)), code('invalid'));
  assert.throws(() => bookXpReward(confirmed(), award({ ...session(), milestone: 1 }, 1)), code('invalid'));
});

test('Session, story, MVP and both engagement milestones coexist without overwriting each other', () => {
  let body = confirmed();
  const sources = [
    [session(), 5], [{ type: 'story', campaignId, scopeId: 'bogen-1' }, 3], [{ type: 'mvp', campaignId, scopeId: 'abend-2026-11-07' }, 2],
    [{ type: 'engagement', campaignId, scopeId: 'intervall-7', milestone: 1 }, 1], [{ type: 'engagement', campaignId, scopeId: 'intervall-7', milestone: 2 }, 1],
    [{ type: 'sl_exception', campaignId, scopeId: '0b8f5a0e-5a39-4a55-8f2c-0a2d6a6b7c10' }, 2],
  ];
  for (const [source, amount] of sources) body = bookXpReward(body, award(source, amount)).body;
  for (const [source, amount] of sources) assert.equal(bookXpReward(body, award(source, amount)).duplicate, true);
  assert.equal(new Set(body.xpLedger.map(e => e.id)).size, 8);
  assert.equal(xpBalance(body), 49 + 14);
  assert.equal(xpBalance(bookXpReward(body, award(session('abend-2026-12-05'), 2)).body), 49 + 16);
});

test('Entry IDs are deterministic and cannot collide through crafted identifiers', () => {
  assert.equal(xpRewardEntryId({ type: 'engagement', campaignId, scopeId: 'intervall-7', milestone: 2 }), 'reward:engagement:chronik-von-kleve:intervall-7:m2');
  for (const patch of [{ scopeId: 'a:b' }, { scopeId: '' }, { scopeId: 'x'.repeat(101) }, { campaignId: 'a b' }, { type: 'bonus' }, { scopeId: undefined }])
    assert.throws(() => xpRewardEntryId({ ...session(), ...patch }), code('invalid'));
});

test('Only a confirmed sheet receives rewards, and a reason is mandatory', () => {
  for (const characterState of ['draft', 'review', undefined]) assert.throws(() => bookXpReward({ ...confirmed(), characterState }, award(session(), 2)), code('conflict'));
  assert.throws(() => bookXpReward(confirmed(), award(session(), 2, { reason: ' x ' })), code('invalid'));
});

test('A reversed reward stays reversed: the existing counterbooking works and a replay does not rebook', () => {
  const booked = bookXpReward(confirmed(), award(session(), 4));
  const reversed = appendCharacterXp(booked.body, { id: 'storno', kind: 'correction', amount: -4, referenceId: booked.entry.id, reason: 'Falsche Sitzung', createdAt: 'now' });
  assert.equal(xpBalance(reversed), 49);
  const replay = bookXpReward(reversed, award(session(), 4));
  assert.equal(replay.duplicate, true);
  assert.equal(xpBalance(replay.body), 49);
  assert.equal(replay.body.xpLedger.length, 4);
});

test('The input body is never mutated', () => {
  const body = confirmed(), snapshot = structuredClone(body);
  bookXpReward(body, award(session(), 4));
  assert.deepEqual(body, snapshot);
});
