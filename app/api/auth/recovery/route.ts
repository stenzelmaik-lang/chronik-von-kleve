import { failure,input,json,sameOrigin } from "@/server/access";
import { resetPassword } from "@/server/alpha-access";
export async function POST(req:Request){try{sameOrigin(req);return json(await resetPassword(req,await input(req)));}catch(e){return failure(e,req);}}
