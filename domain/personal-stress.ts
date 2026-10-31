/** Personal stress of the hybrid ruleset (owner decisions 31.10.2026, K1/R1/R1b). READ-ONLY in Phase B.
 * - `personalStressUnits` (0–300) is its own server-owned field on the character record. Only the
 *   new mechanics (Phase C/D) may change it; no client path writes it.
 * - The legacy manual table value (0–10, `TableVitals.personal`) stays stored unchanged as a
 *   historical value. It is shown, never converted and never a dice modifier.
 * - Group stress (0–10) is a separate SL-only resource and is not read here.
 * - Without a stored value a character starts at 0, visibly marked as "not recorded"; nothing is written. */
import { changeStressUnits } from './w10-hybrid-draft.ts';

export const PERSONAL_STRESS_FIELD = 'personalStressUnits';
export const PERSONAL_STRESS_MAXIMUM = 300;

export type PersonalStressView = Readonly<{
  units: number; points: number; progress: number; maximum: number;
  recorded: boolean; invalid?: true;
}>;

export function readPersonalStress(body: Record<string, unknown>): PersonalStressView {
  const raw = body[PERSONAL_STRESS_FIELD];
  const recorded = raw !== undefined && raw !== null;
  const valid = Number.isSafeInteger(raw) && (raw as number) >= 0 && (raw as number) <= PERSONAL_STRESS_MAXIMUM;
  // An invalid stored value is reported, not repaired: the view falls back to 0 and says so.
  const units = recorded && valid ? raw as number : 0;
  const { points, progress } = changeStressUnits(units, 0);
  return Object.freeze({ units, points, progress, maximum: PERSONAL_STRESS_MAXIMUM, recorded: recorded && valid, ...(recorded && !valid ? { invalid: true as const } : {}) });
}

/** The historical manual value next to the new one; explicitly without effect on rolls. */
export function legacyManualStress(value: unknown) {
  return Number.isSafeInteger(value) ? Object.freeze({ value: value as number, maximum: 10, effect: 'none' as const }) : null;
}
