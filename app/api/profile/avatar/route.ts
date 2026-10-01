import { failure } from "@/server/access";
import { avatar } from "@/server/account-profile";
export const dynamic="force-dynamic";
export async function GET(req:Request){try{return await avatar(req);}catch(e){return failure(e,req);}}
