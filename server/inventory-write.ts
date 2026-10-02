import type { D1Database } from "@cloudflare/workers-types";
import type { Actor } from "@/domain/types";
import { HttpError } from "./access";
import { assertPlacement, inventoryWriteContext, itemBody, recordBody, validateImage, type InventoryInput, type InventoryRecord } from "./inventory";

/** One character carry CAS guards every item/entity/ownership/audit write in the
 * same D1 transaction. A unique operation ID prevents a losing request from
 * borrowing the winner's incremented revision. No ownership transfer here. */
export async function writeInventoryItem(db: D1Database, a: Actor, data: InventoryInput, expectedCarryRevision: number, old?: InventoryRecord, action: "update" | "archive" = "update") {
  const context = await inventoryWriteContext(db, a, data.characterId);
  if (context.character.owner_id !== a.id && data.visibility === "private") throw new HttpError(403, "Die Spielleitung darf fremde Gegenstände nicht privat an sich ziehen.");
  const previous = old ? recordBody(old) : {};
  if (old && previous.characterId !== data.characterId) throw new HttpError(400, "Die Character-Zuordnung darf nicht geändert werden.");
  await validateImage(db, a, data.imageFileId, data.visibility, previous.imageFileId);
  if (context.carry.revision !== expectedCarryRevision) throw new HttpError(409, "Das Inventar wurde inzwischen geändert. Bitte den aktuellen Stand laden.");
  const id = old?.id ?? "item." + crypto.randomUUID(), owner = old?.owner_id ?? context.character.owner_id;
  const now = new Date().toISOString(), op = crypto.randomUUID(), carryId = "carry." + data.characterId;
  const lifecycleStatus = action === "archive" ? "ARCHIVED" : "ACTIVE";
  try { assertPlacement(context.carry, context.items, { ...data, id, imageFileId: data.imageFileId || undefined, location: data.status === "Gelagert" ? "STORED" : data.location ?? "BACKPACK", lifecycleStatus, revision: old?.version ?? 0, createdAt: now, updatedAt: now, canEdit: true }); } catch (e) { if (context.character.owner_id !== a.id && context.items.some(i => i.visibility === "private")) throw new HttpError(409, "Diese Platzierung ist im vollständigen Inventar nicht möglich. Bitte den Eigentümer Kapazität und Belegung prüfen lassen; private Gegenstände bleiben verborgen."); throw e; }
  const body = itemBody(data, lifecycleStatus, previous), nextRevision = (old?.version ?? 0) + 1;
  const guard = "EXISTS(SELECT 1 FROM records c WHERE c.id=? AND c.campaign_id=? AND c.owner_id=? AND c.kind='inventory_carry' AND json_extract(c.body,'$._inventoryMutation')=?)";
  const guardArgs = [carryId, a.campaignId, context.character.owner_id, op];
  const statements = [
    db.prepare("INSERT OR IGNORE INTO records(id,campaign_id,owner_id,kind,visibility,title,body,gm_body,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(carryId, a.campaignId, context.character.owner_id, "inventory_carry", "private", data.characterId, '{"profile":"BODY_ONLY"}', "", 0, now, now),
    db.prepare("UPDATE records SET body=json_set(body,'$._inventoryMutation',?,'$._inventoryActor',?),version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND owner_id=? AND kind='inventory_carry' AND version=?" + (old ? " AND EXISTS(SELECT 1 FROM records i WHERE i.id=? AND i.campaign_id=? AND i.owner_id=? AND i.kind='inventar' AND i.version=?)" : ""))
      .bind(op, a.id, now, carryId, a.campaignId, context.character.owner_id, expectedCarryRevision, ...(old ? [old.id, a.campaignId, owner, old.version] : [])),
    old ? db.prepare("UPDATE records SET title=?,visibility=?,body=?,version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND owner_id=? AND kind='inventar' AND version=? AND " + guard).bind(data.name, data.visibility, body, now, id, a.campaignId, owner, old.version, ...guardArgs)
      : db.prepare("INSERT INTO records(id,campaign_id,owner_id,kind,visibility,title,body,gm_body,version,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE " + guard).bind(id, a.campaignId, owner, "inventar", data.visibility, data.name, body, "", 1, now, now, ...guardArgs),
    db.prepare("UPDATE entities SET type='ITEM',canon_status='WORKING',visibility=?,title=?,content=?,version=?,updated_at=? WHERE id=? AND campaign_id=? AND " + guard).bind(data.visibility, data.name, body, nextRevision, now, id, a.campaignId, ...guardArgs),
    old ? db.prepare("UPDATE relationships SET visibility=? WHERE campaign_id=? AND source_id=? AND target_id=? AND type='character.owns' AND " + guard).bind(data.visibility, a.campaignId, data.characterId, id, ...guardArgs)
      : db.prepare("INSERT INTO relationships(id,campaign_id,source_id,target_id,type,visibility,created_at) SELECT ?,?,?,?,?,?,? WHERE " + guard).bind(crypto.randomUUID(), a.campaignId, data.characterId, id, "character.owns", data.visibility, now, ...guardArgs),
    db.prepare("INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,?,?,? WHERE " + guard).bind(op, a.campaignId, id, a.id, old ? "inventory." + action : "inventory.created", JSON.stringify({ characterId: data.characterId, revision: nextRevision }), now, ...guardArgs),
  ];
  const results = await db.batch(statements);
  if (!results[1].meta.changes || !results[2].meta.changes) throw new HttpError(409, "Konflikt: Gegenstand oder Trageprofil wurde inzwischen geändert. Deine Eingabe wurde nicht übernommen. Bitte neu laden.");
  return { id, revision: nextRevision };
}
