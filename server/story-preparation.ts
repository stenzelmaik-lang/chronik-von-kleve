import type { Actor } from "@/domain/types";
import type { LegacyRecordRow } from "@/domain/legacy";
import {
  sessionPreparationSchema,
  type PreparedSession,
  type SessionPreparation,
} from "@/domain/story-preparation";
import { gmOnly, HttpError } from "@/server/access";
import { parseObject } from "@/server/entities";
import {
  readStory,
  validateCommandReferences,
} from "@/server/command-workspace";
import { readScene } from "@/server/story-scenes";
import { validatePreparationMedia } from "./preparation-media";
function project(row: LegacyRecordRow): PreparedSession {
  const body = parseObject(row.body);
  const privatePart = body.sl_preparation as { document?: unknown } | undefined;
  const parsed = sessionPreparationSchema.safeParse(
    privatePart?.document || {
      title: row.title,
      date: typeof body.date === "string" ? body.date : "",
      summary: "",
    },
  );
  if (!parsed.success)
    throw new HttpError(
      409,
      "Vorbereitungsstand ungültig; vorhandene Daten bleiben erhalten.",
    );
  return {
    id: row.id,
    version: row.version,
    updatedAt: row.updated_at,
    document: parsed.data,
  };
}
export async function preparedSessions(db: D1Database, a: Actor) {
  gmOnly(a);
  const rows = await db
    .prepare(
      "SELECT * FROM records WHERE campaign_id=? AND kind='sitzungen' ORDER BY updated_at DESC,id DESC",
    )
    .bind(a.campaignId)
    .all<LegacyRecordRow>();
  return rows.results.map(project);
}
export async function preparedSession(db: D1Database, a: Actor, id: string) {
  gmOnly(a);
  const r = await db
    .prepare(
      "SELECT * FROM records WHERE campaign_id=? AND id=? AND kind='sitzungen'",
    )
    .bind(a.campaignId, id)
    .first<LegacyRecordRow>();
  if (!r) throw new HttpError(404, "Spielabend nicht verfügbar.");
  return { row: r, view: project(r) };
}
export async function preparationHistory(db: D1Database, a: Actor, id: string) {
  await preparedSession(db, a, id);
  const rows = await db
    .prepare(
      "SELECT id,payload,created_at FROM world_events WHERE campaign_id=? AND entity_id=? AND type IN ('command.preparation.created','command.preparation.saved','command.preparation.restored') ORDER BY json_extract(payload,'$.version') DESC LIMIT 40",
    )
    .bind(a.campaignId, id)
    .all<{ id: string; payload: string; created_at: string }>();
  return rows.results.flatMap((r) => {
    const p = parseObject(r.payload),
      doc = sessionPreparationSchema.safeParse(p.document);
    return doc.success
      ? [
          {
            id: r.id,
            version: p.version,
            document: doc.data,
            createdAt: r.created_at,
          },
        ]
      : [];
  });
}
export async function writePreparation(
  db: D1Database,
  a: Actor,
  args: {
    id: string;
    version: number;
    document: SessionPreparation;
    create?: boolean;
    restored?: boolean;
    unlinkSceneIds?: string[];
  },
) {
  gmOnly(a);
  for (const id of args.document.storyIds) await readStory(db, a, id);
  for (const id of args.document.sceneIds) await readScene(db, a, id);
  await validateCommandReferences(db, a, args.document.placeIds);
  for (const id of args.document.placeIds) {
    if (
      !(await db
        .prepare(
          "SELECT entity_id FROM location_nodes WHERE campaign_id=? AND entity_id=?",
        )
        .bind(a.campaignId, id)
        .first())
    )
      throw new HttpError(400, "Wähle eine vorhandene Spielwelt-Ortsakte.");
  }
  await validatePreparationMedia(db, a, [args.document.notes]);
  const old = args.create ? null : await preparedSession(db, a, args.id);
  if (old && old.view.version !== args.version)
    throw new HttpError(
      409,
      "Spielabend wurde parallel geändert. Deine Eingaben bleiben erhalten.",
    );
  if (args.unlinkSceneIds?.some((id) => args.document.sceneIds.includes(id)))
    throw new HttpError(400, "Eine Szene kann nicht zugleich verbunden und entfernt werden.");

  // Both older scene-side references and newer session-side references are
  // valid. Removing a connection must clear both without touching other scene
  // content, publications or runs. All writes below share one D1 transaction.
  const removedIds = old && !args.restored ? [...new Set([
    ...old.view.document.sceneIds.filter((id) => !args.document.sceneIds.includes(id)),
    ...(args.unlinkSceneIds || []),
  ])] : [];
  const scenesToUnlink = [];
  for (const id of removedIds) {
    let scene;
    try { scene = await readScene(db, a, id); }
    catch (error) {
      if (error instanceof HttpError && error.status === 404 && old?.view.document.sceneIds.includes(id)) continue;
      throw error;
    }
    if (!old?.view.document.sceneIds.includes(id) && !scene.document.sessionIds.includes(args.id))
      throw new HttpError(400, "Diese Szene ist nicht mit dem Spielabend verbunden.");
    if (scene.document.sessionIds.includes(args.id)) scenesToUnlink.push(scene);
  }
  const body = {
    ...(old ? parseObject(old.row.body) : {}),
    sl_preparation: { canonStatus: "GM_SECRET", document: args.document },
  };
  const now = new Date().toISOString();
  // A referenced preparation may have been deleted since the reads above.
  // Recheck inside the same statement that creates or updates this record.
  const referencesExist = `
    AND NOT EXISTS (SELECT 1 FROM json_each(?) wanted WHERE NOT EXISTS (
      SELECT 1 FROM entities e WHERE e.campaign_id=? AND e.id=wanted.value AND e.type='CHRONICLE'
        AND e.canon_status='GM_SECRET' AND e.visibility='sl' AND e.legacy_record_id IS NULL
        AND json_extract(e.content,'$.documentKind')='plot_dossier'))
    AND NOT EXISTS (SELECT 1 FROM json_each(?) wanted WHERE NOT EXISTS (
      SELECT 1 FROM entities e WHERE e.campaign_id=? AND e.id=wanted.value AND e.type='SCENE'
        AND e.canon_status='WORKING' AND e.visibility='sl' AND e.legacy_record_id IS NULL
        AND json_extract(e.content,'$.documentKind')='story_scene'))`;
  const mutation = args.create
    ? db
        .prepare(
          `INSERT OR IGNORE INTO records(id,owner_id,campaign_id,kind,title,visibility,body,gm_body,version,created_at,updated_at)
           SELECT ?,?,?,'sitzungen',?,'sl',?,'',1,?,? WHERE 1=1 ${referencesExist}
           AND NOT EXISTS (SELECT 1 FROM world_events WHERE campaign_id=? AND entity_id=? AND type='command.session.deleted') RETURNING id`,
        )
        .bind(
          args.id,
          a.id,
          a.campaignId,
          args.document.title,
          JSON.stringify(body),
          now,
          now,
          JSON.stringify(args.document.storyIds), a.campaignId,
          JSON.stringify(args.document.sceneIds), a.campaignId,
          a.campaignId, args.id,
        )
    : db
        .prepare(
          `UPDATE records SET title=?,body=?,version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND kind='sitzungen' AND version=?
           AND NOT EXISTS (SELECT 1 FROM json_each(?) AS expected WHERE NOT EXISTS
             (SELECT 1 FROM entities e WHERE e.campaign_id=? AND e.id=json_extract(expected.value,'$.id')
               AND e.version=json_extract(expected.value,'$.version') AND e.type='SCENE'
               AND e.canon_status='WORKING' AND e.visibility='sl' AND e.legacy_record_id IS NULL
               AND json_extract(e.content,'$.documentKind')='story_scene')) ${referencesExist} RETURNING id`,
        )
        .bind(
          args.document.title,
          JSON.stringify(body),
          now,
          args.id,
          a.campaignId,
          args.version,
          JSON.stringify(scenesToUnlink.map(({ id, version }) => ({ id, version }))),
          a.campaignId,
          JSON.stringify(args.document.storyIds), a.campaignId,
          JSON.stringify(args.document.sceneIds), a.campaignId,
        );
  const eventId = crypto.randomUUID();
  const statements = [
    mutation,
    db
      .prepare(
        "INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,?,?,? WHERE changes()=1",
      )
      .bind(
        eventId,
        a.campaignId,
        args.id,
        a.id,
        args.create
          ? "command.preparation.created"
          : args.restored
            ? "command.preparation.restored"
            : "command.preparation.saved",
        JSON.stringify({ version: args.version + 1, document: args.document }),
        now,
      ),
  ];
  for (const scene of scenesToUnlink) {
    const document = { ...scene.document, sessionIds: scene.document.sessionIds.filter((id) => id !== args.id) };
    statements.push(db.prepare(`UPDATE entities SET gm_body=?,version=version+1,updated_at=?
      WHERE campaign_id=? AND id=? AND version=? AND type='SCENE'
        AND EXISTS (SELECT 1 FROM world_events WHERE id=? AND campaign_id=?)`)
      .bind(JSON.stringify(document),now,a.campaignId,scene.id,scene.version,eventId,a.campaignId));
    statements.push(db.prepare("INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,?,?,? WHERE changes()=1")
      .bind(crypto.randomUUID(),a.campaignId,scene.id,a.id,"command.scene.saved",JSON.stringify({version:scene.version+1,document,state:scene.state}),now));
  }
  const results = await db.batch(statements);
  if (results[0].results.length !== 1) {
    if (args.create) {
      const prior = await preparedSession(db, a, args.id).catch(() => null);
      if (
        prior?.view.version === 1 &&
        JSON.stringify(prior.view.document) === JSON.stringify(args.document)
      )
        return prior.view;
    }
    throw new HttpError(409, "Spielabend wurde parallel verändert.");
  }
  return (await preparedSession(db, a, args.id)).view;
}
