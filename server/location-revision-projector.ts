import type { D1Database } from "@cloudflare/workers-types";
import type { Actor } from "@/domain/types";
import { locationIsSecret } from "@/domain/location-discovery";
import type { DiscoveryState } from "@/domain/location-types";

type NodeRef = { entity_id: string };
type KnowledgeRef = { entity_id: string; audience: string; subject_id: string; discovery_state: string | null };
type ReleaseRow = {
  entity_id: string;
  audience_scope: "public" | "group" | "player";
  audience_key: string;
  release_version: number;
  transition: "publish" | "revoke" | "block";
  revision_id: string | null;
  player_payload_json: string | null;
  geography_json: string | null;
};
type MediaRow = { revision_id: string; file_id: string };

export type RevisionOverlay = {
  managedIds: Set<string>;
  blockedIds:Set<string>;
  playerPayloads: Map<string, Record<string, unknown>>;
  geographies: Map<string, Record<string, unknown>>;
  selectedRevisionIds: Map<string, string>;
  /** Revisions overlaid by the protected CMS preview, rather than a live release. */
  previewRevisionIds: Set<string>;
  selectedMediaFileIds: Map<string, string>;
  publicKnownIds: Set<string>;
  extraKnowledge: KnowledgeRef[];
};

export type PreviewRevision = {
  entityId: string;
  revisionId: string;
  scope: "public" | "group" | "player";
  key: string;
  discoveryState?: DiscoveryState;
};

const parseObject = (value: string | null): Record<string, unknown> => {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
};

function grantAllows(row: ReleaseRow, grants: KnowledgeRef[], actor: Actor, viewerId: string) {
  if (row.audience_scope === "public") return true;
  const expectedAudience = row.audience_scope;
  const expectedSubject = expectedAudience === "group" ? actor.campaignId : viewerId;
  return grants.some(grant => grant.entity_id === row.entity_id && grant.audience === expectedAudience &&
    grant.subject_id === expectedSubject);
}

function targetKeys(target: "group" | "player", viewerId: string) {
  return target === "player"
    ? [["player", viewerId], ["group", "@group"], ["public", "@public"]] as const
    : [["group", "@group"], ["public", "@public"]] as const;
}

/** Resolve each node's latest target-specific release. Drafts do not change live
 * output; the first release transition makes that stable Entity revision-managed. */
export async function loadRevisionOverlay(
  db: D1Database,
  actor: Actor,
  nodes: NodeRef[],
  grants: KnowledgeRef[],
  target: "group" | "player",
  viewerId = actor.id,
  preview?: PreviewRevision,
): Promise<RevisionOverlay> {
  const overlay: RevisionOverlay = {
    managedIds: new Set(),blockedIds:new Set(), playerPayloads: new Map(), geographies: new Map(),
    selectedRevisionIds: new Map(), previewRevisionIds: new Set(), selectedMediaFileIds: new Map(), publicKnownIds: new Set(), extraKnowledge: [],
  };
  const ids = [...new Set(nodes.map(node => node.entity_id))];
  const releases: ReleaseRow[] = [];
  for (let offset=0; offset<ids.length; offset+=70) {
    const part = ids.slice(offset, offset+70);
    if (!part.length) continue;
    const placeholders = part.map(() => "?").join(",");
    const result = await db.prepare(`SELECT r.entity_id,r.audience_scope,r.audience_key,r.release_version,r.transition,r.revision_id,
      v.player_payload_json,v.geography_json
      FROM entity_revision_releases r LEFT JOIN entity_revisions v
        ON v.id=r.revision_id AND v.campaign_id=r.campaign_id AND v.status='approved'
      WHERE r.campaign_id=? AND r.entity_id IN (${placeholders})
      ORDER BY r.entity_id,r.audience_scope,r.audience_key,r.release_version DESC`)
      .bind(actor.campaignId, ...part).all<ReleaseRow>();
    releases.push(...result.results);
  }
  const latest = new Map<string, ReleaseRow>();
  for (const row of releases) {
    overlay.managedIds.add(row.entity_id);
    const key = `${row.entity_id}\u0000${row.audience_scope}\u0000${row.audience_key}`;
    if (!latest.has(key)) latest.set(key,row);
  }
  for (const id of ids) {
    for (const [scope,key] of targetKeys(target, viewerId)) {
      const row = latest.get(`${id}\u0000${scope}\u0000${key}`);
      if (!row) continue;
      if (row.transition === "block") {overlay.blockedIds.add(id);break;}
      if (row.transition === "revoke") continue;
      if (!grantAllows(row, grants, actor, viewerId)) continue;
      if (!row.revision_id || !row.player_payload_json || !row.geography_json) continue;
      overlay.playerPayloads.set(id, parseObject(row.player_payload_json));
      overlay.geographies.set(id, parseObject(row.geography_json));
      overlay.selectedRevisionIds.set(id, row.revision_id);
      if (row.audience_scope === "public") overlay.publicKnownIds.add(id);
      break;
    }
  }
  if (preview) {
    const revision = await db.prepare(`SELECT campaign_id,entity_id,audience_scope,audience_key,status,player_payload_json,geography_json
      FROM entity_revisions WHERE id=? AND campaign_id=? AND entity_id=?`)
      .bind(preview.revisionId,actor.campaignId,preview.entityId)
      .first<{campaign_id:string;entity_id:string;audience_scope:string;audience_key:string;status:string;player_payload_json:string;geography_json:string}>();
    if (revision && revision.audience_scope === preview.scope && revision.audience_key === preview.key &&
      ["draft","in_review","approved"].includes(revision.status)) {
      overlay.managedIds.add(preview.entityId);overlay.blockedIds.delete(preview.entityId);
      overlay.playerPayloads.set(preview.entityId,parseObject(revision.player_payload_json));
      overlay.geographies.set(preview.entityId,parseObject(revision.geography_json));
      overlay.selectedRevisionIds.set(preview.entityId,preview.revisionId);
      overlay.previewRevisionIds.add(preview.revisionId);
      if (preview.scope === "public") overlay.publicKnownIds.add(preview.entityId);
      if (preview.discoveryState && preview.discoveryState !== "hidden") {
        overlay.extraKnowledge.push({
          entity_id: preview.entityId,
          audience: preview.scope === "player" ? "player" : preview.scope,
          subject_id: preview.scope === "player" ? viewerId : preview.scope === "group" ? actor.campaignId : "@public",
          discovery_state: preview.discoveryState,
        });
      }
    }
  }
  const revisions = [...new Set(overlay.selectedRevisionIds.values())];
  for (let offset=0; offset<revisions.length; offset+=70) {
    const part=revisions.slice(offset,offset+70);
    const placeholders=part.map(()=>"?").join(",");
    const media=await db.prepare(`SELECT revision_id,file_id FROM entity_revision_media
      WHERE campaign_id=? AND revision_id IN (${placeholders}) AND purpose='hero' ORDER BY position,file_id`)
      .bind(actor.campaignId,...part).all<MediaRow>();
    for (const row of media.results) if (!overlay.selectedMediaFileIds.has(row.revision_id)) overlay.selectedMediaFileIds.set(row.revision_id,row.file_id);
  }
  return overlay;
}

/** Saved confidential revisions are an SL-only side channel. They are never
 * merged into player payloads or used to infer discovery. */
export async function loadSlDossierExtras(db: D1Database, actor: Actor, entityIds: string[]) {
  const slNotes: {entityId:string;text:string;source:string;image?:string}[] = [];
  const slGroupReleases: {entityId:string;version:number;transition:string;lastPublishedRevisionId:string|null;discoveryState:DiscoveryState;discoveryVersion:number;secret:boolean}[] = [];
  if (actor.status !== "active" || !["campaign_owner", "campaign_gm"].includes(actor.role)) return {slNotes,slGroupReleases};
  for (let start=0;start<entityIds.length;start+=70) {
    const ids=entityIds.slice(start,start+70); const placeholders=ids.map(()=>"?").join(",");
    const notes=await db.prepare(`SELECT v.entity_id,v.id,v.gm_secret_json,
      (SELECT m.file_id FROM entity_revision_media m WHERE m.campaign_id=v.campaign_id AND m.entity_id=v.entity_id AND m.revision_id=v.id AND m.audience_scope='gm' AND m.audience_key='@gm' AND m.purpose='hero' ORDER BY m.position,m.id LIMIT 1) AS file_id
      FROM entity_revisions v WHERE v.campaign_id=? AND v.entity_id IN (${placeholders}) AND v.audience_scope='gm' AND v.audience_key='@gm' AND v.status IN ('draft','in_review','approved') ORDER BY v.revision_no DESC`)
      .bind(actor.campaignId,...ids).all<{entity_id:string;id:string;gm_secret_json:string;file_id:string|null}>();
    const seen=new Set<string>();
    for(const row of notes.results) {
      if(seen.has(row.entity_id))continue;seen.add(row.entity_id);
      const secret=parseObject(row.gm_secret_json);
      slNotes.push({entityId:row.entity_id,text:typeof secret.text==='string'?secret.text:'',source:typeof secret.source==='string'?secret.source:'',...(row.file_id?{image:`/api/cms/media?id=${encodeURIComponent(row.file_id)}&entityId=${encodeURIComponent(row.entity_id)}&revisionId=${encodeURIComponent(row.id)}&preview=1`}:{})});
    }
    const releases=await db.prepare(`SELECT r.entity_id,r.release_version,r.transition,r.revision_id,r.discovery_grant_state
      FROM entity_revision_releases r WHERE r.campaign_id=? AND r.entity_id IN (${placeholders}) AND r.audience_scope='group' AND r.audience_key='@group' ORDER BY r.release_version DESC`)
      .bind(actor.campaignId,...ids).all<{entity_id:string;release_version:number;transition:string;revision_id:string|null;discovery_grant_state:DiscoveryState|null}>();
    const knowledge=await db.prepare(`SELECT n.entity_id,n.attributes,e.canon_status,e.content,k.discovery_state,k.version
      FROM location_nodes n JOIN entities e ON e.campaign_id=n.campaign_id AND e.id=n.entity_id
      LEFT JOIN knowledge k ON k.campaign_id=n.campaign_id AND k.entity_id=n.entity_id AND k.audience='group' AND k.subject_id=?
      WHERE n.campaign_id=? AND n.entity_id IN (${placeholders})`)
      .bind(actor.campaignId,actor.campaignId,...ids).all<{entity_id:string;discovery_state:DiscoveryState|null;version:number|null;attributes:string;canon_status:string;content:string}>();
    const groupKnowledge=new Map(knowledge.results.map(row=>[row.entity_id,row]));
    for(const entityId of ids) {
      const discovery=groupKnowledge.get(entityId);
      const history=releases.results.filter(row=>row.entity_id===entityId);
      const lastPublish=history.find(row=>row.transition==='publish'&&row.revision_id);
      slGroupReleases.push({entityId,version:history[0]?.release_version??0,transition:history[0]?.transition??'none',lastPublishedRevisionId:lastPublish?.revision_id??null,discoveryState:discovery?.discovery_state??'hidden',discoveryVersion:discovery?.version??0,secret:!!discovery&&locationIsSecret(discovery.canon_status,parseObject(discovery.content),parseObject(discovery.attributes))});
    }
  }
  return {slNotes,slGroupReleases};
}
