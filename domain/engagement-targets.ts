/** Alpha 2.0: pure engagement thresholds. All inputs are qualified active seconds,
 * NOT browser-open time, click counts or self-reported duration. The server-side
 * tracker will determine qualification and only then call this policy.
 * No XP is booked here: a separate server service must verify the interval,
 * record each milestone once and credit the existing character XP ledger.
 */
export type EngagementTargets = Readonly<{
  intervalDays: number;
  firstSeconds: number;
  fullSeconds: number;
}>;

/** 30 days => 8h / 24h. Each additional 30 days multiplies both goals by 1.6. */
export function engagementTargetsForDays(intervalDays: number): EngagementTargets {
  if (!Number.isFinite(intervalDays) || intervalDays <= 0)
    throw new Error('Der Zeitraum zwischen den Spielabenden muss positiv sein.');
  const factor = Math.pow(1.6, (intervalDays - 30) / 30);
  const firstSeconds = Math.ceil(8 * 3600 * factor);
  const fullSeconds = Math.ceil(24 * 3600 * factor);
  if (!Number.isSafeInteger(firstSeconds) || !Number.isSafeInteger(fullSeconds) || fullSeconds <= firstSeconds)
    throw new Error('Der Zeitraum liegt außerhalb der unterstützten Berechnung.');
  return { intervalDays, firstSeconds, fullSeconds };
}

export type EngagementProgress = Readonly<{
  percent: number;
  earnedStages: readonly (1 | 2)[];
  nextStage: 1 | 2 | null;
  remainingSeconds: number;
}>;

/** A display percent can never award XP prematurely: thresholds use exact seconds. */
export function engagementProgress(qualifiedSeconds: number, targets: EngagementTargets): EngagementProgress {
  if (!Number.isSafeInteger(qualifiedSeconds) || qualifiedSeconds < 0 ||
      !Number.isSafeInteger(targets.firstSeconds) || targets.firstSeconds <= 0 ||
      !Number.isSafeInteger(targets.fullSeconds) || targets.fullSeconds <= targets.firstSeconds)
    throw new Error('Ungültige aktive Zeit oder Engagement-Zielwerte.');
  if (qualifiedSeconds >= targets.fullSeconds)
    return { percent: 100, earnedStages: [1, 2], nextStage: null, remainingSeconds: 0 };
  if (qualifiedSeconds >= targets.firstSeconds)
    return {
      percent: 50 + Math.floor(50 * (qualifiedSeconds - targets.firstSeconds) / (targets.fullSeconds - targets.firstSeconds)),
      earnedStages: [1], nextStage: 2, remainingSeconds: targets.fullSeconds - qualifiedSeconds,
    };
  return {
    percent: Math.floor(50 * qualifiedSeconds / targets.firstSeconds),
    earnedStages: [], nextStage: 1, remainingSeconds: targets.firstSeconds - qualifiedSeconds,
  };
}
