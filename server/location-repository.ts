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
  ELECTRIC_TABERNA_ID,
  ELECTRIC_TABERNA_LEGACY_ENTITY_ID,
  electricTabernaLocation,
  projectLocationForPlayer,
  projectLocationForSl,
} from "@/domain/location-model";

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

export async function loadPersistedLocation(db: D1Database, actor: Actor, placeId = ELECTRIC_TABERNA_ID, requestedView: "sl" | "player" = actor.gm ? "sl" : "player", target: "group" | "player" = "group") {
  const rows = await db
    .prepare("SELECT n.*,e.canon_status,e.content AS entity_content FROM location_nodes n JOIN entities e ON e.id=n.entity_id AND e.campaign_id=n.campaign_id WHERE n.campaign_id=? AND n.location_id=? ORDER BY n.position,n.entity_id")
    .bind(actor.campaignId, placeId)
    .all<NodeRow>();
  if (!rows.results.length) return null;
  const actions = await db
    .prepare("SELECT id,target_id,definition,status,revision FROM location_actions WHERE campaign_id=? AND location_id=? ORDER BY id")
    .bind(actor.campaignId, placeId)
    .all<ActionRow>();
  const ids = rows.results.map((row) => row.entity_id);
  const placeholders = ids.map(() => "?").join(",");
  const grants = ids.length
    ? await db.prepare(`SELECT entity_id,audience,subject_id,discovery_state FROM knowledge WHERE campaign_id=? AND entity_id IN (${placeholders}) AND state<>'UNKNOWN' AND (audience='public' OR (audience=? AND subject_id=?) OR (audience=? AND subject_id=?))`).bind(actor.campaignId, ...ids, "group", actor.campaignId, "player", target === "player" ? actor.id : "").all<KnowledgeRow>()
    : { results: [] as KnowledgeRow[] };
  const grantMap = new Map<string, DiscoveryState>();
  for (const grant of grants.results) {
    if (!grant.discovery_state) continue;
    const current = grantMap.get(grant.entity_id);
    if (!current || discoveryOrder.indexOf(validDiscovery(grant.discovery_state)) > discoveryOrder.indexOf(current))
      grantMap.set(grant.entity_id, validDiscovery(grant.discovery_state));
  }
  const sl = requestedView === "sl" && actor.gm;
  const blocked = new Set(rows.results.filter(row => locationIsSecret(row.canon_status,jsonObject(row.entity_content),attrs(row))).map(row => row.entity_id));
  // A secret ancestor is a hard boundary even if a stale descendant grant exists.
  for (let pass=0; pass<rows.results.length; pass++)
    for (const row of rows.results) if (row.parent_id && blocked.has(row.parent_id)) blocked.add(row.entity_id);
  const availableRows = sl ? rows.results : rows.results.filter(row => !blocked.has(row.entity_id));
  const root = availableRows.find((row) => row.level === "location");
  if (!root) return null;
  const rootAttrs = attrs(root);
  const fullDiscovery = (row: NodeRow): DiscoveryState =>
    validDiscovery(grantMap.get(row.entity_id) ?? (attrs(row).visibility === "public" ? "known" : "hidden"));
  if (!sl && fullDiscovery(root) === "hidden") return null;
  const worldVisible = (row: NodeRow) => sl || row.world_visibility === "public" || row.world_visibility === "group" ||
    (target === "player" && row.world_visibility === "private" && row.world_subject_id === actor.id);
  const byParent = (parentId: string | null, level: NodeRow["level"]) => availableRows.filter((row) => row.parent_id === parentId && row.level === level).sort((a, b) => a.position - b.position);
  const buildRoom = (row: NodeRow): PlaceRoom => {
    const data = attrs(row);
    return {
      id: row.entity_id,
      order: row.position,
      title: String(data.title || "Unbenannter Raum"),
      discovery: fullDiscovery(row),
      worldState: worldVisible(row) ? worldState(row.world_state) : "active",
      markers: worldVisible(row) ? parseMarkers(row.markers) : [],
      visibility: !sl && fullDiscovery(row) !== "hidden" ? "group" : visibility(data.visibility || row.world_visibility),
      short: typeof data.short === "string" ? data.short : undefined,
    };
  };
  const buildArea = (row: NodeRow): PlaceArea => {
    const data = attrs(row);
    return {
      id: row.entity_id,
      order: row.position,
      title: String(data.title || "Unbenannter Bereich"),
      discovery: fullDiscovery(row),
      worldState: worldVisible(row) ? worldState(row.world_state) : "active",
      markers: worldVisible(row) ? parseMarkers(row.markers) : [],
      visibility: !sl && fullDiscovery(row) !== "hidden" ? "group" : visibility(data.visibility || row.world_visibility),
      playerHint: typeof data.playerHint === "string" ? data.playerHint : undefined,
      rooms: byParent(row.entity_id, "room").map(buildRoom),
    };
  };
  const infoRows = byParent(placeId, "information");
  const model: PlaceModel = {
    id: placeId,
    legacyEntityId: String(rootAttrs.legacyEntityId || ELECTRIC_TABERNA_LEGACY_ENTITY_ID),
    title: String(rootAttrs.title || electricTabernaLocation.title),
    subtitle: String(rootAttrs.subtitle || ""),
    district: String(rootAttrs.district || ""),
    address: String(rootAttrs.address || ""),
    image: String(rootAttrs.image || ""),
    summary: String(rootAttrs.summary || ""),
    atmosphere: String(rootAttrs.atmosphere || ""),
    discovery: fullDiscovery(root),
    worldState: worldVisible(root) ? worldState(root.world_state) : "active",
    markers: worldVisible(root) ? parseMarkers(root.markers) : [],
    factionSignals: Array.isArray(rootAttrs.factionSignals) ? rootAttrs.factionSignals as PlaceModel["factionSignals"] : [],
    areas: byParent(placeId, "area").map(buildArea),
    knownInformation: infoRows.filter(row => sl || fullDiscovery(row) !== "hidden").map((row): PlaceNote => {
      const data = attrs(row);
      return { id: row.entity_id, title: String(data.title || "Information"), text: String(data.text || ""), noteType: (data.noteType as PlaceNote["noteType"]) || "note", pinned: data.pinned === true, visibility: !sl && fullDiscovery(row) !== "hidden" ? "group" : visibility(data.visibility || row.world_visibility), targetId: placeId };
    }),
    activity: Array.isArray(rootAttrs.activity) ? (rootAttrs.activity as PlaceActivity[]).filter(item => sl || (["public","group"].includes(item.visibility) && availableRows.some(row => row.entity_id === item.targetId && fullDiscovery(row) !== "hidden"))) : [],
    preparedActions: actions.results.map((row): PreparedPlaceAction => {
      const data = jsonObject(row.definition);
      const status = ["ready", "triggered", "open"].includes(row.status) ? row.status as PreparedActionStatus : "ready";
      return { id: row.id, label: String(data.label || row.id), target: String(data.target || "Gruppe"), targetId: row.target_id, status, visibility: "gm" };
    }),
    sourceLabel: String(rootAttrs.sourceLabel || "Persistierte Electric-Taberna-Ortsdaten."),
  };
  if (requestedView === "sl" && actor.gm) return projectLocationForSl(Object.fromEntries(model.preparedActions.map((action) => [action.id, action.status])), model);
  // The existing projection is reused after database-backed discovery and state have been applied.
  return projectLocationForPlayer(actor.gm ? "gm" : "player", target, model);
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
  const projection = await loadPersistedLocation(db,actor,row?.location_id || ELECTRIC_TABERNA_ID,actor.gm ? "sl" : "player","player");
  if (!projection) return false;
  const location = projection.location;
  if (targetId === location.id) return true;
  if (actor.gm) return !!row;
  const key = row ? `${row.level}-${row.position}` : targetId;
  return location.areas.some(area => (!area.redacted && area.viewKey === key) || area.rooms.some(room => room.viewKey === key));
}
