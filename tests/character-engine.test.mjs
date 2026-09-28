import assert from "node:assert/strict";
import { test } from "node:test";
import { applyXpPurchase, creationBudgetSummary, creationBudgets, derivedV20Values, freebieCapacity, freebieCosts, freebieTotal, validateCharacterDraft, xpBalance, xpCost } from "../domain/character-engine.ts";

const campaign = "chronik-von-kleve";
const base = {
  engineVersion: 1,
  clan: "Tremere",
  disciplines: [{ name: "Auspex", value: 1 }, { name: "Beherrschung", value: 1 }, { name: "Thaumaturgie", value: 1 }],
  backgrounds: [{ name: "Kontakte", value: 5 }],
  virtues: { Gewissen: 4, Selbstbeherrschung: 3, Mut: 3 },
  creationAllocations: { attributes: { physical: 7, social: 5, mental: 3 }, abilities: { talents: 13, skills: 9, knowledges: 5 } },
  freebiePurchases: [],
  xpLedger: [{ id: "grant", kind: "grant", amount: 10, reason: "SL", createdAt: "2026-01-01" }],
};

test("B1a uses the approved creation budgets", () => {
  assert.deepEqual(creationBudgets.attributes, [7, 5, 3]);
  assert.deepEqual(creationBudgets.abilities, [13, 9, 5]);
  assert.equal(creationBudgets.disciplines, 3);
  assert.equal(creationBudgets.backgrounds, 5);
  assert.equal(creationBudgets.virtues, 7);
  assert.equal(creationBudgets.freebies, 15);
  assert.equal(creationBudgets.flawFreebiesMaximum, 7);
});

test("freebie prices and the optional flaw bonus are capped", () => {
  assert.deepEqual(freebieCosts, { attribute: 5, ability: 2, discipline: 7, background: 1, virtue: 2, humanity: 2, willpower: 1 });
  const body = { ...base, flaws: [{ name: "Schwäche", cost: 10 }], freebiePurchases: [{ category: "attribute", target: "Geschick", points: 1 }, { category: "ability", target: "Diebstahl", points: 1 }] };
  assert.equal(freebieCapacity(body), 22);
  assert.equal(freebieTotal(body), 7);
  assert.equal(validateCharacterDraft(campaign, body).freebieAvailable, 15);
  assert.equal(freebieCapacity({ ...body, flaws: [{ name: "Noch nicht bestätigt", cost: 7, approved: false }] }), 15);
});

test("draft validation rejects invalid creation budgets and overdrawn freebies", () => {
  assert.equal(validateCharacterDraft(campaign, { ...base, creationAllocations: { attributes: { physical: 6, social: 5, mental: 3 }, abilities: { talents: 13, skills: 9, knowledges: 5 } } }).ok, false);
  assert.equal(validateCharacterDraft(campaign, { ...base, freebiePurchases: [{ category: "discipline", points: 3 }] }).ok, false);
});

test("live creation summary reports V20 limits and rejects an overfilled attribute group", () => {
  const summary = creationBudgetSummary({ attributes: { Körperkraft: 5, Geschick: 4, Widerstandsfähigkeit: 1 }, skills: {} });
  assert.deepEqual(summary.attributes.physical, { spent: 7, limit: 7, remaining: 0, exceeded: false });
  const tooMany = { ...base, attributes: { Körperkraft: 5, Geschick: 5, Widerstandsfähigkeit: 1 } };
  assert.equal(validateCharacterDraft(campaign, tooMany).ok, false);
  assert.equal(creationBudgetSummary(tooMany).attributes.physical.exceeded, true);
});

test("an enrolled draft keeps incomplete choices saveable but rejects an overfilled group", () => {
  const draft = { engineVersion: 1, characterState: "draft", creationAllocations: base.creationAllocations, freebiePurchases: [], attributes: {}, skills: {}, virtues: {} };
  assert.equal(validateCharacterDraft(campaign, draft).ok, true);
  assert.equal(validateCharacterDraft(campaign, { ...draft, attributes: { Körperkraft: 5, Geschick: 5, Widerstandsfähigkeit: 1 } }).ok, false);
});

test("base dots stay separate from an explicit targeted attribute Freebie", () => {
  const over = { ...base, attributes: { Körperkraft: 5, Geschick: 5, Widerstandsfähigkeit: 1 } };
  assert.equal(creationBudgetSummary(over).attributes.physical.exceeded, true);
  const purchased = { ...over, freebiePurchases: [{ category: "attribute", target: "Körperkraft", points: 1 }] };
  assert.deepEqual(creationBudgetSummary(purchased).attributes.physical, { spent: 7, limit: 7, remaining: 0, exceeded: false });
  assert.equal(validateCharacterDraft(campaign, purchased).ok, true);
});

test("regular ability values above three require a targeted ability Freebie", () => {
  const high = { ...base, skills: { Diebstahl: 4 } };
  assert.equal(validateCharacterDraft(campaign, high).ok, false);
  const purchased = { ...high, freebiePurchases: [{ category: "ability", target: "Diebstahl", points: 1 }] };
  assert.equal(validateCharacterDraft(campaign, purchased).ok, true);
});

test("foreign disciplines require SL approval and a targeted discipline Freebie", () => {
  const foreign = { ...base, disciplines: [...base.disciplines, { name: "Potenz", value: 1, source: "foreign", slApproved: false }], freebiePurchases: [{ category: "discipline", target: "Potenz", points: 1 }] };
  assert.equal(validateCharacterDraft(campaign, foreign).ok, false);
  assert.equal(validateCharacterDraft(campaign, { ...foreign, disciplines: foreign.disciplines.map((row) => row.name === "Potenz" ? { ...row, slApproved: true } : row) }).ok, true);
});

test("derived humanity and willpower use free virtue dots only as base values", () => {
  const body = { virtues: { Gewissen: 3, Selbstbeherrschung: 2, Mut: 4 }, freebiePurchases: [{ category: "virtue", target: "Mut", points: 1 }, { category: "humanity", points: 1 }, { category: "willpower", points: 1 }] };
  assert.deepEqual(derivedV20Values(body), { humanity: 6, willpower: 4 });
});

test("review and confirmed states lock permanent changes but leave runtime values out of the lock", () => {
  const confirmed = { ...base, characterState: "confirmed", blood: 10, health: { current: "gesund" }, willpowerTemporary: 3 };
  assert.equal(validateCharacterDraft(campaign, { ...confirmed, blood: 8, health: { current: "verletzt" }, willpowerTemporary: 2 }, confirmed).ok, true);
  assert.equal(validateCharacterDraft(campaign, { ...confirmed, concept: "geändert" }, confirmed).ok, false);
  assert.equal(validateCharacterDraft(campaign, { ...confirmed, characterState: "draft" }, confirmed).ok, false);
  assert.equal(validateCharacterDraft(campaign, { clan: "Tremere", characterState: "confirmed" }).ok, false);
});

test("XP cost, ledger and value change are atomic at the pure-engine boundary", () => {
  assert.deepEqual(xpCost({ category: "attribute", from: 2, to: 3 }), { ok: true, cost: 8 });
  assert.deepEqual(xpCost({ category: "ability", from: 0, to: 1 }), { ok: true, cost: 3 });
  assert.deepEqual(xpCost({ category: "discipline", from: 1, to: 2, inClan: true }), { ok: true, cost: 5 });
  const body = { ...base, characterState: "confirmed", attributes: { Geschick: 2 }, xpLedger: [{ id: "grant", kind: "grant", amount: 10, reason: "SL", createdAt: "2026-01-01" }] };
  const result = applyXpPurchase(body, { category: "attribute", target: "Geschick", from: 2, to: 3 });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.body.attributes.Geschick, 3);
    assert.equal(xpBalance(result.body), 2);
  }
  assert.equal(applyXpPurchase(body, { category: "attribute", target: "Geschick", from: 4, to: 5 }).ok, false);
});
