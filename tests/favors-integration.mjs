export async function favorsIntegration({ req, check, localSql }) {
  const player = '/api/favors', sl = player + '?view=sl';
  check((await req(player)).s === 401, 'Favor ledger requires authentication');
  check((await req(sl, 'a')).s === 403, 'Favor SL projection rejects a player');
  check((await req(player, 'otherCampaign')).s === 403, 'Favor ledger is campaign scoped');

  localSql(`INSERT INTO records(id,owner_id,kind,visibility,title,body,created_at,updated_at,campaign_id) VALUES
    ('favor-char-a','sprint1-a','charaktere','private','Synthetic debtor','{}','test','test','chronik-von-kleve'),
    ('favor-legacy-a','sprint1-a','gefallen','private','Synthetic legacy','{"favors":[{"id":"minus","npc":"Kontakt","value":-3,"note":"Ungeprüfter Alttext","date":"2026-10-12","status":"offen"}]}','test','test','chronik-von-kleve');
    INSERT INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,title,content,gm_body,default_visibility,created_at,updated_at) VALUES
    ('favor-npc-a','chronik-von-kleve','NPC','confirmed','sprint1-gm','sl','Synthetic Contact A','{"field_visibility":{"name":"player_visible"}}','','player_visible','test','test'),
    ('favor-npc-b','chronik-von-kleve','NPC','confirmed','sprint1-gm','sl','Synthetic Contact B','{"field_visibility":{"name":"player_visible"}}','','player_visible','test','test'),
    ('favor-secret','chronik-von-kleve','NPC','GM_SECRET','sprint1-gm','sl','Synthetic Secret NPC','{}','','sl_secret','test','test')`);

  const visible = (await req(player, 'a')).d;
  check(visible.legacy.some(row => row.key === 'favor-legacy-a:minus' && row.value === -3), 'Legacy signed favor stays readable without becoming debt');
  check(!visible.npcs.some(n => n.id === 'favor-secret'), 'The player picker excludes secret NPCs');
  const draft = { action: 'propose', characterId: 'favor-char-a', npcId: 'favor-npc-a', kind: 'debt', direction: 'owes',
    markers: 1, description: 'SYNTHETIC obligation', terms: '', visibility: 'parties' };
  const propose = (fields = {}, who = 'a', url = player) => req(url, who, 'POST', { ...draft, operationId: crypto.randomUUID(), ...fields });
  const update = (id, action, version = 1, fields = {}, who = 'gm', url = sl) => req(url, who, 'POST', {
    id, action, version, operationId: crypto.randomUUID(), reason: 'Synthetic transition', ...fields,
  });
  check((await propose({ npcId: 'favor-secret' })).s === 404, 'Players cannot probe secret NPCs via a write');
  check((await propose({}, 'b')).s === 404, 'Players cannot propose debt on another character');
  check((await propose({ visibility: 'sl' })).s === 403, 'Players cannot set SL-only visibility');
  check((await propose({ tier: 3 })).s === 400, 'Favor tier and markers remain distinct');
  const legacyKey = 'favor-legacy-a:minus';
  const pair = await Promise.all([propose({ markers: 2, legacyKey }), propose({ markers: 2, legacyKey })]);
  check(pair.every(result => result.s === 200) && pair[0].d.id === pair[1].d.id, 'Concurrent legacy proposals import once by source');
  const first = pair[0].d.id;
  const second = (await propose()).d.id;
  check((await req(sl, 'gm')).d.crises.length === 0, 'Unconfirmed proposals create no crisis');
  check((await update(first, 'confirm', 1, {}, 'a', player)).s === 409, 'A player cannot confirm their own proposal');
  const confirmed = await Promise.all([update(first, 'confirm'), update(second, 'confirm')]);
  check(confirmed.every(result => result.s === 200), 'Independent confirmations can run concurrently');
  const crises = async () => (await req(sl, 'gm')).d.crises;
  check((await crises()).filter(item => !item.closedAt).length === 1 && (await crises())[0].markers === 3, 'The third outgoing marker opens exactly one crisis');
  const crisis = (await crises())[0];
  const decision = { action: 'decide-crisis', id: crisis.id, version: crisis.version, operationId: crypto.randomUUID(), decision: 'SYNTHETIC_PRIVATE_NEGOTIATION' };
  check((await req(player, 'a', 'POST', decision)).s === 403, 'A player cannot decide a crisis');
  const decisions = await Promise.all([req(sl, 'gm', 'POST', decision), req(sl, 'gm', 'POST', decision)]);
  check(decisions.every(result => result.s === 200) && (await crises())[0].version === crisis.version + 1 && (await crises())[0].decision === decision.decision,
    'A crisis decision is audited once and does not change the debt');
  check(!JSON.stringify((await req(player, 'a')).d).includes(decision.decision), 'Crisis decisions stay in the SL view');
  check((await req(player + '?id=' + first, 'b')).s === 404 && (await req(player + '?id=' + first, 'gm')).s === 404, 'Foreign participant and SL in player view see no obligation details');

  const inverse = (await propose({ markers: 4, direction: 'owed' })).d.id;
  check((await update(inverse, 'confirm')).s === 200 && (await crises())[0].markers === 3, 'Incoming obligations do not count toward crisis');
  const secret = (await propose({ visibility: 'sl', gmNote: 'SYNTHETIC_PRIVATE_NOTE', markers: 1, npcId: 'favor-npc-b' }, 'gm', sl)).d.id;
  check((await req(player + '?id=' + secret, 'a')).s === 404, 'SL-only obligations are inaccessible to the debtor');
  check(!JSON.stringify((await req(player, 'a')).d).includes('SYNTHETIC_PRIVATE_NOTE'), 'Player projection omits SL notes');

  const transfer = { npcId: 'favor-npc-b', operationId: crypto.randomUUID() };
  const attempts = await Promise.all([update(second, 'transfer', 2, transfer), update(second, 'transfer', 2, transfer)]);
  check(attempts.every(result => result.s === 200), 'Transfer retries return the same result');
  check((await crises()).every(item => !!item.closedAt), 'Transfer recomputes and closes the old pair crisis');
  const call = await update(first, 'call', 2);
  check(call.s === 200 && (await update(first, 'fulfill', 3, { amount: 1 }, 'a', player)).s === 200, 'A called debt can be partially fulfilled by the participant');
  const after = (await req(player + '?id=' + first, 'a')).d;
  check(after.obligations[0].remaining === 1 && after.history.length === 4, 'Partial fulfillment keeps a complete authorized history');
  check((await update(first, 'forgive', 4)).s === 200, 'The SL can forgive the remaining marker');
  check((await req(player, 'a')).d.legacy.some(row => row.key === legacyKey && row.value === -3 && row.imported), 'The migrated proposal preserves the original private record');
  localSql(`DELETE FROM world_events WHERE type='favor.crisis_decision' AND entity_id IN (SELECT id FROM favor_crises WHERE character_id='favor-char-a');
    DELETE FROM favor_events WHERE obligation_id IN (SELECT id FROM favor_obligations WHERE character_id='favor-char-a');
    DELETE FROM favor_obligations WHERE character_id='favor-char-a';
    DELETE FROM favor_crises WHERE character_id='favor-char-a';
    DELETE FROM records WHERE id IN ('favor-char-a','favor-legacy-a');
    DELETE FROM entities WHERE id IN ('favor-npc-a','favor-npc-b','favor-secret');`);
}
