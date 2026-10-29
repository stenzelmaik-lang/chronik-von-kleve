import { z } from 'zod';
import type { Actor } from '@/domain/types';
import { gmOnly, HttpError } from '@/server/access';
import { readStory } from '@/server/command-workspace';
import { preparedSession } from '@/server/story-preparation';
import { readScene } from '@/server/story-scenes';

export const deletePreparationCommand = z.object({
  action: z.literal('delete'), id: z.string().min(1).max(100), version: z.number().int().positive(),
}).strict();

type Kind = 'story' | 'session' | 'scene';
type EntityDependency = { id: string; version: number; type: string; title: string; content: string; gm_body: string };
type RecordDependency = { id: string; version: number; body: string };
type WorkspaceDependency = { key: string; value: string };

// Match only structured references belonging to the preparation UI. Arbitrary
// prose, historic events and other people's records are never rewritten.
const entityReferences = `e.campaign_id=?2 AND e.id<>?1 AND (
  (e.type='SCENE' AND e.legacy_record_id IS NULL AND json_valid(e.content) AND json_extract(e.content,'$.documentKind')='story_scene' AND json_valid(e.gm_body) AND (
    json_extract(e.gm_body,'$.storyId')=?1 OR json_extract(e.gm_body,'$.parentId')=?1 OR
    EXISTS (SELECT 1 FROM json_each(e.gm_body,'$.sessionIds') j WHERE j.value=?1))) OR
  (e.type='CHRONICLE' AND json_valid(e.content) AND json_extract(e.content,'$.documentKind')='plot_dossier' AND
    EXISTS (SELECT 1 FROM json_each(e.content,'$.document.references') j WHERE j.value=?1)))`;
const recordReferences = `r.campaign_id=?2 AND r.id<>?1 AND r.kind='sitzungen' AND json_valid(r.body) AND (
  EXISTS (SELECT 1 FROM json_each(r.body,'$.sl_preparation.document.storyIds') j WHERE j.value=?1) OR
  EXISTS (SELECT 1 FROM json_each(r.body,'$.sl_preparation.document.sceneIds') j WHERE j.value=?1))`;
const workspaceReferences = `s.key LIKE ('command-workspace:'||?2||':%') AND json_valid(s.value) AND (
  EXISTS (SELECT 1 FROM json_each(s.value,'$.workspace.favorites') j WHERE j.value=?1) OR
  EXISTS (SELECT 1 FROM json_each(s.value,'$.workspace.focus') j WHERE j.value=?1) OR
  EXISTS (SELECT 1 FROM json_each(s.value,'$.workspace.panels') j WHERE json_extract(CASE WHEN json_valid(j.value) THEN j.value ELSE '{}' END,'$.pinnedId')=?1))`;

function isObject(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function object(value: string): Record<string, unknown> { // Stored JSON must be preserved, not rebuilt from defaults.
  try { const parsed: unknown = JSON.parse(value); if (isObject(parsed)) return parsed; }
  catch { /* malformed data is not safe to rewrite */ }
  throw new HttpError(409, 'Eine verknüpfte Akte enthält einen nicht lesbaren Stand. Es wurde nichts gelöscht.');
}
function without(values: unknown, id: string) { return Array.isArray(values) ? values.filter(value => value !== id) : values; }

export async function deletePreparation(db: D1Database, a: Actor, kind: Kind, id: string, version: number) {
  gmOnly(a);
  const current = kind === 'story' ? await readStory(db, a, id)
    : kind === 'scene' ? await readScene(db, a, id) : (await preparedSession(db, a, id)).view;
  if (current.version !== version) throw new HttpError(409, 'Diese Akte wurde inzwischen geändert. Bitte neu laden.');

  const [entities, records, workspaces] = await Promise.all([
    db.prepare(`SELECT e.id,e.version,e.type,e.title,e.content,e.gm_body FROM entities e WHERE ${entityReferences}`).bind(id, a.campaignId).all<EntityDependency>(),
    db.prepare(`SELECT r.id,r.version,r.body FROM records r WHERE ${recordReferences}`).bind(id, a.campaignId).all<RecordDependency>(),
    db.prepare(`SELECT s.key,s.value FROM settings s WHERE ${workspaceReferences}`).bind(id, a.campaignId).all<WorkspaceDependency>(),
  ]);
  const expectedEntities = JSON.stringify(entities.results.map(({ id, version }) => ({ id, version })));
  const expectedRecords = JSON.stringify(records.results.map(({ id, version }) => ({ id, version })));
  const expectedWorkspaces = JSON.stringify(workspaces.results);
  const now = new Date().toISOString(), eventId = crypto.randomUUID();
  const table = kind === 'session' ? 'records' : 'entities';
  const condition = kind === 'session' ? "kind='sitzungen'" : kind === 'story'
    ? "type='CHRONICLE' AND legacy_record_id IS NULL AND json_extract(content,'$.documentKind')='plot_dossier'"
    : "type='SCENE' AND legacy_record_id IS NULL AND json_extract(content,'$.documentKind')='story_scene'";
  // Snapshot checks cover both existing and newly attached references. All
  // changes below are a single D1 batch: an error rolls back every mutation.
  const guards = `
    AND NOT EXISTS (SELECT 1 FROM entity_revisions x WHERE x.campaign_id=?2 AND x.entity_id=?1)
    AND NOT EXISTS (SELECT 1 FROM recovery_records x WHERE x.entity_id=?1)
    AND NOT EXISTS (SELECT 1 FROM location_nodes x WHERE x.campaign_id=?2 AND (x.entity_id=?1 OR x.location_id=?1 OR x.parent_id=?1))
    AND NOT EXISTS (SELECT 1 FROM location_actions x WHERE x.campaign_id=?2 AND (x.location_id=?1 OR x.target_id=?1))
    AND NOT EXISTS (SELECT 1 FROM entities x WHERE x.campaign_id=?2 AND x.replaced_by=?1)
    AND NOT EXISTS (SELECT 1 FROM entities e WHERE ${entityReferences} AND NOT EXISTS
      (SELECT 1 FROM json_each(?4) p WHERE json_extract(p.value,'$.id')=e.id AND json_extract(p.value,'$.version')=e.version))
    AND NOT EXISTS (SELECT 1 FROM json_each(?4) p WHERE NOT EXISTS
      (SELECT 1 FROM entities e WHERE e.campaign_id=?2 AND e.id=json_extract(p.value,'$.id') AND e.version=json_extract(p.value,'$.version')))
    AND NOT EXISTS (SELECT 1 FROM records r WHERE ${recordReferences} AND NOT EXISTS
      (SELECT 1 FROM json_each(?5) p WHERE json_extract(p.value,'$.id')=r.id AND json_extract(p.value,'$.version')=r.version))
    AND NOT EXISTS (SELECT 1 FROM json_each(?5) p WHERE NOT EXISTS
      (SELECT 1 FROM records r WHERE r.campaign_id=?2 AND r.id=json_extract(p.value,'$.id') AND r.version=json_extract(p.value,'$.version')))
    AND NOT EXISTS (SELECT 1 FROM settings s WHERE ${workspaceReferences} AND NOT EXISTS
      (SELECT 1 FROM json_each(?6) p WHERE json_extract(p.value,'$.key')=s.key AND json_extract(p.value,'$.value')=s.value))
    AND NOT EXISTS (SELECT 1 FROM json_each(?6) p WHERE NOT EXISTS
      (SELECT 1 FROM settings s WHERE s.key=json_extract(p.value,'$.key') AND s.value=json_extract(p.value,'$.value')))`;
  const statements: D1PreparedStatement[] = [
    db.prepare(`DELETE FROM ${table} WHERE id=?1 AND campaign_id=?2 AND version=?3 AND ${condition} ${guards} RETURNING id`)
      .bind(id, a.campaignId, version, expectedEntities, expectedRecords, expectedWorkspaces),
    db.prepare('INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,?,?,? WHERE changes()=1')
      .bind(eventId, a.campaignId, id, a.id, `command.${kind}.deleted`, JSON.stringify({ version }), now),
  ];
  for (const row of entities.results) {
    const content = object(row.content), document = row.type === 'SCENE' ? object(row.gm_body) : content.document;
    if (!isObject(document)) throw new HttpError(409, 'Eine verknüpfte Akte enthält einen nicht lesbaren Stand. Es wurde nichts gelöscht.');
    if (row.type === 'SCENE') {
      if (document.storyId === id) document.storyId = '';
      if (document.parentId === id) document.parentId = '';
      document.sessionIds = without(document.sessionIds, id);
      statements.push(db.prepare('UPDATE entities SET gm_body=?,version=version+1,updated_at=? WHERE campaign_id=? AND id=? AND version=? AND EXISTS (SELECT 1 FROM world_events WHERE id=?)')
        .bind(JSON.stringify(document), now, a.campaignId, row.id, row.version, eventId));
      statements.push(db.prepare('INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,?,?,? WHERE changes()=1')
        .bind(crypto.randomUUID(), a.campaignId, row.id, a.id, 'command.scene.saved', JSON.stringify({ version: row.version + 1, document, state: content }), now));
    } else {
      document.references = without(document.references, id);
      statements.push(db.prepare('UPDATE entities SET content=?,version=version+1,updated_at=? WHERE campaign_id=? AND id=? AND version=? AND EXISTS (SELECT 1 FROM world_events WHERE id=?)')
        .bind(JSON.stringify(content), now, a.campaignId, row.id, row.version, eventId));
      statements.push(db.prepare('INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,?,?,? WHERE changes()=1')
        .bind(crypto.randomUUID(), a.campaignId, row.id, a.id, 'command.story.saved', JSON.stringify({ version: row.version + 1, document: { ...document, title: row.title } }), now));
    }
  }
  for (const row of records.results) {
    const body = object(row.body), preparation = body.sl_preparation, document = isObject(preparation) ? preparation.document : null;
    if (!isObject(document)) throw new HttpError(409, 'Ein verknüpfter Spielabend enthält einen nicht lesbaren Stand. Es wurde nichts gelöscht.');
    document.storyIds = without(document.storyIds, id); document.sceneIds = without(document.sceneIds, id);
    statements.push(db.prepare('UPDATE records SET body=?,version=version+1,updated_at=? WHERE campaign_id=? AND id=? AND version=? AND EXISTS (SELECT 1 FROM world_events WHERE id=?)')
      .bind(JSON.stringify(body), now, a.campaignId, row.id, row.version, eventId));
    statements.push(db.prepare('INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,?,?,? WHERE changes()=1')
      .bind(crypto.randomUUID(), a.campaignId, row.id, a.id, 'command.preparation.saved', JSON.stringify({ version: row.version + 1, document }), now));
  }
  for (const row of workspaces.results) {
    const saved = object(row.value), workspace = saved.workspace;
    if (!isObject(workspace) || !Array.isArray(workspace.favorites) || !Array.isArray(workspace.panels) || !isObject(workspace.focus) || !Number.isSafeInteger(saved.version))
      throw new HttpError(409, 'Eine verknüpfte Arbeitsfläche enthält einen nicht lesbaren Stand. Es wurde nichts gelöscht.');
    workspace.favorites = without(workspace.favorites, id);
    for (const panel of workspace.panels) if (isObject(panel) && panel.pinnedId === id) panel.pinnedId = null;
    for (const key of Object.keys(workspace.focus)) if (workspace.focus[key] === id) workspace.focus[key] = '';
    saved.version = Number(saved.version) + 1;
    statements.push(db.prepare('UPDATE settings SET value=? WHERE key=? AND value=? AND EXISTS (SELECT 1 FROM world_events WHERE id=?)')
      .bind(JSON.stringify(saved), row.key, row.value, eventId));
  }
  if (kind === 'session') statements.push(db.prepare(`UPDATE records SET body=json_set(body,'$.open',json('false'),'$.started',json('false'),'$.peers',json('{}'),'$.screen',json('null')),version=version+1,updated_at=?
    WHERE campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table' AND json_extract(body,'$.sessionId')=? AND (json_extract(body,'$.open')=1 OR json_extract(body,'$.started')=1)
      AND EXISTS (SELECT 1 FROM world_events WHERE id=?)`).bind(now, a.campaignId, id, eventId));
  if (kind === 'scene') statements.push(db.prepare(`UPDATE records SET body=json_set(body,'$.hidden',json('true')),version=version+1,updated_at=?
    WHERE campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table-event' AND json_extract(body,'$.kind')='scene' AND json_extract(body,'$.scene.id')=? AND COALESCE(json_extract(body,'$.hidden'),0)<>1
      AND EXISTS (SELECT 1 FROM world_events WHERE id=?)`).bind(now, a.campaignId, id, eventId));
  const results = await db.batch(statements);
  if (results[0].results.length !== 1) throw new HttpError(409, 'Die Akte oder ihre Verknüpfungen wurden geändert oder enthalten besonders geschützte Daten. Es wurde nichts gelöscht; bitte neu laden.');
  return { id, kind };
}
