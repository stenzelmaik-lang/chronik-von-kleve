import test from 'node:test';
import assert from 'node:assert/strict';
import { setupRewardDb, campaignId, now } from './fixtures/xp-reward-db.mjs';
import { registerPlayedSession, playedSession } from '../server/played-sessions.ts';
import { XpRewardServiceError } from '../server/xp-reward-service.ts';

const status = expected => error => error instanceof XpRewardServiceError && error.status === expected;
const register = (extra = {}) => ({ campaignId, actorId: 'gm', sessionRecordId: 'sitzung-neu', playedOn: '2026-11-08', now, ...extra });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('Registering a played evening creates a durable ID of its own and leaves the session record untouched', async () => {
  const { sql, db, rows } = setupRewardDb();
  const before = sql.prepare("SELECT * FROM records WHERE id='sitzung-neu'").get();
  const result = await registerPlayedSession(db, register());
  assert.equal(result.created, true);
  assert.match(result.session.id, uuid);
  assert.notEqual(result.session.id, 'sitzung-neu');
  assert.deepEqual({ ...result.session, id: 0 }, { id: 0, campaignId, sessionRecordId: 'sitzung-neu', appointmentId: null, playedOn: '2026-11-08', title: 'Titel sitzung-neu', registeredBy: 'gm', registeredAt: now });
  assert.deepEqual(sql.prepare("SELECT * FROM records WHERE id='sitzung-neu'").get(), before);
  assert.equal(rows('played_sessions', "session_record_id='sitzung-neu'").length, 1);
  assert.deepEqual(await playedSession(db, campaignId, result.session.id), result.session);
});

test('A reused session record yields a separate ID for every evening', async () => {
  const { db } = setupRewardDb();
  const first = await registerPlayedSession(db, register()), second = await registerPlayedSession(db, register({ playedOn: '2026-11-09' }));
  assert.deepEqual([first.created, second.created], [true, true]);
  assert.notEqual(first.session.id, second.session.id);
  assert.equal(first.session.sessionRecordId, second.session.sessionRecordId);
});

test('Registering the same evening again, also in parallel, returns the one existing ID', async () => {
  const { db, rows } = setupRewardDb();
  const results = await Promise.all(Array.from({ length: 6 }, () => registerPlayedSession(db, register({ actorId: 'gm' }))));
  assert.equal(new Set(results.map(r => r.session.id)).size, 1);
  assert.equal(results.filter(r => r.created).length, 1);
  const again = await registerPlayedSession(db, register({ actorId: 'gm2', now: '2026-11-12T08:00:00.000Z' }));
  assert.deepEqual([again.created, again.session.id, again.session.registeredBy, again.session.registeredAt], [false, results[0].session.id, 'gm', now]);
  assert.equal(rows('played_sessions', "session_record_id='sitzung-neu'").length, 1);
});

test('Only a closed session record of the same campaign can be registered; a calendar entry cannot', async () => {
  const { db, rows } = setupRewardDb();
  for (const sessionRecordId of ['sitzung-fremd', 'unbekannt', 'termin-1', 'notiz-1', 'char-a']) await assert.rejects(registerPlayedSession(db, register({ sessionRecordId })), status(404));
  for (const sessionRecordId of ['sitzung-laeuft', 'sitzung-bereit']) await assert.rejects(registerPlayedSession(db, register({ sessionRecordId })), status(409));
  for (const patch of [{ sessionRecordId: 'a:b' }, { sessionRecordId: undefined }, { playedOn: '08.11.2026' }, { playedOn: '2026-02-30' }, { playedOn: '2026-11-12' }, { playedOn: undefined }, { appointmentId: 'a:b' }, { appointmentId: 7 }])
    await assert.rejects(registerPlayedSession(db, register(patch)), status(400), JSON.stringify(patch));
  assert.equal(rows('played_sessions').length, 3);
});

test('The optional calendar link is validated and unique per evening', async () => {
  const { db } = setupRewardDb();
  for (const appointmentId of ['termin-fremd', 'unbekannt', 'sitzung-1']) await assert.rejects(registerPlayedSession(db, register({ appointmentId })), status(404));
  await assert.rejects(registerPlayedSession(db, register({ appointmentId: 'termin-offen' })), status(409));
  await assert.rejects(registerPlayedSession(db, register({ appointmentId: 'termin-1' })), status(409), 'termin-1 already belongs to abend-2');
  const linked = await registerPlayedSession(db, register({ appointmentId: 'termin-2' }));
  assert.equal(linked.session.appointmentId, 'termin-2');
  await assert.rejects(registerPlayedSession(db, register({ appointmentId: 'termin-1' })), status(409), 'an existing evening is not silently relinked');
  assert.equal((await registerPlayedSession(db, register({ appointmentId: 'termin-2' }))).created, false);
});

test('A played evening is read only within its own campaign', async () => {
  const { db } = setupRewardDb();
  assert.equal((await playedSession(db, campaignId, 'abend-2')).appointmentId, 'termin-1');
  for (const id of ['abend-fremd', 'sitzung-1', 'termin-1', 'unbekannt']) await assert.rejects(playedSession(db, campaignId, id), status(404));
  for (const id of ['a:b', '', undefined, 7]) await assert.rejects(playedSession(db, campaignId, id), status(400));
});

test('A registered evening survives a later status change or deletion of the session record and cannot be rewritten', async () => {
  const { sql, db } = setupRewardDb();
  const { session } = await registerPlayedSession(db, register());
  sql.prepare("UPDATE records SET body=json_set(body,'$.status','Läuft'),version=version+1 WHERE id='sitzung-neu'").run();
  assert.deepEqual(await playedSession(db, campaignId, session.id), session);
  sql.prepare("DELETE FROM records WHERE id='sitzung-neu'").run();
  assert.deepEqual(await playedSession(db, campaignId, session.id), session);
  for (const change of ["played_on='2026-01-01'", "session_record_id='sitzung-1'", "campaign_id='andere-chronik'", "title='Anders'", "registered_by='x'", "appointment_id='termin-2'"])
    assert.throws(() => sql.prepare(`UPDATE played_sessions SET ${change} WHERE id=?`).run(session.id), /unveränderlich/);
});

test('Modern command-center preparation marked completed can register a played evening', async () => {
  const { sql, db } = setupRewardDb();
  // Existing new preparation writes the status under sl_preparation.document,
  // not as the older body.status = "Abgeschlossen".
  sql.prepare("UPDATE records SET body=? WHERE id='sitzung-laeuft'")
    .run(JSON.stringify({sl_preparation:{document:{title:'Neuer Abend',status:'completed'}}}));
  const done = await registerPlayedSession(db, register({sessionRecordId:'sitzung-laeuft'}));
  assert.equal(done.created, true);
  assert.equal(done.session.sessionRecordId, 'sitzung-laeuft');
  sql.prepare("UPDATE records SET body=? WHERE id='sitzung-bereit'")
    .run(JSON.stringify({sl_preparation:{document:{title:'Noch offen',status:'active'}}}));
  await assert.rejects(registerPlayedSession(db, register({sessionRecordId:'sitzung-bereit'})), status(409));
});
