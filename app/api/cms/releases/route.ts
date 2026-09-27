import { z } from "zod";
import { actor,database,failure,HttpError,input,json,sameOrigin } from "@/server/access";
import { publishLocationRevision,readReleaseState,requireCmsPublisher } from "@/server/location-cms-service";
export const dynamic="force-dynamic";
const schema=z.object({action:z.enum(["publish","revoke","block"]),entityId:z.string().min(1).max(160),scope:z.enum(["public","group","player"]),playerId:z.string().min(1).max(180).optional(),revisionId:z.string().uuid().optional(),expectedReleaseVersion:z.number().int().nonnegative(),discoveryState:z.enum(["rumored","known","visited","investigated"]).optional(),reason:z.string().trim().min(1).max(500)}).strict();
const query=z.object({entityId:z.string().min(1).max(160),scope:z.enum(["public","group","player"]),playerId:z.string().min(1).max(180).optional()}).strict();
export async function GET(req:Request){try{const a=await actor();requireCmsPublisher(a);const p=query.safeParse(Object.fromEntries(new URL(req.url).searchParams));if(!p.success)throw new HttpError(400,"Ungültige Freigabeabfrage.");return json(await readReleaseState(database(),a,p.data));}catch(error){return failure(error,req);}}
export async function POST(req:Request){try{sameOrigin(req);const a=await actor();const data=schema.safeParse(await input(req));if(!data.success)throw new HttpError(400,"Ungültige Veröffentlichungsanfrage.");return json(await publishLocationRevision(database(),a,data.data));}catch(error){return failure(error,req);}}
