import { berlinDay, shiftDay } from '../domain/engagement-window.ts';

export async function engagementIntegration({ req, check, localSql }) {
  const endpoint = '/api/engagement';
  const pulse = { category: 'codex' };
  check((await req(endpoint)).s === 401, 'Engagement denies anonymous reads');
  check((await req(endpoint, 'otherCampaign', 'POST', pulse)).s === 403, 'Engagement denies a different campaign member');
  check((await req(endpoint, 'a', 'POST', pulse, { Origin: 'https://foreign.invalid' })).s === 403, 'Engagement denies cross-origin writes');
  for (const extra of [{ seconds: 40000 }, { memberId: 'sprint1-b' }, { action: 'book' }, { clientTime: Date.now() }, { restart: true }]) {
    check((await req(endpoint, 'a', 'POST', { ...pulse, ...extra })).s === 400, 'Engagement rejects extra untrusted fields');
  }

  const starts = await Promise.all(Array.from({ length: 4 }, () => req(endpoint, 'a', 'POST', pulse)));
  const accepted = starts.filter(result => result.s === 200 && result.d.ticket);
  check(accepted.length === 1 && accepted[0].d.seconds === 0, 'D1 accepts exactly one initial engagement ticket');
  const continuation = { ...pulse, ticket: accepted[0].d.ticket };
  check((await req(endpoint, 'a', 'POST', continuation)).d.seconds === 0, 'Early engagement pulse credits zero seconds');

  // Age only the synthetic lease, using SQLite's own clock when the fixture is written.
  localSql("UPDATE engagement_leases SET received_at=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)-27000 WHERE member_id='sprint1-a'");
  check((await req(endpoint, 'b', 'POST', continuation)).d.seconds === 0, 'Another account cannot continue a ticket');
  const results = await Promise.all(Array.from({ length: 4 }, () => req(endpoint, 'a', 'POST', continuation)));
  const grants = results.filter(result => result.s === 200 && result.d.seconds > 0);
  check(grants.length === 1 && grants[0].d.seconds <= 30, 'D1 transaction counts a concurrent replay exactly once');
  check((await req(endpoint, 'a')).d.todaySeconds === grants[0].d.seconds, 'Own summary reflects the single pulse');
  check((await req(endpoint + '?memberId=sprint1-a', 'b')).d.todaySeconds === 0, 'Query parameters cannot select another activity owner');
  check((await req(endpoint + '?memberId=sprint1-a', 'gm')).d.todaySeconds === 0, 'GM player view has no access to another activity owner');

  const save = { action: 'save', title: 'SYNTHETIC engagement game night', scheduleKind: 'fixed', date: '2036-10-14T19:00:00Z' };
  const group = await req('/api/appointments', 'gm', 'POST', { ...save, visibility: 'group' });
  const secret = await req('/api/appointments', 'gm', 'POST', { ...save, visibility: 'sl' });
  check(group.s === 200 && secret.s === 200, 'Engagement fixture appointments created');
  const mark = { action: 'engagement-game-night', id: group.d.id, version: 1, marked: true };
  check((await req('/api/appointments', 'a', 'POST', mark)).s === 403, 'Players cannot mark game nights');
  check((await req('/api/appointments', 'gm', 'POST', { ...mark, id: secret.d.id })).s === 404, 'Private appointments cannot drive player targets');
  check((await req('/api/appointments', 'gm', 'POST', mark)).s === 200, 'GM can mark an existing group appointment as a game night');
  check((await req('/api/appointments', 'gm', 'POST', mark)).s === 409, 'Marking a game night honors appointment version checks');
  const records = (await req('/api/appointments', 'a')).d.records;
  const marked = records.find(record => record.id === group.d.id);
  check(marked.body.engagementGameNight === true && marked.body.date === save.date, 'Game-night mark preserves the existing appointment date');
  check((await req('/api/appointments', 'gm', 'POST', { ...mark, version: 2, marked: false })).s === 200, 'Unmarking a date removes it from time targets');

  localSql("INSERT INTO played_sessions(id,campaign_id,session_record_id,played_on,title,registered_by,registered_at) VALUES('engagement-played','chronik-von-kleve','engagement-session',date('now','-12 days'),'SYNTHETIC game night','sprint1-gm',datetime('now'))");
  const options = [14, 30].map(days => ({ id: 'option-' + days, date: new Date(Date.now() + days * 86_400_000).toISOString() }));
  const poll = await req('/api/appointments', 'gm', 'POST', {
    action: 'save', title: 'SYNTHETIC engagement poll', visibility: 'group', scheduleKind: 'poll', options,
  });
  check(poll.s === 200, 'Engagement poll fixture created');
  check((await req('/api/appointments', 'gm', 'POST', { ...mark, id: poll.d.id })).s === 200, 'GM can mark an open group poll');
  const preview = (await req(endpoint, 'a')).d.window;
  check(preview.status === 'preview' && preview.intervalId === 'engagement-played', 'Open poll previews the goal after the last actual game night');
  check((await req('/api/appointments', 'gm', 'POST', {
    action: 'finalize', id: poll.d.id, version: 2, optionId: 'option-30',
  })).s === 200, 'The existing finalization flow confirms a marked game night');
  const confirmed = (await req(endpoint, 'a')).d.window;
  check(confirmed.status === 'confirmed' && confirmed.intervalId === preview.intervalId && confirmed.targets.firstSeconds > preview.targets.firstSeconds,
    'Confirmation recalculates targets against the same played interval');

  const character = 'engagement-test-character';
  localSql(`INSERT INTO records(id,owner_id,campaign_id,kind,visibility,title,body,created_at,updated_at) VALUES('${character}','sprint1-a','chronik-von-kleve','charaktere','private','SYNTHETIC engagement character','{"engineVersion":1,"characterState":"confirmed","xpLedger":[]}',datetime('now'),datetime('now'))`);
  const awarded = () => localSql(`SELECT json_array_length(json_extract(body,'$.xpLedger')) AS n FROM records WHERE id='${character}'`, true)[0].n;
  const ageTicket = seconds => localSql(`UPDATE engagement_leases SET received_at=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)-${seconds * 1000} WHERE member_id='sprint1-a'`);
  ageTicket(60);
  const notebook = { category: 'notebook' };
  const start = await req(endpoint, 'a', 'POST', notebook);
  check(start.s === 200 && !!start.d.ticket, 'Notebook measurement starts with a fresh ticket');
  ageTicket(27);
  const measured = await req(endpoint, 'a', 'POST', { ...notebook, ticket: start.d.ticket });
  check(measured.d.seconds >= 25 && awarded() === 0, 'Notebook pulses alone book no EP');
  const saveNote = { action: 'save', title: 'SYNTHETIC preparation', text: 'Die Gruppe untersucht die alten Tunnel vor dem nächsten Spielabend und dokumentiert ihre Spuren.',
    date: berlinDay(Date.now()), tags: [], characterId: character, engagementTicket: measured.d.ticket };
  const writes = await Promise.all([req('/api/notebook', 'a', 'POST', saveNote), req('/api/notebook', 'a', 'POST', saveNote)]);
  check(writes.every(result => result.s === 200), 'Both notebook pages save successfully');
  const evidence = (await req(endpoint, 'a')).d;
  check(evidence.verifiedSeconds === measured.d.seconds && evidence.recipient === 'SYNTHETIC engagement character' && awarded() === 0,
    'D1 verifies only one claim and binds the owned character');
  const winner = localSql("SELECT note_id FROM engagement_verified_notes WHERE campaign_id='chronik-von-kleve' AND member_id='sprint1-a'", true)[0].note_id;
  const saved = writes.find(result => result.d.page.id === winner).d.page;
  ageTicket(27);
  const continued = await req(endpoint, 'a', 'POST', { ...notebook, ticket: measured.d.ticket });
  check(continued.d.seconds >= 25, 'Notebook measurement continues on the same ticket chain');
  const updated = await req('/api/notebook', 'a', 'POST', {
    ...saveNote, id: saved.id, version: saved.version, text: saveNote.text + ' ' + saveNote.text, engagementTicket: continued.d.ticket,
  });
  const verifiedSeconds = (await req(endpoint, 'a')).d.verifiedSeconds;
  check(updated.s === 200 && verifiedSeconds === measured.d.seconds + continued.d.seconds, 'Editing a linked notebook page confirms additional measured time');
  const profile = (await req('/api/profile', 'a')).d;
  check(profile.preferences.engagementTracking === true, 'Existing profiles default to activity measurement on');
  const setTracking = (version, enabled) => req('/api/profile', 'a', 'PATCH', {
    version, displayName: profile.displayName, avatarFileId: profile.avatarFileId,
    preferences: { ...profile.preferences, engagementTracking: enabled },
  });
  ageTicket(27);
  const beforeOptOut = await req(endpoint, 'a', 'POST', { ...notebook, ticket: continued.d.ticket });
  check(beforeOptOut.d.seconds >= 25, 'Player has unclaimed notebook time before turning off measurement');
  const optedOut = await setTracking(profile.version, false);
  check(optedOut.s === 200 && (await req('/api/profile', 'a')).d.preferences.engagementTracking === false, 'Opt-out persists in the account');
  check((await req(endpoint, 'a', 'POST', notebook)).s === 403 &&
    (await req(endpoint, 'a', 'POST', { ...notebook, ticket: beforeOptOut.d.ticket })).s === 403,
    'Opt-out refuses new and in-flight browser measurement');
  const optedOutNote = await req('/api/notebook', 'a', 'POST', { ...saveNote, engagementTicket: beforeOptOut.d.ticket });
  check(optedOutNote.s === 200 && (await req(endpoint, 'a')).d.verifiedSeconds === verifiedSeconds,
    'Notebook saves after opt-out without claiming past unverified time');
  check((await req('/api/profile', 'b')).d.preferences.engagementTracking === true, 'Opt-out is scoped to the signed-in account');
  const optedIn = await setTracking(optedOut.d.version, true);
  check(optedIn.s === 200 && !!(await req(endpoint, 'a', 'POST', notebook)).d.ticket,
    'Re-enabling starts a new ticket without carrying over pending time');
  check((await req(endpoint + '?memberId=sprint1-a', 'gm')).d.recipient === null, 'Private note evidence stays in the own player projection');
  check((await req('/api/character-engine', 'a', 'POST', { action: 'xp_reward', type: 'engagement', id: character, sessionId: preview.intervalId, amount: 1, reason: 'Synthetic request' })).s === 400,
    'The character reward route refuses public engagement awards');

  const markPoll = { ...mark, id: poll.d.id, version: 3 };
  check((await req('/api/appointments', 'gm', 'POST', { ...markPoll, marked: false })).s === 200, 'Removing the confirmed date pauses engagement awards');
  // Seed only the elapsed, already qualified history in disposable D1 to avoid a multi-hour integration test.
  let remaining = confirmed.targets.firstSeconds - verifiedSeconds;
  const history = [];
  for (let i = 0; remaining > 0; i++) {
    const date = shiftDay(confirmed.fromDay, Math.floor(i / 8));
    if (date >= saveNote.date) throw new Error('Engagement history exceeds the synthetic preparation interval');
    const seconds = Math.min(900, remaining);
    history.push(`('chronik-von-kleve','sprint1-a','engagement-played','${date}','synthetic-history-${i}',${seconds})`);
    remaining -= seconds;
  }
  localSql('INSERT INTO engagement_verified_notes(campaign_id,member_id,interval_id,day,note_id,seconds) VALUES ' + history.join(','));
  check(awarded() === 0, 'No confirmed date means no automatic EP');
  check((await req('/api/appointments', 'gm', 'POST', { ...markPoll, version: 4 })).s === 200 && awarded() === 1,
    'Restoring a confirmed date automatically books the earned stage through the XP ledger');
  check((await req(endpoint, 'a')).d.bookedStages.join(',') === '1', 'Own engagement summary shows the credited stage');
  check((await req(endpoint + '?view=sl', 'a')).s === 403, 'Engagement SL summary rejects players');
  const overview = await req(endpoint + '?view=sl', 'gm');
  check(overview.s === 200 && overview.d.progress.some(row => row.recipient === 'SYNTHETIC engagement character' && row.bookedStages[0] === 1)
    && !JSON.stringify(overview.d).includes('notebook') && !JSON.stringify(overview.d).includes('Tunnel'),
    'Engagement SL projection includes aggregate booked stages with no notebook detail');
  localSql(`DELETE FROM world_events WHERE entity_id='${character}'; DELETE FROM records WHERE id='${character}' OR (owner_id='sprint1-a' AND kind='notizen' AND CASE WHEN json_valid(body) THEN json_extract(body,'$.characterId')='${character}' ELSE 0 END)`);
}
