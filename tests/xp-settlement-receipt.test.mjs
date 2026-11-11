import test from 'node:test';
import assert from 'node:assert/strict';
import { setupRewardDb, campaignId, now } from './fixtures/xp-reward-db.mjs';
import { bookSessionXpReward, XpRewardServiceError } from '../server/xp-reward-service.ts';
import { bookSessionSettlement, readSessionSettlement } from '../server/xp-settlement-service.ts';
import { appendCharacterXp } from '../domain/character-management.ts';
import { xpBalance } from '../domain/character-engine.ts';

const status = expected => error => error instanceof XpRewardServiceError && error.status === expected;
const session = (amount = 3, reason = 'Sitzungsabrechnung') => ({ type: 'session', amount, reason });
const entry = (characterId, rewards = [session()], attended = true) => ({ characterId, attended, rewards });
const settlement = (entries, extra = {}) => ({ campaignId, actorId: 'gm', sessionId: 'abend-1', entries, now, ...extra });
const later = '2026-11-11T08:30:00.000Z';
const of = (receipt, characterId) => receipt.participants.find(p => p.characterId === characterId);

test('A complete settlement leaves a receipt with participants, attendance, categories, reasons, SL and timestamps', async () => {
  const { db, body } = setupRewardDb();
  const result = await bookSessionSettlement(db, settlement([
    entry('char-a', [session(4, 'Starkes Rollenspiel'), { type: 'story', storyId: 'bogen-1', amount: 2, reason: 'Bogen abgeschlossen' }]),
    entry('char-b', [], false),
    entry('char-c', [{ type: 'sl_exception', amount: 1, reason: 'Krankheit' }], false),
  ]));
  assert.equal(result.status, 'complete');
  assert.deepEqual([result.receipt.status, result.receipt.revision], ['complete', 1]);
  const receipt = await readSessionSettlement(db, campaignId, 'abend-1');
  assert.equal(receipt.id, result.receipt.id);
  assert.deepEqual([receipt.status, receipt.revision, receipt.createdBy, receipt.createdAt, receipt.updatedBy, receipt.updatedAt], ['complete', 1, 'gm', now, 'gm', now]);
  assert.deepEqual(receipt.session, { id: 'abend-1', campaignId, sessionRecordId: 'sitzung-1', appointmentId: null, playedOn: '2026-11-07', title: 'Titel sitzung-1', registeredBy: 'gm', registeredAt: '2026-11-08T09:00:00.000Z' });
  assert.deepEqual(receipt.participants.map(p => [p.characterId, p.attended, p.rewards.length]), [['char-a', true, 2], ['char-b', false, 0], ['char-c', false, 1]]);
  assert.deepEqual(of(receipt, 'char-a').rewards, [
    { type: 'session', scopeId: 'abend-1', amount: 4, reason: 'Starkes Rollenspiel', status: 'booked', ledgerEntryId: 'reward:session:chronik-von-kleve:abend-1', errorCode: null, awardedBy: 'gm', bookedAt: now },
    { type: 'story', scopeId: 'bogen-1', amount: 2, reason: 'Bogen abgeschlossen', status: 'booked', ledgerEntryId: 'reward:story:chronik-von-kleve:bogen-1', errorCode: null, awardedBy: 'gm', bookedAt: now },
  ]);
  // Every receipt line points to exactly one real ledger entry of that character.
  for (const p of receipt.participants) for (const r of p.rewards) assert.equal(body(p.characterId).xpLedger.find(e => e.id === r.ledgerEntryId).amount, r.amount);
});

test('A partial settlement is recorded as partial; the retry completes the same receipt', async () => {
  const { sql, db, rows } = setupRewardDb();
  const input = settlement([entry('char-a', [session(4)]), entry('char-draft', [session(2)])]);
  const first = await bookSessionSettlement(db, input);
  assert.deepEqual([first.status, first.receipt.status, first.receipt.revision], ['partial', 'partial', 1]);
  let receipt = await readSessionSettlement(db, campaignId, 'abend-1');
  assert.deepEqual(of(receipt, 'char-draft').rewards.map(r => [r.status, r.errorCode, r.ledgerEntryId, r.bookedAt]), [['failed', 409, null, null]]);
  sql.prepare("UPDATE records SET body=json_set(body,'$.characterState','confirmed'),version=version+1 WHERE id='char-draft'").run();
  const retry = await bookSessionSettlement(db, { ...input, actorId: 'gm2', now: later });
  assert.deepEqual([retry.status, retry.receipt.id, retry.receipt.status, retry.receipt.revision], ['complete', first.receipt.id, 'complete', 2]);
  receipt = await readSessionSettlement(db, campaignId, 'abend-1');
  assert.deepEqual([receipt.createdBy, receipt.createdAt, receipt.updatedBy, receipt.updatedAt], ['gm', now, 'gm2', later]);
  assert.deepEqual(of(receipt, 'char-draft').rewards.map(r => [r.status, r.errorCode, r.awardedBy, r.bookedAt]), [['booked', null, 'gm2', later]]);
  assert.deepEqual(of(receipt, 'char-a').rewards.map(r => [r.status, r.awardedBy, r.bookedAt]), [['booked', 'gm', now]]);
  assert.equal(rows('xp_settlements').length, 1);
});

test('A database outage while booking leaves an honest receipt and a safe retry', async () => {
  const { db, body } = setupRewardDb();
  let writes = 0;
  const flaky = { ...db, batch: async list => { if (++writes === 3) throw new Error('synthetic D1 outage'); return db.batch(list); } };
  const input = settlement([entry('char-a'), entry('char-b'), entry('char-c')]);
  const first = await bookSessionSettlement(flaky, input);
  assert.deepEqual([first.status, first.receipt.status], ['partial', 'partial']);
  assert.deepEqual((await readSessionSettlement(db, campaignId, 'abend-1')).participants.map(p => p.rewards[0].status), ['booked', 'failed', 'booked']);
  const retry = await bookSessionSettlement(db, input);
  assert.deepEqual([retry.status, retry.receipt.status], ['complete', 'complete']);
  assert.deepEqual([xpBalance(body('char-a')), xpBalance(body('char-b')), xpBalance(body('char-c'))], [12, 12, 12]);
});

test('If the receipt cannot be written, nothing is booked', async () => {
  const { db, body, rows } = setupRewardDb();
  const broken = { ...db, prepare: q => { if (/xp_settlement/.test(q) && /INSERT/.test(q)) throw new Error('synthetic receipt failure'); return db.prepare(q); } };
  await assert.rejects(bookSessionSettlement(broken, settlement([entry('char-a')])), /synthetic receipt failure/);
  assert.equal(xpBalance(body('char-a')), 9);
  assert.equal(rows('xp_settlements').length, 0);
});

test('A booked line can never be changed or deleted, neither by a new call nor directly', async () => {
  const { sql, db } = setupRewardDb();
  await bookSessionSettlement(db, settlement([entry('char-a', [session(4, 'Original')]), entry('char-b', [session(3)])]));
  const changed = await bookSessionSettlement(db, settlement([entry('char-a', [session(5, 'Nachträglich erhöht')]), entry('char-b', [session(3)])], { actorId: 'gm2', now: later }));
  assert.deepEqual([changed.status, changed.characters[0].status, changed.characters[0].rewards[0].code], ['partial', 'failed', 409]);
  const receipt = await readSessionSettlement(db, campaignId, 'abend-1');
  assert.deepEqual(of(receipt, 'char-a').rewards.map(r => [r.amount, r.reason, r.status, r.awardedBy, r.bookedAt]), [[4, 'Original', 'booked', 'gm', now]]);
  assert.equal(receipt.status, 'complete', 'the receipt still proves a complete settlement of what was booked');
  for (const change of ["amount=5", "status='failed'", "status='pending'", "ledger_entry_id='reward:forged'", "ledger_entry_id=NULL", "reason='Anders'", "character_id='char-c'", "scope_id='abend-2'", "reward_type='mvp'", "awarded_by='x'", "booked_at='x'"])
    assert.throws(() => sql.prepare(`UPDATE xp_settlement_rewards SET ${change} WHERE character_id='char-a'`).run(), /unveränderlich/, change);
  assert.throws(() => sql.prepare("DELETE FROM xp_settlement_rewards WHERE character_id='char-a'").run(), /unveränderlich/);
  assert.throws(() => sql.prepare("DELETE FROM xp_settlements").run());
  assert.throws(() => sql.prepare("DELETE FROM played_sessions WHERE id='abend-1'").run());
});

test('Attendance cannot be flipped once rewards are booked for that character', async () => {
  const { db } = setupRewardDb();
  await bookSessionSettlement(db, settlement([entry('char-a'), entry('char-b', [], false)]));
  await assert.rejects(bookSessionSettlement(db, settlement([entry('char-a', [], false), entry('char-b', [], false)])), status(409));
  const corrected = await bookSessionSettlement(db, settlement([entry('char-a'), entry('char-b', [session(2)], true)]));
  assert.equal(corrected.status, 'complete');
  const receipt = await readSessionSettlement(db, campaignId, 'abend-1');
  assert.deepEqual(receipt.participants.map(p => [p.characterId, p.attended]), [['char-a', true], ['char-b', true]]);
});

test('Booked XP stay provable after the session status changes or the session record disappears', async () => {
  const { sql, db, body } = setupRewardDb();
  const input = settlement([entry('char-a', [session(4)]), entry('char-b', [session(3)])]);
  await bookSessionSettlement(db, input);
  const before = await readSessionSettlement(db, campaignId, 'abend-1');
  sql.prepare("UPDATE records SET body=json_set(body,'$.status','Läuft'),version=version+1 WHERE id='sitzung-1'").run();
  assert.deepEqual(await readSessionSettlement(db, campaignId, 'abend-1'), before);
  const again = await bookSessionSettlement(db, input);
  assert.deepEqual([again.status, again.totals], ['complete', { booked: 0, alreadyBooked: 2, failed: 0 }]);
  sql.prepare("DELETE FROM records WHERE id='sitzung-1'").run();
  const after = await readSessionSettlement(db, campaignId, 'abend-1');
  assert.deepEqual(after.participants, before.participants);
  assert.equal(after.session.sessionRecordId, 'sitzung-1');
  for (const p of after.participants) for (const r of p.rewards) assert.ok(body(p.characterId).xpLedger.some(e => e.id === r.ledgerEntryId && e.source.scopeId === 'abend-1'));
  assert.equal(xpBalance(body('char-a')), 13);
});

test('A reversed reward keeps its receipt line; the reversal is visible when reading', async () => {
  const { sql, db, body } = setupRewardDb();
  const input = settlement([entry('char-a', [session(4)]), entry('char-b', [session(3)])]);
  const first = await bookSessionSettlement(db, input);
  const reversed = appendCharacterXp(body('char-a'), { id: 'storno', kind: 'correction', amount: -4, referenceId: first.characters[0].rewards[0].entryId, reason: 'Falsche Figur', createdAt: later });
  sql.prepare("UPDATE records SET body=?,version=version+1 WHERE id='char-a'").run(JSON.stringify(reversed));
  await bookSessionSettlement(db, input);
  const receipt = await readSessionSettlement(db, campaignId, 'abend-1');
  assert.deepEqual(of(receipt, 'char-a').rewards.map(r => [r.status, r.amount, r.ledgerEntryId, r.reversed]), [['booked', 4, 'reward:session:chronik-von-kleve:abend-1', true]]);
  assert.equal(of(receipt, 'char-b').rewards[0].reversed, undefined);
  assert.equal(xpBalance(body('char-a')), 9);
});

test('A reward booked individually before is taken into the receipt as booked, with its real booking time', async () => {
  const { db } = setupRewardDb();
  await bookSessionXpReward(db, { campaignId, characterId: 'char-a', actorId: 'gm', type: 'session', sessionId: 'abend-1', amount: 4, reason: 'Einzelvergabe', now: '2026-11-09T10:00:00.000Z' });
  const result = await bookSessionSettlement(db, settlement([entry('char-a', [session(4)])]));
  assert.equal(result.characters[0].status, 'already_booked');
  const [line] = of(await readSessionSettlement(db, campaignId, 'abend-1'), 'char-a').rewards;
  assert.deepEqual([line.status, line.ledgerEntryId, line.bookedAt], ['booked', 'reward:session:chronik-von-kleve:abend-1', '2026-11-09T10:00:00.000Z']);
});

test('There is one receipt per played evening; later calls extend it, other evenings get their own', async () => {
  const { db, rows } = setupRewardDb();
  const first = await bookSessionSettlement(db, settlement([entry('char-a')]));
  const second = await bookSessionSettlement(db, settlement([entry('char-b')], { now: later }));
  const other = await bookSessionSettlement(db, settlement([entry('char-a')], { sessionId: 'abend-2' }));
  assert.equal(first.receipt.id, second.receipt.id);
  assert.notEqual(first.receipt.id, other.receipt.id);
  assert.deepEqual([second.receipt.revision, other.receipt.revision], [2, 1]);
  assert.deepEqual((await readSessionSettlement(db, campaignId, 'abend-1')).participants.map(p => p.characterId), ['char-a', 'char-b']);
  assert.deepEqual((await readSessionSettlement(db, campaignId, 'abend-2')).participants.map(p => p.characterId), ['char-a']);
  assert.equal(rows('xp_settlements').length, 2);
});

test('Five identical settlements at the same time leave one consistent receipt', async () => {
  const { db, rows } = setupRewardDb();
  const input = settlement([entry('char-a', [session(4)]), entry('char-b', [session(3)])]);
  const results = await Promise.all(Array.from({ length: 5 }, () => bookSessionSettlement(db, input)));
  assert.equal(new Set(results.map(r => r.receipt.id)).size, 1);
  assert.deepEqual([rows('xp_settlements').length, rows('xp_settlement_participants').length, rows('xp_settlement_rewards').length], [1, 2, 2]);
  const receipt = await readSessionSettlement(db, campaignId, 'abend-1');
  assert.deepEqual([receipt.status, receipt.revision], ['complete', 5]);
  assert.equal(receipt.participants.every(p => p.rewards.every(r => r.status === 'booked' && r.ledgerEntryId)), true);
});

test('A receipt is read only within its own campaign; an evening without settlement has none', async () => {
  const { db } = setupRewardDb();
  await bookSessionSettlement(db, settlement([entry('char-a')]));
  assert.equal(await readSessionSettlement(db, campaignId, 'abend-2'), null);
  for (const id of ['abend-fremd', 'sitzung-1', 'unbekannt']) await assert.rejects(readSessionSettlement(db, campaignId, id), status(404));
  await assert.rejects(readSessionSettlement(db, 'andere-chronik', 'abend-1'), status(404));
});

test('A refused call writes no receipt', async () => {
  const { db, rows } = setupRewardDb();
  await assert.rejects(bookSessionSettlement(db, settlement([entry('char-a'), entry('char-a')])), status(400));
  await assert.rejects(bookSessionSettlement(db, settlement([entry('char-a')], { sessionId: 'sitzung-1' })), status(404));
  await assert.rejects(bookSessionSettlement(db, settlement([entry('char-a', [{ type: 'story', storyId: 'unbekannt', amount: 1, reason: 'Bogen' }])])), status(404));
  assert.deepEqual([rows('xp_settlements').length, rows('xp_settlement_participants').length, rows('xp_settlement_rewards').length], [0, 0, 0]);
});
