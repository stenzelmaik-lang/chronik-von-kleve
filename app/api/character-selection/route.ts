import {z} from 'zod';
import {actor,sameOrigin,input,json,failure,HttpError} from '@/server/access';
import {account} from '@/server/account-profile';
import {selectedCharacter,saveSelectedCharacter} from '@/server/character-selection';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const a=await actor(),u=await account(req);return json({characterId:await selectedCharacter(a,u.id)});}catch(e){return failure(e,req);}}
export async function PATCH(req:Request){try{sameOrigin(req);const a=await actor(),u=await account(req),parsed=z.object({characterId:z.string().min(1).max(100).nullable()}).strict().safeParse(await input(req));if(!parsed.success)throw new HttpError(400,'Bitte einen eigenen aktiven Charakter auswählen.');return json(await saveSelectedCharacter(a,u.id,parsed.data.characterId));}catch(e){return failure(e,req);}}
