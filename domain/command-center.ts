import type { Actor, Entity } from './types';

export function commandCenterAllowed(a: Actor) {
  return a.status === 'active' && a.gm && ['campaign_owner', 'campaign_gm'].includes(a.role);
}

export function commandHandouts(entities: Entity[], campaignId: string) {
  return entities.filter(e => e.campaignId === campaignId && e.type === 'HANDOUT'
    && e.canonStatus !== 'GM_SECRET' && e.content.recoveryOnly !== true
    && e.content.canonStatus !== 'GM_SECRET' && e.content.canon_status !== 'GM_SECRET');
}
