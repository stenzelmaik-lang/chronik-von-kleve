import { env } from "cloudflare:workers";
import { actor, failure, HttpError, json } from "@/server/access";
import { pocketFile, pocketList } from "@/server/material-pocket";
export const dynamic = "force-dynamic";
/**
 * Pocketed table material. Without itemId: the actor's carried materials (GM: everyone's, with the holder) as viewer
 * data with URLs back to this route. With itemId: one file of the item (state, page or effect sound), authorised by
 * owning the item (or being GM), never by the file's own visibility.
 */
export async function GET(req: Request) {
  try {
    const a = await actor(), params = new URL(req.url).searchParams, id = params.get("itemId");
    if (!id) return json({ items: await pocketList(a) });
    const page = params.get("page");
    const f = await pocketFile(a, id, { state: params.get("state"), page: page === null ? null : Number(page), sound: params.get("sound") === "1" });
    if (!env.BUCKET) throw new HttpError(503, "Dateispeicher nicht erreichbar.");
    const object = await env.BUCKET.get(f.key);
    if (!object) throw new HttpError(404, "Die gespeicherte Datei ist momentan nicht vorhanden.");
    return new Response(object.body, { headers: { "Content-Type": f.mime, "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch (e) { return failure(e, req); }
}
