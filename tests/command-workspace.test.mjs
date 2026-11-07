import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultWorkspace, workspaceSchema, storyDocumentSchema, emptyStory, commandSyncSchema, momentSchema } from '../domain/command-workspace.ts';

test('Private workspaces have independent defaults for preparation, live, recap and companion', () => {
  for (const mode of ['prepare', 'live', 'recap']) assert.ok(workspaceSchema.safeParse(defaultWorkspace(mode)).success);
  assert.deepEqual(defaultWorkspace('live', true).panels.map(p => p.tool), ['character', 'dispatch']);
  assert.notDeepEqual(defaultWorkspace('live').panels, defaultWorkspace('prepare').panels);
});
test('Layout rejects unknown content, duplicate panels and uncontrolled tool instances', () => {
  const base = defaultWorkspace('live');
  assert.equal(workspaceSchema.safeParse({ ...base, privateStory: 'secret' }).success, false);
  assert.equal(workspaceSchema.safeParse({ ...base, panels: [base.panels[0], base.panels[0]] }).success, false);
  assert.equal(workspaceSchema.safeParse({ ...base, panels: [{ ...base.panels[1], id: 'scene-a' }, { ...base.panels[1], id: 'scene-b' }] }).success, false);
  assert.equal(workspaceSchema.safeParse({ ...base, panels: Array.from({ length: 6 }, (_, i) => ({ id: 'tool-' + i, tool: ['story', 'character', 'places', 'dispatch', 'notes', 'dossiers'][i], column: 0, height: 20, pinnedId: null })) }).success, false);
});
test('Multiple pinned character and story panes are references without private contents', () => {
  const base = defaultWorkspace('live');
  const layout = { ...base, panels: ['a', 'b'].map(id => ({ id, tool: 'character', column: 1, height: 50, pinnedId: 'character-' + id })) };
  assert.ok(workspaceSchema.safeParse(layout).success);
  assert.equal(workspaceSchema.safeParse({ ...base, panels: [{ ...base.panels[1], pinnedId: 'session-a' }] }).success, false);
  assert.equal(workspaceSchema.safeParse({ ...base, panels: [{ ...base.panels[0], pinnedId: '' }] }).success, false);
});
test('Bounds and unique favorites constrain persisted resize and search state', () => {
  const base = defaultWorkspace('live');
  for (const split of [0, 76, Infinity]) assert.equal(workspaceSchema.safeParse({ ...base, split }).success, false);
  assert.equal(workspaceSchema.safeParse({ ...base, favorites: ['x', 'x'] }).success, false);
  assert.equal(workspaceSchema.safeParse({ ...base, panels: [{ ...base.panels[0], height: 1 }] }).success, false);
});
test('Plot dossiers separate prepared possibilities from actual session events', () => {
  const story = emptyStory();
  story.possibilities = [{ id: crypto.randomUUID(), title: 'Synthetic option', text: 'Preparation only', status: 'open' }];
  assert.ok(storyDocumentSchema.safeParse(story).success);
  assert.equal(storyDocumentSchema.safeParse({ ...story, visibility: 'group' }).success, false);
  assert.equal(storyDocumentSchema.safeParse({ ...story, possibilities: [...story.possibilities, story.possibilities[0]] }).success, false);
  assert.ok(momentSchema.safeParse({ clientRequestId: crypto.randomUUID(), text: 'Actually happened', sessionId: 'session-a', storyId: 'plot-a', references: [] }).success);
});
test('Plot sections reject broken rich text and excessive contents', () => {
  const base = emptyStory();
  assert.equal(storyDocumentSchema.safeParse({ ...base, sections: { ...base.sections, core: 'x'.repeat(20001) } }).success, false);
  assert.equal(storyDocumentSchema.safeParse({ ...base, sections: { ...base.sections, core: 'cvk-rich-v1:{"version":1,"blocks":[{"type":"script"}]}' } }).success, false);
});
test('Multi-window synchronization accepts references only, never secrets or session tokens', () => {
  assert.ok(commandSyncSchema.safeParse({ type: 'focus', characterId: 'a', storyId: 's' }).success);
  assert.ok(commandSyncSchema.safeParse({ type: 'invalidate' }).success);
  assert.ok(commandSyncSchema.safeParse({ type: 'lock' }).success);
  assert.ok(commandSyncSchema.safeParse({ type: 'request-focus' }).success);
  assert.equal(commandSyncSchema.safeParse({ type: 'request-focus', token: 'private' }).success, false);
  for (const value of [{ type: 'focus', secret: 'GM' }, { type: 'invalidate', token: 'private' }, { type: 'publish' }, { type: 'focus', storyId: ['bad'] }]) assert.equal(commandSyncSchema.safeParse(value).success, false);
});
