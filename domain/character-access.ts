import type { Actor } from './types';

// Character sheets belong to the campaign's SL workflow. This does not grant
// access to the owner's private notes, messages, inventory or file library.
export function canManageCampaignCharacter(a: Actor, campaignId: string) {
  return a.status === 'active' && a.campaignId === campaignId && a.gm === true
    && (a.role === 'campaign_owner' || a.role === 'campaign_gm');
}
