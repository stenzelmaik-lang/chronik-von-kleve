import { env } from 'cloudflare:workers';

export function engagementEnabled() {
  return env.CVK_ENGAGEMENT_ENABLED === '1';
}

export function engagementAwardsEnabled() {
  return engagementEnabled() && env.CVK_ENGAGEMENT_AWARDS_ENABLED === '1';
}
