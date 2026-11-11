import type { LegacyRecordRow } from "../domain/legacy.ts";

export type CharacterWriteGuard = { sql: string; bindings: readonly (string | number | null)[] };

export type CharacterEngineWrite = {
  campaignId: string; actorId: string; row: LegacyRecordRow; next: Record<string, unknown>; expectedVersion: number;
  action: string; payload: Record<string, unknown>; visibility?: LegacyRecordRow["visibility"]; gmBody?: string; title?: string; now?: string; guard?: CharacterWriteGuard;
};

/**
 * Compare-and-swap write of a character record together with its audit event.
 * The operation token binds the audit to the winner of the compare-and-swap.
 * Returns null when another write got there first; nothing is stored then.
 */
export async function writeCharacterEngine(db: D1Database, w: CharacterEngineWrite): Promise<LegacyRecordRow | null> {
  const operation = crypto.randomUUID(), now = w.now ?? new Date().toISOString();
  const visibility = w.visibility ?? w.row.visibility, gmBody = w.gmBody ?? w.row.gm_body, title = w.title ?? w.row.title;
  const body = { ...w.next, engineOperationId: operation };
  const condition = w.guard ? ' AND (' + w.guard.sql + ')' : '';
  const results = await db.batch([
    db.prepare("UPDATE records SET title=?,body=?,visibility=?,gm_body=?,version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND version=?" + condition)
      .bind(title, JSON.stringify(body), visibility, gmBody, now, w.row.id, w.campaignId, w.expectedVersion, ...(w.guard?.bindings ?? [])),
    db.prepare("INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,?,?,? FROM records WHERE id=? AND campaign_id=? AND json_extract(body,'$.engineOperationId')=?")
      .bind(operation, w.campaignId, w.row.id, w.actorId, "character." + w.action, JSON.stringify({ ...w.payload, previousVersion: w.expectedVersion, version: w.expectedVersion + 1 }), now, w.row.id, w.campaignId, operation),
  ]);
  if (!results[0].meta.changes) return null;
  return { ...w.row, title, body: JSON.stringify(body), gm_body: gmBody, visibility, version: w.expectedVersion + 1, updated_at: now };
}
