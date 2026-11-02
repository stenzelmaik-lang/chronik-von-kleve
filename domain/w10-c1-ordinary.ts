/** Phase C1 / E05-A: pure, isolated V20 ordinary character check.
 * The caller supplies an authoritative sheet and explicit roll context. This is
 * not an HTTP endpoint, event, round lock, or resource booking operation.
 */
import { readVitals } from './character-vitals.ts';
import { deriveW10Preview, type W10Declared, type W10Selection } from './w10-selection.ts';
import { resolveDraftRoll, W10RuleError } from './w10-hybrid-draft.ts';

/** Version of the released character-check derivation and evaluation, not the hybrid draft profile. */
export const C1_ORDINARY_RULES_VERSION = 'v20-c1-ordinary-1';

export type C1OrdinaryContext = Readonly<{
  rollId: string;
  characterVersion: number;
  faces: readonly number[];
  willpower?: Readonly<{
    requested: boolean;
    allowed: boolean;
    spentThisRound: boolean;
    timing: 'before' | 'after';
    mode: 'guaranteed_success' | 'ignore_wounds';
  }>;
  automatic?: Readonly<{ requested: boolean; allowed: boolean; withoutTension: boolean }>;
}>;

function plainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every(key => allowed.includes(key));
}

/** Validate even unused declarations before a blocked sheet can return. The
 * context is not a client authorization boundary; unknown fields are refused.
 */
function validateContext(context: C1OrdinaryContext): void {
  if (!plainRecord(context) || !onlyKeys(context, ['rollId', 'characterVersion', 'faces', 'willpower', 'automatic'])) {
    throw new W10RuleError('INVALID_C1_CONTEXT');
  }
  if (typeof context.rollId !== 'string' || !context.rollId.trim()) throw new W10RuleError('INVALID_ROLL_ID');
  if (!Number.isSafeInteger(context.characterVersion) || context.characterVersion < 0) {
    throw new W10RuleError('INVALID_CHARACTER_VERSION');
  }
  if (!Array.isArray(context.faces)) throw new W10RuleError('INVALID_FACES');
  for (let index = 0; index < context.faces.length; index += 1) {
    const face = context.faces[index];
    if (!Object.hasOwn(context.faces, index) || !Number.isInteger(face) || face < 1 || face > 10) {
      throw new W10RuleError('INVALID_FACES');
    }
  }
  if (context.willpower !== undefined) {
    const w = context.willpower;
    if (!plainRecord(w) || !onlyKeys(w, ['requested', 'allowed', 'spentThisRound', 'timing', 'mode'])) {
      throw new W10RuleError('INVALID_C1_CONTEXT');
    }
    if (typeof w.requested !== 'boolean' || typeof w.allowed !== 'boolean' || typeof w.spentThisRound !== 'boolean') {
      throw new W10RuleError('INVALID_INPUT');
    }
    if (w.timing !== 'before' && w.timing !== 'after') throw new W10RuleError('INVALID_WILLPOWER_TIMING');
    if (w.mode !== 'guaranteed_success' && w.mode !== 'ignore_wounds') throw new W10RuleError('INVALID_WILLPOWER_MODE');
  }
  if (context.automatic !== undefined) {
    const a = context.automatic;
    if (!plainRecord(a) || !onlyKeys(a, ['requested', 'allowed', 'withoutTension'])) {
      throw new W10RuleError('INVALID_C1_CONTEXT');
    }
    if (typeof a.requested !== 'boolean' || typeof a.allowed !== 'boolean' || typeof a.withoutTension !== 'boolean') {
      throw new W10RuleError('INVALID_INPUT');
    }
  }
}

/** Blocked sheet selections stay blocked. A ready check is resolved with V20
 * arithmetic only; the hybrid context is deliberately absent. Any proposed
 * willpower effect is informational and must not be booked by this function.
 */
export function resolveC1OrdinaryCheck(
  body: Record<string, unknown>, selection: W10Selection, declared: W10Declared, context: C1OrdinaryContext,
) {
  validateContext(context);
  const willpower = context.willpower;
  const ignoreWounds = willpower?.requested && willpower.mode === 'ignore_wounds';
  const temporary = readVitals(body).willpower.temporary;
  if (willpower?.requested && temporary === null) throw new W10RuleError('WILLPOWER_UNKNOWN');
  if (ignoreWounds) {
    if (willpower.timing !== 'before') throw new W10RuleError('WILLPOWER_TOO_LATE');
    if (!willpower.allowed) throw new W10RuleError('WILLPOWER_NOT_ALLOWED');
    if (temporary === 0) throw new W10RuleError('WILLPOWER_EMPTY');
    if (willpower.spentThisRound) throw new W10RuleError('WILLPOWER_ALREADY_SPENT');
  }
  const sourcePreview = deriveW10Preview(body, selection, declared, context.characterVersion, { ignoreWoundPenalty: !!ignoreWounds });
  if (sourcePreview.status === 'blocked') return sourcePreview;
  const appliedRules = Object.freeze([
    ...(willpower?.requested ? [ignoreWounds ? 'V20-R10' : 'V20-R09'] : []),
    ...(context.automatic?.requested ? ['V20-R08'] : []),
  ]);
  const notApplied = Object.freeze([
    ...sourcePreview.notApplied.filter(entry =>
      !(willpower?.requested && entry.id === 'willpower') && !(ignoreWounds && entry.id === 'wound_exceptions')),
    ...(willpower?.requested ? [{ id: 'willpower_booking', label: 'Willenskraftbuchung', reason: 'C1 berechnet nur die Kostenabsicht; die tatsächliche Buchung folgt mit einem verbindlichen Wurfereignis.' }] : []),
    ...(ignoreWounds ? [{ id: 'other_wound_exceptions', label: 'Weitere Wundausnahmen', reason: 'Schaden, Absorption und Sonderproben sind in C1 nicht freigegeben.' }] : []),
  ].map(entry => Object.freeze(entry)));
  const preview = Object.freeze({ ...sourcePreview, notApplied });
  const abilityRating = preview.provenance.find(part => part.part === 'ability')?.amount;
  const result = resolveDraftRoll({
    rollId: context.rollId,
    characterVersion: context.characterVersion,
    kind: 'ordinary',
    pool: preview.pool.base,
    difficulty: declared.baseDifficulty,
    requiredSuccesses: declared.requiredSuccesses,
    specialtyApplies: preview.specialtyApplies,
    ...(preview.selection.category && abilityRating !== undefined
      ? { training: { category: preview.selection.category, rating: abilityRating } }
      : {}),
    ...(willpower && !ignoreWounds ? { willpower: { requested: willpower.requested, allowed: willpower.allowed,
      spentThisRound: willpower.spentThisRound, timing: willpower.timing, temporary: temporary ?? 0 } } : {}),
    ...(context.automatic ? { automatic: context.automatic } : {}),
  }, context.faces);
  const costIntentions = Object.freeze(ignoreWounds
    ? [Object.freeze({ type: 'WILLPOWER_DELTA' as const, amount: -1 as const, when: 'on_attempt' as const })]
    : result.proposedEffects);
  return Object.freeze({ status: 'resolved' as const, appliedRules, preview, result, costIntentions });
}
