import assert from "node:assert/strict";
import { test } from "node:test";
import { applyXpPurchase, creationBudgets, freebieCapacity, freebieCosts, freebieTotal, validateCharacterDraft, xpBalance, xpCost } from "../domain/character-engine.ts";

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
  const body = { ...base, flaws: [{ name: "Schwäche", cost: 10 }], freebiePurchases: [{ category: "attribute", points: 1 }, { category: "ability", points: 1 }] };
  assert.equal(freebieCapacity(body), 22);
  assert.equal(freebieTotal(body), 7);
  assert.equal(validateCharacterDraft(campaign, body).freebieAvailable, 15);
  assert.equal(freebieCapacity({ ...body, flaws: [{ name: "Noch nicht bestätigt", cost: 7, approved: false }] }), 15);
});

test("draft validation rejects invalid creation budgets and overdrawn freebies", () => {
  assert.equal(validateCharacterDraft(campaign, { ...base, creationAllocations: { attributes: { physical: 6, social: 5, mental: 3 }, abilities: { talents: 13, skills: 9, knowledges: 5 } } }).ok, false);
  assert.equal(validateCharacterDraft(campaign, { ...base, freebiePurchases: [{ category: "discipline", points: 3 }] }).ok, false);
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
