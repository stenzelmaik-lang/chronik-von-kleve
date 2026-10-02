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
export const v20AbilityNames: readonly string[] = Object.values(abilityGroups).flat();

export type CreationBudgetLine = { spent: number; limit: number; remaining: number; exceeded: boolean; freebieDots?: number; freebieCost?: number };
export type AutomaticFreebieLine = {
  category: keyof typeof freebieCosts;
  target: string;
  dots: number;
  cost: number;
  total: number;
};
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
function numericValue(value: unknown, fallback = 0) { return Math.max(0, integer(value, fallback)); }
/** Server-owned, character-bound SL exception; generic record writes cannot alter it. */
export function appearanceExceptionMaximum(body: CharacterLike): number {
  if (!Array.isArray(body.ruleExceptions)) return 0;
  return body.ruleExceptions.reduce((maximum, raw) => {
    if (!raw || typeof raw !== "object") return maximum;
    const grant = raw as CharacterLike;
    return grant.category === "appearance" && grant.target === "Erscheinungsbild" &&
      typeof grant.decidedBy === "string" && typeof grant.reason === "string" &&
      Number.isInteger(grant.maximum) && Number(grant.maximum) >= 1 && Number(grant.maximum) <= 5
      ? Math.max(maximum, Number(grant.maximum)) : maximum;
  }, 0);
}

/** The free V20 attribute dot is visible in the editor and is not a spendable point. */
export function attributeBase(body: CharacterLike, name: string) {
  const clan = String(body.clan ?? "").trim().toLocaleLowerCase();
  if (name === "Erscheinungsbild" && clan === "nosferatu") return 0;
  return 1;
}

/** Materialize free starting dots for explicit engine drafts only. Existing
 * values are preserved, including invalid values for validation to reject. */
export function withCreationBaseValues(body: CharacterLike): CharacterLike {
  if (body.engineVersion !== 1 || body.characterState !== "draft") return body;
  const attributes = body.attributes && typeof body.attributes === "object" && !Array.isArray(body.attributes) ? body.attributes as NumericMap : {};
  const virtues = body.virtues && typeof body.virtues === "object" && !Array.isArray(body.virtues) ? body.virtues as NumericMap : {};
  const next = {
    ...body,
    attributes: { ...Object.fromEntries(Object.values(attributeGroups).flat().map(name => [name, attributeBase(body, name)])), ...attributes },
    virtues: { Gewissen: 1, Selbstbeherrschung: 1, Mut: 1, ...virtues },
  };
  const derived = derivedV20Values(next);
  return { ...next, humanity: body.humanity ?? derived.humanity, willpower: body.willpower ?? derived.willpower };
}

/** Explicitly targeted Freebie dots can cover an extra value; no surplus is inferred. */
export function freebiePointsForTarget(body: CharacterLike, category: keyof typeof freebieCosts, target?: string) {
  const expectedTarget = target?.trim();
  return (Array.isArray(body.freebiePurchases) ? body.freebiePurchases : []).reduce((total, purchase) => {
    if (!purchase || typeof purchase !== "object" || Array.isArray(purchase)) return total;
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

/** Dots remain the only input. Targeted virtue Freebies retain the original
 * derived starting values, even when a later click raises another virtue. */
export function editCreationRating(body: CharacterLike, key: "attributes" | "skills" | "virtues", name: string, value: number): CharacterLike {
  const values = body[key] && typeof body[key] === "object" ? body[key] as CharacterLike : {};
  const next: CharacterLike = { ...body, [key]: { ...values, [name]: value } };
  if (key !== "virtues") return next;
  const previous = integer(values[name], 1), delta = value - previous;
  const oldExtra = freebiePointsForTarget(body, "virtue", name);
  const normalSpent = ["Gewissen", "Selbstbeherrschung", "Mut"].reduce((total, target) => total + Math.max(0, integer(values[target], 1) - 1 - freebiePointsForTarget(body, "virtue", target)), 0);
  const extras = delta > 0 ? oldExtra + Math.max(0, delta - Math.max(0, creationBudgets.virtues - normalSpent)) : Math.max(0, oldExtra + delta);
  const purchases = Array.isArray(body.freebiePurchases) ? body.freebiePurchases as CharacterLike[] : [];
  next.freebiePurchases = [...purchases.filter(item => !(item.category === "virtue" && item.target === name)), ...(extras > 0 ? [{ category: "virtue", target: name, points: extras }] : [])];
  return next;
}

/** Optional creation increases above the derived starting values use the
 * same explicit Freebie ledger as virtue extras, never the XP ledger. */
export function editDerivedCreationRating(body: CharacterLike, category: "humanity" | "willpower", value: number): CharacterLike {
  const current = derivedV20Values(body)[category];
  const points = freebiePointsForTarget(body, category) + value - current;
  if (!Number.isInteger(value) || value > 10 || points < 0) return body;
  const purchases = Array.isArray(body.freebiePurchases) ? body.freebiePurchases as CharacterLike[] : [];
  return { ...body, freebiePurchases: [...purchases.filter(item => item.category !== category), ...(points ? [{category, points}] : [])] };
}

function explicitFreebieDots(body: CharacterLike, category: keyof typeof freebieCosts) {
  return freebiePointsForTarget(body, category);
}

function automaticLine(category: keyof typeof freebieCosts, target: string, rawDots: number, explicitDots: number): AutomaticFreebieLine | null {
  const dots = Math.max(0, rawDots - explicitDots);
  return dots > 0 ? { category, target, dots, cost: freebieCosts[category], total: dots * freebieCosts[category] } : null;
}

function groupOverflow(value: unknown, names: readonly string[], limit: number, base: (name: string) => number, perValueMaximum?: number) {
  const map = value && typeof value === "object" && !Array.isArray(value) ? value as NumericMap : {};
  let regularSpent = 0;
  let aboveIndividualMaximum = 0;
  for (const name of names) {
    const dots = Math.max(0, numericValue(map[name]) - base(name));
    const regularDots = perValueMaximum === undefined ? dots : Math.min(dots, Math.max(0, perValueMaximum - base(name)));
    regularSpent += regularDots;
    if (perValueMaximum !== undefined) aboveIndividualMaximum += Math.max(0, dots - Math.max(0, perValueMaximum - base(name)));
  }
  const rawOverflow = Math.max(0, regularSpent - limit) + aboveIndividualMaximum;
  return { regularSpent, standardSpent: Math.min(limit, regularSpent), rawOverflow };
}

function groupLimits(body: CharacterLike, category: "attributes" | "abilities") {
  const allocations = body.creationAllocations as Record<string, Record<string, number>> | undefined;
  const defaults = category === "attributes" ? { physical: 7, social: 5, mental: 3 } : { talents: 13, skills: 9, knowledges: 5 };
  const selected = allocations?.[category];
  return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, Number.isInteger(selected?.[key]) ? selected![key] : value]));
}

/**
 * Freebies are inferred from creation values. The editor never asks players
 * to create purchase rows for ordinary attribute/ability/discipline/etc.
 * overflow; this function is the single server/UI calculation for that rule.
 */
export function automaticFreebieBreakdown(body: CharacterLike): AutomaticFreebieLine[] {
  const lines: AutomaticFreebieLine[] = [];
  const explicitRemaining: Record<string, number> = Object.fromEntries(Object.keys(freebieCosts).map((category) => [category, explicitFreebieDots(body, category as keyof typeof freebieCosts)]));
  const push = (category: keyof typeof freebieCosts, target: string, rawDots: number) => {
    const covered = Math.min(rawDots, explicitRemaining[category] ?? 0);
    explicitRemaining[category] = Math.max(0, (explicitRemaining[category] ?? 0) - covered);
    const line = automaticLine(category, target, rawDots, covered);
    if (line) lines.push(line);
  };
  const attributeLimits = groupLimits(body, "attributes");
  for (const [group, names] of Object.entries(attributeGroups) as Array<[keyof typeof attributeLimits, readonly string[]]>) {
    const result = groupOverflow(body.attributes, names, attributeLimits[group], (name) => attributeBase(body, name));
    push("attribute", `Attribute ${group === "physical" ? "körperlich" : group === "social" ? "sozial" : "mental"}`, result.rawOverflow);
  }
  const abilityLimits = groupLimits(body, "abilities");
  for (const [group, names] of Object.entries(abilityGroups) as Array<[keyof typeof abilityLimits, readonly string[]]>) {
    const result = groupOverflow(body.skills, names, abilityLimits[group], () => 0, 3);
    push("ability", `${group === "talents" ? "Talente" : group === "skills" ? "Fertigkeiten" : "Kenntnisse"}`, result.rawOverflow);
  }
  const disciplineRows = rows(body.disciplines);
  const clanDots = disciplineRows.filter((item) => item.source !== "foreign").reduce((total, item) => total + numericValue(item.value), 0);
  const foreignDots = disciplineRows.filter((item) => item.source === "foreign").reduce((total, item) => total + numericValue(item.value), 0);
  push("discipline", "Disziplinen", Math.max(0, clanDots - creationBudgets.disciplines) + foreignDots);
  const backgroundDots = rows(body.backgrounds).reduce((total, item) => total + numericValue(item.value), 0);
  push("background", "Hintergründe", Math.max(0, backgroundDots - creationBudgets.backgrounds));
  const virtues = body.virtues && typeof body.virtues === "object" && !Array.isArray(body.virtues) ? body.virtues as NumericMap : {};
  const virtueDots = ["Gewissen", "Selbstbeherrschung", "Mut"].reduce((total, name) => total + Math.max(0, numericValue(virtues[name], 1) - 1), 0);
  push("virtue", "Tugenden", Math.max(0, virtueDots - creationBudgets.virtues));
  return lines;
}

/**
 * Returns the live V20 creation budget state used by the editor and by draft
 * validation. Attribute values are measured above their base 1 dot; abilities
 * start at 0. This function deliberately has no UI dependencies.
 */
export function creationBudgetSummary(body: CharacterLike): CreationBudgetSummary {
  const virtues = body.virtues && typeof body.virtues === "object" && !Array.isArray(body.virtues) ? body.virtues as NumericMap : {};
  const freebieSpent = freebieTotal(body);
  const attributeLimits = groupLimits(body, "attributes");
  const abilityLimits = groupLimits(body, "abilities");
  const automatic = automaticFreebieBreakdown(body);
  const autoFor = (category: keyof typeof freebieCosts, target: string) => automatic.find((item) => item.category === category && item.target === target);
  const attributeLine = (group: keyof typeof attributeLimits, names: readonly string[]) => {
    const result = groupOverflow(body.attributes, names, attributeLimits[group], (name) => attributeBase(body, name));
    const auto = autoFor("attribute", `Attribute ${group === "physical" ? "körperlich" : group === "social" ? "sozial" : "mental"}`);
    return { spent: result.standardSpent, limit: attributeLimits[group], remaining: attributeLimits[group] - result.standardSpent, exceeded: result.rawOverflow > 0, freebieDots: auto?.dots ?? 0, freebieCost: auto?.total ?? 0 };
  };
  const abilityLine = (group: keyof typeof abilityLimits, names: readonly string[]) => {
    const result = groupOverflow(body.skills, names, abilityLimits[group], () => 0, 3);
    const auto = autoFor("ability", group === "talents" ? "Talente" : group === "skills" ? "Fertigkeiten" : "Kenntnisse");
    return { spent: result.standardSpent, limit: abilityLimits[group], remaining: abilityLimits[group] - result.standardSpent, exceeded: result.rawOverflow > 0, freebieDots: auto?.dots ?? 0, freebieCost: auto?.total ?? 0 };
  };
  const disciplineSpent = rows(body.disciplines).filter((item) => item.source !== "foreign").reduce((total, item) => total + numericValue(item.value), 0);
  const backgroundSpent = rows(body.backgrounds).reduce((total, item) => total + numericValue(item.value), 0);
  const virtueSpent = ["Gewissen", "Selbstbeherrschung", "Mut"].reduce((total, name) => total + Math.max(0, numericValue(virtues[name], 1) - 1), 0);
  return {
    attributes: {
      physical: attributeLine("physical", attributeGroups.physical),
      social: attributeLine("social", attributeGroups.social),
      mental: attributeLine("mental", attributeGroups.mental),
    },
    abilities: {
      talents: abilityLine("talents", abilityGroups.talents),
      skills: abilityLine("skills", abilityGroups.skills),
      knowledges: abilityLine("knowledges", abilityGroups.knowledges),
    },
    disciplines: { ...line(Math.min(creationBudgets.disciplines, disciplineSpent), creationBudgets.disciplines), freebieDots: automatic.filter((item) => item.category === "discipline").reduce((total, item) => total + item.dots, 0), freebieCost: automatic.filter((item) => item.category === "discipline").reduce((total, item) => total + item.total, 0) },
    backgrounds: { ...line(Math.min(creationBudgets.backgrounds, backgroundSpent), creationBudgets.backgrounds), freebieDots: automatic.filter((item) => item.category === "background").reduce((total, item) => total + item.dots, 0), freebieCost: automatic.filter((item) => item.category === "background").reduce((total, item) => total + item.total, 0) },
    virtues: { ...line(Math.min(creationBudgets.virtues, virtueSpent), creationBudgets.virtues), freebieDots: automatic.filter((item) => item.category === "virtue").reduce((total, item) => total + item.dots, 0), freebieCost: automatic.filter((item) => item.category === "virtue").reduce((total, item) => total + item.total, 0) },
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
  const explicit = purchases.reduce((total, purchase) => {
    const item = purchase as CharacterLike;
    const category = String(item.category) as keyof typeof freebieCosts;
    return total + (freebieCosts[category] ?? 0) * integer(item.points);
  }, 0);
  const merits = rows(body.merits).reduce((total, item) => total + (item.approved === false ? 0 : numericValue(item.cost)), 0);
  return explicit + merits + automaticFreebieBreakdown(body).reduce((total, item) => total + item.total, 0);
}

export function xpBalance(body: CharacterLike) {
  const ledger = Array.isArray(body.xpLedger) ? body.xpLedger : [];
  return ledger.reduce((total, row) => {
    const item = row as CharacterLike;
    return total + (item.kind === "grant" ? integer(item.amount) : -integer(item.amount));
  }, 0);
}

export function xpCost(purchase: XpPurchase) {
  if (!Number.isInteger(purchase.from) || purchase.from < 0 || !Number.isInteger(purchase.to) || purchase.to !== purchase.from + 1)
    return { ok: false as const, error: "XP-Steigerungen müssen genau eine Stufe umfassen." };
  const categoryCost = purchase.category === "attribute" ? purchase.from * 4
    : purchase.category === "ability" ? (purchase.from === 0 ? 3 : purchase.from * 2)
      : purchase.category === "discipline" ? purchase.from * (purchase.inClan ? 5 : 7)
        : purchase.category === "background" ? purchase.from * 3
          : purchase.category === "humanity" ? purchase.from * 2
            : purchase.category === "willpower" ? 1 : NaN;
  if (!Number.isFinite(categoryCost) || categoryCost <= 0) return { ok: false as const, error: "Dieses XP-Ziel benötigt eine gesonderte Regelentscheidung." };
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
  if (purchase.category === "ability" && v20AbilityNames.includes(target))
    return { ...body, skills: { ...(collection && typeof collection === "object" ? collection : {}), [target]: purchase.to } };
  if (collection && typeof collection === "object" && Object.prototype.hasOwnProperty.call(collection, target))
    return { ...body, [key]: { ...(collection as CharacterLike), [target]: purchase.to } };
  return null;
}

function currentValue(body: CharacterLike, purchase: XpPurchase) {
  if (purchase.category === "ability" && v20AbilityNames.includes(purchase.target || ""))
    return integer((body.skills as CharacterLike | undefined)?.[purchase.target || ""]);
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
  const allowIncompleteDraft = state === "draft";
  const clan = availableClanForCampaign(campaignId, body.clan);
  const purchases = Array.isArray(body.freebiePurchases) ? body.freebiePurchases : [];
  const invalidPurchase = purchases.some((purchase) => {
    if (!purchase || typeof purchase !== "object" || Array.isArray(purchase)) return true;
    const item = purchase as CharacterLike;
    const category = item.category as keyof typeof freebieCosts;
    return !Object.prototype.hasOwnProperty.call(freebieCosts, category) || !Number.isInteger(item.points) || Number(item.points) <= 0 || (["attribute", "ability", "discipline", "background", "virtue"].includes(String(category)) && (typeof item.target !== "string" || !item.target.trim()));
  });
  if (invalidPurchase) return { ok: false, error: "Jeder Freebie-Kauf benötigt eine gültige Kategorie, Punktzahl und ein konkretes Ziel." };
  const attributeValues = body.attributes && typeof body.attributes === "object" && !Array.isArray(body.attributes) ? body.attributes as NumericMap : {};
  const skillValues = body.skills && typeof body.skills === "object" && !Array.isArray(body.skills) ? body.skills as NumericMap : {};
  const knownAttributes = new Set<string>(Object.values(attributeGroups).flat());
  const knownAbilities = new Set<string>(Object.values(abilityGroups).flat());
  if (Object.keys(attributeValues).some(name => !knownAttributes.has(name)) || Object.keys(skillValues).some(name => !knownAbilities.has(name)))
    return { ok: false, error: "Für die reguläre Erschaffung sind nur die zentralen V20-Attribute und Fähigkeiten zulässig." };
  if ([...Object.values(attributeValues), ...Object.values(skillValues)].some(value => !Number.isInteger(value) || Number(value) < 0))
    return { ok: false, error: "Eigenschaftswerte müssen ganze, nicht negative Punkte sein." };
  if (body.virtues && typeof body.virtues === "object" && Object.values(body.virtues).some(value => !Number.isInteger(value) || Number(value) < 1 || Number(value) > 5))
    return { ok: false, error: "Tugenden beginnen mit einem Grundpunkt und liegen regulär zwischen 1 und 5." };
  if (rows(body.disciplines).some(item => !Number.isInteger(item.value) || Number(item.value) < 0 || Number(item.value) > 5) || rows(body.backgrounds).some(item => !Number.isInteger(item.value) || Number(item.value) < 0 || Number(item.value) > 5))
    return { ok: false, error: "Disziplinen und Hintergründe liegen regulär zwischen 0 und 5." };
  const belowBase = Object.entries(attributeGroups).flatMap(([, names]) => names).find((name) => Object.prototype.hasOwnProperty.call(attributeValues, name) && numericValue(attributeValues[name]) < attributeBase(body, name));
  if (belowBase) return { ok: false, error: `${belowBase} beginnt mit ${attributeBase(body, belowBase)} kostenlosem Grundpunkt.` };
  const overFive = [...Object.entries(attributeValues), ...Object.entries(skillValues)].find(([, value]) => integer(value) > 5);
  if (overFive) return { ok: false, error: `${overFive[0]} darf regulär höchstens 5 Punkte haben.` };
  if (String(body.clan ?? "").trim().toLocaleLowerCase() === "nosferatu" && numericValue(attributeValues.Erscheinungsbild) > appearanceExceptionMaximum(body))
    return { ok: false, error: "Nosferatu beginnen mit Erscheinungsbild 0. Eine höhere Stufe benötigt eine separat dokumentierte SL-Ausnahme." };
  const limitedForeign = rows(body.disciplines).find(item => {
    const grants = Array.isArray(body.ruleExceptions) ? body.ruleExceptions as CharacterLike[] : [];
    const grant = grants.find(g => g.category === "foreignDiscipline" && g.target === item.name);
    return grant && numericValue(item.value) > Number(grant.maximum);
  });
  if (limitedForeign) return { ok: false, error: "Die clansfremde Disziplin überschreitet die dokumentierte SL-Höchststufe." };
  const foreignWithoutApproval = rows(body.disciplines).find((item) => {
    const name = String(item.name ?? "").trim();
    return !!name && !!clan && !clan.disciplines.includes(name) && !(item.source === "foreign" && (item.slApproved === true || (allowIncompleteDraft && numericValue(item.value) === 0)));
  });
  if (foreignWithoutApproval) return { ok: false, error: `${String(foreignWithoutApproval.name)} benötigt eine dokumentierte SL-Ausnahme; die Freebie-Kosten werden danach automatisch berechnet.` };
  const allocations = (body.creationAllocations ?? {}) as CharacterLike;
  if (allocations.attributes && JSON.stringify(Object.values(allocations.attributes).sort((a, b) => Number(b) - Number(a))) !== JSON.stringify([...creationBudgets.attributes].sort((a, b) => b - a)))
    return { ok: false, error: "Attribute müssen nach 7/5/3 verteilt werden." };
  if (allocations.abilities && JSON.stringify(Object.values(allocations.abilities).sort((a, b) => Number(b) - Number(a))) !== JSON.stringify([...creationBudgets.abilities].sort((a, b) => b - a)))
    return { ok: false, error: "Fähigkeiten müssen nach 13/9/5 verteilt werden." };
  // XP advances never spend creation points again. The original creation body
  // is captured once by the SL confirmation command, never by a generic write.
  const creation = state === "confirmed" && body.creationSnapshot && typeof body.creationSnapshot === "object" ? body.creationSnapshot as CharacterLike : body;
  const spent = freebieTotal(creation);
  if (spent > freebieCapacity(creation)) return { ok: false, error: "Das freie Zusatzpunktebudget reicht nicht aus." };
  const xp = xpBalance(body);
  if (xp < 0) return { ok: false, error: "Das XP-Ledger darf nicht negativ werden." };
  if (allowIncompleteDraft)
    return { ok: true, state, freebieSpent: spent, freebieAvailable: freebieCapacity(body) - spent, xpAvailable: xp };
  if (!clan) return { ok: false, error: "Ein bestätigter Engine-Charakter benötigt einen freigegebenen Clan." };
  if (state === "confirmed" && (body.creationSnapshot || previous?.characterState === "confirmed")) return { ok: true, state, freebieSpent: spent, freebieAvailable: freebieCapacity(creation) - spent, xpAvailable: xp };
  if ([...rows(body.merits), ...rows(body.flaws)].some(item => item.approved === false))
    return { ok: false, error: "Klärt zunächst die SL-Kostenfreigabe für die eingetragenen Vorzüge und Schwächen." };
  const derived = derivedV20Values(body);
  if (body.humanity !== derived.humanity || body.willpower !== derived.willpower || derived.humanity > 10 || derived.willpower > 10)
    return { ok: false, error: "Menschlichkeit und Willenskraft müssen den abgeleiteten Ausgangswerten einschließlich ihrer Freebies entsprechen (maximal 10)." };
  const summary = creationBudgetSummary(body);
  if (Object.values(summary.attributes).some((line) => line.remaining > 0) || Object.values(summary.abilities).some((line) => line.remaining > 0))
    return { ok: false, error: "Verteile zuerst alle regulären Attribut- und Fähigkeitspunkte. Unvollständige Entwürfe können gespeichert werden." };
  const disciplineSpent = Math.min(creationBudgets.disciplines, rows(body.disciplines).filter((item) => item.source !== "foreign").reduce((total, item) => total + numericValue(item.value), 0));
  if (disciplineSpent !== creationBudgets.disciplines) return { ok: false, error: "Die anfänglichen Clan-Disziplinen benötigen drei Punkte." };
  const backgroundSpent = Math.min(creationBudgets.backgrounds, rows(body.backgrounds).reduce((total, item) => total + numericValue(item.value), 0));
  if (backgroundSpent !== creationBudgets.backgrounds) return { ok: false, error: "Die Hintergründe benötigen fünf Punkte." };
  const virtueSpent = body.virtues && typeof body.virtues === "object" && !Array.isArray(body.virtues)
    ? Math.min(creationBudgets.virtues, ["Gewissen", "Selbstbeherrschung", "Mut"].reduce((total, name) => total + Math.max(0, numericValue((body.virtues as NumericMap)[name], 1) - 1), 0))
    : 0;
  if (virtueSpent !== creationBudgets.virtues)
    return { ok: false, error: "Die Tugenden benötigen sieben zusätzliche Punkte." };
  return { ok: true, state, freebieSpent: spent, freebieAvailable: freebieCapacity(body) - spent, xpAvailable: xp };
}

export function applyXpPurchase(body: CharacterLike, purchase: XpPurchase, now = new Date().toISOString()): { ok: true; body: CharacterLike; cost: number } | { ok: false; error: string } {
  const maximum = ["humanity", "willpower"].includes(purchase.category) ? 10 : 5;
  if (purchase.to > maximum) return { ok: false, error: `Regulär sind höchstens ${maximum} Punkte erlaubt.` };
  if (purchase.category === "attribute" && purchase.target === "Erscheinungsbild" && String(body.clan).toLowerCase() === "nosferatu" && purchase.to > appearanceExceptionMaximum(body))
    return { ok: false, error: "Erscheinungsbild ist für Nosferatu gesperrt." };
  if (purchase.category === "discipline" && Array.isArray(body.ruleExceptions)) {
    const grant = (body.ruleExceptions as CharacterLike[]).find(g => g.category === "foreignDiscipline" && g.target === purchase.target);
    if (grant && purchase.to > Number(grant.maximum)) return { ok: false, error: "Diese Stufe überschreitet die genehmigte SL-Ausnahme." };
  }
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
