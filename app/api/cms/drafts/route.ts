import { z } from "zod";
import { actor,database,failure,HttpError,input,json,sameOrigin } from "@/server/access";
import { createLocationDraft,listLocationDrafts,locationDraftBaseline,requireCmsEditor,saveLocationDraft } from "@/server/location-cms-service";
export const dynamic="force-dynamic";
const createSchema=z.object({entityId:z.string().min(1).max(160),audience:z.enum(["gm","public","group","player"]),playerId:z.string().min(1).max(180).optional(),payload:z.unknown().optional(),geography:z.unknown().optional(),gmSecret:z.unknown().optional(),sourceRevisionId:z.string().uuid().optional(),expectedLatest:z.string().max(80).optional()}).strict();
const saveSchema=z.object({revisionId:z.string().uuid(),expectedVersion:z.number().int().nonnegative(),payload:z.unknown().optional(),geography:z.unknown().optional(),gmSecret:z.unknown().optional(),heroFileId:z.union([z.string().uuid(),z.null()]).optional()}).strict();
export async function GET(req:Request){
  try{
    const a=await actor();requireCmsEditor(a);
    const query=new URL(req.url).searchParams,entityId=query.get("entityId"),scope=query.get("scope"),playerId=query.get("playerId");
    if(!entityId)throw new HttpError(400,"Ortsobjekt fehlt.");
    const db=database(),drafts=await listLocationDrafts(db,a,entityId);
    const hasScopedDraft=drafts.some(item=>item.audience_scope===scope&&(scope!=="player"||item.audience_user_id===playerId));
    const baseline=scope&&scope!=="gm"&&(scope!=="player"||playerId)&&!hasScopedDraft
      ?await locationDraftBaseline(db,a,entityId,scope,playerId):null;
    return json({drafts,...(scope?{baseline}:{})});
  }catch(error){return failure(error,req);}
}
export async function POST(req:Request){try{sameOrigin(req);const a=await actor();requireCmsEditor(a);const data=createSchema.safeParse(await input(req));if(!data.success)throw new HttpError(400,"Ungültige Entwurfsanfrage.");return json(await createLocationDraft(database(),a,data.data),201);}catch(error){return failure(error,req);}}
export async function PATCH(req:Request){try{sameOrigin(req);const a=await actor();requireCmsEditor(a);const data=saveSchema.safeParse(await input(req));if(!data.success)throw new HttpError(400,"Ungültige oder unvollständige Entwurfsdaten.");return json(await saveLocationDraft(database(),a,data.data));}catch(error){return failure(error,req);}}
