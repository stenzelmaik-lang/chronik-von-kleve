import { randomUUID } from 'node:crypto';
import { emptyStory } from '../domain/command-workspace.ts';
import { emptyScene } from '../domain/story-scene.ts';
import { sessionPreparationSchema } from '../domain/story-preparation.ts';

export async function preparationDeleteIntegration({ req, check, localSql, sqlQuote, session }) {
  const base = '/api/command-center/';
  const create = async (path, document) => {
    const r = await req(base + path, 'gm', 'POST', { action: 'create', clientRequestId: randomUUID(), document });
    check(r.s === 201, 'DELETE fixture created ' + path);
    return r.d[path === 'preparation' ? 'session' : path === 'scenes' ? 'scene' : 'story'];
  };
  const remove = (path, item, who = 'gm', version = item.version, headers) => req(base + path, who, 'POST', { action: 'delete', id: item.id, version }, headers);
  const read = (path, id) => req(base + path + '?id=' + id, 'gm');
  const story = await create('story', { ...emptyStory(), title: 'SYNTHETIC delete story' });
  const scene = await create('scenes', { ...emptyScene(), title: 'SYNTHETIC delete scene' });
  const evening = await create('preparation', sessionPreparationSchema.parse({ title: 'SYNTHETIC delete session' }));
  for (const [path, item] of [['story', story], ['scenes', scene], ['preparation', evening]]) {
    for (const who of [null, 'a', 'editor', 'blockedGm', 'otherCampaign', 'platformOnly'])
      check([401, 403].includes((await remove(path, item, who)).s), `DELETE ${path} denies ${who || 'anonymous'}`);
    check((await remove(path, item, 'gm', item.version + 1)).s === 409, `DELETE ${path} rejects stale version`);
    check((await remove(path, item, 'gm', item.version, { Origin: 'https://evil.invalid' })).s === 403, `DELETE ${path} rejects cross-site requests`);
  }
  check((await req('/api/records', 'gm', 'DELETE', { id: evening.id, version: evening.version })).s === 403, 'DELETE prepared session cannot bypass guards through legacy records');
  for (const [path, item] of [['story', story], ['scenes', scene], ['preparation', evening]])
    check((await remove(path, item)).s === 200 && (await read(path, item.id)).s === 404, `DELETE ${path} removes its own entry`);
  for (const [path, id, prefix, document] of [
    ['story', story.id, 'plot-', { ...emptyStory(), title: 'SYNTHETIC delete story' }],
    ['scenes', scene.id, 'scene-', { ...emptyScene(), title: 'SYNTHETIC delete scene' }],
    ['preparation', evening.id, 'session-', sessionPreparationSchema.parse({ title: 'SYNTHETIC delete session' })],
  ]) check((await req(base + path, 'gm', 'POST', { action: 'create', clientRequestId: id.slice(prefix.length), document })).s === 409, `DELETE ${path} cannot reuse deleted ID`);

  const legacy = await create('preparation', sessionPreparationSchema.parse({ title: 'SYNTHETIC existing group session' }));
  localSql(`UPDATE records SET visibility='group',body=json_set(body,'$.legacyText','SYNTHETIC'),gm_body='SYNTHETIC private notes',version=version+1 WHERE id=${sqlQuote(legacy.id)}`);
  const legacyCurrent = (await read('preparation', legacy.id)).d.session;
  check((await remove('preparation', legacyCurrent)).s === 200 && (await read('preparation', legacy.id)).s === 404, 'DELETE existing group session with legacy fields and GM notes');
  const oldSession = await req('/api/records', 'gm', 'POST', { kind: 'sitzungen', title: 'SYNTHETIC existing legacy session', visibility: 'group', body: { scene: 'SYNTHETIC legacy scene text', log: [] }, gmBody: 'SYNTHETIC older GM note' });
  const oldSessionView = (await read('preparation', oldSession.d.id)).d.session;
  check(oldSession.s === 200 && (await remove('preparation', oldSessionView)).s === 200 && (await read('preparation', oldSession.d.id)).s === 404, 'DELETE older group session without a preparation marker');

  const linkedStory = await create('story', { ...emptyStory(), title: 'SYNTHETIC linked story' });
  const storyScene = await create('scenes', { ...emptyScene(linkedStory.id), title: 'SYNTHETIC story scene', gmNotes: 'Keep private notes' });
  check((await remove('story', linkedStory)).s === 200, 'DELETE removes linked story');
  const detachedScene = (await read('scenes', storyScene.id)).d.scene;
  check(detachedScene.document.storyId === '' && detachedScene.document.gmNotes === 'Keep private notes', 'DELETE detaches story while preserving scene content');

  const referencedStory = await create('story', { ...emptyStory(), title: 'SYNTHETIC referenced story' });
  const referringStory = await create('story', { ...emptyStory(), title: 'SYNTHETIC preserved story', references: [referencedStory.id], sections: { ...emptyStory().sections, notes: 'Keep story text' } });
  const referringSession = await create('preparation', sessionPreparationSchema.parse({ title: 'SYNTHETIC preserved session', storyIds: [referencedStory.id] }));
  const relationshipId = randomUUID();
  localSql(`INSERT INTO relationships(id,campaign_id,source_id,target_id,type,visibility,created_at) VALUES(${sqlQuote(relationshipId)},'chronik-von-kleve',${sqlQuote(referencedStory.id)},'place.electric-taberna','related_to','sl','now')`);
  check((await remove('story', referencedStory)).s === 200, 'DELETE removes a story with normal relationships');
  check(!(await read('story', referringStory.id)).d.story.references.includes(referencedStory.id) && (await read('story', referringStory.id)).d.story.sections.notes === 'Keep story text', 'DELETE clears story reference but preserves other story content');
  check(!(await read('preparation', referringSession.id)).d.session.document.storyIds.includes(referencedStory.id) && (await req('/api/entities?id=place.electric-taberna', 'gm')).s === 200, 'DELETE clears session reference and preserves related place');

  const focused = await create('story', { ...emptyStory(), title: 'SYNTHETIC focused story' });
  const workspaceBefore = (await req(base + 'workspace?mode=prepare&windowRole=main', 'gm')).d;
  const workspace = { ...workspaceBefore.workspace, focus: { ...workspaceBefore.workspace.focus, storyId: focused.id }, favorites: [focused.id], panels: workspaceBefore.workspace.panels.map((p, i) => i === 0 ? { ...p, pinnedId: focused.id } : p) };
  check((await req(base + 'workspace', 'gm', 'POST', { mode: 'prepare', windowRole: 'main', version: workspaceBefore.version, workspace })).s === 200, 'DELETE workspace fixture stores focus, favorite and pin');
  check((await remove('story', focused)).s === 200, 'DELETE removes a story used in an SL workspace');
  const clearedWorkspace = (await req(base + 'workspace?mode=prepare&windowRole=main', 'gm')).d.workspace;
  check(clearedWorkspace.focus.storyId === '' && !clearedWorkspace.favorites.includes(focused.id) && !clearedWorkspace.panels.some(p => p.pinnedId === focused.id), 'DELETE clears only deleted item from saved workspace');

  const parent = await create('preparation', sessionPreparationSchema.parse({ title: 'SYNTHETIC linked session' }));
  const child = await create('scenes', { ...emptyScene(), title: 'SYNTHETIC linked scene', sessionIds: [parent.id] });
  const linked = await req(base + 'preparation', 'gm', 'POST', { action: 'save', id: parent.id, version: parent.version, document: { ...parent.document, sceneIds: [child.id] } });
  check(linked.s === 200, 'DELETE fixtures have both scene links');
  check((await remove('scenes', child)).s === 200, 'DELETE linked scene succeeds');
  const sessionAfter = (await read('preparation', parent.id)).d.session;
  check(!sessionAfter.document.sceneIds.includes(child.id) && sessionAfter.document.title === parent.document.title, 'DELETE removes scene reference but preserves session');
  check((await remove('preparation', sessionAfter)).s === 200, 'DELETE remaining session succeeds');
  const linkedSession = await create('preparation', sessionPreparationSchema.parse({ title: 'SYNTHETIC session to detach' }));
  const linkedChild = await create('scenes', { ...emptyScene(), title: 'SYNTHETIC scene to preserve', sessionIds: [linkedSession.id], gmNotes: 'Retain confidential scene' });
  check((await remove('preparation', linkedSession)).s === 200, 'DELETE linked session succeeds');
  const preservedChild = (await read('scenes', linkedChild.id)).d.scene;
  check(!preservedChild.document.sessionIds.includes(linkedSession.id) && preservedChild.document.gmNotes === 'Retain confidential scene', 'DELETE removes session reference but preserves confidential scene');

  const mainScene = await create('scenes', { ...emptyScene(), title: 'SYNTHETIC parent scene' });
  const subScene = await create('scenes', { ...emptyScene(), title: 'SYNTHETIC child scene', parentId: mainScene.id });
  check((await remove('scenes', mainScene)).s === 200 && (await read('scenes', subScene.id)).d.scene.document.parentId === '', 'DELETE detaches child scene instead of deleting it');
  const played = await create('scenes', { ...emptyScene(), title: 'SYNTHETIC played scene' });
  const activated = await req(base + 'scenes', 'gm', 'POST', { action: 'activate', id: played.id, version: played.version, runId: randomUUID(), sessionId: session.id, label: 'SYNTHETIC play', participants: { scope: 'group' } });
  check(activated.s === 200 && (await remove('scenes', activated.d.scene)).s === 200, 'DELETE removes a scene that has been played');
  const published = await create('scenes', { ...emptyScene(), title: 'SYNTHETIC published scene' });
  const release = await req(base + 'scenes', 'gm', 'POST', { action: 'publish', id: published.id, version: published.version, target: { scope: 'group' } });
  check(release.s === 200 && (await req('/api/session-scenes', 'a')).d.scenes.some(s => s.id === published.id), 'DELETE published fixture is initially visible to player');
  check((await remove('scenes', release.d.scene)).s === 200 && !(await req('/api/session-scenes', 'a')).d.scenes.some(s => s.id === published.id), 'DELETE removes scene and its player release');

  const liveSession = await create('preparation', sessionPreparationSchema.parse({ title: 'SYNTHETIC active session' }));
  const liveScene = await create('scenes', { ...emptyScene(), title: 'SYNTHETIC live scene to remove', narration: 'SYNTHETIC public narration' });
  check((await req('/api/live-table', 'gm', 'POST', { action: 'start', sessionId: liveSession.id, title: 'SYNTHETIC active session' })).s === 200, 'DELETE active fixture starts a session');
  const room = (await req('/api/live-table?sessionId=' + liveSession.id, 'a')).d.room;
  const sceneEventId = randomUUID();
  check((await req('/api/live-table', 'gm', 'POST', { action: 'showScene', sessionId: liveSession.id, runId: room.runId, eventId: sceneEventId, sceneId: liveScene.id, sceneVersion: liveScene.version, audience: { scope: 'all' } })).s === 200, 'DELETE live fixture shares the scene');
  check((await req('/api/live-table?sessionId=' + liveSession.id, 'a')).d.events.some(e => e.scene?.id === liveScene.id), 'DELETE player initially sees live scene');
  check((await remove('scenes', liveScene)).s === 200 && !(await req('/api/live-table?sessionId=' + liveSession.id, 'a')).d.events.some(e => e.scene?.id === liveScene.id), 'DELETE hides a currently displayed scene for players');
  const peerId = randomUUID(), elementId = randomUUID();
  check((await req('/api/live-table', 'a', 'POST', { action: 'join', sessionId: liveSession.id, peerId })).s === 200, 'DELETE live fixture joins board');
  check((await req('/api/live-table', 'a', 'POST', { action: 'draw', sessionId: liveSession.id, peerId, epoch: 0, element: { id: elementId, color: '#abcdef', points: [[30, 80]], text: 'SYNTHETIC board remains' } })).s === 200, 'DELETE live fixture adds a shared note');
  check((await remove('preparation', liveSession)).s === 200 && (await req('/api/live-table?sessionId=' + liveSession.id, 'a')).s === 404, 'DELETE ends active session and removes player access');
  const boardCheck = localSql(`SELECT CASE WHEN EXISTS (SELECT 1 FROM records WHERE id=${sqlQuote('live-table:chronik-von-kleve:' + liveSession.id)} AND json_extract(body,'$.open')=0 AND json_extract(body,'$.started')=0 AND instr(body,${sqlQuote(elementId)})>0) THEN 'PRESERVED' ELSE 'LOST' END AS result`, true);
  check(boardCheck[0].result === 'PRESERVED', 'DELETE closes room without discarding shared board contents');

  const fault = await create('story', { ...emptyStory(), title: 'SYNTHETIC audit failure' });
  const faultChild = await create('scenes', { ...emptyScene(fault.id), title: 'SYNTHETIC transaction child' });
  localSql(`CREATE TRIGGER synthetic_delete_failure BEFORE INSERT ON world_events WHEN NEW.entity_id=${sqlQuote(faultChild.id)} AND NEW.type='command.scene.saved' BEGIN SELECT RAISE(ABORT,'isolated delete audit failure'); END`);
  check((await remove('story', fault)).s === 503 && (await read('story', fault.id)).s === 200 && (await read('scenes', faultChild.id)).d.scene.document.storyId === fault.id, 'DELETE failure rolls back both deletion and detachment');
  localSql('DROP TRIGGER synthetic_delete_failure');
  check((await remove('story', fault)).s === 200, 'DELETE succeeds after isolated failure is removed');
  const faultSession = await create('preparation', sessionPreparationSchema.parse({ title: 'SYNTHETIC session audit failure' }));
  localSql(`CREATE TRIGGER synthetic_session_delete_failure BEFORE INSERT ON world_events WHEN NEW.entity_id=${sqlQuote(faultSession.id)} AND NEW.type='command.session.deleted' BEGIN SELECT RAISE(ABORT,'isolated session delete audit failure'); END`);
  check((await remove('preparation', faultSession)).s === 503 && (await read('preparation', faultSession.id)).s === 200, 'DELETE session audit failure rolls back record and entity');
  localSql('DROP TRIGGER synthetic_session_delete_failure');
  check((await remove('preparation', faultSession)).s === 200, 'DELETE session succeeds after isolated failure is removed');

  for (let i = 0; i < 4; i++) {
    const racingScene = await create('scenes', { ...emptyScene(), title: 'SYNTHETIC race scene' });
    const racingSession = await create('preparation', sessionPreparationSchema.parse({ title: 'SYNTHETIC race session' }));
    const [deleted, saved] = await Promise.all([
      remove('scenes', racingScene),
      req(base + 'preparation', 'gm', 'POST', { action: 'save', id: racingSession.id, version: racingSession.version, document: { ...racingSession.document, sceneIds: [racingScene.id] } }),
    ]);
    const after = (await read('preparation', racingSession.id)).d.session;
    check(deleted.s === 200 ? !after.document.sceneIds.includes(racingScene.id) : saved.s !== 200 || (await read('scenes', racingScene.id)).s === 200, 'DELETE racing scene reference cannot become dangling');
  }
  const racingLive = await create('preparation', sessionPreparationSchema.parse({ title: 'SYNTHETIC live race' }));
  const [deletedLive, startedLive] = await Promise.all([
    remove('preparation', racingLive),
    req('/api/live-table', 'gm', 'POST', { action: 'start', sessionId: racingLive.id, title: 'SYNTHETIC live race' }),
  ]);
  if (deletedLive.s === 200) check((await req('/api/live-table?sessionId=' + racingLive.id, 'a')).s === 404, 'DELETE racing live start leaves no accessible orphan room');
  else if (startedLive.s === 200) {
    const active = await req('/api/live-table?sessionId=' + racingLive.id, 'gm');
    check(active.s === 200 && !!active.d.room?.runId, 'DELETE race preserves the started room');
    check((await req('/api/live-table', 'gm', 'POST', { action: 'end', sessionId: racingLive.id, runId: active.d.room.runId })).s === 200, 'DELETE race synthetic room can be closed');
  }
}
