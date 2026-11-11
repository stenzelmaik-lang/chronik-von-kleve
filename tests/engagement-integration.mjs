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

  localSql("INSERT INTO played_sessions(id,campaign_id,session_record_id,played_on,title,registered_by,registered_at) VALUES('engagement-played','chronik-von-kleve','engagement-session',date('now','-4 days'),'SYNTHETIC game night','sprint1-gm',datetime('now'))");
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
}
