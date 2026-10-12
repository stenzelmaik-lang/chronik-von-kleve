import type { LegacyRecordRow } from "@/domain/legacy";
import { loadEntitiesForIds, grantsFor, projectEntity } from "@/server/entities";
import { z } from "zod";
import {
  actor,
  gmOnly,
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
import { validateCharacterDraft, withCreationBaseValues } from "@/domain/character-engine";
export const dynamic = "force-dynamic";
// Rule markers are accepted only for the GM-owned campaign character route;
// POST below rejects marked character payloads before persisting for anyone else.
const listItem = z.object({ name: z.string().trim().min(1, "Bitte gib für jeden Eintrag einen Namen ein oder lösche die leere Zeile.").max(120, "Der Eintragsname darf höchstens 120 Zeichen enthalten."), value: z.number().int().min(0).max(10).optional(), cost: z.number().int().min(0).max(999).optional(), category: z.enum(["Talent", "Fertigkeit", "Kenntnis"]).optional(), source: z.string().max(40).optional(), slApproved: z.boolean().optional(), approved: z.boolean().optional() });
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
    const inspection = url.searchParams.get("view") === "sl";
    if (inspection) gmOnly(a);
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
      if (["sl-message", "appointment-vote", "live-table", "live-table-signal", "live-table-event"].includes(String(legacyBody(r.body).context))) return [];
      const entity = index.get(r.id);
      if (!entity) return [];
      if (a.gm && !canRead(a, r)) return [];
      if (!inspection && kind === "charaktere" && r.owner_id !== a.id) return [];
      const safe = projectEntity(!inspection && kind === "charaktere" ? { ...a, gm: false, role: "player" } : a, entity, grants);
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
    // Legacy text inventory remains readable/editable. Structured ITEMs must
    // use the character-scoped transaction, including capacity and revision CAS.
    if (old?.kind === "inventar" && await db.prepare("SELECT 1 AS present FROM entities WHERE id=? AND campaign_id=? AND type='ITEM'").bind(old.id, a.campaignId).first())
      throw new HttpError(403, "Gegenstände bitte über das Charakterinventar bearbeiten. Dort werden Belegung und Version geprüft.");
    if (d.body.context === "sl-message" || (old && legacyBody(old.body).context === "sl-message"))
      throw new HttpError(403, "Private Nachrichten werden ausschließlich über den Nachrichtenweg verwaltet.");
    if (d.body.context === "appointment-vote" || (old && legacyBody(old.body).context === "appointment-vote"))
      throw new HttpError(403, "Terminantworten werden ausschließlich über die Terminabstimmung verwaltet.");
    if (["live-table", "live-table-signal", "live-table-event"].includes(String(d.body.context)) || (old && ["live-table", "live-table-signal", "live-table-event"].includes(String(legacyBody(old.body).context))))
      throw new HttpError(403, "Spielraumdaten werden ausschließlich im gemeinsamen Spielraum verwaltet.");
    if (d.kind === "charaktere") {
      const previous = old ? legacyBody(old.body) : undefined;
      Object.assign(d.body, withCreationBaseValues(d.body));
      if (previous?.characterState === "review" && ["attributes","skills","disciplines","backgrounds","virtues","humanity","willpower","clan","generation","merits","flaws","creationAllocations","freebiePurchases"].some(key=>JSON.stringify(previous[key]??null)!==JSON.stringify(d.body[key]??null)))
        throw new HttpError(409,"Der eingereichte Bogen ist geschützt. Die Spielleitung muss ihn zuerst zur Überarbeitung zurückgeben.");
      const protectedKeys = ["xpLedger", "creationSnapshot", "engineOperationId", "characterRequests", "ruleExceptions"];
      for (const key of protectedKeys) {
        if (old ? JSON.stringify(previous?.[key] ?? (key === "xpLedger" ? [] : null)) !== JSON.stringify(d.body[key] ?? (key === "xpLedger" ? [] : null)) : d.body[key] !== undefined && !(key === "xpLedger" && Array.isArray(d.body[key]) && d.body[key].length === 0))
          throw new HttpError(403, "XP, Bestätigung und Anträge dürfen nur über die zentrale Regel-Engine verändert werden.");
      }
      if (old ? d.body.characterState !== previous?.characterState : d.body.characterState && d.body.characterState !== "draft")
        throw new HttpError(403, "Der Charakterstatus wird ausschließlich über den Prüfungsablauf geändert.");
      if (!a.gm) for (const key of ["disciplines", "merits", "flaws"]) {
        const before = Array.isArray(previous?.[key]) ? previous![key] as Record<string, unknown>[] : [];
        const after = Array.isArray(d.body[key]) ? d.body[key] as Record<string, unknown>[] : [];
        for (const item of after) {
          const existing = before.find(row => row.name === item.name);
          if (item.approved === true || item.slApproved === true) {
            if (!existing || item.approved !== existing.approved || item.slApproved !== existing.slApproved || item.source !== existing.source || item.cost !== existing.cost)
              throw new HttpError(403, "SL-Freigaben und bestätigte Kosten sind geschützt.");
          } else if (d.body.engineVersion && key !== "disciplines" && item.approved !== false)
            throw new HttpError(403, "Neue Vorzüge und Schwächen benötigen eine SL-Kostenprüfung.");
        }
      }
      const clanSelection = validateCharacterClanSelection({
        campaignId: a.campaignId,
        clan: d.body.clan,
        disciplines: d.body.disciplines,
        previousClan: previous?.clan,
        previousDisciplines: previous?.disciplines,
        allowPending: d.body.characterState === "draft",
      });
      if (!clanSelection.ok) throw new HttpError(400, clanSelection.error);
      const engine = validateCharacterDraft(a.campaignId, d.body, previous);
      if (!engine.ok) throw new HttpError(400, engine.error);
    }
    if (d.kind === "sitzungen" && d.body.slSecret !== undefined) {
      const secret = z.object({activePlaceId:z.string().trim().min(1).max(160).nullable().optional()}).passthrough().safeParse(d.body.slSecret);
      if (!secret.success) throw new HttpError(400,"Ungültiger Regie-Schauplatz.");
      if (secret.data.activePlaceId && !(await locationReferenceIsVisible(db,a,secret.data.activePlaceId)))
        throw new HttpError(404,"Schauplatz nicht verfügbar.");
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
          "INSERT INTO records (id,owner_id,kind,visibility,title,body,gm_body,created_at,updated_at,campaign_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
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
          a.campaignId,
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
    if (r.kind === "inventory_carry" || (r.kind === "inventar" && await db.prepare("SELECT 1 AS present FROM entities WHERE id=? AND campaign_id=? AND type='ITEM'").bind(r.id, a.campaignId).first()))
      throw new HttpError(403, "Inventardaten bleiben erhalten. Gegenstände lassen sich im Charakterinventar archivieren.");
    if (legacyBody(r.body).context === "sl-message") throw new HttpError(403, "Das Nachrichtenarchiv bleibt erhalten.");
    if (legacyBody(r.body).context === "appointment-vote") throw new HttpError(403, "Terminantworten bleiben bei der Abstimmung erhalten.");
    if (["live-table", "live-table-signal", "live-table-event"].includes(String(legacyBody(r.body).context))) throw new HttpError(403, "Spielraumdaten sind geschützt.");
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






