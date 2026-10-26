import type { Actor } from '../domain/types.ts';
import {isNPCSLKind} from '../domain/npc-profile.ts';
import {locationReservedKind} from '../domain/location-library.ts';
import { contentBlockInputSchema, type ContentBlock, type ContentBlockInput } from '../domain/content-blocks.ts';
import { loadEntities, grantsFor, projectEntity } from './entities.ts';

export class ContentBlockError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
const isSL = (a: Actor) => a.status === 'active' && a.gm && ['campaign_owner','campaign_gm'].includes(a.role);
function requireSL(a: Actor) {
  if (!isSL(a)) throw new ContentBlockError(403, 'Nur für die Spielleitung.');
}
async function requireEntity(db: D1Database, a: Actor, entityId: string) {
  if (a.status !== 'active') throw new ContentBlockError(403, 'Zugang nicht aktiv.');
  const entity = (await loadEntities(db, a.campaignId, entityId))[0];
  const viewer = { ...a, gm: isSL(a) };
  if (!entity || !projectEntity(viewer, entity, await grantsFor(db, viewer)))
    throw new ContentBlockError(404, 'Entität nicht gefunden.');
}
type Row = { id: string; entity_id: string; kind: string; content: string; visibility: ContentBlock['visibility']; position: number };
const block = (r: Row): ContentBlock => ({id:r.id,entityId:r.entity_id,kind:r.kind,content:r.content,visibility:r.visibility,position:r.position});
export async function readContentBlocks(db: D1Database, a: Actor, entityId: string, id?: string) {
  await requireEntity(db, a, entityId);
  // Filter in SQL: secret content is never loaded for a player.
  const rows = await db.prepare("SELECT id,entity_id,kind,content,visibility,position FROM entity_content_blocks WHERE campaign_id=? AND entity_id=? AND kind<>'codex_chapter'" + (isSL(a) ? '' : " AND visibility='player_visible' AND kind NOT LIKE 'location_%' AND kind NOT IN ('sl_secrets','sl_agenda','sl_playstyle')") + (id ? ' AND id=?' : '') + ' ORDER BY position,id')
    .bind(a.campaignId, entityId, ...(id ? [id] : [])).all<Row>();
  if (id && !rows.results.length) throw new ContentBlockError(404, 'Inhaltsblock nicht gefunden.');
  return rows.results.filter(r=>isSL(a)||!isNPCSLKind(r.kind)).map(block);
}
export async function writeContentBlock(db: D1Database, a: Actor, raw: ContentBlockInput, id?: string) {
  requireSL(a);
  const parsed = contentBlockInputSchema.safeParse(raw);
  if (!parsed.success) throw new ContentBlockError(400, 'Ungültiger Inhaltsblock.');
  const d = parsed.data;
  if(locationReservedKind(d.kind))throw new ContentBlockError(403,'Ortskapitel und Ortsmedien werden ausschließlich in der Ortsverwaltung bearbeitet.');
  if(id&&await db.prepare("SELECT id FROM entity_content_blocks WHERE id=? AND campaign_id=? AND kind LIKE 'location_%'").bind(id,a.campaignId).first())throw new ContentBlockError(403,'Geschützter Ortsinhalt.');
  if(d.kind==='codex_chapter')throw new ContentBlockError(403,'Codex-Kapitel werden nur durch den geprüften Import aufbereitet.');
  if(id&&await db.prepare("SELECT id FROM entity_content_blocks WHERE id=? AND campaign_id=? AND kind='codex_chapter'").bind(id,a.campaignId).first())throw new ContentBlockError(403,'Codex-Kapitel werden nur durch den geprüften Import aufbereitet.');
  if(isNPCSLKind(d.kind)&&d.visibility!=='sl_secret')throw new ContentBlockError(400,'SL-Inhalte müssen SL-intern bleiben.');
  await requireEntity(db, a, d.entityId);
  const blockId = id ?? crypto.randomUUID();
  const result = id
    ? await db.prepare('UPDATE entity_content_blocks SET kind=?,content=?,visibility=?,position=? WHERE campaign_id=? AND entity_id=? AND id=?').bind(d.kind,d.content,d.visibility,d.position,a.campaignId,d.entityId,id).run()
    : await db.prepare('INSERT INTO entity_content_blocks(id,campaign_id,entity_id,kind,content,visibility,position) VALUES(?,?,?,?,?,?,?)').bind(blockId,a.campaignId,d.entityId,d.kind,d.content,d.visibility,d.position).run();
  if (!result.meta.changes) throw new ContentBlockError(404, 'Inhaltsblock nicht gefunden.');
  return { id: blockId, ...d };
}
export async function deleteContentBlock(db: D1Database, a: Actor, entityId: string, id: string) {
  requireSL(a);
  await requireEntity(db, a, entityId);
  if(await db.prepare("SELECT id FROM entity_content_blocks WHERE id=? AND campaign_id=? AND kind LIKE 'location_%'").bind(id,a.campaignId).first())throw new ContentBlockError(403,'Ortsinhalte werden über die Ortsverwaltung archiviert.');
  if(await db.prepare("SELECT id FROM entity_content_blocks WHERE id=? AND campaign_id=? AND kind='codex_chapter'").bind(id,a.campaignId).first())throw new ContentBlockError(403,'Codex-Kapitel werden nur durch den geprüften Import aufbereitet.');
  const result = await db.prepare('DELETE FROM entity_content_blocks WHERE campaign_id=? AND entity_id=? AND id=?').bind(a.campaignId,entityId,id).run();
  if (!result.meta.changes) throw new ContentBlockError(404, 'Inhaltsblock nicht gefunden.');
}
