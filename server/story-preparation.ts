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
  const body = {
    ...(old ? parseObject(old.row.body) : {}),
    sl_preparation: { canonStatus: "GM_SECRET", document: args.document },
  };
  const now = new Date().toISOString();
  const mutation = args.create
    ? db
        .prepare(
          "INSERT OR IGNORE INTO records(id,owner_id,campaign_id,kind,title,visibility,body,gm_body,version,created_at,updated_at) VALUES(?,?,?,'sitzungen',?,'sl',?,'',1,?,?) RETURNING id",
        )
        .bind(
          args.id,
          a.id,
          a.campaignId,
          args.document.title,
          JSON.stringify(body),
          now,
          now,
        )
    : db
        .prepare(
          "UPDATE records SET title=?,body=?,version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND kind='sitzungen' AND version=? RETURNING id",
        )
        .bind(
          args.document.title,
          JSON.stringify(body),
          now,
          args.id,
          a.campaignId,
          args.version,
        );
  const results = await db.batch([
    mutation,
    db
      .prepare(
        "INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,?,?,? WHERE changes()=1",
      )
      .bind(
        crypto.randomUUID(),
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
  ]);
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
