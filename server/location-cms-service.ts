import type { D1Database } from "@cloudflare/workers-types";
import type { Actor } from "@/domain/types";
import { parseAudience, parseGeography, parseGmSecretPayload, parsePlayerPayload, isPlayerSafeCanon, type LocationLevel } from "@/domain/location-cms";
import { HttpError } from "@/server/access";

export type ExistingLocationNode = {
  campaign_id: string; entity_id: string; location_id: string; parent_id: string | null;
  level: LocationLevel; position: number; attributes: string; canon_status: string;
  entity_content: string; entity_title: string; entity_version: number;
};
export type RevisionTarget = { scope: "gm" | "public" | "group" | "player"; key: string; userId: string | null };

const object = (raw: string | null | undefined): Record<string, unknown> => {
  try { const value: unknown = JSON.parse(raw || "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
  catch { return {}; }
};
export const cmsEditor = (actor: Actor) => actor.status === "active" && ["campaign_owner", "campaign_gm", "campaign_editor"].includes(actor.role);
export const cmsPublisher = (actor: Actor) => actor.status === "active" && ["campaign_owner", "campaign_gm"].includes(actor.role);
export function requireCmsEditor(actor: Actor) { if (!cmsEditor(actor)) throw new HttpError(403, "Die Ortsverwaltung ist nur für berechtigte Kampagnenmitglieder."); }
export function requireCmsPublisher(actor: Actor) { if (!cmsPublisher(actor)) throw new HttpError(403, "Diese Freigabeaktion ist der Spielleitung vorbehalten."); }

export async function getLocationNode(db: D1Database, actor: Actor, entityId: string): Promise<ExistingLocationNode> {
  const row = await db.prepare(`SELECT n.campaign_id,n.entity_id,n.location_id,n.parent_id,n.level,n.position,n.attributes,
    e.canon_status,e.content AS entity_content,e.title AS entity_title,e.version AS entity_version
    FROM location_nodes n JOIN entities e ON e.campaign_id=n.campaign_id AND e.id=n.entity_id
    WHERE n.campaign_id=? AND n.entity_id=?`).bind(actor.campaignId, entityId).first<ExistingLocationNode>();
  if (!row) throw new HttpError(404, "Der bestehende Ortseintrag wurde nicht gefunden.");
  if (!isPlayerSafeCanon(row.canon_status, object(row.entity_content), object(row.attributes)))
    throw new HttpError(404, "Der Ortseintrag wurde nicht gefunden.");
  let parentId=row.parent_id;let depth=0;
  while(parentId){
    if(++depth>16)throw new HttpError(404,"Der Ortseintrag wurde nicht gefunden.");
    const parent=await db.prepare(`SELECT n.parent_id,n.location_id,e.canon_status,e.content,n.attributes
      FROM location_nodes n JOIN entities e ON e.campaign_id=n.campaign_id AND e.id=n.entity_id
      WHERE n.campaign_id=? AND n.entity_id=? AND n.location_id=?`).bind(actor.campaignId,parentId,row.location_id)
      .first<{parent_id:string|null;location_id:string;canon_status:string;content:string;attributes:string}>();
    if(!parent||!isPlayerSafeCanon(parent.canon_status,object(parent.content),object(parent.attributes)))throw new HttpError(404,"Der Ortseintrag wurde nicht gefunden.");
    parentId=parent.parent_id;
  }
  return row;
}

export async function getTarget(db: D1Database, actor: Actor, scopeValue: unknown, playerIdValue?: unknown): Promise<RevisionTarget> {
  const parsed = parseAudience(scopeValue, playerIdValue);
  if (!parsed) throw new HttpError(400, "Ungültige Freigabezielgruppe.");
  if (parsed.scope === "gm") {
    requireCmsPublisher(actor);
    return { scope: "gm", key: "@gm", userId: null };
  }
  if (parsed.scope === "public" || parsed.scope === "player") requireCmsPublisher(actor);
  if (parsed.scope === "player") {
    const member = await db.prepare("SELECT role,status FROM campaign_memberships WHERE campaign_id=? AND user_id=?")
      .bind(actor.campaignId, parsed.userId).first<{role:string;status:string}>();
    if (!member || member.role !== "player" || member.status !== "active") throw new HttpError(400, "Zielperson ist kein aktives Spielmitglied dieser Kampagne.");
  }
  return parsed;
}

export async function requireActivePlayer(db: D1Database, campaignId: string, userId: string) {
  const row = await db.prepare("SELECT role,status FROM campaign_memberships WHERE campaign_id=? AND user_id=?")
    .bind(campaignId, userId).first<{role:string;status:string}>();
  if (!row || row.role !== "player" || row.status !== "active") throw new HttpError(404, "Spieler nicht gefunden.");
}

export async function playerPayloadFromNode(db: D1Database, actor: Actor, row: ExistingLocationNode) {
  const data = object(row.attributes);
  const title = String(data.title || row.entity_title || "").slice(0, 160);
  let raw: Record<string, unknown>;
  if (row.level === "location") {
    const safeSignals = Array.isArray(data.factionSignals) ? data.factionSignals.filter((value): value is Record<string, unknown> =>
      Boolean(value && typeof value === "object" && !Array.isArray(value) && ["public", "group"].includes(String((value as Record<string, unknown>).visibility)))) : [];
    const safeActivity = Array.isArray(data.activity) ? data.activity.filter((value): value is Record<string, unknown> =>
      Boolean(value && typeof value === "object" && !Array.isArray(value) && ["public", "group"].includes(String((value as Record<string, unknown>).visibility)))) : [];
    raw = { title, subtitle: data.subtitle, district: data.district, address: data.address, summary: data.summary,
      atmosphere: data.atmosphere, image: data.image, factionSignals: safeSignals, activity: safeActivity };
  } else if (row.level === "area") raw = { title, playerHint: data.playerHint };
  else if (row.level === "room") raw = { title, short: data.short };
  else raw = { title, text: data.text, noteType: data.noteType, pinned: data.pinned };
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== undefined));
  const parsed = parsePlayerPayload(row.level, cleaned);
  if (!parsed) throw new HttpError(422, "Die vorhandenen Ortsdaten müssen vor dem Bearbeiten geprüft werden.");
  return parsed as Record<string, unknown>;
}

export async function createLocationDraft(db: D1Database, actor: Actor, input: {
  entityId: string; audience: unknown; playerId?: unknown; payload?: unknown; geography?: unknown; gmSecret?: unknown;
}) {
  requireCmsEditor(actor);
  const node = await getLocationNode(db, actor, input.entityId);
  const target = await getTarget(db, actor, input.audience, input.playerId);
  const previous = await db.prepare(`SELECT id,player_payload_json,gm_secret_json,geography_json FROM entity_revisions
    WHERE campaign_id=? AND entity_id=? AND audience_scope=? AND audience_key=? ORDER BY revision_no DESC LIMIT 1`)
    .bind(actor.campaignId,input.entityId,target.scope,target.key)
    .first<{id:string;player_payload_json:string;gm_secret_json:string;geography_json:string}>();
  const safeDefault = target.scope === "gm" ? {} : previous
    ? object(previous.player_payload_json)
    : await playerPayloadFromNode(db, actor, node);
  const payload = target.scope === "gm" ? {} : parsePlayerPayload(node.level, input.payload ?? safeDefault);
  const gmSecret = target.scope === "gm" ? parseGmSecretPayload(input.gmSecret ?? (previous ? object(previous.gm_secret_json) : {})) : {};
  const initialGeo = previous ? object(previous.geography_json) : { status: "unknown" };
  const geography = node.level === "location" ? parseGeography(input.geography ?? initialGeo) : { status: "unknown" };
  if (!payload || !gmSecret || !geography) throw new HttpError(400, "Entwurf enthält ungültige oder unbekannte Felder.");
  const currentEntity = await db.prepare("SELECT version FROM entities WHERE campaign_id=? AND id=?").bind(actor.campaignId,input.entityId).first<{version:number}>();
  if (!currentEntity) throw new HttpError(404, "Der bestehende Ortseintrag wurde nicht gefunden.");
  const revisionNo = await db.prepare("SELECT COALESCE(MAX(revision_no),0)+1 AS n FROM entity_revisions WHERE campaign_id=? AND entity_id=?")
    .bind(actor.campaignId,input.entityId).first<{n:number}>();
  const id=crypto.randomUUID(), now=new Date().toISOString(), version=Number(revisionNo?.n ?? 1);
  try {
    const result=await db.batch([
      db.prepare(`INSERT INTO entity_revisions(id,campaign_id,entity_id,revision_no,parent_revision_id,audience_scope,audience_key,audience_user_id,status,base_entity_version,version,player_payload_json,gm_secret_json,geography_json,author_id,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,'draft',?,1,?,?,?,?,?,?)`).bind(id,actor.campaignId,input.entityId,version,previous?.id??null,target.scope,target.key,target.userId,currentEntity.version,JSON.stringify(payload),JSON.stringify(gmSecret),JSON.stringify(geography),actor.id,now,now),
      db.prepare(`INSERT INTO entity_revision_events(id,campaign_id,entity_id,revision_id,actor_id,event,expected_version,revision_version,reason,created_at)
        SELECT ?,?,?,?,?,'created',0,1,'Neuer sicherer Ortsentwurf',? WHERE changes()=1`).bind(crypto.randomUUID(),actor.campaignId,input.entityId,id,actor.id,now),
    ]);
    if (!result[0].meta.changes || !result[1].meta.changes) throw new HttpError(409,"Für dieses Ziel wurde der Entwurf parallel angelegt. Bitte lade neu.");
  } catch (error) { if (error instanceof HttpError) throw error; throw conflictError(error); }
  return { id, entityId: input.entityId, revisionNo: version, version: 1, status: "draft", audienceScope: target.scope, audienceKey: target.key, payload, geography };
}

export async function listLocationDrafts(db: D1Database, actor: Actor, entityId: string) {
  requireCmsEditor(actor); await getLocationNode(db,actor,entityId);
  const where = cmsPublisher(actor) ? "" : " AND audience_scope<>'gm'";
  const rows=await db.prepare(`SELECT r.id,r.revision_no,r.audience_scope,r.audience_key,r.audience_user_id,r.status,r.version,r.player_payload_json,r.geography_json,r.author_id,r.created_at,r.updated_at,
    (SELECT m.file_id FROM entity_revision_media m WHERE m.campaign_id=r.campaign_id AND m.revision_id=r.id AND m.purpose='hero' ORDER BY m.position LIMIT 1) AS hero_file_id
    FROM entity_revisions r WHERE r.campaign_id=? AND r.entity_id=?${where.replaceAll("audience_scope","r.audience_scope")} ORDER BY r.revision_no DESC`).bind(actor.campaignId,entityId).all<Record<string,unknown>>();
  return rows.results;
}

export async function saveLocationDraft(db: D1Database, actor: Actor, input: {
  revisionId:string; expectedVersion:number; payload?:unknown; geography?:unknown; gmSecret?:unknown; heroFileId?:string|null;
}) {
  requireCmsEditor(actor);
  const revision=await db.prepare(`SELECT r.*,n.level FROM entity_revisions r JOIN location_nodes n ON n.campaign_id=r.campaign_id AND n.entity_id=r.entity_id
    WHERE r.id=? AND r.campaign_id=?`).bind(input.revisionId,actor.campaignId).first<Record<string,unknown>>();
  if (!revision || (!cmsPublisher(actor) && revision.audience_scope !== "group")) throw new HttpError(404,"Entwurf nicht gefunden.");
  const node=await getLocationNode(db,actor,String(revision.entity_id));
  const targetScope=String(revision.audience_scope);
  const payload=targetScope === "gm" ? {} : parsePlayerPayload(node.level,input.payload ?? object(String(revision.player_payload_json)));
  const gmSecret=targetScope === "gm" ? parseGmSecretPayload(input.gmSecret ?? object(String(revision.gm_secret_json))) : {};
  const geography=node.level === "location" ? parseGeography(input.geography ?? object(String(revision.geography_json))) : {status:"unknown" as const};
  if (!payload || !gmSecret || !geography) throw new HttpError(400,"Ungültige Entwurfsdaten.");
  if (input.heroFileId) {
    const file=await db.prepare("SELECT owner_id,mime FROM files WHERE campaign_id=? AND id=?").bind(actor.campaignId,input.heroFileId).first<{owner_id:string;mime:string}>();
    if (!file || !["image/jpeg","image/png","image/webp"].includes(file.mime) || (file.owner_id!==actor.id && !cmsPublisher(actor))) throw new HttpError(404,"Das Bild wurde nicht gefunden.");
  }
  const now=new Date().toISOString(), next=input.expectedVersion+1;
  const eventId=crypto.randomUUID();
  const statements=[
    db.prepare(`UPDATE entity_revisions SET player_payload_json=?,gm_secret_json=?,geography_json=?,version=version+1,updated_at=?
      WHERE id=? AND campaign_id=? AND status='draft' AND version=?`).bind(JSON.stringify(payload),JSON.stringify(gmSecret),JSON.stringify(geography),now,input.revisionId,actor.campaignId,input.expectedVersion),
    db.prepare(`INSERT INTO entity_revision_events(id,campaign_id,entity_id,revision_id,actor_id,event,expected_version,revision_version,reason,created_at)
      SELECT ?,?,?,?,?,'saved',?,?, 'Entwurf mit Versionsschutz gespeichert',? WHERE changes()=1`)
      .bind(eventId,actor.campaignId,String(revision.entity_id),input.revisionId,actor.id,input.expectedVersion,next,now),
  ];
  if (input.heroFileId !== undefined) {
    statements.push(db.prepare(`DELETE FROM entity_revision_media WHERE campaign_id=? AND revision_id=? AND purpose='hero'
      AND EXISTS (SELECT 1 FROM entity_revision_events WHERE id=?)`).bind(actor.campaignId,input.revisionId,eventId));
    if (input.heroFileId) statements.push(db.prepare(`INSERT INTO entity_revision_media(id,campaign_id,entity_id,revision_id,file_id,audience_scope,audience_key,purpose,alt_text,position,created_at)
      SELECT ?,?,?,?,?,?,?,'hero','',0,? WHERE EXISTS (SELECT 1 FROM entity_revision_events WHERE id=?)`).bind(crypto.randomUUID(),actor.campaignId,String(revision.entity_id),input.revisionId,input.heroFileId,String(revision.audience_scope),String(revision.audience_key),now,eventId));
  }
  try {
    const result=await db.batch(statements);
    if (!result[0].meta.changes || !result[1].meta.changes) throw new HttpError(409,"Der Entwurf wurde inzwischen geändert. Bitte lade ihn neu.");
  } catch (error) { if(error instanceof HttpError) throw error; throw conflictError(error); }
  return {ok:true,revisionId:input.revisionId,version:next};
}

export async function transitionLocationDraft(db:D1Database,actor:Actor,input:{revisionId:string;expectedVersion:number;action:"submit"|"approve"|"reject";reason?:string}) {
  requireCmsEditor(actor);
  if(input.action!=="submit") requireCmsPublisher(actor);
  const revision=await db.prepare("SELECT id,entity_id,status,audience_scope FROM entity_revisions WHERE id=? AND campaign_id=?")
    .bind(input.revisionId,actor.campaignId).first<{id:string;entity_id:string;status:string;audience_scope:string}>();
  if(!revision || (!cmsPublisher(actor)&&revision.audience_scope!=="group")) throw new HttpError(404,"Entwurf nicht gefunden.");
  await getLocationNode(db,actor,revision.entity_id);
  const from=revision.status, to=input.action==="submit"?"in_review":input.action==="approve"?"approved":"rejected";
  if((input.action==="submit"&&from!=="draft") || (input.action!=="submit"&&from!=="in_review")) throw new HttpError(409,"Der Entwurf befindet sich nicht mehr im erwarteten Prüfstatus.");
  if(input.action==="reject" && !input.reason?.trim()) throw new HttpError(400,"Bitte gib einen Grund für die Rückgabe an.");
  const now=new Date().toISOString(),next=input.expectedVersion+1,event=input.action==="submit"?"submitted":input.action==="approve"?"approved":"rejected";
  try{
    const result=await db.batch([
      db.prepare("UPDATE entity_revisions SET status=?,version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND status=? AND version=?")
        .bind(to,now,input.revisionId,actor.campaignId,from,input.expectedVersion),
      db.prepare(`INSERT INTO entity_revision_events(id,campaign_id,entity_id,revision_id,actor_id,event,expected_version,revision_version,reason,created_at)
        SELECT ?,?,?,?, ?,?,?,?, ?,? WHERE changes()=1`)
        .bind(crypto.randomUUID(),actor.campaignId,revision.entity_id,input.revisionId,actor.id,event,input.expectedVersion,next,input.reason||"",now),
    ]);
    if(!result[0].meta.changes || !result[1].meta.changes) throw new HttpError(409,"Der Entwurf wurde parallel geändert. Bitte lade neu.");
  }catch(error){if(error instanceof HttpError)throw error;throw conflictError(error);}
  return {ok:true,status:to,version:next};
}

export async function publishLocationRevision(db:D1Database,actor:Actor,input:{entityId:string;scope:"public"|"group"|"player";playerId?:string;revisionId?:string;expectedReleaseVersion:number;action:"publish"|"revoke"|"block";discoveryState?:"rumored"|"known"|"visited"|"investigated";reason:string}){
  requireCmsPublisher(actor);
  const node=await getLocationNode(db,actor,input.entityId);
  const target=await getTarget(db,actor,input.scope,input.playerId);
  if(target.scope==="gm") throw new HttpError(400,"GM-Entwürfe können nicht als Spielerinhalt freigegeben werden.");
  const latest=await db.prepare(`SELECT release_version,transition FROM entity_revision_releases WHERE campaign_id=? AND entity_id=? AND audience_scope=? AND audience_key=? ORDER BY release_version DESC LIMIT 1`)
    .bind(actor.campaignId,input.entityId,target.scope,target.key).first<{release_version:number;transition:string}>();
  const currentVersion=latest?.release_version??0;
  if(currentVersion!==input.expectedReleaseVersion) throw new HttpError(409,"Die Freigabe wurde inzwischen geändert. Bitte lade neu.");
  const releaseVersion=currentVersion+1;
  let revisionId:string|null=null;
  if(input.action==="publish"){
    if(!input.revisionId) throw new HttpError(400,"Freigabefähiger Entwurf fehlt.");
    const revision=await db.prepare(`SELECT status,audience_scope,audience_key,player_payload_json,geography_json FROM entity_revisions
      WHERE id=? AND campaign_id=? AND entity_id=?`).bind(input.revisionId,actor.campaignId,input.entityId)
      .first<{status:string;audience_scope:string;audience_key:string;player_payload_json:string;geography_json:string}>();
    if(!revision || revision.status!=="approved" || revision.audience_scope!==target.scope || revision.audience_key!==target.key) throw new HttpError(409,"Nur ein für genau dieses Ziel genehmigter Entwurf kann freigegeben werden.");
    if(!isPlayerSafeCanon(node.canon_status,object(node.entity_content),object(node.attributes))) throw new HttpError(403,"GM_SECRET- und Recovery-Inhalte können nicht veröffentlicht werden.");
    if(!parsePlayerPayload(node.level,object(revision.player_payload_json)) || !parseGeography(object(revision.geography_json))) throw new HttpError(422,"Der genehmigte Entwurf enthält ungültige Daten.");
    if(target.scope!=="public" && !input.discoveryState) throw new HttpError(400,"Für Gruppen- und persönliche Freigaben ist ein Discovery-Stand erforderlich.");
    revisionId=input.revisionId;
  }
  const now=new Date().toISOString(),id=crypto.randomUUID();
  const discovery=input.action==="publish" && target.scope!=="public" ? input.discoveryState! : null;
  const stmts=[db.prepare(`INSERT INTO entity_revision_releases(id,campaign_id,entity_id,revision_id,audience_scope,audience_key,audience_user_id,release_version,transition,discovery_grant_state,actor_id,reason,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,actor.campaignId,input.entityId,revisionId,target.scope,target.key,target.userId,releaseVersion,input.action,discovery,actor.id,input.reason,now)];
  if(input.action==="publish" && discovery){
    const knowledgeAudience=target.scope,subject=target.scope==="group"?actor.campaignId:target.userId!;
    const mapped=discovery==="rumored"?"RUMOR":discovery==="known"?"DISCOVERED":discovery==="visited"?"OBSERVED":"VERIFIED";
    const prior=await db.prepare("SELECT version FROM knowledge WHERE campaign_id=? AND entity_id=? AND audience=? AND subject_id=?").bind(actor.campaignId,input.entityId,knowledgeAudience,subject).first<{version:number}>();
    stmts.push(db.prepare(`INSERT INTO knowledge(id,campaign_id,entity_id,audience,subject_id,state,discovery_state,version,granted_by,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(campaign_id,entity_id,audience,subject_id) DO UPDATE SET
      state=CASE WHEN excluded.state='VERIFIED' OR knowledge.state='VERIFIED' THEN 'VERIFIED' WHEN excluded.state='OBSERVED' OR knowledge.state='OBSERVED' THEN 'OBSERVED' WHEN excluded.state='DISCOVERED' OR knowledge.state='DISCOVERED' THEN 'DISCOVERED' WHEN excluded.state='RUMOR' OR knowledge.state='RUMOR' THEN 'RUMOR' ELSE knowledge.state END,
      discovery_state=CASE WHEN excluded.discovery_state='investigated' OR knowledge.discovery_state='investigated' THEN 'investigated' WHEN excluded.discovery_state='visited' OR knowledge.discovery_state='visited' THEN 'visited' WHEN excluded.discovery_state='known' OR knowledge.discovery_state='known' THEN 'known' WHEN excluded.discovery_state='rumored' OR knowledge.discovery_state='rumored' THEN 'rumored' ELSE knowledge.discovery_state END,
      version=knowledge.version+1,granted_by=excluded.granted_by,updated_at=excluded.updated_at`).bind(crypto.randomUUID(),actor.campaignId,input.entityId,knowledgeAudience,subject,mapped,discovery,(prior?.version??0)+1,actor.id,now,now));
  }
  try{await db.batch(stmts);}catch(error){throw conflictError(error);}
  return {ok:true,releaseId:id,releaseVersion,transition:input.action,entityId:input.entityId,audienceScope:target.scope,audienceKey:target.key};
}

export async function readReleaseState(db:D1Database,actor:Actor,input:{entityId:string;scope:"public"|"group"|"player";playerId?:string}){
  requireCmsPublisher(actor);await getLocationNode(db,actor,input.entityId);
  const target=await getTarget(db,actor,input.scope,input.playerId);
  if(target.scope==="gm")throw new HttpError(400,"Ungültiges Freigabeziel.");
  const rows=await db.prepare(`SELECT release_version,transition,revision_id,discovery_grant_state,reason,created_at,actor_id
    FROM entity_revision_releases WHERE campaign_id=? AND entity_id=? AND audience_scope=? AND audience_key=?
    ORDER BY release_version DESC LIMIT 20`).bind(actor.campaignId,input.entityId,target.scope,target.key).all<Record<string,unknown>>();
  const latest=rows.results[0];
  return {currentVersion:Number(latest?.release_version??0),currentTransition:latest?.transition??null,history:rows.results};
}

export function conflictError(error: unknown): HttpError {
  const text=error instanceof Error?error.message:String(error);
  if(/constraint|conflict|unique|revision state|release version|foreign key/i.test(text)) return new HttpError(409,"Der Stand hat sich geändert oder passt nicht mehr. Bitte lade neu und prüfe die Auswahl.");
  console.error("Location CMS write failed",error);
  return new HttpError(503,"Der Ortsentwurf konnte nicht gespeichert werden.");
}
