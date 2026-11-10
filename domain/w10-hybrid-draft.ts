/** CP-RULES-W10-001, Phase A. LOCAL DRAFT ONLY; never an HTTP authorization boundary.
 * Inputs must eventually come from authoritative character/rule snapshots (Phases B/D).
 * This module only calculates previews. It neither persists nor publishes nor spends resources.
 */
import { evaluateV20, type V20Evaluation } from './w10-core.ts';
import { sampleD10Pool } from './w10.ts';

export const HYBRID_DRAFT_PROFILE = Object.freeze({
  rulesetId: 'chroniplay-hybrid-v20-base', rulesVersion: '1.0.0-draft',
  status: 'draft', productionEnabled: false,
} as const);
// Work bound of this local test adapter, not a V20 pool rule or a changed live UI limit.
export const DRAFT_SAMPLE_LIMIT = 1000;
type DieType = 'NORMAL' | 'HUNGER' | 'STRESS';
type RollKind = 'ordinary' | 'damage' | 'soak' | 'test';
type Flag = 'BESTIAL_FAILURE' | 'BEAST_TAINTED_SUCCESS' | 'STRESS_REACTION';
export type DraftRollRequest = Readonly<{
  rollId: string;
  characterVersion: number;
  kind: RollKind;
  pool: number;
  difficulty: number;
  requiredSuccesses?: number;
  specialtyApplies?: boolean;
  cancelledBeforeRoll?: boolean;
  training?: Readonly<{ category: 'talent' | 'skill' | 'knowledge'; rating: number; knowledgeException?: boolean }>;
  willpower?: Readonly<{ requested: boolean; allowed: boolean; temporary: number; spentThisRound: boolean; timing: 'before' | 'after' }>;
  automatic?: Readonly<{ requested: boolean; allowed: boolean; withoutTension: boolean }>;
  hybrid?: Readonly<{ hunger: number; stressUnits: number; stressEligible: boolean; pressure: boolean; nontrivial: boolean }>;
}>;
export type DraftModifier = Readonly<{ source: 'untrained_skill' | 'personal_stress'; amount: number }>;
export class W10RuleError extends Error {
  readonly code: string;
  readonly detail?: Readonly<Record<string, unknown>>;
  constructor(code: string, detail?: Record<string, unknown>) { super(code); this.name = 'W10RuleError'; this.code = code; if (detail) this.detail = Object.freeze(detail); }
}
function block(code: string, detail?: Record<string, unknown>): never { throw new W10RuleError(code, detail); }
function integer(value: number, min: number, max: number, code = 'INVALID_INPUT') {
  if (!Number.isSafeInteger(value) || value < min || value > max) block(code);
}
function boolean(value: boolean) { if (typeof value !== 'boolean') block('INVALID_INPUT'); }
function identity(id: string, version: number) {
  if (typeof id !== 'string' || !id.trim()) block('INVALID_ROLL_ID');
  integer(version, 0, Number.MAX_SAFE_INTEGER, 'INVALID_CHARACTER_VERSION');
}
function freezeRequest(r: DraftRollRequest): DraftRollRequest {
  return Object.freeze({ ...r,
    training: r.training && Object.freeze({ ...r.training }),
    willpower: r.willpower && Object.freeze({ ...r.willpower }),
    automatic: r.automatic && Object.freeze({ ...r.automatic }),
    hybrid: r.hybrid && Object.freeze({ ...r.hybrid }),
  });
}

export function changeStressUnits(before: number, delta: number) {
  integer(before, 0, 300, 'INVALID_STRESS');
  integer(delta, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 'INVALID_STRESS_DELTA');
  const after = delta > 300 - before ? 300 : delta < -before ? 0 : before + delta;
  return Object.freeze({ before, after, requestedDelta: delta, appliedDelta: after - before,
    points: Math.floor(after / 100), progress: after === 300 ? 0 : after % 100 });
}

/** Validates local mathematical preconditions, not account ownership or DB round locks. */
export function prepareDraftRoll(input: DraftRollRequest) {
  const r = freezeRequest(input);
  identity(r.rollId, r.characterVersion);
  if (!['ordinary', 'damage', 'soak', 'test'].includes(r.kind)) block('UNSUPPORTED_ROLL_KIND');
  integer(r.pool, 1, Number.MAX_SAFE_INTEGER, 'EMPTY_OR_INVALID_POOL');
  integer(r.difficulty, 2, 10, 'INVALID_DIFFICULTY');
  integer(r.requiredSuccesses ?? 1, 1, Number.MAX_SAFE_INTEGER, 'INVALID_REQUIRED_SUCCESSES');
  boolean(r.specialtyApplies ?? false);
  boolean(r.cancelledBeforeRoll ?? false);
  if (r.cancelledBeforeRoll) block('CANCELLED_BEFORE_ROLL');
  // Owner decision 31.10.2026: no capping of any kind. A legacy policy field is a request error, not ignored.
  if (Object.hasOwn(r, 'difficultyOverflow')) block('INVALID_DIFFICULTY_POLICY');
  const modifiers: DraftModifier[] = [];
  if (r.training) {
    const t = r.training;
    if (!['talent', 'skill', 'knowledge'].includes(t.category) || r.kind !== 'ordinary') block('INVALID_TRAINING_CONTEXT');
    integer(t.rating, 0, 10, 'INVALID_TRAINING_RATING');
    boolean(t.knowledgeException ?? false);
    if (t.rating === 0 && t.category === 'knowledge' && !t.knowledgeException) block('UNTRAINED_KNOWLEDGE');
    if (t.rating === 0 && t.category === 'skill') modifiers.push(Object.freeze({ source: 'untrained_skill', amount: 1 }));
  }
  if (r.hybrid) {
    const h = r.hybrid;
    integer(h.hunger, 0, 5, 'INVALID_HUNGER');
    integer(h.stressUnits, 0, 300, 'INVALID_STRESS');
    boolean(h.stressEligible); boolean(h.pressure); boolean(h.nontrivial);
  }
  const hybrid = r.hybrid;
  const stressEligible = r.kind === 'ordinary' && !!hybrid?.stressEligible && !!hybrid.nontrivial;
  const points = Math.floor((hybrid?.stressUnits ?? 0) / 100);
  if (stressEligible && points >= 1 && (hybrid!.pressure || points === 3)) {
    modifiers.push(Object.freeze({ source: 'personal_stress', amount: 1 }));
  }
  // V20 allows target numbers 2–10 only; a higher sum makes the check invalid before any die is rolled.
  const difficulty = r.difficulty + modifiers.reduce((sum, m) => sum + m.amount, 0);
  if (difficulty > 10) block('DIFFICULTY_ABOVE_10', { base: r.difficulty, modifiers: Object.freeze(modifiers), sum: difficulty });
  let guaranteedSuccesses = 0;
  if (r.willpower) {
    const w = r.willpower;
    boolean(w.requested); boolean(w.allowed); boolean(w.spentThisRound);
    integer(w.temporary, 0, 10, 'INVALID_WILLPOWER');
    if (!['before', 'after'].includes(w.timing)) block('INVALID_WILLPOWER_TIMING');
    if (w.requested) {
      if (w.timing !== 'before') block('WILLPOWER_TOO_LATE');
      if (!w.allowed || r.kind !== 'ordinary') block('WILLPOWER_NOT_ALLOWED');
      if (w.temporary === 0) block('WILLPOWER_EMPTY');
      if (w.spentThisRound) block('WILLPOWER_ALREADY_SPENT');
      guaranteedSuccesses = 1;
    }
  }
  if (r.automatic) {
    boolean(r.automatic.requested); boolean(r.automatic.allowed); boolean(r.automatic.withoutTension);
  }
  const automatic = !!r.automatic?.requested;
  if (automatic && (r.kind !== 'ordinary' || !r.automatic!.allowed || !r.automatic!.withoutTension ||
      r.pool < difficulty || (r.requiredSuccesses ?? 1) !== 1 || guaranteedSuccesses > 0 || hybrid?.pressure || hybrid?.nontrivial)) {
    block('AUTOMATIC_SUCCESS_NOT_ALLOWED');
  }
  const hungerDice = !automatic && r.kind === 'ordinary' ? Math.min(r.pool, hybrid?.hunger ?? 0) : 0;
  const stressDice = !automatic && stressEligible && points >= 2 && r.pool > hungerDice ? 1 : 0;
  return Object.freeze({ request: r, profile: HYBRID_DRAFT_PROFILE, automatic, guaranteedSuccesses,
    difficulty: Object.freeze({ base: r.difficulty, modifiers: Object.freeze(modifiers), effective: difficulty }),
    pool: Object.freeze({ base: r.pool, effective: automatic ? 0 : r.pool, hungerDice, stressDice, normalDice: automatic ? 0 : r.pool - hungerDice - stressDice }),
    stressEligible: !automatic && stressEligible,
  });
}
type PreparedRoll = ReturnType<typeof prepareDraftRoll>;
type DraftEffect = Readonly<
  { type: 'WILLPOWER_DELTA'; amount: -1; when: 'on_attempt' } |
  { type: 'PERSONAL_STRESS_DELTA'; amount: number; appliedDelta: number; when: 'after_roll' }
>;

function resolvePrepared(prepared: PreparedRoll, faces: readonly number[]) {
  const { request: r, pool, difficulty, automatic, guaranteedSuccesses } = prepared;
  if (!Array.isArray(faces) || faces.length !== (automatic ? 0 : pool.effective)) block('FACE_COUNT_MISMATCH');
  const dice = Object.freeze(Array.from(faces, (face, index) => Object.freeze({
    id: `${r.rollId}:d${index + 1}`,
    type: (index < pool.hungerDice ? 'HUNGER' : index < pool.hungerDice + pool.stressDice ? 'STRESS' : 'NORMAL') as DieType,
    face,
  })));
  const evaluation: V20Evaluation = automatic ? Object.freeze({ rawSuccessDice: 0, rawSuccesses: 0, ones: 0,
    cancelled: 0, netRolledSuccesses: 0, guaranteedSuccesses: 1, totalSuccesses: 1, requiredSuccesses: 1,
    rawBotch: false, outcome: 'success', cancelledSuccessIndices: Object.freeze([]) })
    : evaluateV20(faces, { difficulty: difficulty.effective, requiredSuccesses: r.requiredSuccesses,
      specialtyApplies: r.specialtyApplies, guaranteedSuccesses,
      botchPolicy: r.kind === 'damage' || r.kind === 'soak' ? 'never' : 'allowed' });
  const flags: Flag[] = [];
  const hungerOne = dice.some(d => d.type === 'HUNGER' && d.face === 1);
  if (evaluation.outcome !== 'success' && hungerOne) flags.push('BESTIAL_FAILURE');
  if (evaluation.outcome === 'success' && dice.filter(d => d.face === 10).length >= 2 &&
      dice.some(d => d.type === 'HUNGER' && d.face === 10)) flags.push('BEAST_TAINTED_SUCCESS');
  if (evaluation.outcome === 'failure' && !hungerOne && dice.some(d => d.type === 'STRESS' && d.face === 1)) flags.push('STRESS_REACTION');
  let stressDelta = 0;
  if (prepared.stressEligible && evaluation.outcome !== 'success') {
    stressDelta = evaluation.outcome === 'botch' && hungerOne ? 45
      : hungerOne ? 35 : evaluation.outcome === 'botch' ? 30 : flags.includes('STRESS_REACTION') ? 15 : 0;
  }
  const stress = changeStressUnits(r.hybrid?.stressUnits ?? 0, stressDelta);
  const effects: DraftEffect[] = [];
  if (guaranteedSuccesses) effects.push(Object.freeze({ type: 'WILLPOWER_DELTA', amount: -1, when: 'on_attempt' }));
  if (stressDelta) effects.push(Object.freeze({ type: 'PERSONAL_STRESS_DELTA', amount: stressDelta, appliedDelta: stress.appliedDelta, when: 'after_roll' }));
  return Object.freeze({ rollId: r.rollId, characterVersion: r.characterVersion, profile: HYBRID_DRAFT_PROFILE,
    request: r, resolution: automatic ? 'automatic' as const : 'rolled' as const, dice,
    pool, difficulty, evaluation, flags: Object.freeze(flags), stress, proposedEffects: Object.freeze(effects) });
}

export function resolveDraftRoll(request: DraftRollRequest, faces: readonly number[]) {
  return resolvePrepared(prepareDraftRoll(request), faces);
}

/** Local test adapter reuses the shipped unbiased generator; no new RNG or result correction.
 * The legacy UI's 30-die limit is a transport limit, not a V20 rules limit.
 */
export function sampleDraftRoll(request: DraftRollRequest, source?: (words: Uint32Array) => unknown) {
  const prepared = prepareDraftRoll(request);
  const faces: number[] = [];
  if (!prepared.automatic) {
    if (prepared.pool.effective > DRAFT_SAMPLE_LIMIT) block('DRAFT_SAMPLE_LIMIT_EXCEEDED');
    for (let remaining = prepared.pool.effective; remaining > 0; remaining -= 30) {
      faces.push(...sampleD10Pool(Math.min(30, remaining), source));
    }
  }
  return resolvePrepared(prepared, faces);
}

export type DraftRouseRequest = Readonly<{ rollId: string; hunger: number; voluntary: boolean }>;
function prepareRouse(r: DraftRouseRequest) {
  identity(r.rollId, 0); integer(r.hunger, 0, 5, 'INVALID_HUNGER'); boolean(r.voluntary);
  if (!r.voluntary) block('FORCED_ROUSE_REQUIRES_RULE');
  if (r.voluntary && r.hunger === 5) block('VOLUNTARY_ROUSE_AT_MAX_HUNGER');
  return Object.freeze({ ...r });
}
export function resolveDraftRouse(request: DraftRouseRequest, face: number) {
  const r = prepareRouse(request);
  integer(face, 1, 10, 'INVALID_FACE');
  const hungerAfter = Math.min(5, r.hunger + (face <= 5 ? 1 : 0));
  return Object.freeze({ profile: HYBRID_DRAFT_PROFILE, rollId: r.rollId,
    die: Object.freeze({ id: `${r.rollId}:d1`, type: 'NORMAL' as const, face }),
    checkPassed: face >= 6, hungerBefore: r.hunger, hungerAfter,
    // A failed cost check does not fail the associated action or modify its existing pool.
    proposedEffects: Object.freeze(hungerAfter === r.hunger ? [] : [Object.freeze({
      type: 'HUNGER_DELTA' as const, amount: 1, when: 'after_action_resolution' as const,
    })]),
  });
}
export function sampleDraftRouse(request: DraftRouseRequest, source?: (words: Uint32Array) => unknown) {
  const prepared = prepareRouse(request);
  return resolveDraftRouse(prepared, sampleD10Pool(1, source)[0]);
}
