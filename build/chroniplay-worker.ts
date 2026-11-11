import handler from 'vinext/server/fetch-handler';
import { pruneEngagement } from '../server/engagement-retention';

export default {
  fetch: handler.fetch,
  async scheduled(controller: ScheduledController, env: Cloudflare.Env) {
    if (!env.DB) throw new Error('D1 binding is required for engagement retention.');
    await pruneEngagement(env.DB, controller.scheduledTime);
  },
};
