import type { Actor } from "@/domain/types";
import { canRead, HttpError } from "@/server/access";
import { richTextFileIds, readRichText, encodeRichText, richTextPrefix, type RichTextDocument } from "@/domain/location-rich-text";

const fileKeys = new Set(["fileId", "backdropFileId"]);
const htmlPrefix = "cvk-html-v1:";
const htmlFileIds = (value: string) => [...value.matchAll(/\/api\/files\?id=([0-9a-zA-Z-]{8,100})/g)].map((m) => m[1]);
const escape = (id: string) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
type Walk = (value: unknown, key: string) => unknown;
function walk(value: unknown, key: string, visit: Walk): unknown {
  const own = visit(value, key);
  if (own !== value) return own;
  if (Array.isArray(value)) return key === "visionFileIds" ? visit(value, "visionFileIds") : value.map((v) => walk(v, "", visit));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v, k, visit)]));
  return value;
}
function withoutImages(doc: RichTextDocument, missing: Set<string>): RichTextDocument {
  const blocks: RichTextDocument["blocks"] = [];
  for (const b of doc.blocks) {
    if (b.type === "image" && missing.has(b.fileId)) continue;
    blocks.push(b.type === "details" ? { ...b, content: withoutImages(b.content, missing) } : b);
  }
  return { ...doc, blocks };
}
/**
 * A deleted gallery file must not make an older preparation version unrestorable.
 * Restoring drops references to files that no longer exist; everything else is kept as saved.
 */
export async function withoutDeletedFiles<T>(db: D1Database, campaignId: string, document: T): Promise<T> {
  const candidates = new Set<string>();
  walk(document, "", (value, key) => {
    if (typeof value === "string" && fileKeys.has(key) && value) candidates.add(value);
    else if (key === "visionFileIds" && Array.isArray(value)) value.forEach((v) => typeof v === "string" && candidates.add(v));
    else if (typeof value === "string" && value.startsWith(richTextPrefix)) richTextFileIds(value).forEach((id) => candidates.add(id));
    else if (typeof value === "string" && value.startsWith(htmlPrefix)) htmlFileIds(value).forEach((id) => candidates.add(id));
    return value;
  });
  if (!candidates.size) return document;
  const ids = [...candidates], existing = new Set<string>();
  for (let i = 0; i < ids.length; i += 90) {
    const part = ids.slice(i, i + 90);
    const rows = await db.prepare(`SELECT id FROM files WHERE campaign_id=? AND id IN (${part.map(() => "?").join(",")})`).bind(campaignId, ...part).all<{ id: string }>();
    rows.results.forEach((r) => existing.add(r.id));
  }
  const missing = new Set(ids.filter((id) => !existing.has(id)));
  if (!missing.size) return document;
  return walk(document, "", (value, key) => {
    if (typeof value === "string" && fileKeys.has(key)) return missing.has(value) ? "" : value;
    if (key === "visionFileIds" && Array.isArray(value)) return value.filter((v) => !missing.has(v));
    if (typeof value === "string" && value.startsWith(richTextPrefix) && richTextFileIds(value).some((id) => missing.has(id))) return encodeRichText(withoutImages(readRichText(value), missing));
    if (typeof value === "string" && value.startsWith(htmlPrefix)) return htmlFileIds(value).filter((id) => missing.has(id)).reduce((html, id) => html.replace(new RegExp("<img\\b[^>]*\\/api\\/files\\?id=" + escape(id) + "\\b[^>]*>", "g"), ""), value);
    return value;
  }) as T;
}
export async function validatePreparationMedia(
  db: D1Database,
  a: Actor,
  texts: string[],
  explicit: { id: string; kind: string }[] = [],
) {
  const requested = [
    ...texts.flatMap((t) =>
      richTextFileIds(t).map((id) => ({ id, kind: "image" })),
    ),
    ...explicit,
  ];
  for (const { id, kind } of requested) {
    const f = await db
      .prepare(
        "SELECT owner_id,visibility,mime FROM files WHERE id=? AND campaign_id=?",
      )
      .bind(id, a.campaignId)
      .first<{
        owner_id: string;
        visibility: "private" | "sl" | "group";
        mime: string;
      }>();
    if (!f || !canRead(a, f))
      throw new HttpError(404, "Eine Mediendatei ist nicht verfügbar.");
    if (
      ["image", "audio", "video"].includes(kind) &&
      !f.mime.startsWith(kind + "/")
    )
      throw new HttpError(400, "Diese Datei passt nicht zum Elementtyp.");
  }
}
