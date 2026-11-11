import { env } from 'cloudflare:workers';

export function engagementPrivacyContact() {
  const controller = env.CVK_PRIVACY_CONTROLLER?.trim();
  const email = env.CVK_PRIVACY_CONTACT?.trim();
  return controller && email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { controller, email } : null;
}

export function engagementEnabled() {
  return env.CVK_ENGAGEMENT_ENABLED === '1' && engagementPrivacyContact() !== null;
}

export function engagementAwardsEnabled() {
  return engagementEnabled() && env.CVK_ENGAGEMENT_AWARDS_ENABLED === '1';
}
