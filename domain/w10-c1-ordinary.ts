/** Phase C1 / E05-A: pure, isolated V20 ordinary character check.
 * The caller supplies an authoritative sheet and explicit roll context. This is
 * not an HTTP endpoint, event, round lock, or resource booking operation.
 */
import { readVitals } from './character-vitals.ts';
import { deriveW10Preview, type W10Declared, type W10Selection } from './w10-selection.ts';
import { resolveDraftRoll, W10RuleError } from './w10-hybrid-draft.ts';

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

/** Blocked sheet selections stay blocked. A ready check is resolved with V20
 * arithmetic only; the hybrid context is deliberately absent. Any proposed
 * willpower effect is informational and must not be booked by this function.
 */
export function resolveC1OrdinaryCheck(
  body: Record<string, unknown>, selection: W10Selection, declared: W10Declared, context: C1OrdinaryContext,
) {
  const willpower = context.willpower;
  if (willpower && !['guaranteed_success', 'ignore_wounds'].includes(willpower.mode)) {
    throw new W10RuleError('INVALID_WILLPOWER_MODE');
  }
  const ignoreWounds = willpower?.requested && willpower.mode === 'ignore_wounds';
  const temporary = readVitals(body).willpower.temporary;
  if (willpower?.requested && temporary === null) throw new W10RuleError('WILLPOWER_UNKNOWN');
  if (ignoreWounds) {
    if (willpower.timing !== 'before') throw new W10RuleError('WILLPOWER_TOO_LATE');
    if (!willpower.allowed) throw new W10RuleError('WILLPOWER_NOT_ALLOWED');
    if (temporary === 0) throw new W10RuleError('WILLPOWER_EMPTY');
    if (willpower.spentThisRound) throw new W10RuleError('WILLPOWER_ALREADY_SPENT');
  }
  const preview = deriveW10Preview(body, selection, declared, context.characterVersion, { ignoreWoundPenalty: !!ignoreWounds });
  if (preview.status === 'blocked') return preview;
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
  return Object.freeze({ status: 'resolved' as const, preview, result, costIntentions });
}
