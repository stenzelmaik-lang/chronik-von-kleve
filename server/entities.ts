import { canManageCampaignCharacter } from '../domain/character-access.ts';
import {hasNPCFieldVisibility,npcFieldVisibility,projectNPCFields} from '../domain/npc-profile.ts';
import type {
  Actor,
  Entity,
  EntityType,
  CanonStatus,
  Visibility,
  JsonObject,
} from "@/domain/types";
import type { LegacyRecordRow } from "@/domain/legacy";

export type EntityRow = {
  id: string;
  campaign_id: string;
  type: EntityType;
  canon_status: CanonStatus;
  play_state?: Entity["playState"];
  replaced_by?: string | null;
  default_visibility?: Entity["defaultVisibility"];
  legacy_record_id: string | null;
  owner_id: string;
  visibility: Visibility;
  title: string;
  content: string;
  gm_body: string;
  version: number;
  created_at: string;
  updated_at: string;
};
export type GrantRow = {
  entity_id: string;
  audience: "group" | "player" | "character";
  subject_id: string;
  state: string;
};
export type CharacterKnowledgeContext = { id: string; ownerId: string; campaignId: string };
export function parseObject(raw: string): JsonObject {
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v)
      ? (v as JsonObject)
      : {};
  } catch {
    return {};
  }
}
export function resolveEntity(
  row: EntityRow,
  legacy?: LegacyRecordRow,
): Entity {
  // NPC edits live on the original Entity. Legacy data remain untouched and
  // supply only values that have not been explicitly overridden on that Entity.
  const npc = row.type === 'NPC';
  return {
    id: row.id,
    campaignId: row.campaign_id,
    type: row.type,
    canonStatus: row.canon_status,
    playState: row.play_state ?? null,
    replacedBy: row.replaced_by ?? null,
    defaultVisibility: row.default_visibility ?? null,
    legacyRecordId: row.legacy_record_id,
    ownerId: legacy?.owner_id ?? row.owner_id,
    visibility: legacy?.visibility ?? row.visibility,
    title: npc && row.title ? row.title : legacy?.title ?? row.title,
    content: npc ? {...parseObject(legacy?.body ?? '{}'),...parseObject(row.content)} : parseObject(legacy?.body ?? row.content),
    gmBody: legacy?.gm_body ?? row.gm_body,
    version: npc ? row.version : legacy?.version ?? row.version,
    createdAt: legacy?.created_at ?? row.created_at,
    updatedAt: npc && row.title ? row.updated_at : legacy?.updated_at ?? row.updated_at,
  };
}
// The only player projection: secret values never enter a client response.
export function playerContent(value: JsonObject): JsonObject {
  const clean: JsonObject = {};
  for (const [key, item] of Object.entries(value)) {
    if (/^(gm_?body|gm_?secret|sl_?text|sl_?secret|sl_preparation|secret|secrets)$/i.test(key))
      continue;
    if (
      (key === "rules" && value.rules_unlocked === false) ||
      (key === "encounters" && value.encounters_unlocked === false)
    )
      continue;
    const sanitize = (v: typeof item): typeof item | undefined => {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        if (v.canonStatus === "GM_SECRET" || v.canon_status === "GM_SECRET")
          return undefined;
        return playerContent(v);
      }
      if (Array.isArray(v))
        return v
          .map(sanitize)
          .filter((x): x is NonNullable<typeof x> | null => x !== undefined);
      return v;
    };
    const result = sanitize(item);
    if (result !== undefined) clean[key] = result;
  }
  return clean;
}
export function projectEntity(
  a: Actor,
  e: Entity,
  grants: GrantRow[],
  character?: CharacterKnowledgeContext,
): Entity | null {
  if (a.status !== "active" || a.campaignId !== e.campaignId) return null;
  // Collaboration internals are authorized only by the dedicated room API.
  if (['live-table','live-table-signal','live-table-event'].includes(String(e.content.context))) return null;
  // Recipient privacy is stronger than knowledge grants and generic GM access.
  if (e.content.context === "sl-message") {
    if (e.ownerId !== a.id && !(a.gm && e.content.senderId === a.id)) return null;
    return { ...e, content: { context: "sl-message", text: e.content.text ?? "", senderName: e.content.senderName ?? "", readAt: e.content.readAt ?? null } };
  }
  if (e.type === "CHARACTER" && e.ownerId !== a.id && !canManageCampaignCharacter(a, e.campaignId)) return null;
  if (a.gm) return e;
  if (['archived','deleted'].includes(String(e.content.locationLifecycle))) return null;
  if (e.defaultVisibility === 'sl_secret') return null;
  // Scene preparation and runtime metadata require the dedicated allowlist
  // projector. A generic grant must never disclose the private scene dossier.
  if (e.type === "SCENE" && e.content.documentKind === "story_scene") return null;
  if (e.content.recoveryOnly === true || e.canonStatus === "GM_SECRET" || e.content.canonStatus === "GM_SECRET" || e.content.canon_status === "GM_SECRET") return null;
  const granted = grants.some(
    (g) =>
      g.entity_id === e.id &&
      g.state !== "UNKNOWN" &&
      ((g.audience === "group" && g.subject_id === a.campaignId) ||
        (g.audience === "player" && g.subject_id === a.id) ||
        (g.audience === "character" && character?.ownerId === a.id && character.campaignId === a.campaignId && g.subject_id === character.id)),
  );
  // Existing shared records keep their visibility, except explicitly locked bodies.
  const legacyShared =
    !!e.legacyRecordId &&
    e.visibility === "group" &&
    e.content.discovered !== false &&
    e.content.content_unlocked !== false;
  const owner = e.ownerId === a.id;
  if (!granted && !legacyShared && !owner && e.defaultVisibility !== 'player_visible') return null;
  // Replacement targets may be secret; only the GM gets the raw reference.
  const { gmBody: _secret, replacedBy: _replacement, ...safe } = e;
  void _secret;
  void _replacement;
  const content=playerContent(e.type==='NPC'?projectNPCFields(e.content):e.content);
  // A permitted reader must also be able to open the existing map view.
  // These are response flags only; the canonical legacy body remains untouched.
  if(granted){if(content.discovered===false)content.discovered=true;if(content.content_unlocked===false)content.content_unlocked=true;}
  return { ...safe, title:e.type==='NPC'&&hasNPCFieldVisibility(e.content)&&npcFieldVisibility(e.content,'name')!=='player_visible'?'Unbekannte Persönlichkeit':safe.title, content };
}
export async function loadEntities(
  db: D1Database,
  campaignId: string,
  id?: string,
) {
  const [entities, records] = await db.batch([
    db
      .prepare(
        "SELECT * FROM entities WHERE campaign_id=?" + (id ? " AND id=?" : ""),
      )
      .bind(...(id ? [campaignId, id] : [campaignId])),
    db
      .prepare(
        "SELECT * FROM records WHERE campaign_id=?" + (id ? " AND id=?" : ""),
      )
      .bind(...(id ? [campaignId, id] : [campaignId])),
  ]);
  const legacy = new Map(
    (records.results as LegacyRecordRow[]).map((r) => [r.id, r]),
  );
  return (entities.results as EntityRow[]).map((r) =>
    resolveEntity(
      r,
      r.legacy_record_id ? legacy.get(r.legacy_record_id) : undefined,
    ),
  );
}

/** Load only the requested campaign entities and the legacy rows they reference. */
export async function loadEntitiesForIds(
  db: D1Database,
  campaignId: string,
  ids: readonly string[],
) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return [];
  // Keep each statement safely below D1's SQLite bind-variable ceiling.
  const chunks = <T,>(values: T[]) => Array.from({ length: Math.ceil(values.length / 80) }, (_, index) => values.slice(index * 80, index * 80 + 80));
  const entityBatches = await db.batch(chunks(uniqueIds).map((idsInChunk) =>
    db.prepare(`SELECT * FROM entities WHERE campaign_id=? AND id IN (${idsInChunk.map(() => "?").join(",")})`)
      .bind(campaignId, ...idsInChunk),
  ));
  const entityRows = entityBatches.flatMap((batch) => batch.results as EntityRow[]);
  if (!entityRows.length) return [];
  const legacyIds = [...new Set(entityRows.flatMap((row) => row.legacy_record_id ? [row.legacy_record_id] : []))];
  const legacyBatches = legacyIds.length
    ? await db.batch(chunks(legacyIds).map((idsInChunk) =>
        db.prepare(`SELECT * FROM records WHERE campaign_id=? AND id IN (${idsInChunk.map(() => "?").join(",")})`)
          .bind(campaignId, ...idsInChunk),
      ))
    : [];
  const legacy = new Map(legacyBatches.flatMap((batch) => batch.results as LegacyRecordRow[]).map((row) => [row.id, row]));
  return entityRows.map((row) => resolveEntity(row, row.legacy_record_id ? legacy.get(row.legacy_record_id) : undefined));
}
export async function grantsFor(db: D1Database, a: Actor, character?: CharacterKnowledgeContext): Promise<GrantRow[]> {
  const characterId = character?.ownerId === a.id && character.campaignId === a.campaignId ? character.id : '';
  const result = await db
    .prepare(
      "SELECT entity_id,audience,subject_id,state FROM knowledge WHERE campaign_id=? AND ((audience=? AND subject_id=?) OR (audience=? AND subject_id=?) OR (audience='character' AND subject_id=?))",
    )
    .bind(a.campaignId, "group", a.campaignId, "player", a.id, characterId)
    .all<GrantRow>();
  return result.results;
}
