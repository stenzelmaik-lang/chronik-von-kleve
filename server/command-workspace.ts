import { validatePreparationMedia } from './preparation-media';
import type { Actor } from '@/domain/types';
import { workspaceSchema, defaultWorkspace, storyDocumentSchema, type StoryView, type StoryHistory, type WorkspaceMode, type CommandWorkspace, type MomentView, type CommandReference } from '@/domain/command-workspace';
import { HttpError } from '@/server/database';
import { gmOnly, canRead } from '@/server/access';
import { loadEntitiesForIds, parseObject, type EntityRow } from '@/server/entities';
import { richTextToPlainText } from '@/domain/location-rich-text';

const storyPredicate = "type='CHRONICLE' AND canon_status='GM_SECRET' AND visibility='sl' AND legacy_record_id IS NULL AND json_extract(content,'$.documentKind')='plot_dossier'";
export async function validateCommandReferences(db: D1Database, a: Actor, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  const entities = await loadEntitiesForIds(db, a.campaignId, unique);
  if (entities.length !== unique.length || entities.some(e => e.content.recoveryOnly === true || (e.type === 'CHARACTER' && !canRead(a, { owner_id: e.ownerId, visibility: e.visibility, kind: 'charaktere', campaign_id: e.campaignId })))) throw new HttpError(404, 'Eine verknüpfte Akte ist nicht verfügbar.');
}
export async function readWorkspace(db: D1Database, a: Actor, mode: WorkspaceMode, windowRole: 'main' | 'companion') {
  gmOnly(a);
  const key = `command-workspace:${a.campaignId}:${a.id}:${mode}:${windowRole}`;
  const row = await db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first<{ value: string }>();
  if (!row) return { version: 0, workspace: defaultWorkspace(mode, windowRole === 'companion'), mode, windowRole };
  let saved: { version: number; workspace: CommandWorkspace };
  try { saved = JSON.parse(row.value); } catch { throw new HttpError(409, 'Die gespeicherte Anordnung muss geprüft werden. Es wird nichts überschrieben.'); }
  const parsed = workspaceSchema.safeParse(saved.workspace);
  if (!parsed.success || !Number.isSafeInteger(saved.version) || saved.version < 1) throw new HttpError(409, 'Die gespeicherte Anordnung muss geprüft werden. Es wird nichts überschrieben.');
  return { version: saved.version, workspace: parsed.data, mode, windowRole };
}
export async function saveWorkspace(db: D1Database, a: Actor, mode: WorkspaceMode, windowRole: 'main' | 'companion', version: number, workspace: CommandWorkspace) {
  gmOnly(a);
  await validateCommandReferences(db, a, [...workspace.favorites, ...workspace.panels.flatMap(p => p.pinnedId ? [p.pinnedId] : []), ...Object.values(workspace.focus)]);
  const typedIds = [...workspace.panels.filter(p => p.pinnedId).map(p => ({ id: p.pinnedId!, expected: p.tool === 'character' ? 'CHARACTER' : p.tool === 'places' ? 'PLACE' : p.tool === 'story' ? 'CHRONICLE' : null })), ...Object.entries(workspace.focus).filter(([, id]) => id).map(([key, id]) => ({ id, expected: key === 'characterId' ? 'CHARACTER' : key === 'placeId' ? 'PLACE' : key === 'storyId' ? 'CHRONICLE' : key === 'sceneId' ? 'SCENE' : 'SESSION' }))];
  const nodes = await loadEntitiesForIds(db, a.campaignId, typedIds.map(r => r.id));
  if (typedIds.some(r => r.expected && !nodes.some(e => e.id === r.id && e.type === r.expected))) throw new HttpError(400, 'Diese Akte passt nicht zum gewählten Werkzeug.');
  for (const ref of typedIds.filter(r => r.expected === 'CHRONICLE')) await readStory(db, a, ref.id);
  const key = `command-workspace:${a.campaignId}:${a.id}:${mode}:${windowRole}`;
  const value = JSON.stringify({ version: version + 1, workspace });
  const referenceIds = JSON.stringify([...new Set([...workspace.favorites, ...workspace.panels.flatMap(p => p.pinnedId ? [p.pinnedId] : []), ...Object.values(workspace.focus)].filter(Boolean))]);
  // Recheck the same references at write time, so a simultaneous delete cannot
  // leave an already-saved workspace pointing at a removed preparation.
  const referencesExist = "NOT EXISTS (SELECT 1 FROM json_each(?) wanted WHERE NOT EXISTS (SELECT 1 FROM entities e WHERE e.campaign_id=? AND e.id=wanted.value))";
  const result = version === 0
    ? await db.prepare(`INSERT OR IGNORE INTO settings(key,value) SELECT ?,? WHERE ${referencesExist}`).bind(key, value, referenceIds, a.campaignId).run()
    : await db.prepare(`UPDATE settings SET value=? WHERE key=? AND json_extract(value,'$.version')=? AND ${referencesExist}`).bind(value, key, version, referenceIds, a.campaignId).run();
  if (result.meta.changes !== 1) throw new HttpError(409, 'Diese Anordnung wurde in einem anderen Fenster verändert. Deine lokale Anordnung bleibt erhalten.');
  return { version: version + 1, workspace, mode, windowRole };
}
function projectStory(row: EntityRow): StoryView {
  const content = parseObject(row.content);
  const parsed = storyDocumentSchema.safeParse({ title: row.title, ...content.document as object });
  if (!parsed.success) throw new HttpError(409, 'Dieses Plotdossier enthält einen nicht unterstützten Stand. Die vorhandenen Daten bleiben erhalten.');
  return { ...parsed.data, id: row.id, version: row.version, updatedAt: row.updated_at };
}
export async function readStory(db: D1Database, a: Actor, id: string) {
  gmOnly(a);
  const row = await db.prepare(`SELECT * FROM entities WHERE campaign_id=? AND id=? AND ${storyPredicate}`).bind(a.campaignId, id).first<EntityRow>();
  if (!row) throw new HttpError(404, 'Plotdossier nicht verfügbar.');
  return projectStory(row);
}
export async function listStories(db: D1Database, a: Actor) {
  gmOnly(a);
  const rows = await db.prepare(`SELECT * FROM entities WHERE campaign_id=? AND ${storyPredicate} ORDER BY updated_at DESC,id DESC LIMIT 200`).bind(a.campaignId).all<EntityRow>();
  return rows.results.map(r => {const s=projectStory(r);return {id:s.id,title:s.title,version:s.version,updatedAt:s.updatedAt,summary:s.summary,status:s.status,favorite:s.favorite,pinned:s.pinned,searchText:Object.values(s.sections).map(richTextToPlainText).join(' ').slice(0,20000)};});
}
export async function storyHistory(db: D1Database, a: Actor, id: string): Promise<StoryHistory[]> {
  await readStory(db, a, id);
  const rows = await db.prepare("SELECT id,payload,created_at FROM world_events WHERE campaign_id=? AND entity_id=? AND type IN ('command.story.created','command.story.saved','command.story.restored') ORDER BY json_extract(payload,'$.version') DESC LIMIT 30").bind(a.campaignId, id).all<{ id: string; payload: string; created_at: string }>();
  return rows.results.flatMap(row => { const p = parseObject(row.payload), parsed = storyDocumentSchema.safeParse(p.document); return parsed.success && typeof p.version === 'number' ? [{ id: row.id, version: p.version, createdAt: row.created_at, document: parsed.data }] : []; });
}
export async function writeStory(db: D1Database, a: Actor, args: { id: string; version: number; document: import('@/domain/command-workspace').StoryDocument; create?: boolean; restored?: boolean }) {
  gmOnly(a);
  await validateCommandReferences(db, a, args.document.references);
  await validatePreparationMedia(db,a,Object.values(args.document.sections));
  if (!args.create) await readStory(db, a, args.id);
  const { title, ...document } = args.document;
  const content = JSON.stringify({ documentKind: 'plot_dossier', canonStatus: 'GM_SECRET', document });
  const now = new Date().toISOString(), eventId = crypto.randomUUID();
  const referencesExist = "NOT EXISTS (SELECT 1 FROM json_each(?) wanted WHERE NOT EXISTS (SELECT 1 FROM entities e WHERE e.campaign_id=? AND e.id=wanted.value))";
  const mutation = args.create
    ? db.prepare(`INSERT OR IGNORE INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,title,content,gm_body,version,created_at,updated_at) SELECT ?,?,'CHRONICLE','GM_SECRET',?,'sl',?,?,'',1,?,? WHERE ${referencesExist} AND NOT EXISTS (SELECT 1 FROM world_events WHERE campaign_id=? AND entity_id=? AND type='command.story.deleted')`).bind(args.id, a.campaignId, a.id, title, content, now, now, JSON.stringify(args.document.references), a.campaignId, a.campaignId, args.id)
    : db.prepare(`UPDATE entities SET title=?,content=?,version=version+1,updated_at=? WHERE campaign_id=? AND id=? AND version=? AND ${storyPredicate} AND ${referencesExist}`).bind(title, content, now, a.campaignId, args.id, args.version, JSON.stringify(args.document.references), a.campaignId);
  const results = await db.batch([mutation, db.prepare("INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,?,?,? WHERE changes()=1").bind(eventId, a.campaignId, args.id, a.id, args.create ? 'command.story.created' : args.restored ? 'command.story.restored' : 'command.story.saved', JSON.stringify({ version: args.version + 1, document: args.document }), now)]);
  if (results[0].meta.changes !== 1) {
    if (args.create) { const prior = await readStory(db, a, args.id).catch(() => null); if (prior?.version === 1 && JSON.stringify(storyDocumentSchema.parse({title:prior.title,summary:prior.summary,status:prior.status,favorite:prior.favorite,pinned:prior.pinned,sections:prior.sections,references:prior.references,possibilities:prior.possibilities})) === JSON.stringify(args.document)) return prior; }
    throw new HttpError(409, 'Das Plotdossier wurde inzwischen verändert. Deine Eingabe bleibt erhalten. Lade den Vergleich, bevor du erneut speicherst.');
  }
  return readStory(db, a, args.id);
}
export async function listMoments(db: D1Database, a: Actor, sessionId?: string): Promise<MomentView[]> {
  gmOnly(a);
  const rows = await db.prepare("SELECT * FROM entities WHERE campaign_id=? AND type='NOTE' AND canon_status='GM_SECRET' AND visibility='sl' AND legacy_record_id IS NULL AND json_extract(content,'$.documentKind')='session_moment'" + (sessionId ? " AND json_extract(content,'$.sessionId')=?" : '') + ' ORDER BY created_at DESC,id DESC LIMIT 150').bind(a.campaignId, ...(sessionId ? [sessionId] : [])).all<EntityRow>();
  return rows.results.map(r => { const c = parseObject(r.content); return { id: r.id, text: String(c.text || ''), sessionId: String(c.sessionId || ''), storyId: String(c.storyId || ''), sceneId: String(c.sceneId || ''), runId: String(c.runId || ''), references: Array.isArray(c.references) ? c.references.filter((v): v is string => typeof v === 'string') : [], occurredAt: r.created_at }; });
}
export async function commandReferences(db: D1Database, a: Actor): Promise<CommandReference[]> {
  gmOnly(a);
  const rows = await db.prepare("SELECT * FROM entities WHERE campaign_id=? AND type IN ('NPC','FACTION','PLACE','CLUE','HANDOUT','RULE') AND COALESCE(json_extract(content,'$.recoveryOnly'),0)!=1 ORDER BY title,id LIMIT 500").bind(a.campaignId).all<EntityRow>();
  return rows.results.map(r => { const c = parseObject(r.content); return { id: r.id, title: r.title, type: r.type, summary: richTextToPlainText(String(c.summary || c.text || '')).slice(0, 180) }; });
}
