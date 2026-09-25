import { z } from "zod";
import { actor,database,failure,HttpError,input,json,sameOrigin } from "@/server/access";
import { transitionLocationDraft } from "@/server/location-cms-service";
export const dynamic="force-dynamic";
const schema=z.object({action:z.enum(["submit","approve","reject"]),revisionId:z.string().uuid(),expectedVersion:z.number().int().nonnegative(),reason:z.string().trim().max(500).optional()}).strict();
export async function POST(req:Request){try{sameOrigin(req);const a=await actor();const data=schema.safeParse(await input(req));if(!data.success)throw new HttpError(400,"Ungültige Prüfaktion.");return json(await transitionLocationDraft(database(),a,data.data));}catch(error){return failure(error,req);}}
