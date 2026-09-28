import { availableClanForCampaign } from "./clan-config.ts";

export const characterStates = ["draft", "review", "confirmed"] as const;
export type CharacterState = typeof characterStates[number];

export const freebieCosts = {
  attribute: 5,
  ability: 2,
  discipline: 7,
  background: 1,
  virtue: 2,
  humanity: 2,
  willpower: 1,
} as const;

export const creationBudgets = {
  attributes: [7, 5, 3] as const,
  abilities: [13, 9, 5] as const,
  disciplines: 3,
  backgrounds: 5,
  virtues: 7,
  freebies: 15,
  flawFreebiesMaximum: 7,
} as const;

const attributeGroups = {
  physical: ["Körperkraft", "Geschick", "Widerstandsfähigkeit"],
  social: ["Charisma", "Manipulation", "Erscheinungsbild"],
  mental: ["Wahrnehmung", "Intelligenz", "Geistesschärfe"],
} as const;
const abilityGroups = {
  talents: ["Aufmerksamkeit", "Ausdruck", "Ausflüchte", "Einschüchtern", "Empathie", "Führungsqualitäten", "Handgemenge", "Magiegespür", "Sportlichkeit", "Szenekenntnis"],
  skills: ["Diebstahl", "Etikette", "Fahren", "Handwerk", "Heimlichkeit", "Nahkampf", "Schusswaffen", "Tierkunde", "Überleben", "Vortrag"],
  knowledges: ["Akademisches Wissen", "Computer", "Finanzen", "Gesetzeskenntnis", "Medizin", "Nachforschungen", "Naturwissenschaften", "Okkultismus", "Politik", "Technologie"],
} as const;

export type CreationBudgetLine = { spent: number; limit: number; remaining: number; exceeded: boolean };
export type CreationBudgetSummary = {
  attributes: { physical: CreationBudgetLine; social: CreationBudgetLine; mental: CreationBudgetLine };
  abilities: { talents: CreationBudgetLine; skills: CreationBudgetLine; knowledges: CreationBudgetLine };
  disciplines: CreationBudgetLine;
  backgrounds: CreationBudgetLine;
  virtues: CreationBudgetLine;
  freebies: CreationBudgetLine;
};

export type XpLedgerEntry = {
  id: string;
  kind: "grant" | "spend";
  amount: number;
  reason: string;
  createdAt: string;
};

export type XpPurchase = {
  category: "attribute" | "ability" | "discipline" | "background" | "humanity" | "willpower";
  target?: string;
  from: number;
  to: number;
  inClan?: boolean;
  reason?: string;
};

type NumericMap = Record<string, unknown>;
type CharacterLike = Record<string, unknown>;
type CharacterRow = CharacterLike & { name?: unknown; value?: unknown; source?: unknown; slApproved?: unknown };

function integer(value: unknown, fallback = 0) { return typeof value === "number" && Number.isInteger(value) ? value : fallback; }
function line(spent: number, limit: number): CreationBudgetLine { return { spent, limit, remaining: limit - spent, exceeded: spent > limit }; }
function rows(value: unknown): CharacterRow[] { return Array.isArray(value) ? value.filter((item): item is CharacterRow => !!item && typeof item === "object") : []; }
function groupedSpent(value: unknown, names: readonly string[], base: number, body: CharacterLike, category: keyof typeof freebieCosts) {
  const map = value && typeof value === "object" && !Array.isArray(value) ? value as NumericMap : {};
  return names.reduce((total, name) => total + Math.max(0, integer(map[name]) - base - freebiePointsForTarget(body, category, name)), 0);
}

/** Explicitly targeted Freebie dots can cover an extra value; no surplus is inferred. */
export function freebiePointsForTarget(body: CharacterLike, category: keyof typeof freebieCosts, target?: string) {
  const expectedTarget = target?.trim();
  return (Array.isArray(body.freebiePurchases) ? body.freebiePurchases : []).reduce((total, purchase) => {
    const item = purchase as CharacterLike;
    if (item.category !== category) return total;
    if (expectedTarget && String(item.target ?? "").trim() !== expectedTarget) return total;
    if (expectedTarget && !String(item.target ?? "").trim()) return total;
    return total + Math.max(0, integer(item.points));
  }, 0);
}

export function derivedV20Values(body: CharacterLike) {
  const virtues = body.virtues && typeof body.virtues === "object" && !Array.isArray(body.virtues) ? body.virtues as NumericMap : {};
  const conscience = Math.max(1, integer(virtues.Gewissen, 1) - freebiePointsForTarget(body, "virtue", "Gewissen"));
  const selfControl = Math.max(1, integer(virtues.Selbstbeherrschung, 1) - freebiePointsForTarget(body, "virtue", "Selbstbeherrschung"));
  const courage = Math.max(1, integer(virtues.Mut, 1) - freebiePointsForTarget(body, "virtue", "Mut"));
  return {
    humanity: conscience + selfControl + freebiePointsForTarget(body, "humanity"),
    willpower: courage + freebiePointsForTarget(body, "willpower"),
  };
}

/**
 * Returns the live V20 creation budget state used by the editor and by draft
 * validation. Attribute values are measured above their base 1 dot; abilities
 * start at 0. This function deliberately has no UI dependencies.
 */
export function creationBudgetSummary(body: CharacterLike): CreationBudgetSummary {
  const virtues = body.virtues && typeof body.virtues === "object" && !Array.isArray(body.virtues) ? body.virtues as NumericMap : {};
  const freebieSpent = freebieTotal(body);
  return {
    attributes: {
      physical: line(groupedSpent(body.attributes, attributeGroups.physical, 1, body, "attribute"), 7),
      social: line(groupedSpent(body.attributes, attributeGroups.social, 1, body, "attribute"), 5),
      mental: line(groupedSpent(body.attributes, attributeGroups.mental, 1, body, "attribute"), 3),
    },
    abilities: {
      talents: line(groupedSpent(body.skills, abilityGroups.talents, 0, body, "ability"), 13),
      skills: line(groupedSpent(body.skills, abilityGroups.skills, 0, body, "ability"), 9),
      knowledges: line(groupedSpent(body.skills, abilityGroups.knowledges, 0, body, "ability"), 5),
    },
    disciplines: line(rows(body.disciplines).reduce((total, item) => item.source === "foreign" ? total : total + Math.max(0, integer(item.value) - freebiePointsForTarget(body, "discipline", String(item.name ?? "").trim())), 0), creationBudgets.disciplines),
    backgrounds: line(rows(body.backgrounds).reduce((total, item) => total + Math.max(0, integer(item.value) - freebiePointsForTarget(body, "background", String(item.name ?? "").trim())), 0), creationBudgets.backgrounds),
    virtues: line(["Gewissen", "Selbstbeherrschung", "Mut"].reduce((total, name) => total + Math.max(0, integer(virtues[name], 1) - 1 - freebiePointsForTarget(body, "virtue", name)), 0), creationBudgets.virtues),
    freebies: line(freebieSpent, freebieCapacity(body)),
  };
}
function samePermanent(left: CharacterLike, right: CharacterLike) {
  const runtime = new Set(["blood", "health", "willpowerTemporary"]);
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (runtime.has(key) || ["characterState", "xpLedger", "xp"].includes(key)) continue;
    if (JSON.stringify(left[key] ?? null) !== JSON.stringify(right[key] ?? null)) return false;
  }
  return true;
}

export function freebieCapacity(body: CharacterLike) {
  const flaws = Array.isArray(body.flaws) ? body.flaws : [];
  const bonus = Math.min(creationBudgets.flawFreebiesMaximum, flaws.reduce((total, flaw) => {
    const item = flaw as CharacterLike;
    // New catalog/custom rows are explicitly marked unapproved until the SL
    // confirms their cost. Legacy rows without the marker remain compatible.
    return total + (item.approved === false ? 0 : integer(item.cost));
  }, 0));
  return creationBudgets.freebies + bonus;
}

export function freebieTotal(body: CharacterLike) {
  const purchases = Array.isArray(body.freebiePurchases) ? body.freebiePurchases : [];
  return purchases.reduce((total, purchase) => {
    const item = purchase as CharacterLike;
    const category = String(item.category) as keyof typeof freebieCosts;
    return total + (freebieCosts[category] ?? 0) * integer(item.points);
  }, 0);
}

export function xpBalance(body: CharacterLike) {
  const ledger = Array.isArray(body.xpLedger) ? body.xpLedger : [];
  return ledger.reduce((total, row) => {
    const item = row as CharacterLike;
    return total + (item.kind === "grant" ? integer(item.amount) : -integer(item.amount));
  }, 0);
}

export function xpCost(purchase: XpPurchase) {
  if (!Number.isInteger(purchase.from) || !Number.isInteger(purchase.to) || purchase.to !== purchase.from + 1)
    return { ok: false as const, error: "XP-Steigerungen müssen genau eine Stufe umfassen." };
  const categoryCost = purchase.category === "attribute" ? purchase.from * 4
    : purchase.category === "ability" ? (purchase.from === 0 ? 3 : purchase.from * 2)
      : purchase.category === "discipline" ? purchase.from * (purchase.inClan ? 5 : 7)
        : purchase.category === "background" ? purchase.from * 3
          : purchase.category === "humanity" ? purchase.from * 2
            : 1;
  return { ok: true as const, cost: categoryCost };
}

function withRaisedValue(body: CharacterLike, purchase: XpPurchase): CharacterLike | null {
  const target = String(purchase.target ?? "").trim();
  if (["humanity", "willpower"].includes(purchase.category)) {
    const key = purchase.category;
    return { ...body, [key]: purchase.to };
  }
  if (!target) return null;
  const key = purchase.category === "attribute" ? "attributes" : purchase.category === "ability" ? "skills" : purchase.category === "discipline" ? "disciplines" : "backgrounds";
  const collection = body[key];
  if (Array.isArray(collection)) {
    const next = collection.map((item) => item && typeof item === "object" && String((item as CharacterLike).name) === target ? { ...(item as CharacterLike), value: purchase.to } : item);
    if (!next.some((item) => item && typeof item === "object" && String((item as CharacterLike).name) === target)) return null;
    return { ...body, [key]: next };
  }
  if (collection && typeof collection === "object" && Object.prototype.hasOwnProperty.call(collection, target))
    return { ...body, [key]: { ...(collection as CharacterLike), [target]: purchase.to } };
  return null;
}

function currentValue(body: CharacterLike, purchase: XpPurchase) {
  if (purchase.category === "humanity" || purchase.category === "willpower") return body[purchase.category];
  const key = purchase.category === "attribute" ? "attributes" : purchase.category === "ability" ? "skills" : purchase.category === "discipline" ? "disciplines" : "backgrounds";
  const collection = body[key];
  if (Array.isArray(collection)) return (collection.find((item) => item && typeof item === "object" && String((item as CharacterLike).name) === purchase.target) as CharacterLike | undefined)?.value;
  return collection && typeof collection === "object" ? (collection as CharacterLike)[String(purchase.target)] : undefined;
}

export type ValidationResult = { ok: true; state: CharacterState; freebieSpent: number; freebieAvailable: number; xpAvailable: number } | { ok: false; error: string };

/** Pure rules validation shared by API, tests and future UI. Legacy bodies opt out until enrolled. */
export function validateCharacterDraft(campaignId: string, body: CharacterLike, previous?: CharacterLike): ValidationResult {
  const state = characterStates.includes(body.characterState as CharacterState) ? body.characterState as CharacterState : "draft";
  if (previous && previous.characterState === "confirmed" && (body.characterState !== "confirmed" || !samePermanent(previous, body)))
    return { ok: false, error: "Bestätigte permanente Charakterwerte sind gesperrt." };
  if (body.characterState && !characterStates.includes(body.characterState as CharacterState))
    return { ok: false, error: "Unbekannter Charakterstatus." };
  if (!body.engineVersion && !body.creationAllocations && !body.freebiePurchases && !body.xpLedger && !body.characterState)
    return { ok: true, state, freebieSpent: 0, freebieAvailable: freebieCapacity(body), xpAvailable: xpBalance(body) };
  if (body.characterState && (!body.engineVersion || !body.creationAllocations || !body.freebiePurchases))
    return { ok: false, error: "Ein Engine-Charakter benötigt die vollständige Erschaffungsgrundlage." };
  const allowIncompleteDraft = body.characterState === "draft";
  const clan = availableClanForCampaign(campaignId, body.clan);
  const purchases = Array.isArray(body.freebiePurchases) ? body.freebiePurchases : [];
  const invalidPurchase = purchases.find((purchase) => {
    const item = purchase as CharacterLike;
    const category = item.category as keyof typeof freebieCosts;
    return !(category in freebieCosts) || !Number.isInteger(item.points) || Number(item.points) <= 0 || (["attribute", "ability", "discipline", "background", "virtue"].includes(String(category)) && !String(item.target ?? "").trim());
  });
  if (invalidPurchase) return { ok: false, error: "Jeder Freebie-Kauf benötigt eine gültige Kategorie, Punktzahl und ein konkretes Ziel." };
  const attributeValues = body.attributes && typeof body.attributes === "object" && !Array.isArray(body.attributes) ? body.attributes as NumericMap : {};
  const skillValues = body.skills && typeof body.skills === "object" && !Array.isArray(body.skills) ? body.skills as NumericMap : {};
  const overFive = [...Object.entries(attributeValues), ...Object.entries(skillValues)].find(([, value]) => integer(value) > 5);
  if (overFive) return { ok: false, error: `${overFive[0]} darf regulär höchstens 5 Punkte haben.` };
  const overThreeAbility = [...abilityGroups.talents, ...abilityGroups.skills, ...abilityGroups.knowledges].find((name) => integer(skillValues[name]) - freebiePointsForTarget(body, "ability", name) > 3);
  if (overThreeAbility) return { ok: false, error: `${overThreeAbility} benötigt für Werte über 3 eine gezielte Fähigkeit-Freebie-Ausgabe.` };
  const foreignWithoutApproval = rows(body.disciplines).find((item) => {
    const name = String(item.name ?? "").trim();
    return !!name && !!clan && !clan.disciplines.includes(name) && !(item.source === "foreign" && item.slApproved === true && freebiePointsForTarget(body, "discipline", name) >= Math.max(1, integer(item.value)));
  });
  if (foreignWithoutApproval) return { ok: false, error: `${String(foreignWithoutApproval.name)} benötigt eine dokumentierte SL-Ausnahme und gezielte Disziplin-Freebies.` };
  const allocations = (body.creationAllocations ?? {}) as CharacterLike;
  if (!allowIncompleteDraft && allocations.attributes && JSON.stringify(Object.values(allocations.attributes).sort((a, b) => Number(b) - Number(a))) !== JSON.stringify([...creationBudgets.attributes].sort((a, b) => b - a)))
    return { ok: false, error: "Attribute müssen nach 7/5/3 verteilt werden." };
  if (!allowIncompleteDraft && allocations.abilities && JSON.stringify(Object.values(allocations.abilities).sort((a, b) => Number(b) - Number(a))) !== JSON.stringify([...creationBudgets.abilities].sort((a, b) => b - a)))
    return { ok: false, error: "Fähigkeiten müssen nach 13/9/5 verteilt werden." };
  const budget = creationBudgetSummary(body);
  const exceeded = [
    ["Attribute körperlich", budget.attributes.physical],
    ["Attribute sozial", budget.attributes.social],
    ["Attribute mental", budget.attributes.mental],
    ["Talente", budget.abilities.talents],
    ["Fertigkeiten", budget.abilities.skills],
    ["Kenntnisse", budget.abilities.knowledges],
    ["Tugenden", budget.virtues],
  ].find(([, current]) => (current as CreationBudgetLine).exceeded);
  if (exceeded) return { ok: false, error: `${exceeded[0]} überschreiten das V20-Erschaffungsbudget (${(exceeded[1] as CreationBudgetLine).spent}/${(exceeded[1] as CreationBudgetLine).limit}).` };
  const spent = freebieTotal(body);
  if (spent > freebieCapacity(body)) return { ok: false, error: "Das freie Zusatzpunktebudget reicht nicht aus." };
  const xp = xpBalance(body);
  if (xp < 0) return { ok: false, error: "Das XP-Ledger darf nicht negativ werden." };
  if (allowIncompleteDraft)
    return { ok: true, state, freebieSpent: spent, freebieAvailable: freebieCapacity(body) - spent, xpAvailable: xp };
  if (!clan) return { ok: false, error: "Ein bestätigter Engine-Charakter benötigt einen freigegebenen Clan." };
  const disciplineSpent = rows(body.disciplines).reduce((total, item) => item.source === "foreign" ? total : total + Math.max(0, integer(item.value) - freebiePointsForTarget(body, "discipline", String(item.name ?? "").trim())), 0);
  if (disciplineSpent !== creationBudgets.disciplines) return { ok: false, error: "Die anfänglichen Clan-Disziplinen benötigen drei Punkte." };
  const backgroundSpent = rows(body.backgrounds).reduce((total, item) => total + Math.max(0, integer(item.value) - freebiePointsForTarget(body, "background", String(item.name ?? "").trim())), 0);
  if (backgroundSpent !== creationBudgets.backgrounds) return { ok: false, error: "Die Hintergründe benötigen fünf Punkte." };
  const virtueSpent = body.virtues && typeof body.virtues === "object" && !Array.isArray(body.virtues)
    ? ["Gewissen", "Selbstbeherrschung", "Mut"].reduce((total, name) => total + Math.max(0, integer((body.virtues as NumericMap)[name], 1) - 1 - freebiePointsForTarget(body, "virtue", name)), 0)
    : 0;
  if (virtueSpent !== creationBudgets.virtues)
    return { ok: false, error: "Die Tugenden benötigen sieben zusätzliche Punkte." };
  return { ok: true, state, freebieSpent: spent, freebieAvailable: freebieCapacity(body) - spent, xpAvailable: xp };
}

export function applyXpPurchase(body: CharacterLike, purchase: XpPurchase, now = new Date().toISOString()): { ok: true; body: CharacterLike; cost: number } | { ok: false; error: string } {
  if (currentValue(body, purchase) !== purchase.from) return { ok: false, error: "Der aktuelle Charakterwert passt nicht zur XP-Anfrage." };
  const raised = withRaisedValue(body, purchase);
  if (!raised) return { ok: false, error: "Das angegebene XP-Ziel existiert nicht im Charakter." };
  const price = xpCost(purchase);
  if (!price.ok) return price;
  const available = xpBalance(body);
  if (available < price.cost) return { ok: false, error: "Nicht genügend XP verfügbar." };
  const ledger = Array.isArray(body.xpLedger) ? [...body.xpLedger] : [];
  ledger.push({ id: crypto.randomUUID(), kind: "spend", amount: price.cost, reason: purchase.reason || `${purchase.category} ${purchase.from} → ${purchase.to}`, createdAt: now });
  return { ok: true, body: { ...raised, xpLedger: ledger }, cost: price.cost };
}
