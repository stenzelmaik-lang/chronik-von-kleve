import { z } from "zod";
import { actor, database, failure, gmOnly, HttpError, input, json, sameOrigin } from "@/server/access";
import { isRichTextWithinLimit } from "@/domain/location-rich-text";
import { validCalendarDate } from "@/domain/calendar-date";
import { applyPageEdit, isNotebookRow, normalizeTags, pageFromRow, parseBody, slMayRead, sortPages, TEXT_LENGTH, type NotebookRow } from "@/domain/notebook";
import { engagementAwardsEnabled } from "@/server/engagement-config";
import { reconcileEngagementAfterSave, saveNotebookWithEngagement } from "@/server/engagement-awards";
export const dynamic = "force-dynamic";

// Notizbuch: the player's own pages (records kind 'notizen'). Only the owner writes. The SL reads along, never edits,
// and never sees letters a player copied from the mailbox (correspondence stays private).
const page = z.object({
  action: z.literal("save"),
  id: z.string().min(1).max(100).optional(),
  version: z.number().int().positive().optional(),
  title: z.string().max(200),
  text: z.string().max(TEXT_LENGTH),
  date: z.string().refine(validCalendarDate, "Bitte ein gültiges Datum wählen."),
  tags: z.array(z.string().max(200)).max(60),
  characterId: z.string().min(1).max(100).nullable().optional(),
  engagementTicket: z.string().uuid().optional(),
}).strict();
const removal = z.object({ action: z.literal("delete"), id: z.string().min(1).max(100), version: z.number().int().positive() }).strict();
const schema = z.discriminatedUnion("action", [page, removal]);

async function ownPages(db: D1Database, campaignId: string, ownerId: string) {
  const rows = await db.prepare("SELECT id,owner_id,title,visibility,body,version,created_at,updated_at FROM records WHERE campaign_id=? AND owner_id=? AND kind='notizen' ORDER BY updated_at DESC LIMIT 2000")
    .bind(campaignId, ownerId).all<NotebookRow>();
  return sortPages(rows.results.filter(row => isNotebookRow(row, ownerId)).map(pageFromRow));
}

export async function GET(req: Request) {
  try {
    const a = await actor(), db = database(), member = new URL(req.url).searchParams.get("member");
    if (member && member !== a.id) {
      gmOnly(a);
      const person = await db.prepare("SELECT m.id,m.name FROM members m JOIN campaign_memberships c ON c.user_id=m.id AND c.campaign_id=? WHERE m.id=? AND c.status='active'")
        .bind(a.campaignId, member).first<{ id: string; name: string }>();
      if (!person) throw new HttpError(404, "Dieses Mitglied gibt es in der Kampagne nicht.");
      const pages = (await ownPages(db, a.campaignId, person.id)).filter(slMayRead);
      return json({ readOnly: true, owner: { id: person.id, name: person.name }, pages, characters: [] });
    }
    const [pages, characters] = await Promise.all([
      ownPages(db, a.campaignId, a.id),
      db.prepare("SELECT id,title FROM records WHERE campaign_id=? AND owner_id=? AND kind='charaktere' ORDER BY title").bind(a.campaignId, a.id).all<{ id: string; title: string }>(),
    ]);
    return json({ readOnly: false, owner: { id: a.id, name: a.name }, pages, characters: characters.results });
  } catch (e) {
    return failure(e, req);
  }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor(), db = database();
    const parsed = schema.safeParse(await input(req));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const d = parsed.data;
    const now = new Date().toISOString();
    const existing = d.id ? await db.prepare("SELECT id,owner_id,title,visibility,body,version,created_at,updated_at FROM records WHERE id=? AND campaign_id=? AND kind='notizen'").bind(d.id, a.campaignId).first<NotebookRow>() : null;
    // Foreign or system records look exactly like missing ones: nothing about them is revealed.
    if (d.id && (!existing || !isNotebookRow(existing, a.id))) throw new HttpError(404, "Diese Seite gibt es in deinem Notizbuch nicht.");
    if (d.action === "delete") {
      const row = existing!;
      if (pageFromRow(row).deletion === "archive") {
        const body = { ...parseBody(row.body), archived: true, archivedAt: now };
        const result = await db.prepare("UPDATE records SET body=?,version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND version=?").bind(JSON.stringify(body), now, row.id, a.campaignId, d.version).run();
        if (!result.meta.changes) throw new HttpError(409, "Die Seite wurde inzwischen geändert. Lade das Notizbuch neu.");
        return json({ ok: true, archived: true });
      }
      const result = await db.prepare("DELETE FROM records WHERE id=? AND campaign_id=? AND owner_id=? AND version=?").bind(row.id, a.campaignId, a.id, d.version).run();
      if (!result.meta.changes) throw new HttpError(409, "Die Seite wurde inzwischen geändert. Lade das Notizbuch neu.");
      return json({ ok: true, archived: false });
    }
    const tags = normalizeTags(d.tags);
    if (tags.error) throw new HttpError(400, tags.error);
    if (d.text.startsWith("cvk-rich-v1:") ? !isRichTextWithinLimit(d.text, 30000) : d.text.trim().length > TEXT_LENGTH) throw new HttpError(413, "Der Text ist zu lang.");
    const edit = { title: d.title, text: d.text, date: d.date, tags: tags.tags };
    const engagementScope = { campaignId: a.campaignId, memberId: a.id };
    async function save(mutation: D1PreparedStatement, id: string, characterId: string | null, previousText: string, text: string) {
      if (!engagementAwardsEnabled() || d.action !== "save" || !d.engagementTicket || !characterId) return mutation.run();
      const timestamp = Date.parse(now);
      const { saved, claimed } = await saveNotebookWithEngagement(db, engagementScope, mutation, { id, characterId, previousText, text, ticket: d.engagementTicket }, timestamp);
      if (claimed) await reconcileEngagementAfterSave(db, engagementScope, timestamp);
      return saved;
    }
    if (existing) {
      if (!d.version) throw new HttpError(400, "Die Version der Seite fehlt.");
      const next = applyPageEdit(parseBody(existing.body), edit);
      const body = JSON.stringify(next.body);
      if (body.length > 100000) throw new HttpError(413, "Der Text ist zu lang.");
      const mutation = db.prepare("UPDATE records SET title=?,body=?,version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND owner_id=? AND version=?")
        .bind(next.title, body, now, existing.id, a.campaignId, a.id, d.version);
      const previous = pageFromRow(existing);
      const figure = previous.source === 'ort' || previous.source === 'postfach' ? null : previous.characterId;
      const result = await save(mutation, existing.id, figure, previous.text, edit.text);
      if (!result.meta.changes) throw new HttpError(409, "Diese Seite wurde inzwischen an anderer Stelle geändert. Dein Entwurf bleibt erhalten.");
      return json({ page: pageFromRow({ ...existing, title: next.title, body, version: existing.version + 1, updated_at: now }) });
    }
    if (!d.text.trim() && !d.title.trim()) throw new HttpError(400, "Eine leere Seite wird nicht gespeichert.");
    let characterId: string | undefined;
    if (d.characterId) {
      const own = await db.prepare("SELECT id FROM records WHERE id=? AND campaign_id=? AND owner_id=? AND kind='charaktere'").bind(d.characterId, a.campaignId, a.id).first<{ id: string }>();
      if (!own) throw new HttpError(404, "Diese Figur gehört nicht zu dir.");
      characterId = own.id;
    }
    const next = applyPageEdit(characterId ? { characterId } : {}, edit);
    const id = crypto.randomUUID(), body = JSON.stringify(next.body);
    if (body.length > 100000) throw new HttpError(413, "Der Text ist zu lang.");
    const mutation = db.prepare("INSERT INTO records(id,owner_id,kind,visibility,title,body,gm_body,created_at,updated_at,campaign_id) VALUES(?,?,'notizen','private',?,?,'',?,?,?)")
      .bind(id, a.id, next.title, body, now, now, a.campaignId);
    await save(mutation, id, characterId ?? null, '', edit.text);
    return json({ page: pageFromRow({ id, owner_id: a.id, title: next.title, visibility: "private", body, version: 1, created_at: now, updated_at: now }) });
  } catch (e) {
    return failure(e, req);
  }
}
