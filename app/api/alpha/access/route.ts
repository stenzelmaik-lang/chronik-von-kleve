import { failure,input,json,sameOrigin } from "@/server/access";
import { accessOverview,manageAccess } from "@/server/alpha-access";
export const dynamic="force-dynamic";
export async function GET(req:Request){try{return json(await accessOverview(req));}catch(e){return failure(e,req);}}
export async function POST(req:Request){try{sameOrigin(req);return json(await manageAccess(req,await input(req)));}catch(e){return failure(e,req);}}
