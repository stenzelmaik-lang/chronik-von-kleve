import { z } from "zod";
import { actor,database,failure,HttpError,input,json,sameOrigin } from "@/server/access";
import { publishLocationRevision,publishLocationTree,readReleaseState,requireCmsPublisher } from "@/server/location-cms-service";
export const dynamic="force-dynamic";
const schema=z.object({action:z.enum(["publish","revoke","block"]),entityId:z.string().min(1).max(160),scope:z.enum(["public","group","player"]),playerId:z.string().min(1).max(180).optional(),revisionId:z.string().uuid().optional(),expectedReleaseVersion:z.number().int().nonnegative(),discoveryState:z.enum(["rumored","known","visited","investigated"]).optional(),grantDiscovery:z.boolean().optional(),reason:z.string().trim().min(1).max(500)}).strict();
const query=z.object({entityId:z.string().min(1).max(160),scope:z.enum(["public","group","player"]),playerId:z.string().min(1).max(180).optional()}).strict();
export async function GET(req:Request){try{const a=await actor();requireCmsPublisher(a);const p=query.safeParse(Object.fromEntries(new URL(req.url).searchParams));if(!p.success)throw new HttpError(400,"Ungültige Freigabeabfrage.");return json(await readReleaseState(database(),a,p.data));}catch(error){return failure(error,req);}}
const treeSchema=z.object({
 action:z.literal("publish-tree"),placeId:z.string().min(1).max(160),
 discoveryState:z.enum(["rumored","known","visited","investigated"]),
 entries:z.array(z.object({entityId:z.string().min(1).max(160),revisionId:z.string().uuid(),expectedReleaseVersion:z.number().int().nonnegative()}).strict()).min(1).max(40),
}).strict();

export async function POST(req:Request){
 try{
  sameOrigin(req);
  const a=await actor(),body=await input(req);
  const tree=treeSchema.safeParse(body);
  if(tree.success)return json(await publishLocationTree(database(),a,tree.data.placeId,tree.data.entries,tree.data.discoveryState));
  const data=schema.safeParse(body);
  if(!data.success)throw new HttpError(400,"Ungültige Veröffentlichungsanfrage.");
  return json(await publishLocationRevision(database(),a,data.data));
 }catch(error){return failure(error,req);}
}
