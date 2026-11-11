import type { EngagementWindow } from '../domain/engagement-window.ts';
import { engagementProgress } from '../domain/engagement-targets.ts';
import type { CharacterXpRewardInput } from './xp-reward-service.ts';

type VerifiedEngagement = {
  campaignId: string;
  intervalId: string;
  appointmentId: string;
  appointmentDate: string;
  characterId: string;
  actorId: string;
  verifiedSeconds: number;
};

/** Server integration point for independently verified, character-bound time.
 * Browser aggregates never enter this function. The resulting source keys are
 * stable across appointment changes and map to the existing XP ledger CAS.
 */
export function engagementRewardPlans(window: EngagementWindow, evidence: VerifiedEngagement): CharacterXpRewardInput[] {
  if (window.status !== 'confirmed' || window.intervalId !== evidence.intervalId ||
      window.appointmentId !== evidence.appointmentId || window.appointmentDate !== evidence.appointmentDate) return [];
  return engagementProgress(evidence.verifiedSeconds, window.targets).earnedStages.map(milestone => {
    const source: CharacterXpRewardInput['source'] = { type: 'engagement', campaignId: evidence.campaignId, scopeId: window.intervalId, milestone };
    return {
      campaignId: evidence.campaignId,
      characterId: evidence.characterId,
      actorId: evidence.actorId,
      source,
      amount: 1,
      reason: 'Verifizierte Vorbereitung · Stufe ' + milestone,
    };
  });
}
