import assert from 'node:assert/strict';
import test from 'node:test';
import { transitionFavor, favorDebtMarkers, readLegacyFavors } from '../domain/favors-ledger.ts';

const proposal = { kind: 'debt', status: 'proposed', markers: 3, remaining: 3, npcId: 'npc-a', direction: 'owes' };
const change = (current, action, actor, extras = {}) => transitionFavor(current, { action, ...extras }, actor);

test('only the SL can confirm a proposal and a debt can be called, partly fulfilled and closed', () => {
  assert.throws(() => change(proposal, 'confirm', 'creditor'), /Spielleitung/);
  const confirmed = change(proposal, 'confirm', 'sl');
  assert.equal(confirmed.status, 'confirmed');
  assert.throws(() => change(confirmed, 'call', 'debtor'), /Gläubiger/);
  const called = change(confirmed, 'call', 'creditor');
  const partial = change(called, 'fulfill', 'debtor', { amount: 1 });
  assert.deepEqual([partial.status, partial.remaining], ['partial', 2]);
  assert.throws(() => change(partial, 'fulfill', 'debtor', { amount: 3 }), /Marker/);
  const closed = change(partial, 'fulfill', 'creditor', { amount: 2 });
  assert.deepEqual([closed.status, closed.remaining], ['fulfilled', 0]);
  assert.throws(() => change(closed, 'call', 'sl'), /abgeschlossen/);
});

test('disputed debt remains open, and the SL can decide, transfer, forgive or reject', () => {
  const confirmed = change(proposal, 'confirm', 'sl');
  const disputed = change(confirmed, 'dispute', 'debtor');
  assert.equal(favorDebtMarkers(disputed), 3);
  assert.throws(() => change(disputed, 'fulfill', 'debtor', { amount: 1 }), /Spielleitung/);
  assert.equal(change(disputed, 'resolve', 'sl').status, 'confirmed');
  assert.equal(change(disputed, 'transfer', 'sl', { npcId: 'npc-b' }).npcId, 'npc-b');
  assert.equal(change(disputed, 'forgive', 'sl').remaining, 0);
  assert.equal(change(proposal, 'reject', 'sl').status, 'rejected');
});

test('the crisis count uses remaining outgoing debt markers, independent of favor tiers and exchange', () => {
  const confirmed = change(proposal, 'confirm', 'sl');
  assert.equal(favorDebtMarkers(proposal), 0);
  assert.equal(favorDebtMarkers({ ...confirmed, kind: 'favor' }), 0);
  assert.equal(favorDebtMarkers({ ...confirmed, kind: 'trade' }), 0);
  assert.equal(favorDebtMarkers({ ...confirmed, direction: 'owed' }), 0);
  assert.equal(favorDebtMarkers({ ...confirmed, status: 'partial', remaining: 2 }), 2);
});

test('the legacy projection preserves signed values and exposes zero canonical markers', () => {
  const rows = readLegacyFavors('original', 4, { favors: [
    { id: 'plus', npc: 'Elara', value: 2, note: 'Alt', date: '2026-10-12', status: 'offen' },
    { id: 'minus', npc: 'Silas', value: -3 },
  ] });
  assert.deepEqual(rows.map(row => [row.key, row.value, row.note]), [['original:plus', 2, 'Alt'], ['original:minus', -3, '']]);
  assert.ok(rows.every(row => !('markers' in row)));
});
