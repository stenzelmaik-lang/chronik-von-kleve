import assert from "node:assert/strict";
import { test } from "node:test";
import { applyXpPurchase, attributeBase, automaticFreebieBreakdown, creationBudgetSummary, creationBudgets, derivedV20Values, freebieCapacity, freebieCosts, freebieTotal, validateCharacterDraft, xpBalance, xpCost } from "../domain/character-engine.ts";

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

test("live creation summary reports V20 limits and converts an overfilled attribute group to Freebies", () => {
  const summary = creationBudgetSummary({ attributes: { Körperkraft: 5, Geschick: 4, Widerstandsfähigkeit: 1 }, skills: {} });
  assert.deepEqual(summary.attributes.physical, { spent: 7, limit: 7, remaining: 0, exceeded: false, freebieDots: 0, freebieCost: 0 });
  const tooMany = { ...base, attributes: { Körperkraft: 5, Geschick: 5, Widerstandsfähigkeit: 1 } };
  assert.equal(validateCharacterDraft(campaign, tooMany).ok, true);
  assert.equal(creationBudgetSummary(tooMany).attributes.physical.exceeded, true);
  assert.equal(freebieTotal(tooMany), 5);
});

test("an enrolled draft keeps incomplete choices saveable and charges an overfilled group automatically", () => {
  const draft = { engineVersion: 1, characterState: "draft", creationAllocations: base.creationAllocations, freebiePurchases: [], attributes: {}, skills: {}, virtues: {} };
  assert.equal(validateCharacterDraft(campaign, draft).ok, true);
  assert.equal(validateCharacterDraft(campaign, { ...draft, attributes: { Körperkraft: 5, Geschick: 5, Widerstandsfähigkeit: 1 } }).ok, true);
});

test("base dots stay separate from an explicit targeted attribute Freebie", () => {
  const over = { ...base, attributes: { Körperkraft: 5, Geschick: 5, Widerstandsfähigkeit: 1 } };
  assert.equal(creationBudgetSummary(over).attributes.physical.exceeded, true);
  const purchased = { ...over, freebiePurchases: [{ category: "attribute", target: "Körperkraft", points: 1 }] };
  assert.deepEqual(creationBudgetSummary(purchased).attributes.physical, { spent: 7, limit: 7, remaining: 0, exceeded: true, freebieDots: 0, freebieCost: 0 });
  assert.equal(validateCharacterDraft(campaign, purchased).ok, true);
});

test("regular ability values above three become automatic ability Freebies", () => {
  const high = { ...base, skills: { Diebstahl: 4 } };
  assert.equal(validateCharacterDraft(campaign, high).ok, true);
  assert.equal(freebieTotal(high), 2);
  const purchased = { ...high, freebiePurchases: [{ category: "ability", target: "Diebstahl", points: 1 }] };
  assert.equal(validateCharacterDraft(campaign, purchased).ok, true);
});

test("automatic Freebies are calculated per category after normal dots", () => {
  const body = { ...base, attributes: { Körperkraft: 5, Geschick: 5, Widerstandsfähigkeit: 1 }, skills: { Diebstahl: 4 } };
  assert.deepEqual(automaticFreebieBreakdown(body).map((item) => [item.category, item.dots, item.total]), [["attribute", 1, 5], ["ability", 1, 2]]);
});

test("Nosferatu appearance starts at zero and cannot be raised without a separate exception", () => {
  const body = { ...base, clan: "Nosferatu", attributes: { Erscheinungsbild: 0 } };
  assert.equal(attributeBase(body, "Erscheinungsbild"), 0);
  assert.equal(validateCharacterDraft(campaign, { ...body, attributes: { Erscheinungsbild: 1 } }).ok, false);
});

test("foreign disciplines require SL approval and a targeted discipline Freebie", () => {
  const foreign = { ...base, disciplines: [...base.disciplines, { name: "Potenz", value: 1, source: "foreign", slApproved: false }], freebiePurchases: [{ category: "discipline", target: "Potenz", points: 1 }] };
  assert.equal(validateCharacterDraft(campaign, foreign).ok, false);
  const approved = { ...foreign, freebiePurchases: [], disciplines: foreign.disciplines.map((row) => row.name === "Potenz" ? { ...row, slApproved: true } : row) };
  assert.equal(validateCharacterDraft(campaign, approved).ok, true);
  assert.equal(freebieTotal(approved), 7);
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

 test("character-bound Nosferatu exception preserves zero base and enforces approved maximum",()=>{
   const body={...structuredClone(base),characterState:'draft',clan:'Nosferatu',attributes:{Erscheinungsbild:3},disciplines:[{name:'Animalismus',value:0},{name:'Verdunkelung',value:0},{name:'Potenz',value:0}]};
   assert.equal(validateCharacterDraft(campaign,body).ok,false);
   const allowed={...body,ruleExceptions:[{category:'appearance',target:'Erscheinungsbild',maximum:3,decidedBy:'test-sl',reason:'Synthetic permission'}]};
   assert.equal(validateCharacterDraft(campaign,allowed).ok,true);
   assert.equal(attributeBase(allowed,'Erscheinungsbild'),0);
   assert.equal(validateCharacterDraft(campaign,{...allowed,attributes:{Erscheinungsbild:4}}).ok,false);
   assert.equal(validateCharacterDraft(campaign,{...allowed,ruleExceptions:[{category:'appearance',target:'Erscheinungsbild',maximum:3}]}).ok,false);
 });
 test("foreign discipline permission still spends seven Freebies per dot",()=>{
   const body={...structuredClone(base),characterState:'draft',disciplines:[...base.disciplines,{name:'Potenz',value:1,source:'foreign',slApproved:true}],ruleExceptions:[{category:'foreignDiscipline',target:'Potenz',maximum:1,decidedBy:'test-sl',reason:'Synthetic permission'}]};
   assert.equal(freebieTotal(body),7);
   assert.equal(validateCharacterDraft(campaign,body).ok,true);
   assert.equal(validateCharacterDraft(campaign,{...body,disciplines:body.disciplines.map(r=>r.name==='Potenz'?{...r,value:2}:r)}).ok,false);
 });


test('Explicit SL correction preserves XP, snapshot and temporary values',async()=>{
 const {applySlAdjustment}=await import('../domain/character-engine.ts');
 const body={clan:'Nosferatu',attributes:{Erscheinungsbild:0},xpLedger:[{amount:8,kind:'grant'}],creationSnapshot:{attributes:{Erscheinungsbild:0}},blood:{current:2},health:{current:1},willpowerTemporary:2};
 const edited=applySlAdjustment(body,{category:'attribute',target:'Erscheinungsbild',value:3},'synthetic-sl','Documented exception');
 assert.equal(edited.ok,true);assert.equal(edited.body.attributes.Erscheinungsbild,3);
 for(const key of ['xpLedger','creationSnapshot','blood','health','willpowerTemporary'])assert.deepEqual(edited.body[key],body[key]);
 assert.equal(edited.body.ruleExceptions[0].maximum,3);assert.equal(body.attributes.Erscheinungsbild,0);
});


test('SL correction updates a foreign permission and prevents impossible Willpower state',async()=>{
 const {applySlAdjustment}=await import('../domain/character-engine.ts');
 const body={disciplines:[{name:'Auspex',value:1,source:'foreign',slApproved:true}],ruleExceptions:[{category:'foreignDiscipline',target:'Auspex',maximum:2}],willpower:3,willpowerTemporary:2};
 const edit=applySlAdjustment(body,{category:'discipline',target:'Auspex',value:3},'synthetic-sl','Explicit correction');
 assert.equal(edit.ok,true);assert.equal(edit.body.ruleExceptions[0].maximum,3);
 assert.equal(applySlAdjustment(body,{category:'willpower',target:'Willenskraft',value:1},'synthetic-sl','Explicit correction').ok,false);
});
