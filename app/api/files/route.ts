import type { FileRow } from "@/domain/legacy";
import { env } from "cloudflare:workers";
import {
  actor,
  database,
  canRead,
  json,
  failure,
  HttpError,
  sameOrigin,
  input,
} from "@/server/access";
export const dynamic = "force-dynamic";
const types = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export async function GET(req: Request) {
  try {
    const a = await actor();
    const id = new URL(req.url).searchParams.get("id");
    const db = database();
    if (!id) {
      const r = await db
        .prepare(
          "SELECT id,owner_id,visibility,name,mime,size,created_at FROM files WHERE campaign_id=? AND (owner_id=? OR visibility=? OR (visibility=? AND ?=1)) ORDER BY created_at DESC",
        )
        .bind(a.campaignId, a.id, "group", "sl", a.gm ? 1 : 0)
        .all();
      return json({ files: r.results });
    }
    const f = await db
      .prepare("SELECT * FROM files WHERE id=? AND campaign_id=?")
      .bind(id, a.campaignId)
      .first<FileRow>();
    if (!f || !canRead(a, f)) throw new HttpError(404, "Datei nicht gefunden.");
    if (!env.BUCKET)
      throw new HttpError(503, "Dateispeicher nicht erreichbar.");
    const obj = await env.BUCKET.get(f.key);
    if (!obj) throw new HttpError(404, "Datei nicht gefunden.");
    return new Response(obj.body, {
      headers: {
        "Content-Type": f.mime,
        "Content-Disposition": `${f.mime === "application/pdf" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    return failure(e, req);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    if (Number(req.headers.get("content-length") || 0) > 11 * 1024 * 1024)
      throw new HttpError(413, "Bitte maximal 10 MB hochladen.");
    const form = await req.formData();
    const file = form.get("file");
    const visibility = String(form.get("visibility") || "private");
    if (
      !(file instanceof File) ||
      !types.includes(file.type) ||
      file.size === 0 ||
      file.size > 10 * 1024 * 1024
    )
      throw new HttpError(
        400,
        "Erlaubt sind JPG, PNG, WebP und PDF bis 10 MB.",
      );
    if (!["private", "sl", "group"].includes(visibility))
      throw new HttpError(400, "Ungültige Sichtbarkeit.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sig = String.fromCharCode(...bytes.slice(0, 12));
    const valid =
      file.type === "image/png"
        ? bytes[0] === 137 && sig.slice(1, 4) === "PNG"
        : file.type === "image/jpeg"
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : file.type === "image/webp"
            ? sig.startsWith("RIFF") && sig.slice(8) === "WEBP"
            : sig.startsWith("%PDF-");
    if (!valid)
      throw new HttpError(
        400,
        "Dateiinhalt und Dateityp stimmen nicht überein.",
      );
    if (!env.BUCKET)
      throw new HttpError(503, "Dateispeicher nicht erreichbar.");
    const id = crypto.randomUUID(),
      key = `users/${a.id}/${id}`;
    await env.BUCKET.put(key, bytes, {
      httpMetadata: { contentType: file.type },
    });
    try {
      await database()
        .prepare(
          "INSERT INTO files(id,owner_id,visibility,name,mime,size,key,created_at) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          a.id,
          visibility,
          file.name.slice(0, 200),
          file.type,
          file.size,
          key,
          new Date().toISOString(),
        )
        .run();
    } catch (e) {
      await env.BUCKET.delete(key);
      throw e;
    }
    return json({ id });
  } catch (e) {
    return failure(e, req);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    const d = await input(req);
    const f = await database()
      .prepare("SELECT * FROM files WHERE id=? AND owner_id=?")
      .bind(String(d.id), a.id)
      .first<FileRow>();
    if (!f) throw new HttpError(404, "Eigene Datei nicht gefunden.");
    if (!env.BUCKET)
      throw new HttpError(503, "Dateispeicher nicht erreichbar.");
    await env.BUCKET.delete(f.key);
    await database()
      .prepare("DELETE FROM files WHERE id=? AND owner_id=?")
      .bind(f.id, a.id)
      .run();
    return json({ ok: true });
  } catch (e) {
    return failure(e, req);
  }
}
