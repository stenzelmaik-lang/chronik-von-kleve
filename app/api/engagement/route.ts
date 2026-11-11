import { z } from 'zod';
import { actor, database, failure, gmOnly, HttpError, input, json, sameOrigin } from '@/server/access';
import { engagementCategories } from '@/domain/engagement-browser';
import { engagementSummary, recordEngagementPulse } from '@/server/engagement-activity';
import { engagementAwardsEnabled, engagementEnabled } from '@/server/engagement-config';
import { campaignEngagementOverview } from '@/server/engagement-awards';

export const dynamic = 'force-dynamic';

const pulseSchema = z.object({
  category: z.enum(engagementCategories),
  ticket: z.string().uuid().optional(),
  restart: z.literal(true).optional(),
}).strict().refine(pulse => !pulse.restart || !!pulse.ticket);

async function scope() {
  const { id, campaignId } = await actor();
  if (!engagementEnabled()) throw new HttpError(404, 'Aktivitätsmessung ist derzeit nicht verfügbar.');
  return { memberId: id, campaignId };
}

export async function GET(req: Request) {
  try {
    if (new URL(req.url).searchParams.get('view') === 'sl') {
      const a = await actor();
      gmOnly(a);
      if (!engagementAwardsEnabled()) throw new HttpError(404, 'Engagement-EP sind derzeit nicht verfügbar.');
      return json(await campaignEngagementOverview(database(), a.campaignId, Date.now()));
    }
    const owner = await scope();
    return json(await engagementSummary(database(), owner, Date.now(), engagementAwardsEnabled()));
  } catch (error) {
    return failure(error, req);
  }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const owner = await scope();
    const pulse = pulseSchema.safeParse(await input(req, 256));
    if (!pulse.success) throw new HttpError(400, 'Ungültiges Aktivitätssignal.');
    return json(await recordEngagementPulse(database(), owner, pulse.data, Date.now(), engagementAwardsEnabled()));
  } catch (error) {
    return failure(error, req);
  }
}
