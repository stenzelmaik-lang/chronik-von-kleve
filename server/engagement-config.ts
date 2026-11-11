import { env } from 'cloudflare:workers';

export function engagementEnabled() {
  return env.CVK_ENGAGEMENT_ENABLED === '1';
}
