import { validatePreparationMedia } from './preparation-media';
import { richTextToPlainText } from '@/domain/location-rich-text';
import type { Actor, Entity } from '@/domain/types';
import { sceneDocumentSchema, sceneStateSchema, targetKey, participantMatches, type SceneCommand, type SceneDocument, type SceneView, type SceneState, type SceneSummary, type SceneHistory, type SceneTarget, type PlayerScene } from '@/domain/story-scene';
import { gmOnly, HttpError } from '@/server/access';
import { loadEntitiesForIds, parseObject, grantsFor, projectEntity, type EntityRow, type CharacterKnowledgeContext, type GrantRow } from '@/server/entities';
import { characterKnowledgeContext } from '@/server/character-knowledge';
import { readStory, validateCommandReferences } from '@/server/command-workspace';

const predicate = "type='SCENE' AND canon_status='WORKING' AND visibility='sl' AND legacy_record_id IS NULL AND json_extract(content,'$.documentKind')='story_scene'";
function decode(row: EntityRow): SceneView {
  const document = sceneDocumentSchema.safeParse(parseObject(row.gm_body)), state = sceneStateSchema.safeParse(parseObject(row.content));
  if (!document.success || !state.success) throw new HttpError(409, 'Diese Szene enthält einen nicht unterstützten Stand. Vorhandene Daten werden nicht überschrieben.');
  return { id: row.id, version: row.version, updatedAt: row.updated_at, document: document.data, state: state.data };
}
async function sceneRows(db: D1Database, campaignId: string) {
  return (await db.prepare(`SELECT * FROM entities WHERE campaign_id=? AND ${predicate} ORDER BY title,id`).bind(campaignId).all<EntityRow>()).results;
}
export async function readScene(db: D1Database, a: Actor, id: string) {
  gmOnly(a);
  const row = await db.prepare(`SELECT * FROM entities WHERE campaign_id=? AND id=? AND ${predicate}`).bind(a.campaignId, id).first<EntityRow>();
  if (!row) throw new HttpError(404, 'Szene nicht verfügbar.');
  return decode(row);
}
export async function listScenes(db: D1Database, a: Actor): Promise<SceneSummary[]> {
  gmOnly(a);
  return (await sceneRows(db, a.campaignId)).map(row => { const s = decode(row); return { id: s.id, title: s.document.title, storyId: s.document.storyId, placeId: s.document.placeId, version: s.version, updatedAt: s.updatedAt, runs: s.state.runs,parentId:s.document.parentId,sessionIds:s.document.sessionIds,favorite:s.document.favorite,pinned:s.document.pinned,elements:s.document.elements.map(({id,title,kind})=>({id,title,kind})),searchText:[s.document.narration,...s.document.elements.map(e=>e.title+' '+richTextToPlainText(e.text))].join(' ') }; });
}
async function validateDocument(db: D1Database, a: Actor, d: SceneDocument, sceneId:string) {
  if (d.storyId) await readStory(db, a, d.storyId);
  if(d.parentId){
    let next=d.parentId;const seen=new Set([sceneId]);
    while(next){if(seen.has(next))throw new HttpError(400,'Szenen dürfen keinen hierarchischen Kreis bilden.');seen.add(next);const parent=await readScene(db,a,next);if(parent.document.storyId!==d.storyId)throw new HttpError(400,'Unter- und Hauptszene müssen denselben Handlungsstrang verwenden.');next=parent.document.parentId;if(seen.size>100)throw new HttpError(400,'Szenenhierarchie zu tief.');}
  }
  const children=await db.prepare("SELECT gm_body FROM entities WHERE campaign_id=? AND type='SCENE' AND json_extract(CASE WHEN json_valid(gm_body) THEN gm_body ELSE '{}' END,'$.parentId')=?").bind(a.campaignId,sceneId).all<{gm_body:string}>();
  if(children.results.some(c=>parseObject(c.gm_body).storyId!==d.storyId))throw new HttpError(400,'Ein Handlungsstrangwechsel würde Unter-Szenen abtrennen. Vorhandene Verknüpfungen bleiben geschützt.');
  for(const sid of d.sessionIds){if(!await db.prepare("SELECT id FROM records WHERE campaign_id=? AND id=? AND kind='sitzungen'").bind(a.campaignId,sid).first())throw new HttpError(404,'Verknüpfter Spielabend nicht verfügbar.');}
  const elementRefs=d.elements.filter(e=>e.referenceId);
  const ids = [d.placeId, ...d.npcIds, ...d.clueIds,...elementRefs.map(e=>e.referenceId)].filter(Boolean);
  await validateCommandReferences(db, a, ids);
  const entities = await loadEntitiesForIds(db, a.campaignId, ids);
  if (d.placeId && !entities.some(e => e.id === d.placeId && e.type === 'PLACE') ||
    d.npcIds.some(id => !entities.some(e => e.id === id && e.type === 'NPC')) ||
    d.clueIds.some(id => !entities.some(e => e.id === id && ['CLUE', 'HANDOUT'].includes(e.type))))
    throw new HttpError(400, 'Eine Akte passt nicht zu diesem Szenenbereich.');
  for(const e of elementRefs){const target=entities.find(n=>n.id===e.referenceId);const expected=e.kind==='place'?['PLACE']:e.kind==='person'?['NPC','CHARACTER']:e.kind==='clue'?['CLUE']:e.kind==='handout'?['HANDOUT']:e.kind==='puzzle'?['RULE','HANDOUT']:[];if(!expected.includes(target?.type||''))throw new HttpError(400,'Verknüpfung passt nicht zum Elementtyp.');}
  await validatePreparationMedia(db,a,[d.narration,d.atmosphere,d.gmNotes,d.dialogueNotes,d.interactions,d.secrets,d.possibleConsequences,...d.elements.map(e=>e.text)],d.elements.filter(e=>e.fileId).map(e=>({id:e.fileId,kind:e.kind})));
  if(d.elements.some(e=>e.fileId&&!['image','audio','video','handout'].includes(e.kind)))throw new HttpError(400,'Dieser Elementtyp unterstützt keine Datei.');
}
export async function sceneHistory(db: D1Database, a: Actor, id: string): Promise<SceneHistory[]> {
  await readScene(db, a, id);
  const rows = await db.prepare("SELECT id,type,payload,created_at FROM world_events WHERE campaign_id=? AND entity_id=? AND type LIKE 'command.scene.%' ORDER BY json_extract(payload,'$.version') DESC LIMIT 60")
    .bind(a.campaignId, id).all<{ id: string; type: string; payload: string; created_at: string }>();
  return rows.results.flatMap(row => { const p = parseObject(row.payload), d = sceneDocumentSchema.safeParse(p.document), s = sceneStateSchema.safeParse(p.state);
    return d.success && s.success && typeof p.version === 'number' ? [{ id: row.id, version: p.version, action: row.type.slice('command.scene.'.length), createdAt: row.created_at, document: d.data, state: s.data }] : []; });
}

/** One existing SCENE entity is the CAS boundary. Draft, explicit release,
 * knowledge change and audit event commit in the same D1 transaction. */
export async function executeScene(db: D1Database, a: Actor, command: SceneCommand): Promise<SceneView> {
  gmOnly(a);
  const create = command.action === 'create', id = create ? 'scene-' + command.clientRequestId : command.id;
  const before = create ? null : await readScene(db, a, id);
  let document = create || command.action === 'save' ? command.document : before!.document;
  if (!create && before!.version !== command.version) throw new HttpError(409, 'Diese Szene wurde inzwischen verändert. Deine Eingaben bleiben erhalten. Lade den aktuellen Stand zum Vergleichen.');
  const state: SceneState = before ? structuredClone(before.state) : { documentKind: 'story_scene', runs: [], publications: [] };
  const now = new Date().toISOString();
  let grant: { target: SceneTarget; state: 'DISCOVERED' | 'UNKNOWN' } | undefined;
  if(command.action==='restore'){
    const historic=(await sceneHistory(db,a,id)).find(h=>h.id===command.historyId);if(!historic)throw new HttpError(404,'Historischer Stand nicht verfügbar.');document=historic.document;
    // Restore preparation only; do not restore historic runs or audience releases.
  }
  if (create || command.action === 'save' || command.action==='restore') await validateDocument(db, a, document,id);
  if (command.action === 'activate') {
    const session = await db.prepare("SELECT id FROM records WHERE campaign_id=? AND id=? AND kind='sitzungen'").bind(a.campaignId, command.sessionId).first();
    if (!session) throw new HttpError(404, 'Wähle eine vorhandene Sitzung.');
    if (command.participants.scope === 'characters') for (const characterId of command.participants.characterIds) await characterKnowledgeContext(db, a, characterId, true);
    if (state.runs.some(r => r.id === command.runId)) throw new HttpError(409, 'Dieser Szenenlauf wurde bereits angelegt. Lade den aktuellen Stand.');
    state.runs.push({ id: command.runId, sessionId: command.sessionId, label: command.label, participants: command.participants, status: 'active', startedAt: now, updatedAt: now, completedAt: null, previousRunId: null });
  } else if (['pause', 'resume', 'complete', 'reopen'].includes(command.action) && 'runId' in command) {
    const run = state.runs.find(r => r.id === command.runId);
    if (!run) throw new HttpError(404, 'Dieser Szenenlauf ist nicht verfügbar.');
    if (command.action === 'reopen') {
      if (run.status !== 'completed') throw new HttpError(409, 'Nur abgeschlossene Szenen können erneut aufgerufen werden.');
      if (state.runs.some(r => r.id === command.newRunId)) throw new HttpError(409, 'Dieser erneute Aufruf existiert bereits.');
      if (run.participants.scope === 'characters') for (const characterId of run.participants.characterIds) await characterKnowledgeContext(db, a, characterId, true);
      state.runs.push({ ...run, id: command.newRunId, previousRunId: run.id, status: 'active', startedAt: now, updatedAt: now, completedAt: null });
    } else {
      if (command.action === 'pause' && run.status !== 'active' || command.action === 'resume' && run.status !== 'paused' || command.action === 'complete' && run.status === 'completed') throw new HttpError(409, 'Der Szenenlauf hat inzwischen einen anderen Zustand.');
      run.status = command.action === 'pause' ? 'paused' : command.action === 'resume' ? 'active' : 'completed';
      run.updatedAt = now;
      if (run.status === 'completed') run.completedAt = now;
    }
  } else if (command.action === 'publish' || command.action === 'withdraw') {
    if (command.target.scope === 'character') await characterKnowledgeContext(db, a, command.target.characterId, true);
    state.publications = state.publications.filter(p => targetKey(p.target) !== targetKey(command.target));
    if (command.action === 'publish') state.publications.push({ target: command.target, title: document.title, narration: document.narration, placeId: document.placeId, npcIds: document.npcIds, clueIds: document.clueIds, publishedAt: now, sourceVersion: before!.version });
    grant = { target: command.target, state: command.action === 'publish' ? 'DISCOVERED' : 'UNKNOWN' };
  }
  // Apply limits before a write; history is never silently truncated.
  const validState = sceneStateSchema.safeParse(state);
  if (!validState.success) throw new HttpError(400, validState.error.issues[0].message);
  document = sceneDocumentSchema.parse(document);
  const version = create ? 1 : command.version + 1;
  const mutation = create
    ? db.prepare("INSERT OR IGNORE INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,title,content,gm_body,version,created_at,updated_at) SELECT ?,?,'SCENE','WORKING',?,'sl',?,?,?,1,?,? WHERE ?='' OR EXISTS (SELECT 1 FROM entities WHERE campaign_id=? AND id=? AND type='SCENE' AND COALESCE(json_extract(CASE WHEN json_valid(gm_body) THEN gm_body ELSE '{}' END,'$.storyId'),'')=?)").bind(id, a.campaignId, a.id, document.title, JSON.stringify(state), JSON.stringify(document), now, now,document.parentId,a.campaignId,document.parentId,document.storyId)
    : db.prepare(`UPDATE entities SET title=?,content=?,gm_body=?,version=version+1,updated_at=? WHERE campaign_id=? AND id=? AND version=? AND ${predicate} AND NOT EXISTS (WITH RECURSIVE ancestors(id,parent) AS (SELECT id,json_extract(CASE WHEN json_valid(gm_body) THEN gm_body ELSE '{}' END,'$.parentId') FROM entities WHERE campaign_id=? AND id=? UNION SELECT e.id,json_extract(CASE WHEN json_valid(e.gm_body) THEN e.gm_body ELSE '{}' END,'$.parentId') FROM entities e JOIN ancestors p ON e.id=p.parent WHERE e.campaign_id=?) SELECT 1 FROM ancestors WHERE id=?) AND (?='' OR EXISTS(SELECT 1 FROM entities WHERE campaign_id=? AND id=? AND type='SCENE' AND COALESCE(json_extract(CASE WHEN json_valid(gm_body) THEN gm_body ELSE '{}' END,'$.storyId'),'')=?)) AND NOT EXISTS(SELECT 1 FROM entities WHERE campaign_id=? AND type='SCENE' AND json_extract(CASE WHEN json_valid(gm_body) THEN gm_body ELSE '{}' END,'$.parentId')=? AND COALESCE(json_extract(CASE WHEN json_valid(gm_body) THEN gm_body ELSE '{}' END,'$.storyId'),'')!=?)`).bind(document.title, JSON.stringify(state), JSON.stringify(document), now, a.campaignId, id, command.version,a.campaignId,document.parentId,a.campaignId,id,document.parentId,a.campaignId,document.parentId,document.storyId,a.campaignId,id,document.storyId);
  const statements = [mutation];
  if (grant) statements.push(db.prepare(`INSERT INTO knowledge(id,campaign_id,entity_id,audience,subject_id,state,granted_by,created_at,updated_at)
    SELECT ?,?,?,?,?,?,?,?,? WHERE changes()=1 ON CONFLICT(campaign_id,entity_id,audience,subject_id)
    DO UPDATE SET state=excluded.state,version=knowledge.version+1,granted_by=excluded.granted_by,updated_at=excluded.updated_at`)
    .bind(crypto.randomUUID(), a.campaignId, id, grant.target.scope === 'group' ? 'group' : 'character', grant.target.scope === 'group' ? a.campaignId : grant.target.characterId, grant.state, a.id, now, now));
  statements.push(db.prepare("INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,?,?,? WHERE changes()=1")
    .bind(crypto.randomUUID(), a.campaignId, id, a.id, 'command.scene.' + command.action, JSON.stringify({ version, document, state }), now));
  const results = await db.batch(statements);
  if (results[0].meta.changes !== 1) {
    if (create) { const prior = await readScene(db, a, id).catch(() => null); if (prior?.version === 1 && JSON.stringify(prior.document) === JSON.stringify(document)) return prior; }
    throw new HttpError(409, 'Diese Szene wurde parallel verändert. Es wurde nichts überschrieben.');
  }
  return { id, version, updatedAt: now, document, state };
}

function releasedTo(a: Actor, entityId: string, target: SceneTarget, grants: GrantRow[], character?: CharacterKnowledgeContext) {
  return grants.some(g => g.entity_id === entityId && g.state !== 'UNKNOWN' && (target.scope === 'group'
    ? g.audience === 'group' && g.subject_id === a.campaignId
    : g.audience === 'character' && g.subject_id === character?.id && target.characterId === character?.id));
}

/** Player allowlist. No draft title, GM text, future possibilities, audience
 * lists, revision numbers or histories can enter this response. */
export async function playerScenes(db: D1Database, a: Actor, character?: CharacterKnowledgeContext, sessionId?: string): Promise<PlayerScene[]> {
  if (a.status !== 'active' || a.gm || character && (character.ownerId !== a.id || character.campaignId !== a.campaignId)) throw new HttpError(403, 'Diese Spieleransicht ist nicht zulässig.');
  const grants = await grantsFor(db, a, character), rows = await sceneRows(db, a.campaignId);
  const selected = rows.flatMap(row => {
    // Malformed scenes fail closed individually, without exposing their IDs.
    const parsed = sceneStateSchema.safeParse(parseObject(row.content)); if (!parsed.success) return [];
    const state = parsed.data;
    const publication = state.publications.find(p => p.target.scope === 'character' && releasedTo(a, row.id, p.target, grants, character)) || state.publications.find(p => p.target.scope === 'group' && releasedTo(a, row.id, p.target, grants, character));
    return publication ? [{ id: row.id, publication, runs: state.runs.filter(r => participantMatches(r.participants, character?.id) && (!sessionId || r.sessionId === sessionId)) }] : [];
  });
  // One batched world read, independent of the number of scene cards.
  const references = await loadEntitiesForIds(db, a.campaignId, selected.flatMap(s => [s.publication.placeId, ...s.publication.npcIds, ...s.publication.clueIds, ...s.runs.map(r => r.sessionId)]));
  const visible = new Map<string, Entity>();
  for (const e of references) { const projected = projectEntity(a, e, grants, character); if (projected) visible.set(e.id, projected); }
  return selected.map(s => ({ id: s.id, title: s.publication.title, narration: s.publication.narration, publishedAt: s.publication.publishedAt,
    place: visible.has(s.publication.placeId) ? { id: s.publication.placeId, title: visible.get(s.publication.placeId)!.title } : null,
    persons: s.publication.npcIds.flatMap(id => { const e = visible.get(id); return e ? [{ id, title: e.title }] : []; }),
    clues: s.publication.clueIds.flatMap(id => { const e = visible.get(id); return e ? [{ id, title: e.title, text: typeof e.content.text === 'string' ? e.content.text : '', state: grants.find(g => g.entity_id === id && g.state !== 'UNKNOWN')?.state || 'DISCOVERED' }] : []; }),
    runs: s.runs.filter(r => visible.has(r.sessionId)).map(r => ({ id: r.id, sessionId: r.sessionId, label: r.participants.scope === 'group' ? 'Kampagnengruppe' : 'Deine Teilgruppe', status: r.status })),
  }));
}

export async function scenePlayerPreview(db: D1Database, a: Actor, characterId?: string, sessionId?: string) {
  gmOnly(a);
  const character = characterId ? await characterKnowledgeContext(db, a, characterId, true) : undefined;
  const viewer: Actor = { ...a, id: character?.ownerId || 'scene-group-preview', gm: false, role: 'player' };
  return playerScenes(db, viewer, character, sessionId);
}

export async function playerCharacterOptions(db: D1Database, a: Actor) {
  const rows = await db.prepare("SELECT * FROM entities WHERE campaign_id=? AND type='CHARACTER' AND owner_id=? AND canon_status!='GM_SECRET' AND COALESCE(json_extract(content,'$.recoveryOnly'),0)!=1 ORDER BY title,id").bind(a.campaignId, a.id).all<EntityRow>();
  const entities = await loadEntitiesForIds(db, a.campaignId, rows.results.map(r => r.id));
  return entities.filter(e => e.ownerId === a.id && e.type === 'CHARACTER' && e.content.recoveryOnly !== true && e.canonStatus !== 'GM_SECRET').map(e => ({ id: e.id, title: e.title }));
}
