import { xpBalance } from "@/domain/character-engine";
import type { Actor } from "@/domain/types";
import type { FileRow, LegacyRecordRow } from "@/domain/legacy";
import { canEdit, canRead } from "./access";
import { canManageCampaignCharacter } from '@/domain/character-access';
import {
  grantsFor,
  loadEntitiesForIds,
  projectEntity,
  resolveEntity,
  type EntityRow,
  type GrantRow,
} from "./entities";

type RelationshipRow = {
  id: string;
  campaign_id: string;
  source_id: string;
  target_id: string;
  type: string;
  visibility: "private" | "sl" | "group";
  created_at: string;
};

type CharacterMediaBody = {
  fileId?: unknown;
  type?: unknown;
  ref?: unknown;
};

const mediaTypes = new Set(["portrait", "reference", "mood", "scene"]);
const publicImage = /^\/images\/[a-zA-Z0-9_.-]+$/;
const fileRef = /^\/api\/files\?id=([a-zA-Z0-9-]+)$/;

function object(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function parseBody(raw: string): Record<string, unknown> {
  try {
    return object(JSON.parse(raw));
  } catch {
    return {};
  }
}

function stringValue(v: unknown, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function fileIdFromRef(ref: unknown) {
  if (typeof ref !== "string") return null;
  const match = ref.match(fileRef);
  return match?.[1] || null;
}

function characterMediaEntries(content: Record<string, unknown>) {
  const rows = Array.isArray(content.characterMedia)
    ? (content.characterMedia as CharacterMediaBody[])
    : [];
  return rows
    .map((row) => {
      const fileId = stringValue(row.fileId);
      const type = stringValue(row.type, "reference");
      return fileId && mediaTypes.has(type) ? { fileId, type } : null;
    })
    .filter((row): row is { fileId: string; type: string } => row !== null)
    .slice(0, 8);
}

async function allowedFiles(
  db: D1Database,
  a: Actor,
  ids: string[],
): Promise<Map<string, FileRow>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return new Map();
  const placeholders = unique.map(() => "?").join(",");
  const rows = await db
    .prepare(
      `SELECT * FROM files WHERE campaign_id=? AND id IN (${placeholders})`,
    )
    .bind(a.campaignId, ...unique)
    .all<FileRow>();
  return new Map(
    rows.results
      .filter((file) => canRead(a, file) && file.mime.startsWith("image/"))
      .map((file) => [file.id, file]),
  );
}

async function projectMedia(
  db: D1Database,
  a: Actor,
  content: Record<string, unknown>,
) {
  const media = characterMediaEntries(content);
  const portraitFileId = fileIdFromRef(content.image);
  const files = await allowedFiles(
    db,
    a,
    [...media.map((row) => row.fileId), portraitFileId || ""],
  );
  const projectedMedia = media.flatMap((row) => {
    const file = files.get(row.fileId);
    if (!file) return [];
    return [
      {
        id: file.id,
        type: row.type,
        name: file.name,
        mime: file.mime,
        visibility: file.visibility,
        src: `/api/files?id=${file.id}`,
      },
    ];
  });
  let portraitRef: string | null = null;
  if (publicImage.test(stringValue(content.image))) {
    portraitRef = stringValue(content.image);
  } else if (portraitFileId && files.has(portraitFileId)) {
    portraitRef = `/api/files?id=${portraitFileId}`;
  } else {
    portraitRef =
      projectedMedia.find((item) => item.type === "portrait")?.src || null;
  }
  return { portraitRef, media: projectedMedia };
}

async function projectNotes(db: D1Database, a: Actor, characterId: string) {
  const rows = await db
    .prepare(
      "SELECT * FROM records WHERE campaign_id=? AND kind='notizen' AND json_extract(body,'$.characterId')=? ORDER BY updated_at DESC",
    )
    .bind(a.campaignId, characterId)
    .all<LegacyRecordRow>();
  return rows.results.flatMap((row) => {
    if (!canRead(a, row)) return [];
    const body = parseBody(row.body);
    if (body.archived === true) return [];
    return [
      {
        id: row.id,
        title: row.title,
        text: stringValue(body.text),
        visibility: row.visibility,
        version: row.version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        canEdit: row.owner_id === a.id,
      },
    ];
  });
}

async function projectRelationships(
  db: D1Database,
  a: Actor,
  characterId: string,
  grants: GrantRow[],
) {
  const relationships = await db
    .prepare(
      "SELECT * FROM relationships WHERE campaign_id=? AND (source_id=? OR target_id=?) ORDER BY created_at DESC",
    )
    .bind(a.campaignId, characterId, characterId)
    .all<RelationshipRow>();
  const socialRelationships = relationships.results.filter((row) => row.type !== "character.owns");
  if (!socialRelationships.length) return [];
  const otherIds = socialRelationships.map((row) =>
    row.source_id === characterId ? row.target_id : row.source_id,
  );
  const placeholders = [...new Set(otherIds)].map(() => "?").join(",");
  const [entityRows, recordRows] = await db.batch([
    db
      .prepare(
        `SELECT * FROM entities WHERE campaign_id=? AND id IN (${placeholders})`,
      )
      .bind(a.campaignId, ...new Set(otherIds)),
    db
      .prepare(
        `SELECT * FROM records WHERE campaign_id=? AND id IN (${placeholders})`,
      )
      .bind(a.campaignId, ...new Set(otherIds)),
  ]);
  const records = new Map(
    (recordRows.results as LegacyRecordRow[]).map((row) => [row.id, row]),
  );
  const entities = new Map(
    (entityRows.results as EntityRow[]).map((row) => [
      row.id,
      resolveEntity(
        row,
        row.legacy_record_id ? records.get(row.legacy_record_id) : undefined,
      ),
    ]),
  );
  return socialRelationships.flatMap((row) => {
    if (!a.gm && row.visibility !== "group") return [];
    const targetId = row.source_id === characterId ? row.target_id : row.source_id;
    const target = entities.get(targetId);
    if (!target || target.type === "ITEM") return [];
    const projected = projectEntity(a, target, grants);
    if (!projected) return [];
    const content = projected.content;
    return [
      {
        id: row.id,
        targetId,
        name: projected.title,
        type: row.type,
        status: stringValue(content.status || content.attitude || content.haltung),
        favor: typeof content.favor === "number" ? content.favor : null,
        role: stringValue(content.role || content.rolle || projected.type),
        visibility: row.visibility,
      },
    ];
  });
}

async function projectLastSession(
  db: D1Database,
  a: Actor,
  grants: GrantRow[],
) {
  const rows = await db
    .prepare(
      "SELECT * FROM records WHERE campaign_id=? AND kind='sitzungen' ORDER BY COALESCE(json_extract(body,'$.date'), updated_at) DESC LIMIT 12",
    )
    .bind(a.campaignId)
    .all<LegacyRecordRow>();
  if (!rows.results.length) return null;
  const entities = new Map(
    (await loadEntitiesForIds(db, a.campaignId, rows.results.map((row) => row.id))).map((entity) => [entity.id, entity]),
  );
  for (const row of rows.results) {
    const entity = entities.get(row.id);
    if (!entity) continue;
    const projected = projectEntity(a, entity, grants);
    if (!projected) continue;
    const content = projected.content;
    return {
      id: row.id,
      title: projected.title,
      date: stringValue(content.date),
      summary: stringValue(content.summary || content.subtitle || content.text),
    };
  }
  return null;
}

export function characterDetailProjection(a: Actor, r: LegacyRecordRow, content: Record<string, unknown>) {
  const own = r.owner_id === a.id;
  if (a.status !== 'active' || r.campaign_id !== a.campaignId || (!own && !canManageCampaignCharacter(a, r.campaign_id))) return null;
  return { identity:{id:r.id,name:r.title,player:content.player??"",chronicle:content.chronicle??"Chronik von Kleve",clan:content.clan??"",generation:content.generation??null,nature:content.nature??"",demeanor:content.demeanor??"",concept:content.concept??"",sire:content.sire??"",portraitRef:content.image??null}, sheet:{attributes:content.attributes??{},abilities:content.skills??{},customAbilities:content.customAbilities??[],disciplines:content.disciplines??[],backgrounds:content.backgrounds??[],virtues:content.virtues??{},humanity:content.humanity??null,humanityPath:content.humanityPath??"",willpower:{permanent:content.willpower??null,temporary:content.willpowerTemporary??null},health:content.health??{},blood:{current:content.blood??null,max:content.bloodMax??null,perRound:content.bloodPerRound??null},merits:content.merits??[],flaws:content.flaws??[],clanWeakness:content.clanWeakness??""},roleplay:{backgroundStory:content.text??"",playGuide:content.playGuide??content.goals??""},progression:{characterState:content.engineVersion===1?content.characterState??"draft":"legacy",freeXp:content.engineVersion===1?xpBalance(content):content.xpFree??null,totalXp:content.engineVersion===1&&Array.isArray(content.xpLedger)?content.xpLedger.filter((e: {kind:string;amount:number})=>e.kind==="grant").reduce((n:number,e:{amount:number})=>n+e.amount,0):content.xp??null},permissions:{canEdit:canEdit(a,r),canEditCompanion:own,canChangeRuntimeValues:canEdit(a,r),canArchive:own||a.gm,canCreateNotes:own},revision:{version:r.version,updatedAt:r.updated_at} };
}

export async function characterDetailProjectionWithCompanion(
  a: Actor,
  r: LegacyRecordRow,
  content: Record<string, unknown>,
  db: D1Database,
) {
  const base = characterDetailProjection(a, r, content);
  if (!base) return null;
  const grants = await grantsFor(db, a);
  const [media, notes, relationships, lastSession] = await Promise.all([
    projectMedia(db, a, content),
    projectNotes(db, a, r.id),
    projectRelationships(db, a, r.id, grants),
    projectLastSession(db, a, grants),
  ]);
  return {
    ...base,
    identity: { ...base.identity, portraitRef: media.portraitRef },
    companion: {
      media: media.media,
      notes,
      relationships,
      lastSession,
    },
  };
}

