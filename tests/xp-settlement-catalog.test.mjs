import test from 'node:test';
import assert from 'node:assert/strict';
import { setupRewardDb, campaignId, now } from './fixtures/xp-reward-db.mjs';
import { bookSessionSettlement } from '../server/xp-settlement-service.ts';
import { xpSettlementCatalog, receiptReversals } from '../server/xp-settlement-catalog.ts';
import { readSessionSettlement } from '../server/xp-settlement-service.ts';
import { appendCharacterXp } from '../domain/character-management.ts';

test('Catalog lists played evenings with their own IDs and original session titles', async () => {
  const { db } = setupRewardDb();
  const result = await xpSettlementCatalog(db, campaignId);
  assert.deepEqual(result.playedSessions.map(s => s.id), ['abend-1','abend-2']);
  assert.equal(result.playedSessions[0].sessionRecordId, 'sitzung-1');
  assert.equal(result.playedSessions[1].sessionRecordId, 'sitzung-1');
  assert.equal(result.playedSessions[0].settlementStatus, null);
  assert.ok(result.sessionRecords.some(r => r.id === 'sitzung-neu'));
  assert.ok(result.sessionRecords.every(r => r.id !== 'sitzung-laeuft'));
});

test('Catalog does not expose archived, secret, foreign or unconfirmed characters as eligible', async () => {
  const { db } = setupRewardDb();
  const result = await xpSettlementCatalog(db, campaignId);
  assert.deepEqual(result.characters.map(c => c.id), ['char-a','char-b','char-c']);
  assert.ok(result.characters.every(c => c.confirmed));
  assert.ok(!result.playedSessions.some(s => s.id === 'abend-fremd'));
  assert.deepEqual(result.storylines.map(s => s.id), ['bogen-1','bogen-2']);
});

test('Catalog includes the permanent settlement status without changing the receipt', async () => {
  const { db } = setupRewardDb();
  await bookSessionSettlement(db, { campaignId, actorId:'gm',sessionId:'abend-1', now, entries:[{characterId:'char-a',attended:true,rewards:[{type:'session',amount:3,reason:'Gutes Rollenspiel'}]}] });
  const result = await xpSettlementCatalog(db, campaignId);
  assert.equal(result.playedSessions.find(s=>s.id==='abend-1').settlementStatus,'complete');
  assert.equal(result.playedSessions.find(s=>s.id==='abend-2').settlementStatus,null);
});

test('Receipt reversal list follows actual corrections, not just booked receipt rows', async () => {
  const { db, sql, body } = setupRewardDb();
  const reward = {type:'session',amount:3,reason:'Gutes Rollenspiel'};
  await bookSessionSettlement(db, { campaignId, actorId:'gm',sessionId:'abend-1', now, entries:[{characterId:'char-a',attended:true,rewards:[reward]}] });
  const receipt = await readSessionSettlement(db,campaignId,'abend-1');
  assert.deepEqual(await receiptReversals(db,campaignId,receipt),[]);
  const entryId = receipt.participants[0].rewards[0].ledgerEntryId;
  const amended = appendCharacterXp(body('char-a'), {id:'storno-1',kind:'correction',amount:-3,referenceId:entryId,reason:'Fehlbuchung',createdAt:now});
  sql.prepare('UPDATE records SET body=? WHERE id=?').run(JSON.stringify(amended),'char-a');
  assert.deepEqual(await receiptReversals(db,campaignId,receipt),[{characterId:'char-a',ledgerEntryId:entryId}]);
});

test('Receipt reversal listing is campaign isolated and ignores unrelated references', async () => {
  const { db, sql, body } = setupRewardDb();
  const reward = {type:'session',amount:3,reason:'Gutes Rollenspiel'};
  await bookSessionSettlement(db, { campaignId, actorId:'gm',sessionId:'abend-1', now, entries:[{characterId:'char-a',attended:true,rewards:[reward]}] });
  const receipt = await readSessionSettlement(db,campaignId,'abend-1');
  const amended = appendCharacterXp(body('char-a'), {id:'storno-unrelated',kind:'correction',amount:1,reason:'Unrelated',createdAt:now});
  sql.prepare('UPDATE records SET body=? WHERE id=?').run(JSON.stringify(amended),'char-a');
  assert.deepEqual(await receiptReversals(db,'andere-chronik',receipt),[]);
});
