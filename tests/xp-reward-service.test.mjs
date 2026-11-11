import test from 'node:test';
import assert from 'node:assert/strict';
import { setupRewardDb, campaignId, now } from './fixtures/xp-reward-db.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { bookCharacterXpReward, bookSessionXpReward, XpRewardServiceError } from '../server/xp-reward-service.ts';
import { appendCharacterXp } from '../domain/character-management.ts';
import { xpBalance } from '../domain/character-engine.ts';

const status = expected => error => error instanceof XpRewardServiceError && error.status === expected;
const setup = setupRewardDb;
const reward = (extra = {}) => ({ campaignId, characterId: 'char-a', actorId: 'gm', type: 'session', sessionId: 'abend-1', amount: 4, reason: 'Sitzungsabrechnung', now, ...extra });

test('A valid session reward lands once in the existing ledger with an audit event', async () => {
  const { db, body, version, events } = setup();
  const result = await bookSessionXpReward(db, reward());
  assert.equal(result.duplicate, false);
  assert.equal(result.entry.id, 'reward:session:chronik-von-kleve:abend-1');
  assert.equal(result.row.version, 2);
  assert.equal(version('char-a'), 2);
  assert.equal(xpBalance(body('char-a')), 13);
  assert.equal(body('char-a').xpLedger[0].id, 'opening');
  const [event] = events();
  assert.equal(event.type, 'character.xp_reward');
  assert.equal(event.entity_id, 'char-a');
  assert.equal(event.actor_id, 'gm');
  const payload = JSON.parse(event.payload);
  assert.equal(payload.entryId, result.entry.id);
  assert.equal(payload.amount, 4);
  assert.deepEqual(payload.source, { type: 'session', campaignId, scopeId: 'abend-1' });
  assert.deepEqual([payload.previousVersion, payload.version], [1, 2]);
});

test('Repeating the same request does not credit, write or audit again', async () => {
  const { db, body, version, events } = setup();
  await bookSessionXpReward(db, reward());
  for (let i = 0; i < 5; i++) assert.equal((await bookSessionXpReward(db, reward())).duplicate, true);
  assert.equal(xpBalance(body('char-a')), 13);
  assert.equal(version('char-a'), 2);
  assert.equal(events().length, 1);
});

test('A repeat with a different amount is a conflict and changes nothing', async () => {
  const { db, body, version } = setup();
  await bookSessionXpReward(db, reward());
  await assert.rejects(bookSessionXpReward(db, reward({ amount: 5 })), status(409));
  assert.equal(xpBalance(body('char-a')), 13);
  assert.equal(version('char-a'), 2);
});

test('Ten parallel requests for the same reward credit exactly once', async () => {
  const { db, body, events } = setup();
  const results = await Promise.all(Array.from({ length: 10 }, () => bookSessionXpReward(db, reward())));
  assert.equal(results.filter(r => !r.duplicate).length, 1);
  assert.equal(xpBalance(body('char-a')), 13);
  assert.equal(body('char-a').xpLedger.length, 2);
  assert.equal(events().length, 1);
});

test('Parallel different sources all arrive despite version conflicts, each exactly once', async () => {
  const { db, body, version, events } = setup();
  const requests = [reward(), reward({ type: 'story', storyId: 'bogen-1', amount: 3 }), reward({ type: 'mvp', amount: 2 }), reward({ sessionId: 'abend-2', amount: 2 }), reward(), reward({ type: 'mvp', amount: 2 })];
  const results = await Promise.all(requests.map(r => bookSessionXpReward(db, r)));
  assert.equal(results.filter(r => !r.duplicate).length, 4);
  assert.equal(xpBalance(body('char-a')), 9 + 4 + 3 + 2 + 2);
  assert.equal(version('char-a'), 5);
  assert.equal(events().length, 4);
  assert.equal(new Set(body('char-a').xpLedger.map(e => e.id)).size, 5);
});

test('A concurrent foreign change between read and write is retried without losing either change', async () => {
  const { sql, db, body } = setup();
  let interfered = false;
  const racing = { ...db, batch: async list => { if (!interfered) { interfered = true; sql.prepare("UPDATE records SET body=json_set(body,'$.concept','Neu'),version=version+1 WHERE id='char-a'").run(); } return db.batch(list); } };
  const result = await bookSessionXpReward(racing, reward());
  assert.equal(result.duplicate, false);
  assert.equal(result.row.version, 3);
  assert.equal(body('char-a').concept, 'Neu');
  assert.equal(xpBalance(body('char-a')), 13);
});

test('A reversed reward is not recreated by a repeat', async () => {
  const { sql, db, body, events } = setup();
  const booked = await bookSessionXpReward(db, reward());
  const reversed = appendCharacterXp(body('char-a'), { id: 'storno', kind: 'correction', amount: -4, referenceId: booked.entry.id, reason: 'Falsche Sitzung', createdAt: now });
  sql.prepare("UPDATE records SET body=?,version=version+1 WHERE id='char-a'").run(JSON.stringify(reversed));
  const replay = await bookSessionXpReward(db, reward());
  assert.deepEqual([replay.duplicate, replay.reversed], [true, true]);
  assert.equal(xpBalance(body('char-a')), 9);
  assert.equal(body('char-a').xpLedger.length, 3);
  assert.equal(events().length, 1);
  await assert.rejects(bookSessionXpReward(db, reward({ amount: 2 })), status(409));
});

test('Amount limits are enforced on the server per source', async () => {
  const { db, body } = setup();
  for (const patch of [{ amount: 6 }, { amount: 0 }, { amount: -3 }, { amount: 1.5 }, { amount: '3' }, { type: 'story', storyId: 'bogen-1', amount: 4 }, { type: 'mvp', amount: 3 }, { reason: 'x' }])
    await assert.rejects(bookSessionXpReward(db, reward(patch)), status(400));
  assert.equal(xpBalance(body('char-a')), 9);
});

test('The session must be a registered played evening of the same campaign; neither a session record nor a calendar entry is proof', async () => {
  const { db, body } = setup();
  for (const sessionId of ['abend-fremd', 'unbekannt', 'notiz-1', 'char-a', 'termin-1', 'sitzung-1', 'sitzung-laeuft']) await assert.rejects(bookSessionXpReward(db, reward({ sessionId })), status(404));
  for (const sessionId of ['a:b', '', 'x'.repeat(101), undefined, 7]) await assert.rejects(bookSessionXpReward(db, reward({ sessionId })), status(400));
  assert.equal((await bookSessionXpReward(db, reward({ sessionId: 'abend-2', amount: 2 }))).entry.id, 'reward:session:chronik-von-kleve:abend-2');
  assert.equal(xpBalance(body('char-a')), 11);
});

test('Two evenings from the same reused session record are rewarded independently', async () => {
  const { db, body } = setup();
  const first = await bookSessionXpReward(db, reward({ sessionId: 'abend-1', amount: 3 })), second = await bookSessionXpReward(db, reward({ sessionId: 'abend-2', amount: 2 }));
  assert.deepEqual([first.duplicate, second.duplicate], [false, false]);
  assert.notEqual(first.entry.id, second.entry.id);
  assert.equal(xpBalance(body('char-a')), 14);
});

test('Story rewards are identified by their own story arc, not by the evening', async () => {
  const { db, body } = setup();
  const story = (storyId, extra = {}) => reward({ type: 'story', storyId, amount: 2, ...extra });
  assert.equal((await bookSessionXpReward(db, story('bogen-1'))).entry.id, 'reward:story:chronik-von-kleve:bogen-1');
  assert.equal((await bookSessionXpReward(db, story('bogen-2'))).duplicate, false);
  assert.equal((await bookSessionXpReward(db, story('bogen-1', { sessionId: 'abend-2' }))).duplicate, true);
  assert.equal(xpBalance(body('char-a')), 13);
  for (const storyId of ['bogen-fremd', 'npc-1', 'unbekannt', 'abend-1']) await assert.rejects(bookSessionXpReward(db, story(storyId)), status(404));
  for (const storyId of [undefined, '', 'a:b']) await assert.rejects(bookSessionXpReward(db, story(storyId)), status(400));
  await assert.rejects(bookSessionXpReward(db, reward({ storyId: 'bogen-1' })), status(400));
});

test('Only a confirmed, active engine character of the same campaign is credited', async () => {
  const { db, version } = setup();
  for (const characterId of ['char-foreign', 'char-secret', 'char-entity-secret', 'unbekannt', 'abend-1']) await assert.rejects(bookSessionXpReward(db, reward({ characterId })), status(404));
  for (const characterId of ['char-draft', 'char-legacy', 'char-archived']) { await assert.rejects(bookSessionXpReward(db, reward({ characterId })), status(409)); assert.equal(version(characterId), 1); }
  await assert.rejects(bookSessionXpReward(db, reward({ campaignId: 'andere-chronik' })), status(404));
});

test('The session path refuses engagement and unknown sources; a client cannot choose a booking ID', async () => {
  const { db, body } = setup();
  for (const type of ['engagement', 'grant', undefined]) await assert.rejects(bookSessionXpReward(db, reward({ type, amount: 1 })), status(400));
  const result = await bookSessionXpReward(db, { ...reward(), id: 'forged', entryId: 'forged', operationId: 'forged', milestone: 1 });
  assert.equal(result.entry.id, 'reward:session:chronik-von-kleve:abend-1');
  assert.equal(result.entry.source.milestone, undefined);
  assert.equal(body('char-a').xpLedger.length, 2);
});

test('The internal service books an engagement milestone exactly once, without any session', async () => {
  const { db, body, events } = setup();
  const input = { campaignId, characterId: 'char-a', actorId: 'system:engagement', source: { type: 'engagement', campaignId, scopeId: 'intervall-7', milestone: 1 }, amount: 1, reason: 'Engagement-Ziel 1 erreicht', now };
  const results = await Promise.all([bookCharacterXpReward(db, input), bookCharacterXpReward(db, input), bookCharacterXpReward(db, input)]);
  assert.equal(results.filter(r => !r.duplicate).length, 1);
  assert.equal(xpBalance(body('char-a')), 10);
  assert.equal(events()[0].actor_id, 'system:engagement');
  await assert.rejects(bookCharacterXpReward(db, { ...input, source: { ...input.source, campaignId: 'andere-chronik' } }), status(400));
});

test('No HTTP route exposes the internal booking service or an engagement source', () => {
  const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []);
  for (const file of files('app')) assert.equal(/\bbookCharacterXpReward\b/.test(readFileSync(file, 'utf8')), false, file + ' must not call the internal booking service');
  const route = readFileSync('app/api/character-engine/route.ts', 'utf8');
  const schema = route.split('\n').find(line => line.includes('z.literal("xp_reward")'));
  assert.ok(schema, 'xp_reward action exists');
  assert.match(route, /const rewardType = z\.enum\(\["session", ?"story", ?"mvp", ?"sl_exception"\]\);/);
  assert.equal(/engagement/.test(route), false, 'the route knows no engagement source');
  assert.equal(/operationId|version|entryId/.test(schema), false);
  assert.match(schema, /type: rewardType/);
  assert.match(schema, /storyId/);
  const batch = route.split('\n').find(line => line.includes('z.literal("xp_settlement")'));
  assert.ok(batch, 'xp_settlement action exists');
  assert.equal(/operationId|version|entryId|base/.test(batch), false);
  assert.match(route, /d\.action === "xp_settlement"\) \{\s*gmOnly\(a\);/);
  assert.match(route, /d\.action === "xp_reward"\) \{\s*gmOnly\(a\);/);
  assert.match(route, /z\.literal\("xp_grant"\), operationId:operationId\.optional\(\), amount: z\.number\(\)\.int\(\)\.min\(1\)\.max\(1000\), reason/);
});

test('modern private plot dossiers are allowed as story rewards, other private Chronicle entries are not', async () => {
  const { db, sql } = setupRewardDb();
  const { storyRewardOptions, storyArc } = await import('../server/xp-reward-service.ts');
  sql.exec(`INSERT INTO entities(id,campaign_id,type,canon_status,content,title) VALUES
    ('plot-native','chronik-von-kleve','CHRONICLE','GM_SECRET','{"documentKind":"plot_dossier"}','Dossier'),
    ('chronicle-note','chronik-von-kleve','CHRONICLE','GM_SECRET','{}','Private Chronik');`);
  await storyArc(db, campaignId, 'plot-native');
  assert.ok((await storyRewardOptions(db, campaignId)).some(story => story.id === 'plot-native'));
  await assert.rejects(storyArc(db, campaignId, 'chronicle-note'), error => error.status === 404);
});
