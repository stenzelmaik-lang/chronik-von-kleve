import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveC1OrdinaryCheck } from '../domain/w10-c1-ordinary.ts';
import { engineFixture } from './fixtures/engine-character.mjs';

const selection = { attributeId: 'dexterity', abilityId: 'firearms' };
const declared = { baseDifficulty: 6 };
const context = (faces, extra = {}) => ({ rollId: 'synthetic-c1', characterVersion: 9, faces, ...extra });
const check = (body, selected, difficulty, input) => resolveC1OrdinaryCheck(body, selected, difficulty, input);
const rejects = (fn, code) => assert.throws(fn, error => error.code === code);

test('C1: authoritative sheet pool resolves a V20 success without hybrid dice or resource change', () => {
  const sheet = structuredClone(engineFixture);
  const before = structuredClone(sheet);
  const resolved = check(sheet, selection, declared, context([6, 7, 2, 3, 4, 5]));
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.preview.pool.base, 6);
  assert.equal(resolved.result.evaluation.totalSuccesses, 2);
  assert.deepEqual(resolved.result.dice.map(die => die.type), Array(6).fill('NORMAL'));
  assert.deepEqual(resolved.result.flags, []);
  assert.deepEqual(resolved.result.proposedEffects, []);
  assert.deepEqual(sheet, before);
});

test('C1: stored specialty doubles each ten using V20 success arithmetic', () => {
  const sheet = { ...engineFixture, skills: { ...engineFixture.skills, Schusswaffen: 4 },
    specialties: [{ id: 'spec_00000000-aaaa', name: 'Pistolen', target: { kind: 'ability', id: 'firearms' }, active: true }] };
  const resolved = check(sheet, { ...selection, specialtyId: 'spec_00000000-aaaa' }, declared, context([10, 10, 1, 2, 3, 4, 5]));
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.preview.specialtyApplies, true);
  assert.equal(resolved.result.evaluation.rawSuccesses, 4);
  assert.equal(resolved.result.evaluation.totalSuccesses, 3);
  assert.deepEqual(resolved.result.flags, []);
});

test('C1: ordinary wound penalty is applied once before the roll', () => {
  const sheet = { ...engineFixture, health: { track: ['bashing', 'lethal', 'bashing', 'lethal'] } };
  const resolved = check(sheet, selection, declared, context([6, 2, 3, 4]));
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.preview.pool.base, 4);
  assert.equal(resolved.preview.provenance.find(p => p.part === 'wounds').amount, -2);
  assert.equal(resolved.result.evaluation.totalSuccesses, 1);
});

test('C1: untrained skill difficulty and threshold are retained through resolution', () => {
  const resolved = check(engineFixture, { attributeId: 'dexterity', abilityId: 'melee' }, { baseDifficulty: 6, requiredSuccesses: 2 }, context([7, 6, 1]));
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.result.difficulty.effective, 7);
  assert.equal(resolved.result.evaluation.totalSuccesses, 0);
  assert.equal(resolved.result.evaluation.outcome, 'failure');
  assert.equal(check(engineFixture, { attributeId: 'dexterity', abilityId: 'melee' },
    { baseDifficulty: 10 }, context([])).code, 'DIFFICULTY_ABOVE_10');
});

test('C1: botch, zero dice and untrained knowledge remain distinct', () => {
  assert.equal(check(engineFixture, selection, declared, context([1, 2, 3, 4, 5, 6])).result.evaluation.outcome, 'failure');
  assert.equal(check(engineFixture, selection, declared, context([1, 2, 3, 4, 5, 2])).result.evaluation.outcome, 'botch');
  assert.equal(check(engineFixture, { attributeId: 'intelligence', abilityId: 'medicine' }, declared, context([])).code, 'UNTRAINED_KNOWLEDGE');
  assert.equal(check({ ...engineFixture, health: { current: 'Verkrüppelt' } }, { attributeId: 'perception' }, declared, context([])).code, 'NO_DICE');
});

test('C1: willpower is evaluated before the roll but never booked', () => {
  const sheet = structuredClone(engineFixture);
  const before = structuredClone(sheet);
  const willpower = { requested: true, allowed: true, spentThisRound: false, timing: 'before', mode: 'guaranteed_success' };
  const resolved = check(sheet, selection, declared, context([1, 2, 3, 4, 5, 2], { willpower }));
  assert.equal(resolved.result.evaluation.outcome, 'success');
  assert.equal(resolved.result.evaluation.guaranteedSuccesses, 1);
  assert.deepEqual(resolved.result.proposedEffects, [{ type: 'WILLPOWER_DELTA', amount: -1, when: 'on_attempt' }]);
  assert.deepEqual(resolved.costIntentions, resolved.result.proposedEffects);
  assert.deepEqual(sheet, before);
  rejects(() => check(sheet, selection, declared, context([2, 2, 2, 2, 2, 2], { willpower: { ...willpower, timing: 'after' } })), 'WILLPOWER_TOO_LATE');
  rejects(() => check(sheet, selection, declared, context([2, 2, 2, 2, 2, 2], { willpower: { ...willpower, spentThisRound: true } })), 'WILLPOWER_ALREADY_SPENT');
  rejects(() => check({ ...sheet, willpowerTemporary: 0 }, selection, declared, context([2, 2, 2, 2, 2, 2], { willpower })), 'WILLPOWER_EMPTY');
  rejects(() => check(sheet, selection, declared, context([], { willpower: { ...willpower, mode: 'unknown' } })), 'INVALID_WILLPOWER_MODE');
});

test('C1: one-round wound relief needs a valid prior willpower declaration and only proposes cost', () => {
  const sheet = { ...engineFixture, health: { current: 'Verkrüppelt' } };
  const before = structuredClone(sheet);
  const willpower = { requested: true, allowed: true, spentThisRound: false, timing: 'before', mode: 'ignore_wounds' };
  assert.equal(check(sheet, { attributeId: 'strength' }, declared, context([])).code, 'NO_DICE');
  const resolved = check(sheet, selection, declared, context([6, 2, 3, 4, 5, 2], { willpower }));
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.preview.pool.base, 6);
  assert.equal(resolved.preview.provenance.find(p => p.part === 'wounds').amount, 0);
  assert.equal(resolved.result.evaluation.guaranteedSuccesses, 0);
  assert.deepEqual(resolved.costIntentions, [{ type: 'WILLPOWER_DELTA', amount: -1, when: 'on_attempt' }]);
  assert.deepEqual(sheet, before);
  rejects(() => check(sheet, selection, declared, context([], { willpower: { ...willpower, allowed: false } })), 'WILLPOWER_NOT_ALLOWED');
  rejects(() => check(sheet, selection, declared, context([], { willpower: { ...willpower, timing: 'after' } })), 'WILLPOWER_TOO_LATE');
  rejects(() => check(sheet, selection, declared, context([], { willpower: { ...willpower, spentThisRound: true } })), 'WILLPOWER_ALREADY_SPENT');
  assert.equal(check({ ...sheet, health: { current: 'Außer Gefecht' } }, selection, declared,
    context([], { willpower })).code, 'INCAPACITATED');
});

test('C1: automatic success requires explicit authorization and never rolls', () => {
  const auto = { requested: true, allowed: true, withoutTension: true };
  const resolved = check(engineFixture, selection, declared, context([], { automatic: auto }));
  assert.equal(resolved.result.resolution, 'automatic');
  assert.equal(resolved.result.evaluation.totalSuccesses, 1);
  rejects(() => check(engineFixture, selection, declared, context([], { automatic: { ...auto, allowed: false } })), 'AUTOMATIC_SUCCESS_NOT_ALLOWED');
  rejects(() => check(engineFixture, selection, declared, context([6, 2, 3], { automatic: auto })), 'FACE_COUNT_MISMATCH');
});
