import { env } from "cloudflare:workers";
import { actor, database, failure, HttpError, json, sameOrigin } from "@/server/access";
import { characterRecord, inventoryProjection } from "@/server/inventory";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor(), db = database();
    if (Number(req.headers.get("content-length") || 0) > 11 * 1024 * 1024) throw new HttpError(413, "Bitte maximal 10 MB hochladen.");
    const form = await req.formData(), file = form.get("file"), visibility = String(form.get("visibility") || "private");
    const character = await characterRecord(db, a, String(form.get("characterId") || ""));
    if (!["private", "sl", "group"].includes(visibility) || (character.owner_id !== a.id && visibility === "private")) throw new HttpError(403, "Dieses Bild darf nicht mit dieser Sichtbarkeit zugeordnet werden.");
    if (!(file instanceof File) || !["image/png", "image/jpeg", "image/webp"].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024) throw new HttpError(400, "Erlaubt sind PNG, JPG und WebP bis 10 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer()), sig = String.fromCharCode(...bytes.slice(0, 12));
    const valid = file.type === "image/png" ? bytes[0] === 137 && sig.slice(1, 4) === "PNG" : file.type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : sig.startsWith("RIFF") && sig.slice(8) === "WEBP";
    if (!valid) throw new HttpError(400, "Bildinhalt und Dateityp stimmen nicht überein.");
    if (!env.BUCKET) throw new HttpError(503, "Bildspeicher momentan nicht erreichbar.");
    const id = crypto.randomUUID(), key = `inventory/${a.campaignId}/${a.id}/${id}`;
    await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: file.type } });
    try { await db.prepare("INSERT INTO files(id,campaign_id,owner_id,visibility,name,mime,size,key,created_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(id, a.campaignId, a.id, visibility, file.name.slice(0, 200), file.type, file.size, key, new Date().toISOString()).run(); }
    catch (e) { await env.BUCKET.delete(key); throw e; }
    return json({ id });
  } catch (e) { return failure(e, req); }
}
export async function GET(req: Request) {
  try {
    const a = await actor(), db = database(), id = new URL(req.url).searchParams.get("itemId");
    if (!id) throw new HttpError(404, "Gegenstandsbild nicht gefunden.");
    const row = await db.prepare("SELECT json_extract(body,'$.characterId') characterId FROM records WHERE id=? AND campaign_id=? AND kind='inventar'").bind(id, a.campaignId).first<{ characterId: string }>();
    if (!row) throw new HttpError(404, "Gegenstandsbild nicht gefunden.");
    const p = await inventoryProjection(db, a, row.characterId, true), item = p.items.find(i => i.id === id);
    if (!item?.imageFileId) throw new HttpError(404, "Gegenstandsbild nicht gefunden.");
    const file = await db.prepare("SELECT key,mime,name,visibility,owner_id FROM files WHERE id=? AND campaign_id=?").bind(item.imageFileId, a.campaignId).first<{ key: string; mime: string; name: string; visibility: string; owner_id: string }>();
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.mime) || (file.visibility === "private" && file.owner_id !== a.id) || (item.visibility !== "private" && file.visibility !== item.visibility)) throw new HttpError(404, "Gegenstandsbild nicht freigegeben.");
    if (!env.BUCKET) throw new HttpError(503, "Bildspeicher momentan nicht erreichbar.");
    const object = await env.BUCKET.get(file.key);
    if (!object) throw new HttpError(404, "Das gespeicherte Bild ist momentan nicht vorhanden.");
    return new Response(object.body, { headers: { "Content-Type": file.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch (e) { return failure(e, req); }
}
