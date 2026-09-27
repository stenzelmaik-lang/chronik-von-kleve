import { discoveryOrder, validDiscovery, locationIsSecret } from "@/domain/location-discovery";
import type {
  DiscoveryState,
  PlaceActivity,
  PlaceArea,
  PlaceModel,
  PlaceNote,
  PlaceRoom,
  PreparedPlaceAction,
  PreparedActionStatus,
  StateMarkerId,
} from "@/domain/location-types";
import type { Actor } from "@/domain/types";
import {
  electricTabernaLocation,
  projectLocationForPlayer,
  projectLocationForSl,
} from "@/domain/location-model";
import { projectLocationGeography } from "@/server/location-geography";
import { parseGeography } from "@/domain/location-cms";
import { loadSlDossierExtras, loadRevisionOverlay, type PreviewRevision, type RevisionOverlay } from "@/server/location-revision-projector";

type NodeRow = {
  entity_id: string;
  location_id: string;
  parent_id: string | null;
  level: "location" | "area" | "room" | "information";
  position: number;
  world_state: string;
  world_visibility: string;
  world_subject_id: string | null;
  markers: string;
  attributes: string;
  revision: number;
  canon_status: string;
  entity_content: string;
  entity_title: string;
};
type ActionRow = {
  id: string;
  target_id: string;
  definition: string;
  status: string;
  revision: number;
};
type KnowledgeRow = { entity_id: string; audience: string; subject_id: string; discovery_state: string | null };

const jsonObject = (value: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};
const stringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const safeLocationImage = (value: unknown): string =>
  typeof value === "string" && (/^\/images\/[a-zA-Z0-9_.-]+$/.test(value) || /^\/api\/files\?id=[a-zA-Z0-9-]+$/.test(value)) ? value : "";
const parseArray = (value: string): string[] => {
  try { return stringArray(JSON.parse(value)); } catch { return []; }
};
const parseMarkers = (value: string): StateMarkerId[] => parseArray(value).filter((item): item is StateMarkerId => ["dangerous", "locked", "occupied", "contaminated", "watched", "contested", "unstable", "highSecurity"].includes(item));
const worldState = (value: string) =>
  ["active", "changed", "inaccessible", "destroyed", "abandoned"].includes(value)
    ? (value as PlaceModel["worldState"])
    : "active";
const visibility = (value: unknown): "public" | "group" | "private" | "shared" | "gm" =>
  ["public", "group", "private", "shared", "gm"].includes(String(value))
    ? (String(value) as "public" | "group" | "private" | "shared" | "gm")
    : "gm";

function attrs(row: NodeRow): Record<string, unknown> {
  const data = jsonObject(row.attributes);
  return {
    ...data,
    markers: row.markers ? parseMarkers(row.markers) : stringArray(data.markers).filter((item): item is StateMarkerId => ["dangerous", "locked", "occupied", "contaminated", "watched", "contested", "unstable", "highSecurity"].includes(item)),
  };
}

type LoadedRows = { rows: NodeRow[]; actions: ActionRow[]; grants: KnowledgeRow[]; overlay?: RevisionOverlay };

function buildPersistedProjection(
  actor: Actor,
  placeId: string,
  loaded: LoadedRows,
  requestedView: "sl" | "player",
  target: "group" | "player",
) {
  const { rows, actions, overlay } = loaded;
  const grants = [...loaded.grants, ...(overlay?.extraKnowledge ?? [])];
  if (!rows.length) return null;
  const sl = requestedView === "sl" && actor.gm;
  const grantRows = new Map<string, KnowledgeRow[]>();
  for (const grant of grants) grantRows.set(grant.entity_id, [...(grantRows.get(grant.entity_id) ?? []), grant]);
  const grantMap = new Map<string, DiscoveryState>();
  for (const grant of grants) {
    if (!grant.discovery_state) continue;
    const current = grantMap.get(grant.entity_id);
    if (!current || discoveryOrder.indexOf(validDiscovery(grant.discovery_state)) > discoveryOrder.indexOf(current)) grantMap.set(grant.entity_id, validDiscovery(grant.discovery_state));
  }
  const blocked = new Set(rows.filter(row => locationIsSecret(row.canon_status, jsonObject(row.entity_content), attrs(row))).map(row => row.entity_id));
  for (let pass = 0; pass < rows.length; pass++) for (const row of rows) if (row.parent_id && blocked.has(row.parent_id)) blocked.add(row.entity_id);
  const availableRows = sl ? rows : rows.filter(row => !blocked.has(row.entity_id));
  const root = availableRows.find(row => row.level === "location" && row.entity_id === placeId);
  if (!root) return null;
  const attrsFor = (row: NodeRow) => sl
    ? { ...attrs(row), ...overlay?.playerPayloads.get(row.entity_id) }
    : overlay?.managedIds.has(row.entity_id)
    ? overlay.playerPayloads.get(row.entity_id) ?? {}
    : attrs(row);
  const rootAttrs = attrsFor(root);
  const grantsForNode = (row: NodeRow) => grantRows.get(row.entity_id) ?? [];
  const publicRule = (row: NodeRow) => attrsFor(row).visibility === "public" || row.world_visibility === "public" || grantsForNode(row).some(grant => grant.audience === "public");
  const fullDiscovery = (row: NodeRow): DiscoveryState => {
    if (overlay?.managedIds.has(row.entity_id)) {
      if (!overlay.playerPayloads.has(row.entity_id)) return "hidden";
      if (overlay.publicKnownIds.has(row.entity_id)) return "known";
      return validDiscovery(grantMap.get(row.entity_id) ?? "hidden");
    }
    return publicRule(row) ? "known" : validDiscovery(grantMap.get(row.entity_id) ?? "hidden");
  };
  const gmOnlyInformation = (row: NodeRow) => row.level === "information" && attrs(row).visibility === "gm";
  const visibleNode = (row: NodeRow) => sl || (!gmOnlyInformation(row) && fullDiscovery(row) !== "hidden" &&
    (!overlay?.managedIds.has(row.entity_id) || overlay.playerPayloads.has(row.entity_id)));
  if (!sl && fullDiscovery(root) === "hidden") return null;
  const rootGrants = grantsForNode(root);
  const groupGrant = rootGrants.some(grant => grant.audience === "public" || grant.audience === "group");
  const playerGrant = rootGrants.some(grant => grant.audience === "player" && grant.subject_id === actor.id);
  const worldVisible = (row: NodeRow) => sl || row.world_visibility === "public" || row.world_visibility === "group" ||
    (target === "player" && row.world_visibility === "private" && row.world_subject_id === actor.id);
  // Keep safe hidden area rows long enough for projectLocationForPlayer to
  // replace their identity with its redacted container when a child is granted.
  // Hidden rooms/information never enter the projection, and secret parents
  // were already removed with their descendants above.
  const byParent = (parentId: string | null, level: NodeRow["level"]) => availableRows.filter(row => row.parent_id === parentId && row.level === level && (level === "area" || visibleNode(row))).sort((a, b) => a.position - b.position);
  const buildRoom = (row: NodeRow): PlaceRoom => {
    const data = attrsFor(row);
    return { id: row.entity_id, order: row.position, title: String(data.title || row.entity_title || ""), discovery: fullDiscovery(row),
      worldState: worldVisible(row) ? worldState(row.world_state) : "active", markers: worldVisible(row) ? parseMarkers(row.markers) : [],
      visibility: !sl && fullDiscovery(row) !== "hidden" ? "group" : visibility(data.visibility || row.world_visibility), short: typeof data.short === "string" ? data.short : undefined };
  };
  const buildArea = (row: NodeRow): PlaceArea => {
    const data = attrsFor(row);
    const revisionId = overlay?.selectedRevisionIds.get(row.entity_id);
    const areaImageId = revisionId ? overlay?.selectedMediaFileIds.get(revisionId) : undefined;
    return { id: row.entity_id, order: row.position, title: String(data.title || row.entity_title || ""), discovery: fullDiscovery(row),
      worldState: worldVisible(row) ? worldState(row.world_state) : "active", markers: worldVisible(row) ? parseMarkers(row.markers) : [],
      visibility: !sl && fullDiscovery(row) !== "hidden" ? "group" : visibility(data.visibility || row.world_visibility),
      ...(areaImageId && revisionId ? { image: `/api/cms/media?id=${encodeURIComponent(areaImageId)}&entityId=${encodeURIComponent(row.entity_id)}&revisionId=${encodeURIComponent(revisionId)}${overlay?.previewRevisionIds.has(revisionId) ? "&preview=1" : ""}` } : {}),
      playerHint: typeof data.playerHint === "string" ? data.playerHint : undefined, rooms: byParent(row.entity_id, "room").map(buildRoom) };
  };
  const rootRevisionId = overlay?.selectedRevisionIds.get(placeId);
  const heroFileId = rootRevisionId ? overlay?.selectedMediaFileIds.get(rootRevisionId) : undefined;
  const revisionGeography = overlay?.managedIds.has(placeId) ? parseGeography(overlay.geographies.get(placeId)) : null;
  const model: PlaceModel = {
    id: placeId,
    legacyEntityId: String(rootAttrs.legacyEntityId || ""),
    title: String(rootAttrs.title || root.entity_title || ""),
    subtitle: String(rootAttrs.subtitle || ""), district: String(rootAttrs.district || ""), address: String(rootAttrs.address || ""),
    image: heroFileId && rootRevisionId
      ? `/api/cms/media?id=${encodeURIComponent(heroFileId)}&entityId=${encodeURIComponent(placeId)}&revisionId=${encodeURIComponent(rootRevisionId)}${overlay?.previewRevisionIds.has(rootRevisionId) ? "&preview=1" : ""}`
      : safeLocationImage(rootAttrs.image),
    summary: String(rootAttrs.summary || ""), atmosphere: String(rootAttrs.atmosphere || ""),
    geography: overlay?.managedIds.has(placeId)
      ? (revisionGeography ?? { status: "unknown" })
      : projectLocationGeography(rootAttrs.geography, { gm: sl, known: discoveryOrder.indexOf(fullDiscovery(root)) >= discoveryOrder.indexOf("known"), groupGrant, playerGrant, target }),
    discovery: fullDiscovery(root), worldState: worldVisible(root) ? worldState(root.world_state) : "active",
    markers: worldVisible(root) ? parseMarkers(root.markers) : [],
    factionSignals: Array.isArray(rootAttrs.factionSignals) ? rootAttrs.factionSignals as PlaceModel["factionSignals"] : [],
    areas: byParent(placeId, "area").map(buildArea),
    knownInformation: byParent(placeId, "information").map((row): PlaceNote => {
      const data = attrsFor(row);
      return { id: row.entity_id, title: String(data.title || row.entity_title || "Information"), text: String(data.text || ""),
        noteType: (data.noteType as PlaceNote["noteType"]) || "note", pinned: data.pinned === true,
        visibility: !sl && fullDiscovery(row) !== "hidden" ? "group" : visibility(data.visibility || row.world_visibility), targetId: placeId };
    }),
    activity: Array.isArray(rootAttrs.activity) ? (rootAttrs.activity as PlaceActivity[]).filter(item => sl || (["public", "group"].includes(item.visibility) && availableRows.some(row => row.entity_id === item.targetId && fullDiscovery(row) !== "hidden"))) : [],
    preparedActions: actions.map((row): PreparedPlaceAction => {
      const data = jsonObject(row.definition); const status = ["ready", "triggered", "open"].includes(row.status) ? row.status as PreparedActionStatus : "ready";
      return { id: row.id, label: String(data.label || row.id), target: String(data.target || "Gruppe"), targetId: row.target_id, status, visibility: "gm" };
    }),
    sourceLabel: String(rootAttrs.sourceLabel || ""),
  };
  if (sl) return projectLocationForSl(Object.fromEntries(model.preparedActions.map(action => [action.id, action.status])), model);
  return projectLocationForPlayer("player", target, model);
}

async function selectLocationData(db: D1Database, actor: Actor, placeIds: string[], target: "group" | "player", viewerId = actor.id): Promise<LoadedRows> {
  const rows: NodeRow[] = [];
  const grants: KnowledgeRow[] = [];
  const actions: ActionRow[] = [];
  for (let offset = 0; offset < placeIds.length; offset += 70) {
    const batch = placeIds.slice(offset, offset + 70);
    if (!batch.length) continue;
    const placeholders = batch.map(() => "?").join(",");
    const [nodeRows, actionRows] = await Promise.all([
      db.prepare(`SELECT n.*,e.canon_status,e.content AS entity_content,e.title AS entity_title FROM location_nodes n JOIN entities e ON e.id=n.entity_id AND e.campaign_id=n.campaign_id WHERE n.campaign_id=? AND n.location_id IN (${placeholders}) ORDER BY n.location_id,n.position,n.entity_id`).bind(actor.campaignId, ...batch).all<NodeRow>(),
      db.prepare(`SELECT id,location_id,target_id,definition,status,revision FROM location_actions WHERE campaign_id=? AND location_id IN (${placeholders}) ORDER BY id`).bind(actor.campaignId, ...batch).all<ActionRow & { location_id: string }>(),
    ]);
    rows.push(...nodeRows.results);
    actions.push(...actionRows.results);
  }
  const entityIds = rows.map(row => row.entity_id);
  for (let offset = 0; offset < entityIds.length; offset += 70) {
    const batch = entityIds.slice(offset, offset + 70);
    if (!batch.length) continue;
    const placeholders = batch.map(() => "?").join(",");
    const result = await db.prepare(`SELECT entity_id,audience,subject_id,discovery_state FROM knowledge WHERE campaign_id=? AND entity_id IN (${placeholders}) AND state<>'UNKNOWN' AND (audience='public' OR (audience='group' AND subject_id=?) OR (audience='player' AND subject_id=?))`)
      .bind(actor.campaignId, ...batch, actor.campaignId, target === "player" ? viewerId : "").all<KnowledgeRow>();
    grants.push(...result.results);
  }
  return { rows, actions, grants };
}

const nodeSelect = "SELECT n.*,e.canon_status,e.content AS entity_content,e.title AS entity_title FROM location_nodes n JOIN entities e ON e.id=n.entity_id AND e.campaign_id=n.campaign_id";

export async function loadPersistedLocation(
  db: D1Database,
  actor: Actor,
  placeId: string,
  requestedView: "sl" | "player" = actor.gm ? "sl" : "player",
  target: "group" | "player" = "group",
  options: { viewerId?: string; preview?: PreviewRevision } = {},
) {
  const viewerId = options.viewerId ?? actor.id;
  const data = await selectLocationData(db, actor, [placeId], target, viewerId);
  const rows = data.rows.filter(row => row.location_id === placeId);
  if (!rows.length) return null;
  // The live SL dossier also displays the audience's published content. Drafts
  // for player-facing content remain restricted to the explicit CMS preview; hidden SL nodes retain their
  // original data when no matching release exists.
  data.overlay = await loadRevisionOverlay(db, actor, rows, data.grants, target, viewerId, options.preview);
  const projectionActor = viewerId === actor.id ? actor : { ...actor, id: viewerId, role: "player" as const, gm: false };
  const projection = buildPersistedProjection(projectionActor, placeId, {
    rows,
    actions: data.actions.filter((row) => (row as ActionRow & { location_id?: string }).location_id === placeId),
    grants: data.grants,
    overlay: data.overlay,
  }, requestedView, target);
  if (projection?.view === "sl" && actor.status === "active" && ["campaign_owner", "campaign_gm"].includes(actor.role)) {
    const visibleIds = [projection.location.id, ...projection.location.areas.flatMap(area => [area.viewKey, ...area.rooms.map(room => room.viewKey)]), ...projection.location.knownInformation.map(info => info.id)];
    Object.assign(projection.location, await loadSlDossierExtras(db, actor, visibleIds));
  }
  return projection;
}

/** Read all root IDs, nodes, grants, and actions in bounded batches. This is the
 * shared source for the hub, map markers, and search; it never performs per-place reads. */
export async function loadLocationHub(db: D1Database, actor: Actor, requestedView: "sl" | "player", target: "group" | "player") {
  const roots = await db.prepare(`${nodeSelect} WHERE n.campaign_id=? AND n.level='location' AND n.parent_id IS NULL AND n.location_id=n.entity_id ORDER BY n.position,n.entity_id`).bind(actor.campaignId).all<NodeRow>();
  const placeIds = roots.results.map(root => root.entity_id);
  if (!placeIds.length) return [];
  const loaded = await selectLocationData(db, actor, placeIds, target);
  loaded.overlay = await loadRevisionOverlay(db, actor, loaded.rows, loaded.grants, target);
  const byPlace = new Map<string, NodeRow[]>();
  const actionsByPlace = new Map<string, ActionRow[]>();
  for (const row of loaded.rows) byPlace.set(row.location_id, [...(byPlace.get(row.location_id) ?? []), row]);
  for (const row of loaded.actions as (ActionRow & { location_id: string })[]) actionsByPlace.set(row.location_id, [...(actionsByPlace.get(row.location_id) ?? []), row]);
  return placeIds.flatMap(placeId => {
    const projection = buildPersistedProjection(actor, placeId, { rows: byPlace.get(placeId) ?? [], actions: actionsByPlace.get(placeId) ?? [], grants: loaded.grants, overlay: loaded.overlay }, requestedView, target);
    return projection ? [projection] : [];
  });
}

/** Build the first migration payload from the accepted V12 fixture. Used only by the GM migration route. */
export function locationMigrationRows() {
  const fixture = electricTabernaLocation;
  const now = new Date().toISOString();
  const entities: Array<Record<string, unknown>> = [];
  const nodes: Array<Record<string, unknown>> = [];
  const relationships: Array<Record<string, unknown>> = [];
  const rootAttrs = { title: fixture.title, subtitle: fixture.subtitle, district: fixture.district, address: fixture.address, image: fixture.image, summary: fixture.summary, atmosphere: fixture.atmosphere, factionSignals: fixture.factionSignals, activity: fixture.activity, legacyEntityId: fixture.legacyEntityId, sourceLabel: fixture.sourceLabel };
  const addEntity = (id: string, type: string, title: string, content: Record<string, unknown>) => entities.push({ id, type, title, content: JSON.stringify(content), visibility: "sl" });
  const addNode = (id: string, parentId: string | null, level: string, position: number, state: string, markers: string[], data: Record<string, unknown>) => {
    nodes.push({ entityId: id, locationId: fixture.id, parentId, level, position, worldState: state, worldVisibility: data.visibility || "gm", worldSubjectId: null, markers: JSON.stringify(markers), attributes: JSON.stringify(data), revision: 1, updatedAt: now });
    if (parentId) relationships.push({ id: `relationship.${id}`, sourceId: parentId, targetId: id });
  };
  addEntity(fixture.id, "PLACE", fixture.title, { locationLevel: "location", ...rootAttrs });
  addNode(fixture.id, null, "location", 0, fixture.worldState, fixture.markers, rootAttrs);
  for (const area of fixture.areas) {
    addEntity(area.id, "PLACE", area.title, { locationLevel: "area", title: area.title });
    addNode(area.id, fixture.id, "area", area.order, area.worldState, area.markers, { title: area.title, visibility: area.visibility, discovery: area.discovery, playerHint: area.playerHint });
    for (const room of area.rooms) {
      addEntity(room.id, "PLACE", room.title, { locationLevel: "room", title: room.title });
      addNode(room.id, area.id, "room", room.order, room.worldState, room.markers, { title: room.title, visibility: room.visibility, discovery: room.discovery, short: room.short });
    }
  }
  for (const info of fixture.knownInformation) {
    addEntity(info.id, "CLUE", info.title, { locationLevel: "information", title: info.title, text: info.text });
    addNode(info.id, fixture.id, "information", 0, "active", [], { title: info.title, text: info.text, noteType: info.noteType, pinned: info.pinned, visibility: info.visibility, discovery: info.visibility === "gm" ? "hidden" : "known" });
  }
  const actions = fixture.preparedActions.map((action) => ({ id: action.id, targetId: action.targetId, definition: JSON.stringify({ label: action.label, target: action.target }), status: action.status, revision: 1, updatedAt: now }));
  const grants = [fixture.id, ...fixture.areas.filter((a) => a.visibility !== "gm").map((a) => a.id), ...fixture.areas.filter((a) => a.visibility !== "gm").flatMap((a) => a.rooms.filter((r) => r.visibility !== "gm").map((r) => r.id)), ...fixture.knownInformation.filter((i) => i.visibility !== "gm").map((i) => i.id)].map((entityId) => ({ entityId, state: "DISCOVERED", discoveryState: entityId === fixture.id ? fixture.discovery : "known" }));
  return { now, entities, nodes, relationships, actions, grants };
}

// The migration route uses the fixture's identity only as a write source; reads never use it as truth.
export const MIGRATION_SOURCE_ID = "location-migration-electric-taberna-v12";

export async function locationReferenceIsVisible(db: D1Database, actor: Actor, targetId: string) {
  const row = await db.prepare("SELECT entity_id,location_id,level,position FROM location_nodes WHERE campaign_id=? AND entity_id=?").bind(actor.campaignId,targetId).first<{entity_id:string;location_id:string;level:string;position:number}>();
  if (!row) return false;
  const projection = await loadPersistedLocation(db,actor,row.location_id,actor.gm ? "sl" : "player","player");
  if (!projection) return false;
  const location = projection.location;
  if (targetId === location.id) return true;
  if (actor.gm) return !!row;
  const key = `${row.level}-${row.position}`;
  return location.areas.some(area => (!area.redacted && area.viewKey === key) || area.rooms.some(room => room.viewKey === key));
}
