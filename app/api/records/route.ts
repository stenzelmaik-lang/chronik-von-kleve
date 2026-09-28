import type { LegacyRecordRow } from "@/domain/legacy";
import { loadEntitiesForIds, grantsFor, projectEntity } from "@/server/entities";
import { z } from "zod";
import {
  actor,
  database,
  sameOrigin,
  input,
  json,
  failure,
  HttpError,
  campaignKinds,
  personalKinds,
  canRead,
  canEdit,
} from "@/server/access";
import { locationReferenceIsVisible } from "@/server/location-repository";
import { validateCharacterClanSelection } from "@/domain/clan-config";
import { validateCharacterDraft } from "@/domain/character-engine";
export const dynamic = "force-dynamic";
const listItem = z.object({ name: z.string().trim().min(1).max(120), value: z.number().int().min(0).max(10).optional(), cost: z.number().int().min(0).max(999).optional(), category: z.enum(["Talent", "Fertigkeit", "Kenntnis"]).optional() });
const bodySchema = z
  .object({
    text: z.string().max(90000).optional(),
    summary: z.string().max(2000).optional(),
    image: z.string().max(500).optional(),
    date: z.string().max(30).optional(),
    clan: z.string().max(100).optional(),
    generation: z.number().int().min(1).max(20).optional(),
    humanity: z.number().int().min(0).max(10).optional(),
    blood: z.number().int().min(0).max(100).optional(),
    willpower: z.number().int().min(0).max(10).optional(),
    xp: z.number().int().min(0).max(99999).optional(),
    concept: z.string().max(2000).optional(),
    sire: z.string().max(2000).optional(),


    inventory: z.string().max(15000).optional(),
    goals: z.string().max(15000).optional(),
    attributes: z.record(z.number().int().min(0).max(10)).optional(),
    skills: z.record(z.number().int().min(0).max(10)).optional(),
    customAbilities: z.array(listItem).max(100).optional(),
    disciplines: z.union([z.string().max(15000), z.array(listItem).max(50)]).optional(),
    backgrounds: z.union([z.string().max(15000), z.array(listItem).max(50)]).optional(),
    merits: z.union([z.string().max(15000), z.array(listItem).max(100)]).optional(),
    flaws: z.union([z.string().max(15000), z.array(listItem).max(100)]).optional(),
    humanityPath: z.string().max(120).optional(),
    willpowerTemporary: z.number().int().min(0).max(10).optional(),
    bloodMax: z.number().int().min(0).max(100).optional(),
    bloodPerRound: z.number().int().min(0).max(20).optional(),
    xpFree: z.number().int().min(0).max(99999).optional(),
    clanWeakness: z.string().max(5000).optional(),
  })
  .passthrough();
const schema = z.object({
  id: z.string().max(100).optional(),
  version: z.number().int().positive().optional(),
  kind: z.enum([...campaignKinds, ...personalKinds] as [string, ...string[]]),
  title: z.string().trim().min(1, "Bitte einen Titel eingeben.").max(200),
  visibility: z.enum(["private", "sl", "group"]),
  body: bodySchema,
  gmBody: z.string().max(100000).optional(),
});

function legacyBody(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
export async function GET(req: Request) {
  try {
    const a = await actor();
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") || "charaktere";
    if (![...campaignKinds, ...personalKinds].includes(kind))
      throw new HttpError(400, "Unbekannter Bereich.");
    const db = database();
    const [rows, grants] = await Promise.all([
      db
        .prepare(
          "SELECT * FROM records WHERE campaign_id=? AND kind=? ORDER BY updated_at DESC",
        )
        .bind(a.campaignId, kind)
        .all<LegacyRecordRow>(),
      grantsFor(db, a),
    ]);
    const entities = await loadEntitiesForIds(db, a.campaignId, rows.results.map((row) => row.id));
    const index = new Map(entities.map((e) => [e.id, e]));
    const records = rows.results.flatMap((r) => {
      const entity = index.get(r.id);
      if (!entity) return [];
      if (a.gm && !canRead(a, r)) return [];
      if (!a.gm && kind === "charaktere" && r.owner_id !== a.id) return [];
      const safe = projectEntity(a, entity, grants);
      if (!safe) return [];
      return [
        {
          id: r.id,
          campaignId: r.campaign_id,
          owner_id: r.owner_id,
          kind: r.kind,
          title: r.title,
          visibility: r.visibility,
          body: safe.content,
          gmBody: safe.gmBody,
          version: r.version,
          updated_at: r.updated_at,
          canEdit: canEdit(a, r),
        },
      ];
    });
    return json({ records });
  } catch (e) {
    return failure(e, req);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    const parsed = schema.safeParse(await input(req));
    if (!parsed.success)
      throw new HttpError(400, parsed.error.issues[0].message);
    const d = parsed.data;
    const db = database();
    if (campaignKinds.includes(d.kind) && !a.gm)
      throw new HttpError(
        403,
        "Nur die Spielleitung bearbeitet die Chronik-Inhalte.",
      );
    if (d.gmBody && !a.gm)
      throw new HttpError(403, "Spielleitertexte sind geschützt.");
    const id = d.id || crypto.randomUUID();
    const old = d.id
      ? await db
          .prepare("SELECT * FROM records WHERE id=? AND campaign_id=?")
          .bind(id, a.campaignId)
          .first<LegacyRecordRow>()
      : null;
    if (d.id && !old) throw new HttpError(404, "Eintrag nicht gefunden.");
    if (old && (!canRead(a, old) || !canEdit(a, old)))
      throw new HttpError(403, "Du darfst diesen Eintrag nicht ändern.");
    if (old && old.kind !== d.kind)
      throw new HttpError(400, "Der Bereich darf nicht geändert werden.");
    if (d.kind === "charaktere") {
      const previous = old ? legacyBody(old.body) : undefined;
      const clanSelection = validateCharacterClanSelection({
        campaignId: a.campaignId,
        clan: d.body.clan,
        disciplines: d.body.disciplines,
        previousClan: previous?.clan,
        previousDisciplines: previous?.disciplines,
      });
      if (!clanSelection.ok) throw new HttpError(400, clanSelection.error);
      const engine = validateCharacterDraft(a.campaignId, d.body, previous);
      if (!engine.ok) throw new HttpError(400, engine.error);
      if (old && previous && JSON.stringify(previous.xpLedger ?? null) !== JSON.stringify(d.body.xpLedger ?? null))
        throw new HttpError(403, "XP dürfen nur über die zentrale Regel-Engine verändert werden.");
    }
    const body = JSON.stringify(d.body);
    if (d.kind === "notizen" && typeof d.body.locationId === "string") {
      if (!(await locationReferenceIsVisible(db, a, d.body.locationId)))
        throw new HttpError(403, "Dieser Ortsbezug ist für dich nicht freigegeben.");
      if (typeof d.body.targetId === "string" && !(await locationReferenceIsVisible(db, a, d.body.targetId)))
        throw new HttpError(403, "Dieses Ortsziel ist für dich nicht freigegeben.");
    }
    if (body.length > 100000)
      throw new HttpError(413, "Der Inhalt ist zu lang.");
    const now = new Date().toISOString();
    if (old) {
      const result = await db
        .prepare(
          "UPDATE records SET title=?,body=?,visibility=?,gm_body=?,version=version+1,updated_at=? WHERE id=? AND version=?",
        )
        .bind(
          d.title,
          body,
          d.visibility,
          a.gm ? (d.gmBody ?? old.gm_body) : old.gm_body,
          now,
          id,
          d.version ?? 0,
        )
        .run();
      if (!result.meta.changes)
        throw new HttpError(
          409,
          "Dieser Eintrag wurde inzwischen geändert. Kopiere deine Änderungen und lade den Eintrag neu.",
        );
    } else {
      await db
        .prepare(
          "INSERT INTO records (id,owner_id,kind,visibility,title,body,gm_body,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          a.id,
          d.kind,
          d.visibility,
          d.title,
          body,
          a.gm ? d.gmBody || "" : "",
          now,
          now,
        )
        .run();
    }
    return json({ id, version: old ? old.version + 1 : 1 });
  } catch (e) {
    return failure(e, req);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    const d = await input(req);
    const db = database();
    const r = await db
      .prepare("SELECT * FROM records WHERE id=? AND campaign_id=?")
      .bind(String(d.id), a.campaignId)
      .first<LegacyRecordRow>();
    if (!r || !canRead(a, r))
      throw new HttpError(404, "Eintrag nicht gefunden.");
    if (!canEdit(a, r))
      throw new HttpError(403, "Du darfst diesen Eintrag nicht löschen.");
    const result = await db
      .prepare("DELETE FROM records WHERE id=? AND version=?")
      .bind(r.id, Number(d.version))
      .run();
    if (!result.meta.changes)
      throw new HttpError(
        409,
        "Der Eintrag wurde inzwischen geändert. Bitte neu laden.",
      );
    return json({ ok: true });
  } catch (e) {
    return failure(e, req);
  }
}





