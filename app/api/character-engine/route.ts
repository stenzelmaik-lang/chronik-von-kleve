import { z } from "zod";
import { validateCharacterDraft, applyXpPurchase, type XpPurchase } from "@/domain/character-engine";
import { availableClanForCampaign } from "@/domain/clan-config";
import { actor, gmOnly, sameOrigin, input, json, failure, HttpError } from "@/server/access";
import { editableCharacter, engineProjection, saveEngine, characterBody } from "@/server/character-engine-service";

export const dynamic = "force-dynamic";
const base = { id: z.string().trim().min(1).max(100), version: z.number().int().positive() };
const reason = z.string().trim().min(3, "Bitte begründe die Aktion kurz.").max(2000);
const purchase = z.object({ category: z.enum(["attribute", "ability", "discipline", "background", "humanity", "willpower"]), target: z.string().trim().min(1).max(120).optional(), from: z.number().int().min(0).max(10), to: z.number().int().min(1).max(10), inClan: z.boolean().optional(), reason: z.string().max(2000).optional() }).strict();
const requestChange = z.object({ category: z.enum(["foreignDiscipline", "merit", "flaw", "identity"]), target: z.string().trim().min(1).max(120), value: z.string().trim().max(2000).optional(), reason }).strict();
const schema = z.discriminatedUnion("action", [
  z.object({ ...base, action: z.literal("review") }).strict(),
  z.object({ ...base, action: z.literal("confirm"), reason: reason.optional() }).strict(),
  z.object({ ...base, action: z.literal("return_draft"), reason }).strict(),
  z.object({ ...base, action: z.literal("xp_purchase"), purchase }).strict(),
  z.object({ ...base, action: z.literal("xp_grant"), amount: z.number().int().min(1).max(1000), reason }).strict(),
  z.object({ ...base, action: z.literal("request_change"), request: requestChange }).strict(),
  z.object({ ...base, action: z.literal("resolve_request"), requestId: z.string().min(1).max(100), approved: z.boolean(), cost: z.number().int().min(0).max(7).optional(), reason }).strict(),
  z.object({ ...base, action: z.literal("correction"), field: z.enum(["concept", "nature", "demeanor", "sire"]), value: z.string().trim().max(2000), reason }).strict(),
  z.object({ ...base, action: z.literal("gm_notes"), text: z.string().max(30000) }).strict(),
]);

export async function GET(req: Request) {
  try { const a = await actor(); const id = new URL(req.url).searchParams.get("id"); if (!id) throw new HttpError(400, "Charakter auswählen."); const { db, row, body } = await editableCharacter(a, id); const history = a.gm ? (await db.prepare("SELECT type,payload,created_at FROM world_events WHERE campaign_id=? AND entity_id=? AND type LIKE 'character.%' ORDER BY created_at DESC,id DESC LIMIT 50").bind(a.campaignId,id).all<{type:string;payload:string;created_at:string}>()).results.map(e=>({action:e.type.replace("character.",""),...characterBody(e.payload),createdAt:e.created_at})) : []; return json({...engineProjection(a, row, body), history}); } catch (e) { return failure(e, req); }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req); const a = await actor(); const parsed = schema.safeParse(await input(req));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const d = parsed.data, { row, body } = await editableCharacter(a, d.id);
    if (row.version !== d.version) throw new HttpError(409, "Der Charakter wurde inzwischen geändert. Bitte neu laden.");
    if (["confirm", "return_draft", "xp_grant", "resolve_request", "correction", "gm_notes"].includes(d.action)) gmOnly(a);
    if (!body.engineVersion && d.action !== "gm_notes" && d.action !== "correction") throw new HttpError(409, "Legacy-Bogen: Werte bleiben erhalten. Die Übernahme in die Engine erfolgt bewusst über den vorhandenen Editor.");
    let next = { ...body }, visibility = row.visibility, notes = row.gm_body, auditReason = "";
    if (d.action === "review") {
      if (row.owner_id !== a.id || body.characterState !== "draft") throw new HttpError(403, "Nur der Besitzer reicht seinen Entwurf ein.");
      next.characterState = "review"; if (visibility === "private") visibility = "sl";
      auditReason = "Besitzer reicht den Bogen ein und teilt ihn gezielt mit der Spielleitung.";
    } else if (d.action === "confirm") {
      if (body.characterState !== "review") throw new HttpError(409, "Zuerst den vollständigen Entwurf zur Prüfung einreichen.");
      const checked = validateCharacterDraft(a.campaignId, body); if (!checked.ok) throw new HttpError(400, checked.error);
      next.characterState = "confirmed";
      next.creationSnapshot = Object.fromEntries(Object.entries(body).filter(([key]) => !["xpLedger", "characterRequests", "engineOperationId"].includes(key)));
      auditReason = d.reason || "Charakter durch die Spielleitung bestätigt.";
    } else if (d.action === "return_draft") {
      if (body.characterState !== "review") throw new HttpError(409, "Nur einen eingereichten Entwurf zurückgeben.");
      next.characterState = "draft"; auditReason = d.reason;
    } else if (d.action === "xp_purchase") {
      if (body.characterState !== "confirmed") throw new HttpError(409, "XP erst nach SL-Bestätigung ausgeben.");
      const normalized: XpPurchase = { ...d.purchase, inClan: !!availableClanForCampaign(a.campaignId, body.clan)?.disciplines.includes(d.purchase.target || "") };
      if (!body.creationSnapshot) throw new HttpError(409, "Der ältere bestätigte Engine-Bogen benötigt zuerst eine dokumentierte Erschaffungsprüfung. Historische Werte werden nicht automatisch umgedeutet.");
      const result = applyXpPurchase(body, normalized); if (!result.ok) throw new HttpError(400, result.error);
      next = result.body; auditReason = d.purchase.reason || `${d.purchase.target || d.purchase.category}: ${d.purchase.from} → ${d.purchase.to} (${result.cost} XP)`;
    } else if (d.action === "xp_grant") {
      if (body.characterState !== "confirmed") throw new HttpError(409, "XP nur einem bestätigten Charakter gutschreiben.");
      next.xpLedger = [...(Array.isArray(body.xpLedger) ? body.xpLedger : []), { id: crypto.randomUUID(), kind: "grant", amount: d.amount, reason: d.reason, createdAt: new Date().toISOString() }]; auditReason = d.reason;
    } else if (d.action === "request_change") {
      if (row.owner_id !== a.id) throw new HttpError(403, "Nur der Besitzer beantragt eine Änderung.");
      const requests = Array.isArray(body.characterRequests) ? body.characterRequests as Record<string, unknown>[] : [];
      if (requests.filter(r => r.status === "pending").length >= 20) throw new HttpError(400, "Bitte zuerst die offenen Anträge klären.");
      if (requests.some(r => r.status === "pending" && r.category === d.request.category && r.target === d.request.target)) throw new HttpError(409, "Für diesen Eintrag ist bereits ein Antrag bei der Spielleitung.");
      if (d.request.category !== "identity" && body.characterState !== "draft") throw new HttpError(409, "Regelausnahmen zunächst ausschließlich während der Erschaffung beantragen.");
      if (d.request.category === "identity" && !["concept", "nature", "demeanor", "sire"].includes(d.request.target)) throw new HttpError(400, "Dieses Feld ist keine zulässige redaktionelle Änderung.");
      next.characterRequests = [...requests, { ...d.request, id: crypto.randomUUID(), status: "pending", createdAt: new Date().toISOString() }];
      if (visibility === "private") visibility = "sl"; auditReason = d.request.reason;
    } else if (d.action === "resolve_request") {
      const requests = Array.isArray(body.characterRequests) ? body.characterRequests as Record<string, unknown>[] : [];
      const request = requests.find(r => r.id === d.requestId && r.status === "pending"); if (!request) throw new HttpError(409, "Antrag bereits entschieden oder nicht vorhanden.");
      if (d.approved) {
        if (request.category !== "identity" && body.characterState !== "draft") throw new HttpError(409, "Bestätigte mechanische Werte bleiben geschützt.");
        if (request.category === "identity") {
          if (!["concept", "nature", "demeanor", "sire"].includes(String(request.target))) throw new HttpError(400, "Unzulässiges Feld.");
          next[String(request.target)] = String(request.value || "");
        } else {
          const key = request.category === "foreignDiscipline" ? "disciplines" : request.category === "merit" ? "merits" : "flaws";
          const rows = Array.isArray(body[key]) ? body[key] as Record<string, unknown>[] : [];
          if (key === "disciplines" && availableClanForCampaign(a.campaignId, body.clan)?.disciplines.includes(String(request.target))) throw new HttpError(400, "Das ist bereits eine Clan-Disziplin.");
          if (key !== "disciplines" && d.cost === undefined) throw new HttpError(400, "Die SL muss die belegten Punktkosten festlegen.");
          const item = key === "disciplines" ? { name: request.target, value: 0, source: "foreign", slApproved: true } : { name: request.target, cost: d.cost, source: "custom", approved: true };
          next[key] = [...rows.filter(r => r.name !== request.target), item];
        }
      }
      next.characterRequests = requests.map(r => r.id === d.requestId ? { ...r, status: d.approved ? "approved" : "rejected", decidedBy: a.id, decidedAt: new Date().toISOString(), decision: d.reason } : r); auditReason = d.reason;
    } else if (d.action === "correction") { next[d.field] = d.value; auditReason = d.reason; }
    else if (d.action === "gm_notes") { notes = d.text; auditReason = "Vertrauliche SL-Notiz aktualisiert."; }
    if (!["gm_notes", "correction", "request_change", "resolve_request"].includes(d.action)) {
      const validation = validateCharacterDraft(a.campaignId, next); if (!validation.ok) throw new HttpError(400, validation.error);
    } else if (d.action === "resolve_request" && d.approved && body.characterState === "draft") {
      const validation = validateCharacterDraft(a.campaignId, next); if (!validation.ok) throw new HttpError(400, validation.error);
    }
    const updated = await saveEngine(a, row, next, d.version, d.action, auditReason, visibility, notes);
    const view = engineProjection(a, updated, characterBody(updated.body));
    return json({ ...view, xpAvailable: view.xp.available, freebieAvailable: view.budget.freebies.remaining });
  } catch (error) { return failure(error, req); }
}
