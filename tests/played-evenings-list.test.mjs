import test from 'node:test';
import assert from 'node:assert/strict';
import { setupRewardDb, campaignId } from './fixtures/xp-reward-db.mjs';
import { listPlayedEvenings } from '../server/played-evenings-list.ts';

test('SL read model lists registered played evenings only, newest first, campaign scoped', async () => {
  const { db } = setupRewardDb();
  const rows = await listPlayedEvenings(db, campaignId);
  assert.deepEqual(rows.map(row => row.id), ['abend-1', 'abend-2']);
  assert.equal(rows[0].settlement, null);
  assert.equal(rows[1].appointmentId, 'termin-1');
  assert.equal((await listPlayedEvenings(db, 'andere-chronik')).length, 1);
  assert.equal((await listPlayedEvenings(db, campaignId, 1)).length, 1);
});

test('Read model exposes stored receipt state and counts without treating a partial receipt as complete', async () => {
  const { db, sql } = setupRewardDb();
  sql.prepare("INSERT INTO xp_settlements(id,campaign_id,played_session_id,status,revision,created_by,created_at,updated_by,updated_at) VALUES('beleg-1',?,'abend-1','partial',2,'gm','t','gm','t')").run(campaignId);
  sql.prepare("INSERT INTO xp_settlement_participants(settlement_id,character_id,attended,recorded_by,recorded_at) VALUES('beleg-1','char-a',1,'gm','t')").run();
  sql.prepare("INSERT INTO xp_settlement_rewards(settlement_id,character_id,reward_type,scope_id,amount,reason,status,awarded_by,updated_at) VALUES('beleg-1','char-a','session','abend-1',3,'Gute Runde','pending','gm','t')").run();
  const [evening] = await listPlayedEvenings(db, campaignId);
  assert.deepEqual(evening.settlement, { id: 'beleg-1', status: 'partial', revision: 2, participants: 1, bookedRewards: 0, outstandingRewards: 1 });
});

test('Invalid list limit fails before querying', async () => {
  const { db } = setupRewardDb();
  await assert.rejects(listPlayedEvenings(db, campaignId, 101), /Seitengröße/);
});
