import { z } from "zod";
import type { D1Database } from "@cloudflare/workers-types";
import { bodySlots, carryProfiles, inventoryCategories, inventoryStatuses, type InventoryCharacter, type InventoryItem, type InventoryProjection } from "@/domain/inventory";
import { deriveCarry, placementIssue, slotCategoryIssue } from "@/domain/inventory-rules";
import type { Actor } from "@/domain/types";
import { canRead, HttpError } from "./access";

export const weaponProfileSchema = z.object({ damage: z.string().trim().max(120), range: z.string().trim().max(120), rate: z.string().trim().max(120), capacity: z.string().trim().max(120), concealability: z.string().trim().max(120), currentAmmo: z.number().int().min(0).max(100000).optional(), note: z.string().trim().max(2000).optional(), concealmentClass: z.enum(["T", "J", "M", "N"]).nullable().optional(), weaponType: z.enum(["FIREARM", "MELEE", "OTHER"]).optional(), rulesTemplateId: z.string().trim().max(160).optional() }).strict();
const armorProfileSchema = z.object({ armorClass: z.number().int().min(1).max(5).optional(), armorValue: z.number().min(0).max(100).optional(), dexterityPenalty: z.number().int().min(-20).max(0).optional() }).strict();
const inventoryInputBase = z.object({ characterId: z.string().min(1).max(160), name: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(200), category: z.enum(inventoryCategories), description: z.string().trim().max(10000).default(""), quantity: z.number().int().min(1).max(100000), status: z.enum(inventoryStatuses), visibility: z.enum(["private", "sl", "group"]), imageFileId: z.string().min(1).max(160).optional().nullable(), tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]), weaponProfile: weaponProfileSchema.optional(), armorProfile: armorProfileSchema.optional(), slotCost: z.number().int().min(1).max(20).default(1), weightKg: z.number().min(0).max(100000).optional(), location: z.enum(["STORED", "BACKPACK", "BODY"]).optional(), bodySlot: z.enum(bodySlots).optional(), testData: z.boolean().default(false) }).strict();
function validateCategory(d: z.infer<typeof inventoryInputBase>, c: z.RefinementCtx) {
  const issue = (path: string, message: string) => c.addIssue({ code: "custom", path: [path], message });
  if (d.category !== "Waffe" && d.weaponProfile) issue("weaponProfile", "Ein Waffenprofil ist nur für Waffen erlaubt.");
  if (d.category !== "Schutz / Rüstung" && d.armorProfile) issue("armorProfile", "Rüstungswerte sind nur für Schutz/Rüstung erlaubt.");
  if (d.location === "BODY" && !d.bodySlot) issue("bodySlot", "Bitte einen Körperplatz auswählen.");
  if (d.location !== "BODY" && d.bodySlot) issue("bodySlot", "Ein Körperplatz ist nur am Körper erlaubt.");
  if (d.location === "BODY" && d.status === "Gelagert") issue("status", "Ein gelagerter Gegenstand kann nicht gleichzeitig am Körper liegen.");
  if (d.location === "STORED" && d.status !== "Gelagert") issue("status", "Gegenstände im Lager benötigen den Status Gelagert.");
  const slotIssue = d.location === "BODY" ? slotCategoryIssue(d.category, d.bodySlot) : null;
  if (slotIssue) issue("bodySlot", slotIssue);
}
export const inventoryInputSchema = inventoryInputBase.superRefine(validateCategory);
export const inventoryCreateEnvelopeSchema = inventoryInputBase.extend({ action: z.literal("create"), expectedCarryRevision: z.number().int().min(0).default(0) }).superRefine(validateCategory);
export const inventoryPatchSchema = inventoryInputBase.extend({ id: z.string().startsWith("item.").max(160), expectedRevision: z.number().int().positive(), expectedCarryRevision: z.number().int().min(0).default(0), action: z.enum(["update", "archive"]).default("update") }).superRefine(validateCategory);
export type InventoryInput = z.infer<typeof inventoryInputSchema>;
export type InventoryRecord = { id: string; campaign_id: string; owner_id: string; kind: string; visibility: "private" | "sl" | "group"; title: string; body: string; version: number; created_at: string; updated_at: string };
export function recordBody(row: Pick<InventoryRecord, "body">): Record<string, unknown> { try { const b = JSON.parse(row.body); return b && typeof b === "object" && !Array.isArray(b) ? b : {}; } catch { return {}; } }
function activeCharacter(row: InventoryRecord) { const b = recordBody(row); return b.archived !== true && b.lifecycleStatus !== "ARCHIVED"; }
function isGM(a: Actor) { return a.status === "active" && a.gm && ["campaign_owner", "campaign_gm"].includes(a.role); }
function characterView(row: InventoryRecord, a: Actor): InventoryCharacter { const b = recordBody(row); return { id: row.id, name: row.title, portraitRef: typeof b.portraitRef === "string" ? b.portraitRef : undefined, own: row.owner_id === a.id }; }
export async function characterRecord(db: D1Database, a: Actor, id: string): Promise<InventoryRecord> {
  const row = await db.prepare("SELECT r.* FROM records r JOIN entities e ON e.id=r.id AND e.campaign_id=r.campaign_id WHERE r.id=? AND r.campaign_id=? AND r.kind='charaktere' AND e.canon_status<>'GM_SECRET'").bind(id, a.campaignId).first<InventoryRecord>();
  if (!row || a.status !== "active" || !activeCharacter(row) || (row.owner_id !== a.id && !(isGM(a) && row.visibility !== "private"))) throw new HttpError(404, "Berechtigter aktiver Charakter nicht gefunden.");
  return row;
}
export async function ownCharacters(db: D1Database, a: Actor): Promise<InventoryCharacter[]> {
  const rows = await db.prepare("SELECT r.* FROM records r JOIN entities e ON e.id=r.id AND e.campaign_id=r.campaign_id WHERE r.campaign_id=? AND r.kind='charaktere' AND e.canon_status<>'GM_SECRET' AND (r.owner_id=? OR (?=1 AND r.visibility<>'private')) ORDER BY r.created_at").bind(a.campaignId, a.id, isGM(a) ? 1 : 0).all<InventoryRecord>();
  return rows.results.filter(activeCharacter).map(r => characterView(r, a));
}
export async function selectCharacter(db: D1Database, a: Actor, requested: string | null) {
  const characters = await ownCharacters(db, a);
  if (requested) { const row = await characterRecord(db, a, requested); return { characters, selected: characterView(row, a) }; }
  return { characters, selected: characters.length === 1 ? characters[0] : null };
}
export function parseItem(row: InventoryRecord): InventoryItem | null {
  const b = recordBody(row), location = b.location === "BODY" || b.location === "BACKPACK" || b.location === "STORED" ? b.location : b.status === "Gelagert" ? "STORED" : "BACKPACK";
  // Read legacy statuses without silently normalizing their persisted values.
  const parsed = inventoryInputBase.safeParse({ characterId: b.characterId, name: row.title, category: b.category, description: b.description, quantity: b.quantity, status: b.status, visibility: row.visibility, imageFileId: b.imageFileId, tags: b.tags, weaponProfile: b.weaponProfile, armorProfile: b.armorProfile, slotCost: b.slotCost ?? 1, weightKg: b.weightKg, location, bodySlot: b.bodySlot, testData: b.testData ?? false });
  if (!parsed.success) return null;
  return { id: row.id, ...parsed.data, location, imageFileId: parsed.data.imageFileId || undefined, lifecycleStatus: b.lifecycleStatus === "ARCHIVED" ? "ARCHIVED" : "ACTIVE", revision: row.version, createdAt: row.created_at, updatedAt: row.updated_at, canEdit: true };
}
export async function itemRows(db: D1Database, a: Actor, characterId: string) {
  return (await db.prepare("SELECT r.* FROM relationships rel JOIN records r ON r.id=rel.target_id AND r.campaign_id=rel.campaign_id JOIN entities e ON e.id=r.id AND e.campaign_id=r.campaign_id WHERE rel.campaign_id=? AND rel.source_id=? AND rel.type='character.owns' AND r.kind='inventar' AND e.type='ITEM' AND e.canon_status<>'GM_SECRET' ORDER BY r.updated_at DESC").bind(a.campaignId, characterId).all<InventoryRecord>()).results;
}
export function itemCanEdit(a: Actor, row: InventoryRecord) { return row.owner_id === a.id || (isGM(a) && row.visibility !== "private"); }
export async function ownItem(db: D1Database, a: Actor, id: string) {
  const row = await db.prepare("SELECT r.* FROM records r JOIN entities e ON e.id=r.id AND e.campaign_id=r.campaign_id WHERE r.id=? AND r.campaign_id=? AND r.kind='inventar' AND e.type='ITEM' AND e.canon_status<>'GM_SECRET'").bind(id, a.campaignId).first<InventoryRecord>();
  if (!row || !canRead(a, row) || !itemCanEdit(a, row)) throw new HttpError(404, "Berechtigter Gegenstand nicht gefunden.");
  const characterId = recordBody(row).characterId;
  if (typeof characterId !== "string") throw new HttpError(409, "Die alte Charakterzuordnung muss zuerst geprüft werden.");
  await characterRecord(db, a, characterId);
  const rel = await db.prepare("SELECT 1 ok FROM relationships WHERE campaign_id=? AND source_id=? AND target_id=? AND type='character.owns'").bind(a.campaignId, characterId, id).first();
  if (!rel) throw new HttpError(404, "Gegenstand gehört nicht zu diesem Charakter.");
  return row;
}
export async function validateImage(db: D1Database, a: Actor, fileId: string | undefined | null, visibility: string, existingFileId?: unknown) {
  if (!fileId) return;
  const file = await db.prepare("SELECT owner_id,visibility,mime FROM files WHERE id=? AND campaign_id=?").bind(fileId, a.campaignId).first<{ owner_id: string; visibility: string; mime: string }>();
  // An unchanged, previously authorized attachment can be retained by its item owner.
  if (!file || (file.owner_id !== a.id && fileId !== existingFileId)) throw new HttpError(404, "Eigene Bilddatei nicht gefunden.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.mime)) throw new HttpError(400, "Nur eine gültige Bilddatei darf verknüpft werden.");
  if (visibility !== "private" && file.visibility !== visibility) throw new HttpError(400, "Bild und Gegenstand müssen dieselbe Freigabe besitzen. Bitte ein passend freigegebenes Bild hochladen.");
}
export function itemBody(data: InventoryInput, lifecycleStatus: "ACTIVE" | "ARCHIVED" = "ACTIVE", previous: Record<string, unknown> = {}) {
  const tags = [...new Set(data.tags)], location = data.status === "Gelagert" ? "STORED" : data.location ?? "BACKPACK";
  return JSON.stringify({ ...previous, characterId: data.characterId, category: data.category, description: data.description, quantity: data.quantity, status: data.status, imageFileId: data.imageFileId || undefined, tags, weaponProfile: data.category === "Waffe" ? data.weaponProfile : undefined, armorProfile: data.category === "Schutz / Rüstung" ? data.armorProfile : undefined, slotCost: data.slotCost, weightKg: data.weightKg, location, bodySlot: location === "BODY" ? data.bodySlot : undefined, lifecycleStatus, testData: data.testData || tags.includes("TEST_DATA") });
}
export const emptyCarry = deriveCarry("BODY_ONLY", 0, []);
export async function carryState(db: D1Database, a: Actor, characterId: string, items: InventoryItem[], ownerId = a.id, complete = true) {
  const row = await db.prepare("SELECT body,version FROM records WHERE campaign_id=? AND owner_id=? AND kind='inventory_carry' AND title=?").bind(a.campaignId, ownerId, characterId).first<{ body: string; version: number }>();
  const parsed = z.object({ profile: z.enum(["BODY_ONLY", "BACKPACK_SMALL", "BACKPACK_MEDIUM", "BACKPACK_LARGE"]) }).safeParse(row ? recordBody(row) : null);
  return deriveCarry(parsed.success ? parsed.data.profile : "BODY_ONLY", row?.version ?? 0, items, complete);
}
export function assertPlacement(carry: { capacity: number; used: number }, items: InventoryItem[], candidate: InventoryItem) { const error = placementIssue(carry, items, candidate); if (error) throw new HttpError(409, error); }
export async function inventoryWriteContext(db: D1Database, a: Actor, characterId: string) {
  const character = await characterRecord(db, a, characterId);
  const rows = await itemRows(db, a, characterId), items = rows.map(parseItem);
  if (items.some(i => !i)) throw new HttpError(409, "Dieses Inventar enthält unlesbare Legacy-Daten. Speicherung gestoppt, damit keine bestehenden Gegenstände übergangen werden.");
  const all = items as InventoryItem[];
  return { character, items: all, carry: await carryState(db, a, characterId, all, character.owner_id) };
}
export async function inventoryProjection(db: D1Database, a: Actor, characterId: string | null, includeArchived = false): Promise<InventoryProjection> {
  const { characters, selected } = await selectCharacter(db, a, characterId);
  if (!selected) return { characters, selectedCharacter: null, requiresCharacterSelection: characters.length > 1, inventorySummary: { active: 0, archived: 0, equipped: 0, carried: 0, stored: 0 }, items: [], carry: emptyCarry, permissions: { canCreate: false, canEdit: false, canChangeProfile: false, allowedVisibilities: ["private", "sl", "group"] } };
  const character = await characterRecord(db, a, selected.id);
  const rows = await itemRows(db, a, selected.id);
  const all = rows.filter(r => canRead(a, r)).map(r => { const i = parseItem(r); return i ? { ...i, canEdit: itemCanEdit(a, r) } : null; }).filter((i): i is InventoryItem => !!i);
  const active = all.filter(i => i.lifecycleStatus === "ACTIVE");
  return { characters, selectedCharacter: selected, requiresCharacterSelection: false,
    inventorySummary: { active: active.length, archived: all.length - active.length, equipped: active.filter(i => i.status === "Ausgerüstet").length, carried: active.filter(i => i.status === "Mitgeführt").length, stored: active.filter(i => i.status === "Gelagert").length },
    items: includeArchived ? all : active, carry: await carryState(db, a, selected.id, all, character.owner_id, selected.own),
    permissions: { canCreate: true, canEdit: true, canChangeProfile: selected.own, allowedVisibilities: selected.own ? ["private", "sl", "group"] : ["sl", "group"] } };
}
export { carryProfiles };
