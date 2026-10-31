import type { Actor } from "@/domain/types";
import type { LegacyRecordRow } from "@/domain/legacy";
import { availableClanForCampaign } from "@/domain/clan-config";
import { appearanceExceptionMaximum, slAdjustmentTargets, creationBudgetSummary, creationDeviation, v20AbilityNames, v20DisciplineNames, isCaitiff, pathCeiling, xpBalance, xpCost, type XpPurchase } from "@/domain/character-engine";
import { creationGuidance } from "@/domain/character-guidance";
import { canEdit, database, HttpError } from "./access";
import { characterPermissions, characterSheet, characterXpSummary, validateExistingSheet } from '@/domain/character-management';

export function characterBody(raw: string): Record<string, unknown> {
  try { const body = JSON.parse(raw); return body && typeof body === "object" && !Array.isArray(body) ? body : {}; } catch { return {}; }
}
export async function editableCharacter(a: Actor, id: string) {
  const db = database();
  const row = await db.prepare("SELECT * FROM records WHERE id=? AND campaign_id=? AND kind='charaktere'").bind(id, a.campaignId).first<LegacyRecordRow>();
  if (!row || !canEdit(a, row)) throw new HttpError(404, "Charakter nicht verfügbar. Zugriff nur für Besitzer und zuständige Spielleitung.");
  const body = characterBody(row.body);
  const entity = await db.prepare("SELECT canon_status FROM entities WHERE id=? AND campaign_id=?").bind(id, a.campaignId).first<{canon_status:string}>();
  if (body.recoveryOnly === true || body.canonStatus === "GM_SECRET" || entity?.canon_status === "GM_SECRET") throw new HttpError(404, "Charakter nicht verfügbar.");
  return { db, row, body };
}
export function engineProjection(a: Actor, row: LegacyRecordRow, body: Record<string, unknown>) {
  const enrolled = body.engineVersion === 1;
  const state = enrolled ? String(body.characterState || "draft") : "legacy";
  const permissions = characterPermissions(body);
  const guidance = creationGuidance(a.campaignId, body);
  const historicalError=body.historicalSnapshot?validateExistingSheet(body):null;
  const readiness=body.historicalSnapshot?{ready:!historicalError,reason:historicalError||'Bestandsbogen bereit zur erneuten SL-Prüfung. Keine Neucharakterbudgets.',missing:[]}:{ready:guidance.reviewReady,reason:guidance.reviewReason,missing:guidance.missing};
  const clan = availableClanForCampaign(a.campaignId, body.clan);
  const targets: Array<XpPurchase & { label: string; cost: number; available: boolean; hint: string; requiresApproval?: boolean }> = [];
  const add = (category: XpPurchase["category"], target: string | undefined, from: unknown) => {
    if (!Number.isInteger(from)) return;
    const value = Number(from), max = category === "humanity" || category === "willpower" ? 10 : 5;
    if (value >= max || (category === "attribute" && target === "Erscheinungsbild" && clan?.id === "nosferatu" && value + 1 > appearanceExceptionMaximum(body))) return;
    const purchase: XpPurchase = { category, target, from: value, to: value + 1, ...(category === "discipline" ? { inClan: !!clan?.disciplines.includes(target || ""), caitiff: isCaitiff(body) } : {}) };
    const price = xpCost(purchase);
    targets.push({ ...purchase, label: target || (category === "humanity" ? "Menschlichkeit" : "Willenskraft"), cost: price.ok ? price.cost : 0, available: price.ok && state === "confirmed" && (a.gm || permissions.development !== 'blocked') && xpBalance(body) >= price.cost, hint: price.ok ? "" : price.error });
  };
  for (const [key, category] of [["attributes", "attribute"]] as const) {
    const values = body[key];
    if (values && typeof values === "object" && !Array.isArray(values)) for (const [name, value] of Object.entries(values)) add(category, name, value);
  }
  const abilities = body.skills && typeof body.skills === "object" ? body.skills as Record<string, unknown> : {};
  for (const name of new Set([...v20AbilityNames,...Object.keys(abilities)])) add("ability", name, abilities[name] ?? 0);
  const virtues=body.virtues as Record<string,unknown>|undefined; if(virtues)for(const [name,value] of Object.entries(virtues))add("virtue",name,value);
  // Deactivated own abilities (W10 K6) stay on the sheet but are not offered for XP.
  if(Array.isArray(body.customAbilities))for(const item of body.customAbilities as Record<string,unknown>[])if(item?.active!==false)add("customAbility",String(item.name),item.value);
  for (const [key, category] of [["disciplines", "discipline"], ["backgrounds", "background"]] as const) {
    if (Array.isArray(body[key])) for (const item of body[key] as Record<string, unknown>[]) add(category, String(item.name), item.value);
  }
  // V20 new Disciplines (10 XP): clan Disciplines directly, others only through an SL-approved request.
  if (!body.disciplines || Array.isArray(body.disciplines)) {
    const owned = new Set((Array.isArray(body.disciplines) ? body.disciplines as Record<string, unknown>[] : []).map(item => String(item.name)));
    for (const name of [...(clan?.disciplines ?? []), ...v20DisciplineNames.filter(item => !clan?.disciplines.includes(item))]) {
      if (owned.has(name)) continue;
      const inClan = !!clan?.disciplines.includes(name), purchase: XpPurchase = { category: "discipline", target: name, from: 0, to: 1, inClan };
      targets.push({ ...purchase, label: name + (inClan ? " (neu, Clan)" : " (neu, clansfremd)"), cost: 10, requiresApproval: !inClan, available: state === "confirmed" && (a.gm || permissions.development !== "blocked") && xpBalance(body) >= 10, hint: inClan ? "" : "Clansfremde Disziplin: nur mit Lehrer und SL-Genehmigung (Antrag)." });
    }
  }
  // V20 Paths: secondary Paths ×4 up to the primary Path; the primary rises with its Discipline.
  if (Array.isArray(body.paths)) for (const row of body.paths as Record<string, unknown>[]) {
    if (row.primary === true || !Number.isInteger(row.value) || Number(row.value) >= pathCeiling(body)) continue;
    add("path", String(row.name), row.value);
  }
  add("humanity", undefined, body.humanity); add("willpower", undefined, body.willpower);
  const ledger = Array.isArray(body.xpLedger) ? body.xpLedger as { kind: string; amount: number }[] : [];
  const creation = body.creationSnapshot && typeof body.creationSnapshot === "object" ? body.creationSnapshot as Record<string, unknown> : body;
  return { id: row.id, title:row.title, sheet:characterSheet(body), deviation:creationDeviation(body), catchUpReadyAt:typeof body.catchUpReadyAt==='string'?body.catchUpReadyAt:null, historicalSource:a.gm&&body.historicalXp&&typeof body.historicalXp==='object'?String((body.historicalXp as Record<string,unknown>).source??''):null, historical:!!body.historicalSnapshot, needsBaseline:enrolled&&state==='confirmed'&&!body.creationSnapshot&&!body.historicalSnapshot, canAdopt:!body.creationSnapshot&&!body.historicalSnapshot&&!ledger.length&&state!=='confirmed', permissions, ownerId: row.owner_id, readiness, version: row.version, state, enrolled, owner: row.owner_id === a.id, canManage: a.gm, canSubmit: row.owner_id === a.id && state === "draft", budget: creationBudgetSummary(creation), xp: characterXpSummary(body), ledger, targets, requests: Array.isArray(body.characterRequests) ? body.characterRequests : [], ...(a.gm ? { gmNotes: row.gm_body, adjustmentTargets:slAdjustmentTargets(body) } : {}) };
}
// The operation token binds the audit to the winner of the compare-and-swap.
export async function saveEngine(a: Actor, row: LegacyRecordRow, next: Record<string, unknown>, expectedVersion: number, action: string, reason: string, visibility = row.visibility, gmBody = row.gm_body, title = row.title, changes:Record<string,unknown> = {}) {
  const db = database(), operation = crypto.randomUUID(), now = new Date().toISOString();
  const body = { ...next, engineOperationId: operation };
  const results = await db.batch([
    db.prepare("UPDATE records SET title=?,body=?,visibility=?,gm_body=?,version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND version=?")
      .bind(title, JSON.stringify(body), visibility, gmBody, now, row.id, a.campaignId, expectedVersion),
    db.prepare("INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,?,?,? FROM records WHERE id=? AND campaign_id=? AND json_extract(body,'$.engineOperationId')=?")
      .bind(operation, a.campaignId, row.id, a.id, "character." + action, JSON.stringify({ reason, changes, previousVersion: expectedVersion, version: expectedVersion + 1 }), now, row.id, a.campaignId, operation),
  ]);
  if (!results[0].meta.changes) throw new HttpError(409, "Der Charakter wurde inzwischen geändert. Bitte neu laden.");
  return { ...row, title, body: JSON.stringify(body), gm_body: gmBody, visibility, version: expectedVersion + 1, updated_at: now };
}
