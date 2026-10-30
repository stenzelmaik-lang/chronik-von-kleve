import { z } from "zod";
import { validateCharacterDraft, applySlAdjustment, applyXpPurchase, type XpPurchase } from "@/domain/character-engine";
import { availableClanForCampaign } from "@/domain/clan-config";
import { actor, gmOnly, sameOrigin, input, json, failure, HttpError } from "@/server/access";
import { editableCharacter, engineProjection, saveEngine, characterBody } from "@/server/character-engine-service";
import { adoptHistoricalCharacter, appendCharacterXp, characterPermissions, characterSheet, characterSheetFields, validateExistingSheet,verifyHistoricalCharacter } from '@/domain/character-management';

export const dynamic = "force-dynamic";
const base = { id: z.string().trim().min(1).max(100), version: z.number().int().positive() };
const reason = z.string().trim().min(3, "Bitte begründe die Aktion kurz.").max(2000);
const operationId = z.string().uuid();
const sheetPatch = z.record(z.string(),z.unknown()).refine(value => Object.keys(value).length > 0 && Object.keys(value).every(key => (characterSheetFields as readonly string[]).includes(key)), 'Nur Bogenfelder sind bearbeitbar.');
const purchase = z.object({ category: z.enum(["attribute", "ability", "customAbility", "virtue", "discipline", "path", "background", "humanity", "willpower"]), target: z.string().trim().min(1).max(120).optional(), from: z.number().int().min(0).max(10), to: z.number().int().min(1).max(10), inClan: z.boolean().optional(), reason: z.string().max(2000).optional() }).strict();
const requestChange = z.object({ category: z.enum(["foreignDiscipline", "appearance", "merit", "flaw", "identity"]), target: z.string().trim().min(1).max(120), value: z.string().trim().max(2000).optional(), reason }).strict();
const slAdjustment = z.object({category:z.enum(['attribute','ability','discipline','background','virtue','humanity','willpower']),target:z.string().trim().min(1).max(120),value:z.number().int().min(0).max(10)}).strict();
const schema = z.discriminatedUnion("action", [
  z.object({...base,action:z.literal('edit_sheet'),patch:sheetPatch,title:z.string().trim().min(1).max(160).optional(),reason}).strict(),
  z.object({...base,action:z.literal('historical_import'),verifyOnly:z.boolean().default(false),confirm:z.boolean().default(false),closeEditing:z.boolean().default(false),operationId,available:z.number().int().min(0).max(1000000),earned:z.number().int().min(0).max(1000000).nullable(),spent:z.number().int().min(0).max(1000000).nullable(),source:z.string().trim().min(3).max(1000),reason}).strict(),
  z.object({...base,action:z.literal('permissions'),editing:z.boolean(),development:z.enum(['direct','approval','blocked']),reason}).strict(),
  z.object({...base,action:z.literal('xp_correction'),operationId,amount:z.number().int().min(-1000000).max(1000000),referenceId:z.string().max(100).optional(),reason}).strict(),
  z.object({...base,action:z.literal('xp_request'),operationId,purchase}).strict(),
  z.object({...base,action:z.literal('xp_decision'),requestId:z.string().max(100),approved:z.boolean(),reason}).strict(),
  z.object({ ...base, action: z.literal("sl_adjustment"), adjustment:slAdjustment, reason }).strict(),
  z.object({ ...base, action: z.literal("review") }).strict(),
  z.object({ ...base, action: z.literal("catch_up_done"), note: z.string().trim().max(2000).optional() }).strict(),
  z.object({ ...base, action: z.literal("confirm"), reason: reason.optional() }).strict(),
  z.object({ ...base, action: z.literal("return_draft"), reason }).strict(),
  z.object({ ...base, action: z.literal("xp_purchase"), purchase }).strict(),
  z.object({ ...base, action: z.literal("xp_grant"), operationId:operationId.optional(), amount: z.number().int().min(1).max(1000), reason }).strict(),
  z.object({ ...base, action: z.literal("request_change"), request: requestChange }).strict(),
  z.object({ ...base, action: z.literal("resolve_request"), asCorrection:z.boolean().default(false), requestId: z.string().min(1).max(100), approved: z.boolean(), cost: z.number().int().min(0).max(7).optional(), rating: z.number().int().min(0).max(5).optional(), maximum: z.number().int().min(1).max(5).optional(), reason }).strict(),
  z.object({ ...base, action: z.literal("grant_exception"), asCorrection:z.boolean().default(false), category: z.enum(["appearance", "foreignDiscipline"]), target: z.string().trim().min(1).max(120), rating: z.number().int().min(0).max(5), maximum: z.number().int().min(1).max(5), reason }).strict(),
  z.object({ ...base, action: z.literal("correction"), field: z.enum(["concept", "nature", "demeanor", "sire"]), value: z.string().trim().max(2000), reason }).strict(),
  z.object({ ...base, action: z.literal("gm_notes"), text: z.string().max(30000) }).strict(),
]);

function grantException(body: Record<string, unknown>, category: string, target: string, rating: number, maximum: number, actorId: string, reason: string, campaignId: string) {
  if (rating > maximum) throw new HttpError(400, "Der gewünschte Wert überschreitet die genehmigte Höchststufe.");
  const next = { ...body };
  if (category === "appearance") {
    if (String(body.clan).toLowerCase() !== "nosferatu" || target !== "Erscheinungsbild") throw new HttpError(400, "Diese Ausnahme gilt ausschließlich für Nosferatu-Erscheinungsbild.");
    next.attributes = { ...(body.attributes as Record<string, unknown>), Erscheinungsbild: rating };
  } else {
    if (availableClanForCampaign(campaignId, body.clan)?.disciplines.includes(target)) throw new HttpError(400, "Das ist bereits eine Clan-Disziplin.");
    const rows = Array.isArray(body.disciplines) ? body.disciplines as Record<string, unknown>[] : [];
    next.disciplines = [...rows.filter(row => row.name !== target), { name: target, value: rating, source: "foreign", slApproved: true }];
  }
  const grants = Array.isArray(body.ruleExceptions) ? body.ruleExceptions as Record<string, unknown>[] : [];
  next.ruleExceptions = [...grants.filter(g => g.category !== category || g.target !== target), { category, target, maximum, decidedBy: actorId, decidedAt: new Date().toISOString(), reason }];
  return next;
}

export async function GET(req: Request) {
  try { const a = await actor(); const id = new URL(req.url).searchParams.get("id"); if (!id) throw new HttpError(400, "Charakter auswählen."); const { db, row, body } = await editableCharacter(a, id); const history = a.gm ? (await db.prepare("SELECT type,payload,created_at FROM world_events WHERE campaign_id=? AND entity_id=? AND type LIKE 'character.%' ORDER BY created_at DESC,id DESC LIMIT 50").bind(a.campaignId,id).all<{type:string;payload:string;created_at:string}>()).results.map(e=>({action:e.type.replace("character.",""),...characterBody(e.payload),createdAt:e.created_at})) : []; return json({...engineProjection(a, row, body), history}); } catch (e) { return failure(e, req); }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req); const a = await actor(); const parsed = schema.safeParse(await input(req));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const d = parsed.data, { row, body } = await editableCharacter(a, d.id);
    if(body.archived===true||body.lifecycleStatus==='ARCHIVED')throw new HttpError(409,'Archivierte Charaktere zuerst wiederherstellen.');
    if (row.version !== d.version) throw new HttpError(409, "Der Charakter wurde inzwischen geändert. Bitte neu laden.");
    if (["historical_import","permissions","xp_correction","xp_decision","sl_adjustment", "confirm", "return_draft", "xp_grant", "resolve_request", "correction", "gm_notes", "grant_exception"].includes(d.action)) gmOnly(a);
    if (!body.engineVersion && !((d.action === "grant_exception" || d.action === "resolve_request") && d.asCorrection) && !['historical_import','permissions','edit_sheet','sl_adjustment','gm_notes','correction','catch_up_done'].includes(d.action)) throw new HttpError(409, "Bestehenden Bogen zuerst bewusst als Bestandscharakter übernehmen. Keine automatische Erschaffung.");
    let next = { ...body }, visibility = row.visibility, notes = row.gm_body, auditReason = "", title = row.title;
    if (d.action === 'edit_sheet') {
      if (!a.gm && (row.owner_id !== a.id || !characterPermissions(body).editing)) throw new HttpError(403,'Für diese Bearbeitung fehlt die ausdrückliche SL-Freigabe.');
      next = {...body,...d.patch};
      for (const value of Object.values(d.patch)) if (typeof value === 'string' && value.length > 30000) throw new HttpError(400,'Ein Bogenfeld ist zu lang.');
      const error = validateExistingSheet(next); if (error) throw new HttpError(400,error);
      title = d.title ?? row.title;
      if (!a.gm && body.characterState === 'confirmed') next.characterState = 'review';
      auditReason = d.reason + ' · '+(a.gm?'SL-Korrektur':'Freigegebene Spielerbearbeitung')+' · XP und ursprünglicher Bogen unverändert';
    } else if (d.action === 'historical_import') {
      try { next = d.verifyOnly?verifyHistoricalCharacter(body,d,a.id):adoptHistoricalCharacter(body,d,a.id); } catch (error) { throw new HttpError(409,(error as Error).message); }
      // One deliberate SL step: adopt the completed sheet, confirm it for play and
      // optionally close the player's catch-up permission. Still no budgets, no reward.
      delete next.catchUpReadyAt;
      if (d.confirm) { next.characterState = 'confirmed'; if (next.historicalXp && typeof next.historicalXp === 'object') next.historicalXp = {...next.historicalXp as Record<string, unknown>,confirmedAt:new Date().toISOString(),confirmedBy:a.id}; }
      if (d.closeEditing) next.characterPermissions = {...characterPermissions(next),editing:false,decidedBy:a.id,decidedAt:new Date().toISOString()};
      auditReason = d.reason + (d.verifyOnly?' · Bestandsprüfung, bestehender XP-Verlauf unverändert':' · Bestandsübernahme, keine neue Belohnung')+' · Quelle: '+d.source+(d.confirm?' · für den Spielbetrieb freigegeben':' · gesonderte SL-Bestätigung ausstehend')+(d.closeEditing?' · Spielerbearbeitung beendet':'');
    } else if (d.action === 'permissions') {
      next.characterPermissions = {editing:d.editing,development:d.development,decidedBy:a.id,decidedAt:new Date().toISOString()}; auditReason=d.reason;
    } else if (d.action === 'xp_correction') {
      if(body.characterState !== 'confirmed') throw new HttpError(409,'XP-Korrekturen benötigen einen bestätigten Bogen.');
      try { next=appendCharacterXp(body,{id:d.operationId,kind:'correction',amount:d.amount,referenceId:d.referenceId,reason:d.reason,createdAt:new Date().toISOString()}); } catch(error) { throw new HttpError(409,(error as Error).message); }
      auditReason=d.reason+' · Gegenbuchung '+d.amount+' XP; Charakterwerte bleiben unverändert';
    } else if (d.action === 'xp_request' || d.action === 'xp_decision') {
      if (body.characterState !== 'confirmed') throw new HttpError(409,'Entwicklung benötigt einen bestätigten Bogen.');
      if(!body.creationSnapshot&&!body.historicalSnapshot)throw new HttpError(409,'Der bestätigte ältere Bogen benötigt zuerst eine dokumentierte Ursprungsprüfung.');
      const requests=Array.isArray(body.characterRequests)?body.characterRequests as Record<string,unknown>[]:[];
      if (d.action === 'xp_request') {
        if (row.owner_id !== a.id || characterPermissions(body).development === 'blocked') throw new HttpError(403,'Entwicklung ist für diesen Charakter gesperrt.');
        if (requests.some(r => r.id === d.operationId || r.status === 'pending' && r.category === 'development' && (r.purchase as XpPurchase)?.target === d.purchase.target && (r.purchase as XpPurchase)?.category === d.purchase.category) || requests.filter(r=>r.status==='pending').length>=20) throw new HttpError(409,'Dieser Antrag ist bereits vorhanden oder es sind zu viele Anträge offen.');
        const normalized={...d.purchase,inClan:!!availableClanForCampaign(a.campaignId,body.clan)?.disciplines.includes(d.purchase.target||'')};
        const checked=applyXpPurchase(body,normalized); if(!checked.ok)throw new HttpError(400,checked.error);
        next.characterRequests=[...requests,{id:d.operationId,category:'development',target:d.purchase.target||d.purchase.category,value:`${d.purchase.from} → ${d.purchase.to} · ${checked.cost} XP`,purchase:normalized,reason:d.purchase.reason||'XP-Entwicklung beantragt',status:'pending',createdAt:new Date().toISOString()}];auditReason='XP-Entwicklung beantragt; noch keine XP gebucht.';
      } else {
        const request=requests.find(r=>r.id===d.requestId&&r.category==='development'&&r.status==='pending'); if(!request)throw new HttpError(409,'Entwicklungsantrag nicht mehr offen.');
        if(d.approved){const p=request.purchase as XpPurchase; const normalized={...p,inClan:!!availableClanForCampaign(a.campaignId,body.clan)?.disciplines.includes(p.target||'')};const result=applyXpPurchase(body,normalized);if(!result.ok)throw new HttpError(409,result.error);next=result.body;}
        next.characterRequests=requests.map(r=>r.id===d.requestId?{...r,status:d.approved?'approved':'rejected',decision:d.reason,decidedBy:a.id,decidedAt:new Date().toISOString()}:r);auditReason=d.reason;
      }
    } else if (d.action === "sl_adjustment") {
      const result=applySlAdjustment(body,d.adjustment,a.id,d.reason);
      if(!result.ok)throw new HttpError(400,result.error);
      next=result.body;
      auditReason=d.reason+' · SL-Korrektur '+d.adjustment.target+': '+result.previous+' → '+d.adjustment.value+' · XP unverändert';
    } else if (d.action === "catch_up_done") {
      // The player reports a finished catch-up; values, XP and permissions stay unchanged.
      if (row.owner_id !== a.id || !characterPermissions(body).editing || body.characterState === 'confirmed') throw new HttpError(403, "Nur der Besitzer meldet einen freigegebenen Nachtrag.");
      next.catchUpReadyAt = new Date().toISOString(); if (visibility === "private") visibility = "sl";
      auditReason = "Spieler meldet den Nachtrag als abgeschlossen" + (d.note ? ": " + d.note : ".");
    } else if (d.action === "review") {
      if (row.owner_id !== a.id || body.characterState !== "draft") throw new HttpError(403, "Nur der Besitzer reicht seinen Entwurf ein.");
      next.characterState = "review"; if (visibility === "private") visibility = "sl";
      auditReason = "Besitzer reicht den Bogen ein und teilt ihn gezielt mit der Spielleitung.";
    } else if (d.action === "confirm") {
      if (body.characterState !== "review") throw new HttpError(409, "Zuerst den vollständigen Entwurf zur Prüfung einreichen.");
      if (body.historicalSnapshot || body.creationSnapshot) { const error=validateExistingSheet(body); if(error)throw new HttpError(400,error); }
      else { const checked = validateCharacterDraft(a.campaignId, body); if (!checked.ok) throw new HttpError(400, checked.error); }
      next.characterState = "confirmed"; delete next.catchUpReadyAt;
      // A catch-up after the adoption belongs to the verified baseline.
      const historicalXp = body.historicalXp as Record<string, unknown> | undefined;
      if (historicalXp && body.historicalSnapshot && !body.creationSnapshot && !historicalXp.confirmedAt) { next.historicalSnapshot = characterSheet(body); next.historicalXp = {...historicalXp,confirmedAt:new Date().toISOString(),confirmedBy:a.id}; }
      if (!body.historicalSnapshot && !body.creationSnapshot) next.creationSnapshot = Object.fromEntries(Object.entries(body).filter(([key]) => !["xpLedger", "characterRequests", "engineOperationId"].includes(key)));
      auditReason = d.reason || "Charakter durch die Spielleitung bestätigt.";
    } else if (d.action === "return_draft") {
      if (body.characterState !== "review") throw new HttpError(409, "Nur einen eingereichten Entwurf zurückgeben.");
      next.characterState = "draft"; delete next.catchUpReadyAt; auditReason = d.reason;
    } else if (d.action === "xp_purchase") {
      if (!a.gm && characterPermissions(body).development !== 'direct') throw new HttpError(403,'Diese Entwicklung muss bei der Spielleitung beantragt werden oder ist gesperrt.');
      if (body.characterState !== "confirmed") throw new HttpError(409, "XP erst nach SL-Bestätigung ausgeben.");
      const normalized: XpPurchase = { ...d.purchase, inClan: !!availableClanForCampaign(a.campaignId, body.clan)?.disciplines.includes(d.purchase.target || "") };
      // V20: a Discipline outside the clan needs a teacher and therefore an SL decision.
      if (!a.gm && normalized.category === "discipline" && normalized.from === 0 && !normalized.inClan) throw new HttpError(403, "Eine clansfremde neue Disziplin bitte bei der Spielleitung beantragen.");
      if (!a.gm && normalized.category === "path" && normalized.from === 0) throw new HttpError(403, "Einen neuen Pfad bitte bei der Spielleitung beantragen.");
      if (!body.creationSnapshot && !body.historicalSnapshot) throw new HttpError(409, "Der ältere bestätigte Engine-Bogen benötigt zuerst eine dokumentierte Erschaffungsprüfung. Historische Werte werden nicht automatisch umgedeutet.");
      const result = applyXpPurchase(body, normalized); if (!result.ok) throw new HttpError(400, result.error);
      next = result.body; auditReason = d.purchase.reason || `${d.purchase.target || d.purchase.category}: ${d.purchase.from} → ${d.purchase.to} (${result.cost} XP)`;
    } else if (d.action === "xp_grant") {
      if (body.characterState !== "confirmed") throw new HttpError(409, "XP nur einem bestätigten Charakter gutschreiben.");
      try { next=appendCharacterXp(body,{id:d.operationId||crypto.randomUUID(),kind:'grant',amount:d.amount,reason:d.reason,createdAt:new Date().toISOString()}); } catch(error) {throw new HttpError(409,(error as Error).message);} auditReason = d.reason;
    } else if (d.action === "request_change") {
      if (row.owner_id !== a.id) throw new HttpError(403, "Nur der Besitzer beantragt eine Änderung.");
      const requests = Array.isArray(body.characterRequests) ? body.characterRequests as Record<string, unknown>[] : [];
      if (requests.filter(r => r.status === "pending").length >= 20) throw new HttpError(400, "Bitte zuerst die offenen Anträge klären.");
      if (requests.some(r => r.status === "pending" && r.category === d.request.category && r.target === d.request.target)) throw new HttpError(409, "Für diesen Eintrag ist bereits ein Antrag bei der Spielleitung.");
      if (d.request.category !== "identity" && !["draft", "review"].includes(String(body.characterState))) throw new HttpError(409, "Regelausnahmen zunächst ausschließlich während der Erschaffung beantragen.");
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
        } else if (request.category === "appearance" || (request.category === "foreignDiscipline" && d.rating !== undefined)) {
          next = grantException(next, String(request.category), String(request.target), d.rating ?? 0, d.maximum ?? Math.max(1, d.rating ?? 0), a.id, d.reason, a.campaignId);
        } else {
          const key = request.category === "foreignDiscipline" ? "disciplines" : request.category === "merit" ? "merits" : "flaws";
          const rows = Array.isArray(body[key]) ? body[key] as Record<string, unknown>[] : [];
          if (key === "disciplines" && availableClanForCampaign(a.campaignId, body.clan)?.disciplines.includes(String(request.target))) throw new HttpError(400, "Das ist bereits eine Clan-Disziplin.");
          if (key !== "disciplines" && d.cost === undefined) throw new HttpError(400, "Die SL muss die belegten Punktkosten festlegen.");
          const item = key === "disciplines" ? { name: request.target, value: 0, source: "foreign", slApproved: true } : { name: request.target, cost: d.cost, source: "custom", approved: true };
          next[key] = [...rows.filter(r => r.name !== request.target), item];
        }
      }
      next.characterRequests = requests.map(r => r.id === d.requestId ? { ...r, ...(d.approved && ["appearance", "foreignDiscipline"].includes(String(request.category)) ? { grantedRating: d.rating ?? 0, maximum: d.maximum ?? Math.max(1, d.rating ?? 0) } : {}), status: d.approved ? "approved" : "rejected", decidedBy: a.id, decidedAt: new Date().toISOString(), decision: d.reason } : r); auditReason = `${d.reason} · ${request.category}: ${request.target} · ${d.approved ? "genehmigt" : "abgelehnt"}${d.rating !== undefined ? ` · Wert ${d.rating}, Maximum ${d.maximum ?? Math.max(1,d.rating)}` : ""}`;
    } else if (d.action === "grant_exception") {
      if (!d.asCorrection && !["draft", "review"].includes(String(body.characterState))) throw new HttpError(409, "Regelausnahmen gelten für Entwürfe und eingereichte Charaktere. Bestätigte Werte bleiben geschützt.");
      next = grantException(next, d.category, d.target, d.rating, d.maximum, a.id, d.reason, a.campaignId);
      auditReason = `${d.reason} · ${d.category}: ${d.target} · Wert ${d.rating}, Maximum ${d.maximum}`;
    } else if (d.action === "correction") { next[d.field] = d.value; auditReason = d.reason; }
    else if (d.action === "gm_notes") { notes = d.text; auditReason = "Vertrauliche SL-Notiz aktualisiert."; }
    if (!((d.action === "grant_exception" || d.action === "resolve_request") && d.asCorrection) && !["edit_sheet","historical_import","permissions","xp_correction","xp_request","xp_decision","sl_adjustment", "gm_notes", "correction", "request_change", "resolve_request", "catch_up_done"].includes(d.action)) {
      const validation = validateCharacterDraft(a.campaignId, next); if (!validation.ok) throw new HttpError(400, validation.error);
    } else if (d.action === "resolve_request" && d.approved && !d.asCorrection && ["draft", "review"].includes(String(body.characterState))) {
      const validation = validateCharacterDraft(a.campaignId, next); if (!validation.ok) throw new HttpError(400, validation.error);
    }
    if ((d.action === "grant_exception" || d.action === "resolve_request") && d.asCorrection) auditReason += " · Bewusste SL-Korrektur, XP und historischer Erschaffungsstand unverändert";
    if (JSON.stringify(next).length>100000) throw new HttpError(413,'Der Charakter ist zu umfangreich. Bitte keine weiteren Einträge hinzufügen.');
    const changes=Object.fromEntries([...characterSheetFields,'characterPermissions',...(title!==row.title?['title']:[])].filter(key=>JSON.stringify(key==='title'?row.title:body[key])!==JSON.stringify(key==='title'?title:next[key])).map(key=>[key,{before:key==='title'?row.title:body[key]??null,after:key==='title'?title:next[key]??null}]));
    const updated = await saveEngine(a, row, next, d.version, d.action, auditReason, visibility, notes, title, changes);
    const view = engineProjection(a, updated, characterBody(updated.body));
    return json({ ...view, xpAvailable: view.xp.available, freebieAvailable: view.budget.freebies.remaining });
  } catch (error) { return failure(error, req); }
}
