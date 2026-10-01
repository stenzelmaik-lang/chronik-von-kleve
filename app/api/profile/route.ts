import { failure, input, json, sameOrigin } from "@/server/access";
import { profile, saveProfile } from "@/server/account-profile";
export const dynamic="force-dynamic";
export async function GET(req:Request){try{return json(await profile(req));}catch(e){return failure(e,req);}}
export async function PATCH(req:Request){try{sameOrigin(req);return json(await saveProfile(req,await input(req)));}catch(e){return failure(e,req);}}
