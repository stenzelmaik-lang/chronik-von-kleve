/** Pure V20 arithmetic. No RNG, character writes, house rules or narrative effects. */
export type V20Outcome = 'success' | 'failure' | 'botch';
export type V20Options = Readonly<{
  difficulty: number;
  requiredSuccesses?: number;
  specialtyApplies?: boolean;
  guaranteedSuccesses?: number;
  botchPolicy?: 'allowed' | 'never';
}>;
export type V20Evaluation = Readonly<{
  rawSuccessDice: number;
  rawSuccesses: number;
  ones: number;
  cancelled: number;
  netRolledSuccesses: number;
  guaranteedSuccesses: number;
  totalSuccesses: number;
  requiredSuccesses: number;
  rawBotch: boolean;
  outcome: V20Outcome;
  cancelledSuccessIndices: readonly number[];
}>;

export function evaluateV20(faces: readonly number[], options: V20Options): V20Evaluation {
  const { difficulty, requiredSuccesses = 1, specialtyApplies = false,
    guaranteedSuccesses = 0, botchPolicy = 'allowed' } = options;
  if (!Array.isArray(faces) || faces.length < 1 ||
      !Number.isInteger(difficulty) || difficulty < 2 || difficulty > 10 ||
      !Number.isSafeInteger(requiredSuccesses) || requiredSuccesses < 1 ||
      !Number.isSafeInteger(guaranteedSuccesses) || guaranteedSuccesses < 0 ||
      typeof specialtyApplies !== 'boolean' || !['allowed', 'never'].includes(botchPolicy)) {
    throw new Error('V20: ungültiger Würfelvorrat oder Auswertungsregel.');
  }
  let rawSuccessDice = 0, ones = 0;
  const successUnits: number[] = [];
  // for...of also rejects sparse arrays; Array.some would silently skip holes.
  for (const [index, face] of faces.entries()) {
    if (!Number.isInteger(face) || face < 1 || face > 10) throw new Error('V20: ungültige Würfelfläche.');
    if (face === 1) ones++;
    if (face >= difficulty) {
      rawSuccessDice++;
      successUnits.push(index);
      if (face === 10 && specialtyApplies) successUnits.push(index);
    }
  }
  const rawSuccesses = successUnits.length;
  const cancelled = Math.min(rawSuccesses, ones);
  const netRolledSuccesses = rawSuccesses - cancelled;
  const totalSuccesses = netRolledSuccesses + guaranteedSuccesses;
  if (!Number.isSafeInteger(totalSuccesses)) throw new Error('V20: Erfolgszahl außerhalb des sicheren Zahlenbereichs.');
  const rawBotch = botchPolicy === 'allowed' && rawSuccessDice === 0 && ones > 0;
  const outcome = totalSuccesses >= requiredSuccesses ? 'success'
    : rawBotch && guaranteedSuccesses === 0 ? 'botch' : 'failure';
  return Object.freeze({ rawSuccessDice, rawSuccesses, ones, cancelled,
    netRolledSuccesses, guaranteedSuccesses, totalSuccesses, requiredSuccesses,
    rawBotch, outcome, cancelledSuccessIndices: Object.freeze(successUnits.slice(0, cancelled)) });
}
