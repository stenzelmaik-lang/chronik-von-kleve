import test from 'node:test';
import assert from 'node:assert/strict';
import { setupRewardDb, campaignId, now } from './fixtures/xp-reward-db.mjs';
import { bookSessionXpReward, XpRewardServiceError } from '../server/xp-reward-service.ts';
import { bookSessionSettlement } from '../server/xp-settlement-service.ts';
import { appendCharacterXp } from '../domain/character-management.ts';
import { xpBalance } from '../domain/character-engine.ts';

const status = expected => error => error instanceof XpRewardServiceError && error.status === expected;
const session = (amount = 3, reason = 'Sitzungsabrechnung') => ({ type: 'session', amount, reason });
const entry = (characterId, rewards = [session()], attended = true) => ({ characterId, attended, rewards });
const settlement = (entries, extra = {}) => ({ campaignId, actorId: 'gm', sessionId: 'abend-1', entries, now, ...extra });
const statuses = result => Object.fromEntries(result.characters.map(c => [c.characterId, c.status]));

test('A complete settlement books every character once and reports each result', async () => {
  const { db, body, events } = setupRewardDb();
  const result = await bookSessionSettlement(db, settlement([
    entry('char-a', [session(4), { type: 'story', storyId: 'bogen-1', amount: 2, reason: 'Bogen abgeschlossen' }, { type: 'mvp', amount: 1, reason: 'MVP der Runde' }]),
    entry('char-b', [session(3)]),
    entry('char-c', [session(5)]),
  ]));
  assert.equal(result.status, 'complete');
  assert.equal(result.complete, true);
  assert.equal(result.sessionId, 'abend-1');
  assert.deepEqual(result.totals, { booked: 5, alreadyBooked: 0, failed: 0 });
  assert.deepEqual(statuses(result), { 'char-a': 'booked', 'char-b': 'booked', 'char-c': 'booked' });
  assert.deepEqual([xpBalance(body('char-a')), xpBalance(body('char-b')), xpBalance(body('char-c'))], [16, 12, 14]);
  assert.deepEqual(result.characters[0].rewards.map(r => [r.type, r.status, r.entryId, r.amount]), [
    ['session', 'booked', 'reward:session:chronik-von-kleve:abend-1', 4],
    ['story', 'booked', 'reward:story:chronik-von-kleve:bogen-1', 2],
    ['mvp', 'booked', 'reward:mvp:chronik-von-kleve:abend-1', 1],
  ]);
  assert.equal(events().length, 5);
  assert.equal(events().every(e => e.type === 'character.xp_reward'), true);
});

test('Repeating a complete settlement books nothing again and says so', async () => {
  const { db, body, events } = setupRewardDb();
  const input = settlement([entry('char-a', [session(4)]), entry('char-b', [session(3)])]);
  await bookSessionSettlement(db, input);
  const again = await bookSessionSettlement(db, input);
  assert.equal(again.status, 'complete');
  assert.deepEqual(again.totals, { booked: 0, alreadyBooked: 2, failed: 0 });
  assert.deepEqual(statuses(again), { 'char-a': 'already_booked', 'char-b': 'already_booked' });
  assert.deepEqual([xpBalance(body('char-a')), xpBalance(body('char-b'))], [13, 12]);
  assert.equal(events().length, 2);
});

test('A partial failure is never reported as success, and the retry completes only what is missing', async () => {
  const { sql, db, body, events } = setupRewardDb();
  const input = settlement([entry('char-a', [session(4)]), entry('char-draft', [session(2)]), entry('char-c', [session(5)])]);
  const first = await bookSessionSettlement(db, input);
  assert.equal(first.status, 'partial');
  assert.equal(first.complete, false);
  assert.deepEqual(first.totals, { booked: 2, alreadyBooked: 0, failed: 1 });
  assert.deepEqual(statuses(first), { 'char-a': 'booked', 'char-draft': 'failed', 'char-c': 'booked' });
  const failed = first.characters[1].rewards[0];
  assert.deepEqual([failed.status, failed.code], ['failed', 409]);
  assert.match(failed.error, /bestätigten Charakter/);
  assert.equal(failed.entryId, undefined);
  // The Spielleitung confirms the sheet, then sends the identical settlement again.
  sql.prepare("UPDATE records SET body=json_set(body,'$.characterState','confirmed'),version=version+1 WHERE id='char-draft'").run();
  const retry = await bookSessionSettlement(db, input);
  assert.equal(retry.status, 'complete');
  assert.deepEqual(retry.totals, { booked: 1, alreadyBooked: 2, failed: 0 });
  assert.deepEqual(statuses(retry), { 'char-a': 'already_booked', 'char-draft': 'booked', 'char-c': 'already_booked' });
  assert.deepEqual([xpBalance(body('char-a')), xpBalance(body('char-draft')), xpBalance(body('char-c'))], [13, 2, 14]);
  assert.equal(events().length, 3);
});

test('A database failure in the middle leaves a truthful partial result and a safe retry', async () => {
  const { db, body } = setupRewardDb();
  let writes = 0;
  const flaky = { ...db, batch: async list => { if (++writes === 3) throw new Error('synthetic D1 outage'); return db.batch(list); } };
  const input = settlement([entry('char-a'), entry('char-b'), entry('char-c')]);
  const first = await bookSessionSettlement(flaky, input);
  assert.equal(first.status, 'partial');
  assert.deepEqual(statuses(first), { 'char-a': 'booked', 'char-b': 'failed', 'char-c': 'booked' });
  assert.equal(first.characters[1].rewards[0].code, 503);
  assert.equal(/synthetic|D1/.test(first.characters[1].rewards[0].error), false);
  const retry = await bookSessionSettlement(db, input);
  assert.deepEqual(statuses(retry), { 'char-a': 'already_booked', 'char-b': 'booked', 'char-c': 'already_booked' });
  assert.deepEqual([xpBalance(body('char-a')), xpBalance(body('char-b')), xpBalance(body('char-c'))], [12, 12, 12]);
});

test('When every reward fails the settlement is reported as failed', async () => {
  const { db } = setupRewardDb();
  const result = await bookSessionSettlement(db, settlement([entry('char-draft'), entry('char-legacy'), entry('char-foreign'), entry('char-secret'), entry('char-entity-secret'), entry('unbekannt')]));
  assert.equal(result.status, 'failed');
  assert.equal(result.complete, false);
  assert.deepEqual(result.characters.map(c => c.rewards[0].code), [409, 409, 404, 404, 404, 404]);
});

test('Five identical settlements at the same time credit each character exactly once', async () => {
  const { db, body, events } = setupRewardDb();
  const input = settlement([entry('char-a', [session(4), { type: 'mvp', amount: 2, reason: 'MVP der Runde' }]), entry('char-b', [session(3)]), entry('char-c', [session(5)])]);
  const results = await Promise.all(Array.from({ length: 5 }, () => bookSessionSettlement(db, input)));
  assert.equal(results.every(r => r.status === 'complete'), true);
  assert.equal(results.reduce((n, r) => n + r.totals.booked, 0), 4);
  assert.equal(results.reduce((n, r) => n + r.totals.alreadyBooked, 0), 16);
  assert.deepEqual([xpBalance(body('char-a')), xpBalance(body('char-b')), xpBalance(body('char-c'))], [15, 12, 14]);
  assert.equal(events().length, 4);
});

test('A settlement and single rewards for the same sources share one identity', async () => {
  const { db, body } = setupRewardDb();
  await bookSessionXpReward(db, { campaignId, characterId: 'char-a', actorId: 'gm', type: 'session', sessionId: 'abend-1', amount: 4, reason: 'Einzelvergabe', now });
  const result = await bookSessionSettlement(db, settlement([entry('char-a', [session(4)]), entry('char-b', [session(4)])]));
  assert.deepEqual(statuses(result), { 'char-a': 'already_booked', 'char-b': 'booked' });
  assert.equal(xpBalance(body('char-a')), 13);
});

test('A different amount for an already booked source fails for that character only', async () => {
  const { db, body } = setupRewardDb();
  await bookSessionSettlement(db, settlement([entry('char-a', [session(4)]), entry('char-b', [session(3)])]));
  const changed = await bookSessionSettlement(db, settlement([entry('char-a', [session(5)]), entry('char-b', [session(3)]), entry('char-c', [session(2)])]));
  assert.equal(changed.status, 'partial');
  assert.deepEqual(statuses(changed), { 'char-a': 'failed', 'char-b': 'already_booked', 'char-c': 'booked' });
  assert.equal(changed.characters[0].rewards[0].code, 409);
  assert.deepEqual([xpBalance(body('char-a')), xpBalance(body('char-b')), xpBalance(body('char-c'))], [13, 12, 11]);
});

test('A reversed reward stays reversed in a repeated settlement and is marked', async () => {
  const { sql, db, body } = setupRewardDb();
  const input = settlement([entry('char-a', [session(4)]), entry('char-b', [session(3)])]);
  const first = await bookSessionSettlement(db, input);
  const reversed = appendCharacterXp(body('char-a'), { id: 'storno', kind: 'correction', amount: -4, referenceId: first.characters[0].rewards[0].entryId, reason: 'Falsche Figur', createdAt: now });
  sql.prepare("UPDATE records SET body=?,version=version+1 WHERE id='char-a'").run(JSON.stringify(reversed));
  const again = await bookSessionSettlement(db, input);
  assert.equal(again.status, 'complete');
  assert.deepEqual([again.characters[0].status, again.characters[0].rewards[0].reversed], ['already_booked', true]);
  assert.equal(again.characters[1].rewards[0].reversed, false);
  assert.equal(xpBalance(body('char-a')), 9);
});

test('Absent characters get no regular, story or MVP reward; a reasoned SL exception stays possible', async () => {
  const { db, body, events } = setupRewardDb();
  for (const reward of [session(1), { type: 'mvp', amount: 1, reason: 'MVP der Runde' }, { type: 'story', storyId: 'bogen-1', amount: 1, reason: 'Bogen' }])
    await assert.rejects(bookSessionSettlement(db, settlement([entry('char-a'), entry('char-b', [reward], false)])), status(400));
  assert.equal(events().length, 0);
  const result = await bookSessionSettlement(db, settlement([entry('char-a'), entry('char-b', [], false), entry('char-c', [{ type: 'sl_exception', amount: 2, reason: 'Krankheit, sonst zu weit zurück' }], false)]));
  assert.equal(result.status, 'complete');
  assert.deepEqual(statuses(result), { 'char-a': 'booked', 'char-b': 'none', 'char-c': 'booked' });
  assert.deepEqual(result.characters.map(c => c.attended), [true, false, false]);
  assert.equal(result.characters[2].rewards[0].entryId, 'reward:sl_exception:chronik-von-kleve:abend-1');
  assert.deepEqual([xpBalance(body('char-b')), xpBalance(body('char-c'))], [9, 11]);
});

test('The whole call is refused before any booking when its structure is invalid', async () => {
  const { db, events } = setupRewardDb();
  const bad = [
    [entry('char-a'), entry('char-a')],
    [entry('char-a', [session(3), session(2)])],
    [entry('char-a', [{ type: 'story', storyId: 'bogen-1', amount: 1, reason: 'Bogen' }, { type: 'story', storyId: 'bogen-1', amount: 2, reason: 'Bogen' }])],
    [entry('char-a'), entry('char-b', [session(6)])],
    [entry('char-a'), entry('char-b', [session(0)])],
    [entry('char-a'), entry('char-b', [{ type: 'story', storyId: 'bogen-1', amount: 4, reason: 'Bogen' }])],
    [entry('char-a'), entry('char-b', [{ type: 'story', amount: 1, reason: 'Bogen' }])],
    [entry('char-a'), entry('char-b', [{ type: 'session', storyId: 'bogen-1', amount: 1, reason: 'Sitzung' }])],
    [entry('char-a'), entry('char-b', [{ type: 'engagement', amount: 1, reason: 'Engagement' }])],
    [entry('char-a'), entry('char-b', [session(2, 'x')])],
    [entry('char-a'), { characterId: 'char-b', rewards: [session()] }],
    [entry('char-a'), entry('a:b')],
    [entry('char-a'), entry('char-b', 'kein Array')],
    [],
    Array.from({ length: 51 }, (_, i) => entry('char-' + i)),
    'kein Array',
  ];
  for (const entries of bad) await assert.rejects(bookSessionSettlement(db, settlement(entries)), status(400), JSON.stringify(entries).slice(0, 120));
  assert.equal(events().length, 0);
});

test('Session, campaign and story arcs are validated for the whole call', async () => {
  const { db, events } = setupRewardDb();
  for (const sessionId of ['termin-1', 'abend-fremd', 'unbekannt', 'sitzung-1', 'sitzung-laeuft']) await assert.rejects(bookSessionSettlement(db, settlement([entry('char-a')], { sessionId })), status(404));
  await assert.rejects(bookSessionSettlement(db, settlement([entry('char-a')], { campaignId: 'andere-chronik' })), status(404));
  for (const storyId of ['bogen-fremd', 'npc-1', 'unbekannt']) await assert.rejects(bookSessionSettlement(db, settlement([entry('char-a'), entry('char-b', [{ type: 'story', storyId, amount: 1, reason: 'Bogen' }])])), status(404));
  assert.equal(events().length, 0);
});

test('Several story arcs can be rewarded in one evening, each exactly once per character', async () => {
  const { db, body } = setupRewardDb();
  const arcs = [{ type: 'story', storyId: 'bogen-1', amount: 3, reason: 'Bogen 1' }, { type: 'story', storyId: 'bogen-2', amount: 1, reason: 'Bogen 2' }];
  const first = await bookSessionSettlement(db, settlement([entry('char-a', arcs)]));
  assert.deepEqual(first.totals, { booked: 2, alreadyBooked: 0, failed: 0 });
  const later = await bookSessionSettlement(db, settlement([entry('char-a', arcs)], { sessionId: 'abend-2' }));
  assert.deepEqual(later.totals, { booked: 0, alreadyBooked: 2, failed: 0 });
  assert.equal(xpBalance(body('char-a')), 13);
});
