import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { emptyScene, sceneDocumentSchema, sceneStateSchema, sceneCommandSchema, targetMatches, participantMatches } from '../domain/story-scene.ts';
import { projectEntity } from '../server/entities.ts';
import { defaultWorkspace, workspaceSchema, momentSchema, commandSyncSchema } from '../domain/command-workspace.ts';

test('Scenes are prepared documents without implicit sequence, activation or publication', () => {
  const d = emptyScene();
  assert.ok(sceneDocumentSchema.safeParse(d).success);
  for (const forbidden of ['active', 'published', 'nextSceneId', 'visibility']) assert.equal(sceneDocumentSchema.safeParse({ ...d, [forbidden]: true }).success, false);
  assert.equal(sceneCommandSchema.safeParse({ action: 'save', id: 'scene-1', version: 1, document: d, publish: true }).success, false);
  assert.equal(sceneCommandSchema.safeParse({ action: 'activate', id: 'scene-1', version: 1, runId: randomUUID(), sessionId: 'session-1', label: 'Teilgruppe', participants: { scope: 'characters', characterIds: [] } }).success, false);
});
test('Central references and participant identities are validated rather than copied', () => {
  const d = emptyScene();
  assert.equal(sceneDocumentSchema.safeParse({ ...d, npcIds: ['npc', 'npc'] }).success, false);
  assert.equal(sceneDocumentSchema.safeParse({ ...d, clueIds: ['clue', 'clue'] }).success, false);
  const participants = { scope: 'characters', characterIds: ['helena'] };
  assert.equal(participantMatches(participants, 'helena'), true);
  assert.equal(participantMatches(participants, 'cat'), false);
  assert.equal(participantMatches(participants), false);
  assert.equal(participantMatches({ scope: 'group' }), true);
  assert.equal(targetMatches({ scope: 'character', characterId: 'helena' }, 'cat'), false);
});
test('A scene run retains its identity and a new call cannot overwrite completed history', () => {
  const run = { id: randomUUID(), sessionId: 'session', label: 'Synthetische Gruppe', participants: { scope: 'group' }, status: 'completed', startedAt: '2026-10-02T10:00:00.000Z', updatedAt: '2026-10-02T11:00:00.000Z', completedAt: '2026-10-02T11:00:00.000Z', previousRunId: null };
  assert.ok(sceneStateSchema.safeParse({ documentKind: 'story_scene', runs: [run, { ...run, id: randomUUID(), previousRunId: run.id, status: 'active', completedAt: null }], publications: [] }).success);
  assert.equal(sceneStateSchema.safeParse({ documentKind: 'story_scene', runs: [run, run], publications: [] }).success, false);
});
test('Character knowledge does not become account-wide knowledge and cannot override secrets', () => {
  const a = { id: 'a', campaignId: 'chronik-von-kleve', status: 'active', gm: false }, context = { id: 'character-a', ownerId: 'a', campaignId: a.campaignId };
  const e = { id: 'clue', campaignId: a.campaignId, type: 'CLUE', ownerId: 'gm', visibility: 'sl', canonStatus: 'WORKING', content: { text: 'KNOWN', secrets: 'GM_ONLY' }, gmBody: 'GM_ONLY', legacyRecordId: null };
  const grant = [{ entity_id: e.id, audience: 'character', subject_id: context.id, state: 'DISCOVERED' }];
  assert.equal(projectEntity(a, e, grant), null);
  assert.ok(projectEntity(a, e, grant, context));
  assert.equal(projectEntity(a, e, grant, { ...context, id: 'other-owned-character' }), null);
  assert.equal(projectEntity({ ...a, id: 'b' }, e, grant, context), null);
  assert.equal(projectEntity(a, e, grant, { ...context, campaignId: 'other' }), null);
  assert.equal(projectEntity(a, { ...e, canonStatus: 'GM_SECRET' }, grant, context), null);
  assert.ok(!JSON.stringify(projectEntity(a, e, grant, context)).includes('GM_ONLY'));
});
test('Generic entity reads never disclose a scene dossier, even with a group grant', () => {
  const a = { id: 'a', campaignId: 'chronik-von-kleve', status: 'active', gm: false };
  const e = { id: 'scene', campaignId: a.campaignId, type: 'SCENE', ownerId: 'gm', visibility: 'sl', canonStatus: 'WORKING', content: { documentKind: 'story_scene', runs: [], publications: [], privateMetadata: 'NO' }, gmBody: 'PRIVATE_DRAFT' };
  assert.equal(projectEntity(a, e, [{ entity_id: 'scene', audience: 'group', subject_id: a.campaignId, state: 'DISCOVERED' }]), null);
});
test('Existing workspace and moment data remain backward compatible', () => {
  const w = defaultWorkspace('live'); delete w.focus.sceneId;
  assert.equal(workspaceSchema.parse(w).focus.sceneId, '');
  assert.ok(commandSyncSchema.safeParse({ type: 'focus', sceneId: 'scene-safe-id' }).success);
  assert.equal(commandSyncSchema.safeParse({ type: 'focus', sceneId: 'scene-safe-id', secretText: 'NO' }).success, false);
  const m = momentSchema.parse({ clientRequestId: randomUUID(), text: 'Tatsächlich geschehen', sessionId: 's', storyId: '', references: [] });
  assert.equal(m.sceneId, ''); assert.equal(m.runId, '');
});


test('Scene texts support 10000 visible characters and keep visions separate from secrets', () => {
  const old=emptyScene(); delete old.visions;
  assert.equal(sceneDocumentSchema.parse(old).visions,'');
  for(const key of ['narration','atmosphere','dialogueNotes','interactions','secrets','visions','possibleConsequences','gmNotes']) {
    assert.ok(sceneDocumentSchema.safeParse({...emptyScene(),[key]:'x'.repeat(10000)}).success,key);
    assert.equal(sceneDocumentSchema.safeParse({...emptyScene(),[key]:'x'.repeat(10001)}).success,false,key);
  }
  const scene=sceneDocumentSchema.parse({...emptyScene(),secrets:'INTERNAL_BACKGROUND',visions:'PLAYER_INFO_TO_PREPARE'});
  assert.equal(scene.secrets,'INTERNAL_BACKGROUND');assert.equal(scene.visions,'PLAYER_INFO_TO_PREPARE');
});


test('Personal message drafts retain old scene fields and reject duplicate recipients or files', () => {
  const old=emptyScene();delete old.visionRecipientIds;delete old.visionFileIds;
  assert.deepEqual(sceneDocumentSchema.parse(old).visionRecipientIds,[]);
  assert.deepEqual(sceneDocumentSchema.parse(old).visionFileIds,[]);
  assert.equal(sceneDocumentSchema.safeParse({...old,visionRecipientIds:['a','a']}).success,false);
  assert.equal(sceneDocumentSchema.safeParse({...old,visionFileIds:['a','a']}).success,false);
});

test('Private message HTML uses the safe existing format while legacy plain text stays compatible', async () => {
  const {personalMessageSchema}=await import('../domain/personal-message.ts');
  const base={clientRequestId:randomUUID(),recipients:['a'],title:'Title',text:'Plain'};
  assert.ok(personalMessageSchema.safeParse(base).success);
  assert.equal(personalMessageSchema.safeParse({...base,text:'x'.repeat(20001)}).success,false);
  assert.ok(personalMessageSchema.safeParse({...base,format:'rich',text:'cvk-html-v1:<h2>Vision</h2><p>Safe</p>'}).success);
  assert.ok(personalMessageSchema.safeParse({...base,format:'rich',text:'',fileIds:['image']}).success);
  assert.equal(personalMessageSchema.safeParse({...base,format:'rich',text:''}).success,false);
  // Mailbox 2.0: every member may attach own files to plain letters; access is checked server-side.
  assert.ok(personalMessageSchema.safeParse({...base,fileIds:['file']}).success);
  assert.equal(personalMessageSchema.safeParse({...base,text:' '}).success,false);
  assert.equal(personalMessageSchema.safeParse({...base,format:'rich',text:'x'.repeat(10001)}).success,false);
});
