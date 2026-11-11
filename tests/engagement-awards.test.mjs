import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { setupRewardDb, campaignId } from './fixtures/xp-reward-db.mjs';
import { recordEngagementPulse, engagementSummary } from '../server/engagement-activity.ts';
import { saveNotebookWithEngagement, reconcileEngagement } from '../server/engagement-awards.ts';

const now = Date.parse('2026-11-10T12:00:00Z');
const day = '2026-11-10';
const scope = { campaignId, memberId: 'player-a' };
const content = 'Die Gruppe untersucht die alten Tunnel vor dem nächsten Spielabend und dokumentiert ihre Spuren.';
function setup() {
  const f = setupRewardDb({ latestPlayedOn: '2026-10-28' });
  f.sql.exec(`CREATE TABLE campaigns(id TEXT PRIMARY KEY); CREATE TABLE members(id TEXT PRIMARY KEY,campaign_id TEXT,status TEXT);
    CREATE TABLE auth_member_links(auth_user_id TEXT PRIMARY KEY, member_id TEXT UNIQUE);
    CREATE TABLE auth_profiles(user_id TEXT PRIMARY KEY, preferences TEXT);
    CREATE TABLE campaign_memberships(campaign_id TEXT,user_id TEXT,status TEXT,role TEXT);
    INSERT INTO campaigns VALUES ('chronik-von-kleve'),('foreign');
    INSERT INTO members VALUES ('player-a','chronik-von-kleve','active'),('player-b','chronik-von-kleve','active');
    INSERT INTO campaign_memberships VALUES ('chronik-von-kleve','player-a','active','player'),('chronik-von-kleve','player-b','active','player');
    INSERT INTO records(id,owner_id,kind,visibility,title,body,created_at,updated_at,campaign_id)
    VALUES('confirmed-date','gm','termine','group','Spielabend','{"scheduleKind":"fixed","date":"2026-11-17T18:00:00Z","engagementGameNight":true}','t','t','chronik-von-kleve');`);
  for (const migration of ['0014_alpha2_engagement_activity', '0015_alpha2_engagement_awards']) {
    f.sql.exec(readFileSync('drizzle/' + migration + '.sql', 'utf8'));
  }
  return f;
}

function note(db, id, characterId = 'char-a', text = content) {
  return db.prepare("INSERT INTO records(id,owner_id,kind,visibility,title,body,created_at,updated_at,campaign_id) VALUES(?,'player-a','notizen','private','Notiz',?,'t','t',?)")
    .bind(id, JSON.stringify({ characterId, text }), campaignId);
}

async function measured(db, timestamp = now, category = 'notebook') {
  const started = await recordEngagementPulse(db, scope, { category }, timestamp - 60_000);
  const first = await recordEngagementPulse(db, scope, { category, ticket: started.ticket }, timestamp - 30_000);
  return (await recordEngagementPulse(db, scope, { category, ticket: first.ticket }, timestamp)).ticket;
}

test('fake pulses earn zero EP and saved evidence consumes only fresh notebook time', async () => {
  const { db, rows, body } = setup();
  const ticket = await measured(db);
  await reconcileEngagement(db, scope, now);
  assert.equal(body('char-a').xpLedger.length, 1);
  const summary = await engagementSummary(db, scope, now);
  assert.equal(summary.todaySeconds, 60);
  assert.equal(summary.verifiedSeconds, 0);
  await saveNotebookWithEngagement(db, scope, note(db, 'note-a'), { id: 'note-a', characterId: 'char-a', previousText: '', text: content, ticket }, now);
  assert.equal(rows('engagement_verified_notes')[0].seconds, 60);
  await saveNotebookWithEngagement(db, scope, note(db, 'note-b'), { id: 'note-b', characterId: 'char-a', previousText: '', text: content, ticket }, now);
  assert.equal(rows('engagement_verified_notes').length, 1);
  assert.equal(body('char-a').xpLedger.length, 1);
});

test('invalid notes, wrong scope, stale tickets and conflicting character choices cannot create evidence', async () => {
  const { db, sql, rows } = setup();
  const ticket = await measured(db);
  const evidence = { id: 'note-a', characterId: 'char-a', previousText: '', text: content, ticket };
  const noSave = db.prepare("UPDATE records SET title='ignored' WHERE id='missing'");
  await saveNotebookWithEngagement(db, scope, noSave, evidence, now);
  await saveNotebookWithEngagement(db, scope, note(db, 'note-empty', 'char-a', '     '), { ...evidence, id: 'note-empty', text: '     ' }, now);
  await saveNotebookWithEngagement(db, scope, note(db, 'note-expired'), { ...evidence, id: 'note-expired' }, now + 60_000);
  await saveNotebookWithEngagement(db, scope, note(db, 'note-draft', 'char-draft'), { ...evidence, id: 'note-draft', characterId: 'char-draft' }, now);
  await saveNotebookWithEngagement(db, { ...scope, memberId: 'player-b' }, note(db, 'note-other'), { ...evidence, id: 'note-other' }, now);
  assert.equal(rows('engagement_verified_notes').length, 0);
  await saveNotebookWithEngagement(db, scope, note(db, 'note-a'), evidence, now);
  const continued = await recordEngagementPulse(db, scope, { category: 'notebook', ticket }, now + 30_000);
  await saveNotebookWithEngagement(db, scope, note(db, 'note-b', 'char-b'), { ...evidence, id: 'note-b', characterId: 'char-b', ticket: continued.ticket }, now + 30_000);
  assert.equal(rows('engagement_verified_notes').length, 1);
  assert.equal(sql.prepare('SELECT character_id FROM engagement_recipients').get().character_id, 'char-a');
});

test('a confirmed window awards both milestones once and leaves prior entries after rescheduling', async () => {
  const { db, sql, body } = setup();
  const ticket = await measured(db);
  await saveNotebookWithEngagement(db, scope, note(db, 'note-a'), { id: 'note-a', characterId: 'char-a', previousText: '', text: content, ticket }, now);
  const target = (await engagementSummary(db, scope, now)).window.targets;
  const insert = sql.prepare('INSERT INTO engagement_verified_notes(campaign_id,member_id,interval_id,day,note_id,seconds) VALUES(?,?,?,?,?,?)');
  const enough = (seconds, prefix) => {
    for (let d = 29; d <= 41; d++) for (let index = 0; seconds > 0 && index < 8; index++) {
      const date = new Date(Date.UTC(2026, 9, d)).toISOString().slice(0, 10);
      const remaining = 7200 - sql.prepare('SELECT COALESCE(SUM(seconds),0) AS total FROM engagement_verified_notes WHERE day=?').get(date).total;
      const portion = Math.min(900, seconds, remaining);
      if (portion === 0) break;
      insert.run(campaignId, scope.memberId, 'abend-1', date, prefix + d + '-' + index, portion);
      seconds -= portion;
    }
    assert.equal(seconds, 0);
  };
  enough(target.firstSeconds - 60, 'stage1');
  let movedDuringWrite = false;
  const racing = { ...db, batch: async statements => {
    if (!movedDuringWrite) {
      movedDuringWrite = true;
      sql.exec("UPDATE records SET body=json_set(body,'$.date','2026-12-20T18:00:00Z'),version=version+1 WHERE id='confirmed-date'");
    }
    return db.batch(statements);
  } };
  await assert.rejects(reconcileEngagement(racing, scope, now), error => error.status === 409);
  assert.equal(body('char-a').xpLedger.length, 1);
  await reconcileEngagement(db, scope, now);
  assert.equal(body('char-a').xpLedger.length, 1);
  sql.exec("UPDATE records SET body=json_set(body,'$.date','2026-11-17T18:00:00Z'),version=version+1 WHERE id='confirmed-date'");
  await Promise.all(Array.from({ length: 5 }, () => reconcileEngagement(db, scope, now)));
  assert.deepEqual(body('char-a').xpLedger.slice(1).map(e => e.source.milestone), [1]);
  enough(target.fullSeconds - target.firstSeconds, 'stage2');
  await Promise.all(Array.from({ length: 5 }, () => reconcileEngagement(db, scope, now)));
  assert.deepEqual(body('char-a').xpLedger.slice(1).map(e => [e.source.milestone, e.amount]), [[1, 1], [2, 1]]);
  sql.exec("UPDATE records SET body=json_set(body,'$.date','2026-12-20T18:00:00Z'),version=version+1 WHERE id='confirmed-date'");
  await reconcileEngagement(db, scope, now);
  assert.equal(body('char-a').xpLedger.length, 3);
  assert.equal(body('char-b').xpLedger.length, 1);
});

test('autosaves accumulate only new growth after the last claim and respect the daily limit', async () => {
  const { db, sql, rows } = setup();
  const ticket = await measured(db);
  const save = (text, previousText, activeTicket, timestamp) => {
    const mutation = db.prepare("UPDATE records SET body=json_set(body,'$.text',?),version=version+1 WHERE id='notes'").bind(text);
    return saveNotebookWithEngagement(db, scope, mutation, { id: 'notes', characterId: 'char-a', previousText, text, ticket: activeTicket }, timestamp);
  };
  await note(db, 'notes').run();
  await save(content + 'a', content, ticket, now);
  const pulse = await recordEngagementPulse(db, scope, { category: 'notebook', ticket }, now + 30_000);
  const shorterGrowth = content + 'abc';
  await save(shorterGrowth, content + 'a', pulse.ticket, now + 30_000);
  assert.equal(rows('engagement_verified_notes')[0].seconds, 60);
  const add = sql.prepare('INSERT INTO engagement_verified_notes(campaign_id,member_id,interval_id,day,note_id,seconds) VALUES(?,?,?,?,?,?)');
  for (let i = 0; i < 8; i++) add.run(campaignId, scope.memberId, 'abend-1', day, 'cap-' + i, i === 7 ? 830 : 900);
  await save(shorterGrowth + content, shorterGrowth, pulse.ticket, now + 30_000);
  assert.equal(rows('engagement_verified_notes', "note_id='notes'")[0].seconds, 70);
});

test('daily pruning removes expired evidence for inactive members and retains current sums and bindings', async () => {
  const { db, sql } = setup();
  const { pruneEngagement } = await import('../server/engagement-retention.ts');
  sql.exec(`INSERT INTO engagement_daily VALUES('chronik-von-kleve','player-b','2025-11-01','notebook',30),
    ('chronik-von-kleve','player-a','2026-11-10','notebook',30);
    INSERT INTO engagement_verified_notes(campaign_id,member_id,interval_id,day,note_id,seconds) VALUES
    ('chronik-von-kleve','player-b','abend-1','2025-11-01','expired',30),
    ('chronik-von-kleve','player-a','abend-1','2026-11-10','current',30);
    INSERT INTO engagement_recipients VALUES('chronik-von-kleve','player-b','abend-1','char-b');`);
  await measured(db, now - 172_800_000);
  assert.deepEqual(await pruneEngagement(db, now), [1, 1, 1]);
  assert.equal(sql.prepare('SELECT count(*) n FROM engagement_recipients').get().n, 1);
  assert.deepEqual(await pruneEngagement(db, now), [0, 0, 0]);
});
