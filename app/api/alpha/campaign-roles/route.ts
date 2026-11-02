import { failure, input, json, sameOrigin } from "@/server/access";
import { changeCampaignRole } from "@/server/campaign-role-change";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    return json(await changeCampaignRole(req, await input(req)));
  } catch (error) {
    return failure(error, req);
  }
}
