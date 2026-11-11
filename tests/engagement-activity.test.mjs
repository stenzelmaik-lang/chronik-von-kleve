import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { setupRewardDb, campaignId } from './fixtures/xp-reward-db.mjs';
import { recordEngagementPulse, engagementSummary } from '../server/engagement-activity.ts';
import { engagementWindow } from '../domain/engagement-window.ts';
import { engagementRewardPlans } from '../server/engagement-reward-plans.ts';
import { bookCharacterXpReward } from '../server/xp-reward-service.ts';
import { ActiveEngagement } from '../domain/engagement-browser.ts';

const epoch = Date.parse('2026-11-10T12:00:00Z');
const scope = { campaignId, memberId: 'player-a' };
const category = 'codex';
function setup() {
  const fixture = setupRewardDb();
  fixture.sql.exec("CREATE TABLE campaigns(id TEXT PRIMARY KEY); CREATE TABLE members(id TEXT PRIMARY KEY); INSERT INTO campaigns VALUES ('chronik-von-kleve'),('foreign'); INSERT INTO members VALUES ('player-a'),('player-b');");
  fixture.sql.exec(readFileSync('drizzle/0014_alpha2_engagement_activity.sql', 'utf8'));
  return fixture;
}

test('one server-timed interval per account and campaign despite concurrent tabs, retries and stolen tickets', async () => {
  const { db, rows } = setup();
  const first = await Promise.all(Array.from({ length: 8 }, () => recordEngagementPulse(db, scope, { category }, epoch)));
  const accepted = first.filter(result => result.ticket);
  assert.equal(accepted.length, 1);
  const ticket = accepted[0].ticket;
  assert.equal(accepted[0].seconds, 0);
  const send = (offset, fields = {}, owner = scope) => recordEngagementPulse(db, owner, { category, ticket, ...fields }, epoch + offset);
  for (const result of [
    await send(1_000),
    await send(30_000, { category: 'story' }),
    await send(30_000, {}, { ...scope, memberId: 'player-b' }),
    await send(30_000, {}, { ...scope, campaignId: 'foreign' }),
  ]) assert.equal(result.seconds, 0);
  const duplicate = await Promise.all(Array.from({ length: 8 }, () => send(30_000)));
  assert.equal(duplicate.reduce((sum, item) => sum + item.seconds, 0), 30);
  const next = duplicate.find(result => result.ticket).ticket;
  assert.equal((await send(90_000, { ticket: next })).seconds, 0);
  assert.equal((await recordEngagementPulse(db, scope, { category: 'story' }, epoch + 90_000)).seconds, 0);
  assert.deepEqual(rows('engagement_daily').map(row => [row.day, row.category, row.seconds]), [['2026-11-10', category, 30]]);
});

test('a pulse cannot credit the previous Berlin day after crossing midnight', async () => {
  const { db, rows } = setup();
  const start = Date.parse('2026-11-10T22:59:50Z');
  const { ticket } = await recordEngagementPulse(db, scope, { category }, start);
  const result = await recordEngagementPulse(db, scope, { category, ticket }, start + 30_000);
  assert.equal(result.seconds, 20);
  assert.equal(rows('engagement_daily')[0].day, '2026-11-11');
});

const played = { id: 'played-1', day: '2026-03-28' };
const at = Date.parse('2026-03-29T10:00:00Z');
const upcoming = '2026-03-30T17:00:00Z';
const candidate = (body, id = 'next') => ({ id, body: { engagementGameNight: true, ...body } });

test('open polls preview and confirmed dates recalculate from the same played interval through DST', () => {
  const poll = candidate({ scheduleKind: 'poll', pollClosed: false, pollOptions: [
    { id: 'a', date: upcoming }, { id: 'b', date: '2026-04-02T17:00:00Z' },
  ] });
  assert.equal(engagementWindow(played, [poll], at).status, 'preview');
  const first = engagementWindow(played, [candidate({ scheduleKind: 'poll', pollClosed: true, date: upcoming })], at);
  assert.equal(first.status, 'confirmed');
  assert.equal(first.targets.intervalDays, 47 / 24);
  assert.equal(first.fromDay, '2026-03-29');
  assert.equal(first.untilDay, '2026-03-30');
  const moved = engagementWindow(played, [candidate({ scheduleKind: 'fixed', date: '2026-04-01T17:00:00Z' }, 'replacement')], at);
  assert.equal(moved.intervalId, first.intervalId);
  assert.ok(moved.targets.firstSeconds > first.targets.firstSeconds);
  const ordinary = { id: 'calendar-note', body: { scheduleKind: 'fixed', date: upcoming } };
  assert.equal(engagementWindow(played, [ordinary], at).status, 'waiting');
  assert.equal(engagementWindow(null, [poll], at).status, 'no-played-session');
  assert.equal(engagementWindow(played, [candidate({ scheduleKind: 'fixed', date: '2099-01-01T19:00:00Z' })], at).status, 'unsupported');
});

test('summary only includes the owner, visible game dates and preparation days', async () => {
  const { db, sql } = setup();
  const insert = sql.prepare("INSERT INTO records(id,owner_id,kind,title,visibility,body,created_at,updated_at,campaign_id) VALUES(?,'gm','termine','Test',?,?,'t','t',?)");
  const appointment = date => JSON.stringify({ engagementGameNight: true, scheduleKind: 'fixed', date });
  insert.run('private', 'sl', appointment('2026-11-09T19:00:00Z'), campaignId);
  insert.run('foreign', 'group', appointment('2026-11-09T19:00:00Z'), 'foreign');
  insert.run('next', 'group', appointment('2026-11-10T19:00:00Z'), campaignId);
  const add = sql.prepare('INSERT INTO engagement_daily VALUES(?,?,?,?,?)');
  add.run(campaignId, 'player-a', '2026-11-07', 'codex', 20);
  add.run(campaignId, 'player-a', '2026-11-09', 'codex', 30);
  add.run(campaignId, 'player-a', '2026-11-10', 'notebook', 40);
  add.run(campaignId, 'player-b', '2026-11-09', 'story', 60);
  add.run('foreign', 'player-a', '2026-11-09', 'story', 60);
  const summary = await engagementSummary(db, scope, epoch);
  assert.equal(summary.window.status, 'confirmed');
  assert.equal(summary.window.appointmentId, 'next');
  assert.equal(summary.todaySeconds, 40);
  assert.equal(summary.weekSeconds, 90);
  assert.equal(summary.intervalSeconds, 30);
  assert.deepEqual(summary.categories, { codex: 30 });
  assert.equal(summary.progress.percent, 0);
});

test('unverified browser time cannot produce a reward plan and verified stages share the stable ledger source', () => {
  const confirmed = engagementWindow(played, [candidate({ scheduleKind: 'fixed', date: upcoming })], at);
  const evidence = { verifiedSeconds: 0, campaignId, characterId: 'char-a', actorId: 'system', appointmentId: confirmed.appointmentId, appointmentDate: confirmed.appointmentDate };
  assert.deepEqual(engagementRewardPlans(confirmed, { ...evidence, intervalId: confirmed.intervalId, measuredSeconds: 1e9 }), []);
  assert.deepEqual(engagementRewardPlans(confirmed, { ...evidence, intervalId: 'older-window', verifiedSeconds: 1e9 }), []);
  const plans = engagementRewardPlans(confirmed, { ...evidence, intervalId: confirmed.intervalId, verifiedSeconds: confirmed.targets.fullSeconds });
  assert.deepEqual(plans.map(plan => [plan.amount, plan.source.scopeId, plan.source.milestone]), [[1, 'played-1', 1], [1, 'played-1', 2]]);
  const preview = { ...confirmed, status: 'preview' };
  assert.deepEqual(engagementRewardPlans(preview, { ...evidence, intervalId: confirmed.intervalId, verifiedSeconds: 1e9 }), []);
});

test('independently verified test evidence books through the existing ledger once per stage', async () => {
  const { db, body } = setupRewardDb();
  const window = engagementWindow(played, [candidate({ scheduleKind: 'fixed', date: upcoming })], at);
  const evidence = {
    campaignId, characterId: 'char-a', actorId: 'gm', intervalId: window.intervalId,
    appointmentId: window.appointmentId, appointmentDate: window.appointmentDate,
    verifiedSeconds: window.targets.firstSeconds,
  };
  const [first] = engagementRewardPlans(window, evidence);
  const secondDate = '2026-04-08T17:00:00Z';
  const moved = engagementWindow(played, [candidate({ scheduleKind: 'fixed', date: secondDate })], at);
  assert.deepEqual(engagementRewardPlans(moved, { ...evidence, verifiedSeconds: 1e9 }), []);
  const firstWrites = await Promise.all(Array.from({ length: 5 }, () => bookCharacterXpReward(db, first)));
  assert.equal(firstWrites.filter(result => !result.duplicate).length, 1);
  assert.deepEqual(engagementRewardPlans(moved, { ...evidence, appointmentDate: secondDate }), []);
  const updatedPlans = engagementRewardPlans(moved, {
    ...evidence, appointmentDate: secondDate, verifiedSeconds: moved.targets.fullSeconds,
  });
  const updatedWrites = await Promise.all(updatedPlans.map(plan => bookCharacterXpReward(db, plan)));
  assert.deepEqual(updatedWrites.map(result => result.duplicate), [true, false]);
  assert.deepEqual(body('char-a').xpLedger.filter(entry => entry.source?.type === 'engagement').map(entry => entry.amount), [1, 1]);
});

test('browser state requires trusted activity and drops interrupted, idle and sleep intervals', () => {
  const state = new ActiveEngagement();
  assert.equal(state.due(0, 0), false);
  state.interact(0, false);
  assert.equal(state.due(0, 0), false);
  state.interact(0, true);
  assert.equal(state.due(0, 0), true);
  state.sent(0, 0);
  assert.equal(state.due(29_000, 29_000), false);
  assert.equal(state.due(30_000, 30_000), true);
  state.sent(30_000, 30_000);
  assert.equal(state.due(60_000, 90_000), false);
  assert.equal(state.due(90_000, 120_000), false);
  state.interact(90_000, true);
  assert.equal(state.due(90_000, 120_000), true);
  state.sent(90_000, 120_000);
  assert.equal(state.due(210_000, 240_000), false);
  state.interact(211_000, true);
  state.pause();
  assert.equal(state.due(241_000, 271_000), false);
});

test('the current tab can restart for a new section without backfilling the interrupted interval', async () => {
  const { db, rows } = setup();
  const first = await recordEngagementPulse(db, scope, { category }, epoch);
  const restart = { category: 'notebook', ticket: first.ticket, restart: true };
  const restarted = await recordEngagementPulse(db, scope, restart, epoch + 10_000);
  assert.ok(restarted.ticket);
  assert.equal(restarted.seconds, 0);
  assert.equal((await recordEngagementPulse(db, scope, { category, ticket: first.ticket }, epoch + 30_000)).seconds, 0);
  assert.equal((await recordEngagementPulse(db, scope, restart, epoch + 30_000)).ticket, null);
  assert.equal((await recordEngagementPulse(db, scope, { category: restart.category, ticket: restarted.ticket }, epoch + 40_000)).seconds, 30);
  assert.deepEqual(rows('engagement_daily').map(row => [row.category, row.seconds]), [['notebook', 30]]);
});
