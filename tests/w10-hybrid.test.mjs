import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateV20 } from '../domain/w10-core.ts';
import { evaluateNormalV20 } from '../domain/w10.ts';
import { HYBRID_DRAFT_PROFILE, DRAFT_SAMPLE_LIMIT, prepareDraftRoll, resolveDraftRoll, sampleDraftRoll,
  changeStressUnits, resolveDraftRouse, sampleDraftRouse } from '../domain/w10-hybrid-draft.ts';

const request = (patch = {}) => ({ rollId: 'local-test-1', characterVersion: 7,
  kind: 'ordinary', pool: 2, difficulty: 6, ...patch });
const hybrid = (patch = {}) => ({ hunger: 0, stressUnits: 0, stressEligible: true, pressure: false, nontrivial: true, ...patch });
const wp = (patch = {}) => ({ requested: true, allowed: true, temporary: 3, spentThisRound: false, timing: 'before', ...patch });
const rejects = (fn, code) => assert.throws(fn, error => error.code === code);

for (const [id, faces, specialty, guaranteed, outcome, successes] of [
  ['D01', [1, 7], false, 0, 'failure', 0], ['D02', [1, 1, 5], false, 0, 'botch', 0],
  ['D03', [1, 1, 7], false, 0, 'failure', 0], ['D04', [4, 5], false, 0, 'failure', 0],
  ['D05', [6, 10], false, 0, 'success', 2], ['D06', [6, 10], true, 0, 'success', 3],
  ['D07', [10, 1], true, 0, 'success', 1], ['D08', [10, 1], false, 0, 'failure', 0],
  ['D09', [1, 3], false, 1, 'success', 1],
]) test(`${id}: deterministic V20 reference vector`, () => {
  const result = resolveDraftRoll(request({ pool: faces.length, specialtyApplies: specialty,
    ...(guaranteed ? { willpower: wp() } : {}) }), faces);
  assert.equal(result.evaluation.outcome, outcome);
  assert.equal(result.evaluation.totalSuccesses, successes);
  assert.deepEqual(result.dice.map(d => d.face), faces);
});

test('D10/D11: empty pool and invalid base difficulties fail before RNG, caps require explicit policy', () => {
  let draws = 0; const source = () => { draws++; };
  rejects(() => sampleDraftRoll(request({ pool: 0 }), source), 'EMPTY_OR_INVALID_POOL');
  for (const difficulty of [1, 11, NaN, Infinity, 6.5]) rejects(() => sampleDraftRoll(request({ difficulty }), source), 'INVALID_DIFFICULTY');
  const r = request({ difficulty: 10, training: { category: 'skill', rating: 0 } });
  rejects(() => sampleDraftRoll(r, source), 'DIFFICULTY_OVERFLOW_REQUIRES_POLICY');
  const plan = prepareDraftRoll({ ...r, difficultyOverflow: 'cap_at_10' });
  assert.deepEqual(plan.difficulty, { base: 10, effective: 10, uncapped: 11, capped: true,
    modifiers: [{ source: 'untrained_skill', amount: 1 }] });
  assert.equal(draws, 0);
});
test('D12/D13: training categories retain their distinct rules', () => {
  rejects(() => prepareDraftRoll(request({ training: { category: 'knowledge', rating: 0 } })), 'UNTRAINED_KNOWLEDGE');
  for (const [category, expected] of [['talent', 6], ['skill', 7], ['knowledge', 6]]) {
    assert.equal(prepareDraftRoll(request({ training: { category, rating: 0, knowledgeException: true } })).difficulty.effective, expected);
  }
  assert.equal(prepareDraftRoll(request({ training: { category: 'skill', rating: 1 } })).difficulty.effective, 6);
});
for (const [id, kind, faces] of [['D14', 'damage', [1, 2, 3]], ['D15', 'soak', [1, 4, 5]]]) {
  test(`${id}: ${kind} never botches or acquires special dice/stress; ones still cancel successes`, () => {
    for (const values of [faces, [1, 6], [1, 6, 7]]) {
      const r = resolveDraftRoll(request({ kind, pool: values.length, hybrid: hybrid({ hunger: 5, stressUnits: 300, pressure: true }) }), values);
      assert.notEqual(r.evaluation.outcome, 'botch');
      assert.equal(r.evaluation.rawBotch, false);
      assert.equal(r.evaluation.totalSuccesses, values.filter(v => v >= 6).length ? values.filter(v => v >= 6).length - 1 : 0);
      assert.equal(r.difficulty.effective, 6);
      assert.ok(r.dice.every(d => d.type === 'NORMAL'));
      assert.deepEqual(r.flags, []); assert.deepEqual(r.proposedEffects, []);
    }
  });
}
test('D16: approved local automatic success draws no dice and proposes no costs/stress', () => {
  const r = request({ pool: 6, automatic: { requested: true, allowed: true, withoutTension: true },
    hybrid: hybrid({ hunger: 5, stressUnits: 300, nontrivial: false }) });
  const result = sampleDraftRoll(r, () => { assert.fail('must not draw'); });
  assert.equal(result.resolution, 'automatic'); assert.deepEqual(result.dice, []);
  assert.equal(result.pool.base, 6); assert.equal(result.pool.effective, 0);
  assert.equal(result.evaluation.totalSuccesses, 1); assert.deepEqual(result.proposedEffects, []);
  for (const patch of [{ pool: 5 }, { requiredSuccesses: 2 }, { willpower: wp() }, { kind: 'damage' },
    { automatic: { requested: true, allowed: false, withoutTension: true } },
    { automatic: { requested: true, allowed: true, withoutTension: false } },
    { hybrid: hybrid({ pressure: true }) }]) {
    rejects(() => prepareDraftRoll({ ...r, ...patch }), 'AUTOMATIC_SUCCESS_NOT_ALLOWED');
  }
});

test('H01/H02: hunger replaces first; stress only replaces a remaining normal die', () => {
  const h = hybrid({ hunger: 2, stressUnits: 200 });
  assert.deepEqual(prepareDraftRoll(request({ pool: 6, hybrid: h })).pool,
    { base: 6, effective: 6, hungerDice: 2, stressDice: 1, normalDice: 3 });
  assert.deepEqual(prepareDraftRoll(request({ pool: 3, hybrid: { ...h, hunger: 3 } })).pool,
    { base: 3, effective: 3, hungerDice: 3, stressDice: 0, normalDice: 0 });
});
test('H03/H04/H05: hunger flags use final outcome and actual tens, never specialty success units', () => {
  const r = request({ pool: 5, hybrid: hybrid({ hunger: 1 }) });
  const fail = resolveDraftRoll(r, [1, 7, 2, 3, 4]);
  assert.deepEqual(fail.flags, ['BESTIAL_FAILURE']); assert.equal(fail.evaluation.outcome, 'failure');
  const success = resolveDraftRoll(r, [10, 10, 2, 3, 4]);
  assert.deepEqual(success.flags, ['BEAST_TAINTED_SUCCESS']); assert.equal(success.evaluation.totalSuccesses, 2);
  assert.deepEqual(resolveDraftRoll({ ...r, specialtyApplies: true }, [10, 2, 3, 4, 5]).flags, []);
  assert.deepEqual(resolveDraftRoll({ ...r, willpower: wp() }, [1, 2, 3, 4, 5]).flags, []);
});
test('H06/H07/H08/H09: separate Rouse check; delayed effect proposal and no voluntary draw at hunger 5', () => {
  const r = { rollId: 'rouse', hunger: 3, voluntary: true };
  const failed = resolveDraftRouse(r, 5);
  assert.equal(failed.hungerAfter, 4); assert.equal(failed.checkPassed, false);
  assert.deepEqual(failed.proposedEffects, [{ type: 'HUNGER_DELTA', amount: 1, when: 'after_action_resolution' }]);
  assert.equal(r.hunger, 3); // No mutation or transaction is implied by this pure preview.
  assert.equal(resolveDraftRouse(r, 6).hungerAfter, 3);
  assert.deepEqual(resolveDraftRouse(r, 6).proposedEffects, []);
  rejects(() => sampleDraftRouse({ ...r, hunger: 5 }, () => assert.fail('no RNG')), 'VOLUNTARY_ROUSE_AT_MAX_HUNGER');
  assert.equal(resolveDraftRouse({ ...r, hunger: 4 }, 1).hungerAfter, 5);
  rejects(() => sampleDraftRouse({ ...r, voluntary: false }, () => assert.fail('no RNG')), 'FORCED_ROUSE_REQUIRES_RULE');
});
for (const [id, before, delta, after, points, progress] of [
  ['S01', 95, 30, 125, 1, 25], ['S02', 235, -100, 135, 1, 35],
  ['S03', 299, 45, 300, 3, 0], ['S04', 0, -100, 0, 0, 0],
]) test(`${id}: integer stress units clamp without floating point drift`, () => {
  assert.deepEqual(changeStressUnits(before, delta), { before, after, requestedDelta: delta,
    appliedDelta: after - before, points, progress });
});
test('S05/S06/S07: exclusive stress priority, no ordinary failure or success penalty', () => {
  const r = request({ pool: 3, hybrid: hybrid({ hunger: 1, stressUnits: 200 }) });
  for (const [faces, outcome, flags, delta] of [
    [[1, 1, 2], 'botch', ['BESTIAL_FAILURE'], 45],
    [[1, 1, 7], 'failure', ['BESTIAL_FAILURE'], 35],
    [[2, 1, 3], 'botch', [], 30],
    [[2, 1, 7], 'failure', ['STRESS_REACTION'], 15],
    [[2, 3, 4], 'failure', [], 0], [[6, 6, 1], 'success', [], 0],
  ]) {
    const result = resolveDraftRoll(r, faces);
    assert.equal(result.evaluation.outcome, outcome); assert.deepEqual(result.flags, flags);
    assert.equal(result.stress.requestedDelta, delta);
    assert.equal(result.proposedEffects.length, delta ? 1 : 0);
    assert.ok(result.proposedEffects.every(e => e.type === 'PERSONAL_STRESS_DELTA'));
  }
  const capped = resolveDraftRoll({ ...r, hybrid: hybrid({ hunger: 1, stressUnits: 299 }) }, [1, 1, 2]);
  assert.equal(capped.proposedEffects[0].amount, 45); assert.equal(capped.proposedEffects[0].appliedDelta, 1);
});
test('S08: routine, test and ineligible rolls cannot propose personal stress', () => {
  for (const patch of [{ kind: 'test' }, { hybrid: hybrid({ stressEligible: false }) }, { hybrid: hybrid({ nontrivial: false }) }]) {
    const result = resolveDraftRoll(request({ pool: 2, hybrid: hybrid({ hunger: 1, stressUnits: 200 }), ...patch }), [1, 1]);
    assert.equal(result.stress.requestedDelta, 0);
    assert.ok(result.dice.every(d => d.type !== 'STRESS'));
  }
});
test('stress difficulty changes only in an eligible context; caps remain visible', () => {
  for (const [units, pressure, expected] of [[99, true, 6], [100, true, 7], [100, false, 6], [200, false, 6], [300, false, 7]]) {
    assert.equal(prepareDraftRoll(request({ hybrid: hybrid({ stressUnits: units, pressure }) })).difficulty.effective, expected);
  }
  const combined = prepareDraftRoll(request({ training: { category: 'skill', rating: 0 }, hybrid: hybrid({ stressUnits: 100, pressure: true }) }));
  assert.equal(combined.difficulty.effective, 8); assert.equal(combined.difficulty.modifiers.length, 2);
});

test('W01/W02/W03/W04: invalid or cancelled preflight never samples or returns resource effects', () => {
  const errors = [
    [{ willpower: wp({ timing: 'after' }) }, 'WILLPOWER_TOO_LATE'],
    [{ willpower: wp({ temporary: 0 }) }, 'WILLPOWER_EMPTY'],
    [{ willpower: wp({ spentThisRound: true }) }, 'WILLPOWER_ALREADY_SPENT'],
    [{ willpower: wp({ allowed: false }) }, 'WILLPOWER_NOT_ALLOWED'],
    [{ kind: 'damage', willpower: wp() }, 'WILLPOWER_NOT_ALLOWED'],
    [{ cancelledBeforeRoll: true, willpower: wp() }, 'CANCELLED_BEFORE_ROLL'],
  ];
  for (const [patch, code] of errors) {
    const r = request(patch), before = structuredClone(r);
    rejects(() => sampleDraftRoll(r, () => assert.fail('must not draw')), code);
    assert.deepEqual(r, before);
  }
});
test('guaranteed success survives any ones but can still miss a multi-success requirement', () => {
  const r = resolveDraftRoll(request({ requiredSuccesses: 2, willpower: wp() }), [1, 1]);
  assert.equal(r.evaluation.outcome, 'failure'); assert.equal(r.evaluation.totalSuccesses, 1);
  assert.equal(r.evaluation.rawBotch, true);
  assert.deepEqual(r.proposedEffects, [{ type: 'WILLPOWER_DELTA', amount: -1, when: 'on_attempt' }]);
});
test('draft snapshots preserve source request, typed die IDs, profile and immutable nested evidence', () => {
  const r = request({ pool: 3, hybrid: hybrid({ hunger: 1, stressUnits: 200 }), training: { category: 'skill', rating: 0 } });
  const faces = [1, 7, 8], result = resolveDraftRoll(r, faces);
  const same = resolveDraftRoll(structuredClone(r), [...faces]);
  assert.deepEqual(result, same);
  r.hybrid.hunger = 5; r.training.rating = 3; faces[0] = 10;
  assert.equal(result.request.hybrid.hunger, 1); assert.equal(result.request.training.rating, 0);
  assert.deepEqual(result.dice, [{ id: 'local-test-1:d1', type: 'HUNGER', face: 1 },
    { id: 'local-test-1:d2', type: 'STRESS', face: 7 }, { id: 'local-test-1:d3', type: 'NORMAL', face: 8 }]);
  assert.equal(result.profile.status, 'draft'); assert.equal(HYBRID_DRAFT_PROFILE.productionEnabled, false);
  for (const o of [result, result.request, result.request.hybrid, result.dice, result.dice[0], result.pool,
    result.difficulty, result.difficulty.modifiers, result.evaluation, result.flags, result.stress, result.proposedEffects]) assert.ok(Object.isFrozen(o));
});
test('RNG adapter reuses rejection sampling and freezes preflight before callbacks; no 10/30 die rule cap', () => {
  const r = request({ pool: 65, hybrid: hybrid() });
  let calls = 0;
  const result = sampleDraftRoll(r, word => { r.pool = 1; r.hybrid.hunger = 5; word[0] = calls++ === 0 ? 4294967295 : 0; });
  assert.equal(calls, 66); assert.equal(result.dice.length, 65);
  assert.ok(result.dice.every(d => d.face === 1 && d.type === 'NORMAL'));
  assert.equal(result.evaluation.outcome, 'botch');
  assert.throws(() => sampleDraftRoll(request(), () => { throw Error('source broken'); }), /source broken/);
  rejects(() => sampleDraftRoll(request({ pool: DRAFT_SAMPLE_LIMIT + 1 }), () => assert.fail('no RNG')), 'DRAFT_SAMPLE_LIMIT_EXCEEDED');
  assert.equal(evaluateV20(Array(1001).fill(6), { difficulty: 6 }).totalSuccesses, 1001);
});
test('invalid faces, sparse arrays, unsupported types and malformed numeric rules fail closed', () => {
  for (const faces of [[0, 6], [11, 6], [6.1, 6], [NaN, 6], [Infinity, 6], new Array(2)]) assert.throws(() => resolveDraftRoll(request(), faces));
  rejects(() => resolveDraftRoll(request(), [6]), 'FACE_COUNT_MISMATCH');
  for (const options of [{ difficulty: 1 }, { difficulty: 11 }, { difficulty: 6, specialtyApplies: 'true' },
    { difficulty: 6, guaranteedSuccesses: -1 }, { difficulty: 6, requiredSuccesses: 0 }, { difficulty: 6, botchPolicy: 'unknown' }]) assert.throws(() => evaluateV20([6], options));
  for (const patch of [{ kind: 'initiative' }, { kind: 'unapproved_discipline' }, { pool: NaN }, { pool: -1 },
    { hybrid: hybrid({ hunger: 6 }) }, { hybrid: hybrid({ stressUnits: 301 }) }, { hybrid: hybrid({ stressUnits: 1.5 }) },
    { hybrid: hybrid({ stressEligible: 'true' }) }, { requiredSuccesses: -1 }, { rollId: '' }, { characterVersion: -1 }]) assert.throws(() => prepareDraftRoll(request(patch)));
});
test('exhaustive 3-die/9-difficulty reference comparison preserves legacy semantics and specialty invariants', () => {
  for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) for (let c = 1; c <= 10; c++) for (let target = 2; target <= 10; target++) {
    const faces = [a, b, c], raw = faces.filter(v => v >= target).length, ones = faces.filter(v => v === 1).length;
    const expected = Math.max(0, raw - ones);
    const outcome = expected > 0 ? 'success' : raw === 0 && ones > 0 ? 'botch' : 'failure';
    const legacy = evaluateNormalV20(faces, target);
    assert.equal(legacy.netSuccesses, expected); assert.equal(legacy.outcome, outcome);
    for (const specialtyApplies of [false, true]) {
      const result = evaluateV20(faces, { difficulty: target, specialtyApplies });
      const weighted = faces.reduce((sum, v) => sum + (v >= target ? v === 10 && specialtyApplies ? 2 : 1 : 0), 0);
      assert.equal(result.rawSuccessDice, raw); assert.equal(result.rawSuccesses, weighted);
      assert.equal(result.netRolledSuccesses, Math.max(0, weighted - ones));
      assert.ok(result.netRolledSuccesses <= result.rawSuccesses);
      if (raw > 0) assert.equal(result.rawBotch, false);
      assert.notEqual(evaluateV20(faces, { difficulty: target, specialtyApplies, botchPolicy: 'never' }).outcome, 'botch');
    }
  }
});
test('all draft die plans preserve pool size and V20 math regardless of die color', () => {
  for (let pool = 1; pool <= 40; pool++) for (let hunger = 0; hunger <= 5; hunger++) for (const stressUnits of [0, 99, 100, 199, 200, 299, 300]) {
    const plan = prepareDraftRoll(request({ pool, hybrid: hybrid({ hunger, stressUnits }) }));
    assert.equal(plan.pool.hungerDice + plan.pool.stressDice + plan.pool.normalDice, pool);
    assert.ok(plan.pool.normalDice >= 0); assert.ok(plan.pool.stressDice <= 1);
    const faces = Array.from({ length: pool }, (_, i) => i % 10 + 1);
    const colored = resolveDraftRoll(plan.request, faces);
    const plain = evaluateV20(faces, { difficulty: plan.difficulty.effective });
    assert.deepEqual(colored.evaluation, plain);
    assert.ok(colored.proposedEffects.length <= 1);
  }
});
test('all bounded stress transitions stay integral; applied delta matches the resulting value', () => {
  for (let before = 0; before <= 300; before++) for (const delta of [-100, 0, 15, 30, 35, 45]) {
    const result = changeStressUnits(before, delta);
    assert.ok(Number.isInteger(result.after) && result.after >= 0 && result.after <= 300);
    assert.equal(result.after - before, result.appliedDelta);
  }
});
