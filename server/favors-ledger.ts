import type { Actor } from '../domain/types.ts';
import { activeCharacterBody } from '../domain/character-selection.ts';
import { hasNPCFieldVisibility, npcFieldVisibility } from '../domain/npc-profile.ts';
import { availableFavorActions, readLegacyFavors, transitionFavor, type FavorDirection, type FavorKind, type FavorRole, type FavorStatus, type FavorTransition, type FavorVisibility } from '../domain/favors-ledger.ts';
import { HttpError } from './database.ts';
import { grantsFor, loadEntities, projectEntity } from './entities.ts';
import { parseBody } from './xp-reward-errors.ts';

type Scope = { actor: Actor; sl: boolean };
type Choice = { id: string; title: string };
type Row = {
  id: string; character_id: string; npc_id: string; direction: FavorDirection; kind: FavorKind; tier: number | null;
  markers: number; remaining: number; status: FavorStatus; visibility: FavorVisibility; description: string; terms: string;
  due_on: string | null; gm_note: string; legacy_key: string | null; created_by: string; updated_at: string; version: number;
};
type Proposal = {
  operationId: string; characterId: string; npcId: string; direction: FavorDirection; kind: FavorKind;
  tier?: number; markers?: number; description: string; terms: string; dueOn?: string; visibility: FavorVisibility;
  gmNote?: string; legacyKey?: string;
};
type Transition = FavorTransition & {
  id: string; version: number; operationId: string; reason: string;
  description?: string; terms?: string; dueOn?: string | null; tier?: number; gmNote?: string;
};

async function catalog(db: D1Database, scope: Scope) {
  const { actor: a, sl } = scope;
  const viewer = sl ? a : { ...a, gm: false, role: 'player' as const };
  const [characters, entities, grants] = await Promise.all([
    db.prepare(`SELECT r.id,r.title,r.body FROM records r
      WHERE r.campaign_id=? AND r.kind='charaktere' AND (?=1 OR r.owner_id=?)
        AND NOT EXISTS(SELECT 1 FROM entities e WHERE e.id=r.id AND e.campaign_id=r.campaign_id AND e.canon_status='GM_SECRET')
      ORDER BY r.title,r.id`).bind(a.campaignId, Number(sl), a.id).all<Choice & { body: string }>(),
    loadEntities(db, a.campaignId),
    grantsFor(db, viewer),
  ]);
  return {
    characters: characters.results.flatMap(({ id, title, body }) => {
      const parsed = parseBody(body);
      return activeCharacterBody(parsed) && parsed.canonStatus !== 'GM_SECRET' ? [{ id, title }] : [];
    }),
    npcs: entities.flatMap(entity => {
      if (entity.type !== 'NPC' || entity.replacedBy) return [];
      if (!sl && hasNPCFieldVisibility(entity.content) && npcFieldVisibility(entity.content, 'name') !== 'player_visible') return [];
      const projected = projectEntity(viewer, entity, grants);
      return projected?.title ? [{ id: entity.id, title: projected.title }] : [];
    }).sort((a, b) => a.title.localeCompare(b.title, 'de')),
  };
}

const state = (row: Row) => ({ npcId: row.npc_id, kind: row.kind, direction: row.direction, status: row.status, markers: row.markers, remaining: row.remaining });
const role = (scope: Scope, row: Row): FavorRole => scope.sl ? 'sl' : row.direction === 'owes' ? 'debtor' : 'creditor';
const readable = (row: Row, scope: Scope, options: Awaited<ReturnType<typeof catalog>>) => scope.sl ||
  (row.visibility === 'parties' && (row.status !== 'proposed' || row.created_by === scope.actor.id) &&
    options.characters.some(choice => choice.id === row.character_id) && options.npcs.some(choice => choice.id === row.npc_id));

async function legacyFavors(db: D1Database, a: Actor) {
  const records = await db.prepare("SELECT id,version,body FROM records WHERE campaign_id=? AND owner_id=? AND kind='gefallen' ORDER BY id")
    .bind(a.campaignId, a.id).all<{ id: string; version: number; body: string }>();
  return records.results.flatMap(r => readLegacyFavors(r.id, r.version, parseBody(r.body)));
}

export async function favorsOverview(db: D1Database, scope: Scope, id?: string) {
  const { actor: a, sl } = scope;
  const [options, records, legacy, crises] = await Promise.all([
    catalog(db, scope),
    db.prepare(`SELECT f.* FROM favor_obligations f
      WHERE f.campaign_id=? AND (? IS NULL OR f.id=?) AND (?=1 OR (
        f.visibility='parties' AND EXISTS(SELECT 1 FROM records r WHERE r.id=f.character_id AND r.campaign_id=f.campaign_id AND r.owner_id=?)
      )) ORDER BY f.updated_at DESC,f.id`).bind(a.campaignId, id ?? null, id ?? null, Number(sl), a.id).all<Row>(),
    sl || id ? [] : legacyFavors(db, a),
    sl && !id ? db.prepare(`SELECT c.id,c.character_id,c.npc_id,c.opened_at,c.closed_at,c.decision,c.decision_at,c.version,
      (SELECT COALESCE(SUM(f.remaining),0) FROM favor_obligations f WHERE f.campaign_id=c.campaign_id
        AND f.character_id=c.character_id AND f.npc_id=c.npc_id AND f.kind='debt' AND f.direction='owes'
        AND f.status IN ('confirmed','called','partial','disputed')) AS markers
      FROM favor_crises c WHERE c.campaign_id=? ORDER BY c.closed_at IS NOT NULL,c.opened_at DESC LIMIT 150`)
      .bind(a.campaignId).all<{ id: string; character_id: string; npc_id: string; opened_at: string; closed_at: string | null; markers: number;
        decision: string | null; decision_at: string | null; version: number }>() : null,
  ]);
  const title = (choices: Choice[], key: string) => choices.find(item => item.id === key)?.title ?? 'Archiviert';
  const visible = records.results.filter(row => readable(row, scope, options));
  if (id && visible.length === 0) throw new HttpError(404, 'Gefallen nicht verfügbar.');
  const history = id ? (await db.prepare(`SELECT e.version,e.action,e.reason,e.details,e.created_at,m.name AS actor
    FROM favor_events e LEFT JOIN members m ON m.id=e.actor_id WHERE e.obligation_id=? ORDER BY e.version`)
    .bind(id).all<{ version: number; action: string; reason: string; details: string; created_at: string; actor: string | null }>()).results.map(event => {
      const { status, remaining } = parseBody(event.details);
      return { version: event.version, action: event.action, reason: event.reason, at: event.created_at,
        details: sl ? parseBody(event.details) : { status, remaining }, ...(sl ? { actor: event.actor } : {}) };
    }) : [];
  const imported = new Set(!sl && !id ? (await db.prepare('SELECT legacy_key FROM favor_obligations WHERE campaign_id=? AND created_by=? AND legacy_key IS NOT NULL')
    .bind(a.campaignId, a.id).all<{ legacy_key: string }>()).results.map(row => row.legacy_key) : []);
  return {
    ...options, legacy: legacy.map(entry => ({ ...entry, imported: imported.has(entry.key) })), history,
    obligations: visible.map(row => ({
      id: row.id, ...state(row), characterId: row.character_id, character: title(options.characters, row.character_id),
      npc: title(options.npcs, row.npc_id), tier: row.tier, visibility: row.visibility, description: row.description,
      terms: row.terms, dueOn: row.due_on, updatedAt: row.updated_at, version: row.version,
      actions: availableFavorActions(state(row), role(scope, row)), ...(sl ? { gmNote: row.gm_note } : {}),
    })),
    crises: crises?.results.map(row => ({
      id: row.id, character: title(options.characters, row.character_id), npc: title(options.npcs, row.npc_id),
      openedAt: row.opened_at, closedAt: row.closed_at, markers: row.markers,
      decision: row.decision, decisionAt: row.decision_at, version: row.version,
    })) ?? [],
  };
}

function amounts(kind: FavorKind, tier?: number, markers?: number) {
  if (kind === 'debt' && Number.isInteger(markers) && markers! >= 1 && markers! <= 20 && tier === undefined) return { tier: null, markers: markers! };
  if (kind === 'favor' && Number.isInteger(tier) && tier! >= 1 && tier! <= 3 && markers === undefined) return { tier: tier!, markers: 0 };
  if (kind === 'trade' && tier === undefined && markers === undefined) return { tier: null, markers: 0 };
  throw new HttpError(400, 'Gewicht und Marker müssen zur Art der Verpflichtung passen.');
}

export async function proposeFavor(db: D1Database, scope: Scope, data: Proposal, now: string) {
  const { actor: a, sl } = scope;
  if (!sl && (data.visibility !== 'parties' || data.gmNote)) throw new HttpError(403, 'Diese Sichtbarkeit ist der Spielleitung vorbehalten.');
  const options = await catalog(db, scope);
  if (!options.characters.some(c => c.id === data.characterId) || !options.npcs.some(n => n.id === data.npcId))
    throw new HttpError(404, 'Beteiligte Figur nicht verfügbar.');
  if (data.legacyKey && !(await legacyFavors(db, a)).some(row => row.key === data.legacyKey))
    throw new HttpError(404, 'Alter Eintrag nicht verfügbar.');
  const { tier, markers } = amounts(data.kind, data.tier, data.markers);
  const write = db.prepare(`INSERT INTO favor_obligations
    (id,campaign_id,character_id,npc_id,direction,kind,tier,markers,remaining,status,visibility,description,terms,due_on,gm_note,legacy_key,created_by,created_at,updated_at)
    SELECT ?,?,?,?,?,?,?,?,?,'proposed',?,?,?,?,?,?,?,?,?
    WHERE NOT EXISTS(SELECT 1 FROM favor_events WHERE id=?) ON CONFLICT DO NOTHING`)
    .bind(data.operationId, a.campaignId, data.characterId, data.npcId, data.direction, data.kind, tier, markers, markers,
      data.visibility, data.description, data.terms, data.dueOn ?? null, data.gmNote ?? '', data.legacyKey ?? null, a.id, now, now, data.operationId);
  const [result] = await db.batch([write, favorEvent(db, data.operationId, data.operationId, 1, a.id, 'propose', '', { status: 'proposed', remaining: markers }, now)]);
  if (result.meta.changes) return { id: data.operationId };
  const existing = await db.prepare(`SELECT id FROM favor_obligations WHERE campaign_id=? AND created_by=?
    AND (id=? OR (legacy_key IS NOT NULL AND legacy_key=?))`).bind(a.campaignId, a.id, data.operationId, data.legacyKey ?? null).first<{ id: string }>();
  if (existing) return existing;
  throw new HttpError(409, 'Dieser Vorschlag wurde inzwischen geändert.');
}

function favorEvent(db: D1Database, id: string, obligation: string, version: number, actor: string, action: string, reason: string, details: object, now: string) {
  return db.prepare('INSERT INTO favor_events(id,obligation_id,version,actor_id,action,reason,details,created_at) SELECT ?,?,?,?,?,?,?,? WHERE changes()=1')
    .bind(id, obligation, version, actor, action, reason, JSON.stringify(details), now);
}

export async function changeFavor(db: D1Database, scope: Scope, data: Transition, now: string) {
  const { actor: a } = scope;
  const [options, row] = await Promise.all([
    catalog(db, scope),
    db.prepare('SELECT * FROM favor_obligations WHERE id=? AND campaign_id=?').bind(data.id, a.campaignId).first<Row>(),
  ]);
  if (!row || !readable(row, scope, options)) throw new HttpError(404, 'Gefallen nicht verfügbar.');
  const replayed = () => db.prepare('SELECT 1 FROM favor_events WHERE id=? AND obligation_id=? AND actor_id=? AND action=?')
    .bind(data.operationId, data.id, a.id, data.action).first();
  if (await replayed()) return { id: row.id, version: row.version };
  if (row.version !== data.version) throw new HttpError(409, 'Der Eintrag wurde inzwischen geändert. Bitte neu laden.');
  let next;
  try { next = transitionFavor(state(row), data, role(scope, row)); }
  catch (error) { throw new HttpError(409, (error as Error).message); }
  if (next.npcId !== row.npc_id && !options.npcs.some(n => n.id === next.npcId)) throw new HttpError(404, 'Zielkontakt nicht verfügbar.');
  const edit = data.action === 'amend';
  const tier = edit && row.kind === 'favor' ? data.tier ?? row.tier : row.tier;
  const description = edit ? data.description ?? row.description : row.description;
  const terms = edit ? data.terms ?? row.terms : row.terms;
  const dueOn = edit && data.dueOn !== undefined ? data.dueOn : row.due_on;
  const gmNote = edit ? data.gmNote ?? row.gm_note : row.gm_note;
  const write = db.prepare(`UPDATE favor_obligations SET npc_id=?,tier=?,markers=?,remaining=?,status=?,description=?,terms=?,due_on=?,gm_note=?,version=version+1,updated_at=?
    WHERE id=? AND campaign_id=? AND version=? AND NOT EXISTS(SELECT 1 FROM favor_events WHERE id=?)
      AND (?=1 OR EXISTS(SELECT 1 FROM records r WHERE r.id=favor_obligations.character_id
        AND r.campaign_id=favor_obligations.campaign_id AND r.owner_id=?))`)
    .bind(next.npcId, tier, next.markers, next.remaining, next.status, description, terms, dueOn, gmNote,
      now, row.id, a.campaignId, row.version, data.operationId, Number(scope.sl), a.id);
  const [result] = await db.batch([write, favorEvent(db, data.operationId, row.id, row.version + 1, a.id, data.action,
    data.reason, { status: next.status, remaining: next.remaining, previousStatus: row.status, previousRemaining: row.remaining,
      previousNpc: row.npc_id, npc: next.npcId, tier, markers: next.markers,
      ...(edit ? { previous: { description: row.description, terms: row.terms, dueOn: row.due_on, tier: row.tier, markers: row.markers },
        current: { description, terms, dueOn, tier, markers: next.markers }, gmNoteChanged: gmNote !== row.gm_note } : {}),
    }, now)]);
  if (result.meta.changes) return { id: row.id, version: row.version + 1 };
  if (await replayed()) return { id: row.id, version: row.version + 1 };
  throw new HttpError(409, 'Der Eintrag wurde inzwischen geändert. Bitte neu laden.');
}

export async function decideFavorCrisis(db: D1Database, scope: Scope, data: { id: string; version: number; operationId: string; decision: string }, now: string) {
  if (!scope.sl) throw new HttpError(403, 'Die Spielleitung entscheidet über Krisen.');
  const { campaignId, id: actorId } = scope.actor;
  const replayed = () => db.prepare(`SELECT 1 FROM world_events WHERE id=? AND campaign_id=? AND entity_id=? AND actor_id=? AND type='favor.crisis_decision'`)
    .bind(data.operationId, campaignId, data.id, actorId).first();
  if (await replayed()) return { id: data.id };
  const [write] = await db.batch([
    db.prepare(`UPDATE favor_crises SET decision=?,decision_at=?,version=version+1 WHERE id=? AND campaign_id=?
      AND version=? AND closed_at IS NULL AND NOT EXISTS(SELECT 1 FROM world_events WHERE id=?)`)
      .bind(data.decision, now, data.id, campaignId, data.version, data.operationId),
    db.prepare(`INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at)
      SELECT ?,?,?,?,'favor.crisis_decision',?,? WHERE changes()=1`)
      .bind(data.operationId, campaignId, data.id, actorId, JSON.stringify({ decision: data.decision, version: data.version + 1 }), now),
  ]);
  if (write.meta.changes || await replayed()) return { id: data.id };
  throw new HttpError(409, 'Dieser Krisenfall ist geschlossen oder wurde inzwischen geändert.');
}
